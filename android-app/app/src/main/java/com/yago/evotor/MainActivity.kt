package com.yago.evotor

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import android.util.Log
import com.yago.evotor.auth.ApiClient
import com.yago.evotor.auth.LoginActivity
import com.yago.evotor.auth.SessionStorage
import ru.evotor.framework.core.IntegrationAppCompatActivity
import ru.evotor.framework.navigation.NavigationApi
import java.text.DecimalFormat

class MainActivity : IntegrationAppCompatActivity() {

    private val handler = Handler(Looper.getMainLooper())
    private val pollingIntervalMs = 3000L
    private val currencyFormat = DecimalFormat("0.00")

    private var pollingRunnable: Runnable? = null
    @Volatile private var isProcessingRemoteSaleCommand = false
    private val activeOrders = mutableListOf<ApiClient.ActiveOrder>()
    private lateinit var ordersAdapter: ArrayAdapter<String>

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
        val ordersListView = findViewById<ListView>(R.id.ordersList)
        val saleButton = findViewById<Button>(R.id.saleButton)
        val logoutButton = findViewById<Button>(R.id.logoutButton)

        ordersAdapter =
            ArrayAdapter(this, android.R.layout.simple_list_item_single_choice, mutableListOf())

        ordersListView.adapter = ordersAdapter
        ordersListView.choiceMode = ListView.CHOICE_MODE_SINGLE
        ordersAdapter.add(getString(R.string.orders_loading))

        val organizationLabel =
            session.organizationName ?: session.organizationId ?: "—"

        statusText.text =
            getString(R.string.pos_ready_message, organizationLabel)

        saleButton.isEnabled = false

        ordersListView.setOnItemClickListener { _, _, position, _ ->
            saleButton.isEnabled = position in activeOrders.indices
        }

        saleButton.setOnClickListener {
            val checkedPosition = ordersListView.checkedItemPosition

            if (checkedPosition !in activeOrders.indices) {
                Toast.makeText(
                    this,
                    getString(R.string.order_select_required),
                    Toast.LENGTH_SHORT
                ).show()
                return@setOnClickListener
            }

            val order = activeOrders[checkedPosition]
            if (order.items.none { it.name.isNotBlank() && it.qty > 0.0 && it.total > 0.0 }) {
                Toast.makeText(
                    this,
                    getString(R.string.order_items_empty),
                    Toast.LENGTH_SHORT
                ).show()
                return@setOnClickListener
            }

            try {
                PendingSellOrderStore.set(order)
                val intent = NavigationApi.createIntentForSellReceiptEdit(false)
                startActivity(intent)
            } catch (_: Throwable) {
                Toast.makeText(
                    this,
                    getString(R.string.sale_intent_error),
                    Toast.LENGTH_SHORT
                ).show()
            }
        }

