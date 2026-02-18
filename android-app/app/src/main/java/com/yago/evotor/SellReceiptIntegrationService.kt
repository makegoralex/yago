package com.yago.evotor

import ru.evotor.framework.component.Position
import ru.evotor.framework.core.IntegrationService
import ru.evotor.framework.core.action.event.receipt.changes_accepted.BeforePositionsEditedEvent
import ru.evotor.framework.core.action.event.receipt.changes_accepted.BeforePositionsEditedEventProcessor
import ru.evotor.framework.core.action.event.receipt.changes_accepted.BeforePositionsEditedEventResult
import ru.evotor.framework.core.action.event.receipt.position.PositionAdd
import ru.evotor.framework.core.action.processor.ActionProcessor
import java.math.BigDecimal
import java.util.UUID
import kotlin.math.roundToLong

class SellReceiptIntegrationService : IntegrationService() {

    override fun createProcessors(): Map<String, ActionProcessor> {
        val processors = HashMap<String, ActionProcessor>()

        processors[BeforePositionsEditedEvent.NAME_SELL_RECEIPT] =
            object : BeforePositionsEditedEventProcessor() {
                override fun call(
                    action: String,
                    event: BeforePositionsEditedEvent,
                    callback: Callback
                ) {
                    val order = PendingSellOrderStore.consume()
                    if (order == null || order.items.isEmpty()) {
                        callback.skip()
                        return
                    }

                    val changes = order.items.mapNotNull { item ->
                        if (item.name.isBlank() || item.qty <= 0.0 || item.total <= 0.0) {
                            return@mapNotNull null
                        }

                        val unitPrice = item.total / item.qty
                        val rounded = (unitPrice * 100.0).roundToLong().coerceAtLeast(1L) / 100.0

                        val position = Position.Builder.newInstance(
                            UUID.randomUUID().toString(),
                            null,
                            item.name,
                            "шт",
                            0,
                            BigDecimal.valueOf(rounded),
                            BigDecimal.valueOf(item.qty)
                        ).build()

                        PositionAdd(position)
                    }

                    if (changes.isEmpty()) {
                        callback.skip()
                    } else {
                        callback.onResult(BeforePositionsEditedEventResult(changes, null))
                    }
                }
            }

        return processors
    }
}
