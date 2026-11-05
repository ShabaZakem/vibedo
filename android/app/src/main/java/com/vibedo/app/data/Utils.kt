package com.vibedo.app.data

import java.text.NumberFormat
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.random.Random

private val UK = Locale("uk", "UA")
private val MONTHS_GENITIVE = arrayOf(
    "січня", "лютого", "березня", "квітня", "травня", "червня",
    "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
)
private val MONTHS_NOMINATIVE = arrayOf(
    "січень", "лютий", "березень", "квітень", "травень", "червень",
    "липень", "серпень", "вересень", "жовтень", "листопад", "грудень",
)
private val MONTHS_SHORT = arrayOf(
    "січ.", "лют.", "бер.", "квіт.", "трав.", "черв.",
    "лип.", "серп.", "вер.", "жовт.", "лист.", "груд.",
)
private val WEEKDAYS_FULL = arrayOf(
    "понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота", "неділя",
)
val WEEKDAYS_SHORT = arrayOf("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд")

fun uid(prefix: String = ""): String {
    val random = Random.nextInt(0, Int.MAX_VALUE).toString(36)
    return prefix + System.currentTimeMillis().toString(36) + random
}

fun todayKey(): String = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)

fun dateKey(date: LocalDate): String = date.format(DateTimeFormatter.ISO_LOCAL_DATE)

fun keyToDate(key: String): LocalDate = runCatching { LocalDate.parse(key) }.getOrDefault(LocalDate.now())

fun addDaysKey(key: String, days: Long): String = dateKey(keyToDate(key).plusDays(days))

fun combineDateTime(date: String, time: String?): Long {
    val day = keyToDate(date)
    val localTime = runCatching { LocalTime.parse(time?.takeIf { it.isNotBlank() } ?: "00:00") }
        .getOrDefault(LocalTime.MIDNIGHT)
    return LocalDateTime.of(day, localTime).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
}

fun formatTimeInput(ms: Long): String {
    val time = java.time.Instant.ofEpochMilli(ms).atZone(ZoneId.systemDefault()).toLocalTime()
    return "%02d:%02d".format(time.hour, time.minute)
}

fun formatDateInput(ms: Long): String =
    dateKey(java.time.Instant.ofEpochMilli(ms).atZone(ZoneId.systemDefault()).toLocalDate())

fun formatDayLabel(key: String): String {
    val today = todayKey()
    if (key == today) return "Сьогодні"
    if (key == addDaysKey(today, 1)) return "Завтра"
    if (key == addDaysKey(today, -1)) return "Вчора"
    val date = keyToDate(key)
    val sameYear = date.year == LocalDate.now().year
    return if (sameYear) "${date.dayOfMonth} ${MONTHS_SHORT[date.monthValue - 1]}"
    else "${date.dayOfMonth} ${MONTHS_SHORT[date.monthValue - 1]} ${date.year}"
}

fun formatDueLabel(dueDate: String?, dueTime: String?): String {
    if (dueDate.isNullOrBlank()) return ""
    val base = formatDayLabel(dueDate)
    return if (!dueTime.isNullOrBlank()) "$base, $dueTime" else base
}

fun formatLongDate(date: LocalDate = LocalDate.now()): String =
    "${date.dayOfMonth} ${MONTHS_GENITIVE[date.monthValue - 1]} ${date.year}, " +
        WEEKDAYS_FULL[date.dayOfWeek.value - 1]

fun formatMonth(date: LocalDate): String =
    "${MONTHS_NOMINATIVE[date.monthValue - 1]} ${date.year}"

fun formatWeekRange(anchor: LocalDate = LocalDate.now()): String {
    val start = anchor.with(DayOfWeek.MONDAY)
    val end = start.plusDays(6)
    return "${start.dayOfMonth} ${MONTHS_SHORT[start.monthValue - 1]} — " +
        "${end.dayOfMonth} ${MONTHS_SHORT[end.monthValue - 1]} ${end.year}"
}

