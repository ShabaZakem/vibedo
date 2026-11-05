package com.vibedo.app.data

import org.json.JSONObject
import java.io.BufferedReader
import java.net.ConnectException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL

data class SyncOutcome(
    val ok: Boolean,
    val data: AppData? = null,
    val message: String = "",
    val lastSyncAt: Long? = null,
    val offline: Boolean = false,
    val token: String? = null,
)

class SyncClient {

    private fun baseUrl(config: SyncConfig): String {
        val host = config.host.trim()
            .removePrefix("http://")
            .removePrefix("https://")
            .substringBefore('/')
        return "http://$host:${config.port}"
    }

    private fun request(
        url: String,
        method: String,
        body: String? = null,
        token: String? = null,
        timeout: Int = 8000,
    ): Pair<Int, String> {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = timeout
            readTimeout = timeout
            instanceFollowRedirects = true
            setRequestProperty("Accept", "application/json")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
            if (token != null) setRequestProperty("Authorization", "Bearer $token")
        }
        try {
            if (body != null) {
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use(BufferedReader::readText) ?: ""
            return code to text
        } finally {
            connection.disconnect()
        }
    }

    fun pair(config: SyncConfig): Result<String> = runCatching {
        val payload = JSONObject().put("pin", config.pin).toString()
        val (code, text) = request("${baseUrl(config)}/api/pair", "POST", payload)
        val json = if (text.isBlank()) JSONObject() else JSONObject(text)
        if (code == 200 && json.optBoolean("ok") && json.optString("token").isNotBlank()) {
            json.optString("token")
        } else {
            throw IllegalStateException(json.optString("error", "Невірний PIN"))
        }
    }

    fun sync(config: SyncConfig, local: AppData): SyncOutcome {
        if (config.host.isBlank()) {
            return SyncOutcome(false, message = "Вкажіть адресу комп’ютера")
        }
        return try {
            var token = config.token
            if (token.isBlank()) {
                val paired = pair(config)
                token = paired.getOrElse { return SyncOutcome(false, message = it.message ?: "Невірний PIN") }
            }

            var (code, text) = request(
                "${baseUrl(config)}/api/sync",
                "POST",
                snapshot(local).toJson().toString(),
                token,
            )

            if (code == 401) {
                val paired = pair(config)
                token = paired.getOrElse { return SyncOutcome(false, message = "Невірний PIN або сесія застаріла") }
                val retry = request(
                    "${baseUrl(config)}/api/sync",
                    "POST",
                    snapshot(local).toJson().toString(),
                    token,
                )
                code = retry.first
                text = retry.second
            }

            if (code !in 200..299) {
                val error = runCatching { JSONObject(text).optString("error") }.getOrDefault("")
                return SyncOutcome(
                    false,
                    message = error.ifBlank { "Невірний PIN або сесія застаріла" },
                )
            }

            val json = JSONObject(text)
            val merged = normalizeData(json)
            SyncOutcome(true, merged, "Синхронізовано", System.currentTimeMillis(), token = token)
        } catch (error: Throwable) {
            val offline = error is ConnectException || error is SocketTimeoutException ||
                error.message?.contains("Failed to connect", true) == true ||
                error.message?.contains("timeout", true) == true
            SyncOutcome(
                false,
                message = if (offline) "Комп’ютер недоступний у цій мережі" else "Не вдалося синхронізувати дані",
                offline = offline,
            )
        }
    }

    data class HealthResult(val ok: Boolean, val name: String, val version: String, val error: String = "")

    fun health(host: String, port: Int): HealthResult {
        if (host.isBlank()) return HealthResult(false, "", "", "Вкажіть адресу комп’ютера")
        return try {
            val cleanHost = host.trim().removePrefix("http://").removePrefix("https://").substringBefore('/')
            val (code, text) = request("http://$cleanHost:$port/api/health", "GET", timeout = 4000)
            if (code == 200) {
                val json = JSONObject(text)
                HealthResult(true, json.optString("app", "VibeDo"), json.optString("version", "1.0.2"))
            } else {
                HealthResult(false, "", "", "Комп’ютер не відповідає")
            }
        } catch (error: Throwable) {
            HealthResult(false, "", "", "Комп’ютер не відповідає")
        }
    }
}
