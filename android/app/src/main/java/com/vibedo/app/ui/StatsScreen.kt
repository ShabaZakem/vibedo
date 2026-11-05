package com.vibedo.app.ui

import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.TrendingUp
import androidx.compose.material.icons.rounded.Wallet
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vibedo.app.AppViewModel
import com.vibedo.app.data.StatsSummary
import com.vibedo.app.data.TagCount
import com.vibedo.app.data.computeStats
import com.vibedo.app.data.formatDateInput
import com.vibedo.app.data.formatDuration
import com.vibedo.app.data.formatMoney
import com.vibedo.app.data.formatNumber
import com.vibedo.app.data.keyToDate
import com.vibedo.app.data.pluralizeUk
import com.vibedo.app.data.tagColor
import com.vibedo.app.data.todayKey
import java.time.LocalDate
import kotlin.math.max

private val STAT_RANGES = listOf(
    SegmentOption("7", "7 днів"),
    SegmentOption("30", "30 днів"),
    SegmentOption("90", "90 днів"),
)

private data class HeatCell(val key: String, val seconds: Long, val completed: Int, val date: LocalDate)

@Composable
fun StatsScreen(vm: AppViewModel) {
    val p = LocalVibe.current
    val accent = vm.data.settings.accent.toComposeColor()
    var range by remember { mutableStateOf("30") }
    val days = range.toIntOrNull() ?: 30
    val stats: StatsSummary = remember(vm.data.tasks, vm.data.entries, vm.data.lists, vm.data.settings, days) {
        computeStats(vm.data, days)
    }

    val chart = remember(stats.days) {
        stats.days.takeLast(14).map { day ->
            ChartPoint(keyToDate(day.key).dayOfMonth.toString(), day.seconds / 3600.0)
        }
    }

    val heatmap = remember(vm.data.tasks, vm.data.entries) {
        val map = mutableMapOf<String, Pair<Long, Int>>()
        for (entry in vm.data.entries) {
            val key = formatDateInput(entry.startedAt)
            val current = map[key] ?: (0L to 0)
            map[key] = (current.first + entry.seconds) to current.second
        }
        for (task in vm.data.tasks) {
            val completedAt = task.completedAt ?: continue
            val key = formatDateInput(completedAt)
            val current = map[key] ?: (0L to 0)
            map[key] = current.first to (current.second + 1)
        }
        val today = keyToDate(todayKey())
        val cells = (83 downTo 0).map { offset ->
            val date = today.minusDays(offset.toLong())
            val key = date.toString()
            val value = map[key] ?: (0L to 0)
            HeatCell(key, value.first, value.second, date)
        }
        cells.chunked(7)
    }

    val maxTag = max(1, stats.topTags.maxOfOrNull { it.count } ?: 1)
    val avgPerActiveDay = if (stats.activeDays > 0) stats.seconds / stats.activeDays else 0
    val todayCount = vm.data.tasks.count { it.myDayDate == todayKey() && !it.completed }
    val currency = vm.data.settings.currency

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(bottom = 110.dp),
    ) {
        Spacer(Modifier.height(4.dp))
        Segmented(STAT_RANGES, range, { range = it }, modifier = Modifier.fillMaxWidth(), accent = accent)
        Spacer(Modifier.height(12.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatTile(
                "Серія",
                "${stats.streak}",
                pluralizeUk(stats.streak, listOf("день поспіль", "дні поспіль", "днів поспіль")) +
                    " · рекорд ${stats.bestStreak}",
                Icons.Rounded.LocalFireDepartment,
                p.warning,
                Modifier.weight(1f),
            )
            StatTile(
                "Час у фокусі",
                "${formatNumber(stats.seconds / 3600.0, 1)} год",
                "${stats.activeDays} " +
                    pluralizeUk(stats.activeDays, listOf("активний день", "активні дні", "активних днів")),
                Icons.Rounded.Schedule,
                accent,
                Modifier.weight(1f),
            )
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatTile(
                "Виконано",
                "${stats.completed}",
                pluralizeUk(stats.completed, listOf("задача", "задачі", "задач")) +
                    " · у Мому дні $todayCount",
                Icons.Rounded.AutoAwesome,
                p.success,
                Modifier.weight(1f),
            )
            StatTile(
                "На руки",
                formatMoney(stats.net, currency, 0),
                "${formatMoney(stats.gross, currency, 0)} до податків",
                Icons.Rounded.Wallet,
                p.success,
                Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(12.dp))
        VibeCard(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Фокус за 14 днів", color = p.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text("Години роботи з таймера", color = p.text3, fontSize = 11.sp)
                }
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(accent.copy(alpha = 0.12f))
                        .padding(horizontal = 7.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Rounded.TrendingUp, null, tint = accent, modifier = Modifier.size(11.dp))
                    Spacer(Modifier.width(3.dp))
                    Text(
                        "${formatNumber(avgPerActiveDay / 3600.0, 1)} год/день",
                        color = accent,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
            BarChart(
                chart,
                accent,
                height = 120.dp,
                formatValue = { "${formatNumber(it, 1)} год" },
            )
        }

        Spacer(Modifier.height(12.dp))
        VibeCard(Modifier.fillMaxWidth()) {
            Text("АКТИВНІСТЬ", color = p.text3, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp)
            Spacer(Modifier.height(2.dp))
            Text("Останні 12 тижнів", color = p.text3, fontSize = 11.sp)
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                heatmap.forEach { week ->
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        week.forEach { cell ->
                            Box(
                                Modifier
                                    .size(14.dp)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(heatColor(cell, accent, p.surface3)),
                            )
                        }
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Менше", color = p.text3, fontSize = 9.5.sp)
                Spacer(Modifier.width(5.dp))
                (0..4).forEach { level ->
                    Box(
                        Modifier
                            .size(10.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(heatLevelColor(level, accent, p.surface3)),
                    )
                    Spacer(Modifier.width(3.dp))
                }
                Spacer(Modifier.width(2.dp))
                Text("Більше", color = p.text3, fontSize = 9.5.sp)
            }
        }

        Spacer(Modifier.height(12.dp))
        VibeCard(Modifier.fillMaxWidth()) {
            Text("ТЕГИ", color = p.text3, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp)
            Spacer(Modifier.height(2.dp))
            Text("За виконаними задачами", color = p.text3, fontSize = 11.sp)
            Spacer(Modifier.height(10.dp))
            if (stats.topTags.isEmpty()) {
                Text(
                    "Додавайте теги до задач — тут з'явиться розподіл.",
                    color = p.text3, fontSize = 12.sp,
                )
            }
            stats.topTags.forEach { tag -> TagStatRow(tag, maxTag) }
        }

        Spacer(Modifier.height(12.dp))
        VibeCard(Modifier.fillMaxWidth()) {
            Text("ПІДСУМОК", color = p.text3, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp)
            Spacer(Modifier.height(2.dp))
            Text("За обраний період", color = p.text3, fontSize = 11.sp)
            Spacer(Modifier.height(8.dp))
            SummaryRow(Icons.Rounded.CalendarMonth, "Активних днів", "${stats.activeDays} / $days")
            SummaryRow(Icons.Rounded.Schedule, "Середній фокус", formatDuration(avgPerActiveDay))
            SummaryRow(
                Icons.Rounded.TrendingUp,
                "Заробіток за годину",
                if (stats.seconds > 0) formatMoney(stats.gross / (stats.seconds / 3600.0), currency, 0) else "—",
            )
            SummaryRow(Icons.Rounded.Wallet, "Податки", formatMoney(stats.gross - stats.net, currency, 0))
            Spacer(Modifier.height(10.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(p.surface2)
                    .padding(10.dp),
            ) {
                Text(
                    "«Маленькі кроки щодня — це і є великий результат.»",
                    color = p.text2, fontSize = 11.5.sp, textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun TagStatRow(tag: TagCount, maxTag: Int) {
    val p = LocalVibe.current
    val color = tagColor(tag.tag).toComposeColor()
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "#${tag.tag}",
            color = color,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.width(96.dp),
            maxLines = 1,
        )
        Box(Modifier.weight(1f).height(6.dp).clip(CircleShape).background(p.surface3)) {
            Box(
                Modifier
                    .fillMaxWidth((tag.count.toFloat() / maxTag).coerceIn(0.02f, 1f))
                    .height(6.dp)
                    .clip(CircleShape)
                    .background(color),
            )
        }
        Spacer(Modifier.width(8.dp))
        Text("${tag.count}", color = p.text, fontSize = 11.5.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun SummaryRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String,
) {
    val p = LocalVibe.current
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = p.text3, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(7.dp))
        Text(label, color = p.text2, fontSize = 12.5.sp, modifier = Modifier.weight(1f))
        Text(value, color = p.text, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
    }
}

private fun heatLevelColor(level: Int, accent: Color, empty: Color): Color = when (level) {
    1 -> accent.copy(alpha = 0.22f)
    2 -> accent.copy(alpha = 0.42f)
    3 -> accent.copy(alpha = 0.65f)
    4 -> accent
    else -> empty
}

private fun heatColor(cell: HeatCell, accent: Color, empty: Color): Color {
    val level = when {
        cell.seconds >= 4 * 3600 -> 4
        cell.seconds >= 2 * 3600 -> 3
        cell.seconds >= 3600 -> 2
        cell.seconds > 0 || cell.completed > 0 -> 1
        else -> 0
    }
    return heatLevelColor(level, accent, empty)
}
