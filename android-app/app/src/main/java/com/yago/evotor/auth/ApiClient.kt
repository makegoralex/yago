package com.yago.evotor.auth

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

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

    fun login(baseUrl: String, email: String, password: String, organizationId: String?): LoginResponse {
        val endpoint = baseUrl.trimEnd('/') + "/api/auth/login"
        val url = URL(endpoint)
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.setRequestProperty("Content-Type", "application/json")
        connection.doOutput = true

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
        val url = URL(endpoint)
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.setRequestProperty("Content-Type", "application/json")
        connection.doOutput = true

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
        val url = URL(endpoint)
        val connection = url.openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
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
        val reader = if (connection.responseCode in 200..299) {
            BufferedReader(InputStreamReader(connection.inputStream))
        } else {
            BufferedReader(InputStreamReader(connection.errorStream))
        }
        return reader.use { it.readText() }
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