fun formatDuration(seconds: Long): String {
    val total = max(0, seconds)
    val h = total / 3600
    val m = (total % 3600) / 60
    if (h == 0L && m == 0L) return "$total с"
    if (h == 0L) return "$m хв"
    if (m == 0L) return "$h год"
    return "$h год $m хв"
}

fun formatDurationShort(seconds: Long): String {
    val total = max(0, seconds)
    return "${total / 3600}:${"%02d".format((total % 3600) / 60)}"
}

fun formatClock(seconds: Long): String {
    val total = max(0, seconds)
    return "%02d:%02d:%02d".format(total / 3600, (total % 3600) / 60, total % 60)
}

fun formatClockMs(ms: Long): String = formatClock(max(0, ms) / 1000)

fun formatNumber(value: Double, digits: Int = 2): String {
    val format = NumberFormat.getNumberInstance(UK)
    format.minimumFractionDigits = digits
    format.maximumFractionDigits = digits
    return format.format(if (value.isFinite()) value else 0.0)
}

fun formatMoney(value: Double, currency: String, digits: Int = 2): String =
    "${formatNumber(value, digits)}\u00A0$currency"

fun pluralizeUk(count: Int, forms: List<String>): String {
    val n = abs(count) % 100
    val n1 = n % 10
    if (n in 11..19) return forms[2]
    if (n1 in 2..4) return forms[1]
    if (n1 == 1) return forms[0]
    return forms[2]
}

fun listRate(list: TaskList?, settings: Settings): Double {
    val rate = list?.hourlyRate
    return if (rate != null && !rate.isNaN()) rate else settings.hourlyRate
}

fun isOverdue(task: Task): Boolean =
    !task.dueDate.isNullOrBlank() && !task.completed && task.dueDate!! < todayKey()

fun dueLabelTone(task: Task): String {
    val due = task.dueDate ?: return "normal"
    if (isOverdue(task)) return "overdue"
    if (due == todayKey()) return "today"
    if (due <= addDaysKey(todayKey(), 2)) return "soon"
    return "normal"
}

fun tagColor(tag: String): String {
    var hash = 0
    for (char in tag) hash = (hash * 31 + char.code) and 0x7fffffff
    return TAG_COLORS[hash % TAG_COLORS.size]
}

fun greeting(): String = when (LocalTime.now().hour) {
    in 0..5 -> "Доброї ночі"
    in 6..11 -> "Доброго ранку"
    in 12..17 -> "Доброго дня"
    else -> "Доброго вечора"
}

/* ------------------------------- salary ------------------------------- */

data class DateRange(val start: Long, val end: Long)

fun rangeFor(period: String, anchor: LocalDate = LocalDate.now()): DateRange {
    val zone = ZoneId.systemDefault()
    return when (period) {
        "today" -> DateRange(
            anchor.atStartOfDay(zone).toInstant().toEpochMilli(),
            anchor.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli(),
        )
        "week" -> {
            val start = anchor.with(DayOfWeek.MONDAY)
            DateRange(
                start.atStartOfDay(zone).toInstant().toEpochMilli(),
                start.plusDays(7).atStartOfDay(zone).toInstant().toEpochMilli(),
            )
        }
        "month" -> {
            val start = anchor.withDayOfMonth(1)
            DateRange(
                start.atStartOfDay(zone).toInstant().toEpochMilli(),
                start.plusMonths(1).atStartOfDay(zone).toInstant().toEpochMilli(),
            )
        }
        else -> DateRange(0, System.currentTimeMillis() + 86_400_000L)
    }
}

