package com.vibedo.app.data

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.io.File

class DataStorage(private val context: Context) {

    private val dataFile = File(context.filesDir, "vibedo-data.json")
    private val syncFile = File(context.filesDir, "vibedo-sync.json")

    fun hasData(): Boolean = dataFile.exists() && dataFile.length() > 2

    fun load(): AppData? {
        if (!hasData()) return null
        return runCatching {
            normalizeData(JSONObject(dataFile.readText(Charsets.UTF_8)))
        }.onFailure { Log.w("VibeDo", "Не вдалося прочитати дані", it) }.getOrNull()
    }

    fun save(data: AppData): Boolean = runCatching {
        val tmp = File(context.filesDir, "vibedo-data.tmp")
        tmp.writeText(snapshot(data).toJson().toString(), Charsets.UTF_8)
        if (dataFile.exists() && !dataFile.delete()) {
            tmp.copyTo(dataFile, overwrite = true)
            tmp.delete()
        } else if (!tmp.renameTo(dataFile)) {
            tmp.copyTo(dataFile, overwrite = true)
            tmp.delete()
        }
        true
    }.onFailure { Log.w("VibeDo", "Не вдалося зберегти дані", it) }.getOrDefault(false)

    fun loadSync(): SyncConfig {
        val defaults = SyncConfig(pin = makePin())
        if (!syncFile.exists()) return saveSync(defaults)
        return runCatching {
            val raw = JSONObject(syncFile.readText(Charsets.UTF_8))
            val pin = raw.optString("pin", "")
            val validPin = Regex("^\\d{4,8}$").matches(pin)
            val config = defaults.copy(
                enabled = raw.optBoolean("enabled", false),
                auto = raw.optBoolean("auto", true),
                host = raw.optString("host", "").trim(),
                port = raw.optInt("port", DEFAULT_SYNC_PORT).let { if (it in 1..65535) it else DEFAULT_SYNC_PORT },
                pin = if (validPin) pin else makePin(),
                token = raw.optString("token", ""),
                lastSyncAt = if (raw.has("lastSyncAt") && !raw.isNull("lastSyncAt")) raw.optLong("lastSyncAt") else null,
            )
            if (validPin) config else saveSync(config)
        }.getOrDefault(saveSync(defaults))
    }

    fun saveSync(config: SyncConfig): SyncConfig {
        runCatching {
            val raw = JSONObject().apply {
                put("enabled", config.enabled)
                put("auto", config.auto)
                put("host", config.host)
                put("port", config.port)
                put("pin", config.pin)
                put("token", config.token)
                if (config.lastSyncAt == null) put("lastSyncAt", JSONObject.NULL) else put("lastSyncAt", config.lastSyncAt)
            }
            val tmp = File(context.filesDir, "vibedo-sync.tmp")
            tmp.writeText(raw.toString(), Charsets.UTF_8)
            if (syncFile.exists() && !syncFile.delete()) {
                tmp.copyTo(syncFile, overwrite = true)
                tmp.delete()
            } else if (!tmp.renameTo(syncFile)) {
                tmp.copyTo(syncFile, overwrite = true)
                tmp.delete()
            }
            Unit
        }
        return config
    }

    fun exportJson(data: AppData): String = data.toJson().toString(2)
}

fun makePin(): String = (100000 + (Math.random() * 900000).toInt()).toString()
