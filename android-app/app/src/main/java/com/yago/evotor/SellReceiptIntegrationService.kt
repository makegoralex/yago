package com.yago.evotor

import ru.evotor.framework.core.IntegrationService
import ru.evotor.framework.core.action.processor.ActionProcessor

/**
 * Temporary no-op integration service.
 *
 * The package names of receipt event classes differ between Evotor integration-library versions,
 * and unresolved imports were breaking local builds. Keeping this service registered allows the
 * app to compile/run while we confirm exact event class paths for the installed SDK variant.
 */
class SellReceiptIntegrationService : IntegrationService() {

    override fun createProcessors(): Map<String, ActionProcessor> {
        return emptyMap()
    }
}
