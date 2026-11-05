package com.vibedo.app

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.vibedo.app.data.ACCENTS
import com.vibedo.app.data.ActiveTimer
import com.vibedo.app.data.AppData
import com.vibedo.app.data.DataStorage
import com.vibedo.app.data.DEFAULT_SYNC_PORT
import com.vibedo.app.data.LIST_COLORS
import com.vibedo.app.data.LegacyMigration
import com.vibedo.app.data.Payday
import com.vibedo.app.data.RepeatRule
import com.vibedo.app.data.Settings
import com.vibedo.app.data.Step
import com.vibedo.app.data.SyncClient
import com.vibedo.app.data.SyncConfig
import com.vibedo.app.data.Task
import com.vibedo.app.data.TaskList
import com.vibedo.app.data.TimeEntry
import com.vibedo.app.data.advanceRepeatDate
import com.vibedo.app.data.collectNotifications
import com.vibedo.app.data.createSeedData
import com.vibedo.app.data.keyToDate
import com.vibedo.app.data.mergeAppData
import com.vibedo.app.data.normalizeData
import com.vibedo.app.data.nextRepeatKey
import com.vibedo.app.data.normalizeRepeat
import com.vibedo.app.data.normalizeTags
import com.vibedo.app.data.snapshot
import com.vibedo.app.data.todayKey
import com.vibedo.app.data.toJson
import com.vibedo.app.data.uid
import com.vibedo.app.notifications.Notifications
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

sealed class View {
    data class Smart(val id: String) : View()
    data class ListView(val id: String) : View()
    data object Time : View()
    data object Salary : View()
    data object Calendar : View()
    data object Stats : View()
    data object Settings : View()
}

data class PomodoroState(
    val phase: String = "idle",
    val endsAt: Long? = null,
    val remainingMs: Long = 0,
    val taskId: String? = null,
    val cycle: Int = 0,
)

private val VIEW_KIND_LABELS = mapOf(
    "myday" to "Мій день",
    "important" to "Важливі",
    "planned" to "Заплановані",
    "all" to "Усі задачі",
)

class AppViewModel(application: Application) : AndroidViewModel(application) {

    private val storage = DataStorage(application)
    private val syncClient = SyncClient()
    private val prefs = application.getSharedPreferences("vibedo", Application.MODE_PRIVATE)

    var data by mutableStateOf(AppData())
        private set
    var hydrated by mutableStateOf(false)
        private set
    var view by mutableStateOf<View>(View.Smart("myday"))
        private set
    var selectedTaskId by mutableStateOf<String?>(null)
        private set
    var search by mutableStateOf("")
        private set
    var sort by mutableStateOf("created")
        private set
    var toast by mutableStateOf<String?>(null)
    var saveStatus by mutableStateOf("idle")
        private set
    var lastSavedAt by mutableStateOf<Long?>(null)
        private set
    var syncConfig by mutableStateOf(SyncConfig())
        private set
    var syncPhase by mutableStateOf("idle")
        private set
    var syncMessage by mutableStateOf("")
        private set
    var syncing by mutableStateOf(false)
        private set
    var pomodoro by mutableStateOf(PomodoroState())
        private set
    var pendingNotificationTaskId by mutableStateOf<String?>(null)
        private set

    private var saveJob: Job? = null
    private var lastAlarmFingerprint: String? = null
    private var pomodoroSavedAt = 0L
    private var autoSyncJob: Job? = null
    private var syncToken: String = ""

    init {
        Notifications.createChannel(application)
        syncConfig = storage.loadSync()
        syncToken = syncConfig.token
        val stored = storage.load()
        if (stored != null) {
            data = stored
            hydrated = true
            afterHydrate()
        } else {
            val migration = LegacyMigration(application)
            migration.migrate { snapshot ->
                data = snapshot.data ?: createSeedData()
                if (snapshot.sync != null) {
                    syncConfig = storage.saveSync(snapshot.sync)
                    syncToken = syncConfig.token
                }
                snapshot.pomodoro?.let { restorePomodoro(it) }
                storage.save(data)
                migration.markMigrated()
                hydrated = true
                afterHydrate()
            }
        }
    }

