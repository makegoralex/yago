import { z } from 'zod';

import { objectIdSchema, nonEmptyString, optionalBoolean } from './common';

const modifierOptionSchema = z.object({
  name: nonEmptyString,
  priceChange: z.number().default(0),
  costChange: z.number().default(0),
});

export const catalogSchemas = {
  modifierGroup: {
    body: z.object({
      name: nonEmptyString,
      selectionType: z.enum(['single', 'multiple']),
      required: optionalBoolean,
      sortOrder: z.number().optional(),
      options: z.array(modifierOptionSchema).optional(),
    }),
  },
  categoryCreate: {
    body: z.object({
      name: nonEmptyString,
      sortOrder: z.number().optional(),
    }),
  },
  categoryUpdate: {
    params: z.object({ id: objectIdSchema }),
    body: z.object({
      name: nonEmptyString.optional(),
      sortOrder: z.number().optional(),
    }),
  },
  productCreate: {
    body: z.object({
      name: nonEmptyString,
      categoryId: objectIdSchema,
      price: z.number().optional(),
      basePrice: z.number().optional(),
      discountType: z.enum(['percentage', 'fixed']).optional(),
      discountValue: z.number().nonnegative().optional(),
      modifierGroups: z.array(objectIdSchema).nullable().optional(),
      isActive: optionalBoolean,
      description: z.string().trim().optional(),
      imageUrl: z.string().trim().optional(),
      ingredients: z
        .array(
          z.object({
            ingredientId: objectIdSchema,
            quantity: z.number().positive(),
            unit: z.string().trim().optional(),
          })
        )
        .optional(),
    }),
  },
  productImport: {
    body: z.object({
      items: z
        .array(
          z
            .object({
              rowNumber: z.number().int().positive(),
              name: nonEmptyString,
              categoryId: objectIdSchema.optional(),
              categoryName: z.string().trim().optional(),
              basePrice: z.number().nonnegative(),
              description: z.string().trim().max(2000).optional(),
              imageUrl: z.string().trim().max(2000).optional(),
              isActive: optionalBoolean,
            })
            .refine((item) => Boolean(item.categoryId || item.categoryName), {
              message: 'categoryId or categoryName is required',
            })
        )
        .min(1)
        .max(200),
      createMissingCategories: z.boolean().default(true),
      skipExisting: z.boolean().default(true),
    }),
  },
};
