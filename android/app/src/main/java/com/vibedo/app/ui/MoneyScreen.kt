package com.vibedo.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Paid
import androidx.compose.material.icons.rounded.Receipt
import androidx.compose.material.icons.rounded.Repeat
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vibedo.app.AppViewModel
import com.vibedo.app.data.LIST_COLORS
import com.vibedo.app.data.MONEY_CATEGORY_PRESETS
import com.vibedo.app.data.MoneyBudget
import com.vibedo.app.data.MoneyCategory
import com.vibedo.app.data.MoneyRecurring
import com.vibedo.app.data.MoneyTransaction
import com.vibedo.app.data.categoryLabel
import com.vibedo.app.data.computeBudgetProgress
import com.vibedo.app.data.computeMoneySummary
import com.vibedo.app.data.formatDayLabel
import com.vibedo.app.data.formatMoney
import com.vibedo.app.data.moneyPeriodRange
import com.vibedo.app.data.repeatFreqLabel
import com.vibedo.app.data.todayKey
import com.vibedo.app.data.transactionsToCsv

private val MONEY_TABS = listOf(
    "overview" to "Огляд",
    "transactions" to "Транзакції",
    "recurring" to "Повторювані",
    "budgets" to "Бюджети",
    "categories" to "Категорії",
)

private val MONEY_PERIODS = listOf(
    "week" to "Тиждень",
    "month" to "Місяць",
    "year" to "Рік",
    "all" to "Усе",
)

private val MONEY_FREQS = listOf(
    "daily" to "Щодня",
    "weekly" to "Щотижня",
    "monthly" to "Щомісяця",
    "yearly" to "Щороку",
)

private val moneyDateInput = Regex("^\\d{4}-\\d{2}-\\d{2}$")

private fun parseAmount(value: String): Double? =
    value.replace(',', '.').toDoubleOrNull()?.takeIf { it > 0 && it.isFinite() }

@Composable
private fun MoneyDot(category: MoneyCategory?, modifier: Modifier = Modifier) {
    val p = LocalVibe.current
    Box(
        modifier
            .size(28.dp)
            .clip(RoundedCornerShape(8.dp))
            .background((category?.color ?: "#9b9a97").toComposeColor()),
        contentAlignment = Alignment.Center,
    ) {
        Text(category?.icon?.takeIf { it.isNotBlank() } ?: "•", color = Color.White, fontSize = 13.sp)
    }
}

@Composable
private fun MoneyProgress(percent: Int, over: Boolean) {
    val p = LocalVibe.current
    Box(
        Modifier
            .fillMaxWidth()
            .height(6.dp)
            .clip(RoundedCornerShape(99.dp))
            .background(p.surface3),
    ) {
        Box(
            Modifier
                .fillMaxWidth((percent.coerceAtMost(100) / 100f).coerceAtLeast(0f))
                .height(6.dp)
                .clip(RoundedCornerShape(99.dp))
                .background(if (over) p.danger else p.text),
        )
    }
}

@Composable
private fun MoneyRow(
    category: MoneyCategory?,
    title: String,
    subtitle: String,
    amount: String,
    positive: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val p = LocalVibe.current
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MoneyDot(category)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                title,
                color = p.text,
                fontSize = 13.5.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                subtitle,
                color = p.text3,
                fontSize = 11.5.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.width(8.dp))
        Text(
            amount,
            color = if (positive) p.success else p.text,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
        )
        VibeIconButton(Icons.Rounded.Edit, "Редагувати", onEdit, size = 30.dp, iconSize = 14.dp)
        VibeIconButton(Icons.Rounded.Delete, "Видалити", onDelete, size = 30.dp, iconSize = 14.dp)
    }
}

