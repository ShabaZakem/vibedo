package com.vibedo.app.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Stop
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.Wallet
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vibedo.app.AppViewModel
import com.vibedo.app.data.DateRange
import com.vibedo.app.data.calcSalary
import com.vibedo.app.data.combineDateTime
import com.vibedo.app.data.dateKey
import com.vibedo.app.data.formatClock
import com.vibedo.app.data.formatDateInput
import com.vibedo.app.data.formatDayLabel
import com.vibedo.app.data.formatDuration
import com.vibedo.app.data.formatMoney
import com.vibedo.app.data.formatTimeInput
import com.vibedo.app.data.keyToDate
import com.vibedo.app.data.listRate
import com.vibedo.app.data.rangeFor
import com.vibedo.app.data.todayKey
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.LocalTime

private val PERIOD_OPTIONS = listOf(
    SegmentOption("today", "Сьогодні"),
    SegmentOption("week", "Тиждень"),
    SegmentOption("month", "Місяць"),
    SegmentOption("all", "Увесь час"),
)

@Composable
fun TimeScreen(vm: AppViewModel) {
    val p = LocalVibe.current
    val accent = vm.data.settings.accent.toComposeColor()
    var period by remember { mutableStateOf("week") }
    var manualOpen by remember { mutableStateOf(false) }
    var editEntryId by remember { mutableStateOf<String?>(null) }
    var confirmDelete by remember { mutableStateOf<String?>(null) }

    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(vm.data.activeTimer, vm.pomodoro.phase, vm.pomodoro.endsAt) {
        while (true) {
            now = System.currentTimeMillis()
            delay(1000)
        }
    }

    val range = rangeFor(period)
    val salary = calcSalary(vm.data.entries, vm.data.lists, vm.data.settings, range)
    val totalSeconds = salary.seconds +
        (vm.data.activeTimer?.let {
            if (it.startedAt >= range.start) (now - it.startedAt) / 1000 else 0
        } ?: 0)
    val activeTask = vm.data.activeTimer?.let { timer -> vm.data.tasks.find { it.id == timer.taskId } }
    val activeElapsed = vm.data.activeTimer?.let { ((now - it.startedAt) / 1000).coerceAtLeast(0) } ?: 0
    val entries = salary.entries.sortedByDescending { it.startedAt }
    val grouped = entries.groupBy { formatDateInput(it.startedAt) }.toSortedMap(compareByDescending { it })

    val openTasks = vm.data.tasks.filter { !it.completed }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            start = 16.dp, end = 16.dp, top = 4.dp, bottom = 110.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Segmented(PERIOD_OPTIONS, period, { period = it }, modifier = Modifier.fillMaxWidth(), accent = accent)
        }

        item {
            VibeCard(Modifier.fillMaxWidth()) {
                Text("ЗАГАЛЬНО", color = p.text3, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp)
                Spacer(Modifier.height(8.dp))
                Text(formatDuration(totalSeconds), color = p.text, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    MiniStat("Брутто", formatMoney(salary.gross, vm.data.settings.currency, 0), Modifier.weight(1f))
                    MiniStat("На руки", formatMoney(salary.net, vm.data.settings.currency, 0), Modifier.weight(1f), p.success)
                    MiniStat("Записів", "${entries.size}", Modifier.weight(1f))
                }
                if (salary.overtimeSeconds > 0) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Понаднормові: ${formatDuration(salary.overtimeSeconds)}",
                        color = p.warning, fontSize = 11.5.sp,
                    )
                }
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    VDButton("Додати запис", { manualOpen = true }, accent = accent, filled = false,
                        icon = Icons.Rounded.Add, modifier = Modifier.weight(1f))
                    if (vm.data.activeTimer != null) {
                        VDButton("Зупинити", { vm.stopTimer() }, accent = p.danger,
                            icon = Icons.Rounded.Stop, modifier = Modifier.weight(1f))
                    }
                }
            }
        }

        item {
            VibeCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(30.dp).clip(CircleShape).background(accent.copy(alpha = 0.13f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Rounded.Timer, null, tint = accent, modifier = Modifier.size(16.dp))
                    }
                    Spacer(Modifier.width(9.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            when {
                                vm.pomodoro.phase == "work" -> "Pomodoro · фокус"
                                vm.pomodoro.phase == "break" -> "Pomodoro · перерва"
                                else -> "Pomodoro"
                            },
                            color = p.text, fontSize = 14.sp, fontWeight = FontWeight.Medium,
                        )
                        Text(
                            if (vm.data.settings.pomodoroAutoBreak) "Автоперерва увімкнена" else "Без автоперерви",
                            color = p.text3, fontSize = 11.sp,
                        )
                    }
                    if (vm.pomodoro.phase != "idle") {
                        Text(
                            formatClock((vm.pomodoroRemaining() / 1000).coerceAtLeast(0)),
                            color = accent, fontSize = 20.sp, fontWeight = FontWeight.Bold,
                        )
                    }
                }
                Spacer(Modifier.height(10.dp))
                if (vm.pomodoro.phase == "idle") {
                    if (openTasks.isEmpty()) {
                        Text("Немає активних задач для фокусу", color = p.text3, fontSize = 12.sp)
                    } else {
                        var selectedTask by remember { mutableStateOf(openTasks.first().id) }
                        Text("Задача для фокусу", color = p.text3, fontSize = 10.5.sp)
                        Spacer(Modifier.height(5.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            openTasks.take(8).forEach { task ->
                                val active = task.id == selectedTask
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(if (active) accent.copy(alpha = 0.14f) else p.surface2)
                                        .clickable { selectedTask = task.id }
                                        .padding(horizontal = 9.dp, vertical = 5.dp),
                                ) {
                                    Text(
                                        task.title,
                                        color = if (active) accent else p.text2,
                                        fontSize = 11.5.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        VDButton("Почати фокус", { vm.startPomodoro(selectedTask) }, accent = accent,
                            icon = Icons.Rounded.PlayArrow)
                    }
                } else {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        VDButton(
                            if (vm.pomodoro.endsAt == null) "Продовжити" else "Пауза",
                            { if (vm.pomodoro.endsAt == null) vm.resumePomodoro() else vm.pausePomodoro() },
                            accent = accent, filled = false,
                            icon = if (vm.pomodoro.endsAt == null) Icons.Rounded.PlayArrow else Icons.Rounded.Pause,
                        )
                        VDButton("Пропустити", { vm.skipPomodoro() }, accent = p.warning, filled = false)
                        VDButton("Стоп", { vm.stopPomodoro() }, accent = p.danger, icon = Icons.Rounded.Stop)
                    }
                }
            }
        }

        if (activeTask != null || activeElapsed > 0) {
            item {
                VibeCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(8.dp).clip(CircleShape).background(p.success))
                        Spacer(Modifier.width(8.dp))
                        Column(Modifier.weight(1f)) {
                            Text(activeTask?.title ?: "Активний таймер", color = p.text, fontSize = 13.5.sp,
                                fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text("Таймер запущено", color = p.text3, fontSize = 11.sp)
                        }
                        Text(formatClock(activeElapsed), color = p.success, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.width(8.dp))
                        VibeIconButton(Icons.Rounded.Stop, "Зупинити", { vm.stopTimer() }, tint = p.danger)
                    }
                }
            }
        }

        if (entries.isEmpty()) {
            item {
                EmptyState(
                    "Записів часу немає",
                    "Запустіть таймер на задачі або додайте запис вручну.",
                    Icons.Rounded.Schedule,
                )
            }
        }

        grouped.forEach { (day, dayEntries) ->
            item(key = "day-$day") {
                Row(
                    Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 1.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        formatDayLabel(day),
                        color = p.text2, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        formatDuration(dayEntries.sumOf { it.seconds }),
                        color = p.text3, fontSize = 10.5.sp,
                    )
                }
            }
            items(dayEntries, key = { it.id }) { entry ->
                val task = vm.data.tasks.find { it.id == entry.taskId }
                val list = vm.data.lists.find { it.id == entry.listId }
                val amount = com.vibedo.app.data.amountForEntry(entry, vm.data.entries, vm.data.lists, vm.data.settings)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(9.dp))
                        .background(p.surface)
                        .clickable { editEntryId = entry.id }
                        .padding(horizontal = 12.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier.size(8.dp).clip(CircleShape)
                            .background(list?.color?.toComposeColor(p.text3) ?: p.text3),
                    )
                    Spacer(Modifier.width(9.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            task?.title ?: entry.note.ifBlank { "Без задачі" },
                            color = p.text, fontSize = 13.sp, fontWeight = FontWeight.Medium,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            "${formatTimeInput(entry.startedAt)} · ${list?.name ?: "Список"}" +
                                if (entry.manual) " · вручну" else "",
                            color = p.text3, fontSize = 10.5.sp, maxLines = 1,
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(formatDuration(entry.seconds), color = p.text, fontSize = 12.5.sp,
                            fontWeight = FontWeight.Medium)
                        Text(
                            formatMoney(amount.amount, vm.data.settings.currency, 0),
                            color = p.success, fontSize = 10.5.sp,
                        )
                    }
                    Spacer(Modifier.width(4.dp))
                    VibeIconButton(Icons.Rounded.Delete, "Видалити", { confirmDelete = entry.id },
                        tint = p.text3, size = 26.dp, iconSize = 13.dp)
                }
            }
        }
    }

    if (manualOpen || editEntryId != null) {
        val existing = editEntryId?.let { id -> vm.data.entries.find { it.id == id } }
        EntryDialog(
            vm = vm,
            existing = existing,
            onDismiss = {
                manualOpen = false
                editEntryId = null
            },
        )
    }

    val deleteId = confirmDelete
    if (deleteId != null) {
        ConfirmDialog(
            open = true,
            title = "Видалити запис?",
            body = "Запис часу буде видалено. Задачу це не зачіпає.",
            onConfirm = {
                vm.deleteEntry(deleteId)
                confirmDelete = null
            },
            onDismiss = { confirmDelete = null },
        )
    }
}

