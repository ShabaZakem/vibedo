package com.vibedo.app.data

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/* ------------------------------ serialization ------------------------------ */

private fun JSONObject.optStringOrNull(key: String): String? {
    if (!has(key) || isNull(key)) return null
    return optString(key)
}

private fun JSONObject.optLongOrNull(key: String): Long? {
    if (!has(key) || isNull(key)) return null
    return optLong(key)
}

private fun JSONObject.optDoubleOrNull(key: String): Double? {
    if (!has(key) || isNull(key)) return null
    val value = optDouble(key, Double.NaN)
    return if (value.isFinite()) value else null
}

private fun JSONObject.stringList(key: String): List<String> {
    val array = optJSONArray(key) ?: return emptyList()
    val result = mutableListOf<String>()
    for (index in 0 until array.length()) {
        val value = array.optString(index, "")
        if (value.isNotEmpty()) result.add(value)
    }
    return result
}

fun AppData.toJson(): JSONObject {
    val root = JSONObject()
    root.put("schemaVersion", SCHEMA_VERSION)
    root.put("createdAt", createdAt)
    root.put("updatedAt", updatedAt)

    val settingsJson = JSONObject().apply {
        put("currency", settings.currency)
        put("hourlyRate", settings.hourlyRate)
        put("taxPercent", settings.taxPercent)
        put("overtimeMultiplier", settings.overtimeMultiplier)
        put("dailyNormHours", settings.dailyNormHours)
        put("weeklyNormHours", settings.weeklyNormHours)
        put("overtimeEnabled", settings.overtimeEnabled)
        put("theme", settings.theme)
        put("accent", settings.accent)
        put("notifications", settings.notifications)
        put("compactMode", settings.compactMode)
        put("firstName", settings.firstName)
        put("pomodoroWorkMinutes", settings.pomodoroWorkMinutes)
        put("pomodoroBreakMinutes", settings.pomodoroBreakMinutes)
        put("pomodoroAutoBreak", settings.pomodoroAutoBreak)
        put("paydayReminderDays", settings.paydayReminderDays)
    }
    root.put("settings", settingsJson)

    val listsJson = JSONArray()
    for (list in lists) {
        listsJson.put(JSONObject().apply {
            put("id", list.id)
            put("name", list.name)
            put("color", list.color)
            if (list.hourlyRate == null) put("hourlyRate", JSONObject.NULL) else put("hourlyRate", list.hourlyRate)
            put("createdAt", list.createdAt)
            put("updatedAt", list.updatedAt)
            put("order", list.order)
        })
    }
    root.put("lists", listsJson)

    val tasksJson = JSONArray()
    for (task in tasks) {
        val stepsJson = JSONArray()
        for (step in task.steps) {
            stepsJson.put(JSONObject().apply {
                put("id", step.id)
                put("title", step.title)
                put("done", step.done)
            })
        }
        val tagsJson = JSONArray()
        for (tag in task.tags) tagsJson.put(tag)
        tasksJson.put(JSONObject().apply {
            put("id", task.id)
            put("listId", task.listId)
            put("title", task.title)
            put("notes", task.notes)
            put("completed", task.completed)
            if (task.completedAt == null) put("completedAt", JSONObject.NULL) else put("completedAt", task.completedAt)
            put("important", task.important)
            if (task.myDayDate == null) put("myDayDate", JSONObject.NULL) else put("myDayDate", task.myDayDate)
            if (task.dueDate == null) put("dueDate", JSONObject.NULL) else put("dueDate", task.dueDate)
            if (task.dueTime == null) put("dueTime", JSONObject.NULL) else put("dueTime", task.dueTime)
            if (task.reminderAt == null) put("reminderAt", JSONObject.NULL) else put("reminderAt", task.reminderAt)
            if (task.notifiedAt == null) put("notifiedAt", JSONObject.NULL) else put("notifiedAt", task.notifiedAt)
            put("createdAt", task.createdAt)
            put("updatedAt", task.updatedAt)
            put("steps", stepsJson)
            if (task.estimateMinutes == null) put("estimateMinutes", JSONObject.NULL) else put("estimateMinutes", task.estimateMinutes)
            put("tags", tagsJson)
            if (task.repeat == null) put("repeat", JSONObject.NULL) else put("repeat", JSONObject().apply {
                put("freq", task.repeat.freq)
                put("interval", task.repeat.interval)
            })
            if (task.spawnedTaskId == null) put("spawnedTaskId", JSONObject.NULL) else put("spawnedTaskId", task.spawnedTaskId)
        })
    }
    root.put("tasks", tasksJson)

    val entriesJson = JSONArray()
    for (entry in entries) {
        entriesJson.put(JSONObject().apply {
            put("id", entry.id)
            if (entry.taskId == null) put("taskId", JSONObject.NULL) else put("taskId", entry.taskId)
            put("listId", entry.listId)
            put("startedAt", entry.startedAt)
            put("endedAt", entry.endedAt)
            put("seconds", entry.seconds)
            put("note", entry.note)
            put("manual", entry.manual)
        })
    }
    root.put("entries", entriesJson)

    val paydaysJson = JSONArray()
    for (payday in paydays) {
        paydaysJson.put(JSONObject().apply {
            put("id", payday.id)
            put("date", payday.date)
            put("note", payday.note)
            if (payday.amount == null) put("amount", JSONObject.NULL) else put("amount", payday.amount)
            put("createdAt", payday.createdAt)
            put("updatedAt", payday.updatedAt)
        })
    }
    root.put("paydays", paydaysJson)

    val timer = activeTimer
    if (timer == null) {
        root.put("activeTimer", JSONObject.NULL)
    } else {
        root.put("activeTimer", JSONObject().apply {
            put("taskId", timer.taskId)
            put("startedAt", timer.startedAt)
        })
    }
    return root
}

