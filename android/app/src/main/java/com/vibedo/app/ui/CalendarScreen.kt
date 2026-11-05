package com.vibedo.app.ui

import android.app.DatePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Payments
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vibedo.app.AppViewModel
import com.vibedo.app.data.DateRange
import com.vibedo.app.data.WEEKDAYS_SHORT
import com.vibedo.app.data.addDaysKey
import com.vibedo.app.data.calcSalary
import com.vibedo.app.data.combineDateTime
import com.vibedo.app.data.formatDateInput
import com.vibedo.app.data.formatDayLabel
import com.vibedo.app.data.formatDuration
import com.vibedo.app.data.formatMoney
import com.vibedo.app.data.formatMonth
import com.vibedo.app.data.formatTimeInput
import com.vibedo.app.data.isWeekendKey
import com.vibedo.app.data.keyToDate
import com.vibedo.app.data.monthMatrix
import com.vibedo.app.data.parseQuickAdd
import com.vibedo.app.data.todayKey
import java.time.LocalDate

@Composable
fun CalendarScreen(vm: AppViewModel) {
    val p = LocalVibe.current
    val accent = vm.data.settings.accent.toComposeColor()
    val today = todayKey()
    var anchor by remember { mutableStateOf(LocalDate.now().withDayOfMonth(1)) }
    var selected by remember { mutableStateOf(today) }
    var draft by remember { mutableStateOf("") }
    var showPayday by remember { mutableStateOf(false) }
    var editingPaydayId by remember { mutableStateOf<String?>(null) }
    var confirmPayday by remember { mutableStateOf<String?>(null) }

    val matrix = remember(anchor) { monthMatrix(anchor) }
    val monthRange = DateRange(
        anchor.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli(),
        anchor.plusMonths(1).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli(),
    )
    val monthSalary = calcSalary(vm.data.entries, vm.data.lists, vm.data.settings, monthRange)
    val dayRange = DateRange(
        keyToDate(selected).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli(),
        keyToDate(selected).plusDays(1).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli(),
    )
    val daySalary = calcSalary(vm.data.entries, vm.data.lists, vm.data.settings, dayRange)
    val dayTasks = vm.data.tasks.filter { it.dueDate == selected }.sortedBy { it.dueTime ?: "99:99" }
    val dayPaydays = vm.data.paydays.filter { it.date == selected }
    val dayEntries = vm.data.entries.filter { formatDateInput(it.startedAt) == selected }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(bottom = 110.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    formatMonth(anchor).replaceFirstChar { it.uppercase() },
                    fontSize = 19.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = p.text,
                )
                Text(
                    "${formatDuration(monthSalary.seconds)} · ${formatMoney(monthSalary.gross, vm.data.settings.currency, 0)}",
                    color = p.text3, fontSize = 12.sp,
                )
            }
            VibeIconButton(Icons.Rounded.ChevronLeft, "Попередній місяць", {
                anchor = anchor.minusMonths(1)
            })
            VibeIconButton(Icons.Rounded.ChevronRight, "Наступний місяць", {
                anchor = anchor.plusMonths(1)
            })
            VDButton("Сьогодні", {
                anchor = LocalDate.now().withDayOfMonth(1)
                selected = today
            }, filled = false, accent = accent)
        }

        Row(Modifier.fillMaxWidth()) {
            WEEKDAYS_SHORT.forEachIndexed { index, label ->
                Text(
                    label,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    color = if (index >= 5) p.text3 else p.text2,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                )
            }
        }
        Spacer(Modifier.height(4.dp))

        Column(Modifier.fillMaxWidth()) {
            matrix.chunked(7).forEach { week ->
                Row(Modifier.fillMaxWidth()) {
                    week.forEach { key ->
                        val date = keyToDate(key)
                        val inMonth = date.monthValue == anchor.monthValue
                        val isToday = key == today
                        val isSelected = key == selected
                        val tasksCount = vm.data.tasks.count { it.dueDate == key && !it.completed }
                        val payday = vm.data.paydays.any { it.date == key }
                        val seconds = vm.data.entries.filter { formatDateInput(it.startedAt) == key }.sumOf { it.seconds }
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .padding(2.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    when {
                                        isSelected -> accent.copy(alpha = 0.14f)
                                        isToday -> p.surface2
                                        else -> Color.Transparent
                                    },
                                )
                                .then(if (isToday) Modifier.border(1.dp, accent.copy(alpha = 0.5f), RoundedCornerShape(8.dp)) else Modifier)
                                .clickable { selected = key },
                            contentAlignment = Alignment.Center,
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    "${date.dayOfMonth}",
                                    color = when {
                                        !inMonth -> p.text3.copy(alpha = 0.5f)
                                        isSelected -> accent
                                        isWeekendKey(key) -> p.text3
                                        else -> p.text
                                    },
                                    fontSize = 12.5.sp,
                                    fontWeight = if (isSelected || isToday) FontWeight.SemiBold else FontWeight.Normal,
                                )
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    if (tasksCount > 0) {
                                        Box(
                                            Modifier.size(4.dp).clip(CircleShape).background(accent),
                                        )
                                    }
                                    if (payday) {
                                        Box(
                                            Modifier.size(4.dp).clip(CircleShape).background(p.success),
                                        )
                                    }
                                    if (seconds > 0) {
                                        Box(
                                            Modifier.size(4.dp).clip(CircleShape).background(p.warning),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))

        VibeCard(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(formatDayLabel(selected), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = p.text)
                    Text(
                        "${dayTasks.size} задач · ${formatDuration(daySalary.seconds)}",
                        color = p.text3, fontSize = 11.5.sp,
                    )
                }
                Text(
                    formatMoney(daySalary.gross, vm.data.settings.currency, 0),
                    color = p.success, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                )
            }

            if (dayPaydays.isNotEmpty() || selected >= today) {
                Spacer(Modifier.height(10.dp))
                dayPaydays.forEach { payday ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(7.dp))
                            .background(p.successSoft)
                            .padding(horizontal = 9.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Rounded.Payments, null, tint = p.success, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(7.dp))
                        Column(Modifier.weight(1f)) {
                            Text(payday.note.ifBlank { "Зарплата" }, color = p.success, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                            if (payday.amount != null) {
                                Text(
                                    formatMoney(payday.amount, vm.data.settings.currency, 0),
                                    color = p.success.copy(alpha = 0.8f), fontSize = 10.5.sp,
                                )
                            }
                        }
                        VibeIconButton(Icons.Rounded.Delete, "Видалити", {
                            confirmPayday = payday.id
                        }, tint = p.danger, size = 26.dp, iconSize = 13.dp)
                    }
                    Spacer(Modifier.height(4.dp))
                }
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable {
                            editingPaydayId = null
                            showPayday = true
                        }
                        .padding(horizontal = 4.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Rounded.Add, null, tint = p.text3, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Додати зарплатний день", color = p.text3, fontSize = 11.5.sp)
                }
            }

            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(p.surface2)
                    .padding(start = 10.dp, end = 5.dp, top = 2.dp, bottom = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Rounded.Add, null, tint = accent, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(6.dp))
                VibeTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    placeholder = "Задача на ${formatDayLabel(selected)}…",
                    modifier = Modifier.weight(1f),
                    accent = accent,
                )
                VDButton("Додати", {
                    val value = draft.trim()
                    if (value.isNotBlank()) {
                        val parsed = parseQuickAdd(value)
                        vm.addTask(
                            title = parsed.title.ifBlank { value },
                            dueDate = selected,
                            dueTime = parsed.dueTime,
                            tags = parsed.tags,
                            repeat = parsed.repeat,
                        )
                        draft = ""
                    }
                }, enabled = draft.isNotBlank(), accent = accent)
            }

            Spacer(Modifier.height(6.dp))
            if (dayTasks.isEmpty()) {
                Text(
                    "На цей день задач немає",
                    color = p.text3, fontSize = 12.sp,
                    modifier = Modifier.padding(vertical = 12.dp),
                )
            }
            dayTasks.forEach { task ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(7.dp))
                        .clickable { vm.selectTask(task.id) }
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RoundCheck(task.completed, { vm.toggleTask(task.id) }, accent, size = 17.dp)
                    Spacer(Modifier.width(6.dp))
                    Text(
                        task.title,
                        color = if (task.completed) p.text3 else p.text,
                        fontSize = 13.sp,
                        textDecoration = if (task.completed) TextDecoration.LineThrough else TextDecoration.None,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    if (task.dueTime != null) {
                        Text(task.dueTime, color = p.text3, fontSize = 10.5.sp)
                    }
                }
            }

            if (dayEntries.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                DividerLine()
                Spacer(Modifier.height(8.dp))
                dayEntries.sortedBy { it.startedAt }.forEach { entry ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Rounded.CalendarMonth, null, tint = p.text3, modifier = Modifier.size(13.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(
                            entry.note.ifBlank {
                                vm.data.tasks.find { it.id == entry.taskId }?.title ?: "Запис часу"
                            },
                            color = p.text2, fontSize = 11.5.sp, maxLines = 1,
                            overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
                        )
                        Text(formatDuration(entry.seconds), color = p.text3, fontSize = 10.5.sp)
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        VibeCard(Modifier.fillMaxWidth()) {
            Text("ПІДСУМОК МІСЯЦЯ", color = p.text3, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp)
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MonthStat("Годин", formatDuration(monthSalary.seconds), Modifier.weight(1f))
                MonthStat("Брутто", formatMoney(monthSalary.gross, vm.data.settings.currency, 0), Modifier.weight(1f))
                MonthStat("На руки", formatMoney(monthSalary.net, vm.data.settings.currency, 0), Modifier.weight(1f), p.success)
            }
        }
    }

    if (showPayday) {
        PaydayDialog(
            initialDate = selected,
            onDismiss = { showPayday = false },
            onSave = { date, note, amount ->
                vm.addPayday(date, note, amount)
                showPayday = false
                vm.showToast("Зарплатний день додано")
            },
        )
    }

    val paydayId = confirmPayday
    if (paydayId != null) {
        ConfirmDialog(
            open = true,
            title = "Видалити зарплатний день?",
            body = "Позначку буде видалено з календаря.",
            onConfirm = {
                vm.deletePayday(paydayId)
                confirmPayday = null
            },
            onDismiss = { confirmPayday = null },
        )
    }
}

