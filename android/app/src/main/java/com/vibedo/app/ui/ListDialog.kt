package com.vibedo.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Delete
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vibedo.app.AppViewModel
import com.vibedo.app.data.LIST_COLORS
import com.vibedo.app.data.TaskList
import com.vibedo.app.data.formatMoney

@Composable
fun ListEditDialog(
    vm: AppViewModel,
    existing: TaskList?,
    onDismiss: () -> Unit,
) {
    val p = LocalVibe.current
    val accent = vm.data.settings.accent.toComposeColor()
    var name by remember(existing?.id) { mutableStateOf(existing?.name ?: "") }
    var color by remember(existing?.id) { mutableStateOf(existing?.color ?: LIST_COLORS[0]) }
    var rate by remember(existing?.id) {
        mutableStateOf(existing?.hourlyRate?.let { if (it == it.toLong().toDouble()) it.toLong().toString() else it.toString() } ?: "")
    }
    var confirmDelete by remember { mutableStateOf(false) }

    VibeDialog(
        onDismiss = onDismiss,
        title = if (existing == null) "Новий список" else "Редагувати список",
    ) {
        Text("Назва", color = p.text3, fontSize = 10.5.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(4.dp))
        VibeTextField(
            value = name,
            onValueChange = { name = it.take(80) },
            placeholder = "Новий список",
            modifier = Modifier.fillMaxWidth(),
            accent = accent,
        )

        Spacer(Modifier.height(12.dp))
        Text("КОЛІР", color = p.text3, fontSize = 10.5.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LIST_COLORS.forEach { value ->
                val selected = color == value
                Box(
                    Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(value.toComposeColor())
                        .then(
                            if (selected) Modifier.border(2.dp, p.text, CircleShape)
                            else Modifier.border(1.dp, Color.Transparent, CircleShape),
                        )
                        .clickable { color = value },
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        Text("СТАВКА ЗА ГОДИНУ", color = p.text3, fontSize = 10.5.sp, fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(4.dp))
        VibeTextField(
            value = rate,
            onValueChange = { raw -> rate = raw.filter { it.isDigit() || it == '.' || it == ',' } },
            placeholder = "Як у налаштуваннях · ${formatMoney(vm.data.settings.hourlyRate, vm.data.settings.currency, 0)}",
            modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            accent = accent,
        )
        Spacer(Modifier.height(3.dp))
        Text(
            "Порожнє поле — використовувати загальну ставку.",
            color = p.text3,
            fontSize = 10.5.sp,
        )

        Spacer(Modifier.height(18.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            if (existing != null) {
                VDButton(
                    "Видалити",
                    { confirmDelete = true },
                    accent = p.danger,
                    filled = false,
                    icon = Icons.Rounded.Delete,
                )
            }
            Spacer(Modifier.weight(1f))
            VDButton("Скасувати", onDismiss, filled = false)
            VDButton(
                if (existing == null) "Створити" else "Зберегти",
                {
                    val parsedRate = rate.replace(',', '.').toDoubleOrNull()?.coerceAtLeast(0.0)
                    if (existing == null) {
                        val id = vm.addList(name.ifBlank { "Новий список" }, color)
                        vm.updateListDetails(id, name.ifBlank { "Новий список" }, color, parsedRate)
                    } else {
                        vm.updateListDetails(existing.id, name.ifBlank { "Новий список" }, color, parsedRate)
                    }
                    vm.showToast(if (existing == null) "Список створено" else "Список оновлено")
                    onDismiss()
                },
                accent = accent,
            )
        }
    }

    if (confirmDelete && existing != null) {
        ConfirmDialog(
            open = true,
            title = "Видалити список?",
            body = "«${existing.name}» та всі його задачі буде видалено разом із записами часу.",
            confirmLabel = "Видалити",
            onConfirm = {
                confirmDelete = false
                vm.deleteList(existing.id)
                vm.showToast("Список видалено")
                onDismiss()
            },
            onDismiss = { confirmDelete = false },
        )
    }
}