/* ------------------------------- normalization ----------------------------- */

private fun asNumber(value: Double?, fallback: Double): Double =
    if (value != null && value.isFinite()) value else fallback

fun normalizeTags(values: List<String>): List<String> {
    val seen = mutableSetOf<String>()
    val tags = mutableListOf<String>()
    for (item in values) {
        val tag = item.trim().take(30)
        if (tag.isEmpty()) continue
        val key = tag.lowercase()
        if (!seen.add(key)) continue
        tags.add(tag)
        if (tags.size >= 12) break
    }
    return tags
}

fun normalizeRepeat(freq: String?, interval: Int?): RepeatRule? {
    val allowed = setOf("daily", "weekdays", "weekly", "monthly", "yearly")
    if (freq == null || freq !in allowed) return null
    return RepeatRule(freq, max(1, min(365, interval ?: 1)))
}

fun normalizeData(raw: JSONObject?): AppData {
    if (raw == null) return createSeedData()
    if (!raw.has("lists") || !raw.has("tasks")) return createSeedData()

    val inputLists = raw.optJSONArray("lists") ?: return createSeedData()
    val inputTasks = raw.optJSONArray("tasks") ?: return createSeedData()

    val defaultSettings = Settings()
    val settingsRaw = raw.optJSONObject("settings") ?: JSONObject()
    val settings = defaultSettings.copy(
        currency = (settingsRaw.optString("currency", defaultSettings.currency).trim().take(6))
            .ifBlank { defaultSettings.currency },
        hourlyRate = max(0.0, asNumber(settingsRaw.optDoubleOrNull("hourlyRate"), defaultSettings.hourlyRate)),
        taxPercent = max(0.0, min(100.0, asNumber(settingsRaw.optDoubleOrNull("taxPercent"), 19.5))),
        overtimeMultiplier = max(1.0, asNumber(settingsRaw.optDoubleOrNull("overtimeMultiplier"), 1.5)),
        dailyNormHours = max(0.0, asNumber(settingsRaw.optDoubleOrNull("dailyNormHours"), 8.0)),
        weeklyNormHours = max(0.0, asNumber(settingsRaw.optDoubleOrNull("weeklyNormHours"), 40.0)),
        overtimeEnabled = settingsRaw.optBoolean("overtimeEnabled", defaultSettings.overtimeEnabled),
        theme = settingsRaw.optString("theme", defaultSettings.theme)
            .takeIf { it in setOf("light", "dark", "system") } ?: "system",
        accent = settingsRaw.optString("accent", defaultSettings.accent)
            .takeIf { Regex("^#[0-9a-fA-F]{6}$").matches(it) } ?: defaultSettings.accent,
        notifications = settingsRaw.optBoolean("notifications", defaultSettings.notifications),
        compactMode = settingsRaw.optBoolean("compactMode", defaultSettings.compactMode),
        firstName = settingsRaw.optString("firstName", "").take(40),
        pomodoroWorkMinutes = max(1, min(180, settingsRaw.optInt("pomodoroWorkMinutes", 25))),
        pomodoroBreakMinutes = max(1, min(60, settingsRaw.optInt("pomodoroBreakMinutes", 5))),
        pomodoroAutoBreak = settingsRaw.has("pomodoroAutoBreak").let {
            if (it) settingsRaw.optBoolean("pomodoroAutoBreak", true) else true
        },
        paydayReminderDays = max(0, min(30, settingsRaw.optInt("paydayReminderDays", 3))),
    )

    val palette = LIST_COLORS
    val lists = mutableListOf<TaskList>()
    for (index in 0 until inputLists.length()) {
        val item = inputLists.optJSONObject(index) ?: continue
        val id = item.optString("id", "")
        if (id.isBlank()) continue
        val color = item.optString("color", "")
            .takeIf { Regex("^#[0-9a-fA-F]{6}$").matches(it) } ?: palette[index % palette.size]
        lists.add(
            TaskList(
                id = id,
                name = item.optString("name", "Новий список").take(80).ifBlank { "Новий список" },
                color = color,
                hourlyRate = item.optDoubleOrNull("hourlyRate")?.let { max(0.0, it) },
                createdAt = item.optLong("createdAt", System.currentTimeMillis()),
                updatedAt = item.optLong("updatedAt", item.optLong("createdAt", System.currentTimeMillis())),
                order = item.optInt("order", index),
            ),
        )
    }
    if (lists.isEmpty()) {
        val now = System.currentTimeMillis()
        lists.add(TaskList(uid("list_"), "Мої задачі", palette[0], null, now, now, 0))
    }
    val fallbackList = lists.first().id
    val listIds = lists.map { it.id }.toSet()

    val tasks = mutableListOf<Task>()
    for (index in 0 until inputTasks.length()) {
        val item = inputTasks.optJSONObject(index) ?: continue
        val id = item.optString("id", "")
        if (id.isBlank()) continue
        val steps = mutableListOf<Step>()
        item.optJSONArray("steps")?.let { array ->
            for (stepIndex in 0 until array.length()) {
                val step = array.optJSONObject(stepIndex) ?: continue
                steps.add(
                    Step(
                        id = step.optString("id", "").ifBlank { uid("step_") },
                        title = step.optString("title", ""),
                        done = step.optBoolean("done", false),
                    ),
                )
            }
        }
        val repeatRaw = item.optJSONObject("repeat")
        tasks.add(
            Task(
                id = id,
                listId = item.optString("listId", "").takeIf { it in listIds } ?: fallbackList,
                title = item.optString("title", "Без назви").take(500).ifBlank { "Без назви" },
                notes = item.optString("notes", "").take(20_000),
                completed = item.optBoolean("completed", false),
                completedAt = if (item.optBoolean("completed", false)) item.optLongOrNull("completedAt") else null,
                important = item.optBoolean("important", false),
                myDayDate = item.optStringOrNull("myDayDate"),
                dueDate = item.optStringOrNull("dueDate")?.take(10),
                dueTime = item.optStringOrNull("dueTime")?.take(5),
                reminderAt = item.optLongOrNull("reminderAt")?.takeIf { it > 0 },
                notifiedAt = item.optLongOrNull("notifiedAt")?.takeIf { it > 0 },
                createdAt = item.optLong("createdAt", System.currentTimeMillis()),
                updatedAt = item.optLong("updatedAt", System.currentTimeMillis()),
                steps = steps,
                estimateMinutes = item.optDoubleOrNull("estimateMinutes")?.let { max(0, it.roundToInt()) },
                tags = normalizeTags(item.stringList("tags")),
                repeat = normalizeRepeat(repeatRaw?.optString("freq"), repeatRaw?.optInt("interval", 1)),
                spawnedTaskId = item.optStringOrNull("spawnedTaskId")?.takeIf { it.isNotBlank() },
            ),
        )
    }
    val taskIds = tasks.map { it.id }.toSet()

    val entries = mutableListOf<TimeEntry>()
    raw.optJSONArray("entries")?.let { array ->
        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: continue
            val id = item.optString("id", "")
            if (id.isBlank()) continue
            val taskId = item.optStringOrNull("taskId")?.takeIf { it in taskIds }
            entries.add(
                TimeEntry(
                    id = id,
                    taskId = taskId,
                    listId = item.optString("listId", "").takeIf { it in listIds } ?: fallbackList,
                    startedAt = item.optLong("startedAt", System.currentTimeMillis()),
                    endedAt = item.optLong("endedAt", System.currentTimeMillis()),
                    seconds = max(0, item.optLong("seconds", 0)),
                    note = item.optString("note", ""),
                    manual = item.optBoolean("manual", false),
                ),
            )
        }
    }

    val paydays = mutableListOf<Payday>()
    raw.optJSONArray("paydays")?.let { array ->
        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: continue
            val id = item.optString("id", "")
            if (id.isBlank()) continue
            val date = item.optString("date", "")
            paydays.add(
                Payday(
                    id = id,
                    date = if (Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(date)) date else todayKey(),
                    note = item.optString("note", "").take(120),
                    amount = item.optDoubleOrNull("amount")?.let { max(0.0, it) },
                    createdAt = item.optLong("createdAt", System.currentTimeMillis()),
                    updatedAt = item.optLong("updatedAt", System.currentTimeMillis()),
                ),
            )
        }
    }

    val timerRaw = raw.optJSONObject("activeTimer")
    val activeTimer = timerRaw?.optString("taskId")?.takeIf { it in taskIds }?.let {
        ActiveTimer(it, timerRaw.optLong("startedAt", System.currentTimeMillis()))
    }

    return AppData(
        schemaVersion = SCHEMA_VERSION,
        settings = settings,
        lists = lists,
        tasks = tasks,
        entries = entries,
        paydays = paydays,
        activeTimer = activeTimer,
        createdAt = raw.optLong("createdAt", System.currentTimeMillis()),
        updatedAt = raw.optLong("updatedAt", System.currentTimeMillis()),
    )
}