private fun dayAmounts(
    dayEntries: List<TimeEntry>,
    lists: List<TaskList>,
    settings: Settings,
): Map<String, EntryAmount> {
    val listMap = lists.associateBy { it.id }
    val result = mutableMapOf<String, EntryAmount>()
    var hoursUsed = 0.0
    for (entry in dayEntries.sortedBy { it.startedAt }) {
        val rate = listRate(listMap[entry.listId], settings)
        val hours = entry.seconds / 3600.0
        var regularHours = hours
        var overHours = 0.0
        if (settings.overtimeEnabled && settings.dailyNormHours > 0) {
            val remaining = max(0.0, settings.dailyNormHours - hoursUsed)
            regularHours = min(hours, remaining)
            overHours = max(0.0, hours - regularHours)
            hoursUsed += hours
        }
        result[entry.id] = EntryAmount(
            amount = regularHours * rate + overHours * rate * max(1.0, settings.overtimeMultiplier),
            regularSeconds = (regularHours * 3600).roundToInt().toLong(),
            overtimeSeconds = (overHours * 3600).roundToInt().toLong(),
            rate = rate,
        )
    }
    return result
}

fun calcSalary(
    entries: List<TimeEntry>,
    lists: List<TaskList>,
    settings: Settings,
    range: DateRange,
): SalarySummary {
    val filtered = entries
        .filter { it.startedAt >= range.start && it.startedAt < range.end }
        .sortedBy { it.startedAt }

    val dayMap = linkedMapOf<String, MutableList<TimeEntry>>()
    for (entry in filtered) {
        val key = formatDateInput(entry.startedAt)
        dayMap.getOrPut(key) { mutableListOf() }.add(entry)
    }

    val byDay = mutableListOf<SalaryBucket>()
    val listTotals = mutableMapOf<String, SalaryBucket>()
    var gross = 0.0
    var regularSeconds = 0L
    var overtimeSeconds = 0L

    for ((day, dayEntries) in dayMap.toSortedMap()) {
        val amounts = dayAmounts(dayEntries, lists, settings)
        var dayAmount = 0.0
        var daySeconds = 0L
        var dayOver = 0L
        for (entry in dayEntries) {
            val info = amounts[entry.id] ?: continue
            gross += info.amount
            dayAmount += info.amount
            daySeconds += entry.seconds
            regularSeconds += info.regularSeconds
            overtimeSeconds += info.overtimeSeconds
            dayOver += info.overtimeSeconds
            val existing = listTotals[entry.listId] ?: SalaryBucket(entry.listId, 0, 0.0, 0)
            listTotals[entry.listId] = SalaryBucket(
                key = entry.listId,
                seconds = existing.seconds + entry.seconds,
                amount = existing.amount + info.amount,
                overtimeSeconds = existing.overtimeSeconds + info.overtimeSeconds,
            )
        }
        byDay += SalaryBucket(day, daySeconds, dayAmount, dayOver)
    }

    val taxPercent = settings.taxPercent.coerceIn(0.0, 100.0)
    val taxes = gross * taxPercent / 100.0
    return SalarySummary(
        gross = gross,
        net = gross - taxes,
        taxes = taxes,
        seconds = filtered.sumOf { it.seconds },
        regularSeconds = regularSeconds,
        overtimeSeconds = overtimeSeconds,
        byDay = byDay,
        byList = listTotals.values.sortedByDescending { it.amount },
        entries = filtered,
    )
}

fun amountForEntry(
    entry: TimeEntry,
    entries: List<TimeEntry>,
    lists: List<TaskList>,
    settings: Settings,
): EntryAmount {
    val day = formatDateInput(entry.startedAt)
    val dayEntries = entries.filter { formatDateInput(it.startedAt) == day }
    return dayAmounts(dayEntries, lists, settings)[entry.id]
        ?: EntryAmount(0.0, 0, 0, 0.0)
}

/* ------------------------------ recurring ----------------------------- */

