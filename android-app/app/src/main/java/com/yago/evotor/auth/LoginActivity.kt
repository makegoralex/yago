package com.yago.evotor.auth

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.yago.evotor.MainActivity
import com.yago.evotor.R

class LoginActivity : AppCompatActivity() {
    companion object {
        private const val DEFAULT_BASE_URL = "https://yago-app.ru"
    }

    private lateinit var baseUrlInput: EditText
    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var organizationInput: EditText
    private lateinit var errorText: TextView
    private lateinit var progressBar: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        ApiClient.initialize(applicationContext)

        baseUrlInput = findViewById(R.id.baseUrlInput)
        emailInput = findViewById(R.id.emailInput)
        passwordInput = findViewById(R.id.passwordInput)
        organizationInput = findViewById(R.id.organizationInput)
        errorText = findViewById(R.id.errorText)
        progressBar = findViewById(R.id.loginProgress)
        baseUrlInput.setText(DEFAULT_BASE_URL)

        val sessionStorage = SessionStorage(this)
        sessionStorage.loadSession()?.let {
            openPos()
            return
        }

        val loginButton: Button = findViewById(R.id.loginButton)
        loginButton.setOnClickListener {
            errorText.text = ""
            errorText.visibility = View.GONE

            val baseUrl = baseUrlInput.text.toString().trim().ifBlank { DEFAULT_BASE_URL }
            val email = emailInput.text.toString().trim()
            val password = passwordInput.text.toString()
            val organizationId = organizationInput.text.toString().trim().ifBlank { null }

            if (baseUrl.isBlank() || email.isBlank() || password.isBlank()) {
                errorText.text = getString(R.string.login_error_required)
                errorText.visibility = View.VISIBLE
                return@setOnClickListener
            }

            progressBar.visibility = View.VISIBLE
            loginButton.isEnabled = false

            Thread {
                try {
                    val response = ApiClient.login(baseUrl, email, password, organizationId)
                    sessionStorage.saveSession(
                        Session(
                            accessToken = response.accessToken,
                            refreshToken = response.refreshToken,
                            organizationId = response.organizationId ?: organizationId,
                            organizationName = response.organizationName,
                            baseUrl = baseUrl
                        )
                    )

                    runOnUiThread {
                        if (isFinishing || isDestroyed) return@runOnUiThread
                        progressBar.visibility = View.GONE
                        loginButton.isEnabled = true
                        openPos()
                    }
                } catch (error: ApiClient.ApiException) {
                    Log.w("YagoEvotor", "Login failed (status=${error.statusCode})", error)
                    runOnUiThread {
                        if (isFinishing || isDestroyed) return@runOnUiThread
                        progressBar.visibility = View.GONE
                        loginButton.isEnabled = true
                        errorText.text =
                            when {
                                error.statusCode == null -> getString(R.string.login_error_connection)
                                error.statusCode == 401 && error.message == "Invalid credentials" ->
                                    getString(R.string.login_error_invalid)
                                error.statusCode in 500..599 || error.statusCode == 408 ->
                                    getString(R.string.login_error_unavailable)
                                else -> getString(R.string.login_error_api, error.statusCode, error.message)
                            }
                        errorText.visibility = View.VISIBLE
                    }
                } catch (error: Exception) {
                    Log.w("YagoEvotor", "Login failed", error)
                    runOnUiThread {
                        if (isFinishing || isDestroyed) return@runOnUiThread
                        progressBar.visibility = View.GONE
                        loginButton.isEnabled = true
                        errorText.text = getString(R.string.login_error_generic, error.message ?: "")
                        errorText.visibility = View.VISIBLE
                    }
                }
            }.start()
        }
    }

    private fun openPos() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