fun snapshot(data: AppData): AppData = data.copy(schemaVersion = SCHEMA_VERSION, updatedAt = System.currentTimeMillis())

/* ---------------------------------- seed ---------------------------------- */

fun createSeedData(): AppData {
    val now = System.currentTimeMillis()
    val palette = LIST_COLORS
    val work = TaskList(uid("list_"), "Робота", palette[0], null, now, now, 0)
    val personal = TaskList(uid("list_"), "Особисте", palette[1], 0.0, now, now, 1)
    val today = todayKey()

    val welcome = Task(
        id = uid("task_"),
        listId = personal.id,
        title = "Ласкаво просимо до VibeDo",
        notes = "Це ваш локальний простір для задач, часу та зарплати. Усе зберігається лише на цьому пристрої.\n\n" +
            "Спробуйте можливості:\n" +
            "• додайте задачу з датою просто у полі вводу — «завтра 18:00 #робота»;\n" +
            "• позначте зарплатний день у календарі;\n" +
            "• запустіть Pomodoro-фокус у трекері часу.",
        completed = false,
        important = true,
        myDayDate = today,
        createdAt = now,
        updatedAt = now,
        steps = listOf(
            Step(uid("step_"), "Додати першу задачу"),
            Step(uid("step_"), "Запустити таймер на задачі"),
            Step(uid("step_"), "Переглянути статистику"),
        ),
        tags = listOf("початок"),
    )
    val plan = Task(
        id = uid("task_"),
        listId = work.id,
        title = "Підготувати план на тиждень",
        notes = "Оглянути календар і визначити три головні пріоритети.",
        important = true,
        myDayDate = today,
        dueDate = today,
        dueTime = "18:00",
        createdAt = now,
        updatedAt = now,
        estimateMinutes = 30,
        tags = listOf("план", "робота"),
    )
    val rate = Task(
        id = uid("task_"),
        listId = work.id,
        title = "Перевірити ставку та податки",
        notes = "У налаштуваннях можна змінити погодинну ставку, податок і понаднормові. Для кожного списку можна задати окрему ставку.",
        dueDate = addDaysKey(today, 1),
        createdAt = now,
        updatedAt = now,
        estimateMinutes = 10,
        tags = listOf("гроші"),
    )
    val review = Task(
        id = uid("task_"),
        listId = work.id,
        title = "Щотижневий огляд задач",
        notes = "Прибрати виконане, оновити пріоритети та спланувати наступний тиждень.",
        dueDate = addDaysKey(today, 3),
        dueTime = "17:00",
        createdAt = now,
        updatedAt = now,
        repeat = RepeatRule("weekly", 1),
        tags = listOf("огляд"),
    )

    val nowDate = LocalDate.now()
    var payDate = nowDate.withDayOfMonth(5)
    if (dateKey(payDate) < today) payDate = nowDate.plusMonths(1).withDayOfMonth(5)
    val payday = Payday(uid("pay_"), dateKey(payDate), "Зарплата", null, now, now)

    return AppData(
        schemaVersion = SCHEMA_VERSION,
        settings = Settings(),
        lists = listOf(work, personal),
        tasks = listOf(welcome, plan, rate, review),
        entries = emptyList(),
        paydays = listOf(payday),
        activeTimer = null,
        createdAt = now,
        updatedAt = now,
    )
}

