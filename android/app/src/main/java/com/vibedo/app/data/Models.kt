package com.vibedo.app.data

const val SCHEMA_VERSION = 3
const val DEFAULT_SYNC_PORT = 47823

val ACCENTS = listOf(
    "#2383e2" to "Синій",
    "#0f7b6c" to "Бірюзовий",
    "#6940a5" to "Фіолетовий",
    "#ad1a72" to "Ягідний",
    "#d9730d" to "Помаранчевий",
    "#e03e3e" to "Червоний",
)

val LIST_COLORS = listOf(
    "#2383e2", "#0f7b6c", "#6940a5", "#ad1a72",
    "#d9730d", "#e03e3e", "#5b7c0f", "#8a6a00",
)

val TAG_COLORS = LIST_COLORS

/** Stable IDs are important: regenerating them would duplicate categories on sync. */
val MONEY_CATEGORY_PRESETS = listOf(
    MoneyCategory(id = "cat_salary", name = "Зарплата", color = "#0f7b6c", icon = "💼", kind = "income"),
    MoneyCategory(id = "cat_freelance", name = "Фріланс", color = "#2383e2", icon = "💻", kind = "income"),
    MoneyCategory(id = "cat_gift", name = "Подарунок", color = "#6940a5", icon = "🎁", kind = "income"),
    MoneyCategory(id = "cat_other_in", name = "Інший дохід", color = "#8a6a00", icon = "➕", kind = "income"),
    MoneyCategory(id = "cat_home", name = "Житло", color = "#d9730d", icon = "🏠", kind = "expense"),
    MoneyCategory(id = "cat_food", name = "Їжа", color = "#e03e3e", icon = "🛒", kind = "expense"),
    MoneyCategory(id = "cat_transport", name = "Транспорт", color = "#2383e2", icon = "🚌", kind = "expense"),
    MoneyCategory(id = "cat_fun", name = "Розваги", color = "#ad1a72", icon = "🎬", kind = "expense"),
    MoneyCategory(id = "cat_health", name = "Здоров'я", color = "#0f7b6c", icon = "💊", kind = "expense"),
    MoneyCategory(id = "cat_education", name = "Навчання", color = "#6940a5", icon = "📚", kind = "expense"),
    MoneyCategory(id = "cat_subs", name = "Підписки", color = "#8a6a00", icon = "🔁", kind = "expense"),
    MoneyCategory(id = "cat_other_out", name = "Інша витрата", color = "#6f6e69", icon = "➖", kind = "expense"),
)

data class RepeatRule(
    val freq: String,
    val interval: Int = 1,
)

data class Step(
    val id: String,
    val title: String,
    val done: Boolean = false,
)

data class Task(
    val id: String,
    val listId: String,
    val title: String,
    val notes: String = "",
    val completed: Boolean = false,
    val completedAt: Long? = null,
    val important: Boolean = false,
    val myDayDate: String? = null,
    val dueDate: String? = null,
    val dueTime: String? = null,
    val reminderAt: Long? = null,
    val notifiedAt: Long? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val steps: List<Step> = emptyList(),
    val estimateMinutes: Int? = null,
    val tags: List<String> = emptyList(),
    val repeat: RepeatRule? = null,
    val spawnedTaskId: String? = null,
)

data class TaskList(
    val id: String,
    val name: String,
    val color: String,
    val hourlyRate: Double? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val order: Int = 0,
)

data class TimeEntry(
    val id: String,
    val taskId: String?,
    val listId: String,
    val startedAt: Long,
    val endedAt: Long,
    val seconds: Long,
    val note: String = "",
    val manual: Boolean = false,
)

data class ActiveTimer(
    val taskId: String,
    val startedAt: Long,
)

