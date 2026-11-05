package com.vibedo.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.FilterList
import androidx.compose.material.icons.rounded.ListAlt
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Sort
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.StarBorder
import androidx.compose.material.icons.rounded.Stop
import androidx.compose.material.icons.rounded.LightMode
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vibedo.app.AppViewModel
import com.vibedo.app.View
import com.vibedo.app.data.DateRange
import com.vibedo.app.data.Task
import com.vibedo.app.data.TaskList
import com.vibedo.app.data.calcSalary
import com.vibedo.app.data.dueLabelTone
import com.vibedo.app.data.formatClock
import com.vibedo.app.data.formatDateInput
import com.vibedo.app.data.formatDueLabel
import com.vibedo.app.data.formatDuration
import com.vibedo.app.data.formatLongDate
import com.vibedo.app.data.formatMoney
import com.vibedo.app.data.greeting
import com.vibedo.app.data.isOverdue
import com.vibedo.app.data.parseQuickAdd
import com.vibedo.app.data.pluralizeUk
import com.vibedo.app.data.rangeFor
import com.vibedo.app.data.repeatLabel
import com.vibedo.app.data.tagColor
import com.vibedo.app.data.todayKey
import kotlinx.coroutines.delay
import java.time.LocalDate

private val SORT_OPTIONS = listOf(
    SegmentOption("created", "Спочатку нові"),
    SegmentOption("due", "За датою"),
    SegmentOption("important", "За важливістю"),
    SegmentOption("alpha", "За назвою"),
)

