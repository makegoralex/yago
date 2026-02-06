package com.yago.evotor.auth

import android.content.Context
import android.content.SharedPreferences

class SessionStorage(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun saveSession(session: Session) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, session.accessToken)
            .putString(KEY_REFRESH_TOKEN, session.refreshToken)
            .putString(KEY_ORG_ID, session.organizationId)
            .putString(KEY_BASE_URL, session.baseUrl)
            .apply()
    }

    fun loadSession(): Session? {
        val accessToken = prefs.getString(KEY_ACCESS_TOKEN, null) ?: return null
        val refreshToken = prefs.getString(KEY_REFRESH_TOKEN, null) ?: return null
        val baseUrl = prefs.getString(KEY_BASE_URL, null) ?: return null
        val organizationId = prefs.getString(KEY_ORG_ID, null)

        return Session(accessToken, refreshToken, organizationId, baseUrl)
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val PREFS_NAME = "yago_evotor_session"
        private const val KEY_ACCESS_TOKEN = "accessToken"
        private const val KEY_REFRESH_TOKEN = "refreshToken"
        private const val KEY_ORG_ID = "organizationId"
        private const val KEY_BASE_URL = "baseUrl"
    }
}


data class Session(
    val accessToken: String,
    val refreshToken: String,
    val organizationId: String?,
    val baseUrl: String
)