fun advanceRepeatDate(baseKey: String, rule: RepeatRule): String {
    val interval = max(1, rule.interval.coerceAtLeast(1)).toLong()
    val base = keyToDate(baseKey)
    return when (rule.freq) {
        "daily" -> dateKey(base.plusDays(interval))
        "weekdays" -> {
            var cursor = base.plusDays(1)
            while (cursor.dayOfWeek == DayOfWeek.SATURDAY || cursor.dayOfWeek == DayOfWeek.SUNDAY) {
                cursor = cursor.plusDays(1)
            }
            dateKey(cursor)
        }
        "weekly" -> dateKey(base.plusWeeks(interval))
        "monthly" -> dateKey(base.plusMonths(interval))
        else -> dateKey(base.plusYears(interval))
    }
}

fun nextRepeatKey(task: Task): String {
    val today = todayKey()
    var base = task.dueDate ?: today
    if (base < today) base = today
    return advanceRepeatDate(base, task.repeat ?: RepeatRule("daily", 1))
}

fun repeatLabel(rule: RepeatRule?): String {
    if (rule == null) return ""
    val base = when (rule.freq) {
        "daily" -> "Щодня"
        "weekdays" -> "По буднях"
        "weekly" -> "Щотижня"
        "monthly" -> "Щомісяця"
        "yearly" -> "Щороку"
        else -> "Повтор"
    }
    if (rule.freq == "weekdays" || rule.interval <= 1) return base
    return "$base · кожні ${rule.interval}"
}

/* ------------------------------ calendar ------------------------------ */

fun monthMatrix(anchor: LocalDate): List<String> {
    val first = anchor.withDayOfMonth(1)
    val start = first.with(DayOfWeek.MONDAY)
    return (0 until 42).map { dateKey(start.plusDays(it.toLong())) }
}

fun isWeekendKey(key: String): Boolean {
    val day = keyToDate(key).dayOfWeek
    return day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY
}

fun relativeDayLabel(ts: Long): String {
    val date = java.time.Instant.ofEpochMilli(ts).atZone(ZoneId.systemDefault()).toLocalDate()
    val diff = ChronoUnit.DAYS.between(date, LocalDate.now())
    if (diff == 0L) return "Сьогодні"
    if (diff == 1L) return "Вчора"
    return "${date.dayOfMonth} ${MONTHS_SHORT[date.monthValue - 1]}"
}

/* ----------------------------- quick add ------------------------------ */

private val WEEKDAY_WORDS = listOf(
    Triple("щопонеділка|по понеділках", 1, true),
    Triple("щовівторка|по вівторках", 2, true),
    Triple("щосереди|по середах", 3, true),
    Triple("щочетверга|по четвергах", 4, true),
    Triple("щоп['’]?ятниці|по п['’]?ятницях", 5, true),
    Triple("щосуботи|по суботах", 6, true),
    Triple("щонеділі|по неділях", 0, true),
    Triple("понеділок", 1, false),
    Triple("вівторок", 2, false),
    Triple("середу|середа", 3, false),
    Triple("четвер", 4, false),
    Triple("п['’]?ятницю|п['’]?ятниця", 5, false),
    Triple("суботу|субота", 6, false),
    Triple("неділю|неділя", 0, false),
)

private fun nextWeekdayKey(day: Int): String {
    val today = LocalDate.now()
    val target = if (day == 0) DayOfWeek.SUNDAY else DayOfWeek.of(day)
    var delta = (target.value - today.dayOfWeek.value + 7) % 7
    if (delta < 0) delta += 7
    return dateKey(today.plusDays(delta.toLong()))
}

private val DANGLING_PREPOSITION =
    Regex("(?:^|\\s)(?:у|в|о|об|на|до|з|із|зі|за|для|під|над|про|по|та|і|й)$", RegexOption.IGNORE_CASE)

private fun cleanTitle(value: String): String {
    var result = value
        .replace(Regex("\\s+"), " ")
        .replace(Regex("\\s+([,.;:!?])"), "$1")
        .replace(Regex("^[\\s,.;:–—-]+|[\\s,.;:–—-]+$"), "")
        .trim()
    repeat(3) {
        if (DANGLING_PREPOSITION.containsMatchIn(result)) {
            result = result.replace(DANGLING_PREPOSITION, "").trim()
        }
    }
    return result
}

