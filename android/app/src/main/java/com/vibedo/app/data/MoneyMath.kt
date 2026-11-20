package com.vibedo.app.data

import java.util.Locale
import kotlin.math.roundToInt

/** Shared money calculations, mirroring src/lib/money.ts from the desktop app. */

data class MoneyDateRange(val from: String, val to: String)

enum class MoneyPeriod(val key: String, val label: String) {
    WEEK("week", "Тиждень"),
    MONTH("month", "Місяць"),
    YEAR("year", "Рік"),
    ALL("all", "Усе");

    companion object {
        fun from(key: String): MoneyPeriod = entries.firstOrNull { it.key == key } ?: MONTH
    }
}

fun moneyPeriodRange(period: String, today: String = todayKey()): MoneyDateRange = when (period) {
    "all" -> MoneyDateRange("0000-01-01", "9999-12-31")
    "month" -> MoneyDateRange("${today.take(7)}-01", today)
    "year" -> MoneyDateRange("${today.take(4)}-01-01", today)
    else -> {
        val day = keyToDate(today).dayOfWeek.value // 1 = Monday
        MoneyDateRange(addDaysKey(today, -(day - 1).toLong()), today)
    }
}

fun inDateRange(date: String, range: MoneyDateRange): Boolean =
    date >= range.from && date <= range.to

data class MoneyCategoryTotal(
    val categoryId: String,
    val income: Double = 0.0,
    val expense: Double = 0.0,
)

data class MoneyDayTotal(
    val date: String,
    val income: Double = 0.0,
    val expense: Double = 0.0,
)

data class MoneySummary(
    val income: Double = 0.0,
    val expense: Double = 0.0,
    val balance: Double = 0.0,
    val count: Int = 0,
    val byCategory: List<MoneyCategoryTotal> = emptyList(),
    val byDay: List<MoneyDayTotal> = emptyList(),
)

private fun roundMoney(value: Double): Double = (value * 100).roundToInt() / 100.0

fun computeMoneySummary(transactions: List<MoneyTransaction>, range: MoneyDateRange): MoneySummary {
    var income = 0.0
    var expense = 0.0
    var count = 0
    val categoryMap = LinkedHashMap<String, MoneyCategoryTotal>()
    val dayMap = LinkedHashMap<String, MoneyDayTotal>()

    for (item in transactions) {
        if (!inDateRange(item.date, range)) continue
        count += 1
        val amount = roundMoney(item.amount)
        if (item.kind == "income") income += amount else expense += amount

        val categoryKey = item.categoryId.ifBlank { "" }
        val category = categoryMap[categoryKey] ?: MoneyCategoryTotal(categoryKey)
        categoryMap[categoryKey] = if (item.kind == "income") {
            category.copy(income = category.income + amount)
        } else {
            category.copy(expense = category.expense + amount)
        }

        val day = dayMap[item.date] ?: MoneyDayTotal(item.date)
        dayMap[item.date] = if (item.kind == "income") {
            day.copy(income = day.income + amount)
        } else {
            day.copy(expense = day.expense + amount)
        }
    }

    return MoneySummary(
        income = roundMoney(income),
        expense = roundMoney(expense),
        balance = roundMoney(income - expense),
        count = count,
        byCategory = categoryMap.values.toList(),
        byDay = dayMap.values.sortedBy { it.date },
    )
}

data class BudgetProgress(
    val budget: MoneyBudget,
    val spent: Double,
    val percent: Int,
    val label: String,
)

fun computeBudgetProgress(data: AppData, today: String = todayKey()): List<BudgetProgress> =
    data.budgets.map { budget ->
        val range = moneyPeriodRange(
            if (budget.period == "year") "year" else "month",
            today,
        )
        val spent = data.transactions
            .filter { it.kind == "expense" && it.categoryId == budget.categoryId && inDateRange(it.date, range) }
            .sumOf { it.amount }
        val category = data.categories.firstOrNull { it.id == budget.categoryId }
        BudgetProgress(
            budget = budget,
            spent = roundMoney(spent),
            percent = if (budget.amount > 0) ((spent / budget.amount) * 100).roundToInt() else 0,
            label = if (budget.categoryId == "all") "Усі категорії" else category?.name ?: "Без категорії",
        )
    }

fun categoryLabel(id: String, categories: List<MoneyCategory>): String {
    if (id.isBlank()) return "Без категорії"
    return categories.firstOrNull { it.id == id }?.name ?: "Без категорії"
}

fun repeatFreqLabel(freq: String): String = when (freq) {
    "daily" -> "Щодня"
    "weekly" -> "Щотижня"
    "monthly" -> "Щомісяця"
    "yearly" -> "Щороку"
    "weekdays" -> "По буднях"
    else -> freq
}

fun transactionsToCsv(transactions: List<MoneyTransaction>, categories: List<MoneyCategory>): String {
    fun escape(value: Any): String = "\"${value.toString().replace("\"", "\"\"")}\""
    val rows = mutableListOf(listOf("Дата", "Тип", "Сума", "Категорія", "Нотатка"))
    for (item in transactions.sortedBy { it.date }) {
        rows.add(
            listOf(
                item.date,
                if (item.kind == "income") "Дохід" else "Витрата",
                String.format(Locale.UK, "%.2f", item.amount),
                categoryLabel(item.categoryId, categories),
                item.note,
            ),
        )
    }
    return "\uFEFF" + rows.joinToString("\r\n") { row -> row.joinToString(";") { escape(it) } }
}