@Composable
fun MoneyScreen(vm: AppViewModel, onExportCsv: (String) -> Unit) {
    val p = LocalVibe.current
    val data = vm.data
    var period by remember { mutableStateOf("month") }
    var tab by remember { mutableStateOf("overview") }
    var kindFilter by remember { mutableStateOf("all") }
    var categoryFilter by remember { mutableStateOf("") }

    var txDialog by remember { mutableStateOf<MoneyTransaction?>(null) }
    var txNew by remember { mutableStateOf(false) }
    var recDialog by remember { mutableStateOf<MoneyRecurring?>(null) }
    var recNew by remember { mutableStateOf(false) }
    var budgetDialog by remember { mutableStateOf<MoneyBudget?>(null) }
    var budgetNew by remember { mutableStateOf(false) }
    var categoryDialog by remember { mutableStateOf<MoneyCategory?>(null) }
    var categoryNew by remember { mutableStateOf(false) }
    var confirm by remember { mutableStateOf<Triple<String, String, () -> Unit>?>(null) }

    val range = remember(period) { moneyPeriodRange(period) }
    val summary = remember(data.transactions, range) {
        computeMoneySummary(data.transactions, range)
    }
    val budgets = remember(data.budgets, data.transactions, data.categories) {
        computeBudgetProgress(data)
    }
    val filtered = remember(data.transactions, kindFilter, categoryFilter, range) {
        data.transactions
            .filter { kindFilter == "all" || it.kind == kindFilter }
            .filter { categoryFilter.isBlank() || it.categoryId == categoryFilter }
            .filter { it.date >= range.from && it.date <= range.to }
            .sortedWith(compareByDescending<MoneyTransaction> { it.date }.thenByDescending { it.createdAt })
    }
    val grouped = remember(filtered) { filtered.groupBy { it.date }.toList() }
    val maxDay = remember(summary) {
        maxOf(1.0, summary.byDay.maxOfOrNull { maxOf(it.income, it.expense) } ?: 0.0)
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(bottom = 110.dp),
    ) {
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Гроші", color = p.text3, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                Text("Облік доходів і витрат", color = p.text, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                Text(
                    "${summary.count} операцій у періоді · лише на цьому пристрої",
                    color = p.text3,
                    fontSize = 11.5.sp,
                )
            }
            VibeIconButton(Icons.Rounded.Download, "Експорт CSV", {
                onExportCsv(transactionsToCsv(data.transactions, data.categories))
            })
            VibeIconButton(Icons.Rounded.Add, "Додати транзакцію", { txNew = true })
        }

        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatTile(
                "Баланс періоду",
                formatMoney(summary.balance, data.settings.currency),
                "дохід мінус витрати",
                Icons.Rounded.Wallet,
                if (summary.balance < 0) p.danger else p.success,
                Modifier.weight(1f),
            )
            StatTile(
                "Надходження",
                formatMoney(summary.income, data.settings.currency),
                "включно із зарплатою",
                Icons.Rounded.Paid,
                p.success,
                Modifier.weight(1f),
            )
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatTile(
                "Розходи",
                formatMoney(summary.expense, data.settings.currency),
                "${summary.byCategory.size} категорій",
                Icons.Rounded.Receipt,
                p.text2,
                Modifier.weight(1f),
            )
            StatTile(
                "Повторення",
                data.recurring.count { it.active }.toString(),
                "активних правил",
                Icons.Rounded.Repeat,
                p.text2,
                Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(14.dp))
        Segmented(
            options = MONEY_PERIODS.map { SegmentOption(it.first, it.second) },
            selected = period,
            onSelect = { period = it },
        )
        Spacer(Modifier.height(6.dp))
        Segmented(
            options = MONEY_TABS.map { SegmentOption(it.first, it.second) },
            selected = tab,
            onSelect = { tab = it },
        )
        Spacer(Modifier.height(14.dp))

        when (tab) {
            "overview" -> {
                VibeCard {
                    Text("Динаміка", color = p.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text("доходи та витрати за дні", color = p.text3, fontSize = 11.5.sp)
                    Spacer(Modifier.height(12.dp))
                    if (summary.byDay.isEmpty()) {
                        Text("Немає операцій у цьому періоді", color = p.text3, fontSize = 12.5.sp)
                    } else {
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .height(112.dp)
                                .horizontalScroll(rememberScrollState()),
                            verticalAlignment = Alignment.Bottom,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            summary.byDay.forEach { day ->
                                Column(
                                    Modifier
                                        .width(20.dp)
                                        .fillMaxHeight(),
                                    verticalArrangement = Arrangement.Bottom,
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    Row(
                                        Modifier.fillMaxWidth().height(88.dp),
                                        horizontalArrangement = Arrangement.Center,
                                        verticalAlignment = Alignment.Bottom,
                                    ) {
                                        Box(
                                            Modifier
                                                .width(6.dp)
                                                .fillMaxHeight((day.income / maxDay).toFloat().coerceAtLeast(0.02f))
                                                .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                                                .background(p.success),
                                        )
                                        Spacer(Modifier.width(2.dp))
                                        Box(
                                            Modifier
                                                .width(6.dp)
                                                .fillMaxHeight((day.expense / maxDay).toFloat().coerceAtLeast(0.02f))
                                                .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                                                .background(p.danger),
                                        )
                                    }
                                    Text(day.date.takeLast(2), color = p.text3, fontSize = 9.sp)
                                }
                            }
                        }
                        Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            Text("■ Дохід", color = p.success, fontSize = 11.sp)
                            Text("■ Витрата", color = p.danger, fontSize = 11.sp)
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))
                VibeCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Бюджети", color = p.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.weight(1f))
                        VibeIconButton(Icons.Rounded.Add, "Додати бюджет", { budgetNew = true })
                    }
                    if (budgets.isEmpty()) {
                        Text("Ще немає бюджетів", color = p.text3, fontSize = 12.5.sp)
                    } else {
                        budgets.take(4).forEach { item ->
                            Spacer(Modifier.height(10.dp))
                            Text(
                                "${item.label} · ${formatMoney(item.spent, data.settings.currency)} / ${formatMoney(item.budget.amount, data.settings.currency)} · ${item.percent}%",
                                color = if (item.percent >= 100) p.danger else p.text2,
                                fontSize = 12.sp,
                            )
                            Spacer(Modifier.height(5.dp))
                            MoneyProgress(item.percent, item.percent >= 100)
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))
                VibeCard {
                    Text("Останні операції", color = p.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    filtered.take(6).forEach { item ->
                        val category = data.categories.firstOrNull { it.id == item.categoryId }
                        MoneyRow(
                            category = category,
                            title = item.note.ifBlank { categoryLabel(item.categoryId, data.categories) },
                            subtitle = "${if (item.kind == "income") "Дохід" else "Витрата"} · ${categoryLabel(item.categoryId, data.categories)}",
                            amount = "${if (item.kind == "income") "+" else "−"}${formatMoney(item.amount, data.settings.currency)}",
                            positive = item.kind == "income",
                            onEdit = { txDialog = item },
                            onDelete = {
                                confirm = Triple(
                                    "Видалити транзакцію?",
                                    "${categoryLabel(item.categoryId, data.categories)} · ${formatMoney(item.amount, data.settings.currency)}",
                                    { vm.deleteTransaction(item.id) },
                                )
                            },
                        )
                    }
                    if (filtered.isEmpty()) Text("Немає операцій", color = p.text3, fontSize = 12.5.sp)
                }
            }

            "transactions" -> {
                VibeCard {
                    Text("Транзакції", color = p.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    Segmented(
                        options = listOf(
                            SegmentOption("all", "Усі"),
                            SegmentOption("income", "Доходи"),
                            SegmentOption("expense", "Витрати"),
                        ),
                        selected = kindFilter,
                        onSelect = { kindFilter = it },
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(
                        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Chip("Усі категорії", p.text3, onClick = { categoryFilter = "" })
                        data.categories.forEach { category ->
                            Chip(
                                text = "${category.icon} ${category.name}",
                                color = category.color.toComposeColor(),
                                onClick = { categoryFilter = category.id },
                            )
                        }
                    }
                    grouped.forEach { (date, items) ->
                        Spacer(Modifier.height(8.dp))
                        Text(
                            formatDayLabel(date),
                            color = p.text3,
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        items.forEach { item ->
                            val category = data.categories.firstOrNull { it.id == item.categoryId }
                            MoneyRow(
                                category = category,
                                title = item.note.ifBlank { categoryLabel(item.categoryId, data.categories) },
                                subtitle = "${if (item.kind == "income") "Дохід" else "Витрата"} · ${categoryLabel(item.categoryId, data.categories)}",
                                amount = "${if (item.kind == "income") "+" else "−"}${formatMoney(item.amount, data.settings.currency)}",
                                positive = item.kind == "income",
                                onEdit = { txDialog = item },
                                onDelete = { vm.deleteTransaction(item.id) },
                            )
                        }
                    }
                    if (filtered.isEmpty()) Text("Немає транзакцій за ці фільтри", color = p.text3, fontSize = 12.5.sp)
                }
            }

            "recurring" -> {
                VibeCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Повторювані операції", color = p.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            Text("створюються автоматично при запуску", color = p.text3, fontSize = 11.5.sp)
                        }
                        VibeIconButton(Icons.Rounded.Add, "Додати повторення", { recNew = true })
                    }
                    data.recurring.forEach { item ->
                        MoneyRow(
                            category = data.categories.firstOrNull { it.id == item.categoryId },
                            title = item.note.ifBlank { categoryLabel(item.categoryId, data.categories) },
                            subtitle = "${repeatFreqLabel(item.freq)} · наступна ${formatDayLabel(item.nextDate)}" +
                                (if (item.active) "" else " · вимкнено"),
                            amount = "${if (item.kind == "income") "+" else "−"}${formatMoney(item.amount, data.settings.currency)}",
                            positive = item.kind == "income",
                            onEdit = { recDialog = item },
                            onDelete = {
                                confirm = Triple(
                                    "Видалити повторення?",
                                    item.note,
                                    { vm.deleteRecurring(item.id) },
                                )
                            },
                        )
                        Text(
                            if (item.active) "Активне" else "Вимкнено",
                            color = if (item.active) p.success else p.text3,
                            fontSize = 10.5.sp,
                            modifier = Modifier
                                .clickable { vm.updateRecurring(item.id, active = !item.active) }
                                .padding(start = 38.dp, bottom = 4.dp),
                        )
                    }
                    if (data.recurring.isEmpty()) Text("Немає повторюваних операцій", color = p.text3, fontSize = 12.5.sp)
                }
            }

            "budgets" -> {
                VibeCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Бюджети та ліміти", color = p.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            Text("витрати поточного місяця або року", color = p.text3, fontSize = 11.5.sp)
                        }
                        VibeIconButton(Icons.Rounded.Add, "Додати бюджет", { budgetNew = true })
                    }
                    budgets.forEach { item ->
                        Spacer(Modifier.height(12.dp))
                        Text(
                            "${item.label} · ${if (item.budget.period == "year") "рік" else "місяць"}",
                            color = p.text,
                            fontSize = 12.5.sp,
                        )
                        Text(
                            "${formatMoney(item.spent, data.settings.currency)} / ${formatMoney(item.budget.amount, data.settings.currency)} · ${item.percent}%",
                            color = if (item.percent >= 100) p.danger else p.text2,
                            fontSize = 12.sp,
                        )
                        Spacer(Modifier.height(5.dp))
                        MoneyProgress(item.percent, item.percent >= 100)
                        Row {
                            Spacer(Modifier.weight(1f))
                            VibeIconButton(Icons.Rounded.Edit, "Редагувати", { budgetDialog = item.budget })
                            VibeIconButton(Icons.Rounded.Delete, "Видалити", { vm.deleteBudget(item.budget.id) })
                        }
                    }
                    if (budgets.isEmpty()) Text("Ще немає бюджетів", color = p.text3, fontSize = 12.5.sp)
                }
            }

            "categories" -> {
                VibeCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Категорії", color = p.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            Text("готові та власні категорії", color = p.text3, fontSize = 11.5.sp)
                        }
                        VibeIconButton(Icons.Rounded.Add, "Додати категорію", { categoryNew = true })
                    }
                    data.categories.forEach { category ->
                        MoneyRow(
                            category = category,
                            title = category.name,
                            subtitle = when (category.kind) {
                                "income" -> "Дохід"
                                "expense" -> "Витрата"
                                else -> "Обидва"
                            },
                            amount = "",
                            positive = false,
                            onEdit = { categoryDialog = category },
                            onDelete = {
                                confirm = Triple(
                                    "Видалити категорію?",
                                    "Транзакції залишаться, але стануть «Без категорії».",
                                    { vm.deleteCategory(category.id) },
                                )
                            },
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        Text(
            "Зарплатні дні з календаря автоматично потрапляють у доходи, якщо це ввімкнено в налаштуваннях.",
            color = p.text3,
            fontSize = 11.5.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
        )
    }

    if (txNew || txDialog != null) {
        TransactionDialog(
            item = txDialog,
            categories = data.categories,
            defaultKind = kindFilter,
            onDismiss = { txNew = false; txDialog = null },
            onSave = { kind, amount, categoryId, date, note ->
                if (txDialog != null) {
                    vm.updateTransaction(txDialog!!.id, kind = kind, amount = amount, categoryId = categoryId, date = date, note = note)
                    vm.showToast("Транзакцію оновлено")
                } else {
                    vm.addTransaction(kind, amount, categoryId, date, note)
                    vm.showToast("Транзакцію додано")
                }
                txNew = false
                txDialog = null
            },
        )
    }

    if (recNew || recDialog != null) {
        RecurringDialog(
            item = recDialog,
            categories = data.categories,
            onDismiss = { recNew = false; recDialog = null },
            onSave = { kind, amount, categoryId, note, freq, interval, nextDate ->
                if (recDialog != null) {
                    vm.updateRecurring(
                        recDialog!!.id,
                        kind = kind,
                        amount = amount,
                        categoryId = categoryId,
                        note = note,
                        freq = freq,
                        interval = interval,
                        nextDate = nextDate,
                    )
                    vm.showToast("Повторення оновлено")
                } else {
                    vm.addRecurring(kind, amount, categoryId, note, freq, interval, nextDate)
                    vm.showToast("Повторення додано")
                }
                recNew = false
                recDialog = null
            },
        )
    }

    if (budgetNew || budgetDialog != null) {
        BudgetDialog(
            item = budgetDialog,
            categories = data.categories,
            onDismiss = { budgetNew = false; budgetDialog = null },
            onSave = { categoryId, amount, periodValue ->
                if (budgetDialog != null) {
                    vm.updateBudget(budgetDialog!!.id, categoryId = categoryId, amount = amount, period = periodValue)
                    vm.showToast("Бюджет оновлено")
                } else {
                    vm.addBudget(categoryId, amount, periodValue)
                    vm.showToast("Бюджет додано")
                }
                budgetNew = false
                budgetDialog = null
            },
        )
    }

    if (categoryNew || categoryDialog != null) {
        CategoryDialog(
            item = categoryDialog,
            onDismiss = { categoryNew = false; categoryDialog = null },
            onSave = { name, icon, color, kind ->
                if (categoryDialog != null) {
                    vm.updateCategory(categoryDialog!!.id, name = name, icon = icon, color = color, kind = kind)
                    vm.showToast("Категорію оновлено")
                } else {
                    vm.addCategory(name, color, icon, kind)
                    vm.showToast("Категорію додано")
                }
                categoryNew = false
                categoryDialog = null
            },
        )
    }

    ConfirmDialog(
        open = confirm != null,
        title = confirm?.first ?: "",
        body = confirm?.second ?: "",
        onConfirm = { confirm?.third?.invoke(); confirm = null },
        onDismiss = { confirm = null },
    )
}

