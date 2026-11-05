package com.vibedo.app.notifications

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.vibedo.app.MainActivity
import com.vibedo.app.R
import com.vibedo.app.data.AppData
import com.vibedo.app.data.combineDateTime
import com.vibedo.app.data.keyToDate
import com.vibedo.app.data.todayKey
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

object Notifications {
    const val CHANNEL_ID = "vibedo-reminders"
    private const val REQUEST_BASE = 1000

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Нагадування VibeDo",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = "Задачі, зарплатні дні та Pomodoro"
        }
        manager.createNotificationChannel(channel)
    }

    fun canPost(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    }

    fun showNow(context: Context, title: String, body: String, taskId: String? = null, paydayId: String? = null) {
        if (!canPost(context)) return
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            taskId?.let { putExtra("taskId", it) }
            paydayId?.let { putExtra("paydayId", it) }
        }
        val pending = PendingIntent.getActivity(
            context,
            (System.currentTimeMillis() % Int.MAX_VALUE).toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_vibedo)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
    }

    fun scheduleAll(context: Context, data: AppData) {
        if (!data.settings.notifications) {
            cancelAll(context)
            return
        }
        createChannel(context)
        val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val prefs = context.getSharedPreferences("vibedo", Context.MODE_PRIVATE)
        prefs.getStringSet("alarm_ids", emptySet())?.forEach { raw ->
            raw.toIntOrNull()?.let { id ->
                manager.cancel(pending(context, id, null))
            }
        }
        val ids = mutableSetOf<String>()
        val now = System.currentTimeMillis()
        val zone = ZoneId.systemDefault()
        var requestCode = REQUEST_BASE

        fun schedule(at: Long, title: String, body: String, taskId: String? = null, paydayId: String? = null) {
            if (at <= now + 5_000) return
            val intent = Intent(context, ReminderReceiver::class.java).apply {
                putExtra("title", title)
                putExtra("body", body)
                taskId?.let { putExtra("taskId", it) }
                paydayId?.let { putExtra("paydayId", it) }
            }
            val alarmIntent = PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                manager.canScheduleExactAlarms()
            runCatching {
                if (canExact) {
                    manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarmIntent)
                } else {
                    manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, alarmIntent)
                }
            }
            ids.add(requestCode.toString())
            requestCode += 1
        }

        val today = todayKey()
        for (task in data.tasks) {
            if (task.completed) continue
            task.reminderAt?.let { reminder ->
                schedule(reminder, "Нагадування", task.title, taskId = task.id)
            }
            if (task.dueDate == today && !task.dueTime.isNullOrBlank()) {
                val at = combineDateTime(today, task.dueTime)
                schedule(at, "Задача на сьогодні", task.title, taskId = task.id)
            }
        }

        for (payday in data.paydays) {
            val remindDays = data.settings.paydayReminderDays.toLong()
            val date = keyToDate(payday.date).minusDays(remindDays)
            if (date.isBefore(keyToDate(today))) continue
            val at = LocalDateTime.of(date, LocalTime.of(9, 0)).atZone(zone).toInstant().toEpochMilli()
            val amount = payday.amount?.let { " · ${com.vibedo.app.data.formatMoney(it, data.settings.currency, 0)}" } ?: ""
            schedule(
                at,
                if (remindDays == 0L) "Сьогодні зарплатний день" else "Наближається зарплата",
                payday.note.ifBlank { "Зарплата" } + amount,
                paydayId = payday.id,
            )
        }

        prefs.edit().putStringSet("alarm_ids", ids).apply()
    }

    fun cancelAll(context: Context) {
        val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val prefs = context.getSharedPreferences("vibedo", Context.MODE_PRIVATE)
        prefs.getStringSet("alarm_ids", emptySet())?.forEach { raw ->
            raw.toIntOrNull()?.let { id -> manager.cancel(pending(context, id, null)) }
        }
        prefs.edit().remove("alarm_ids").apply()
    }

    private fun pending(context: Context, id: Int, intent: Intent?): PendingIntent {
        val base = intent ?: Intent(context, ReminderReceiver::class.java)
        return PendingIntent.getBroadcast(
            context,
            id,
            base,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra("title") ?: "VibeDo"
        val body = intent.getStringExtra("body") ?: ""
        val taskId = intent.getStringExtra("taskId")
        val paydayId = intent.getStringExtra("paydayId")
        Notifications.createChannel(context)
        Notifications.showNow(context, title, body, taskId, paydayId)
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val storage = com.vibedo.app.data.DataStorage(context)
        storage.load()?.let { Notifications.scheduleAll(context, it) }
    }
}