    private fun afterHydrate() {
        if (pomodoro.phase != "idle") restorePomodoroFromPrefs()
        lastAlarmFingerprint = alarmFingerprint(data)
        Notifications.scheduleAll(getApplication(), data)
        startPomodoroLoop()
        startAutoSync()
    }

    /* ------------------------------- navigation ------------------------------ */

    fun navigate(next: View) {
        view = next
        selectedTaskId = null
        search = ""
    }

    fun selectTask(id: String?) {
        selectedTaskId = id
    }

    fun updateSearch(value: String) {
        search = value
    }

    fun updateSort(value: String) {
        sort = value
    }

    fun showToast(message: String) {
        toast = message
    }

    fun consumeToast() {
        toast = null
    }

    fun openFromNotification(taskId: String?) {
        if (taskId == null) return
        pendingNotificationTaskId = taskId
    }

    fun consumePendingNotification() {
        pendingNotificationTaskId = null
    }

    /* --------------------------------- helpers ------------------------------- */

    private fun persist() {
        val snap = snapshot(data)
        data = data.copy(updatedAt = snap.updatedAt)
        saveStatus = "saving"
        saveJob?.cancel()
        saveJob = viewModelScope.launch {
            delay(300)
            val ok = withContext(Dispatchers.IO) { storage.save(snap) }
            saveStatus = if (ok) "saved" else "error"
            if (ok) lastSavedAt = System.currentTimeMillis()
            withContext(Dispatchers.IO) {
                val fingerprint = alarmFingerprint(snap)
                if (fingerprint != lastAlarmFingerprint) {
                    Notifications.scheduleAll(getApplication(), snap)
                    lastAlarmFingerprint = fingerprint
                }
            }
        }
    }

    private fun alarmFingerprint(data: AppData): String = buildString {
        append(data.settings.notifications)
        append('|').append(data.settings.paydayReminderDays)
        data.tasks.forEach { task ->
            append('|').append(task.id)
            append(':').append(task.completed)
            append(':').append(task.reminderAt)
            append(':').append(task.dueDate)
            append(':').append(task.dueTime)
            append(':').append(task.title)
        }
        data.paydays.forEach { payday ->
            append('|').append(payday.id)
            append(':').append(payday.date)
            append(':').append(payday.amount)
            append(':').append(payday.note)
        }
    }

    fun saveNow() {
        viewModelScope.launch(Dispatchers.IO) {
            storage.save(data)
        }
    }

    private fun updateList(id: String, transform: (TaskList) -> TaskList) {
        data = data.copy(lists = data.lists.map { if (it.id == id) transform(it) else it })
        persist()
    }

    private fun mutateTask(id: String, transform: (Task) -> Task) {
        data = data.copy(tasks = data.tasks.map { if (it.id == id) transform(it) else it })
        persist()
    }

    private fun mutate(transform: (AppData) -> AppData) {
        data = transform(data)
        persist()
    }

    private fun repeatCopy(task: Task): Task {
        val now = System.currentTimeMillis()
        val nextDue = nextRepeatKey(task)
        val shiftDays = if (task.dueDate != null) {
            keyToDate(nextDue).toEpochDay() - keyToDate(task.dueDate).toEpochDay()
        } else 0L
        return task.copy(
            id = uid("task_"),
            completed = false,
            completedAt = null,
            myDayDate = null,
            dueDate = nextDue,
            reminderAt = task.reminderAt?.let { it + shiftDays * 86_400_000L },
            notifiedAt = null,
            createdAt = now,
            updatedAt = now,
            steps = task.steps.map { Step(uid("step_"), it.title, false) },
            spawnedTaskId = null,
        )
    }