@Composable
private fun KindSelector(value: String, onChange: (String) -> Unit) {
    Segmented(
        options = listOf(SegmentOption("expense", "Витрата"), SegmentOption("income", "Дохід")),
        selected = if (value == "income") "income" else "expense",
        onSelect = onChange,
    )
}

@Composable
private fun CategorySelector(
    categories: List<MoneyCategory>,
    kind: String,
    selected: String,
    onSelect: (String) -> Unit,
) {
    val p = LocalVibe.current
    val visible = categories.filter { it.kind == "both" || it.kind == kind }
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Chip("Без категорії", p.text3, onClick = { onSelect("") })
        visible.forEach { category ->
            Chip(
                text = "${category.icon} ${category.name}",
                color = category.color.toComposeColor(),
                onClick = { onSelect(category.id) },
            )
        }
    }
}

@Composable
private fun TransactionDialog(
    item: MoneyTransaction?,
    categories: List<MoneyCategory>,
    defaultKind: String,
    onDismiss: () -> Unit,
    onSave: (String, Double, String, String, String) -> Unit,
) {
    var kind by remember(item?.id) { mutableStateOf(item?.kind ?: if (defaultKind == "income") "income" else "expense") }
    var amount by remember(item?.id) { mutableStateOf(item?.amount?.toString() ?: "") }
    var date by remember(item?.id) { mutableStateOf(item?.date ?: todayKey()) }
    var categoryId by remember(item?.id) { mutableStateOf(item?.categoryId ?: "") }
    var note by remember(item?.id) { mutableStateOf(item?.note ?: "") }
    val parsed = parseAmount(amount)

    VibeDialog(onDismiss = onDismiss, title = if (item == null) "Нова транзакція" else "Редагувати транзакцію") {
        Text("Тип", color = LocalVibe.current.text2, fontSize = 12.sp)
        Spacer(Modifier.height(5.dp))
        KindSelector(kind) { value -> kind = value; categoryId = "" }
        Spacer(Modifier.height(10.dp))
        VibeTextField(amount, { amount = it }, "Сума")
        Spacer(Modifier.height(8.dp))
        VibeTextField(date, { date = it }, "Дата (YYYY-MM-DD)")
        Spacer(Modifier.height(10.dp))
        Text("Категорія", color = LocalVibe.current.text2, fontSize = 12.sp)
        Spacer(Modifier.height(5.dp))
        CategorySelector(categories, kind, categoryId) { categoryId = it }
        Spacer(Modifier.height(8.dp))
        VibeTextField(note, { note = it }, "Нотатка")
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Spacer(Modifier.weight(1f))
            VDButton("Скасувати", onDismiss, filled = false)
            VDButton(if (item == null) "Додати" else "Зберегти", {
                val value = parsed ?: return@VDButton
                onSave(kind, value, categoryId, date, note)
            }, enabled = parsed != null && moneyDateInput.matches(date))
        }
    }
}

