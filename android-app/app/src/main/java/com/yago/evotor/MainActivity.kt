package com.yago.evotor

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
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
    @Volatile private var pendingRemoteOrderId: String? = null
    private val activeOrders = mutableListOf<ApiClient.ActiveOrder>()
    private var availableProducts: List<ApiClient.CatalogProduct> = emptyList()
    private var availableDiscounts: List<ApiClient.DiscountSummary> = emptyList()
    private lateinit var ordersAdapter: ArrayAdapter<String>

    companion object {
        private const val TAG = "YagoEvotor"
        private const val DEFAULT_LOCATION_ID = "main-store"
        private const val DEFAULT_REGISTER_ID = "front-register"
    }

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
        val createOrderButton = findViewById<Button>(R.id.createOrderButton)
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
        createOrderButton.isEnabled = false

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
                logPoint("manual_sale_requested", mapOf("orderId" to order.id))
                if (!openSellReceiptWithItems(order)) {
                    Toast.makeText(
                        this,
                        getString(R.string.sale_intent_error),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            } catch (error: Throwable) {
                Log.e(TAG, "Manual sale launch failed", error)
                Toast.makeText(
                    this,
                    getString(R.string.sale_intent_error),
                    Toast.LENGTH_SHORT
                ).show()
            }
        }

        createOrderButton.setOnClickListener {
            val latestSession = sessionStorage.loadSession()
            if (latestSession == null) {
                Toast.makeText(this, getString(R.string.session_expired), Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (availableProducts.isEmpty()) {
                Toast.makeText(this, getString(R.string.catalog_empty), Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            openCreateOrderDialog(latestSession)
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
                            createOrderButton.isEnabled = availableProducts.isNotEmpty()
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
                        Log.e(TAG, "Polling failed", error)
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
            logPoint("fetch_orders_started")
            val products = ApiClient.fetchCatalogProducts(currentSession.baseUrl, currentSession.accessToken)
            availableProducts = products
            availableDiscounts = ApiClient.fetchAvailableDiscounts(currentSession.baseUrl, currentSession.accessToken)
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

            logPoint("session_refreshed")

            val products = ApiClient.fetchCatalogProducts(updatedSession.baseUrl, updatedSession.accessToken)
            availableProducts = products
            availableDiscounts = ApiClient.fetchAvailableDiscounts(updatedSession.baseUrl, updatedSession.accessToken)
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

        val remoteOrderId = pendingRemoteOrderId
        if (!remoteOrderId.isNullOrBlank()) {
            val remoteIndex = activeOrders.indexOfFirst { it.id == remoteOrderId }
            if (remoteIndex >= 0) {
                findViewById<ListView>(R.id.ordersList).setItemChecked(remoteIndex, true)
            }
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
        pendingRemoteOrderId = command.targetOrderId

        logPoint("remote_sale_command_received", mapOf("commandId" to command.id, "orderId" to command.targetOrderId))

        runOnUiThread {
            try {
                if (!openSellReceiptWithItems(command.order)) {
                    Toast.makeText(
                        this,
                        "Не удалось открыть окно продажи (проверьте Эвотор среду)",
                        Toast.LENGTH_LONG
                    ).show()
                    Thread {
                        try {
                            ApiClient.ackSaleCommand(
                                session.baseUrl,
                                session.accessToken,
                                command.id,
                                "failed",
                                "evotor_sale_receipt_activity_not_available"
                            )
                        } catch (ackError: Exception) {
                            Log.e(TAG, "Failed to ack unavailable activity", ackError)
                        } finally {
                            isProcessingRemoteSaleCommand = false
                            pendingRemoteOrderId = null
                        }
                    }.start()
                    return@runOnUiThread
                }

                Toast.makeText(this, "Команда продажи получена: открываю чек", Toast.LENGTH_SHORT).show()

                Thread {
                    try {
                        ApiClient.ackSaleCommand(
                            session.baseUrl,
                            session.accessToken,
                            command.id,
                            "accepted"
                        )
                    } catch (error: Exception) {
                        Log.e(TAG, "Failed to ack accepted sale command", error)
                    } finally {
                        isProcessingRemoteSaleCommand = false
                        pendingRemoteOrderId = null
                    }
                }.start()
            } catch (error: Exception) {
                Log.e(TAG, "Remote sale command handling failed", error)
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
                        Log.e(TAG, "Failed to ack failed sale command", ackError)
                    } finally {
                        isProcessingRemoteSaleCommand = false
                        pendingRemoteOrderId = null
                    }
                }.start()
            }
        }
    }

    private fun openSellReceiptEditor(): Boolean {
        return try {
            logPoint("evotor_sell_intent_open")
            val intent = NavigationApi.createIntentForSellReceiptEdit(false)
            val canHandle = intent.resolveActivity(packageManager) != null
            if (!canHandle) {
                Log.w(TAG, "No activity found for Evotor sell receipt intent")
                false
            } else {
                startActivity(intent)
                true
            }
        } catch (error: Throwable) {
            Log.e(TAG, "Failed to start Evotor sell receipt activity", error)
            false
        }
    }

    private fun openSellReceiptWithItems(order: ApiClient.ActiveOrder): Boolean {
        return openSellReceiptEditorWithPendingOrder(order)
    }

    private fun openSellReceiptEditorWithPendingOrder(order: ApiClient.ActiveOrder): Boolean {
        logPoint("pending_order_stored", mapOf("orderId" to order.id, "itemsCount" to order.items.size.toString()))
        PendingSellOrderStore.set(order)
        return openSellReceiptEditor()
    }

    private fun openCreateOrderDialog(session: com.yago.evotor.auth.Session) {
        val productTitles = availableProducts.map { product ->
            getString(
                R.string.catalog_item_row,
                product.name,
                currencyFormat.format(product.price)
            )
        }.toTypedArray()

        val selected = BooleanArray(productTitles.size)

        AlertDialog.Builder(this)
            .setTitle(getString(R.string.create_order_dialog_title))
            .setMultiChoiceItems(productTitles, selected) { _, which, isChecked ->
                selected[which] = isChecked
            }
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(getString(R.string.create_order_next)) { _, _ ->
                val selectedProducts = availableProducts.filterIndexed { index, _ -> selected.getOrElse(index) { false } }
                if (selectedProducts.isEmpty()) {
                    Toast.makeText(this, getString(R.string.create_order_products_required), Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                openDiscountDialog(session, selectedProducts)
            }
            .show()
    }

    private fun openDiscountDialog(
        session: com.yago.evotor.auth.Session,
        selectedProducts: List<ApiClient.CatalogProduct>
    ) {
        if (availableDiscounts.isEmpty()) {
            createOrderAndSync(session, selectedProducts, emptyList())
            return
        }

        val discountTitles = availableDiscounts.map { discount ->
            getString(
                R.string.discount_item_row,
                discount.name,
                if (discount.type == "percentage") "${discount.value.toInt()}%" else "${currencyFormat.format(discount.value)} ₽"
            )
        }.toTypedArray()

        val selected = BooleanArray(discountTitles.size)

        AlertDialog.Builder(this)
            .setTitle(getString(R.string.create_order_discounts_title))
            .setMultiChoiceItems(discountTitles, selected) { _, which, isChecked ->
                selected[which] = isChecked
            }
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(getString(R.string.create_order_submit)) { _, _ ->
                val selectedDiscountIds = availableDiscounts
                    .filterIndexed { index, _ -> selected.getOrElse(index) { false } }
                    .map { it.id }

                createOrderAndSync(session, selectedProducts, selectedDiscountIds)
            }
            .show()
    }

    private fun createOrderAndSync(
        session: com.yago.evotor.auth.Session,
        selectedProducts: List<ApiClient.CatalogProduct>,
        selectedDiscountIds: List<String>
    ) {
        Toast.makeText(this, getString(R.string.create_order_in_progress), Toast.LENGTH_SHORT).show()

        Thread {
            try {
                logPoint("create_order_started", mapOf("productsCount" to selectedProducts.size.toString()))

                val result = ApiClient.createOrderFromProducts(
                    baseUrl = session.baseUrl,
                    accessToken = session.accessToken,
                    locationId = DEFAULT_LOCATION_ID,
                    registerId = DEFAULT_REGISTER_ID,
                    products = selectedProducts,
                    selectedDiscountIds = selectedDiscountIds
                )

                availableDiscounts = result.availableDiscounts

                runOnUiThread {
                    Toast.makeText(
                        this,
                        getString(R.string.create_order_success, result.order.id.takeLast(6)),
                        Toast.LENGTH_LONG
                    ).show()
                    logPoint("create_order_success", mapOf("orderId" to result.order.id))
                    refreshOrdersAfterCreate(result.order.id)
                }
            } catch (error: Exception) {
                Log.e(TAG, "Failed to create order", error)
                runOnUiThread {
                    Toast.makeText(
                        this,
                        getString(R.string.create_order_error, error.message ?: getString(R.string.error_unknown)),
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }.start()
    }

    private fun refreshOrdersAfterCreate(orderId: String) {
        val listView = findViewById<ListView>(R.id.ordersList)
        Thread {
            val session = SessionStorage(this).loadSession() ?: return@Thread
            try {
                val orders = ApiClient.fetchActiveOrders(session.baseUrl, session.accessToken)
                runOnUiThread {
                    updateOrders(orders)
                    val index = activeOrders.indexOfFirst { it.id == orderId }
                    if (index >= 0) {
                        listView.setItemChecked(index, true)
                    }
                }
            } catch (error: Exception) {
                Log.w(TAG, "Unable to refresh orders after create", error)
            }
        }.start()
    }

    private fun logPoint(stage: String, details: Map<String, String> = emptyMap()) {
        Log.i(TAG, "[flow] $stage ${if (details.isEmpty()) "" else details}")
    }
}