fun parseQuickAdd(raw: String): QuickAddResult {
    var text = " $raw "
    var dueDate: String? = null
    var dueTime: String? = null
    var repeat: RepeatRule? = null
    val tags = mutableListOf<String>()

    text = Regex("(^|\\s)#([\\p{L}\\p{N}_-]+)").replace(text) { match ->
        val tag = match.groupValues[2].trim()
        if (tag.isNotEmpty() && tags.none { it.equals(tag, ignoreCase = true) }) tags.add(tag)
        match.groupValues[1]
    }

    fun take(pattern: String, handler: (MatchResult) -> Unit) {
        val regex = Regex(pattern, setOf(RegexOption.IGNORE_CASE))
        text = regex.replace(text) { match ->
            handler(match)
            " "
        }
    }

    take("(?<![\\p{L}\\p{N}])щодня(?![\\p{L}\\p{N}])") { repeat = RepeatRule("daily") }
    take("(?<![\\p{L}\\p{N}])(?:по буднях|щобудня)(?![\\p{L}\\p{N}])") { repeat = RepeatRule("weekdays") }
    take("(?<![\\p{L}\\p{N}])щотижня(?![\\p{L}\\p{N}])") { repeat = RepeatRule("weekly") }
    take("(?<![\\p{L}\\p{N}])щомісяця(?![\\p{L}\\p{N}])") { repeat = RepeatRule("monthly") }
    take("(?<![\\p{L}\\p{N}])(?:щороку|щорічно)(?![\\p{L}\\p{N}])") { repeat = RepeatRule("yearly") }

    for ((words, day, isRepeat) in WEEKDAY_WORDS) {
        take("(?<![\\p{L}\\p{N}])(?:$words)(?![\\p{L}\\p{N}])") {
            if (dueDate == null) dueDate = nextWeekdayKey(day)
            if (isRepeat) repeat = RepeatRule("weekly")
        }
    }

    take("(?<![\\p{L}\\p{N}])післязавтра(?![\\p{L}\\p{N}])") { dueDate = addDaysKey(todayKey(), 2) }
    take("(?<![\\p{L}\\p{N}])завтра(?![\\p{L}\\p{N}])") { dueDate = addDaysKey(todayKey(), 1) }
    take("(?<![\\p{L}\\p{N}])сьогодні(?![\\p{L}\\p{N}])") { dueDate = todayKey() }

    take("(?<![\\p{L}\\p{N}])через\\s+(\\d+)\\s+(?:день|дні|днів)(?![\\p{L}\\p{N}])") { match ->
        dueDate = addDaysKey(todayKey(), max(1, match.groupValues[1].toIntOrNull() ?: 1).toLong())
    }
    take("(?<![\\p{L}\\p{N}])через\\s+(\\d+)\\s+(?:тиждень|тижні|тижнів)(?![\\p{L}\\p{N}])") { match ->
        dueDate = addDaysKey(todayKey(), max(1, match.groupValues[1].toIntOrNull() ?: 1) * 7L)
    }
    take("(?<![\\p{L}\\p{N}])через\\s+(\\d+)\\s+(?:місяць|місяці|місяців)(?![\\p{L}\\p{N}])") { match ->
        dueDate = dateKey(LocalDate.now().plusMonths(max(1, match.groupValues[1].toIntOrNull() ?: 1).toLong()))
    }

    take("(?<![\\d.])(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{2,4}))?(?![\\d.])") { match ->
        val day = match.groupValues[1].toIntOrNull() ?: 0
        val month = match.groupValues[2].toIntOrNull() ?: 0
        var year = match.groupValues[3].toIntOrNull() ?: LocalDate.now().year
        if (year in 1..99) year += 2000
        if (day in 1..31 && month in 1..12) {
            var candidate = runCatching { LocalDate.of(year, month, day) }.getOrNull()
            if (candidate != null && match.groupValues[3].isEmpty() && candidate < LocalDate.now()) {
                candidate = runCatching { LocalDate.of(year + 1, month, day) }.getOrNull()
            }
            if (candidate != null) dueDate = dateKey(candidate)
        }
    }

    take("(?<![\\p{L}\\p{N}])о\\s*(\\d{1,2})(?::(\\d{2}))?(?![\\p{L}\\p{N}\\d])") { match ->
        val hour = match.groupValues[1].toIntOrNull() ?: -1
        val minute = match.groupValues[2].toIntOrNull() ?: 0
        if (hour in 0..23 && minute in 0..59) {
            dueTime = "%02d:%02d".format(hour, minute)
        }
    }

    take("(?<!\\d)([01]?\\d|2[0-3]):([0-5]\\d)(?!\\d)") { match ->
        val hour = match.groupValues[1].toIntOrNull() ?: 0
        val minute = match.groupValues[2].toIntOrNull() ?: 0
        dueTime = "%02d:%02d".format(hour, minute)
    }

    if ((dueTime != null || repeat != null) && dueDate == null) dueDate = todayKey()

    return QuickAddResult(
        title = cleanTitle(text),
        dueDate = dueDate,
        dueTime = dueTime,
        repeat = repeat,
        tags = tags,
    )
}

