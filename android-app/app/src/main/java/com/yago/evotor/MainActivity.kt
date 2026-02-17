package com.yago.evotor

import android.app.Activity
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
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.yago.evotor.auth.ApiClient
import com.yago.evotor.auth.LoginActivity
import com.yago.evotor.auth.SessionStorage
import java.math.BigDecimal
import java.text.DecimalFormat
import java.util.UUID
import kotlin.math.roundToLong

class MainActivity : AppCompatActivity() {

    private val handler = Handler(Looper.getMainLooper())
    private val pollingIntervalMs = 3000L
    private val currencyFormat = DecimalFormat("0.00")

    private var pollingRunnable: Runnable? = null
    private val activeOrders = mutableListOf<ApiClient.ActiveOrder>()
    private lateinit var ordersAdapter: ArrayAdapter<String>
    private lateinit var sellReceiptLauncher: ActivityResultLauncher<Intent>

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

        sellReceiptLauncher =
            registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
                val messageRes =
                    if (result.resultCode == Activity.RESULT_OK)
                        R.string.sale_success
                    else
                        R.string.sale_canceled

                Toast.makeText(this, getString(messageRes), Toast.LENGTH_SHORT).show()
            }

        ordersAdapter =
            ArrayAdapter(this, android.R.layout.simple_list_item_single_choice, mutableListOf())

        ordersListView.adapter = ordersAdapter
        ordersListView.choiceMode = ListView.CHOICE_MODE_SINGLE

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
            val sellIntent = createSellIntent(order)

            if (sellIntent == null) {
                Toast.makeText(
                    this,
                    getString(R.string.order_items_empty),
                    Toast.LENGTH_SHORT
                ).show()
                return@setOnClickListener
            }

            sellReceiptLauncher.launch(sellIntent)
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
                        val refreshedSession =
                            sessionStorage.loadSession() ?: session

                        val orders = ApiClient.fetchActiveOrders(
                            refreshedSession.baseUrl,
                            refreshedSession.accessToken
                        )

                        runOnUiThread {
                            updateOrders(orders)
                            saleButton.isEnabled =
                                ordersListView.checkedItemPosition in activeOrders.indices
                        }

                    } catch (error: Exception) {
                        runOnUiThread {
                            showErrorRow(
                                getString(
                                    R.string.orders_error,
                                    error.message ?: ""
                                ),
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

    private fun createSellIntent(order: ApiClient.ActiveOrder): Intent? {

        val receiptItems = buildReceiptItems(order)
        if (receiptItems.isEmpty()) {
            Log.w("YagoEvotor", "Order ${order.id} has no valid receipt items")
            return null
        }

        return try {
            createSellIntentViaReflection(receiptItems)
        } catch (error: Exception) {
            Log.e("YagoEvotor", "Failed to create sell intent", error)
            null
        }
    }

    private data class ReceiptItem(
        val name: String,
        val price: BigDecimal,
        val quantity: BigDecimal
    )

    private fun buildReceiptItems(order: ApiClient.ActiveOrder): List<ReceiptItem> {
        val fallbackOrderTotal = order.total
        val fallbackItemTotal =
            if (order.items.isNotEmpty() && fallbackOrderTotal > 0.0)
                fallbackOrderTotal / order.items.size
            else 0.0

        return order.items.mapNotNull { item ->
            if (item.name.isBlank() || item.qty <= 0.0) return@mapNotNull null

            val lineTotal = when {
                item.total > 0.0 -> item.total
                fallbackItemTotal > 0.0 -> fallbackItemTotal
                else -> return@mapNotNull null
            }

            val unitPrice = (lineTotal / item.qty).coerceAtLeast(0.01)
            val roundedUnitPrice = (unitPrice * 100.0).roundToLong().coerceAtLeast(1L) / 100.0

            ReceiptItem(
                name = item.name,
                price = BigDecimal.valueOf(roundedUnitPrice),
                quantity = BigDecimal.valueOf(item.qty)
            )
        }
    }

    private fun createSellIntentViaReflection(
        receiptItems: List<ReceiptItem>
    ): Intent? {
        val positionChanges = receiptItems.map {
            val position = createPositionViaReflection(it.name, it.price, it.quantity)
            createPositionAddViaReflection(position)
        }

        val integrationClass =
            sequenceOf(
                "ru.evotor.framework.core.IntegrationApi",
                "ru.evotor.framework.core.IntegrationAPI"
            )
                .mapNotNull {
                    runCatching { Class.forName(it) }.getOrNull()
                }
                .firstOrNull()
                ?: return null

        val method =
            integrationClass.methods.firstOrNull {
                it.name == "createSellReceiptIntent" &&
                        it.parameterTypes.size == 1 &&
                        List::class.java.isAssignableFrom(it.parameterTypes[0])
            } ?: return null

        val receiver =
            if (java.lang.reflect.Modifier.isStatic(method.modifiers)) null
            else runCatching {
                integrationClass.getField("INSTANCE").get(null)
            }.getOrNull() ?: return null

        return method.invoke(receiver, positionChanges) as? Intent
    }

    private fun createPositionAddViaReflection(position: Any): Any {
        val positionAddClass = Class.forName("ru.evotor.framework.receipt.changes.position.PositionAdd")
        return positionAddClass.getConstructor(position.javaClass).newInstance(position)
    }

    private fun createPositionViaReflection(
        itemName: String,
        price: BigDecimal,
        quantity: BigDecimal
    ): Any {
        val positionClass = Class.forName("ru.evotor.framework.receipt.Position")
        val builderClass = Class.forName("ru.evotor.framework.receipt.Position\$Builder")

        val newInstanceMethod =
            builderClass.methods.firstOrNull {
                it.name == "newInstance" &&
                        it.parameterTypes.size == 7 &&
                        it.parameterTypes[0] == String::class.java &&
                        it.parameterTypes[2] == String::class.java
            }

        if (newInstanceMethod != null) {
            val builder = newInstanceMethod.invoke(
                null,
                UUID.randomUUID().toString(),
                null,
                itemName,
                "шт",
                0,
                price,
                quantity
            )

            return builderClass.getMethod("build").invoke(builder)
                ?: error("Position.Builder.build returned null")
        }

        val builder =
            runCatching { builderClass.getConstructor(String::class.java).newInstance(itemName) }
                .getOrElse {
                    val directPosition = instantiatePosition(positionClass, itemName, price, quantity)
                    builderClass.getConstructor(positionClass).newInstance(directPosition)
                }

        val setPriceMethod =
            builderClass.methods.firstOrNull { it.name == "setPrice" && it.parameterTypes.size == 1 }
                ?: error("Position.Builder.setPrice not found")

        when (setPriceMethod.parameterTypes[0]) {
            java.lang.Long.TYPE,
            java.lang.Long::class.java -> setPriceMethod.invoke(builder, price.multiply(BigDecimal.valueOf(100)).longValueExact())

            BigDecimal::class.java -> setPriceMethod.invoke(builder, price)
            else -> error("Unsupported price type for Position.Builder.setPrice")
        }

        builderClass.methods
            .firstOrNull {
                it.name == "setQuantity" &&
                        it.parameterTypes.size == 1 &&
                        it.parameterTypes[0] == BigDecimal::class.java
            }
            ?.invoke(builder, quantity)

        return builderClass.getMethod("build").invoke(builder)
            ?: error("Position.Builder.build returned null")
    }

    private fun instantiatePosition(
        positionClass: Class<*>,
        itemName: String,
        price: BigDecimal,
        quantity: BigDecimal
    ): Any {
        val constructors = positionClass.declaredConstructors.sortedBy { it.parameterCount }

        constructors.forEach { constructor ->
            val args = mutableListOf<Any?>()
            var bigDecimalIndex = 0
            var canUse = true

            constructor.parameterTypes.forEach { param ->
                val value = when (param) {
                    String::class.java -> itemName
                    java.lang.Long.TYPE,
                    java.lang.Long::class.java -> price.multiply(BigDecimal.valueOf(100)).longValueExact()

                    java.lang.Integer.TYPE,
                    java.lang.Integer::class.java -> 0

                    java.lang.Boolean.TYPE,
                    java.lang.Boolean::class.java -> false

                    BigDecimal::class.java -> {
                        bigDecimalIndex += 1
                        if (bigDecimalIndex == 1) price else quantity
                    }

                    List::class.java,
                    MutableList::class.java,
                    java.util.Collection::class.java -> emptyList<Any>()

                    else -> if (!param.isPrimitive) null else {
                        canUse = false
                        null
                    }
                }

                args += value
            }

            if (!canUse) return@forEach

            val instance = runCatching {
                constructor.isAccessible = true
                constructor.newInstance(*args.toTypedArray())
            }.getOrNull()

            if (instance != null) return instance
        }

        error("Cannot instantiate ru.evotor.framework.receipt.Position")
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
                    item.name,
                    item.qty,
                    currencyFormat.format(item.total)
                )
            }

        return "$header\n$lines"
    }
}
