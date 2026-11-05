package com.vibedo.app.ui

import android.content.Intent
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Payments
import androidx.compose.material.icons.rounded.Receipt
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vibedo.app.AppViewModel
import com.vibedo.app.data.calcSalary
import com.vibedo.app.data.formatDateInput
import com.vibedo.app.data.formatDuration
import com.vibedo.app.data.formatMoney
import com.vibedo.app.data.formatNumber
import com.vibedo.app.data.keyToDate
import com.vibedo.app.data.pluralizeUk
import com.vibedo.app.data.rangeFor

private val SALARY_PERIODS = listOf(
    SegmentOption("today", "Сьогодні"),
    SegmentOption("week", "Тиждень"),
    SegmentOption("month", "Місяць"),
    SegmentOption("all", "Увесь час"),
)

@Composable
fun SalaryScreen(vm: AppViewModel) {
    val p = LocalVibe.current
    val accent = vm.data.settings.accent.toComposeColor()
    val context = LocalContext.current
    var period by remember { mutableStateOf("month") }

    val salary = calcSalary(vm.data.entries, vm.data.lists, vm.data.settings, rangeFor(period))
    val currency = vm.data.settings.currency
    val chartPoints = if (salary.byDay.isEmpty()) {
        listOf(ChartPoint("—", 0.0))
    } else {
        salary.byDay.map { bucket ->
            ChartPoint(keyToDate(bucket.key).dayOfMonth.toString(), bucket.amount)
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(bottom = 110.dp),
    ) {
        Spacer(Modifier.height(4.dp))
        Segmented(SALARY_PERIODS, period, { period = it }, modifier = Modifier.fillMaxWidth(), accent = accent)
        Spacer(Modifier.height(12.dp))

        VibeCard(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(34.dp).clip(CircleShape).background(p.successSoft),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Rounded.Wallet, null, tint = p.success, modifier = Modifier.size(18.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text("На руки", color = p.text3, fontSize = 11.sp)
                    Text(
                        formatMoney(salary.net, currency, 2),
                        color = p.success, fontSize = 26.sp, fontWeight = FontWeight.Bold,
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                SalaryTile("Брутто", formatMoney(salary.gross, currency, 0),
                    Icons.Rounded.TrendingUp, Modifier.weight(1f))
                SalaryTile("Податки", formatMoney(salary.taxes, currency, 0),
                    Icons.Rounded.Receipt, Modifier.weight(1f), p.warning)
                SalaryTile("Годин", formatDuration(salary.seconds),
                    Icons.Rounded.Wallet, Modifier.weight(1f), p.text2)
            }
            Spacer(Modifier.height(12.dp))
            DividerLine()
            Spacer(Modifier.height(8.dp))
            ValueRow("Ставка", "${formatMoney(vm.data.settings.hourlyRate, currency, 0)}/год")
            ValueRow("Податок", "${formatNumber(vm.data.settings.taxPercent, 1)}%")
            ValueRow(
                "Понаднормові",
                if (vm.data.settings.overtimeEnabled)
                    "${formatDuration(salary.overtimeSeconds)} × ${formatNumber(vm.data.settings.overtimeMultiplier, 1)}"
                else "Вимкнено",
                valueColor = if (salary.overtimeSeconds > 0) p.warning else p.text,
            )
            ValueRow(
                "Записів",
                "${salary.entries.size} " +
                    pluralizeUk(salary.entries.size, listOf("запис", "записи", "записів")),
            )
        }

        Spacer(Modifier.height(12.dp))
        VibeCard(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("ДИНАМІКА", color = p.text3, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.6.sp, modifier = Modifier.weight(1f))
                Text(formatMoney(salary.gross, currency, 0), color = p.text2, fontSize = 11.sp)
            }
            Spacer(Modifier.height(12.dp))
            BarChart(chartPoints, accent, height = 120.dp, formatValue = { formatNumber(it, 0) })
        }

        Spacer(Modifier.height(12.dp))
        VibeCard(Modifier.fillMaxWidth()) {
            Text("ЗА СПИСКАМИ", color = p.text3, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.6.sp)
            Spacer(Modifier.height(8.dp))
            if (salary.byList.isEmpty()) {
                Text("Ще немає записів часу за цей період", color = p.text3, fontSize = 12.sp)
            }
            salary.byList.forEach { bucket ->
                val list = vm.data.lists.find { it.id == bucket.key }
                val share = if (salary.gross > 0) (bucket.amount / salary.gross).toFloat() else 0f
                Column(Modifier.padding(vertical = 7.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier.size(8.dp).clip(CircleShape)
                                .background(list?.color?.toComposeColor(p.text3) ?: p.text3),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(list?.name ?: "Без списку", color = p.text, fontSize = 13.sp,
                            modifier = Modifier.weight(1f))
                        Text(formatDuration(bucket.seconds), color = p.text3, fontSize = 10.5.sp)
                        Spacer(Modifier.width(8.dp))
                        Text(formatMoney(bucket.amount, currency, 0), color = p.text, fontSize = 12.5.sp,
                            fontWeight = FontWeight.Medium)
                    }
                    Spacer(Modifier.height(4.dp))
                    Box(
                        Modifier.fillMaxWidth().height(4.dp).clip(CircleShape).background(p.surface3),
                    ) {
                        Box(
                            Modifier
                                .fillMaxWidth(share.coerceIn(0f, 1f))
                                .height(4.dp)
                                .clip(CircleShape)
                                .background(list?.color?.toComposeColor(accent) ?: accent),
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        VibeCard(Modifier.fillMaxWidth()) {
            Text("ЗАПИСИ", color = p.text3, fontSize = 10.5.sp, fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.6.sp)
            Spacer(Modifier.height(6.dp))
            salary.entries.sortedByDescending { it.startedAt }.take(25).forEach { entry ->
                val task = vm.data.tasks.find { it.id == entry.taskId }
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(formatDateInput(entry.startedAt), color = p.text3, fontSize = 10.5.sp,
                        modifier = Modifier.width(74.dp))
                    Text(
                        task?.title ?: entry.note.ifBlank { "Запис часу" },
                        color = p.text2, fontSize = 11.5.sp, modifier = Modifier.weight(1f),
                        maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    )
                    Text(formatDuration(entry.seconds), color = p.text3, fontSize = 10.5.sp)
                }
            }
            if (salary.entries.isEmpty()) {
                Text("Немає записів", color = p.text3, fontSize = 12.sp)
            }
        }

        Spacer(Modifier.height(12.dp))
        VDButton(
            "Експорт CSV",
            {
                val csv = buildCsv(vm)
                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/csv"
                    putExtra(Intent.EXTRA_SUBJECT, "VibeDo · записи часу")
                    putExtra(Intent.EXTRA_TEXT, csv)
                }
                context.startActivity(Intent.createChooser(intent, "Поділитися CSV"))
            },
            accent = accent,
            filled = false,
            icon = Icons.Rounded.Download,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

private fun buildCsv(vm: AppViewModel): String {
    val builder = StringBuilder("Дата;Початок;Задача;Список;Тривалість (год);Сума\n")
    for (entry in vm.data.entries.sortedBy { it.startedAt }) {
        val task = vm.data.tasks.find { it.id == entry.taskId }?.title ?: ""
        val list = vm.data.lists.find { it.id == entry.listId }?.name ?: ""
        val amount = com.vibedo.app.data.amountForEntry(
            entry, vm.data.entries, vm.data.lists, vm.data.settings,
        ).amount
        builder.append(formatDateInput(entry.startedAt)).append(';')
            .append(com.vibedo.app.data.formatTimeInput(entry.startedAt)).append(';')
            .append(task.replace(';', ',')).append(';')
            .append(list.replace(';', ',')).append(';')
            .append("%.2f".format(entry.seconds / 3600.0)).append(';')
            .append("%.2f".format(amount)).append('\n')
    }
    return builder.toString()
}

@Composable
private fun SalaryTile(
    label: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    tint: Color = LocalVibe.current.text2,
) {
    val p = LocalVibe.current
    Column(
        modifier = modifier
            .clip(androidx.compose.foundation.shape.RoundedCornerShape(9.dp))
            .background(p.surface2)
            .padding(10.dp),
    ) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(15.dp))
        Spacer(Modifier.height(6.dp))
        Text(value, color = p.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        Text(label, color = p.text3, fontSize = 10.sp, maxLines = 1)
    }
}