@Composable
private fun MonthStat(label: String, value: String, modifier: Modifier = Modifier, color: Color? = null) {
    val p = LocalVibe.current
    Column(modifier) {
        Text(label, color = p.text3, fontSize = 10.sp)
        Spacer(Modifier.height(2.dp))
        Text(value, color = color ?: p.text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}

@Composable
fun PaydayDialog(
    initialDate: String,
    onDismiss: () -> Unit,
    onSave: (String, String, Double?) -> Unit,
) {
    val p = LocalVibe.current
    val context = LocalContext.current
    var date by remember { mutableStateOf(initialDate) }
    var note by remember { mutableStateOf("Зарплата") }
    var amount by remember { mutableStateOf("") }

    VibeDialog(onDismiss = onDismiss, title = "Зарплатний день") {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(p.surface2)
                .clickable {
                    val initial = keyToDate(date)
                    DatePickerDialog(context, { _, year, month, day ->
                        date = LocalDate.of(year, month + 1, day).toString()
                    }, initial.year, initial.monthValue - 1, initial.dayOfMonth).show()
                }
                .padding(horizontal = 12.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Rounded.CalendarMonth, null, tint = p.text2, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            Text("Дата", color = p.text2, fontSize = 13.sp, modifier = Modifier.weight(1f))
            Text(formatDayLabel(date), color = p.text, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        }
        Spacer(Modifier.height(8.dp))
        VibeTextField(note, { note = it }, "Нотатка", modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        VibeTextField(
            amount, { amount = it.filter { ch -> ch.isDigit() || ch == '.' || ch == ',' } },
            "Сума (необов’язково)", modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        )
        Spacer(Modifier.height(18.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Spacer(Modifier.weight(1f))
            VDButton("Скасувати", onDismiss, filled = false)
            VDButton("Зберегти", {
                onSave(date, note, amount.replace(',', '.').toDoubleOrNull())
            })
        }
    }
}