    /* --------------------------------- lists --------------------------------- */

    fun addList(name: String, color: String? = null): String {
        val now = System.currentTimeMillis()
        val list = TaskList(
            id = uid("list_"),
            name = name.trim().ifBlank { "Новий список" },
            color = color ?: LIST_COLORS[data.lists.size % LIST_COLORS.size],
            hourlyRate = null,
            createdAt = now,
            updatedAt = now,
            order = data.lists.size,
        )
        data = data.copy(lists = data.lists + list)
        view = View.ListView(list.id)
        selectedTaskId = null
        persist()
        return list.id
    }

    fun updateListDetails(id: String, name: String, color: String, hourlyRate: Double?) {
        updateList(id) {
            it.copy(
                name = name.trim().ifBlank { "Новий список" }.take(80),
                color = color,
                hourlyRate = hourlyRate,
                updatedAt = System.currentTimeMillis(),
            )
        }
    }

    fun deleteList(id: String) {
        val removedTaskIds = data.tasks.filter { it.listId == id }.map { it.id }.toSet()
        val lists = data.lists.filter { it.id != id }.toMutableList()
        if (lists.isEmpty()) {
            val now = System.currentTimeMillis()
            lists.add(TaskList(uid("list_"), "Мої задачі", LIST_COLORS[0], null, now, now, 0))
        }
        data = data.copy(
            lists = lists,
            tasks = data.tasks.filter { it.listId != id },
            entries = data.entries.filter { it.listId != id && it.taskId !in removedTaskIds },
            activeTimer = data.activeTimer?.takeIf { it.taskId !in removedTaskIds },
        )
        if (view is View.ListView && (view as View.ListView).id == id) {
            view = View.Smart("myday")
        }
        selectedTaskId = null
        persist()
    }

    /* --------------------------------- tasks --------------------------------- */

    fun addTask(
        title: String,
        listId: String? = null,
        dueDate: String? = null,
        dueTime: String? = null,
        important: Boolean = false,
        myDay: Boolean = false,
        notes: String = "",
        tags: List<String> = emptyList(),
        repeat: RepeatRule? = null,
        reminderAt: Long? = null,
        estimateMinutes: Int? = null,
    ): String {
        val targetList = listId
            ?: (view as? View.ListView)?.id
            ?: data.lists.firstOrNull()?.id
            ?: return ""
        val now = System.currentTimeMillis()
        val task = Task(
            id = uid("task_"),
            listId = targetList,
            title = title.trim().ifBlank { "Без назви" },
            notes = notes,
            dueDate = dueDate,
            dueTime = dueTime,
            important = important,
            myDayDate = if (myDay) todayKey() else null,
            createdAt = now,
            updatedAt = now,
            tags = normalizeTags(tags),
            repeat = normalizeRepeat(repeat?.freq, repeat?.interval),
            reminderAt = reminderAt,
            estimateMinutes = estimateMinutes,
        )
        data = data.copy(tasks = listOf(task) + data.tasks)
        persist()
        return task.id
    }

    fun updateTask(id: String, title: String? = null, notes: String? = null,
                   listId: String? = null, dueDate: String? = null, dueTime: String? = null,
                   reminderAt: Long? = null, estimateMinutes: Int? = null,
                   tags: List<String>? = null, repeat: RepeatRule? = null, clearRepeat: Boolean = false) {
        mutateTask(id) {
            it.copy(
                title = title?.trim()?.ifBlank { it.title } ?: it.title,
                notes = notes ?: it.notes,
                listId = listId ?: it.listId,
                dueDate = dueDate,
                dueTime = dueTime,
                reminderAt = reminderAt,
                estimateMinutes = estimateMinutes,
                tags = tags?.let { values -> normalizeTags(values) } ?: it.tags,
                repeat = if (clearRepeat) null else normalizeRepeat(repeat?.freq, repeat?.interval) ?: it.repeat,
                updatedAt = System.currentTimeMillis(),
            )
        }
    }

