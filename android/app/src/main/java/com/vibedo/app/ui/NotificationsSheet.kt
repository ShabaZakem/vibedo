package com.vibedo.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.NotificationsNone
import androidx.compose.material.icons.rounded.Payments
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vibedo.app.AppViewModel
import com.vibedo.app.data.AppNotification

@Composable
fun NotificationsSheet(
    vm: AppViewModel,
    onClose: () -> Unit,
    onOpenTask: (String) -> Unit,
    onOpenPayday: (String) -> Unit,
) {
    val p = LocalVibe.current
    val accent = vm.data.settings.accent.toComposeColor()
    val items = vm.notifications()

    Column(
        Modifier
            .fillMaxHeight()
            .fillMaxWidth()
            .background(p.surface)
            .padding(top = 14.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Сповіщення", color = p.text, fontSize = 19.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.width(8.dp))
            if (items.isNotEmpty()) {
                Box(
                    Modifier
                        .clip(CircleShape)
                        .background(accent.copy(alpha = 0.14f))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                ) {
                    Text("${items.size}", color = accent, fontSize = 10.5.sp, fontWeight = FontWeight.Medium)
                }
            }
            Spacer(Modifier.weight(1f))
            VibeIconButton(Icons.Rounded.Close, "Закрити", onClose, size = 34.dp, iconSize = 18.dp)
        }
        Spacer(Modifier.height(8.dp))
        DividerLine()

        if (items.isEmpty()) {
            EmptyState(
                "Усе під контролем",
                "Тут з'являться нагадування про задачі та зарплатні дні.",
                Icons.Rounded.NotificationsNone,
            )
        } else {
            Column(
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items.forEach { item ->
                    NotificationRow(
                        item = item,
                        accent = accent,
                        onClick = {
                            when {
                                item.taskId != null -> {
                                    vm.markNotified(item.taskId)
                                    onOpenTask(item.taskId)
                                }
                                item.paydayId != null -> onOpenPayday(item.paydayId)
                                else -> Unit
                            }
                        },
                    )
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    "Сповіщення створюються локально на пристрої. Дані не залишають телефон.",
                    color = p.text3,
                    fontSize = 10.5.sp,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun NotificationRow(item: AppNotification, accent: Color, onClick: () -> Unit) {
    val p = LocalVibe.current
    val (icon, tint) = when (item.kind) {
        "overdue" -> Icons.Rounded.Warning to p.danger
        "reminder" -> Icons.Rounded.Schedule to p.warning
        "today" -> Icons.Rounded.CalendarMonth to p.warning
        "payday" -> Icons.Rounded.Payments to p.success
        else -> Icons.Rounded.CheckCircle to accent
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(p.surface2)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(tint.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, null, tint = tint, modifier = Modifier.size(16.dp))
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(item.title, color = p.text, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1)
            Text(
                item.body,
                color = p.text2,
                fontSize = 11.5.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun PaymentIcon(icon: ImageVector) {
    Icon(icon, null, tint = LocalVibe.current.text3, modifier = Modifier.size(14.dp))
}