data class Payday(
    val id: String,
    val date: String,
    val note: String = "",
    val amount: Double? = null,
    val transactionId: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

data class MoneyCategory(
    val id: String,
    val name: String,
    val color: String,
    val icon: String = "",
    val kind: String = "both", // income | expense | both
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

data class MoneyTransaction(
    val id: String,
    val kind: String = "expense", // income | expense
    val amount: Double = 0.0,
    val categoryId: String = "",
    val date: String,
    val note: String = "",
    val recurringId: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

data class MoneyRecurring(
    val id: String,
    val kind: String = "expense",
    val amount: Double = 0.0,
    val categoryId: String = "",
    val note: String = "",
    val freq: String = "monthly",
    val interval: Int = 1,
    val nextDate: String,
    val lastRunAt: Long? = null,
    val active: Boolean = true,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

data class MoneyBudget(
    val id: String,
    val categoryId: String = "all",
    val amount: Double = 0.0,
    val period: String = "month", // month | year
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

data class Settings(
    val currency: String = "₴",
    val hourlyRate: Double = 250.0,
    val taxPercent: Double = 19.5,
    val overtimeMultiplier: Double = 1.5,
    val dailyNormHours: Double = 8.0,
    val weeklyNormHours: Double = 40.0,
    val overtimeEnabled: Boolean = true,
    val theme: String = "system",
    val accent: String = "#2383e2",
    val notifications: Boolean = true,
    val compactMode: Boolean = false,
    val firstName: String = "",
    val pomodoroWorkMinutes: Int = 25,
    val pomodoroBreakMinutes: Int = 5,
    val pomodoroAutoBreak: Boolean = true,
    val paydayReminderDays: Int = 3,
    val moneyAutoPayday: Boolean = true,
)

data class AppData(
    val schemaVersion: Int = SCHEMA_VERSION,
    val settings: Settings = Settings(),
    val lists: List<TaskList> = emptyList(),
    val tasks: List<Task> = emptyList(),
    val entries: List<TimeEntry> = emptyList(),
    val paydays: List<Payday> = emptyList(),
    val categories: List<MoneyCategory> = emptyList(),
    val transactions: List<MoneyTransaction> = emptyList(),
    val recurring: List<MoneyRecurring> = emptyList(),
    val budgets: List<MoneyBudget> = emptyList(),
    val activeTimer: ActiveTimer? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

data class SalaryBucket(
    val key: String,
    val seconds: Long,
    val amount: Double,
    val overtimeSeconds: Long,
)

data class EntryAmount(
    val amount: Double,
    val regularSeconds: Long,
    val overtimeSeconds: Long,
    val rate: Double,
)

data class SalarySummary(
    val gross: Double,
    val net: Double,
    val taxes: Double,
    val seconds: Long,
    val regularSeconds: Long,
    val overtimeSeconds: Long,
    val byDay: List<SalaryBucket>,
    val byList: List<SalaryBucket>,
    val entries: List<TimeEntry>,
)

data class DayStat(
    val key: String,
    val seconds: Long,
    val completed: Int,
    val earnings: Double,
)

data class TagCount(val tag: String, val count: Int)

data class StatsSummary(
    val days: List<DayStat>,
    val seconds: Long,
    val completed: Int,
    val gross: Double,
    val net: Double,
    val streak: Int,
    val bestStreak: Int,
    val activeDays: Int,
    val topTags: List<TagCount>,
    val salary: SalarySummary,
)

data class AppNotification(
    val id: String,
    val kind: String,
    val title: String,
    val body: String,
    val tone: String,
    val taskId: String? = null,
    val paydayId: String? = null,
    val date: String? = null,
    val timestamp: Long = 0,
)

data class QuickAddResult(
    val title: String,
    val dueDate: String?,
    val dueTime: String?,
    val repeat: RepeatRule?,
    val tags: List<String>,
)

data class SyncConfig(
    val enabled: Boolean = false,
    val auto: Boolean = true,
    val host: String = "",
    val port: Int = DEFAULT_SYNC_PORT,
    val pin: String = "",
    val token: String = "",
    val lastSyncAt: Long? = null,
)