    fun patchTask(id: String, transform: (Task) -> Task) {
        mutateTask(id) { transform(it).copy(updatedAt = System.currentTimeMillis()) }
    }

    fun toggleTask(id: String) {
        val task = data.tasks.find { it.id == id } ?: return
        val completing = !task.completed
        var nextData = data
        if (completing && data.activeTimer?.taskId == id) {
            nextData = finalizeActive(nextData)
        }
        var spawned: Task? = null
        if (completing && task.repeat != null && task.spawnedTaskId == null) {
            spawned = repeatCopy(task)
        }
        val now = System.currentTimeMillis()
        val tasks = nextData.tasks.map {
            if (it.id == id) {
                it.copy(
                    completed = completing,
                    completedAt = if (completing) now else null,
                    updatedAt = now,
                    spawnedTaskId = spawned?.id ?: it.spawnedTaskId,
                )
            } else it
        }.toMutableList()
        if (spawned != null) tasks.add(0, spawned)
        data = nextData.copy(tasks = tasks)
        persist()
    }

    fun toggleImportant(id: String) = mutateTask(id) {
        it.copy(important = !it.important, updatedAt = System.currentTimeMillis())
    }

    fun toggleMyDay(id: String) = mutateTask(id) {
        it.copy(
            myDayDate = if (it.myDayDate == todayKey()) null else todayKey(),
            updatedAt = System.currentTimeMillis(),
        )
    }

    fun deleteTask(id: String) {
        data = data.copy(
            tasks = data.tasks.filter { it.id != id },
            entries = data.entries.filter { it.taskId != id },
            activeTimer = data.activeTimer?.takeIf { it.taskId != id },
        )
        if (selectedTaskId == id) selectedTaskId = null
        persist()
    }

    fun addStep(taskId: String, title: String) = mutateTask(taskId) {
        it.copy(
            steps = it.steps + Step(uid("step_"), title.trim(), false),
            updatedAt = System.currentTimeMillis(),
        )
    }

    fun toggleStep(taskId: String, stepId: String) = mutateTask(taskId) {
        it.copy(
            steps = it.steps.map { step -> if (step.id == stepId) step.copy(done = !step.done) else step },
            updatedAt = System.currentTimeMillis(),
        )
    }

    fun updateStep(taskId: String, stepId: String, title: String) = mutateTask(taskId) {
        it.copy(
            steps = it.steps.map { step -> if (step.id == stepId) step.copy(title = title) else step },
            updatedAt = System.currentTimeMillis(),
        )
    }

    fun deleteStep(taskId: String, stepId: String) = mutateTask(taskId) {
        it.copy(
            steps = it.steps.filter { step -> step.id != stepId },
            updatedAt = System.currentTimeMillis(),
        )
    }

    fun clearCompleted(listId: String? = null) {
        val targets = data.tasks.filter { it.completed && (listId == null || it.listId == listId) }
        val ids = targets.map { it.id }.toSet()
        data = data.copy(
            tasks = data.tasks.filter { it.id !in ids },
            entries = data.entries.filter { it.taskId == null || it.taskId !in ids },
            activeTimer = data.activeTimer?.takeIf { it.taskId !in ids },
        )
        persist()
    }

    /* --------------------------------- timer --------------------------------- */

    private fun finalizeActive(source: AppData, now: Long = System.currentTimeMillis()): AppData {
        val active = source.activeTimer ?: return source
        val task = source.tasks.find { it.id == active.taskId }
        val seconds = max(1L, ((now - active.startedAt) / 1000.0).roundToInt().toLong())
        val entry = TimeEntry(
            id = uid("entry_"),
            taskId = task?.id,
            listId = task?.listId ?: source.lists.firstOrNull()?.id ?: return source.copy(activeTimer = null),
            startedAt = active.startedAt,
            endedAt = now,
            seconds = seconds,
            note = "",
            manual = false,
        )
        return source.copy(activeTimer = null, entries = source.entries + entry)
    }

