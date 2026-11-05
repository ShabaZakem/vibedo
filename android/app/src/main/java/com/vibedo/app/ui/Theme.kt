package com.vibedo.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.vibedo.app.data.Settings

data class VibePalette(
    val bg: Color,
    val surface: Color,
    val surface2: Color,
    val surface3: Color,
    val sidebar: Color,
    val border: Color,
    val borderStrong: Color,
    val text: Color,
    val text2: Color,
    val text3: Color,
    val hover: Color,
    val active: Color,
    val danger: Color,
    val dangerSoft: Color,
    val success: Color,
    val successSoft: Color,
    val warning: Color,
    val warningSoft: Color,
    val shadow: Color,
    val isDark: Boolean,
)

val LightPalette = VibePalette(
    bg = Color(0xFFFBFBFA),
    surface = Color(0xFFFFFFFF),
    surface2 = Color(0xFFF7F7F5),
    surface3 = Color(0xFFF1F1EF),
    sidebar = Color(0xFFF7F7F5),
    border = Color(0xFFE9E9E7),
    borderStrong = Color(0xFFDEDEDC),
    text = Color(0xFF37352F),
    text2 = Color(0xFF6F6E69),
    text3 = Color(0xFF9B9A97),
    hover = Color(0x0E37352F),
    active = Color(0x1737352F),
    danger = Color(0xFFD44C47),
    dangerSoft = Color(0x1CD44C47),
    success = Color(0xFF0F7B6C),
    successSoft = Color(0x1F0F7B6C),
    warning = Color(0xFFCB912F),
    warningSoft = Color(0x21CB912F),
    shadow = Color(0x1F0F0F0F),
    isDark = false,
)

val DarkPalette = VibePalette(
    bg = Color(0xFF191919),
    surface = Color(0xFF202020),
    surface2 = Color(0xFF252525),
    surface3 = Color(0xFF2C2C2C),
    sidebar = Color(0xFF202020),
    border = Color(0xFF2F2F2F),
    borderStrong = Color(0xFF3D3D3D),
    text = Color(0xFFE9E9E7),
    text2 = Color(0xFFA5A4A1),
    text3 = Color(0xFF7C7B78),
    hover = Color(0x14FFFFFF),
    active = Color(0x1FFFFFFF),
    danger = Color(0xFFEB5757),
    dangerSoft = Color(0x26EB5757),
    success = Color(0xFF4EC9B6),
    successSoft = Color(0x264EC9B6),
    warning = Color(0xFFE5B454),
    warningSoft = Color(0x26E5B454),
    shadow = Color(0x66000000),
    isDark = true,
)

val LocalVibe = staticCompositionLocalOf { LightPalette }

fun String.toComposeColor(fallback: Color = Color(0xFF2383E2)): Color =
    runCatching { Color(android.graphics.Color.parseColor(this)) }.getOrDefault(fallback)

private val VibeTypography = Typography(
    displaySmall = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Bold, fontSize = 32.sp, letterSpacing = (-0.5).sp),
    headlineMedium = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Bold, fontSize = 24.sp, letterSpacing = (-0.3).sp),
    headlineSmall = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.SemiBold, fontSize = 20.sp),
    titleLarge = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.SemiBold, fontSize = 17.sp),
    titleMedium = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Medium, fontSize = 15.sp),
    titleSmall = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Medium, fontSize = 13.sp),
    bodyLarge = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Normal, fontSize = 12.5.sp, lineHeight = 17.sp),
    labelLarge = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Medium, fontSize = 14.sp),
    labelMedium = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Medium, fontSize = 12.sp),
    labelSmall = TextStyle(fontFamily = FontFamily.Default, fontWeight = FontWeight.Medium, fontSize = 10.5.sp, letterSpacing = 0.4.sp),
)

@Composable
fun VibeTheme(settings: Settings, content: @Composable () -> Unit) {
    val dark = when (settings.theme) {
        "dark" -> true
        "light" -> false
        else -> isSystemInDarkTheme()
    }
    val palette = if (dark) DarkPalette else LightPalette
    val accent = settings.accent.toComposeColor()
    val scheme = if (dark) {
        darkColorScheme(
            primary = accent,
            onPrimary = Color.White,
            background = palette.bg,
            onBackground = palette.text,
            surface = palette.surface,
            onSurface = palette.text,
            surfaceVariant = palette.surface2,
            onSurfaceVariant = palette.text2,
            outline = palette.borderStrong,
            error = palette.danger,
        )
    } else {
        lightColorScheme(
            primary = accent,
            onPrimary = Color.White,
            background = palette.bg,
            onBackground = palette.text,
            surface = palette.surface,
            onSurface = palette.text,
            surfaceVariant = palette.surface2,
            onSurfaceVariant = palette.text2,
            outline = palette.borderStrong,
            error = palette.danger,
        )
    }
    CompositionLocalProvider(LocalVibe provides palette) {
        MaterialTheme(colorScheme = scheme, typography = VibeTypography, content = content)
    }
}
