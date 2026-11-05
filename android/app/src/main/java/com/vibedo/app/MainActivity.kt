package com.vibedo.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.Today
import androidx.compose.material.icons.rounded.Wallet
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vibedo.app.data.TaskList
import com.vibedo.app.data.normalizeData
import com.vibedo.app.data.todayKey
import com.vibedo.app.notifications.Notifications
import com.vibedo.app.ui.CalendarScreen
import com.vibedo.app.ui.ConfirmDialog
import com.vibedo.app.ui.DrawerContent
import com.vibedo.app.ui.ListEditDialog
import com.vibedo.app.ui.LocalVibe
import com.vibedo.app.ui.LogoMark
import com.vibedo.app.ui.NotificationsSheet
import com.vibedo.app.ui.SalaryScreen
import com.vibedo.app.ui.SettingsScreen
import com.vibedo.app.ui.StatsScreen
import com.vibedo.app.ui.TaskDetailSheet
import com.vibedo.app.ui.TaskListScreen
import com.vibedo.app.ui.TimeScreen
import com.vibedo.app.ui.ToastHost
import com.vibedo.app.ui.VibeIconButton
import com.vibedo.app.ui.VibeTheme
import com.vibedo.app.ui.toComposeColor
import kotlinx.coroutines.delay
import org.json.JSONObject

class MainActivity : ComponentActivity() {