@Composable
fun TaskListScreen(
    vm: AppViewModel,
    showSearch: Boolean,
    onOpenTask: (String) -> Unit,
    onEditList: (TaskList) -> Unit,
) {
    val p = LocalVibe.current
    val accent = vm.data.settings.accent.toComposeColor()
    val view = vm.view
    val today = todayKey()
    val smartId = (view as? View.Smart)?.id
    val list = (view as? View.ListView)?.let { current -> vm.data.lists.find { it.id == current.id } }

    var draft by remember { mutableStateOf("") }
    var showCompleted by remember { mutableStateOf(false) }
    var tagFilter by remember { mutableStateOf<String?>(null) }
    var confirmClear by remember { mutableStateOf(false) }
    var sortOpen by remember { mutableStateOf(false) }

    LaunchedEffect(view) {
        tagFilter = null
    }

    val scope = remember(vm.data.tasks, view, today, list) {
        when {
            list != null -> vm.data.tasks.filter { it.listId == list.id }
            smartId == "myday" -> vm.data.tasks.filter { it.myDayDate == today }
            smartId == "important" -> vm.data.tasks.filter { it.important }
            smartId == "planned" -> vm.data.tasks.filter { it.dueDate != null }
            else -> vm.data.tasks
        }
    }

    val query = vm.search.trim().lowercase()
    val filtered = scope.filter { task ->
        val tagOk = tagFilter == null || task.tags.any { it.equals(tagFilter, true) }
        if (!tagOk) return@filter false
        if (query.isEmpty()) return@filter true
        val haystack = buildString {
            append(task.title).append(' ').append(task.notes)
            task.tags.forEach { append(' ').append(it) }
            task.steps.forEach { append(' ').append(it.title) }
        }.lowercase()
        haystack.contains(query)
    }
    val activeTasks = sortTasks(filtered.filter { !it.completed }, vm.sort)
    val completedTasks = sortTasks(filtered.filter { it.completed }, "created")
    val allTags = remember(vm.data.tasks) {
        vm.data.tasks.flatMap { it.tags }
            .groupingBy { it }
            .eachCount()
            .entries.sortedByDescending { it.value }
            .take(12)
    }

    val now by produceState(System.currentTimeMillis(), vm.data.activeTimer) {
        while (true) {
            value = System.currentTimeMillis()
            delay(if (vm.data.activeTimer != null) 1000 else 30_000)
        }
    }

    val todayEntries = vm.data.entries.filter { formatDateInput(it.startedAt) == today }
    val todaySeconds = todayEntries.sumOf { it.seconds } +
        (vm.data.activeTimer?.let {
            if (formatDateInput(it.startedAt) == today) (now - it.startedAt) / 1000 else 0
        } ?: 0)
    val todaySalary = calcSalary(vm.data.entries, vm.data.lists, vm.data.settings, rangeFor("today"))
    val myDayTotal = scope.size
    val myDayDone = scope.count { it.completed }

    val draftPreview = remember(draft) { if (draft.isBlank()) null else parseQuickAdd(draft) }

    fun submit() {
        val value = draft.trim()
        if (value.isEmpty()) return
        val parsed = parseQuickAdd(value)
        val newId = vm.addTask(
            title = parsed.title.ifBlank { value },
            listId = list?.id,
            myDay = smartId == "myday",
            important = smartId == "important",
            dueDate = parsed.dueDate ?: if (smartId == "planned") today else null,
            dueTime = parsed.dueTime,
            tags = parsed.tags,
            repeat = parsed.repeat,
        )
        draft = ""
        if (newId.isNotBlank()) vm.showToast("Задачу додано")
    }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            start = 16.dp, end = 16.dp, top = 4.dp, bottom = 110.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        if (smartId == "myday") {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(p.surface)
                        .padding(16.dp),
                ) {
                    Text(
                        "${greeting()}${vm.data.settings.firstName.trim().let { if (it.isNotEmpty()) ", $it" else "" }}",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = p.text,
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(formatLongDate(LocalDate.now()), fontSize = 12.5.sp, color = p.text3)
                    Spacer(Modifier.height(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        HeroStat("Задачі", "$myDayDone / $myDayTotal",
                            if (myDayTotal - myDayDone > 0) "ще є час" else "усе під контролем",
                            Modifier.weight(1f))
                        HeroStat("Час", formatDuration(todaySeconds),
                            "норма ${vm.data.settings.dailyNormHours.toInt()} год",
                            Modifier.weight(1f))
                        HeroStat("Заробіток", formatMoney(todaySalary.gross, vm.data.settings.currency, 0),
                            "${formatMoney(todaySalary.net, vm.data.settings.currency, 0)} на руки",
                            Modifier.weight(1f), p.success)
                    }
                }
            }
        }

        if (showSearch) {
            item {
                VibeTextField(
                    value = vm.search,
                    onValueChange = vm::updateSearch,
                    placeholder = "Пошук задач…",
                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                    leading = { Icon(Icons.Rounded.Search, null, tint = p.text3, modifier = Modifier.size(17.dp)) },
                    trailing = if (vm.search.isNotEmpty()) {
                        { VibeIconButton(Icons.Rounded.Delete, "Очистити", { vm.updateSearch("") }, size = 24.dp, iconSize = 14.dp) }
                    } else null,
                    accent = accent,
                )
            }
        }

        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = if (smartId == "myday") 12.dp else 6.dp, bottom = 4.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(p.surface)
                    .padding(start = 12.dp, end = 6.dp, top = 2.dp, bottom = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Rounded.Add, null, tint = accent, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                VibeTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    placeholder = when (smartId) {
                        "myday" -> "Додати задачу в Мій день…"
                        "important" -> "Додати важливу задачу…"
                        "planned" -> "Додати задачу на сьогодні…"
                        else -> "Додати задачу${list?.let { " у «${it.name}»" } ?: ""}…"
                    },
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { submit() }),
                    accent = accent,
                )
                Spacer(Modifier.width(6.dp))
                VDButton(
                    text = "Додати",
                    onClick = { submit() },
                    enabled = draft.isNotBlank(),
                    accent = accent,
                )
            }
        }

        if (draftPreview != null && (draftPreview.dueDate != null || draftPreview.tags.isNotEmpty() || draftPreview.repeat != null)) {
            item {
                Row(
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    draftPreview.dueDate?.let {
                        MiniLabel("${formatDueLabel(it, draftPreview.dueTime)}", p.text2)
                    }
                    draftPreview.repeat?.let {
                        MiniLabel(repeatLabel(it), p.text2)
                    }
                    draftPreview.tags.take(4).forEach { tag ->
                        Text("#$tag", color = tagColor(tag).toComposeColor(), fontSize = 10.5.sp)
                    }
                }
            }
        }

        if (allTags.isNotEmpty()) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    TagFilterChip("Усі", tagFilter == null, accent) { tagFilter = null }
                    allTags.forEach { (tag, count) ->
                        TagFilterChip("#$tag  $count", tagFilter == tag, tagColor(tag).toComposeColor()) {
                            tagFilter = if (tagFilter == tag) null else tag
                        }
                    }
                }
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "АКТИВНІ",
                    color = p.text3,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.6.sp,
                    modifier = Modifier.weight(1f),
                )
                Text("${activeTasks.size}", color = p.text3, fontSize = 11.sp)
                Spacer(Modifier.width(8.dp))
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable { sortOpen = true }
                        .padding(horizontal = 6.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Rounded.Sort, null, tint = p.text3, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(
                        SORT_OPTIONS.firstOrNull { it.value == vm.sort }?.label ?: "Сортування",
                        color = p.text3,
                        fontSize = 11.sp,
                    )
                }
            }
        }

        if (activeTasks.isEmpty() && completedTasks.isEmpty()) {
            item {
                EmptyState(
                    title = if (vm.search.isNotBlank()) "Нічого не знайдено" else "Тут поки що порожньо",
                    body = if (vm.search.isNotBlank()) "Спробуйте інший запит або очистіть пошук."
                    else if (smartId == "myday") "Додайте задачі на сьогодні — і почніть фокусуватися."
                    else "Створіть першу задачу у полі вище. Усе зберігається локально на вашому пристрої.",
                    icon = when (smartId) {
                        "myday" -> Icons.Rounded.LightMode
                        "planned" -> Icons.Rounded.CalendarMonth
                        "important" -> Icons.Rounded.Star
                        else -> Icons.Rounded.ListAlt
                    },
                )
            }
        }

        items(activeTasks, key = { it.id }) { task ->
            TaskRow(
                task = task,
                list = vm.data.lists.find { it.id == task.listId },
                showList = list == null,
                now = now,
                active = vm.data.activeTimer?.taskId == task.id,
                timerStartedAt = vm.data.activeTimer?.takeIf { it.taskId == task.id }?.startedAt,
                accent = accent,
                onClick = { onOpenTask(task.id) },
                onToggle = { vm.toggleTask(task.id) },
                onStar = { vm.toggleImportant(task.id) },
                onTimer = {
                    if (vm.data.activeTimer?.taskId == task.id) vm.stopTimer() else vm.startTimer(task.id)
                },
            )
        }

        if (completedTasks.isNotEmpty()) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp, bottom = 2.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .clickable { showCompleted = !showCompleted }
                        .padding(horizontal = 4.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        if (showCompleted) Icons.Rounded.ExpandMore else Icons.Rounded.ChevronRight,
                        null, tint = p.text3, modifier = Modifier.size(15.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text("Виконано", color = p.text3, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.width(6.dp))
                    Text("${completedTasks.size}", color = p.text3, fontSize = 11.sp)
                    Spacer(Modifier.weight(1f))
                    if (showCompleted) {
                        Text(
                            "Очистити", color = p.danger, fontSize = 11.sp,
                            modifier = Modifier
                                .clip(RoundedCornerShape(5.dp))
                                .clickable { confirmClear = true }
                                .padding(horizontal = 6.dp, vertical = 3.dp),
                        )
                    }
                }
            }
            if (showCompleted) {
                items(completedTasks, key = { it.id }) { task ->
                    TaskRow(
                        task = task,
                        list = vm.data.lists.find { it.id == task.listId },
                        showList = list == null,
                        now = now,
                        active = false,
                        timerStartedAt = null,
                        accent = accent,
                        onClick = { onOpenTask(task.id) },
                        onToggle = { vm.toggleTask(task.id) },
                        onStar = { vm.toggleImportant(task.id) },
                        onTimer = {},
                    )
                }
            }
        }
    }

    if (sortOpen) {
        VibeDialog(onDismiss = { sortOpen = false }, title = "Сортування") {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                SORT_OPTIONS.forEach { option ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(7.dp))
                            .background(if (vm.sort == option.value) p.surface2 else Color.Transparent)
                            .clickable {
                                vm.updateSort(option.value)
                                sortOpen = false
                            }
                            .padding(horizontal = 10.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(option.label, color = p.text, fontSize = 14.sp, modifier = Modifier.weight(1f))
                        if (vm.sort == option.value) {
                            Icon(Icons.Rounded.CheckCircle, null, tint = accent, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }
    }

    ConfirmDialog(
        open = confirmClear,
        title = "Очистити виконані?",
        body = "Буде назавжди видалено ${completedTasks.size} " +
            pluralizeUk(completedTasks.size, listOf("виконану задачу", "виконані задачі", "виконаних задач")) +
            " разом із записами часу.",
        confirmLabel = "Очистити",
        onConfirm = {
            vm.clearCompleted(list?.id)
            confirmClear = false
            vm.showToast("Виконані задачі очищено")
        },
        onDismiss = { confirmClear = false },
    )

}

@Composable
private fun HeroStat(
    label: String,
    value: String,
    hint: String,
    modifier: Modifier = Modifier,
    valueColor: Color? = null,
) {
    val p = LocalVibe.current
    Column(modifier) {
        Text(label, color = p.text3, fontSize = 10.5.sp, maxLines = 1)
        Spacer(Modifier.height(2.dp))
        Text(value, color = valueColor ?: p.text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        Text(hint, color = p.text3, fontSize = 9.5.sp, maxLines = 1)
    }
}

@Composable
private fun MiniLabel(text: String, color: Color) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(5.dp))
            .background(color.copy(alpha = 0.1f))
            .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, color = color, fontSize = 10.sp, maxLines = 1)
    }
}

