package com.yago.evotor.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.yago.evotor.MainActivity
import com.yago.evotor.R

class LoginActivity : AppCompatActivity() {
    private lateinit var baseUrlInput: EditText
    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var organizationInput: EditText
    private lateinit var errorText: TextView
    private lateinit var progressBar: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        baseUrlInput = findViewById(R.id.baseUrlInput)
        emailInput = findViewById(R.id.emailInput)
        passwordInput = findViewById(R.id.passwordInput)
        organizationInput = findViewById(R.id.organizationInput)
        errorText = findViewById(R.id.errorText)
        progressBar = findViewById(R.id.loginProgress)

        val sessionStorage = SessionStorage(this)
        sessionStorage.loadSession()?.let {
            openPos()
            return
        }

        val loginButton: Button = findViewById(R.id.loginButton)
        loginButton.setOnClickListener {
            errorText.text = ""
            errorText.visibility = View.GONE

            val baseUrl = baseUrlInput.text.toString().trim()
            val email = emailInput.text.toString().trim()
            val password = passwordInput.text.toString().trim()
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
                    ApiClient.checkHealth(baseUrl)
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
                        progressBar.visibility = View.GONE
                        loginButton.isEnabled = true
                        openPos()
                    }
                } catch (error: ApiClient.ApiException) {
                    runOnUiThread {
                        progressBar.visibility = View.GONE
                        loginButton.isEnabled = true
                        errorText.text =
                            if (error.statusCode == null) {
                                getString(R.string.login_error_network, error.message)
                            } else {
                                getString(R.string.login_error_api, error.statusCode, error.message)
                            }
                        errorText.visibility = View.VISIBLE
                    }
                } catch (error: Exception) {
                    runOnUiThread {
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
