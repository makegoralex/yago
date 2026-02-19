package com.yago.evotor

import com.yago.evotor.auth.ApiClient

object PendingSellOrderStore {

    @Volatile
    private var order: ApiClient.ActiveOrder? = null

    @Synchronized
    fun set(order: ApiClient.ActiveOrder) {
        this.order = order
    }

    @Synchronized
    fun consume(): ApiClient.ActiveOrder? {
        val current = order
        order = null
        return current
    }
}
