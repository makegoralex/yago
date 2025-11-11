import { Types } from 'mongoose';

import { recalculateIngredientCost, recalculateProductCost, recalculateProductsForIngredient } from '../catalog/productCost.service';
import { InventoryItemModel } from './inventoryItem.model';

export const adjustInventoryQuantity = async (
  warehouseId: Types.ObjectId,
  itemType: 'ingredient' | 'product',
  itemId: Types.ObjectId,
  delta: number
): Promise<void> => {
  const item = await InventoryItemModel.findOne({ warehouseId, itemType, itemId });

  if (!item) {
    if (delta <= 0) {
      return;
    }

    await InventoryItemModel.create({
      warehouseId,
      itemType,
      itemId,
      quantity: delta,
    });
    return;
  }

  item.quantity = Math.max(0, item.quantity + delta);
  await item.save();
};

export const recalculateAverageCostForItem = async (
  itemType: 'ingredient' | 'product',
  itemId: Types.ObjectId
): Promise<void> => {
  if (itemType === 'ingredient') {
    await recalculateIngredientCost(itemId);
    await recalculateProductsForIngredient(itemId);
    return;
  }

  await recalculateProductCost(itemId);
};
