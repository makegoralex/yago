package com.yago.evotor

import android.util.Log
import ru.evotor.framework.core.IntegrationService
import ru.evotor.framework.core.action.event.receipt.before_positions_edited.BeforePositionsEditedEvent
import ru.evotor.framework.core.action.event.receipt.before_positions_edited.BeforePositionsEditedEventResult
import ru.evotor.framework.core.action.event.receipt.changes.position.PositionAdd
import ru.evotor.framework.core.action.processor.ActionProcessor
import ru.evotor.framework.core.action.processor.BeforePositionsEditedEventProcessor
import ru.evotor.framework.receipt.Position
import java.math.BigDecimal
import java.util.UUID
import kotlin.math.roundToLong

class SellReceiptIntegrationService : IntegrationService() {

    override fun createProcessors(): Map<String, ActionProcessor> {
        return mapOf(
            SELL_BEFORE_POSITIONS_EDITED_ACTION to object : BeforePositionsEditedEventProcessor() {
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

                    val changes = mutableListOf<PositionAdd>()

                    for (item in order.items) {
                        if (item.name.isBlank() || item.qty <= 0.0 || item.total <= 0.0) continue

                        val unitPrice = item.total / item.qty
                        val rounded = (unitPrice * 100.0).roundToLong().coerceAtLeast(1L) / 100.0

                        try {
                            val position = buildPosition(
                                name = item.name,
                                price = BigDecimal.valueOf(rounded),
                                quantity = BigDecimal.valueOf(item.qty)
                            )
                            changes += buildPositionAdd(position)
                        } catch (error: Throwable) {
                            Log.e(TAG, "Failed to convert order item '${item.name}'", error)
                        }
                    }

                    if (changes.isEmpty()) {
                        callback.skip()
                        return
                    }

                    try {
                        callback.onResult(buildBeforePositionsEditedEventResult(changes))
                    } catch (error: Throwable) {
                        Log.e(TAG, "Failed to return BeforePositionsEditedEventResult", error)
                        callback.skip()
                    }
                }
            }
        )
    }

    private fun buildPosition(name: String, price: BigDecimal, quantity: BigDecimal): Position {
        val builderClass = Class.forName("ru.evotor.framework.receipt.Position\$Builder")
        val methods = builderClass.methods.filter { it.name == "newInstance" }

        methods.firstOrNull {
            val p = it.parameterTypes
            p.size == 7 && p[0] == String::class.java && p[3] == String::class.java
        }?.let { method ->
            val builder = method.invoke(
                null,
                UUID.randomUUID().toString(),
                null,
                name,
                "шт",
                0,
                price,
                quantity
            )
            return builderClass.getMethod("build").invoke(builder) as Position
        }

        methods.firstOrNull {
            val p = it.parameterTypes
            p.size == 6 && p[0] == String::class.java && p.any { type -> type.name.endsWith("Measure") }
        }?.let { method ->
            val params = method.parameterTypes
            val args = arrayOfNulls<Any>(params.size)
            for (i in params.indices) {
                args[i] = when (params[i]) {
                    String::class.java -> when (i) {
                        0 -> UUID.randomUUID().toString()
                        2 -> name
                        else -> null
                    }

                    BigDecimal::class.java -> if (args.count { it is BigDecimal } == 0) price else quantity
                    else -> if (params[i].name.endsWith("Measure")) instantiateMeasure(params[i]) else null
                }
            }
            val builder = method.invoke(null, *args)
            return builderClass.getMethod("build").invoke(builder) as Position
        }

        error("Unsupported Position.Builder.newInstance signature")
    }

    private fun instantiateMeasure(measureClass: Class<*>): Any {
        for (constructor in measureClass.constructors.sortedBy { it.parameterCount }) {
            val args = constructor.parameterTypes.map { type ->
                when (type) {
                    String::class.java -> "шт"
                    java.lang.Integer.TYPE, java.lang.Integer::class.java -> 0
                    java.lang.Boolean.TYPE, java.lang.Boolean::class.java -> false
                    else -> null
                }
            }.toTypedArray()

            val instance = runCatching { constructor.newInstance(*args) }.getOrNull()
            if (instance != null) return instance
        }

        error("Cannot instantiate Measure")
    }

    private fun buildPositionAdd(position: Position): PositionAdd {
        val ctor = PositionAdd::class.java.constructors.minByOrNull { it.parameterCount }
            ?: error("PositionAdd constructor not found")

        val args = ctor.parameterTypes.map { type ->
            when (type) {
                Position::class.java -> position
                java.lang.Integer.TYPE, java.lang.Integer::class.java -> 0
                java.lang.Boolean.TYPE, java.lang.Boolean::class.java -> false
                String::class.java -> ""
                else -> null
            }
        }.toTypedArray()

        return ctor.newInstance(*args) as PositionAdd
    }

    private fun buildBeforePositionsEditedEventResult(
        changes: List<PositionAdd>
    ): BeforePositionsEditedEventResult {
        val resultClass = BeforePositionsEditedEventResult::class.java

        val constructor = resultClass.constructors.firstOrNull { it.parameterCount == 2 }
            ?: resultClass.constructors.firstOrNull { it.parameterCount == 3 }
            ?: error("BeforePositionsEditedEventResult constructor not found")

        val args = constructor.parameterTypes.mapIndexed { index, type ->
            when {
                List::class.java.isAssignableFrom(type) -> changes
                index == 0 -> changes
                else -> null
            }
        }.toTypedArray()

        return constructor.newInstance(*args) as BeforePositionsEditedEventResult
    }

    companion object {
        private const val TAG = "YagoEvotor"
        private const val SELL_BEFORE_POSITIONS_EDITED_ACTION =
            "evo.v2.receipt.sell.beforePositionsEdited"
    }
}
