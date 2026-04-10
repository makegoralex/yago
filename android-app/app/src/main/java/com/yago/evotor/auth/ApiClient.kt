package com.yago.evotor.auth

import android.content.Context
import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom
import java.util.concurrent.TimeUnit
import javax.net.ssl.HostnameVerifier
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLHandshakeException
import javax.net.ssl.SSLPeerUnverifiedException
import javax.net.ssl.X509TrustManager

object ApiClient {

    private const val CONNECT_TIMEOUT_MS = 5_000L
    private const val READ_TIMEOUT_MS = 10_000L
    private const val ALLOW_INSECURE_SSL_FOR_EVOTOR_WORKAROUND = true
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
        val productId: String? = null,
        val name: String,
        val qty: Double,
        val total: Double
    )

    data class CatalogProduct(
        val id: String,
        val name: String,
        val price: Double
    )

    data class DiscountSummary(
        val id: String,
        val name: String,
        val type: String,
        val value: Double
    )

    data class CreateOrderResult(
        val order: ActiveOrder,
        val availableDiscounts: List<DiscountSummary>
    )

    data class ActiveOrder(
        val id: String,
        val status: String,
        val total: Double,
        val items: List<OrderItem>
    )

    data class SaleCommand(
        val id: String,
        val targetOrderId: String,
        val order: ActiveOrder
    )

    data class HealthCheckResult(
        val endpoint: String,
        val statusCode: Int
    )

    class ApiException(val statusCode: Int?, override val message: String) : Exception(message)

    fun initialize(@Suppress("UNUSED_PARAMETER") context: Context) {
        if (httpClient != null) return
        synchronized(this) {
            if (httpClient == null) {
                httpClient = buildHttpClient()
            }
        }
    }

    fun checkHealth(baseUrl: String): HealthCheckResult {
        val endpoint = baseUrl.trimEnd('/') + "/healthz"
        val response = executeRequest(endpoint, "GET", null, emptyMap())
        if (response.statusCode !in 200..299) {
            throw ApiException(response.statusCode, extractErrorMessage(response.body))
        }
        return HealthCheckResult(endpoint, response.statusCode)
    }

    fun login(baseUrl: String, email: String, password: String, organizationId: String?): LoginResponse {
        val endpoint = baseUrl.trimEnd('/') + "/api/auth/login"
        val payload = JSONObject().apply {
            put("email", email)
            put("password", password)
            if (!organizationId.isNullOrBlank()) {
                put("organizationId", organizationId)
            }
        }

        val response = executeRequest(endpoint, "POST", payload, emptyMap())
        if (response.statusCode !in 200..299) {
            throw ApiException(response.statusCode, extractErrorMessage(response.body))
        }

        val root = JSONObject(response.body)
        val data = root.getJSONObject("data")
        val user = data.getJSONObject("user")

        return LoginResponse(
            accessToken = data.getString("accessToken"),
            refreshToken = data.getString("refreshToken"),
            organizationId = user.optString("organizationId", null),
            organizationName = user.optString("organizationName", null)
        )
    }

    fun refreshTokens(baseUrl: String, refreshToken: String): RefreshResponse {
        val endpoint = baseUrl.trimEnd('/') + "/api/auth/refresh"
        val payload = JSONObject().apply {
            put("refreshToken", refreshToken)
        }

        val response = executeRequest(endpoint, "POST", payload, emptyMap())
        if (response.statusCode !in 200..299) {
            throw ApiException(response.statusCode, extractErrorMessage(response.body))
        }

        val root = JSONObject(response.body)
        val data = root.getJSONObject("data")

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

        val root = JSONObject(response.body)
        val dataArray = root.optJSONArray("data") ?: JSONArray()

        val orders = mutableListOf<ActiveOrder>()

        for (i in 0 until dataArray.length()) {
            val orderJson = dataArray.optJSONObject(i) ?: continue
            val itemsArray = orderJson.optJSONArray("items") ?: JSONArray()

            val items = mutableListOf<OrderItem>()

            for (j in 0 until itemsArray.length()) {
                val itemJson = itemsArray.optJSONObject(j) ?: continue
                val name = itemJson.optString("name", "")
                if (name.isBlank()) continue

                items.add(
                    OrderItem(
                        productId = normalizeId(itemJson.opt("productId")),
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

    fun fetchPendingSaleCommand(baseUrl: String, accessToken: String): SaleCommand? {
        val endpoint = baseUrl.trimEnd('/') + "/api/evotor/sale-commands/pending"

        val response = executeRequest(
            endpoint,
            "GET",
            null,
            mapOf("X-Yago-App-Token" to accessToken)
        )

        if (response.statusCode !in 200..299) {
            throw ApiException(response.statusCode, extractErrorMessage(response.body))
        }

        val root = JSONObject(response.body)
        val data = root.optJSONObject("data") ?: return null

        val commandId = data.optString("id", "")
        val orderJson = data.optJSONObject("order") ?: return null

        if (commandId.isBlank()) return null

        val itemsArray = orderJson.optJSONArray("items") ?: JSONArray()
        val items = mutableListOf<OrderItem>()

        for (i in 0 until itemsArray.length()) {
            val itemJson = itemsArray.optJSONObject(i) ?: continue
            val name = itemJson.optString("name", "")
            if (name.isBlank()) continue

            items.add(
                OrderItem(
                    productId = normalizeId(itemJson.opt("productId")),
                    name = name,
                    qty = itemJson.optDouble("qty", 0.0),
                    total = itemJson.optDouble("total", 0.0)
                )
            )
        }

        return SaleCommand(
            id = commandId,
            targetOrderId = orderJson.optString("id", ""),
            order = ActiveOrder(
                id = orderJson.optString("id", ""),
                status = orderJson.optString("status", ""),
                total = orderJson.optDouble("total", 0.0),
                items = items
            )
        )
    }

    fun fetchCatalogProducts(baseUrl: String, accessToken: String): List<CatalogProduct> {
        val endpoint = baseUrl.trimEnd('/') + "/api/catalog/pos"

        val response = executeRequest(
            endpoint,
            "GET",
            null,
            mapOf("X-Yago-App-Token" to accessToken)
        )

        if (response.statusCode !in 200..299) {
            throw ApiException(response.statusCode, extractErrorMessage(response.body))
        }

        val root = JSONObject(response.body)
        val data = root.optJSONObject("data") ?: JSONObject()
        val productsArray = data.optJSONArray("products") ?: JSONArray()

        val products = mutableListOf<CatalogProduct>()
        for (i in 0 until productsArray.length()) {
            val productJson = productsArray.optJSONObject(i) ?: continue
            val id = normalizeId(productJson.opt("_id")) ?: continue
            val name = productJson.optString("name", "").trim()
            if (name.isBlank()) continue

            val price = when {
                productJson.has("basePrice") -> productJson.optDouble("basePrice", 0.0)
                productJson.has("price") -> productJson.optDouble("price", 0.0)
                else -> 0.0
            }

            products.add(CatalogProduct(id = id, name = name, price = price))
        }

        return products
    }

    fun createOrderFromProducts(
        baseUrl: String,
        accessToken: String,
        locationId: String,
        registerId: String,
        products: List<CatalogProduct>,
        selectedDiscountIds: List<String>
    ): CreateOrderResult {
        if (products.isEmpty()) {
            throw ApiException(null, "Не выбраны товары для заказа")
        }

        val startPayload = JSONObject().apply {
            put("locationId", locationId)
            put("registerId", registerId)
        }

        val started = executeRequest(
            baseUrl.trimEnd('/') + "/api/orders/start",
            "POST",
            startPayload,
            mapOf("X-Yago-App-Token" to accessToken)
        )

        if (started.statusCode !in 200..299) {
            throw ApiException(started.statusCode, extractErrorMessage(started.body))
        }

        val startRoot = JSONObject(started.body)
        val startedOrder = startRoot.optJSONObject("data")
            ?: throw ApiException(null, "Сервер не вернул созданный заказ")

        val orderId = normalizeId(startedOrder.opt("_id"))
            ?: throw ApiException(null, "Сервер не вернул id заказа")

        val items = JSONArray()
        products.forEach { product ->
            items.put(
                JSONObject().apply {
                    put("productId", product.id)
                    put("qty", 1)
                }
            )
        }

        val updatePayload = JSONObject().apply {
            put("items", items)
            if (selectedDiscountIds.isNotEmpty()) {
                put("discountIds", JSONArray(selectedDiscountIds))
            }
        }

        val updated = executeRequest(
            baseUrl.trimEnd('/') + "/api/orders/$orderId/items",
            "POST",
            updatePayload,
            mapOf("X-Yago-App-Token" to accessToken)
        )

        if (updated.statusCode !in 200..299) {
            throw ApiException(updated.statusCode, extractErrorMessage(updated.body))
        }

        val updatedRoot = JSONObject(updated.body)
        val updatedOrder = updatedRoot.optJSONObject("data")
            ?: throw ApiException(null, "Сервер не вернул обновлённый заказ")

        return CreateOrderResult(
            order = parseOrder(updatedOrder),
            availableDiscounts = fetchAvailableDiscounts(baseUrl, accessToken, orderId)
        )
    }

    fun fetchAvailableDiscounts(baseUrl: String, accessToken: String, orderId: String? = null): List<DiscountSummary> {
        val endpoint = if (orderId.isNullOrBlank()) {
            baseUrl.trimEnd('/') + "/api/orders/discounts/available"
        } else {
            baseUrl.trimEnd('/') + "/api/orders/discounts/available?orderId=$orderId"
        }
        val response = executeRequest(
            endpoint,
            "GET",
            null,
            mapOf("X-Yago-App-Token" to accessToken)
        )

        if (response.statusCode !in 200..299) {
            Log.w("YagoEvotor", "Unable to fetch discounts for created order: ${response.statusCode}")
            return emptyList()
        }

        val root = JSONObject(response.body)
        val dataArray = root.optJSONArray("data") ?: JSONArray()
        val discounts = mutableListOf<DiscountSummary>()

        for (i in 0 until dataArray.length()) {
            val discountJson = dataArray.optJSONObject(i) ?: continue
            val id = normalizeId(discountJson.opt("_id")) ?: continue
            val name = discountJson.optString("name", "").trim()
            if (name.isBlank()) continue

            discounts += DiscountSummary(
                id = id,
                name = name,
                type = discountJson.optString("type", "fixed"),
                value = discountJson.optDouble("value", 0.0)
            )
        }

        return discounts
    }

    private fun parseOrder(orderJson: JSONObject): ActiveOrder {
        val itemsArray = orderJson.optJSONArray("items") ?: JSONArray()
        val items = mutableListOf<OrderItem>()

        for (j in 0 until itemsArray.length()) {
            val itemJson = itemsArray.optJSONObject(j) ?: continue
            val name = itemJson.optString("name", "")
            if (name.isBlank()) continue

            items.add(
                OrderItem(
                    productId = normalizeId(itemJson.opt("productId")),
                    name = name,
                    qty = itemJson.optDouble("qty", 0.0),
                    total = itemJson.optDouble("total", 0.0)
                )
            )
        }

        return ActiveOrder(
            id = normalizeId(orderJson.opt("_id")) ?: orderJson.optString("id", ""),
            status = orderJson.optString("status", ""),
            total = orderJson.optDouble("total", 0.0),
            items = items
        )
    }

    private fun normalizeId(value: Any?): String? {
        if (value == null || value == JSONObject.NULL) {
            return null
        }

        return when (value) {
            is JSONObject -> {
                val nested = value.optString("_id", "")
                nested.takeIf { it.isNotBlank() }
            }

            else -> value.toString().takeIf { it.isNotBlank() }
        }
    }

    fun ackSaleCommand(
        baseUrl: String,
        accessToken: String,
        commandId: String,
        status: String,
        errorMessage: String? = null
    ) {
        val endpoint = baseUrl.trimEnd('/') + "/api/evotor/sale-commands/$commandId/ack"

        val payload = JSONObject().apply {
            put("status", status)
            if (!errorMessage.isNullOrBlank()) {
                put("errorMessage", errorMessage)
            }
        }

        val response = executeRequest(
            endpoint,
            "POST",
            payload,
            mapOf("X-Yago-App-Token" to accessToken)
        )

        if (response.statusCode !in 200..299) {
            throw ApiException(response.statusCode, extractErrorMessage(response.body))
        }
    }

    private data class HttpResponse(
        val statusCode: Int,
        val body: String
    )

    private fun buildHttpClient(): OkHttpClient {
        val clientBuilder = OkHttpClient.Builder()
            .connectTimeout(CONNECT_TIMEOUT_MS, TimeUnit.MILLISECONDS)
            .readTimeout(READ_TIMEOUT_MS, TimeUnit.MILLISECONDS)

        if (ALLOW_INSECURE_SSL_FOR_EVOTOR_WORKAROUND) {
            // Временный workaround для Evotor/Android 10+ с проксированием,
            // когда endpoint может отдавать сертификат без SAN и ломать hostname verification.
            val trustAllManager = createTrustAllManager()
            val insecureSslContext = SSLContext.getInstance("TLS").apply {
                init(null, arrayOf(trustAllManager), SecureRandom())
            }

            clientBuilder
                .sslSocketFactory(insecureSslContext.socketFactory, trustAllManager)
                .hostnameVerifier(HostnameVerifier { _, _ -> true })
        }

        return clientBuilder.build()
    }

    private fun createTrustAllManager(): X509TrustManager {
        return object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<java.security.cert.X509Certificate>, authType: String) = Unit
            override fun checkServerTrusted(chain: Array<java.security.cert.X509Certificate>, authType: String) = Unit
            override fun getAcceptedIssuers(): Array<java.security.cert.X509Certificate> = emptyArray()
        }
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

        extraHeaders.forEach { (k, v) -> requestBuilder.header(k, v) }

        val requestBody = payload?.toString()?.toRequestBody(JSON_MEDIA_TYPE)

        when (method) {
            "GET" -> requestBuilder.get()
            "POST" -> requestBuilder.post(requestBody ?: "{}".toRequestBody(JSON_MEDIA_TYPE))
            "PUT" -> requestBuilder.put(requestBody ?: "{}".toRequestBody(JSON_MEDIA_TYPE))
            "PATCH" -> requestBuilder.patch(requestBody ?: "{}".toRequestBody(JSON_MEDIA_TYPE))
            "DELETE" -> if (requestBody != null) requestBuilder.delete(requestBody) else requestBuilder.delete()
            else -> throw ApiException(null, "Unsupported HTTP method: $method")
        }

        val client = httpClient
            ?: throw ApiException(null, "ApiClient is not initialized. Call initialize() first.")

        return try {
            val startedAt = System.nanoTime()
            client.newCall(requestBuilder.build()).execute().use { response ->
                val elapsedMs = (System.nanoTime() - startedAt) / 1_000_000
                Log.d("YagoEvotor", "HTTP $method $endpoint -> ${response.code} (${elapsedMs}ms)")
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
            .mapNotNull {
                val name = it::class.java.simpleName
                val msg = it.message?.trim().orEmpty()
                if (msg.isBlank()) name else "$name: $msg"
            }
            .toList()

        val details = chain.joinToString(" -> ")

        return if (
            error is SSLHandshakeException ||
            error is SSLPeerUnverifiedException ||
            chain.any { it.contains("SSL", true) || it.contains("certificate", true) }
        ) {
            val insecureHint = if (ALLOW_INSECURE_SSL_FOR_EVOTOR_WORKAROUND) {
                " Включен insecure SSL workaround (trust-all + hostname verifier), но TLS всё равно не прошёл."
            } else {
                ""
            }
            "TLS/SSL error during $phase ($endpoint). Проверьте цепочку сертификатов. $details$insecureHint"
        } else {
            "Network error during $phase ($endpoint): ${details.ifBlank { "Unknown error" }}"
        }
    }

    private fun extractErrorMessage(text: String): String {
        return try {
            val json = JSONObject(text)
            when {
                json.has("error") -> json.optString("error")
                json.has("message") -> json.optString("message")
                else -> text.ifBlank { "Unknown error" }
            }
        } catch (_: Exception) {
            text.ifBlank { "Unknown error" }
        }
    }
}
