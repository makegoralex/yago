package com.yago.evotor

import android.util.Log
import com.yago.evotor.auth.ApiClient

object PendingSellOrderStore {

    private val queue = ArrayDeque<ApiClient.ActiveOrder>()

    @Synchronized
    fun set(order: ApiClient.ActiveOrder) {
        // Keep queue bounded and deduplicate by order id to avoid stale growth
        queue.removeAll { it.id == order.id }
        queue.addLast(order)

        while (queue.size > 5) {
            queue.removeFirstOrNull()
        }

        Log.i("YagoEvotor", "[flow] pending_store_set orderId=${order.id} queueSize=${queue.size}")
    }

    @Synchronized
    fun peek(): ApiClient.ActiveOrder? = queue.firstOrNull()

    @Synchronized
    fun consumeFirst() {
        val removed = queue.removeFirstOrNull()
        Log.i("YagoEvotor", "[flow] pending_store_consume orderId=${removed?.id ?: "none"} queueSize=${queue.size}")
    }
}
