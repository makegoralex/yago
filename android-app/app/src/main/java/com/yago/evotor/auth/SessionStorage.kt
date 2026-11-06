package com.yago.evotor.auth

import android.content.Context
import android.content.SharedPreferences

class SessionStorage(context: Context) : SessionStore {
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun saveSession(session: Session) = synchronized(lock) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, session.accessToken)
            .putString(KEY_REFRESH_TOKEN, session.refreshToken)
            .putString(KEY_ORG_ID, session.organizationId)
            .putString(KEY_ORG_NAME, session.organizationName)
            .putString(KEY_BASE_URL, session.baseUrl)
            .apply()
    }

    override fun loadSession(): Session? = synchronized(lock) {
        val accessToken = prefs.getString(KEY_ACCESS_TOKEN, null) ?: return@synchronized null
        val refreshToken = prefs.getString(KEY_REFRESH_TOKEN, null) ?: return@synchronized null
        val baseUrl = prefs.getString(KEY_BASE_URL, null) ?: return@synchronized null
        val organizationId = prefs.getString(KEY_ORG_ID, null)
        val organizationName = prefs.getString(KEY_ORG_NAME, null)

        Session(accessToken, refreshToken, organizationId, organizationName, baseUrl)
    }

    fun clear() = synchronized(lock) {
        prefs.edit().clear().apply()
    }

    override fun replaceIfMatches(expected: Session, updated: Session): Boolean = synchronized(lock) {
        if (loadSession() != expected) return@synchronized false
        saveSession(updated)
        true
    }

    override fun clearIfMatches(expected: Session): Boolean = synchronized(lock) {
        if (loadSession() != expected) return@synchronized false
        clear()
        true
    }

    companion object {
        private val lock = Any()
        private const val PREFS_NAME = "yago_evotor_session"
        private const val KEY_ACCESS_TOKEN = "accessToken"
        private const val KEY_REFRESH_TOKEN = "refreshToken"
        private const val KEY_ORG_ID = "organizationId"
        private const val KEY_ORG_NAME = "organizationName"
        private const val KEY_BASE_URL = "baseUrl"
    }
}


data class Session(
    val accessToken: String,
    val refreshToken: String,
    val organizationId: String?,
    val organizationName: String?,
    val baseUrl: String
)
