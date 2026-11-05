package com.vibedo.app.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Flag
import androidx.compose.material.icons.rounded.Label
import androidx.compose.material.icons.rounded.List
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.StarBorder
import androidx.compose.material.icons.rounded.Stop
import androidx.compose.material.icons.rounded.Today
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vibedo.app.AppViewModel
import com.vibedo.app.data.RepeatRule
import com.vibedo.app.data.Task
import com.vibedo.app.data.combineDateTime
import com.vibedo.app.data.formatClock
import com.vibedo.app.data.formatDateInput
import com.vibedo.app.data.formatDayLabel
import com.vibedo.app.data.formatDueLabel
import com.vibedo.app.data.formatTimeInput
import com.vibedo.app.data.keyToDate
import com.vibedo.app.data.repeatLabel
import com.vibedo.app.data.tagColor
import com.vibedo.app.data.todayKey
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

private data class RepeatOption(val label: String, val rule: RepeatRule?)

private val REPEAT_OPTIONS = listOf(
    RepeatOption("Не повторювати", null),
    RepeatOption("Щодня", RepeatRule("daily", 1)),
    RepeatOption("По буднях", RepeatRule("weekdays", 1)),
    RepeatOption("Щотижня", RepeatRule("weekly", 1)),
    RepeatOption("Кожні 2 тижні", RepeatRule("weekly", 2)),
    RepeatOption("Щомісяця", RepeatRule("monthly", 1)),
    RepeatOption("Щороку", RepeatRule("yearly", 1)),
)

