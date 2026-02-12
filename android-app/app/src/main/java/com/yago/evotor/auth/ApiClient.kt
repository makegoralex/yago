package com.yago.evotor.auth

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import javax.net.ssl.SSLHandshakeException

object ApiClient {
    data class LoginResponse(
        val accessToken: String,
        val refreshToken: String,
        val organizationId: String?,
        val organizationName: String?
    )

    data class RefreshResponse(
        val accessToken: String,
        val refreshToken: String
    )

    data class OrderItem(
        val name: String,
        val qty: Double,
        val total: Double
    )

    data class ActiveOrder(
        val id: String,
        val status: String,
        val total: Double,
        val items: List<OrderItem>
    )

    class ApiException(val statusCode: Int?, override val message: String) : Exception(message)

    data class HealthCheckResult(
        val endpoint: String,
        val statusCode: Int
    )

    fun checkHealth(baseUrl: String): HealthCheckResult {
        val endpoint = baseUrl.trimEnd('/') + "/healthz"
        val connection = openConnection(endpoint, "GET")
        val responseCode = connection.responseCode
        if (responseCode !in 200..299) {
            val errorMessage = extractErrorMessage(readResponse(connection))
            throw ApiException(responseCode, "Healthcheck failed for $endpoint: $errorMessage")
        }

        return HealthCheckResult(endpoint = endpoint, statusCode = responseCode)
    }

    fun login(baseUrl: String, email: String, password: String, organizationId: String?): LoginResponse {
        val endpoint = baseUrl.trimEnd('/') + "/api/auth/login"
        val connection = openConnection(endpoint, "POST")
        connection.setRequestProperty("Content-Type", "application/json")

        val payload = JSONObject()
        payload.put("email", email)
        payload.put("password", password)
        if (!organizationId.isNullOrBlank()) {
            payload.put("organizationId", organizationId)
        }

        connection.outputStream.use { outputStream ->
            outputStream.write(payload.toString().toByteArray())
        }

        val responseText = readResponse(connection)
        if (connection.responseCode !in 200..299) {
            val errorMessage = extractErrorMessage(responseText)
            throw ApiException(connection.responseCode, errorMessage)
        }

        val json = JSONObject(responseText)
        val data = json.getJSONObject("data")
        val user = data.getJSONObject("user")

        return LoginResponse(
            accessToken = data.getString("accessToken"),
            refreshToken = data.getString("refreshToken"),
            organizationId = if (user.has("organizationId")) user.optString("organizationId", null) else null,
            organizationName = if (user.has("organizationName")) user.optString("organizationName", null) else null
        )
    }

    fun refreshTokens(baseUrl: String, refreshToken: String): RefreshResponse {
        val endpoint = baseUrl.trimEnd('/') + "/api/auth/refresh"
        val connection = openConnection(endpoint, "POST")
        connection.setRequestProperty("Content-Type", "application/json")

        val payload = JSONObject()
        payload.put("refreshToken", refreshToken)

        connection.outputStream.use { outputStream ->
            outputStream.write(payload.toString().toByteArray())
        }

        val responseText = readResponse(connection)
        if (connection.responseCode !in 200..299) {
            val errorMessage = extractErrorMessage(responseText)
            throw ApiException(connection.responseCode, errorMessage)
        }

        val json = JSONObject(responseText)
        val data = json.getJSONObject("data")

        return RefreshResponse(
            accessToken = data.getString("accessToken"),
            refreshToken = data.getString("refreshToken")
        )
    }

    fun fetchActiveOrders(baseUrl: String, accessToken: String): List<ActiveOrder> {
        val endpoint = baseUrl.trimEnd('/') + "/api/orders/active"
        val connection = openConnection(endpoint, "GET")
        connection.setRequestProperty("Authorization", "Bearer $accessToken")
        connection.setRequestProperty("Content-Type", "application/json")

        val responseText = readResponse(connection)
        if (connection.responseCode !in 200..299) {
            val errorMessage = extractErrorMessage(responseText)
            throw ApiException(connection.responseCode, errorMessage)
        }

        val json = JSONObject(responseText)
        val dataArray = json.optJSONArray("data") ?: JSONArray()
        val orders = mutableListOf<ActiveOrder>()

        for (i in 0 until dataArray.length()) {
            val orderJson = dataArray.optJSONObject(i) ?: continue
            val itemsArray = orderJson.optJSONArray("items") ?: JSONArray()
            val items = mutableListOf<OrderItem>()

            for (j in 0 until itemsArray.length()) {
                val itemJson = itemsArray.optJSONObject(j) ?: continue
                val name = itemJson.optString("name", "")
                val qty = itemJson.optDouble("qty", 0.0)
                val total = itemJson.optDouble("total", 0.0)
                if (name.isNotBlank()) {
                    items.add(OrderItem(name = name, qty = qty, total = total))
                }
            }

            orders.add(
                ActiveOrder(
                    id = orderJson.optString("_id", ""),
                    status = orderJson.optString("status", ""),
                    total = orderJson.optDouble("total", 0.0),
                    items = items
                )
            )
        }

        return orders
    }

    private fun readResponse(connection: HttpURLConnection): String {
        val reader = try {
            if (connection.responseCode in 200..299) {
                BufferedReader(InputStreamReader(connection.inputStream))
            } else {
                BufferedReader(InputStreamReader(connection.errorStream ?: connection.inputStream))
            }
        } catch (error: Exception) {
            throw ApiException(null, formatConnectionError(error))
        }
        return reader.use { it.readText() }
    }

    private fun openConnection(endpoint: String, method: String): HttpURLConnection {
        try {
            val url = URL(endpoint)
            val connection = url.openConnection() as HttpURLConnection
            connection.requestMethod = method
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", "YagoEvotor/1.0")
            if (method == "POST" || method == "PUT" || method == "PATCH") {
                connection.doOutput = true
            }
            return connection
        } catch (error: Exception) {
            throw ApiException(null, formatConnectionError(error))
        }
    }

    private fun formatConnectionError(error: Throwable): String {
        val chain = generateSequence(error) { it.cause }
            .mapNotNull { cause ->
                val name = cause::class.java.simpleName
                val message = cause.message?.trim().orEmpty()
                if (message.isBlank()) name else "$name: $message"
            }
            .toList()

        val details = chain.joinToString(" -> ")
        return if (error is SSLHandshakeException || chain.any { it.contains("SSL", ignoreCase = true) }) {
            "TLS/SSL error. Проверьте сертификат сервера и цепочку доверия. $details"
        } else {
            details.ifBlank { "Network connection error" }
        }
    }

    private fun extractErrorMessage(responseText: String): String {
        return try {
            val json = JSONObject(responseText)
            when {
                json.has("error") -> json.optString("error", "Unknown error")
                json.has("message") -> json.optString("message", "Unknown error")
                else -> responseText.ifBlank { "Unknown error" }
            }
        } catch (error: Exception) {
            responseText.ifBlank { "Unknown error" }
        }
    }
}
