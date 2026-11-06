package com.yago.evotor.auth

interface SessionStore {
    fun loadSession(): Session?
    fun replaceIfMatches(expected: Session, updated: Session): Boolean
    fun clearIfMatches(expected: Session): Boolean
}

class SessionExpiredException : Exception()

class SessionManager(
    private val store: SessionStore,
    private val refresh: (Session) -> Session = { session ->
        val tokens = ApiClient.refreshTokens(session.baseUrl, session.refreshToken)
        session.copy(accessToken = tokens.accessToken, refreshToken = tokens.refreshToken)
    }
) {
    // Shared across activity instances, including recreation while a request is running.
    companion object {
        private val refreshLock = Any()
    }

    fun <T> withSession(request: (Session) -> T): T {
        val session = store.loadSession() ?: throw SessionExpiredException()
        try {
            return request(session)
        } catch (error: ApiClient.ApiException) {
            // A permission denial (403) must not refresh or discard a valid session.
            if (error.statusCode != 401) throw error
        }

        val updated = synchronized(refreshLock) {
            val latest = store.loadSession() ?: throw SessionExpiredException()
            if (latest != session) {
                latest
            } else {
                val refreshed = try {
                    refresh(latest)
                } catch (error: ApiClient.ApiException) {
                    if (error.statusCode == 401 && store.clearIfMatches(latest)) {
                        throw SessionExpiredException()
                    }
                    // Timeouts, server errors and proxy denials leave tokens intact.
                    throw error
                }
                // Do not resurrect a session after logout or overwrite a newer login.
                if (store.replaceIfMatches(latest, refreshed)) refreshed
                else store.loadSession() ?: throw SessionExpiredException()
            }
        }
        return request(updated)
    }
}