    fun startTimer(taskId: String) {
        val task = data.tasks.find { it.id == taskId } ?: return
        if (task.completed) return
        var next = if (data.activeTimer != null) finalizeActive(data) else data
        next = next.copy(activeTimer = ActiveTimer(taskId, System.currentTimeMillis()))
        data = next
        persist()
    }

    fun stopTimer() {
        if (data.activeTimer == null) return
        data = finalizeActive(data)
        persist()
    }

    fun discardTimer() {
        data = data.copy(activeTimer = null)
        persist()
    }

    fun addManualEntry(taskId: String?, listId: String, startedAt: Long, seconds: Long, note: String) {
        val entry = TimeEntry(
            id = uid("entry_"),
            taskId = taskId,
            listId = listId,
            startedAt = startedAt,
            endedAt = startedAt + seconds * 1000,
            seconds = max(1, seconds),
            note = note,
            manual = true,
        )
        data = data.copy(entries = data.entries + entry)
        persist()
    }

    fun updateEntry(id: String, seconds: Long? = null, note: String? = null,
                    startedAt: Long? = null, listId: String? = null, taskId: String? = null) {
        data = data.copy(entries = data.entries.map { entry ->
            if (entry.id != id) entry else {
                val nextStart = startedAt ?: entry.startedAt
                val nextSeconds = seconds ?: entry.seconds
                entry.copy(
                    seconds = nextSeconds,
                    note = note ?: entry.note,
                    startedAt = nextStart,
                    endedAt = nextStart + nextSeconds * 1000,
                    listId = listId ?: entry.listId,
                    taskId = taskId ?: entry.taskId,
                )
            }
        })
        persist()
    }

    fun deleteEntry(id: String) {
        data = data.copy(entries = data.entries.filter { it.id != id })
        persist()
    }

    /* -------------------------------- paydays -------------------------------- */

    fun addPayday(date: String, note: String = "", amount: Double? = null): String {
        val now = System.currentTimeMillis()
        val payday = Payday(
            id = uid("pay_"),
            date = date,
            note = note.trim().take(120),
            amount = amount?.coerceAtLeast(0.0),
            createdAt = now,
            updatedAt = now,
        )
        data = data.copy(paydays = data.paydays + payday)
        persist()
        return payday.id
    }

    fun updatePayday(id: String, date: String? = null, note: String? = null, amount: Double? = null) {
        data = data.copy(paydays = data.paydays.map { payday ->
            if (payday.id != id) payday else payday.copy(
                date = date ?: payday.date,
                note = note ?: payday.note,
                amount = amount,
                updatedAt = System.currentTimeMillis(),
            )
        })
        persist()
    }

    fun deletePayday(id: String) {
        data = data.copy(paydays = data.paydays.filter { it.id != id })
        persist()
    }

    /* -------------------------------- settings ------------------------------- */

    fun updateSettings(transform: (Settings) -> Settings) {
        data = data.copy(settings = transform(data.settings))
        persist()
    }

    fun resetSettings() {
        data = data.copy(settings = Settings())
        persist()
    }

    fun replaceData(incoming: AppData) {
        data = normalizeData(incoming.toJson())
        persist()
    }

    fun resetAllData() {
        data = createSeedData()
        view = View.Smart("myday")
        selectedTaskId = null
        search = ""
        persist()
    }

    fun markNotified(taskId: String) = mutateTask(taskId) { it.copy(notifiedAt = System.currentTimeMillis()) }

    /* ------------------------------- import/export --------------------------- */

    fun importJson(raw: String): Boolean = runCatching {
        val parsed = normalizeData(JSONObject(raw))
        data = parsed
        persist()
        true
    }.getOrDefault(false)

