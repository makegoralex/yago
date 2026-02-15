package com.yago.evotor

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.yago.evotor.auth.ApiClient
import com.yago.evotor.auth.LoginActivity
import com.yago.evotor.auth.Session
import com.yago.evotor.auth.SessionStorage
import java.text.DecimalFormat

class MainActivity : AppCompatActivity() {
    private val handler = Handler(Looper.getMainLooper())
    private val pollingIntervalMs = 3000L
    private val currencyFormat = DecimalFormat("0.00")

    private var pollingRunnable: Runnable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        ApiClient.initialize(applicationContext)

        val sessionStorage = SessionStorage(this)
        val session = sessionStorage.loadSession()
        if (session == null) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)
        val statusText = findViewById<TextView>(R.id.statusText)
        val ordersText = findViewById<TextView>(R.id.ordersText)
        val logoutButton = findViewById<Button>(R.id.logoutButton)

        val organizationLabel = session.organizationName ?: session.organizationId ?: "—"
        statusText.text = getString(R.string.pos_ready_message, organizationLabel)
        ordersText.text = getString(R.string.orders_loading)

        logoutButton.setOnClickListener {
            sessionStorage.clear()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        pollingRunnable = object : Runnable {
            override fun run() {
                Thread {
                    val refreshedSession = sessionStorage.loadSession() ?: session
                    try {
                        val orders = ApiClient.fetchActiveOrders(refreshedSession.baseUrl, refreshedSession.accessToken)
                        runOnUiThread {
                            ordersText.text = renderOrders(orders)
                        }
                    } catch (error: ApiClient.ApiException) {
                        if (error.statusCode == 401) {
                            handleTokenRefresh(sessionStorage, refreshedSession, ordersText)
                        } else {
                            runOnUiThread {
                                ordersText.text = getString(R.string.orders_error, error.message)
                            }
                        }
                    } catch (error: Exception) {
                        runOnUiThread {
                            ordersText.text = getString(R.string.orders_error, error.message ?: "")
                        }
                    }
                }.start()
                handler.postDelayed(this, pollingIntervalMs)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        pollingRunnable?.let { handler.post(it) }
    }

    override fun onStop() {
        super.onStop()
        pollingRunnable?.let { handler.removeCallbacks(it) }
    }

    private fun handleTokenRefresh(
        sessionStorage: SessionStorage,
        session: Session,
        ordersText: TextView
    ) {
        try {
            val refreshed = ApiClient.refreshTokens(session.baseUrl, session.refreshToken)
            val updatedSession = session.copy(
                accessToken = refreshed.accessToken,
                refreshToken = refreshed.refreshToken
            )
            sessionStorage.saveSession(updatedSession)
            val orders = ApiClient.fetchActiveOrders(updatedSession.baseUrl, updatedSession.accessToken)
            runOnUiThread {
                ordersText.text = renderOrders(orders)
            }
        } catch (error: Exception) {
            runOnUiThread {
                ordersText.text = getString(R.string.orders_error, error.message ?: "")
            }
        }
    }

    private fun renderOrders(orders: List<ApiClient.ActiveOrder>): String {
        if (orders.isEmpty()) {
            return getString(R.string.orders_empty)
        }

        val builder = StringBuilder()
        orders.forEachIndexed { index, order ->
            if (index > 0) {
                builder.append("\n\n")
            }
            val shortId = if (order.id.length > 6) order.id.takeLast(6) else order.id
            builder.append(getString(R.string.orders_header, shortId, order.status, currencyFormat.format(order.total)))
            if (order.items.isNotEmpty()) {
                order.items.forEach { item ->
                    builder.append("\n")
                    builder.append("• ")
                    builder.append(item.name)
                    builder.append(" x")
                    builder.append(item.qty)
                    builder.append(" = ")
                    builder.append(currencyFormat.format(item.total))
                }
            }
        }
        return builder.toString()
    }
}