@Composable
private fun RecurringDialog(
    item: MoneyRecurring?,
    categories: List<MoneyCategory>,
    onDismiss: () -> Unit,
    onSave: (String, Double, String, String, String, Int, String) -> Unit,
) {
    var kind by remember(item?.id) { mutableStateOf(item?.kind ?: "expense") }
    var amount by remember(item?.id) { mutableStateOf(item?.amount?.toString() ?: "") }
    var categoryId by remember(item?.id) { mutableStateOf(item?.categoryId ?: "") }
    var note by remember(item?.id) { mutableStateOf(item?.note ?: "") }
    var freq by remember(item?.id) { mutableStateOf(item?.freq ?: "monthly") }
    var interval by remember(item?.id) { mutableStateOf((item?.interval ?: 1).toString()) }
    var nextDate by remember(item?.id) { mutableStateOf(item?.nextDate ?: todayKey()) }
    val parsed = parseAmount(amount)

    VibeDialog(onDismiss = onDismiss, title = if (item == null) "Нове повторення" else "Редагувати повторення") {
        KindSelector(kind) { value -> kind = value; categoryId = "" }
        Spacer(Modifier.height(10.dp))
        VibeTextField(amount, { amount = it }, "Сума")
        Spacer(Modifier.height(8.dp))
        VibeTextField(nextDate, { nextDate = it }, "Наступна дата (YYYY-MM-DD)")
        Spacer(Modifier.height(10.dp))
        Segmented(
            options = MONEY_FREQS.map { SegmentOption(it.first, it.second) },
            selected = freq,
            onSelect = { freq = it },
        )
        Spacer(Modifier.height(8.dp))
        VibeTextField(interval, { interval = it }, "Кожні N періодів")
        Spacer(Modifier.height(10.dp))
        CategorySelector(categories, kind, categoryId) { categoryId = it }
        Spacer(Modifier.height(8.dp))
        VibeTextField(note, { note = it }, "Нотатка")
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Spacer(Modifier.weight(1f))
            VDButton("Скасувати", onDismiss, filled = false)
            VDButton(if (item == null) "Додати" else "Зберегти", {
                val value = parsed ?: return@VDButton
                onSave(kind, value, categoryId, note, freq, interval.toIntOrNull() ?: 1, nextDate)
            }, enabled = parsed != null && moneyDateInput.matches(nextDate))
        }
    }
}

