import { Types } from 'mongoose';

import { InventoryItemModel } from '../inventory/inventoryItem.model';
import { IngredientModel } from './ingredient.model';
import { ProductModel } from './catalog.model';
import { convertQuantity } from './unitConversion';

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const aggregateAverageCost = async (
  itemType: 'ingredient' | 'product',
  itemId: Types.ObjectId
): Promise<number | null> => {
  const [result] = await InventoryItemModel.aggregate<{
    totalQty: number;
    totalCost: number;
  }>([
    {
      $match: {
        itemType,
        itemId,
        quantity: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        totalQty: { $sum: '$quantity' },
        totalCost: {
          $sum: {
            $multiply: ['$quantity', { $ifNull: ['$unitCost', 0] }],
          },
        },
      },
    },
  ]);

  if (!result || !result.totalQty) {
    return null;
  }

  return roundCurrency(result.totalCost / result.totalQty);
};

export const recalculateIngredientCost = async (ingredientId: Types.ObjectId): Promise<number | null> => {
  const average = await aggregateAverageCost('ingredient', ingredientId);

  await IngredientModel.updateOne(
    { _id: ingredientId },
    { costPerUnit: average ?? undefined },
    { runValidators: true }
  );

  return average;
};

const sumIngredientsCost = async (
  productId: Types.ObjectId,
  ingredientRefs: Array<{ ingredientId: Types.ObjectId; quantity: number }>
): Promise<number> => {
  if (!ingredientRefs.length) {
    return 0;
  }

  const ingredientIds = ingredientRefs.map((entry) => entry.ingredientId);
  const ingredients = await IngredientModel.find({ _id: { $in: ingredientIds } })
    .select('_id costPerUnit unit')
    .lean();

  if (!ingredients.length) {
    return 0;
  }

  const ingredientCostMap = new Map(
    ingredients.map((ingredient) => [ingredient._id.toString(), ingredient.costPerUnit ?? 0])
  );
  const ingredientUnitMap = new Map(ingredients.map((ingredient) => [ingredient._id.toString(), ingredient.unit]));

  const cost = ingredientRefs.reduce((acc, entry) => {
    const unitCost = ingredientCostMap.get(entry.ingredientId.toString()) ?? 0;
    const ingredientUnit = ingredientUnitMap.get(entry.ingredientId.toString());
    const normalizedQuantity = convertQuantity(entry.quantity, entry.unit, ingredientUnit);

    return acc + unitCost * normalizedQuantity;
  }, 0);

  return roundCurrency(cost);
};

const sumProductAverageCost = async (productId: Types.ObjectId): Promise<number | null> => {
  return aggregateAverageCost('product', productId);
};

export const recalculateProductCost = async (
  productId: Types.ObjectId | string
): Promise<number | null> => {
  const normalizedId = typeof productId === 'string' ? new Types.ObjectId(productId) : productId;
  const product = await ProductModel.findById(normalizedId).lean();

  if (!product) {
    return null;
  }

  const ingredientRefs = Array.isArray(product.ingredients)
    ? product.ingredients.map((entry) => ({
        ingredientId: new Types.ObjectId(entry.ingredientId),
        quantity: entry.quantity,
        unit: entry.unit,
      }))
    : [];

  let cost: number | null = null;

  if (ingredientRefs.length > 0) {
    cost = await sumIngredientsCost(normalizedId, ingredientRefs);
  } else {
    cost = await sumProductAverageCost(normalizedId);
  }

  if (cost === null) {
    cost = typeof product.basePrice === 'number' ? roundCurrency(product.basePrice) : null;
  }

  await ProductModel.updateOne(
    { _id: normalizedId },
    { costPrice: cost ?? undefined },
    { runValidators: true }
  );

  return cost;
};

export const recalculateProductsForIngredient = async (ingredientId: Types.ObjectId): Promise<void> => {
  const products = await ProductModel.find({ 'ingredients.ingredientId': ingredientId }).select('_id');

  for (const product of products) {
    await recalculateProductCost(product._id as Types.ObjectId);
  }
};
