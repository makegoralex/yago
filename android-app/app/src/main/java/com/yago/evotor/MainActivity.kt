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
import java.math.BigDecimal
import java.text.DecimalFormat

class MainActivity : IntegrationAppCompatActivity() {

    private val handler = Handler(Looper.getMainLooper())
    private val pollingIntervalMs = 3000L
    private val currencyFormat = DecimalFormat("0.00")

    private var pollingRunnable: Runnable? = null
    @Volatile private var isProcessingRemoteSaleCommand = false
    @Volatile private var pendingRemoteOrderId: String? = null
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
                if (!openSellReceiptWithItems(order)) {
                    Toast.makeText(
                        this,
                        getString(R.string.sale_intent_error),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            } catch (error: Throwable) {
                Log.e("YagoEvotor", "Manual sale launch failed", error)
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

        Log.i("YagoEvotor", "Received remote sale command ${command.id} for order ${command.targetOrderId}")

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
                            Log.e("YagoEvotor", "Failed to ack unavailable activity", ackError)
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
                        Log.e("YagoEvotor", "Failed to ack accepted sale command", error)
                    } finally {
                        isProcessingRemoteSaleCommand = false
                        pendingRemoteOrderId = null
                    }
                }.start()
            } catch (error: Exception) {
                Log.e("YagoEvotor", "Remote sale command handling failed", error)
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
                        pendingRemoteOrderId = null
                    }
                }.start()
            }
        }
    }

    private fun openSellReceiptEditor(): Boolean {
        return try {
            val intent = NavigationApi.createIntentForSellReceiptEdit(false)
            val canHandle = intent.resolveActivity(packageManager) != null
            if (!canHandle) {
                Log.w("YagoEvotor", "No activity found for Evotor sell receipt intent")
                false
            } else {
                startActivity(intent)
                true
            }
        } catch (error: Throwable) {
            Log.e("YagoEvotor", "Failed to start Evotor sell receipt activity", error)
            false
        }
    }

    private fun openSellReceiptWithItems(order: ApiClient.ActiveOrder): Boolean {
        return runCatching {
            val positionAdds = buildPositionAdds(order)
            if (positionAdds.isEmpty()) return false

            val commandClass = Class.forName("ru.evotor.framework.core.action.command.open_receipt.OpenSellReceiptCommand")

            val constructor = commandClass.constructors
                .firstOrNull { ctor ->
                    val params = ctor.parameterTypes
                    params.isNotEmpty() && List::class.java.isAssignableFrom(params[0])
                }
                ?: return false

            val command = when (constructor.parameterCount) {
                1 -> constructor.newInstance(positionAdds)
                else -> {
                    val args = Array<Any?>(constructor.parameterCount) { null }
                    args[0] = positionAdds
                    constructor.newInstance(*args)
                }
            }

            val processMethod = commandClass.methods.firstOrNull { method ->
                method.name == "process" &&
                    method.parameterTypes.size == 2 &&
                    android.content.Context::class.java.isAssignableFrom(method.parameterTypes[0])
            }

            if (processMethod != null) {
                processMethod.invoke(command, this, null)
                true
            } else {
                openSellReceiptEditor()
            }
        }.getOrElse { error ->
            Log.e("YagoEvotor", "openSellReceiptWithItems failed", error)
            PendingSellOrderStore.set(order)
            openSellReceiptEditor()
        }
    }

    private fun buildPositionAdds(order: ApiClient.ActiveOrder): List<Any> {
        val builderClass = Class.forName("ru.evotor.framework.receipt.Position\$Builder")
        val buildMethod = builderClass.getMethod("build")
        val newInstanceMethods = builderClass.methods.filter { it.name == "newInstance" }

        val positionAddClass = sequenceOf(
            "ru.evotor.framework.core.action.event.receipt.changes.position.PositionAdd",
            "ru.evotor.framework.receipt.changes.position.PositionAdd"
        ).mapNotNull { runCatching { Class.forName(it) }.getOrNull() }
            .firstOrNull() ?: return emptyList()

        val positionAddCtor = positionAddClass.constructors.minByOrNull { it.parameterCount } ?: return emptyList()

        return order.items.mapNotNull { item ->
            if (item.name.isBlank() || item.qty <= 0.0 || item.total <= 0.0) return@mapNotNull null

            val unitPrice = item.total / item.qty
            val rounded = (Math.round(unitPrice * 100.0)).coerceAtLeast(1L) / 100.0

            val position =
                newInstanceMethods.firstOrNull { method ->
                    val p = method.parameterTypes
                    p.size == 7 && p[0] == String::class.java && p[3] == String::class.java
                }?.let { method ->
                    val builder = method.invoke(
                        null,
                        java.util.UUID.randomUUID().toString(),
                        null,
                        item.name,
                        "шт",
                        0,
                        BigDecimal.valueOf(rounded.toDouble()),
                        BigDecimal.valueOf(item.qty.toDouble())
                    )
                    buildMethod.invoke(builder)
                } ?: run {
                    val methodWithMeasure = newInstanceMethods.firstOrNull { m ->
                        val p = m.parameterTypes
                        p.size == 6 && p.any { t -> t.name.endsWith("Measure") }
                    } ?: return@mapNotNull null

                    val args = arrayOfNulls<Any>(methodWithMeasure.parameterCount)
                    val params = methodWithMeasure.parameterTypes
                    var bigDecimalCount = 0
                    for (index in params.indices) {
                        args[index] = when {
                            params[index] == String::class.java && index == 0 -> java.util.UUID.randomUUID().toString()
                            params[index] == String::class.java && index == 2 -> item.name
                            params[index] == BigDecimal::class.java -> {
                                bigDecimalCount += 1
                                if (bigDecimalCount == 1)
                                    BigDecimal.valueOf(rounded.toDouble())
                                else
                                    BigDecimal.valueOf(item.qty.toDouble())
                            }
                            params[index].name.endsWith("Measure") -> instantiateMeasure(params[index])
                            params[index] == Int::class.javaPrimitiveType || params[index] == Int::class.java -> 0
                            else -> null
                        }
                    }

                    val builder = methodWithMeasure.invoke(null, *args)
                    buildMethod.invoke(builder)
                }

            val positionAddArgs = positionAddCtor.parameterTypes.map { type ->
                when {
                    type.isAssignableFrom(position.javaClass) -> position
                    type == Int::class.javaPrimitiveType || type == Int::class.java -> 0
                    type == Boolean::class.javaPrimitiveType || type == Boolean::class.java -> false
                    type == String::class.java -> ""
                    else -> null
                }
            }.toTypedArray()

            positionAddCtor.newInstance(*positionAddArgs)
        }
    }

    private fun instantiateMeasure(measureClass: Class<*>): Any {
        for (constructor in measureClass.constructors.sortedBy { it.parameterCount }) {
            val args = constructor.parameterTypes.map { type ->
                when (type) {
                    String::class.java -> "шт"
                    Int::class.javaPrimitiveType, Int::class.java -> 0
                    Boolean::class.javaPrimitiveType, Boolean::class.java -> false
                    else -> null
                }
            }.toTypedArray()

            runCatching { constructor.newInstance(*args) }.getOrNull()?.let { return it }
        }

        error("Cannot instantiate measure class: ${measureClass.name}")
    }
}
