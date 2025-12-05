import { z } from 'zod';

import { objectIdSchema, nonEmptyString } from './common';

export const inventorySchemas = {
  warehouseCreate: {
    body: z.object({
      name: nonEmptyString,
      location: z.string().trim().optional(),
      description: z.string().trim().optional(),
    }),
  },
  warehouseUpdate: {
    params: z.object({ id: objectIdSchema }),
    body: z.object({
      name: nonEmptyString.optional(),
      location: z.string().trim().optional(),
      description: z.string().trim().optional(),
    }),
  },
  itemsQuery: {
    query: z.object({
      warehouseId: objectIdSchema.optional(),
      itemType: z.enum(['ingredient', 'product']).optional(),
    }),
  },
  itemUpsert: {
    body: z.object({
      warehouseId: objectIdSchema,
      itemType: z.enum(['ingredient', 'product']),
      itemId: objectIdSchema,
      quantity: z.number().nonnegative(),
      unitCost: z.number().nonnegative().optional(),
    }),
  },
};