    private var pendingTaskId by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        pendingTaskId = intent?.getStringExtra("taskId")
        setContent {
            val vm: AppViewModel = viewModel()
            VibeTheme(settings = vm.data.settings) {
                VibeApp(vm = vm, pendingTaskId = pendingTaskId) {
                    pendingTaskId = null
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val id = intent.getStringExtra("taskId")
        if (id != null) pendingTaskId = id
    }
}

private data class BottomItem(
    val label: String,
    val icon: ImageVector,
    val active: (View) -> Boolean,
    val select: () -> Unit,
)

@Composable
private fun VibeApp(
    vm: AppViewModel,
    pendingTaskId: String?,
    onConsumePending: () -> Unit,
) {
    val p = LocalVibe.current
    val accent = vm.data.settings.accent.toComposeColor()
    val context = LocalContext.current
    val view = LocalView.current

    var drawerOpen by remember { mutableStateOf(false) }
    var showSearch by remember { mutableStateOf(false) }
    var notificationsOpen by remember { mutableStateOf(false) }
    var listDialogOpen by remember { mutableStateOf(false) }
    var editingList by remember { mutableStateOf<TaskList?>(null) }
    var lastDetailId by remember { mutableStateOf<String?>(null) }
    var pendingImport by remember { mutableStateOf<String?>(null) }

    val notifications = vm.notifications()

    SideEffect {
        val activity = view.context as? Activity ?: return@SideEffect
        val controller = WindowCompat.getInsetsController(activity.window, view)
        controller.isAppearanceLightStatusBars = !p.isDark
        controller.isAppearanceLightNavigationBars = !p.isDark
    }

    LaunchedEffect(pendingTaskId) {
        if (pendingTaskId != null) {
            vm.selectTask(pendingTaskId)
            onConsumePending()
        }
    }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json"),
    ) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.openOutputStream(uri)?.use { stream ->
                    stream.write(vm.exportJson().toByteArray(Charsets.UTF_8))
                }
            }.onSuccess {
                vm.showToast("Резервну копію збережено")
            }.onFailure {
                vm.showToast("Не вдалося експортувати дані")
            }
        }
    }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri ->
        if (uri != null) {
            val raw = runCatching {
                context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
            }.getOrNull()
            if (raw.isNullOrBlank()) {
                vm.showToast("Не вдалося прочитати файл")
            } else if (isBackup(raw)) {
                pendingImport = raw
            } else {
                vm.showToast("Файл не схожий на резервну копію VibeDo")
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        vm.showToast(
            if (granted) "Сповіщення увімкнено"
            else "Сповіщення заблоковані в системі — увімкніть їх у налаштуваннях пристрою",
        )
    }

    fun requestNotifications() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !Notifications.canPost(context)) {
            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    val detailId = vm.selectedTaskId
    if (detailId != null) lastDetailId = detailId

    val drawerProgress by animateFloatAsState(
        targetValue = if (drawerOpen) 1f else 0f,
        animationSpec = tween(260, easing = FastOutSlowInEasing),
        label = "drawer",
    )
    val drawerWidthPx = with(LocalDensity.current) { 300.dp.roundToPx() }

    BackHandler(
        enabled = drawerOpen || notificationsOpen || vm.selectedTaskId != null ||
            vm.view !is View.Smart || showSearch,
    ) {
        when {
            drawerOpen -> drawerOpen = false
            notificationsOpen -> notificationsOpen = false
            vm.selectedTaskId != null -> vm.selectTask(null)
            showSearch -> {
                showSearch = false
                vm.updateSearch("")
            }
            vm.view !is View.Smart -> vm.navigate(View.Smart("myday"))
        }
    }

    Box(Modifier.fillMaxSize().background(p.bg)) {
        if (!vm.hydrated) {
            LoadingScreen(accent)
        } else {
            Column(Modifier.fillMaxSize().statusBarsPadding()) {
                TopBar(
                    vm = vm,
                    showSearch = showSearch,
                    notificationCount = notifications.size,
                    onMenu = { drawerOpen = true },
                    onToggleSearch = {
                        showSearch = !showSearch
                        if (!showSearch) vm.updateSearch("")
                    },
                    onNotifications = { notificationsOpen = true },
                    onEditList = { list ->
                        editingList = list
                        listDialogOpen = true
                    },
                    onAddList = {
                        editingList = null
                        listDialogOpen = true
                    },
                )

                if (showSearch && (vm.view is View.Smart || vm.view is View.ListView)) {
                    Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                        com.vibedo.app.ui.VibeTextField(
                            value = vm.search,
                            onValueChange = vm::updateSearch,
                            placeholder = "Пошук задач…",
                            modifier = Modifier.fillMaxWidth(),
                            accent = accent,
                            leading = {
                                Icon(
                                    Icons.Rounded.Search,
                                    null,
                                    tint = p.text3,
                                    modifier = Modifier.size(17.dp),
                                )
                            },
                        )
                    }
                }

                Box(Modifier.weight(1f).fillMaxWidth()) {
                    AnimatedContent(
                        targetState = vm.view,
                        transitionSpec = {
                            (fadeIn(tween(190)) + slideInHorizontally(tween(190)) { it / 22 }) togetherWith
                                fadeOut(tween(120))
                        },
                        label = "screens",
                    ) { current ->
                        when (current) {
                            is View.Smart, is View.ListView -> TaskListScreen(
                                vm = vm,
                                showSearch = false,
                                onOpenTask = { id -> vm.selectTask(id) },
                                onEditList = { list ->
                                    editingList = list
                                    listDialogOpen = true
                                },
                            )
                            View.Time -> TimeScreen(vm)
                            View.Salary -> SalaryScreen(vm)
                            View.Calendar -> CalendarScreen(vm)
                            View.Stats -> StatsScreen(vm)
                            View.Settings -> SettingsScreen(
                                vm = vm,
                                onExport = {
                                    exportLauncher.launch("vibedo-backup-${todayKey()}.json")
                                },
                                onImport = {
                                    importLauncher.launch(arrayOf("application/json", "text/*"))
                                },
                                onRequestNotifications = { requestNotifications() },
                            )
                        }
                    }
                }
            }

            val items = listOf(
                BottomItem(
                    "Мій день",
                    Icons.Rounded.Today,
                    { it is View.Smart && it.id == "myday" },
                ) { vm.navigate(View.Smart("myday")); showSearch = false },
                BottomItem(
                    "Календар",
                    Icons.Rounded.CalendarMonth,
                    { it is View.Calendar },
                ) { vm.navigate(View.Calendar); showSearch = false },
                BottomItem(
                    "Час",
                    Icons.Rounded.Timer,
                    { it is View.Time },
                ) { vm.navigate(View.Time); showSearch = false },
                BottomItem(
                    "Заробіток",
                    Icons.Rounded.Wallet,
                    { it is View.Salary },
                ) { vm.navigate(View.Salary); showSearch = false },
                BottomItem(
                    "Ще",
                    Icons.Rounded.MoreHoriz,
                    { it is View.Stats || it is View.Settings },
                ) { drawerOpen = true },
            )

            if (vm.hydrated && vm.selectedTaskId == null) {
                BottomNav(
                    items = items,
                    currentView = vm.view,
                    accent = accent,
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            }

            // Drawer
            if (drawerProgress > 0.001f) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.38f * drawerProgress))
                        .clickable { drawerOpen = false },
                )
            }
            Box(
                Modifier
                    .fillMaxSize()
                    .offset { IntOffset((-drawerWidthPx * (1f - drawerProgress)).toInt(), 0) },
            ) {
                if (drawerProgress > 0.001f) {
                    Box(
                        Modifier
                            .fillMaxHeight()
                            .width(300.dp)
                            .statusBarsPadding(),
                    ) {
                        DrawerContent(
                            vm = vm,
                            onClose = { drawerOpen = false },
                            onAddList = {
                                editingList = null
                                listDialogOpen = true
                            },
                            onEditList = { list ->
                                editingList = list
                                listDialogOpen = true
                            },
                        )
                    }
                }
            }

            // Notifications
            AnimatedVisibility(
                visible = notificationsOpen,
                enter = fadeIn(tween(180)) + slideInHorizontally(tween(220)) { it / 5 },
                exit = fadeOut(tween(140)),
            ) {
                Box(Modifier.fillMaxSize().statusBarsPadding()) {
                    NotificationsSheet(
                        vm = vm,
                        onClose = { notificationsOpen = false },
                        onOpenTask = { id ->
                            notificationsOpen = false
                            vm.selectTask(id)
                        },
                        onOpenPayday = {
                            notificationsOpen = false
                            vm.navigate(View.Calendar)
                            vm.showToast("Зарплатний день позначено в календарі")
                        },
                    )
                }
            }

            // Task detail
            AnimatedVisibility(
                visible = vm.selectedTaskId != null,
                enter = slideInHorizontally(tween(260, easing = FastOutSlowInEasing)) { it } + fadeIn(tween(180)),
                exit = slideOutHorizontally(tween(220, easing = FastOutSlowInEasing)) { it } + fadeOut(tween(140)),
            ) {
                val currentId = lastDetailId
                if (currentId != null) {
                    Box(Modifier.fillMaxSize().background(p.bg).statusBarsPadding()) {
                        TaskDetailSheet(
                            vm = vm,
                            taskId = currentId,
                            onClose = { vm.selectTask(null) },
                        )
                    }
                }
            }

            if (listDialogOpen) {
                ListEditDialog(
                    vm = vm,
                    existing = editingList,
                    onDismiss = {
                        listDialogOpen = false
                        editingList = null
                    },
                )
            }

            val importRaw = pendingImport
            if (importRaw != null) {
                val preview = remember(importRaw) {
                    runCatching { normalizeData(JSONObject(importRaw)) }.getOrNull()
                }
                ConfirmDialog(
                    open = true,
                    title = "Імпортувати резервну копію?",
                    body = if (preview != null)
                        "У файлі: ${preview.tasks.size} задач, ${preview.lists.size} списків і " +
                            "${preview.entries.size} записів часу. Поточні дані буде замінено. " +
                            "Рекомендуємо спершу зробити експорт."
                    else "Файл не схожий на резервну копію VibeDo.",
                    confirmLabel = "Імпортувати",
                    onConfirm = {
                        if (preview != null) {
                            vm.replaceData(preview)
                            vm.showToast("Дані імпортовано")
                        }
                        pendingImport = null
                    },
                    onDismiss = { pendingImport = null },
                )
            }

            ToastHost(vm.toast) { vm.consumeToast() }
        }
    }
}

