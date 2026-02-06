package com.yago.evotor.auth

import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

object ApiClient {
    data class LoginResponse(
        val accessToken: String,
        val refreshToken: String,
        val organizationId: String?
    )

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

        val responseCode = connection.responseCode
        val reader = if (responseCode in 200..299) {
            BufferedReader(InputStreamReader(connection.inputStream))
        } else {
            BufferedReader(InputStreamReader(connection.errorStream))
        }

        val responseText = reader.use { it.readText() }
        if (responseCode !in 200..299) {
            throw IllegalStateException("Login failed: $responseText")
        }

        val json = JSONObject(responseText)
        val data = json.getJSONObject("data")
        val user = data.getJSONObject("user")

        return LoginResponse(
            accessToken = data.getString("accessToken"),
            refreshToken = data.getString("refreshToken"),
            organizationId = if (user.has("organizationId")) user.optString("organizationId", null) else null
        )
    }
}