@Composable
private fun TagFilterChip(text: String, active: Boolean, color: Color, onClick: () -> Unit) {
    val p = LocalVibe.current
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (active) color.copy(alpha = 0.16f) else p.surface2)
            .clickable(onClick = onClick)
            .padding(horizontal = 9.dp, vertical = 5.dp),
    ) {
        Text(text, color = if (active) color else p.text2, fontSize = 11.sp, maxLines = 1)
    }
}

@Composable
fun TaskRow(
    task: Task,
    list: TaskList?,
    showList: Boolean,
    now: Long,
    active: Boolean,
    timerStartedAt: Long?,
    accent: Color,
    onClick: () -> Unit,
    onToggle: () -> Unit,
    onStar: () -> Unit,
    onTimer: () -> Unit,
) {
    val p = LocalVibe.current
    val doneSteps = task.steps.count { it.done }
    val tone = dueLabelTone(task)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 7.dp, horizontal = 2.dp),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            RoundCheck(task.completed, onToggle, accent)
            Spacer(Modifier.width(6.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    task.title,
                    color = if (task.completed) p.text3 else p.text,
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.Medium,
                    textDecoration = if (task.completed) TextDecoration.LineThrough else TextDecoration.None,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
                if (task.notes.isNotBlank()) {
                    Text(
                        task.notes,
                        color = p.text3,
                        fontSize = 11.5.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 1.dp),
                    )
                }
                if (showList && list != null || task.dueDate != null || task.tags.isNotEmpty() ||
                    task.steps.isNotEmpty() || task.estimateMinutes != null || task.repeat != null || active
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp)
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (showList && list != null) {
                            MetaChip(text = list.name, color = list.color.toComposeColor(p.text2),
                                dot = list.color.toComposeColor(p.text2))
                        }
                        if (task.dueDate != null) {
                            val color = when (tone) {
                                "overdue" -> p.danger
                                "today" -> p.warning
                                else -> p.text2
                            }
                            MetaChip(
                                text = (if (isOverdue(task)) "Прострочено · " else "") +
                                    formatDueLabel(task.dueDate, task.dueTime),
                                color = color,
                                icon = Icons.Rounded.CalendarMonth,
                            )
                        }
                        if (task.repeat != null) {
                            MetaChip(text = repeatLabel(task.repeat), color = p.text2, icon = Icons.Rounded.Repeat)
                        }
                        task.tags.take(3).forEach { tag ->
                            val color = tagColor(tag).toComposeColor()
                            Box(
                                Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(color.copy(alpha = 0.12f))
                                    .padding(horizontal = 5.dp, vertical = 2.dp),
                            ) {
                                Text("#$tag", color = color, fontSize = 10.sp, maxLines = 1)
                            }
                        }
                        if (task.tags.size > 3) {
                            Text("+${task.tags.size - 3}", color = p.text3, fontSize = 10.sp)
                        }
                        if (task.steps.isNotEmpty()) {
                            MetaChip(text = "$doneSteps/${task.steps.size}", color = p.text2,
                                icon = Icons.Rounded.CheckCircle)
                        }
                        if (task.estimateMinutes != null) {
                            MetaChip(text = "${task.estimateMinutes} хв", color = p.text2, icon = Icons.Rounded.Schedule)
                        }
                        if (active && timerStartedAt != null) {
                            val elapsedSeconds = ((now - timerStartedAt) / 1000).coerceAtLeast(0)
                            MetaChip(text = formatClock(elapsedSeconds), color = p.success)
                        }
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                VibeIconButton(
                    if (task.important) Icons.Rounded.Star else Icons.Rounded.StarBorder,
                    "Важливо",
                    onStar,
                    tint = if (task.important) p.warning else p.text3,
                    size = 30.dp,
                    iconSize = 16.dp,
                )
                if (!task.completed) {
                    VibeIconButton(
                        if (active) Icons.Rounded.Stop else Icons.Rounded.PlayArrow,
                        if (active) "Зупинити таймер" else "Запустити таймер",
                        onTimer,
                        tint = if (active) p.success else p.text3,
                        size = 30.dp,
                        iconSize = 16.dp,
                    )
                }
            }
        }
    }
}

@Composable
private fun MetaChip(
    text: String,
    color: Color,
    icon: ImageVector? = null,
    dot: Color? = null,
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(color.copy(alpha = 0.09f))
            .padding(horizontal = 5.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        if (dot != null) {
            Box(Modifier.size(5.dp).clip(CircleShape).background(dot))
        }
        if (icon != null) {
            Icon(icon, null, tint = color, modifier = Modifier.size(10.dp))
        }
        Text(text, color = color, fontSize = 10.sp, fontStyle = FontStyle.Normal, maxLines = 1)
    }
}

private fun sortTasks(tasks: List<Task>, sort: String): List<Task> {
    return when (sort) {
        "due" -> tasks.sortedWith(
            compareBy<Task> { it.dueDate == null }
                .thenBy { it.dueDate ?: "" }
                .thenBy { it.dueTime ?: "" }
                .thenByDescending { it.createdAt },
        )
        "important" -> tasks.sortedWith(
            compareByDescending<Task> { it.important }.thenByDescending { it.createdAt },
        )
        "alpha" -> tasks.sortedBy { it.title.lowercase() }
        else -> tasks.sortedByDescending { it.createdAt }
    }
}
