package com.vibedo.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.delay
import kotlin.math.max

@Composable
fun LogoMark(size: Dp = 28.dp, accent: Color = Color(0xFF2383E2)) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(size * 0.28f))
            .background(Brush.linearGradient(listOf(accent, accent.copy(alpha = 0.72f)))),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "V",
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = (size.value * 0.52f).sp,
        )
    }
}

@Composable
fun RoundCheck(
    checked: Boolean,
    onToggle: () -> Unit,
    accent: Color,
    size: Dp = 20.dp,
) {
    val scale by animateFloatAsState(if (checked) 1f else 0f, label = "check")
    Box(
        modifier = Modifier
            .size(size + 10.dp)
            .clickable(onClick = onToggle),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(size)
                .clip(CircleShape)
                .background(if (checked) accent else Color.Transparent)
                .border(
                    width = 1.5.dp,
                    color = if (checked) accent else LocalVibe.current.text3.copy(alpha = 0.6f),
                    shape = CircleShape,
                ),
            contentAlignment = Alignment.Center,
        ) {
            if (scale > 0.01f) {
                Icon(
                    imageVector = Icons.Rounded.Check,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(size * 0.72f),
                )
            }
        }
    }
}

@Composable
fun VibeCard(
    modifier: Modifier = Modifier,
    padding: Dp = 16.dp,
    content: @Composable () -> Unit,
) {
    val p = LocalVibe.current
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(p.surface)
            .border(1.dp, p.border, RoundedCornerShape(12.dp))
            .padding(padding),
    ) {
        content()
    }
}

@Composable
fun VDButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = Color(0xFF2383E2),
    filled: Boolean = true,
    icon: ImageVector? = null,
    enabled: Boolean = true,
) {
    val p = LocalVibe.current
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (filled) accent else Color.Transparent)
            .border(1.dp, if (filled) Color.Transparent else p.borderStrong, RoundedCornerShape(8.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (icon != null) {
            Icon(
                icon,
                contentDescription = null,
                tint = if (filled) Color.White else p.text2,
                modifier = Modifier.size(16.dp),
            )
            Spacer(Modifier.width(6.dp))
        }
        Text(
            text = text,
            color = if (filled) Color.White else p.text,
            fontSize = 13.5.sp,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
fun VibeIconButton(
    icon: ImageVector,
    contentDescription: String?,
    onClick: () -> Unit,
    tint: Color? = null,
    size: Dp = 34.dp,
    iconSize: Dp = 18.dp,
    enabled: Boolean = true,
) {
    val p = LocalVibe.current
    Box(
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(7.dp))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = tint ?: p.text2,
            modifier = Modifier.size(iconSize),
        )
    }
}

@Composable
fun VibeTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    singleLine: Boolean = true,
    minLines: Int = 1,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    textStyle: TextStyle = LocalTextStyle.current,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    accent: Color = Color(0xFF2383E2),
) {
    val p = LocalVibe.current
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(p.surface2)
            .border(1.dp, p.border, RoundedCornerShape(8.dp))
            .padding(horizontal = 12.dp, vertical = if (singleLine) 9.dp else 11.dp),
        verticalAlignment = if (singleLine) Alignment.CenterVertically else Alignment.Top,
    ) {
        if (leading != null) {
            leading()
            Spacer(Modifier.width(8.dp))
        }
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) {
                Text(placeholder, color = p.text3, fontSize = textStyle.fontSize, maxLines = if (singleLine) 1 else 3)
            }
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = singleLine,
                minLines = minLines,
                textStyle = textStyle.copy(color = p.text),
                cursorBrush = SolidColor(accent),
                keyboardOptions = keyboardOptions,
                keyboardActions = keyboardActions,
                visualTransformation = visualTransformation,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (trailing != null) {
            Spacer(Modifier.width(6.dp))
            trailing()
        }
    }
}

@Composable
fun VibeSwitch(checked: Boolean, onChange: (Boolean) -> Unit, accent: Color) {
    val p = LocalVibe.current
    Box(
        modifier = Modifier
            .width(42.dp)
            .height(24.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (checked) accent else p.surface3)
            .border(1.dp, if (checked) Color.Transparent else p.borderStrong, RoundedCornerShape(12.dp))
            .clickable { onChange(!checked) }
            .padding(3.dp),
        contentAlignment = if (checked) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(
            Modifier
                .size(18.dp)
                .clip(CircleShape)
                .background(Color.White)
                .shadow(2.dp, CircleShape),
        )
    }
}

data class SegmentOption(val value: String, val label: String)

@Composable
fun Segmented(
    options: List<SegmentOption>,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    accent: Color = Color(0xFF2383E2),
) {
    val p = LocalVibe.current
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(p.surface2)
            .border(1.dp, p.border, RoundedCornerShape(8.dp))
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        options.forEach { option ->
            val active = option.value == selected
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (active) p.surface else Color.Transparent)
                    .clickable { onSelect(option.value) }
                    .padding(vertical = 7.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    option.label,
                    color = if (active) p.text else p.text2,
                    fontSize = 12.5.sp,
                    fontWeight = if (active) FontWeight.Medium else FontWeight.Normal,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
fun Chip(
    text: String,
    color: Color,
    onRemove: (() -> Unit)? = null,
    onClick: (() -> Unit)? = null,
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(5.dp))
            .background(color.copy(alpha = 0.14f))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 7.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, color = color, fontSize = 11.5.sp, fontWeight = FontWeight.Medium, maxLines = 1)
        if (onRemove != null) {
            Spacer(Modifier.width(3.dp))
            Icon(
                Icons.Rounded.Close,
                contentDescription = "Прибрати",
                tint = color.copy(alpha = 0.8f),
                modifier = Modifier
                    .size(12.dp)
                    .clickable(onClick = onRemove),
            )
        }
    }
}