@Composable
private fun LoadingScreen(accent: Color) {
    val p = LocalVibe.current
    var pulse by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(240)
        pulse = true
    }
    Box(Modifier.fillMaxSize().background(p.bg), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            LogoMark(54.dp, accent)
            Spacer(Modifier.height(14.dp))
            Text("VibeDo", color = p.text, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(4.dp))
            Text(
                if (pulse) "Готуємо ваш простір…" else "Локально · приватно",
                color = p.text3,
                fontSize = 11.5.sp,
            )
        }
    }
}

@Composable
private fun TopBar(
    vm: AppViewModel,
    showSearch: Boolean,
    notificationCount: Int,
    onMenu: () -> Unit,
    onToggleSearch: () -> Unit,
    onNotifications: () -> Unit,
    onEditList: (TaskList) -> Unit,
    onAddList: () -> Unit,
) {
    val p = LocalVibe.current
    val accent = vm.data.settings.accent.toComposeColor()
    val list = (vm.view as? View.ListView)?.let { current -> vm.data.lists.find { it.id == current.id } }
    val title = when (val current = vm.view) {
        is View.Smart -> when (current.id) {
            "myday" -> "Мій день"
            "important" -> "Важливі"
            "planned" -> "Заплановані"
            else -> "Усі задачі"
        }
        is View.ListView -> list?.name ?: "Список"
        View.Time -> "Трекер часу"
        View.Salary -> "Заробіток"
        View.Calendar -> "Календар"
        View.Stats -> "Статистика"
        View.Settings -> "Налаштування"
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(54.dp)
            .padding(horizontal = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        VibeIconButton(Icons.Rounded.Menu, "Меню", onMenu, size = 40.dp, iconSize = 21.dp)
        Spacer(Modifier.width(2.dp))
        Column(Modifier.weight(1f)) {
            Text(
                title,
                color = p.text,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (list != null) {
                Text(
                    "${vm.data.tasks.count { it.listId == list.id && !it.completed }} активних",
                    color = p.text3,
                    fontSize = 10.5.sp,
                )
            }
        }
        if (list != null) {
            VibeIconButton(Icons.Rounded.Edit, "Редагувати список", { onEditList(list) })
        }
        if (vm.view is View.Smart || vm.view is View.ListView) {
            VibeIconButton(
                Icons.Rounded.Search,
                "Пошук",
                onToggleSearch,
                tint = if (showSearch) accent else null,
            )
            VibeIconButton(Icons.Rounded.Add, "Новий список", onAddList)
        }
        Box {
            VibeIconButton(Icons.Rounded.Notifications, "Сповіщення", onNotifications)
            if (notificationCount > 0) {
                Box(
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 4.dp, end = 4.dp)
                        .size(15.dp)
                        .clip(CircleShape)
                        .background(accent),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        if (notificationCount > 9) "9+" else "$notificationCount",
                        color = Color.White,
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

@Composable
private fun BottomNav(
    items: List<BottomItem>,
    currentView: View,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    val p = LocalVibe.current
    Column(
        modifier
            .fillMaxWidth()
            .background(p.surface)
            .navigationBarsPadding(),
    ) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(p.border))
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 5.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                items.forEach { item ->
                    val active = item.active(currentView)
                    Column(
                        modifier = Modifier
                            .clip(RoundedCornerShape(9.dp))
                            .clickable(onClick = item.select)
                            .padding(horizontal = 9.dp, vertical = 5.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(
                            item.icon,
                            item.label,
                            tint = if (active) accent else p.text3,
                            modifier = Modifier.size(19.dp),
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            item.label,
                            color = if (active) accent else p.text3,
                            fontSize = 9.sp,
                            fontWeight = if (active) FontWeight.Medium else FontWeight.Normal,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
    }
}

private fun isBackup(raw: String): Boolean = runCatching {
    val json = JSONObject(raw)
    json.has("lists") && json.optJSONArray("lists") != null &&
        json.has("tasks") && json.optJSONArray("tasks") != null
}.getOrDefault(false)
