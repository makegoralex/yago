import { z } from 'zod';

import { objectIdSchema, nonEmptyString, optionalBoolean } from './common';
import { PRODUCT_UNITS } from '../modules/catalog/productUnit';

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
      unit: z.enum(PRODUCT_UNITS).default('шт'),
      manufacturer: z.string().trim().max(200).optional(),
      sku: z.string().trim().max(64).optional(),
      barcode: z.string().trim().regex(/^\d{8}$|^\d{13}$/, 'Barcode must contain 8 or 13 digits').optional(),
      generateSku: z.boolean().optional(),
      generateBarcode: z.boolean().optional(),
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
              unit: z.enum(PRODUCT_UNITS).default('шт'),
              manufacturer: z.string().trim().max(200).optional(),
              sku: z.string().trim().max(64).optional(),
              barcode: z.string().trim().regex(/^\d{8}$|^\d{13}$/, 'Barcode must contain 8 or 13 digits').optional(),
              discountType: z.enum(['percentage', 'fixed']).optional(),
              discountValue: z.number().nonnegative().optional(),
            })
            .refine((item) => Boolean(item.categoryId || item.categoryName), {
              message: 'categoryId or categoryName is required',
            })
            .refine((item) => !item.discountType || item.discountValue !== undefined, {
              message: 'discountValue is required when discountType is set',
            })
        )
        .min(1)
        .max(200),
      createMissingCategories: z.boolean().default(true),
      skipExisting: z.boolean().default(true),
    }),
  },
};
