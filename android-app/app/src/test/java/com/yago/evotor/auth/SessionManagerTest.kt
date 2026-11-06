package com.yago.evotor.auth

import org.junit.Assert.*
import org.junit.Test
import java.net.SocketTimeoutException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class SessionManagerTest {
    private val original = Session("expired-access", "valid-refresh", "org", "Shop", "https://example.com")
    private val renewed = original.copy(accessToken = "new-access", refreshToken = "new-refresh")

    private class MemoryStore(var session: Session?) : SessionStore {
        @Synchronized override fun loadSession() = session
        @Synchronized override fun replaceIfMatches(expected: Session, updated: Session): Boolean {
            if (session != expected) return false
            session = updated
            return true
        }
        @Synchronized override fun clearIfMatches(expected: Session): Boolean {
            if (session != expected) return false
            session = null
            return true
        }
    }

    private fun read(session: Session): String {
        if (session == original) throw ApiClient.ApiException(401, "Expired access token")
        return session.accessToken
    }

    @Test fun temporaryRefreshFailuresKeepSessionAndNextPollRecovers() {
        val errors = listOf(
            ApiClient.ApiException(null, "timeout", SocketTimeoutException()),
            ApiClient.ApiException(503, "Unavailable"),
            ApiClient.ApiException(403, "Proxy denial")
        )
        errors.forEach { error ->
            val store = MemoryStore(original)
            var attempts = 0
            val manager = SessionManager(store) {
                if (attempts++ == 0) throw error
                renewed
            }
            assertSame(error, assertThrows(ApiClient.ApiException::class.java) { manager.withSession(::read) })
            assertEquals(original, store.session)
            assertEquals(renewed.accessToken, manager.withSession(::read))
            assertEquals(renewed, store.session)
        }
    }

    @Test fun invalidRefreshTokenClearsSession() {
        val store = MemoryStore(original)
        val manager = SessionManager(store) { throw ApiClient.ApiException(401, "Invalid refresh token") }
        assertThrows(SessionExpiredException::class.java) { manager.withSession(::read) }
        assertNull(store.session)
    }

    @Test fun permissionDenialDoesNotRefreshOrLogOut() {
        val store = MemoryStore(original)
        val manager = SessionManager(store) { error("Must not refresh on 403") }
        assertThrows(ApiClient.ApiException::class.java) {
            manager.withSession { throw ApiClient.ApiException(403, "Forbidden") }
        }
        assertEquals(original, store.session)
    }

    @Test fun successfulRefreshIsSavedAndRequestRetriedOnlyOnce() {
        val store = MemoryStore(original)
        var refreshes = 0
        var requests = 0
        val manager = SessionManager(store) { refreshes++; renewed }
        assertThrows(ApiClient.ApiException::class.java) {
            manager.withSession { requests++; throw ApiClient.ApiException(401, "Still unauthorized") }
        }
        assertEquals(1, refreshes)
        assertEquals(2, requests)
        assertEquals(renewed, store.session)
    }

    @Test fun concurrentUnauthorizedRequestsShareOneRefresh() {
        val store = MemoryStore(original)
        val started = CountDownLatch(2)
        val refreshes = AtomicInteger()
        val executor = Executors.newFixedThreadPool(2)
        try {
            val results = (1..2).map {
                executor.submit<String> {
                    SessionManager(store) { refreshes.incrementAndGet(); renewed }.withSession { session ->
                        if (session == original) {
                            started.countDown()
                            check(started.await(5, TimeUnit.SECONDS))
                        }
                        read(session)
                    }
                }
            }
            results.forEach { assertEquals(renewed.accessToken, it.get(5, TimeUnit.SECONDS)) }
            assertEquals(1, refreshes.get())
            assertEquals(renewed, store.session)
        } finally {
            executor.shutdownNow()
        }
    }

    @Test fun logoutDuringRefreshDoesNotRestoreSession() {
        val store = MemoryStore(original)
        val manager = SessionManager(store) { store.clearIfMatches(original); renewed }
        assertThrows(SessionExpiredException::class.java) { manager.withSession(::read) }
        assertNull(store.session)
    }

    @Test fun lateRefreshDoesNotOverwriteNewLogin() {
        val store = MemoryStore(original)
        val newLogin = renewed.copy(accessToken = "another-login")
        val manager = SessionManager(store) { store.replaceIfMatches(original, newLogin); renewed }
        assertEquals(newLogin.accessToken, manager.withSession(::read))
        assertEquals(newLogin, store.session)
    }

    @Test fun lateRefreshRejectionDoesNotClearNewLogin() {
        val store = MemoryStore(original)
        val manager = SessionManager(store) {
            store.replaceIfMatches(original, renewed)
            throw ApiClient.ApiException(401, "Invalid old refresh token")
        }
        assertThrows(ApiClient.ApiException::class.java) { manager.withSession(::read) }
        assertEquals(renewed, store.session)
    }

    @Test fun unexpectedRefreshFailureKeepsSession() {
        val store = MemoryStore(original)
        val manager = SessionManager(store) { throw IllegalStateException("Malformed response") }
        assertThrows(IllegalStateException::class.java) { manager.withSession(::read) }
        assertEquals(original, store.session)
    }
}
