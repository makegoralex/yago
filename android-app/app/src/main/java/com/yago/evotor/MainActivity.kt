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
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.yago.evotor.auth.ApiClient
import com.yago.evotor.auth.LoginActivity
import com.yago.evotor.auth.Session
import com.yago.evotor.auth.SessionStorage
import java.text.DecimalFormat
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

        val firstItem =
            order.items.firstOrNull {
                it.name.isNotBlank() &&
                        it.qty > 0.0 &&
                        it.total > 0.0
            } ?: return null

        val priceInKopecks =
            (firstItem.total / firstItem.qty * 100.0).roundToLong()

        return Intent(EVOTOR_ACTION_SELL)
            .putExtra(EVOTOR_EXTRA_POSITION_NAME, firstItem.name)
            .putExtra(EVOTOR_EXTRA_POSITION_PRICE, priceInKopecks)
            .putExtra(EVOTOR_EXTRA_POSITION_QUANTITY, firstItem.qty)
            .putExtra(
                Intent.EXTRA_TEXT,
                getString(R.string.sale_order_comment, order.id)
            )
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

    private companion object {
        const val EVOTOR_ACTION_SELL =
            "ru.evotor.intent.action.payment.SELL"

        const val EVOTOR_EXTRA_POSITION_NAME =
            "ru.evotor.intent.extra.POSITION_NAME"

        const val EVOTOR_EXTRA_POSITION_PRICE =
            "ru.evotor.intent.extra.POSITION_PRICE"

        const val EVOTOR_EXTRA_POSITION_QUANTITY =
            "ru.evotor.intent.extra.POSITION_QUANTITY"
    }
}
