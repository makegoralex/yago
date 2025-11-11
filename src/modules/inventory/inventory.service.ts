import { FilterQuery, Types } from 'mongoose';

import { ProductModel } from '../catalog/catalog.model';
import { IngredientModel } from '../catalog/ingredient.model';
import { InventoryItemDocument, InventoryItemModel } from './inventoryItem.model';
import { WarehouseModel } from './warehouse.model';
import { StockReceiptModel, type StockReceiptDocument } from './stockReceipt.model';
import { SupplierModel } from '../suppliers/supplier.model';
import { recalculateAverageCostForItem } from './inventoryCost.service';

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

export class InventoryReceiptError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ReceiptItemInput = {
  itemType?: unknown;
  itemId?: unknown;
  quantity?: unknown;
  unitCost?: unknown;
};

export interface CreateReceiptInput {
  warehouseId?: unknown;
  supplierId?: unknown;
  items?: unknown;
  createdBy: string;
}

export const createStockReceipt = async ({
  warehouseId,
  supplierId,
  items,
  createdBy,
}: CreateReceiptInput): Promise<StockReceiptDocument> => {
  if (typeof warehouseId !== 'string' || !Types.ObjectId.isValid(warehouseId)) {
    throw new InventoryReceiptError(400, 'warehouseId обязателен');
  }

  const warehouseExists = await WarehouseModel.exists({ _id: warehouseId });
  if (!warehouseExists) {
    throw new InventoryReceiptError(404, 'Склад не найден');
  }

  const supplierObjectId =
    typeof supplierId === 'string' && Types.ObjectId.isValid(supplierId)
      ? new Types.ObjectId(supplierId)
      : undefined;

  if (supplierId && !supplierObjectId) {
    throw new InventoryReceiptError(400, 'Некорректный поставщик');
  }

  if (supplierObjectId) {
    const supplierExists = await SupplierModel.exists({ _id: supplierObjectId });
    if (!supplierExists) {
      throw new InventoryReceiptError(404, 'Поставщик не найден');
    }
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new InventoryReceiptError(400, 'Добавьте хотя бы одну позицию');
  }

  const normalizedItems: StockReceiptDocument['items'] = [];

  for (const entry of items as ReceiptItemInput[]) {
    if (!entry || typeof entry !== 'object') {
      throw new InventoryReceiptError(400, 'Неверный формат позиции');
    }

    if (entry.itemType !== 'ingredient' && entry.itemType !== 'product') {
      throw new InventoryReceiptError(400, 'itemType должен быть ingredient или product');
    }

    if (typeof entry.itemId !== 'string' || !Types.ObjectId.isValid(entry.itemId)) {
      throw new InventoryReceiptError(400, 'itemId обязателен');
    }

    const quantity = Number(entry.quantity);
    const unitCost = Number(entry.unitCost);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new InventoryReceiptError(400, 'Количество должно быть больше нуля');
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new InventoryReceiptError(400, 'Цена должна быть неотрицательной');
    }

    const itemObjectId = new Types.ObjectId(entry.itemId);

    if (entry.itemType === 'ingredient') {
      const exists = await IngredientModel.exists({ _id: itemObjectId });
      if (!exists) {
        throw new InventoryReceiptError(404, 'Ингредиент не найден');
      }
    } else {
      const exists = await ProductModel.exists({ _id: itemObjectId });
      if (!exists) {
        throw new InventoryReceiptError(404, 'Товар не найден');
      }
    }

    normalizedItems.push({
      itemType: entry.itemType,
      itemId: itemObjectId,
      quantity,
      unitCost,
    });
  }

  const receipt = await StockReceiptModel.create({
    warehouseId: new Types.ObjectId(warehouseId),
    supplierId: supplierObjectId,
    createdBy: new Types.ObjectId(createdBy),
    items: normalizedItems,
  });

  for (const entry of normalizedItems) {
    const item = await InventoryItemModel.findOneAndUpdate(
      { warehouseId, itemType: entry.itemType, itemId: entry.itemId },
      {
        $set: { unitCost: entry.unitCost },
        $inc: { quantity: entry.quantity },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (item) {
      await recalculateAverageCostForItem(entry.itemType, entry.itemId);
    }
  }

  return receipt;
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
