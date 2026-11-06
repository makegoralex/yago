package com.yago.evotor.auth

import org.junit.Assert.*
import org.junit.Test
import java.net.SocketTimeoutException
import javax.net.ssl.SSLHandshakeException

class AuthRequestRetryTest {
    @Test fun timeoutThenServerOutageThenSuccessIsRetriedWithBackoff() {
        val pauses = mutableListOf<Long>()
        var calls = 0
        val result = AuthRequestRetry { pauses.add(it) }.execute {
            when (calls++) {
                0 -> throw ApiClient.ApiException(null, "timeout", SocketTimeoutException())
                1 -> throw ApiClient.ApiException(503, "Unavailable")
                else -> "logged-in"
            }
        }
        assertEquals("logged-in", result)
        assertEquals(3, calls)
        assertEquals(listOf(500L, 1500L), pauses)
    }

    @Test fun repeatedTimeoutStopsAfterThreeAttempts() {
        var calls = 0
        assertThrows(ApiClient.ApiException::class.java) {
            AuthRequestRetry {}.execute {
                calls++
                throw ApiClient.ApiException(null, "timeout", SocketTimeoutException())
            }
        }
        assertEquals(3, calls)
    }

    @Test fun credentialsPermissionsTlsAndUnexpectedErrorsAreNotRetried() {
        listOf(
            ApiClient.ApiException(400, "Invalid input"),
            ApiClient.ApiException(401, "Invalid credentials"),
            ApiClient.ApiException(403, "Forbidden"),
            ApiClient.ApiException(429, "Rate limited"),
            ApiClient.ApiException(null, "TLS", SSLHandshakeException("certificate")),
            ApiClient.ApiException(null, "Unexpected error")
        ).forEach { error ->
            var calls = 0
            val result = assertThrows(ApiClient.ApiException::class.java) {
                AuthRequestRetry { fail("Must not retry") }.execute { calls++; throw error }
            }
            assertSame(error, result)
            assertEquals(1, calls)
        }
    }
}