    fun exportJson(): String = data.toJson().toString(2)

    /* -------------------------------- pomodoro ------------------------------- */

    fun pomodoroTotalMs(): Long {
        val minutes = if (pomodoro.phase == "break") data.settings.pomodoroBreakMinutes
        else data.settings.pomodoroWorkMinutes
        return minutes * 60_000L
    }

    fun pomodoroRemaining(): Long {
        val state = pomodoro
        if (state.endsAt != null) return max(0, state.endsAt - System.currentTimeMillis())
        return max(0, state.remainingMs)
    }

    fun startPomodoro(taskId: String) {
        startTimer(taskId)
        val endsAt = System.currentTimeMillis() + data.settings.pomodoroWorkMinutes * 60_000L
        pomodoro = PomodoroState(phase = "work", endsAt = endsAt, taskId = taskId, cycle = pomodoro.cycle)
        savePomodoro()
    }

    fun startBreak() {
        val endsAt = System.currentTimeMillis() + data.settings.pomodoroBreakMinutes * 60_000L
        pomodoro = pomodoro.copy(phase = "break", endsAt = endsAt, remainingMs = 0)
        savePomodoro()
    }

    fun pausePomodoro() {
        if (pomodoro.endsAt == null) return
        if (pomodoro.phase == "work") stopTimer()
        val remaining = max(0, pomodoro.endsAt!! - System.currentTimeMillis())
        pomodoro = pomodoro.copy(remainingMs = remaining, endsAt = null)
        savePomodoro()
    }

    fun resumePomodoro() {
        val state = pomodoro
        if (state.phase == "idle" || state.remainingMs <= 0) return
        if (state.phase == "work" && state.taskId != null) {
            val task = data.tasks.find { it.id == state.taskId }
            if (task != null && !task.completed) startTimer(task.id)
        }
        pomodoro = state.copy(endsAt = System.currentTimeMillis() + state.remainingMs, remainingMs = 0)
        savePomodoro()
    }

    fun stopPomodoro() {
        if (pomodoro.phase == "work") stopTimer()
        pomodoro = PomodoroState()
        savePomodoro()
    }

    fun skipPomodoro() {
        val state = pomodoro
        if (state.phase == "work") {
            stopTimer()
            startBreak()
            return
        }
        pomodoro = PomodoroState()
        savePomodoro()
    }

    private fun startPomodoroLoop() {
        viewModelScope.launch {
            while (isActive) {
                delay(500)
                val state = pomodoro
                if (state.phase != "idle" && state.endsAt != null &&
                    System.currentTimeMillis() >= state.endsAt
                ) {
                    finishPomodoroPhase()
                }
                if (state.phase == "work" && state.endsAt != null && data.activeTimer == null) {
                    pomodoro = PomodoroState()
                    savePomodoro()
                }
            }
        }
    }

    private fun finishPomodoroPhase() {
        val state = pomodoro
        if (state.phase == "work") {
            stopTimer()
            pomodoro = state.copy(phase = "idle", endsAt = null, remainingMs = 0, cycle = state.cycle + 1)
            showToast("Pomodoro: час перерви")
            Notifications.showNow(
                getApplication(),
                "VibeDo · фокус завершено",
                "Зробіть коротку перерву — ви це заслужили.",
            )
            if (data.settings.pomodoroAutoBreak) startBreak() else savePomodoro()
        } else if (state.phase == "break") {
            pomodoro = PomodoroState()
            showToast("Перерва завершена")
            Notifications.showNow(
                getApplication(),
                "VibeDo · перерва завершена",
                "Повертайтеся до задач, коли будете готові.",
            )
            savePomodoro()
        }
    }

