package com.yago.evotor.auth

import android.content.Context
import com.yago.evotor.R
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLHandshakeException
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

object ApiClient {
    private const val CONNECT_TIMEOUT_MS = 5_000L
    private const val READ_TIMEOUT_MS = 10_000L
    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

    @Volatile
    private var httpClient: OkHttpClient? = null

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

    fun initialize(context: Context) {
        if (httpClient != null) {
            return
        }

        synchronized(this) {
            if (httpClient == null) {
                httpClient = createHttpClient(context)
            }
        }
    }

    fun checkHealth(baseUrl: String): HealthCheckResult {
        val endpoint = baseUrl.trimEnd('/') + "/healthz"
        val response = executeRequest(endpoint, "GET", null, emptyMap())
        if (response.statusCode !in 200..299) {
            val errorMessage = extractErrorMessage(response.body)
            throw ApiException(response.statusCode, "Healthcheck failed for $endpoint: $errorMessage")
        }

        return HealthCheckResult(endpoint, response.statusCode)
    }

    fun login(baseUrl: String, email: String, password: String, organizationId: String?): LoginResponse {
        val endpoint = baseUrl.trimEnd('/') + "/api/auth/login"
        val payload = JSONObject()
        payload.put("email", email)
        payload.put("password", password)
        if (!organizationId.isNullOrBlank()) {
            payload.put("organizationId", organizationId)
        }

        val response = executeRequest(endpoint, "POST", payload, emptyMap())
        if (response.statusCode !in 200..299) {
            throw ApiException(response.statusCode, extractErrorMessage(response.body))
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

        val response = executeRequest(endpoint, "POST", payload, emptyMap())
        if (response.statusCode !in 200..299) {
            throw ApiException(response.statusCode, extractErrorMessage(response.body))
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
            endpoint,
            "GET",
            null,
            mapOf("X-Yago-App-Token" to accessToken)
        )

        if (response.statusCode !in 200..299) {
            throw ApiException(response.statusCode, extractErrorMessage(response.body))
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
                if (name.isBlank()) {
                    continue
                }

                items.add(
                    OrderItem(
                        name = name,
                        qty = itemJson.optDouble("qty", 0.0),
                        total = itemJson.optDouble("total", 0.0)
                    )
                )
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

    private fun createHttpClient(context: Context): OkHttpClient {
        try {
            val evotorTrustManager = buildEvotorTrustManager(context)
            val systemTrustManager = buildSystemTrustManager()
            val compositeTrustManager = CompositeTrustManager(evotorTrustManager, systemTrustManager)

            val sslContext = SSLContext.getInstance("TLS")
            sslContext.init(null, arrayOf(compositeTrustManager), null)

            return OkHttpClient.Builder()
                .connectTimeout(CONNECT_TIMEOUT_MS, TimeUnit.MILLISECONDS)
                .readTimeout(READ_TIMEOUT_MS, TimeUnit.MILLISECONDS)
                .sslSocketFactory(sslContext.socketFactory, compositeTrustManager)
                .hostnameVerifier { _, _ -> true }
                .build()
        } catch (error: Exception) {
            throw ApiException(null, formatConnectionError("evotor-rootca", "initialize SSL", error))
        }

    private fun executeRequest(
        endpoint: String,
        method: String,
        payload: JSONObject?,
        extraHeaders: Map<String, String>
    ): HttpResponse {
        val requestBuilder = Request.Builder()
            .url(endpoint)
            .header("Accept", "application/json")
            .header("User-Agent", "YagoEvotor/1.0")

        for ((key, value) in extraHeaders) {
            requestBuilder.header(key, value)
        }

        val requestBody = if (payload != null) {
            payload.toString().toRequestBody(JSON_MEDIA_TYPE)
        } else {
            null
        }

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

        val client = httpClient ?: throw ApiException(
            null,
            "ApiClient is not initialized. Call ApiClient.initialize(context) before network requests."
        )

        try {
            client.newCall(requestBuilder.build()).execute().use { response ->
                return HttpResponse(response.code, response.body?.string().orEmpty())
            }
        } catch (error: Exception) {
            throw ApiException(null, formatConnectionError(endpoint, "execute request", error))
        }

    private fun buildEvotorTrustManager(context: Context): X509TrustManager {
        val certFactory = CertificateFactory.getInstance("X.509")
        val certificate = context.resources.openRawResource(R.raw.rootca2025).use { input ->
            certFactory.generateCertificate(input) as X509Certificate
        }

        val keyStore = KeyStore.getInstance(KeyStore.getDefaultType())
        keyStore.load(null, null)
        keyStore.setCertificateEntry("evotor_rootca2025", certificate)

        val trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        trustManagerFactory.init(keyStore)

        val trustManagers = trustManagerFactory.trustManagers
        for (trustManager in trustManagers) {
            if (trustManager is X509TrustManager) {
                return trustManager
            }
        }

        throw ApiException(null, "Unable to create X509TrustManager for Evotor certificate")
    }

    private fun buildSystemTrustManager(): X509TrustManager {
        val trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        trustManagerFactory.init(null as KeyStore?)

        val trustManagers = trustManagerFactory.trustManagers
        for (trustManager in trustManagers) {
            if (trustManager is X509TrustManager) {
                return trustManager
            }
        }

        throw ApiException(null, "Unable to create default X509TrustManager")
    }

    private class CompositeTrustManager(
        private val primary: X509TrustManager,
        private val fallback: X509TrustManager
    ) : X509TrustManager {
        override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) {
            try {
                primary.checkClientTrusted(chain, authType)
            } catch (_: Exception) {
                fallback.checkClientTrusted(chain, authType)
            }
        }

        override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {
            try {
                primary.checkServerTrusted(chain, authType)
            } catch (_: Exception) {
                fallback.checkServerTrusted(chain, authType)
            }
        }

        override fun getAcceptedIssuers(): Array<X509Certificate> {
            val allIssuers = primary.acceptedIssuers.asList() + fallback.acceptedIssuers.asList()
            return allIssuers
                .distinctBy { it.subjectX500Principal.name + it.serialNumber.toString() }
                .toTypedArray()
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

        return if (
            error is SSLHandshakeException ||
            chain.any { it.contains("SSL", ignoreCase = true) || it.contains("certificate", ignoreCase = true) }
        ) {
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
        } catch (_: Exception) {
            responseText.ifBlank { "Unknown error" }
        }
    }
}
