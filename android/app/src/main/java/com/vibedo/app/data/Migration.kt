package com.vibedo.app.data

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import org.json.JSONTokener
import java.io.ByteArrayInputStream

data class LegacySnapshot(
    val data: AppData? = null,
    val sync: SyncConfig? = null,
    val pomodoro: JSONObject? = null,
    val migrated: Boolean = false,
)

/**
 * Reads the localStorage of the previous Capacitor build (origin https://localhost).
 * The WebView data directory is shared with the old app version, so the values are
 * still available after an APK upgrade.
 */
class LegacyMigration(private val context: Context) {

    private val prefs = context.getSharedPreferences("vibedo", Context.MODE_PRIVATE)

    fun alreadyMigrated(): Boolean = prefs.getBoolean("legacy_migrated_1_0_2", false)

    fun markMigrated() {
        prefs.edit().putBoolean("legacy_migrated_1_0_2", true).apply()
    }

    @SuppressLint("SetJavaScriptEnabled")
    fun migrate(onDone: (LegacySnapshot) -> Unit) {
        if (alreadyMigrated()) {
            onDone(LegacySnapshot())
            return
        }

        // A fresh install has no WebView profile, so there is nothing to migrate and
        // no reason to pay for creating a hidden WebView.
        val webViewDir = java.io.File(context.dataDir, "app_webview")
        if (!webViewDir.exists()) {
            onDone(LegacySnapshot())
            return
        }

        val handler = Handler(Looper.getMainLooper())
        var finished = false
        val webView = WebView(context)

        fun finish(snapshot: LegacySnapshot) {
            if (finished) return
            finished = true
            handler.removeCallbacksAndMessages(null)
            onDone(snapshot)
            handler.post {
                runCatching { webView.stopLoading() }
                runCatching { webView.destroy() }
            }
        }

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false

        val emptyHtml = "<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>"

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?,
            ): WebResourceResponse? {
                val uri = request?.url ?: return null
                val isLegacyOrigin = uri.scheme == "https" && uri.host == "localhost"
                // Everything is served locally, so the hidden WebView never touches the network.
                return WebResourceResponse(
                    if (isLegacyOrigin) "text/html" else "text/plain",
                    "UTF-8",
                    ByteArrayInputStream(
                        (if (isLegacyOrigin) emptyHtml else "").toByteArray(Charsets.UTF_8),
                    ),
                )
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                val script = """
                    (function(){
                      try {
                        return JSON.stringify({
                          data: localStorage.getItem('vibedo-data-v1'),
                          sync: localStorage.getItem('vibedo-sync-v1'),
                          pomodoro: localStorage.getItem('vibedo-pomodoro-v1')
                        });
                      } catch (e) {
                        return JSON.stringify({ error: String(e) });
                      }
                    })()
                """.trimIndent()
                webView.evaluateJavascript(script) { result ->
                    val parsed = runCatching {
                        val value = JSONTokener(result).nextValue()
                        if (value is String) JSONObject(value) else null
                    }.getOrNull()
                    if (parsed == null) {
                        finish(LegacySnapshot())
                        return@evaluateJavascript
                    }
                    val data = parsed.optString("data").takeIf { it.isNotBlank() }?.let { raw ->
                        runCatching { normalizeData(JSONObject(raw)) }.getOrNull()
                    }
                    val sync = parsed.optString("sync").takeIf { it.isNotBlank() }?.let { raw ->
                        runCatching {
                            val json = JSONObject(raw)
                            SyncConfig(
                                enabled = json.optBoolean("enabled", false),
                                auto = json.optBoolean("auto", true),
                                host = json.optString("host", ""),
                                port = json.optInt("port", DEFAULT_SYNC_PORT)
                                    .let { if (it in 1..65535) it else DEFAULT_SYNC_PORT },
                                pin = json.optString("pin", ""),
                                token = json.optString("token", ""),
                                lastSyncAt = if (json.has("lastSyncAt") && !json.isNull("lastSyncAt"))
                                    json.optLong("lastSyncAt") else null,
                            )
                        }.getOrNull()
                    }
                    val pomodoro = parsed.optString("pomodoro").takeIf { it.isNotBlank() }?.let { raw ->
                        runCatching { JSONObject(raw) }.getOrNull()
                    }
                    finish(LegacySnapshot(data, sync, pomodoro, migrated = data != null || sync != null))
                }
            }
        }

        handler.postDelayed({ finish(LegacySnapshot()) }, 3500)

        runCatching {
            webView.loadUrl("https://localhost/")
        }.onFailure {
            Log.w("VibeDo", "Міграція з WebView недоступна", it)
            finish(LegacySnapshot())
        }
    }
}
