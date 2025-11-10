import { FilterQuery, Types } from 'mongoose';

import { ProductModel } from '../catalog/catalog.model';
import { IngredientModel } from '../catalog/ingredient.model';
import { InventoryItemDocument, InventoryItemModel } from './inventoryItem.model';
import { WarehouseModel } from './warehouse.model';

type LeanInventoryItem = {
  _id: Types.ObjectId;
  warehouseId: Types.ObjectId;
  itemId: Types.ObjectId;
  itemType: InventoryItemDocument['itemType'];
  quantity: number;
  unitCost?: number;
};

export type InventoryItemWithRefs = LeanInventoryItem & {
  warehouse?: Record<string, unknown> | null;
  ingredient?: Record<string, unknown> | null;
  product?: Record<string, unknown> | null;
};

export const fetchInventoryItemsWithReferences = async (
  filter: FilterQuery<InventoryItemDocument>
): Promise<InventoryItemWithRefs[]> => {
  const items = (await InventoryItemModel.find(filter).lean()) as unknown as LeanInventoryItem[];

  if (items.length === 0) {
    return [];
  }

  const warehouseIds = new Set<string>();
  const ingredientIds = new Set<string>();
  const productIds = new Set<string>();

  for (const item of items) {
    warehouseIds.add(item.warehouseId.toString());
    if (item.itemType === 'ingredient') {
      ingredientIds.add(item.itemId.toString());
    } else {
      productIds.add(item.itemId.toString());
    }
  }

  const [warehouses, ingredients, products] = await Promise.all([
    WarehouseModel.find({ _id: { $in: Array.from(warehouseIds) } }).lean(),
    ingredientIds.size
      ? IngredientModel.find({ _id: { $in: Array.from(ingredientIds) } }).lean()
      : Promise.resolve([]),
    productIds.size
      ? ProductModel.find({ _id: { $in: Array.from(productIds) } }).lean()
      : Promise.resolve([]),
  ]);

  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse._id.toString(), warehouse]));
  const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient._id.toString(), ingredient]));
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));

  return items.map((item) => ({
    ...item,
    warehouse: warehouseMap.get(item.warehouseId.toString()) ?? null,
    ingredient: item.itemType === 'ingredient' ? ingredientMap.get(item.itemId.toString()) ?? null : null,
    product: item.itemType === 'product' ? productMap.get(item.itemId.toString()) ?? null : null,
  }));
};

export const getInventorySummary = async (): Promise<{
  productsTracked: number;
  ingredientsTracked: number;
  stockValue: number;
}> => {
  const [totalProducts, totalIngredients, totalStockValue] = await Promise.all([
    InventoryItemModel.countDocuments({ itemType: 'product' }),
    InventoryItemModel.countDocuments({ itemType: 'ingredient' }),
    InventoryItemModel.aggregate<{ _id: unknown; total: number }>([
      {
        $addFields: {
          totalValue: {
            $multiply: ['$quantity', { $ifNull: ['$unitCost', 0] }],
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalValue' },
        },
      },
    ]),
  ]);

  return {
    productsTracked: totalProducts,
    ingredientsTracked: totalIngredients,
    stockValue: totalStockValue[0]?.total ?? 0,
  };
};
