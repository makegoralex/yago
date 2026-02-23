import { z } from 'zod';

import { objectIdSchema, nonEmptyString } from './common';

const orderTagSchema = z.enum(['takeaway', 'delivery']).nullish();

const modifierSchema = z.object({
  groupId: objectIdSchema,
  optionIds: z.array(objectIdSchema).optional(),
});

const orderItemSchema = z.object({
  productId: objectIdSchema,
  qty: z.number().nonnegative({ message: 'Quantity must be zero or greater' }),
  modifiersApplied: z.array(modifierSchema).optional(),
});

export const orderSchemas = {
  startOrder: {
    body: z.object({
      locationId: nonEmptyString,
      registerId: nonEmptyString,
      customerId: objectIdSchema.optional(),
      warehouseId: objectIdSchema.optional(),
      orderTag: orderTagSchema,
    }),
  },
  orderIdParam: {
    params: z.object({ id: objectIdSchema }),
  },
  orderItems: {
    params: z.object({ id: objectIdSchema }),
    body: z.object({
      items: z.array(orderItemSchema),
      manualDiscount: z.number().nonnegative().optional(),
      discountIds: z.array(objectIdSchema).optional(),
      customerId: objectIdSchema.nullish(),
      orderTag: orderTagSchema,
    }),
  },
  orderPayment: {
    params: z.object({ id: objectIdSchema }),
    body: z.object({
      method: z.enum(['cash', 'card']),
      amount: z.number().nonnegative({ message: 'Payment amount must be zero or greater' }),
      change: z.number().nonnegative().optional(),
    }),
  },
};

export type StartOrderBody = z.infer<typeof orderSchemas.startOrder.body>;
export type OrderItemsBody = z.infer<typeof orderSchemas.orderItems.body>;
export type OrderPaymentBody = z.infer<typeof orderSchemas.orderPayment.body>;
