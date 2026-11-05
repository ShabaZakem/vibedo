package com.vibedo.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Paid
import androidx.compose.material.icons.rounded.Storage
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Monitor
import androidx.compose.material.icons.rounded.DarkMode
import androidx.compose.material.icons.rounded.Palette
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.RestartAlt
import androidx.compose.material.icons.rounded.VerifiedUser
import androidx.compose.material.icons.rounded.LightMode
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.Upload
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Wifi
import androidx.compose.material.icons.rounded.WifiOff
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vibedo.app.AppViewModel
import com.vibedo.app.data.ACCENTS
import com.vibedo.app.data.DEFAULT_SYNC_PORT
import com.vibedo.app.data.formatDateInput
import com.vibedo.app.data.formatMoney
import com.vibedo.app.data.formatNumber
import com.vibedo.app.data.formatTimeInput
import kotlin.math.roundToLong

@Composable
fun SettingsScreen(
    vm: AppViewModel,
    onExport: () -> Unit,
    onImport: () -> Unit,
    onRequestNotifications: () -> Unit,
) {
    val p = LocalVibe.current
    val accent = vm.data.settings.accent.toComposeColor()
    val settings = vm.data.settings
    var confirmReset by remember { mutableStateOf(false) }
    var syncTest by remember { mutableStateOf<Pair<Boolean, String>?>(null) }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(bottom = 110.dp),
    ) {
        Spacer(Modifier.height(4.dp))

        SettingsCard(
            icon = Icons.Rounded.Person,
            title = "Профіль і вигляд",
            description = "Ім'я показується у привітанні на «Мій день».",
        ) {
            SettingsField(
                label = "Ваше ім'я",
                description = "Необов'язково",
            ) {
                VibeTextField(
                    value = settings.firstName,
                    onValueChange = { value ->
                        vm.updateSettings { it.copy(firstName = value.take(40)) }
                    },
                    placeholder = "Наприклад, Олена",
                    modifier = Modifier.width(160.dp),
                    accent = accent,
                )
            }

            SettingsHeader(label = "Тема", description = "Світла, темна або як у системі")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ThemeTile("light", "Світла", Icons.Rounded.LightMode, settings.theme == "light", accent) {
                    vm.updateSettings { it.copy(theme = "light") }
                }
                ThemeTile("dark", "Темна", Icons.Rounded.DarkMode, settings.theme == "dark", accent) {
                    vm.updateSettings { it.copy(theme = "dark") }
                }
                ThemeTile("system", "Системна", Icons.Rounded.Monitor, settings.theme == "system", accent) {
                    vm.updateSettings { it.copy(theme = "system") }
                }
            }

            Spacer(Modifier.height(4.dp))
            SettingsHeader(
                label = "Акцентний колір",
                description = "Кнопки, виділення та графіки",
                icon = Icons.Rounded.Palette,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp), verticalAlignment = Alignment.CenterVertically) {
                ACCENTS.forEach { (value, name) ->
                    val selected = settings.accent == value
                    Box(
                        Modifier
                            .size(30.dp)
                            .clip(CircleShape)
                            .background(value.toComposeColor())
                            .then(
                                if (selected) Modifier.border(2.dp, p.text, CircleShape)
                                else Modifier.border(1.dp, p.border, CircleShape),
                            )
                            .clickable { vm.updateSettings { it.copy(accent = value) } },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (selected) {
                            Icon(
                                Icons.Rounded.CheckCircle,
                                name,
                                tint = Color.White,
                                modifier = Modifier.size(15.dp),
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(4.dp))
            SettingsSwitch(
                label = "Компактний вигляд",
                description = "Менші відступи у списку задач",
                checked = settings.compactMode,
                accent = accent,
                onChange = { value -> vm.updateSettings { it.copy(compactMode = value) } },
            )
        }

        Spacer(Modifier.height(12.dp))
        SettingsCard(
            icon = Icons.Rounded.Paid,
            title = "Ставка й норми",
            description = "Базова ставка для списків без власної ставки. Окрему ставку можна задати в кожному списку.",
        ) {
            NumberSetting(
                label = "Погодинна ставка",
                description = "Зараз: ${formatMoney(settings.hourlyRate, settings.currency, 0)} за годину",
                value = settings.hourlyRate,
                min = 0.0,
                max = 1_000_000.0,
                onCommit = { value -> vm.updateSettings { it.copy(hourlyRate = value) } },
                accent = accent,
            )
            SettingsField(label = "Валюта", description = "Символ або код, наприклад ₴, $, €, PLN") {
                var text by remember(settings.currency) { mutableStateOf(settings.currency) }
                VibeTextField(
                    value = text,
                    onValueChange = { text = it.take(6) },
                    placeholder = "₴",
                    modifier = Modifier.width(90.dp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = {
                        val next = text.trim().ifBlank { "₴" }.take(6)
                        vm.updateSettings { it.copy(currency = next) }
                    }),
                    accent = accent,
                )
            }
            NumberSetting(
                label = "Податки, %",
                description = "За замовчуванням 19,5% (ПДФО 18% + військовий збір 1,5%)",
                value = settings.taxPercent,
                min = 0.0,
                max = 100.0,
                onCommit = { value -> vm.updateSettings { it.copy(taxPercent = value) } },
                accent = accent,
            )
            SettingsSwitch(
                label = "Понаднормові",
                description = "Години понад денну норму оплачуються з множником ×" +
                    formatNumber(settings.overtimeMultiplier, 1),
                checked = settings.overtimeEnabled,
                accent = accent,
                onChange = { value -> vm.updateSettings { it.copy(overtimeEnabled = value) } },
            )
            NumberSetting(
                label = "Множник понаднормових",
                value = settings.overtimeMultiplier,
                min = 1.0,
                max = 5.0,
                onCommit = { value -> vm.updateSettings { it.copy(overtimeMultiplier = value) } },
                accent = accent,
            )
            NumberSetting(
                label = "Денна норма, год",
                description = "Після цієї кількості годин починаються понаднормові",
                value = settings.dailyNormHours,
                min = 0.0,
                max = 24.0,
                onCommit = { value -> vm.updateSettings { it.copy(dailyNormHours = value) } },
                accent = accent,
            )
            NumberSetting(
                label = "Тижнева норма, год",
                description = "Довідково для планування",
                value = settings.weeklyNormHours,
                min = 0.0,
                max = 168.0,
                onCommit = { value -> vm.updateSettings { it.copy(weeklyNormHours = value) } },
                accent = accent,
            )
        }

        Spacer(Modifier.height(12.dp))
        SettingsCard(
            icon = Icons.Rounded.Notifications,
            title = "Нагадування",
            description = "Системні сповіщення для задач із нагадуванням.",
        ) {
            SettingsSwitch(
                label = "Сповіщення",
                description = if (settings.notifications)
                    "Увімкнено. Задайте час нагадування у деталях задачі."
                else "Вимкнено — нагадування не показуватимуться.",
                checked = settings.notifications,
                accent = accent,
                onChange = { value ->
                    if (value) onRequestNotifications()
                    vm.updateSettings { it.copy(notifications = value) }
                },
            )
            SettingsField(
                label = "Приватність",
                description = "VibeDo не надсилає дані в мережу. Нагадування обробляються локально.",
            ) {
                Icon(Icons.Rounded.VerifiedUser, null, tint = p.success, modifier = Modifier.size(20.dp))
            }
            NumberSetting(
                label = "Нагадати про зарплату, дн.",
                description = "За скільки днів повідомляти про зарплатний день (0 — вимкнути)",
                value = settings.paydayReminderDays.toDouble(),
                min = 0.0,
                max = 30.0,
                onCommit = { value -> vm.updateSettings { it.copy(paydayReminderDays = value.roundToLong().toInt()) } },
                accent = accent,
            )
        }

        Spacer(Modifier.height(12.dp))
        SettingsCard(
            icon = Icons.Rounded.Wifi,
            title = "Синхронізація по Wi-Fi",
            description = "Прямий обмін між комп'ютером і телефоном у спільній мережі. Без інтернету, акаунтів і хмарних серверів.",
        ) {
            var host by remember(vm.syncConfig.host) { mutableStateOf(vm.syncConfig.host) }
            var pin by remember(vm.syncConfig.pin) { mutableStateOf(vm.syncConfig.pin) }
            var port by remember(vm.syncConfig.port) { mutableStateOf(vm.syncConfig.port.toString()) }

            SettingsField(label = "IP-адреса комп'ютера", description = "Наприклад 192.168.1.20") {
                VibeTextField(
                    value = host,
                    onValueChange = { value ->
                        host = value
                        vm.updateSyncConfig { it.copy(host = value.trim()) }
                    },
                    placeholder = "192.168.1.20",
                    modifier = Modifier.width(150.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    accent = accent,
                )
            }
            SettingsField(label = "PIN з комп'ютера", description = "Одноразовий код для підключення") {
                VibeTextField(
                    value = pin,
                    onValueChange = { value ->
                        val digits = value.filter { it.isDigit() }.take(8)
                        pin = digits
                        vm.updateSyncConfig { it.copy(pin = digits, token = "") }
                    },
                    placeholder = "000000",
                    modifier = Modifier.width(110.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    accent = accent,
                )
            }
            SettingsField(label = "Порт", description = "За замовчуванням $DEFAULT_SYNC_PORT") {
                VibeTextField(
                    value = port,
                    onValueChange = { value ->
                        port = value.filter { it.isDigit() }.take(5)
                        val number = port.toIntOrNull()
                        if (number != null && number in 1..65535) {
                            vm.updateSyncConfig { it.copy(port = number) }
                        }
                    },
                    placeholder = "$DEFAULT_SYNC_PORT",
                    modifier = Modifier.width(90.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    accent = accent,
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                VDButton(
                    "Підключитися",
                    {
                        vm.updateSyncConfig { it.copy(host = host.trim(), enabled = true, token = "") }
                        vm.syncNow()
                    },
                    accent = accent,
                    icon = Icons.Rounded.Wifi,
                    enabled = !vm.syncing,
                    modifier = Modifier.weight(1f),
                )
                VDButton(
                    if (vm.syncConfig.auto) "Авто: увімк." else "Авто: вимк.",
                    { vm.updateSyncConfig { it.copy(auto = !it.auto) } },
                    accent = accent,
                    filled = false,
                    modifier = Modifier.weight(1f),
                )
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                VDButton(
                    "Перевірити",
                    {
                        syncTest = null
                        vm.testConnection { ok, message ->
                            syncTest = ok to message
                            vm.showToast(message)
                        }
                    },
                    accent = accent,
                    filled = false,
                    icon = Icons.Rounded.Refresh,
                    modifier = Modifier.weight(1f),
                )
                VDButton(
                    "Новий PIN",
                    {
                        vm.regeneratePin()
                        pin = vm.syncConfig.pin
                    },
                    accent = accent,
                    filled = false,
                    icon = Icons.Rounded.Refresh,
                    modifier = Modifier.weight(1f),
                )
            }

            if (vm.syncPhase != "idle") {
                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(
                            when (vm.syncPhase) {
                                "ok" -> p.successSoft
                                "error", "offline" -> p.dangerSoft
                                else -> p.surface2
                            },
                        )
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        if (vm.syncPhase == "ok") Icons.Rounded.CheckCircle else Icons.Rounded.WifiOff,
                        null,
                        tint = if (vm.syncPhase == "ok") p.success else p.danger,
                        modifier = Modifier.size(14.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        vm.syncMessage.ifBlank { "Синхронізація…" },
                        color = if (vm.syncPhase == "ok") p.success else p.danger,
                        fontSize = 11.5.sp,
                    )
                }
            }

            val test = syncTest
            if (test != null) {
                Spacer(Modifier.height(8.dp))
                Text(
                    test.second,
                    color = if (test.first) p.success else p.text3,
                    fontSize = 11.sp,
                )
            }

            if (vm.syncConfig.lastSyncAt != null) {
                Spacer(Modifier.height(6.dp))
                Text(
                    "Остання синхронізація: ${formatDateInput(vm.syncConfig.lastSyncAt!!)} · " +
                        formatTimeInput(vm.syncConfig.lastSyncAt!!),
                    color = p.text3,
                    fontSize = 11.sp,
                )
            }

            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(p.surface2)
                    .padding(10.dp),
            ) {
                Icon(Icons.Rounded.VerifiedUser, null, tint = p.success, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Column {
                    Text("Як це працює", color = p.text, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    Text(
                        "Телефон надсилає свої зміни на комп'ютер, отримує об'єднані дані й зберігає їх локально. " +
                            "Видалені записи можуть повернутися з іншого пристрою — це особливість злиття без інтернет-сервера.",
                        color = p.text3,
                        fontSize = 10.5.sp,
                        lineHeight = 15.sp,
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        SettingsCard(
            icon = Icons.Rounded.Timer,
            title = "Pomodoro",
            description = "Фокус-таймер запускається з деталей задачі та автоматично веде запис часу.",
        ) {
            NumberSetting(
                label = "Тривалість фокусу, хв",
                value = settings.pomodoroWorkMinutes.toDouble(),
                min = 1.0,
                max = 180.0,
                onCommit = { value -> vm.updateSettings { it.copy(pomodoroWorkMinutes = value.roundToLong().toInt()) } },
                accent = accent,
            )
            NumberSetting(
                label = "Тривалість перерви, хв",
                value = settings.pomodoroBreakMinutes.toDouble(),
                min = 1.0,
                max = 60.0,
                onCommit = { value -> vm.updateSettings { it.copy(pomodoroBreakMinutes = value.roundToLong().toInt()) } },
                accent = accent,
            )
            SettingsSwitch(
                label = "Автоматична перерва",
                description = "Після завершення фокусу одразу запускати таймер перерви",
                checked = settings.pomodoroAutoBreak,
                accent = accent,
                onChange = { value -> vm.updateSettings { it.copy(pomodoroAutoBreak = value) } },
            )
        }

        Spacer(Modifier.height(12.dp))
        SettingsCard(
            icon = Icons.Rounded.Storage,
            title = "Дані",
            description = "Задачі, записи часу та налаштування зберігаються у JSON-файлі на цьому пристрої.",
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                VDButton(
                    "Експорт JSON",
                    { onExport() },
                    accent = accent,
                    filled = false,
                    icon = Icons.Rounded.Download,
                    modifier = Modifier.weight(1f),
                )
                VDButton(
                    "Імпорт JSON",
                    { onImport() },
                    accent = accent,
                    filled = false,
                    icon = Icons.Rounded.Upload,
                    modifier = Modifier.weight(1f),
                )
            }
            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(p.surface2)
                    .padding(10.dp),
            ) {
                Icon(Icons.Rounded.VerifiedUser, null, tint = p.success, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Column {
                    Text("Локально та приватно", color = p.text, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
                    Text(
                        "${vm.data.tasks.size} задач · ${vm.data.lists.size} списків · " +
                            "${vm.data.entries.size} записів часу",
                        color = p.text3,
                        fontSize = 11.sp,
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(
                vm.dataFolderPath(),
                color = p.text3,
                fontSize = 10.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(4.dp))
            SettingsField(
                label = "Скинути всі дані",
                description = "Видалити задачі, час і налаштування та почати заново.",
            ) {
                VDButton(
                    "Скинути",
                    { confirmReset = true },
                    accent = p.danger,
                    filled = false,
                    icon = Icons.Rounded.RestartAlt,
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        SettingsCard(title = "Про застосунок") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                LogoMark(28.dp, accent)
                Spacer(Modifier.width(9.dp))
                Column {
                    Text("VibeDo ${vm.appVersion()}", color = p.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text("Локальний планувальник · Android · Kotlin", color = p.text3, fontSize = 10.5.sp)
                }
            }
            Spacer(Modifier.height(10.dp))
            SettingsField(
                label = "Відкритий вихідний код",
                description = "Ліцензія MIT: безкоштовно, можна змінювати та розповсюджувати. Без реклами, підписок і телеметрії.",
            ) {
                Box(
                    Modifier
                        .clip(RoundedCornerShape(5.dp))
                        .background(accent.copy(alpha = 0.12f))
                        .padding(horizontal = 7.dp, vertical = 3.dp),
                ) {
                    Text("MIT", color = accent, fontSize = 10.sp, fontWeight = FontWeight.Medium)
                }
            }
            SettingsField(
                label = "Де лежать дані",
                description = "Файл vibedo-data.json у внутрішній пам'яті застосунку. Автозбереження після кожної зміни.",
            ) {}
            Text(
                "Поточна дата: ${formatDateInput(System.currentTimeMillis())} · Android · зроблено з любов'ю до локальності",
                color = p.text3,
                fontSize = 10.5.sp,
                modifier = Modifier.padding(top = 6.dp),
            )
        }

        Spacer(Modifier.height(20.dp))
    }

    ConfirmDialog(
        open = confirmReset,
        title = "Скинути всі дані?",
        body = "Усі задачі, списки, записи часу й налаштування буде видалено без можливості відновлення. " +
            "Спершу зробіть експорт, якщо потрібна копія.",
        confirmLabel = "Видалити все",
        onConfirm = {
            confirmReset = false
            vm.resetAllData()
            vm.showToast("Дані скинуто до початкового стану")
        },
        onDismiss = { confirmReset = false },
    )
}

@Composable
private fun SettingsCard(
    title: String,
    description: String? = null,
    icon: ImageVector? = null,
    content: @Composable () -> Unit,
) {
    val p = LocalVibe.current
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(p.surface)
            .border(1.dp, p.border, RoundedCornerShape(12.dp))
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                Icon(icon, null, tint = p.text2, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(6.dp))
            }
            Text(title, color = p.text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        }
        if (description != null) {
            Spacer(Modifier.height(3.dp))
            Text(description, color = p.text3, fontSize = 11.sp, lineHeight = 15.sp)
        }
        Spacer(Modifier.height(8.dp))
        content()
    }
}

@Composable
private fun SettingsHeader(
    label: String,
    description: String? = null,
    icon: ImageVector? = null,
) {
    val p = LocalVibe.current
    Column(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                Icon(icon, null, tint = p.text2, modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(4.dp))
            }
            Text(label, color = p.text, fontSize = 12.5.sp, fontWeight = FontWeight.Medium)
        }
        if (description != null) {
            Text(description, color = p.text3, fontSize = 10.5.sp)
        }
    }
}

@Composable
private fun SettingsField(
    label: String,
    description: String? = null,
    trailing: @Composable () -> Unit,
) {
    val p = LocalVibe.current
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(end = 8.dp)) {
            Text(label, color = p.text, fontSize = 12.5.sp)
            if (description != null) {
                Text(description, color = p.text3, fontSize = 10.5.sp, lineHeight = 14.sp)
            }
        }
        trailing()
    }
}

@Composable
private fun SettingsSwitch(
    label: String,
    description: String?,
    checked: Boolean,
    accent: Color,
    onChange: (Boolean) -> Unit,
) {
    val p = LocalVibe.current
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(end = 8.dp)) {
            Text(label, color = p.text, fontSize = 12.5.sp)
            if (description != null) {
                Text(description, color = p.text3, fontSize = 10.5.sp, lineHeight = 14.sp)
            }
        }
        VibeSwitch(checked, onChange, accent)
    }
}

@Composable
private fun NumberSetting(
    label: String,
    value: Double,
    min: Double,
    max: Double,
    onCommit: (Double) -> Unit,
    accent: Color,
    description: String? = null,
) {
    val p = LocalVibe.current
    fun render(input: Double): String =
        if (input == input.roundToLong().toDouble()) input.roundToLong().toString()
        else formatNumber(input, 1)

    var text by remember(value) { mutableStateOf(render(value)) }

    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(end = 8.dp)) {
            Text(label, color = p.text, fontSize = 12.5.sp)
            if (description != null) {
                Text(description, color = p.text3, fontSize = 10.5.sp, lineHeight = 14.sp)
            }
        }
        VibeTextField(
            value = text,
            onValueChange = { raw ->
                text = raw.filter { it.isDigit() || it == '.' || it == ',' }
            },
            placeholder = "0",
            modifier = Modifier.width(92.dp),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Decimal,
                imeAction = ImeAction.Done,
            ),
            keyboardActions = KeyboardActions(onDone = {
                val parsed = text.replace(',', '.').toDoubleOrNull()
                if (parsed != null && parsed.isFinite()) {
                    val next = parsed.coerceIn(min, max)
                    onCommit(next)
                    text = render(next)
                } else {
                    text = render(value)
                }
            }),
            accent = accent,
            singleLine = true,
        )
    }
}

@Composable
private fun RowScope.ThemeTile(
    value: String,
    label: String,
    icon: ImageVector,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit,
) {
    val p = LocalVibe.current
    Column(
        modifier = Modifier
            .weight(1f)
            .clip(RoundedCornerShape(9.dp))
            .background(if (selected) accent.copy(alpha = 0.1f) else p.surface2)
            .border(
                1.dp,
                if (selected) accent else p.border,
                RoundedCornerShape(9.dp),
            )
            .clickable(onClick = onClick)
            .padding(8.dp),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(34.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(
                    when (value) {
                        "dark" -> Color(0xFF1B1C1E)
                        "light" -> Color(0xFFF3F4F6)
                        else -> Color(0xFF8C8C8C)
                    },
                ),
        ) {
            Box(
                Modifier
                    .fillMaxWidth(0.28f)
                    .height(34.dp)
                    .background(
                        when (value) {
                            "dark" -> Color(0xFF141517)
                            "light" -> Color(0xFFE7E9EC)
                            else -> Color(0xFF6E6E6E)
                        },
                    ),
            )
        }
        Spacer(Modifier.height(5.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = if (selected) accent else p.text3, modifier = Modifier.size(11.dp))
            Spacer(Modifier.width(3.dp))
            Text(
                label,
                color = if (selected) accent else p.text2,
                fontSize = 10.5.sp,
                maxLines = 1,
            )
        }
    }
}