/* ---------------------------- notifications --------------------------- */

fun collectNotifications(data: AppData, now: Long = System.currentTimeMillis()): List<AppNotification> {
    val today = todayKey()
    val items = mutableListOf<AppNotification>()
    val seen = mutableSetOf<String>()

    for (task in data.tasks) {
        if (task.completed) continue
        val item: AppNotification?
        if (!task.dueDate.isNullOrBlank() && task.dueDate!! < today) {
            item = AppNotification(
                id = "overdue:${task.id}", kind = "overdue", title = "Прострочена задача",
                body = task.title, tone = "danger", taskId = task.id, date = task.dueDate,
                timestamp = runCatching { keyToDate(task.dueDate!!).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli() }.getOrDefault(now),
            )
        } else if (task.reminderAt != null && task.notifiedAt == null && abs(now - task.reminderAt) < 86_400_000L) {
            item = AppNotification(
                id = "reminder:${task.id}", kind = "reminder", title = "Нагадування",
                body = task.title, tone = "info", taskId = task.id, timestamp = task.reminderAt,
            )
        } else if (task.dueDate == today) {
            item = AppNotification(
                id = "today:${task.id}", kind = "today",
                title = if (!task.dueTime.isNullOrBlank()) "Сьогодні о ${task.dueTime}" else "Задача на сьогодні",
                body = task.title, tone = "warning", taskId = task.id, date = task.dueDate, timestamp = now,
            )
        } else {
            item = null
        }
        if (item != null && seen.add(item.id)) items.add(item)
    }

    for (payday in data.paydays) {
        val daysLeft = ChronoUnit.DAYS.between(keyToDate(today), keyToDate(payday.date)).toInt()
        if (daysLeft < 0 || daysLeft > data.settings.paydayReminderDays) continue
        val amount = payday.amount?.let { " · ${formatMoney(it, data.settings.currency, 0)}" } ?: ""
        val title = when {
            daysLeft <= 0 -> "Сьогодні зарплатний день"
            daysLeft == 1 -> "Зарплата завтра"
            else -> "Зарплата через $daysLeft дн."
        }
        val item = AppNotification(
            id = "payday:${payday.id}:$daysLeft", kind = "payday", title = title,
            body = "${payday.note.ifBlank { "Зарплата" }}$amount", tone = "success",
            paydayId = payday.id, date = payday.date,
            timestamp = runCatching { keyToDate(payday.date).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli() }.getOrDefault(now),
        )
        if (seen.add(item.id)) items.add(item)
    }

    val order = mapOf("overdue" to 0, "reminder" to 1, "today" to 2, "payday" to 3, "sync" to 4)
    return items.sortedWith(compareBy({ order[it.kind] ?: 9 }, { it.timestamp }))
}