@Composable
fun TaskDetailSheet(
    vm: AppViewModel,
    taskId: String,
    onClose: () -> Unit,
) {
    val p = LocalVibe.current
    val accent = vm.data.settings.accent.toComposeColor()
    val context = LocalContext.current
    val task = vm.data.tasks.find { it.id == taskId }
    if (task == null) {
        LaunchedEffect(Unit) { onClose() }
        return
    }

    var title by remember(task.id) { mutableStateOf(task.title) }
    var notes by remember(task.id) { mutableStateOf(task.notes) }
    var showDelete by remember { mutableStateOf(false) }
    var showEstimate by remember { mutableStateOf(false) }
    var showRepeat by remember { mutableStateOf(false) }
    var showLists by remember { mutableStateOf(false) }
    var stepDraft by remember { mutableStateOf("") }
    var tagDraft by remember { mutableStateOf("") }

    fun commitText() {
        val nextTitle = title.trim().ifBlank { task.title }
        if (nextTitle != task.title || notes != task.notes) {
            vm.patchTask(task.id) { it.copy(title = nextTitle, notes = notes) }
        }
    }

    DisposableEffect(task.id) {
        onDispose { commitText() }
    }

    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(task.id, vm.data.activeTimer, vm.pomodoro.phase) {
        while (true) {
            now = System.currentTimeMillis()
            delay(1000)
        }
    }

    val list = vm.data.lists.find { it.id == task.listId }
    val active = vm.data.activeTimer?.taskId == task.id
    val elapsed = if (active) ((now - (vm.data.activeTimer?.startedAt ?: now)) / 1000).coerceAtLeast(0) else 0
    val pomodoroRunning = vm.pomodoro.taskId == task.id && vm.pomodoro.phase != "idle"
    val pomodoroRemaining = if (pomodoroRunning) vm.pomodoroRemaining() else 0

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(p.bg)
            .verticalScroll(rememberScrollState())
            .padding(bottom = 40.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            VibeIconButton(Icons.Rounded.ArrowBack, "Назад", onClose, size = 38.dp, iconSize = 20.dp)
            Spacer(Modifier.weight(1f))
            VibeIconButton(
                if (task.important) Icons.Rounded.Star else Icons.Rounded.StarBorder,
                "Важливо",
                { vm.toggleImportant(task.id) },
                tint = if (task.important) p.warning else p.text3,
                size = 38.dp, iconSize = 19.dp,
            )
            VibeIconButton(Icons.Rounded.Today, "Мій день", { vm.toggleMyDay(task.id) },
                tint = if (task.myDayDate == todayKey()) accent else p.text3,
                size = 38.dp, iconSize = 19.dp)
            VibeIconButton(Icons.Rounded.Delete, "Видалити", { showDelete = true },
                tint = p.danger, size = 38.dp, iconSize = 19.dp)
        }

        Column(Modifier.padding(horizontal = 20.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                RoundCheck(task.completed, { vm.toggleTask(task.id) }, accent, size = 23.dp)
                Spacer(Modifier.width(8.dp))
                androidx.compose.foundation.text.BasicTextField(
                    value = title,
                    onValueChange = {
                        title = it
                        if (it.trim().isNotEmpty()) {
                            vm.patchTask(task.id) { current -> current.copy(title = it.take(500)) }
                        }
                    },
                    textStyle = androidx.compose.material3.MaterialTheme.typography.headlineSmall.copy(
                        color = if (task.completed) p.text3 else p.text,
                        textDecoration = if (task.completed) TextDecoration.LineThrough else TextDecoration.None,
                    ),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { commitText() }),
                    modifier = Modifier
                        .weight(1f)
                        .padding(top = 2.dp),
                )
            }

            Spacer(Modifier.height(16.dp))
            DetailSection("ВЛАСТИВОСТІ") {
                DetailRow(Icons.Rounded.List, "Список", list?.name ?: "Без списку", list?.color?.toComposeColor() ?: p.text3) {
                    showLists = true
                }
                DetailRow(
                    Icons.Rounded.CalendarMonth,
                    "Дата",
                    task.dueDate?.let { formatDayLabel(it) } ?: "Не вказано",
                    accent,
                    onClear = if (task.dueDate != null) {
                        { vm.patchTask(task.id) { it.copy(dueDate = null, dueTime = null) } }
                    } else null,
                ) {
                    val initial = task.dueDate?.let { keyToDate(it) } ?: LocalDate.now()
                    DatePickerDialog(
                        context,
                        { _, year, month, day ->
                            val key = LocalDate.of(year, month + 1, day).toString()
                            vm.patchTask(task.id) { it.copy(dueDate = key) }
                        },
                        initial.year, initial.monthValue - 1, initial.dayOfMonth,
                    ).show()
                }
                DetailRow(
                    Icons.Rounded.Schedule,
                    "Час",
                    task.dueTime ?: "Не вказано",
                    accent,
                    onClear = if (task.dueTime != null) {
                        { vm.patchTask(task.id) { it.copy(dueTime = null) } }
                    } else null,
                ) {
                    val time = runCatching {
                        LocalTime.parse(task.dueTime ?: "18:00")
                    }.getOrDefault(LocalTime.of(18, 0))
                    TimePickerDialog(context, { _, hour, minute ->
                        vm.patchTask(task.id) {
                            it.copy(
                                dueTime = "%02d:%02d".format(hour, minute),
                                dueDate = it.dueDate ?: todayKey(),
                            )
                        }
                    }, time.hour, time.minute, true).show()
                }
                DetailRow(
                    Icons.Rounded.NotificationsActive,
                    "Нагадування",
                    task.reminderAt?.let { "${formatDateInput(it)} · ${formatTimeInput(it)}" } ?: "Вимкнено",
                    p.warning,
                    onClear = if (task.reminderAt != null) {
                        { vm.patchTask(task.id) { it.copy(reminderAt = null, notifiedAt = null) } }
                    } else null,
                ) {
                    val initial = task.reminderAt
                        ?.let { java.time.Instant.ofEpochMilli(it).atZone(java.time.ZoneId.systemDefault()).toLocalDate() }
                        ?: LocalDate.now()
                    DatePickerDialog(context, { _, year, month, day ->
                        val date = LocalDate.of(year, month + 1, day)
                        TimePickerDialog(context, { _, hour, minute ->
                            vm.patchTask(task.id) {
                                it.copy(
                                    reminderAt = combineDateTime(date.toString(), "%02d:%02d".format(hour, minute)),
                                    notifiedAt = null,
                                )
                            }
                        }, 9, 0, true).show()
                    }, initial.year, initial.monthValue - 1, initial.dayOfMonth).show()
                }
                DetailRow(
                    Icons.Rounded.Schedule,
                    "Оцінка",
                    task.estimateMinutes?.let { "$it хв" } ?: "Не вказано",
                    p.text2,
                    onClear = if (task.estimateMinutes != null) {
                        { vm.patchTask(task.id) { it.copy(estimateMinutes = null) } }
                    } else null,
                ) {
                    showEstimate = true
                }
                DetailRow(
                    Icons.Rounded.Repeat,
                    "Повтор",
                    task.repeat?.let { repeatLabel(it) } ?: "Не повторюється",
                    p.text2,
                    onClear = if (task.repeat != null) {
                        { vm.patchTask(task.id) { it.copy(repeat = null) } }
                    } else null,
                ) {
                    showRepeat = true
                }
            }

            Spacer(Modifier.height(18.dp))
            DetailSection("НОТАТКИ") {
                VibeTextField(
                    value = notes,
                    onValueChange = {
                        notes = it.take(20_000)
                        vm.patchTask(task.id) { current -> current.copy(notes = notes) }
                    },
                    placeholder = "Додайте деталі, посилання або план…",
                    singleLine = false,
                    minLines = 4,
                    modifier = Modifier.fillMaxWidth(),
                    accent = accent,
                )
            }

            Spacer(Modifier.height(18.dp))
            DetailSection("ТЕГИ") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    task.tags.forEach { tag ->
                        Chip("#$tag", tagColor(tag).toComposeColor(), onRemove = {
                            vm.patchTask(task.id) { current ->
                                current.copy(tags = current.tags.filter { it != tag })
                            }
                        })
                    }
                    if (task.tags.isEmpty()) {
                        Text("Немає тегів", color = p.text3, fontSize = 12.sp)
                    }
                }
                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    VibeTextField(
                        value = tagDraft,
                        onValueChange = { tagDraft = it.take(30) },
                        placeholder = "Новий тег…",
                        modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = {
                            if (tagDraft.isNotBlank()) {
                                val value = tagDraft.trim()
                                vm.patchTask(task.id) { current ->
                                    current.copy(tags = (current.tags + value).distinctBy { it.lowercase() }.take(12))
                                }
                                tagDraft = ""
                            }
                        }),
                        accent = accent,
                    )
                    VDButton("Додати", {
                        if (tagDraft.isNotBlank()) {
                            val value = tagDraft.trim()
                            vm.patchTask(task.id) { current ->
                                current.copy(tags = (current.tags + value).distinctBy { it.lowercase() }.take(12))
                            }
                            tagDraft = ""
                        }
                    }, accent = accent)
                }
            }

            Spacer(Modifier.height(18.dp))
            DetailSection("КРОКИ") {
                task.steps.forEach { step ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RoundCheck(step.done, { vm.toggleStep(task.id, step.id) }, accent, size = 17.dp)
                        Spacer(Modifier.width(6.dp))
                        Text(
                            step.title,
                            color = if (step.done) p.text3 else p.text,
                            fontSize = 13.5.sp,
                            textDecoration = if (step.done) TextDecoration.LineThrough else TextDecoration.None,
                            modifier = Modifier.weight(1f),
                        )
                        VibeIconButton(Icons.Rounded.Close, "Видалити крок",
                            { vm.deleteStep(task.id, step.id) }, size = 26.dp, iconSize = 13.dp)
                    }
                }
                Spacer(Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    VibeTextField(
                        value = stepDraft,
                        onValueChange = { stepDraft = it },
                        placeholder = "Новий крок…",
                        modifier = Modifier.weight(1f),
                        accent = accent,
                    )
                    VDButton("Додати", {
                        if (stepDraft.isNotBlank()) {
                            vm.addStep(task.id, stepDraft)
                            stepDraft = ""
                        }
                    }, accent = accent, enabled = stepDraft.isNotBlank())
                }
            }

            Spacer(Modifier.height(18.dp))
            DetailSection("ЧАС") {
                VibeCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(if (active) p.successSoft else p.surface2),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                if (active) Icons.Rounded.Stop else Icons.Rounded.PlayArrow,
                                null,
                                tint = if (active) p.success else p.text2,
                                modifier = Modifier.size(17.dp),
                            )
                        }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                if (active) formatClock(elapsed) else "Таймер не запущено",
                                color = if (active) p.success else p.text,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                if (active) "Натисніть, щоб зупинити" else "Запустіть облік часу на цій задачі",
                                color = p.text3, fontSize = 11.sp,
                            )
                        }
                        VDButton(
                            if (active) "Стоп" else "Старт",
                            { if (active) vm.stopTimer() else vm.startTimer(task.id) },
                            accent = if (active) p.danger else accent,
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    DividerLine()
                    Spacer(Modifier.height(10.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Schedule, null, tint = p.text2, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                if (pomodoroRunning) formatClock((pomodoroRemaining / 1000).coerceAtLeast(0))
                                else "Pomodoro ${vm.data.settings.pomodoroWorkMinutes} хв",
                                color = if (pomodoroRunning) accent else p.text,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                            )
                            Text(
                                when {
                                    pomodoroRunning && vm.pomodoro.phase == "break" -> "Перерва"
                                    pomodoroRunning -> "Фокус"
                                    else -> "Фокус без відволікань"
                                },
                                color = p.text3, fontSize = 11.sp,
                            )
                        }
                        if (pomodoroRunning) {
                            VibeIconButton(
                                if (vm.pomodoro.endsAt == null) Icons.Rounded.PlayArrow else Icons.Rounded.Pause,
                                "Пауза",
                                { if (vm.pomodoro.endsAt == null) vm.resumePomodoro() else vm.pausePomodoro() },
                            )
                            VibeIconButton(Icons.Rounded.Stop, "Зупинити", { vm.stopPomodoro() }, tint = p.danger)
                        } else {
                            VDButton("Pomodoro", { vm.startPomodoro(task.id) }, accent = accent, filled = false)
                        }
                    }
                }
            }

            if (task.completed) {
                Spacer(Modifier.height(18.dp))
                Text(
                    "Задача виконана${task.completedAt?.let { " · ${formatDateInput(it)}" } ?: ""}",
                    color = p.success,
                    fontSize = 12.sp,
                )
            }

            Spacer(Modifier.height(22.dp))
            VDButton("Видалити задачу", { showDelete = true }, accent = p.danger, filled = false,
                icon = Icons.Rounded.Delete, modifier = Modifier.fillMaxWidth())
        }
    }

    if (showDelete) {
        ConfirmDialog(
            open = true,
            title = "Видалити задачу?",
            body = "«${task.title}» буде видалено разом із записами часу. Цю дію не можна скасувати.",
            confirmLabel = "Видалити",
            onConfirm = {
                showDelete = false
                vm.deleteTask(task.id)
                vm.showToast("Задачу видалено")
                onClose()
            },
            onDismiss = { showDelete = false },
        )
    }

    if (showEstimate) {
        VibeDialog(onDismiss = { showEstimate = false }, title = "Оцінка часу") {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf(5, 10, 15, 30, 45, 60, 90, 120).chunked(4).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                        row.forEach { minutes ->
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(7.dp))
                                    .background(p.surface2)
                                    .clickable {
                                        vm.patchTask(task.id) { it.copy(estimateMinutes = minutes) }
                                        showEstimate = false
                                    }
                                    .padding(vertical = 9.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("$minutes хв", color = p.text, fontSize = 12.5.sp)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showRepeat) {
        VibeDialog(onDismiss = { showRepeat = false }, title = "Повторення") {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                REPEAT_OPTIONS.forEach { option ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(7.dp))
                            .background(
                                if (task.repeat?.freq == option.rule?.freq && task.repeat?.interval == option.rule?.interval)
                                    p.surface2 else Color.Transparent,
                            )
                            .clickable {
                                vm.patchTask(task.id) { it.copy(repeat = option.rule) }
                                showRepeat = false
                            }
                            .padding(horizontal = 10.dp, vertical = 10.dp),
                    ) {
                        Text(option.label, color = p.text, fontSize = 13.5.sp)
                    }
                }
            }
        }
    }

    if (showLists) {
        VibeDialog(onDismiss = { showLists = false }, title = "Перемістити до списку") {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                vm.data.lists.forEach { item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(7.dp))
                            .background(if (item.id == task.listId) p.surface2 else Color.Transparent)
                            .clickable {
                                vm.patchTask(task.id) { it.copy(listId = item.id) }
                                showLists = false
                            }
                            .padding(horizontal = 10.dp, vertical = 11.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier.size(8.dp).clip(CircleShape)
                                .background(item.color.toComposeColor()),
                        )
                        Spacer(Modifier.width(9.dp))
                        Text(item.name, color = p.text, fontSize = 13.5.sp, modifier = Modifier.weight(1f))
                        if (item.id == task.listId) {
                            Icon(Icons.Rounded.CheckCircle, null, tint = accent, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailSection(title: String, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        Text(
            title,
            color = LocalVibe.current.text3,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.6.sp,
            modifier = Modifier.padding(bottom = 6.dp, start = 2.dp),
        )
        content()
    }
}

@Composable
private fun DetailRow(
    icon: ImageVector,
    label: String,
    value: String,
    valueColor: Color,
    onClear: (() -> Unit)? = null,
    onClick: () -> Unit,
) {
    val p = LocalVibe.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(7.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 6.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = p.text3, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(9.dp))
        Text(label, color = p.text2, fontSize = 13.sp, modifier = Modifier.weight(1f))
        Text(
            value,
            color = valueColor,
            fontSize = 12.5.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.widthIn(max = 190.dp),
        )
        if (onClear != null) {
            Spacer(Modifier.width(4.dp))
            VibeIconButton(Icons.Rounded.Close, "Очистити", onClear, size = 24.dp, iconSize = 12.dp)
        }
    }
}