@Composable
private fun BudgetDialog(
    item: MoneyBudget?,
    categories: List<MoneyCategory>,
    onDismiss: () -> Unit,
    onSave: (String, Double, String) -> Unit,
) {
    var categoryId by remember(item?.id) { mutableStateOf(item?.categoryId ?: "all") }
    var amount by remember(item?.id) { mutableStateOf(item?.amount?.toString() ?: "") }
    var period by remember(item?.id) { mutableStateOf(item?.period ?: "month") }
    val parsed = parseAmount(amount)
    val p = LocalVibe.current

    VibeDialog(onDismiss = onDismiss, title = if (item == null) "Новий бюджет" else "Редагувати бюджет") {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Chip("Усі категорії", p.text3, onClick = { categoryId = "all" })
            categories
                .filter { it.kind == "expense" || it.kind == "both" }
                .forEach { category ->
                    Chip(
                        text = "${category.icon} ${category.name}",
                        color = category.color.toComposeColor(),
                        onClick = { categoryId = category.id },
                    )
                }
        }
        Spacer(Modifier.height(10.dp))
        VibeTextField(amount, { amount = it }, "Ліміт")
        Spacer(Modifier.height(8.dp))
        Segmented(
            options = listOf(SegmentOption("month", "Місяць"), SegmentOption("year", "Рік")),
            selected = period,
            onSelect = { period = it },
        )
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Spacer(Modifier.weight(1f))
            VDButton("Скасувати", onDismiss, filled = false)
            VDButton(if (item == null) "Додати" else "Зберегти", {
                val value = parsed ?: return@VDButton
                onSave(categoryId, value, period)
            }, enabled = parsed != null)
        }
    }
}