/* ---------------------------------- merge --------------------------------- */

/**
 * Merges two local-first snapshots. Records are reconciled by id and updatedAt,
 * time entries are united by id. Deletions are not propagated (no tombstones),
 * mirrors the desktop behaviour.
 */
fun mergeAppData(localRaw: AppData, remoteRaw: AppData): AppData {
    val local = normalizeData(localRaw.toJson())
    val remote = normalizeData(remoteRaw.toJson())

    fun <T> merge(left: List<T>, right: List<T>, id: (T) -> String, updated: (T) -> Long): List<T> {
        val map = LinkedHashMap<String, T>()
        for (item in left) map[id(item)] = item
        for (item in right) {
            val existing = map[id(item)]
            map[id(item)] = if (existing == null) item else {
                if (updated(item) > updated(existing)) item else existing
            }
        }
        return map.values.toList()
    }

    val lists = merge(local.lists, remote.lists, { it.id }, { it.updatedAt })
    val tasks = merge(local.tasks, remote.tasks, { it.id }, { it.updatedAt })
    val entries = merge(local.entries, remote.entries, { it.id }, { 0L })
    val paydays = merge(local.paydays, remote.paydays, { it.id }, { it.updatedAt })

    val settings = if (remote.updatedAt > local.updatedAt) remote.settings else local.settings
    val activeTimer = when {
        local.activeTimer == null -> remote.activeTimer
        remote.activeTimer == null -> local.activeTimer
        remote.activeTimer.startedAt > local.activeTimer.startedAt -> remote.activeTimer
        else -> local.activeTimer
    }

    return AppData(
        schemaVersion = SCHEMA_VERSION,
        settings = settings,
        lists = lists,
        tasks = tasks,
        entries = entries,
        paydays = paydays,
        activeTimer = activeTimer,
        createdAt = min(local.createdAt, remote.createdAt),
        updatedAt = max(local.updatedAt, remote.updatedAt),
    )
}