fun nextPayday(data: AppData): Payday? {
    val today = todayKey()
    return data.paydays.filter { it.date >= today }.minByOrNull { it.date }
}

fun paydayDaysLeft(payday: Payday): Int =
    ChronoUnit.DAYS.between(keyToDate(todayKey()), keyToDate(payday.date)).toInt()

/* ------------------------------- stats -------------------------------- */

fun computeStats(data: AppData, days: Int): StatsSummary {
    val zone = ZoneId.systemDefault()
    val end = LocalDate.now().plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
    val startDate = LocalDate.now().minusDays((days - 1).toLong())
    val start = startDate.atStartOfDay(zone).toInstant().toEpochMilli()
    val range = DateRange(start, end)
    val salary = calcSalary(data.entries, data.lists, data.settings, range)

    val byDay = linkedMapOf<String, DayStat>()
    for (index in 0 until days) {
        val key = dateKey(startDate.plusDays(index.toLong()))
        byDay[key] = DayStat(key, 0, 0, 0.0)
    }

    for (entry in data.entries) {
        if (entry.startedAt < range.start || entry.startedAt > range.end) continue
        val key = formatDateInput(entry.startedAt)
        byDay[key]?.let { byDay[key] = it.copy(seconds = it.seconds + entry.seconds) }
    }
    for (bucket in salary.byDay) {
        byDay[bucket.key]?.let { byDay[bucket.key] = it.copy(earnings = it.earnings + bucket.amount) }
    }

    val tagCounts = mutableMapOf<String, Int>()
    for (task in data.tasks) {
        val completedAt = task.completedAt ?: continue
        if (!task.completed) continue
        if (completedAt < range.start || completedAt > range.end) continue
        val key = formatDateInput(completedAt)
        byDay[key]?.let { byDay[key] = it.copy(completed = it.completed + 1) }
        for (tag in task.tags) tagCounts[tag] = (tagCounts[tag] ?: 0) + 1
    }

    val allDays = byDay.values.toList()

    var streak = 0
    var cursor = LocalDate.now()
    var guard = 0
    while (guard < 3650) {
        val key = dateKey(cursor)
        val day = byDay[key]
        val hasActivity = day != null && (day.completed > 0 || day.seconds > 0)
        if (hasActivity) {
            streak += 1
        } else if (streak == 0 && key == todayKey()) {
            // Today may still be in progress.
        } else {
            break
        }
        cursor = cursor.minusDays(1)
        guard += 1
        if (cursor.year < 1971) break
    }

    val activity = mutableSetOf<String>()
    for (entry in data.entries) activity.add(formatDateInput(entry.startedAt))
    for (task in data.tasks) task.completedAt?.let { activity.add(formatDateInput(it)) }

    var bestStreak = 0
    var running = 0
    var bestCursor = LocalDate.now()
    for (index in 0 until 365) {
        if (activity.contains(dateKey(bestCursor))) {
            running += 1
            bestStreak = max(bestStreak, running)
        } else {
            running = 0
        }
        bestCursor = bestCursor.minusDays(1)
    }

    val topTags = tagCounts.entries
        .map { TagCount(it.key, it.value) }
        .sortedByDescending { it.count }
        .take(8)

    return StatsSummary(
        days = allDays,
        seconds = salary.seconds,
        completed = allDays.sumOf { it.completed },
        gross = salary.gross,
        net = salary.net,
        streak = streak,
        bestStreak = max(bestStreak, streak),
        activeDays = allDays.count { it.completed > 0 || it.seconds > 0 },
        topTags = topTags,
        salary = salary,
    )
}
