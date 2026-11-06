package com.yago.evotor.auth

import java.io.IOException
import javax.net.ssl.SSLException

/** Only for login/refresh, never for payments, order creation or receipt commands. */
internal class AuthRequestRetry(private val pause: (Long) -> Unit = { Thread.sleep(it) }) {
    fun <T> execute(request: () -> T): T {
        val delays = longArrayOf(500, 1500)
        var attempt = 0
        while (true) {
            try {
                return request()
            } catch (error: ApiClient.ApiException) {
                val temporary = error.statusCode in listOf(408, 500, 502, 503, 504) ||
                    (error.statusCode == null && error.cause is IOException && error.cause !is SSLException)
                if (!temporary || attempt >= delays.size) throw error
                pause(delays[attempt++])
            }
        }
    }
}