@Composable
private fun CategoryDialog(
    item: MoneyCategory?,
    onDismiss: () -> Unit,
    onSave: (String, String, String, String) -> Unit,
) {
    var name by remember(item?.id) { mutableStateOf(item?.name ?: "") }
    var icon by remember(item?.id) { mutableStateOf(item?.icon ?: "") }
    var color by remember(item?.id) { mutableStateOf(item?.color ?: MONEY_CATEGORY_PRESETS.first().color) }
    var kind by remember(item?.id) { mutableStateOf(item?.kind ?: "expense") }
    val p = LocalVibe.current
    val colors = remember { (MONEY_CATEGORY_PRESETS.map { it.color } + LIST_COLORS).distinct() }

    VibeDialog(onDismiss = onDismiss, title = if (item == null) "Нова категорія" else "Редагувати категорію") {
        VibeTextField(name, { name = it }, "Назва")
        Spacer(Modifier.height(8.dp))
        VibeTextField(icon, { icon = it }, "Іконка (emoji)")
        Spacer(Modifier.height(10.dp))
        Segmented(
            options = listOf(
                SegmentOption("expense", "Витрата"),
                SegmentOption("income", "Дохід"),
                SegmentOption("both", "Обидва"),
            ),
            selected = kind,
            onSelect = { kind = it },
        )
        Spacer(Modifier.height(12.dp))
        Text("Колір", color = p.text2, fontSize = 12.sp)
        Spacer(Modifier.height(6.dp))
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            colors.forEach { value ->
                Box(
                    Modifier
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(value.toComposeColor())
                        .then(
                            if (value == color) Modifier.border(2.dp, p.text, CircleShape)
                            else Modifier,
                        )
                        .clickable { color = value },
                )
            }
        }
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Spacer(Modifier.weight(1f))
            VDButton("Скасувати", onDismiss, filled = false)
            VDButton(if (item == null) "Додати" else "Зберегти", {
                if (name.isBlank()) return@VDButton
                onSave(name.trim(), icon, color, kind)
            }, enabled = name.isNotBlank())
        }
    }
}
