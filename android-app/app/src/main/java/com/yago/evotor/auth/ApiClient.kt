package com.yago.evotor.auth

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLHandshakeException

object ApiClient {
    private const val CONNECT_TIMEOUT_MS = 5_000L
    private const val READ_TIMEOUT_MS = 10_000L
    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        // Evotor proxy docs: connection timeout 5s, response timeout 10s.
        .connectTimeout(CONNECT_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        .readTimeout(READ_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        .build()

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
        val response = executeRequest(endpoint = endpoint, method = "GET")
        if (response.statusCode !in 200..299) {
            val errorMessage = extractErrorMessage(response.body)
            throw ApiException(response.statusCode, "Healthcheck failed for $endpoint: $errorMessage")
        }

        return HealthCheckResult(endpoint = endpoint, statusCode = response.statusCode)
    }

    fun login(baseUrl: String, email: String, password: String, organizationId: String?): LoginResponse {
        val endpoint = baseUrl.trimEnd('/') + "/api/auth/login"

        val payload = JSONObject()
        payload.put("email", email)
        payload.put("password", password)
        if (!organizationId.isNullOrBlank()) {
            payload.put("organizationId", organizationId)
        }

        val response = executeRequest(endpoint = endpoint, method = "POST", payload = payload)
        if (response.statusCode !in 200..299) {
            val errorMessage = extractErrorMessage(response.body)
            throw ApiException(response.statusCode, errorMessage)
        }

        val json = JSONObject(response.body)
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

        val payload = JSONObject()
        payload.put("refreshToken", refreshToken)

        val response = executeRequest(endpoint = endpoint, method = "POST", payload = payload)
        if (response.statusCode !in 200..299) {
            val errorMessage = extractErrorMessage(response.body)
            throw ApiException(response.statusCode, errorMessage)
        }

        val json = JSONObject(response.body)
        val data = json.getJSONObject("data")

        return RefreshResponse(
            accessToken = data.getString("accessToken"),
            refreshToken = data.getString("refreshToken")
        )
    }

    fun fetchActiveOrders(baseUrl: String, accessToken: String): List<ActiveOrder> {
        val endpoint = baseUrl.trimEnd('/') + "/api/orders/active"
        val response = executeRequest(
            endpoint = endpoint,
            method = "GET",
            extraHeaders = mapOf("X-Yago-App-Token" to accessToken)
        )

        if (response.statusCode !in 200..299) {
            val errorMessage = extractErrorMessage(response.body)
            throw ApiException(response.statusCode, errorMessage)
        }

        val json = JSONObject(response.body)
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

    private data class HttpResponse(
        val statusCode: Int,
        val body: String
    )

    private fun executeRequest(
        endpoint: String,
        method: String,
        payload: JSONObject? = null,
        extraHeaders: Map<String, String> = emptyMap()
    ): HttpResponse {
        val requestBuilder = Request.Builder()
            .url(endpoint)
            .header("Accept", "application/json")
            .header("User-Agent", "YagoEvotor/1.0")

        extraHeaders.forEach { (key, value) ->
            requestBuilder.header(key, value)
        }

        val requestBody = payload?.toString()?.toRequestBody(JSON_MEDIA_TYPE)
        if (requestBody != null) {
            requestBuilder.header("Content-Type", "application/json")
        }

        when (method) {
            "GET" -> requestBuilder.get()
            "POST" -> requestBuilder.post(requestBody ?: "{}".toRequestBody(JSON_MEDIA_TYPE))
            "PUT" -> requestBuilder.put(requestBody ?: "{}".toRequestBody(JSON_MEDIA_TYPE))
            "PATCH" -> requestBuilder.patch(requestBody ?: "{}".toRequestBody(JSON_MEDIA_TYPE))
            "DELETE" -> {
                if (requestBody != null) {
                    requestBuilder.delete(requestBody)
                } else {
                    requestBuilder.delete()
                }
            }
            else -> throw ApiException(null, "Unsupported HTTP method: $method")
        }

        val request = requestBuilder.build()
        val call = try {
            httpClient.newCall(request)
        } catch (error: Exception) {
            throw ApiException(null, formatConnectionError(endpoint, "prepare request", error))
        }

        return try {
            call.execute().use { response ->
                HttpResponse(
                    statusCode = response.code,
                    body = response.body?.string().orEmpty()
                )
            }
        } catch (error: Exception) {
            throw ApiException(null, formatConnectionError(endpoint, "execute request", error))
        }
    }

    private fun formatConnectionError(endpoint: String, phase: String, error: Throwable): String {
        val chain = generateSequence(error) { it.cause }
            .mapNotNull { cause ->
                val name = cause::class.java.simpleName
                val message = cause.message?.trim().orEmpty()
                if (message.isBlank()) name else "$name: $message"
            }
            .toList()

        val details = chain.joinToString(" -> ")
        val prefix = "Network error during $phase ($endpoint)."
        return if (error is SSLHandshakeException || chain.any { it.contains("SSL", ignoreCase = true) || it.contains("certificate", ignoreCase = true) }) {
            "$prefix TLS/SSL error. Проверьте сертификат сервера и цепочку доверия. $details"
        } else {
            "$prefix ${details.ifBlank { "Unknown network error" }}"
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