@Composable
private fun MiniStat(label: String, value: String, modifier: Modifier = Modifier, color: Color? = null) {
    val p = LocalVibe.current
    Column(modifier) {
        Text(label, color = p.text3, fontSize = 10.sp)
        Spacer(Modifier.height(2.dp))
        Text(value, color = color ?: p.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable
fun EntryDialog(
    vm: AppViewModel,
    existing: com.vibedo.app.data.TimeEntry?,
    onDismiss: () -> Unit,
) {
    val p = LocalVibe.current
    val accent = vm.data.settings.accent.toComposeColor()
    val context = LocalContext.current
    val initialDate = existing?.let { formatDateInput(it.startedAt) } ?: todayKey()
    val initialTime = existing?.let { formatTimeInput(it.startedAt) } ?: "09:00"
    val initialHours = existing?.let { "%.2f".format(it.seconds / 3600.0) } ?: "1"

    var taskId by remember { mutableStateOf(existing?.taskId ?: "") }
    var listId by remember { mutableStateOf(existing?.listId ?: vm.data.lists.firstOrNull()?.id ?: "") }
    var date by remember { mutableStateOf(initialDate) }
    var time by remember { mutableStateOf(initialTime) }
    var hours by remember { mutableStateOf(initialHours) }
    var note by remember { mutableStateOf(existing?.note ?: "") }
    var showTasks by remember { mutableStateOf(false) }

    val selectedTask = vm.data.tasks.find { it.id == taskId }

    VibeDialog(onDismiss = onDismiss, title = if (existing == null) "Новий запис часу" else "Редагувати запис") {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(p.surface2)
                .clickable { showTasks = true }
                .padding(horizontal = 12.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Rounded.CheckCircle, null, tint = p.text2, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                Text("Задача", color = p.text3, fontSize = 10.5.sp)
                Text(
                    selectedTask?.title ?: "Без задачі",
                    color = p.text, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
            Text("Змінити", color = accent, fontSize = 11.5.sp)
        }
        Spacer(Modifier.height(8.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(p.surface2)
                    .clickable {
                        val initial = keyToDate(date)
                        DatePickerDialog(context, { _, year, month, day ->
                            date = LocalDate.of(year, month + 1, day).toString()
                        }, initial.year, initial.monthValue - 1, initial.dayOfMonth).show()
                    }
                    .padding(horizontal = 10.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Дата", color = p.text3, fontSize = 11.sp, modifier = Modifier.weight(1f))
                Text(formatDayLabel(date), color = p.text, fontSize = 12.sp)
            }
            Row(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(p.surface2)
                    .clickable {
                        val parsed = runCatching { LocalTime.parse(time) }.getOrDefault(LocalTime.of(9, 0))
                        TimePickerDialog(context, { _, hour, minute ->
                            time = "%02d:%02d".format(hour, minute)
                        }, parsed.hour, parsed.minute, true).show()
                    }
                    .padding(horizontal = 10.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Час", color = p.text3, fontSize = 11.sp, modifier = Modifier.weight(1f))
                Text(time, color = p.text, fontSize = 12.sp)
            }
        }
        Spacer(Modifier.height(8.dp))
        VibeTextField(
            hours, { hours = it.filter { ch -> ch.isDigit() || ch == '.' || ch == ',' } },
            "Тривалість, годин", modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        )
        Spacer(Modifier.height(8.dp))
        VibeTextField(note, { note = it }, "Нотатка (необов’язково)", modifier = Modifier.fillMaxWidth())

        val list = vm.data.lists.find { it.id == listId } ?: vm.data.lists.firstOrNull()
        Spacer(Modifier.height(8.dp))
        Text(
            "Ставка: ${formatMoney(listRate(list, vm.data.settings), vm.data.settings.currency, 0)}/год" +
                (list?.let { " · ${it.name}" } ?: ""),
            color = p.text3, fontSize = 11.sp,
        )

        Spacer(Modifier.height(18.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            if (existing != null) {
                VDButton("Видалити", {
                    vm.deleteEntry(existing.id)
                    onDismiss()
                }, accent = p.danger, filled = false)
            }
            Spacer(Modifier.weight(1f))
            VDButton("Скасувати", onDismiss, filled = false)
            VDButton(if (existing == null) "Додати" else "Зберегти", {
                val seconds = ((hours.replace(',', '.').toDoubleOrNull() ?: 0.0) * 3600).toLong()
                    .coerceAtLeast(60)
                val startedAt = combineDateTime(date, time)
                if (existing == null) {
                    vm.addManualEntry(
                        taskId = taskId.takeIf { it.isNotBlank() },
                        listId = listId.ifBlank { vm.data.lists.firstOrNull()?.id ?: "" },
                        startedAt = startedAt,
                        seconds = seconds,
                        note = note,
                    )
                } else {
                    vm.updateEntry(
                        id = existing.id,
                        seconds = seconds,
                        note = note,
                        startedAt = startedAt,
                        listId = listId.ifBlank { existing.listId },
                        taskId = taskId.takeIf { it.isNotBlank() },
                    )
                }
                onDismiss()
            }, accent = accent)
        }

        if (showTasks) {
            Spacer(Modifier.height(8.dp))
            DividerLine()
            Spacer(Modifier.height(8.dp))
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(7.dp))
                        .clickable {
                            taskId = ""
                            showTasks = false
                        }
                        .padding(horizontal = 8.dp, vertical = 9.dp),
                ) {
                    Text("Без задачі", color = p.text, fontSize = 13.sp)
                }
                vm.data.tasks.filter { !it.completed }.take(20).forEach { task ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(7.dp))
                            .background(if (task.id == taskId) p.surface2 else Color.Transparent)
                            .clickable {
                                taskId = task.id
                                listId = task.listId
                                showTasks = false
                            }
                            .padding(horizontal = 8.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier.size(7.dp).clip(CircleShape)
                                .background(vm.data.lists.find { it.id == task.listId }?.color?.toComposeColor() ?: p.text3),
                        )
                        Spacer(Modifier.width(7.dp))
                        Text(task.title, color = p.text, fontSize = 13.sp, maxLines = 1,
                            overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}