@Composable
fun VibeDialog(
    onDismiss: () -> Unit,
    title: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val p = LocalVibe.current
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier = modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp)
                .widthIn(max = 520.dp)
                .shadow(24.dp, RoundedCornerShape(14.dp)),
            shape = RoundedCornerShape(14.dp),
            color = p.surface,
            border = BorderStroke(1.dp, p.border),
        ) {
            Column(Modifier.padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(title, style = androidx.compose.material3.MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                    VibeIconButton(Icons.Rounded.Close, "Закрити", onDismiss, size = 28.dp, iconSize = 16.dp)
                }
                Spacer(Modifier.height(14.dp))
                content()
            }
        }
    }
}

@Composable
fun ConfirmDialog(
    open: Boolean,
    title: String,
    body: String,
    confirmLabel: String = "Видалити",
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    if (!open) return
    val p = LocalVibe.current
    VibeDialog(onDismiss = onDismiss, title = title) {
        Text(body, color = p.text2, fontSize = 14.sp, lineHeight = 20.sp)
        Spacer(Modifier.height(18.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Spacer(Modifier.weight(1f))
            VDButton("Скасувати", onDismiss, filled = false)
            VDButton(confirmLabel, onConfirm, accent = p.danger)
        }
    }
}

@Composable
fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        color = LocalVibe.current.text3,
        fontSize = 10.5.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.6.sp,
        modifier = Modifier.padding(horizontal = 4.dp, vertical = 6.dp),
    )
}

@Composable
fun EmptyState(title: String, body: String, icon: ImageVector? = null) {
    val p = LocalVibe.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 46.dp, horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (icon != null) {
            Box(
                Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(p.surface2),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, null, tint = p.text3, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.height(12.dp))
        }
        Text(title, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = p.text)
        Spacer(Modifier.height(4.dp))
        Text(body, color = p.text3, fontSize = 13.sp, textAlign = TextAlign.Center, lineHeight = 19.sp)
    }
}

@Composable
fun ToastHost(message: String?, onDone: () -> Unit) {
    val p = LocalVibe.current
    LaunchedEffect(message) {
        if (message != null) {
            delay(2200)
            onDone()
        }
    }
    AnimatedVisibility(visible = message != null, enter = fadeIn(), exit = fadeOut()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
            Surface(
                modifier = Modifier.padding(bottom = 88.dp, start = 24.dp, end = 24.dp),
                shape = RoundedCornerShape(9.dp),
                color = if (p.isDark) Color(0xFF2F2F2F) else Color(0xFF37352F),
                shadowElevation = 12.dp,
            ) {
                Text(
                    message ?: "",
                    color = Color.White,
                    fontSize = 13.5.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 11.dp),
                )
            }
        }
    }
}

data class ChartPoint(val label: String, val value: Double)

@Composable
fun BarChart(
    points: List<ChartPoint>,
    color: Color,
    modifier: Modifier = Modifier,
    height: Dp = 120.dp,
    showLabels: Boolean = true,
    formatValue: (Double) -> String = { it.toInt().toString() },
) {
    val p = LocalVibe.current
    val maxValue = max(points.maxOfOrNull { it.value } ?: 0.0, 0.0001)
    Column(modifier) {
        Row(
            modifier = Modifier.fillMaxWidth().height(height),
            horizontalArrangement = Arrangement.spacedBy(if (points.size > 14) 2.dp else 6.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            points.forEach { point ->
                Column(
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                    verticalArrangement = Arrangement.Bottom,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .fillMaxHeight((point.value / maxValue).toFloat().coerceIn(0.02f, 1f))
                            .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                            .background(if (point.value > 0) color.copy(alpha = 0.72f) else p.surface3),
                    )
                }
            }
        }
        val step = if (points.size > 14) 5 else 1
        if (showLabels) {
            Spacer(Modifier.height(6.dp))
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(if (points.size > 14) 2.dp else 6.dp),
            ) {
                points.forEachIndexed { index, point ->
                    Text(
                        text = if (index % step == 0) point.label else "",
                        modifier = Modifier.weight(1f),
                        color = p.text3,
                        fontSize = 9.sp,
                        textAlign = TextAlign.Center,
                        maxLines = 1,
                        overflow = TextOverflow.Clip,
                    )
                }
            }
        }
    }
}

@Composable
fun StatTile(
    label: String,
    value: String,
    hint: String? = null,
    icon: ImageVector? = null,
    tint: Color? = null,
    modifier: Modifier = Modifier,
) {
    val p = LocalVibe.current
    VibeCard(modifier = modifier, padding = 14.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                Box(
                    Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(7.dp))
                        .background((tint ?: p.text2).copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(icon, null, tint = tint ?: p.text2, modifier = Modifier.size(15.dp))
                }
                Spacer(Modifier.width(8.dp))
            }
            Text(label, color = p.text2, fontSize = 12.sp, maxLines = 1)
        }
        Spacer(Modifier.height(8.dp))
        Text(value, color = p.text, fontSize = 19.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        if (hint != null) {
            Spacer(Modifier.height(2.dp))
            Text(hint, color = p.text3, fontSize = 11.sp, maxLines = 1)
        }
    }
}

@Composable
fun ValueRow(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    valueColor: Color? = null,
) {
    val p = LocalVibe.current
    Row(
        modifier = modifier.fillMaxWidth().padding(vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = p.text2, fontSize = 13.sp, modifier = Modifier.weight(1f))
        Text(value, color = valueColor ?: p.text, fontSize = 13.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun DividerLine(modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(LocalVibe.current.border),
    )
}

@Composable
fun ClickableRow(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val interaction = remember { MutableInteractionSource() }
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        content()
    }
}
