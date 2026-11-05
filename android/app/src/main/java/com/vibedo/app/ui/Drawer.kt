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
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.BarChart
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Cloud
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.ListAlt
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.Today
import androidx.compose.material.icons.rounded.Wallet
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
import com.vibedo.app.View
import com.vibedo.app.data.TaskList
import com.vibedo.app.data.formatDateInput
import com.vibedo.app.data.greeting
import com.vibedo.app.data.todayKey

@Composable
fun DrawerContent(
    vm: AppViewModel,
    onClose: () -> Unit,
    onAddList: () -> Unit,
    onEditList: (TaskList) -> Unit,
) {
    val p = LocalVibe.current
    val accent = p.text
    val data = vm.data
    val today = todayKey()
    val openTasks = data.tasks.filter { !it.completed }
    val counts = mapOf(
        "myday" to openTasks.count { it.myDayDate == today },
        "important" to openTasks.count { it.important },
        "planned" to openTasks.count { it.dueDate != null },
        "all" to openTasks.size,
    )

    Column(
        modifier = Modifier
            .fillMaxHeight()
            .width(300.dp)
            .background(p.sidebar)
            .padding(top = 14.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LogoMark(30.dp, vm.data.settings.accent.toComposeColor())
            Spacer(Modifier.width(9.dp))
            Column(Modifier.weight(1f)) {
                Text("VibeDo", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = p.text)
                Text("v${vm.appVersion()} · локально", fontSize = 10.5.sp, color = p.text3)
            }
            Box(
                Modifier
                    .clip(RoundedCornerShape(5.dp))
                    .background(p.surface3)
                    .padding(horizontal = 6.dp, vertical = 3.dp),
            ) {
                Text("1.0.2", fontSize = 9.5.sp, color = p.text2, fontWeight = FontWeight.Medium)
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(p.surface)
                .padding(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .background(vm.data.settings.accent.toComposeColor().copy(alpha = 0.16f)),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = vm.data.settings.firstName.trim().take(1).ifBlank { "V" }.uppercase(),
                    color = vm.data.settings.accent.toComposeColor(),
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                )
            }
            Spacer(Modifier.width(9.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    vm.data.settings.firstName.trim().ifBlank { "Мій простір" },
                    color = p.text,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(greeting(), color = p.text3, fontSize = 11.sp)
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 8.dp),
        ) {
            SectionLabel("Задачі")
            DrawerNavItem(Icons.Rounded.Today, "Мій день", counts["myday"] ?: 0,
                vm.view is View.Smart && (vm.view as View.Smart).id == "myday") {
                vm.navigate(View.Smart("myday")); onClose()
            }
            DrawerNavItem(Icons.Rounded.Star, "Важливі", counts["important"] ?: 0,
                vm.view is View.Smart && (vm.view as View.Smart).id == "important") {
                vm.navigate(View.Smart("important")); onClose()
            }
            DrawerNavItem(Icons.Rounded.CalendarMonth, "Заплановані", counts["planned"] ?: 0,
                vm.view is View.Smart && (vm.view as View.Smart).id == "planned") {
                vm.navigate(View.Smart("planned")); onClose()
            }
            DrawerNavItem(Icons.Rounded.ListAlt, "Усі задачі", counts["all"] ?: 0,
                vm.view is View.Smart && (vm.view as View.Smart).id == "all") {
                vm.navigate(View.Smart("all")); onClose()
            }

            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 4.dp, end = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "СПИСКИ",
                    color = p.text3,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.6.sp,
                    modifier = Modifier.weight(1f),
                )
                VibeIconButton(Icons.Rounded.Add, "Новий список", onAddList, size = 24.dp, iconSize = 15.dp)
            }
            Spacer(Modifier.height(2.dp))

            data.lists.sortedBy { it.order }.forEach { list ->
                val active = vm.view is View.ListView && (vm.view as View.ListView).id == list.id
                val count = openTasks.count { it.listId == list.id }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(7.dp))
                        .background(if (active) p.active else Color.Transparent)
                        .clickable {
                            vm.navigate(View.ListView(list.id))
                            onClose()
                        }
                        .padding(start = 10.dp, end = 4.dp, top = 8.dp, bottom = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier
                            .size(9.dp)
                            .clip(CircleShape)
                            .background(list.color.toComposeColor(p.text3)),
                    )
                    Spacer(Modifier.width(9.dp))
                    Text(
                        list.name,
                        color = p.text,
                        fontSize = 13.5.sp,
                        fontWeight = if (active) FontWeight.Medium else FontWeight.Normal,
                        modifier = Modifier.weight(1f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text("$count", color = p.text3, fontSize = 11.sp)
                    VibeIconButton(Icons.Rounded.Edit, "Редагувати список", { onEditList(list) },
                        size = 26.dp, iconSize = 13.dp)
                }
            }

            Spacer(Modifier.height(8.dp))
            SectionLabel("Інструменти")
            DrawerNavItem(Icons.Rounded.CalendarMonth, "Календар", null, vm.view is View.Calendar) {
                vm.navigate(View.Calendar); onClose()
            }
            DrawerNavItem(Icons.Rounded.Schedule, "Трекер часу", null, vm.view is View.Time) {
                vm.navigate(View.Time); onClose()
            }
            DrawerNavItem(Icons.Rounded.Wallet, "Заробіток", null, vm.view is View.Salary) {
                vm.navigate(View.Salary); onClose()
            }
            DrawerNavItem(Icons.Rounded.BarChart, "Статистика", null, vm.view is View.Stats) {
                vm.navigate(View.Stats); onClose()
            }
            Spacer(Modifier.height(14.dp))
        }

        Box(Modifier.fillMaxWidth().height(1.dp).background(p.border))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { vm.navigate(View.Settings); onClose() }
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Rounded.Settings, null, tint = p.text2, modifier = Modifier.size(17.dp))
            Spacer(Modifier.width(10.dp))
            Text("Налаштування", color = p.text, fontSize = 13.5.sp, modifier = Modifier.weight(1f))
            Icon(
                if (vm.syncPhase == "ok") Icons.Rounded.Cloud else Icons.Rounded.CloudOff,
                null,
                tint = if (vm.syncPhase == "ok") p.success else p.text3,
                modifier = Modifier.size(15.dp),
            )
            Spacer(Modifier.width(6.dp))
            Text(
                when (vm.saveStatus) {
                    "saving" -> "Зберігаю…"
                    "error" -> "Помилка"
                    else -> vm.lastSavedAt?.let { "Збережено" } ?: "Локально"
                },
                color = p.text3,
                fontSize = 10.5.sp,
            )
        }
    }
}

@Composable
private fun DrawerNavItem(
    icon: ImageVector,
    label: String,
    count: Int?,
    active: Boolean,
    onClick: () -> Unit,
) {
    val p = LocalVibe.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(7.dp))
            .background(if (active) p.active else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        Icon(
            icon,
            null,
            tint = if (active) p.text else p.text2,
            modifier = Modifier.size(17.dp),
        )
        Text(
            label,
            color = p.text,
            fontSize = 13.5.sp,
            fontWeight = if (active) FontWeight.Medium else FontWeight.Normal,
            modifier = Modifier.weight(1f),
            maxLines = 1,
        )
        if (count != null && count > 0) {
            Text("$count", color = p.text3, fontSize = 11.sp)
        }
    }
}