    private fun savePomodoro() {
        val state = pomodoro
        prefs.edit().putString(
            "pomodoro_state",
            JSONObject().apply {
                put("phase", state.phase)
                if (state.endsAt == null) put("endsAt", JSONObject.NULL) else put("endsAt", state.endsAt)
                put("remainingMs", state.remainingMs)
                if (state.taskId == null) put("taskId", JSONObject.NULL) else put("taskId", state.taskId)
                put("cycle", state.cycle)
            }.toString(),
        ).apply()
        pomodoroSavedAt = System.currentTimeMillis()
    }

    private fun restorePomodoro(json: JSONObject) {
        val phase = when (json.optString("phase")) {
            "work", "break" -> json.optString("phase")
            else -> "idle"
        }
        pomodoro = PomodoroState(
            phase = phase,
            endsAt = if (json.has("endsAt") && !json.isNull("endsAt")) json.optLong("endsAt") else null,
            remainingMs = json.optLong("remainingMs", 0),
            taskId = if (json.has("taskId") && !json.isNull("taskId")) json.optString("taskId") else null,
            cycle = json.optInt("cycle", 0),
        )
        savePomodoro()
    }

    private fun restorePomodoroFromPrefs() {
        val raw = prefs.getString("pomodoro_state", null) ?: return
        runCatching { restorePomodoro(JSONObject(raw)) }
    }

    /* ---------------------------------- sync --------------------------------- */

    fun updateSyncConfig(transform: (SyncConfig) -> SyncConfig) {
        val next = transform(syncConfig)
        syncConfig = storage.saveSync(next)
        syncToken = syncConfig.token
    }

    fun regeneratePin() {
        updateSyncConfig { it.copy(pin = com.vibedo.app.data.makePin(), token = "") }
    }

    fun syncNow(notify: Boolean = true) {
        if (syncing) return
        if (syncConfig.host.isBlank()) {
            syncPhase = "error"
            syncMessage = "Вкажіть адресу комп’ютера"
            if (notify) showToast("Вкажіть адресу комп’ютера")
            return
        }
        syncing = true
        syncPhase = "syncing"
        syncMessage = "Синхронізація…"
        viewModelScope.launch {
            val config = syncConfig
            val local = data
            val outcome = withContext(Dispatchers.IO) { syncClient.sync(config, local) }
            if (outcome.ok && outcome.data != null) {
                data = outcome.data
                val now = outcome.lastSyncAt ?: System.currentTimeMillis()
                val token = outcome.token ?: syncToken
                syncConfig = storage.saveSync(
                    syncConfig.copy(enabled = true, token = token, lastSyncAt = now),
                )
                syncToken = syncConfig.token
                syncPhase = "ok"
                syncMessage = "Синхронізовано"
                if (notify) showToast("Синхронізовано")
                persist()
            } else {
                syncPhase = if (outcome.offline) "offline" else "error"
                syncMessage = outcome.message
                if (notify) showToast(outcome.message)
            }
            syncing = false
        }
    }

    fun testConnection(onResult: (Boolean, String) -> Unit) {
        val config = syncConfig
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) { syncClient.health(config.host, config.port) }
            if (result.ok) {
                onResult(true, "${result.name} ${result.version} у мережі")
            } else {
                onResult(false, result.error.ifBlank { "Комп’ютер не відповідає" })
            }
        }
    }

    private fun startAutoSync() {
        autoSyncJob?.cancel()
        autoSyncJob = viewModelScope.launch {
            delay(2500)
            while (isActive) {
                val config = syncConfig
                if (config.enabled && config.auto && config.host.isNotBlank() && !syncing) {
                    syncNow(notify = false)
                }
                delay(60_000)
            }
        }
    }

    /* ------------------------------ notifications ---------------------------- */

    fun notifications() = collectNotifications(data)

    fun applyIncomingSync(raw: AppData) {
        data = mergeAppData(data, raw)
        persist()
    }

    fun appVersion(): String = "1.0.2"

    fun dataFolderPath(): String = getApplication<Application>().filesDir.absolutePath

    fun shareFile(file: File): Boolean = file.exists()
}
