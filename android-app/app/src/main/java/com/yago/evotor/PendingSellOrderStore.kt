package com.yago.evotor

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
    }

    @Synchronized
    fun peek(): ApiClient.ActiveOrder? = queue.firstOrNull()

    @Synchronized
    fun consumeFirst() {
        queue.removeFirstOrNull()
    }
}