        logoutButton.setOnClickListener {
            sessionStorage.clear()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        pollingRunnable = object : Runnable {
            override fun run() {
                Thread {
                    try {
                        val orders = fetchOrdersWithRefresh(sessionStorage)

                        runOnUiThread {
                            updateOrders(orders)
                            saleButton.isEnabled =
                                ordersListView.checkedItemPosition in activeOrders.indices
                        }

                        val latestSession = sessionStorage.loadSession()
                        if (latestSession != null) {
                            processRemoteSaleCommandIfAny(latestSession)
                        }

                    } catch (error: SessionExpiredException) {
                        runOnUiThread {
                            sessionStorage.clear()
                            Toast.makeText(
                                this@MainActivity,
                                getString(R.string.session_expired),
                                Toast.LENGTH_LONG
                            ).show()
                            startActivity(Intent(this@MainActivity, LoginActivity::class.java))
                            finish()
                        }
                    } catch (error: Exception) {
                        val details = error.message?.takeIf { it.isNotBlank() }
                            ?: getString(R.string.error_unknown)

                        runOnUiThread {
                            showErrorRow(
                                getString(R.string.orders_error, details),
                                ordersListView,
                                saleButton
                            )
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

    private class SessionExpiredException : Exception()

    private fun fetchOrdersWithRefresh(sessionStorage: SessionStorage): List<ApiClient.ActiveOrder> {
        val currentSession = sessionStorage.loadSession() ?: throw SessionExpiredException()

        return try {
            ApiClient.fetchActiveOrders(currentSession.baseUrl, currentSession.accessToken)
        } catch (error: ApiClient.ApiException) {
            if (error.statusCode != 401 && error.statusCode != 403) throw error

            val refreshed = try {
                ApiClient.refreshTokens(currentSession.baseUrl, currentSession.refreshToken)
            } catch (_: Exception) {
                throw SessionExpiredException()
            }

            val updatedSession =
                currentSession.copy(
                    accessToken = refreshed.accessToken,
                    refreshToken = refreshed.refreshToken
                )
            sessionStorage.saveSession(updatedSession)

            ApiClient.fetchActiveOrders(updatedSession.baseUrl, updatedSession.accessToken)
        }
    }

    private fun updateOrders(orders: List<ApiClient.ActiveOrder>) {

        val previouslySelectedOrderId = getSelectedOrderId()

        activeOrders.clear()
        activeOrders.addAll(orders)

        val rows =
            if (orders.isEmpty()) {
                listOf(getString(R.string.orders_empty))
            } else {
                orders.map { renderOrderRow(it) }
            }

        ordersAdapter.clear()
        ordersAdapter.addAll(rows)
        ordersAdapter.notifyDataSetChanged()

        if (orders.isEmpty()) return

        val restoreIndex =
            previouslySelectedOrderId?.let { selectedId ->
                activeOrders.indexOfFirst { it.id == selectedId }
            } ?: -1

        if (restoreIndex >= 0) {
            findViewById<ListView>(R.id.ordersList)
                .setItemChecked(restoreIndex, true)
        }
    }

    private fun showErrorRow(
        message: String,
        ordersListView: ListView,
        saleButton: View
    ) {
        activeOrders.clear()
        ordersAdapter.clear()
        ordersAdapter.add(message)
        ordersAdapter.notifyDataSetChanged()
        ordersListView.clearChoices()
        saleButton.isEnabled = false
    }

    private fun getSelectedOrderId(): String? {
        val checkedPosition =
            findViewById<ListView>(R.id.ordersList).checkedItemPosition

        return if (checkedPosition in activeOrders.indices)
            activeOrders[checkedPosition].id
        else null
    }

    private fun renderOrderRow(order: ApiClient.ActiveOrder): String {

        val shortId =
            if (order.id.length > 6)
                order.id.takeLast(6)
            else order.id

        val header = getString(
            R.string.orders_header,
            shortId,
            order.status,
            currencyFormat.format(order.total)
        )

        if (order.items.isEmpty()) return header

        val lines =
            order.items.joinToString(separator = "\n") { item ->
                getString(
                    R.string.orders_item_line,
                    "${item.name} x${item.qty} = ${currencyFormat.format(item.total)}"
                )
            }

        return "$header\n$lines"
    }

    private fun processRemoteSaleCommandIfAny(session: com.yago.evotor.auth.Session) {
        if (isProcessingRemoteSaleCommand) return

        val command = try {
            ApiClient.fetchPendingSaleCommand(session.baseUrl, session.accessToken)
        } catch (_: Exception) {
            return
        } ?: return

        isProcessingRemoteSaleCommand = true

        runOnUiThread {
            try {
                PendingSellOrderStore.set(command.order)
                startActivity(NavigationApi.createIntentForSellReceiptEdit(false))
                Thread {
                    try {
                        ApiClient.ackSaleCommand(
                            session.baseUrl,
                            session.accessToken,
                            command.id,
                            "accepted"
                        )
                    } catch (error: Exception) {
                        Log.e("YagoEvotor", "Failed to ack accepted sale command", error)
                    } finally {
                        isProcessingRemoteSaleCommand = false
                    }
                }.start()
            } catch (error: Exception) {
                Thread {
                    try {
                        ApiClient.ackSaleCommand(
                            session.baseUrl,
                            session.accessToken,
                            command.id,
                            "failed",
                            error.message ?: "Failed to open sell receipt"
                        )
                    } catch (ackError: Exception) {
                        Log.e("YagoEvotor", "Failed to ack failed sale command", ackError)
                    } finally {
                        isProcessingRemoteSaleCommand = false
                    }
                }.start()
            }
        }
    }
}
