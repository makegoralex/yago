import { FilterQuery, Types } from 'mongoose';

import { ProductModel } from '../catalog/catalog.model';
import { IngredientModel } from '../catalog/ingredient.model';
import { InventoryItemDocument, InventoryItemModel } from './inventoryItem.model';
import { WarehouseModel } from './warehouse.model';
import { StockReceiptModel, type StockReceiptDocument } from './stockReceipt.model';
import { SupplierModel } from '../suppliers/supplier.model';
import { adjustInventoryQuantity, recalculateAverageCostForItem } from './inventoryCost.service';
import { InventoryAuditModel, type InventoryAuditDocument } from './inventoryAudit.model';

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
  type?: unknown;
  occurredAt?: unknown;
  createdBy: string;
}

type StockReceiptType = StockReceiptDocument['type'];

const parseReceiptType = (type: unknown, allowInventory = false): StockReceiptType => {
  if (type === undefined) {
    return 'receipt';
  }

  if (type === 'receipt' || type === 'writeOff' || (allowInventory && type === 'inventory')) {
    return type;
  }

  throw new InventoryReceiptError(400, 'Некорректный тип движения');
};

const ensureNotLockedByInventory = async (
  warehouseId: Types.ObjectId,
  receiptDate: Date
): Promise<void> => {
  const warehouse = await WarehouseModel.findById(warehouseId).select('lastInventoryAt');

  if (warehouse?.lastInventoryAt && receiptDate <= warehouse.lastInventoryAt) {
    throw new InventoryReceiptError(
      409,
      'Документ попадает до последней инвентаризации и не может быть изменен'
    );
  }
};

const startOfLocalDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const parseReceiptDate = (value: unknown): Date => {
  let date: Date;

  if (!value) {
    date = new Date();
  } else if (typeof value === 'string') {
    const trimmed = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map((part) => Number(part));
      date = new Date(year, month - 1, day, 0, 0, 0, 0);
    } else {
      date = new Date(trimmed);
    }
  } else if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(String(value));
  }

  if (Number.isNaN(date.getTime())) {
    throw new InventoryReceiptError(400, 'Некорректная дата документа');
  }

  if (date.getTime() > Date.now()) {
    throw new InventoryReceiptError(400, 'Дата документа не может быть в будущем');
  }

  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? startOfLocalDay(date)
    : date;
};

const normalizeReceiptItems = async (items: unknown): Promise<StockReceiptDocument['items']> => {
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

  return normalizedItems;
};

export const createStockReceipt = async ({
  warehouseId,
  supplierId,
  items,
  createdBy,
  type,
  occurredAt,
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

  const normalizedItems = await normalizeReceiptItems(items);
  const receiptType = parseReceiptType(type);
  const happenedAt = parseReceiptDate(occurredAt);

  await ensureNotLockedByInventory(new Types.ObjectId(warehouseId), happenedAt);

  const receipt = await StockReceiptModel.create({
    type: receiptType,
    occurredAt: happenedAt,
    warehouseId: new Types.ObjectId(warehouseId),
    supplierId: supplierObjectId,
    createdBy: new Types.ObjectId(createdBy),
    items: normalizedItems,
  });

  for (const entry of normalizedItems) {
    const delta = receiptType === 'writeOff' ? -entry.quantity : entry.quantity;

    const item = await InventoryItemModel.findOneAndUpdate(
      { warehouseId, itemType: entry.itemType, itemId: entry.itemId },
      {
        $set: { unitCost: entry.unitCost },
        $inc: { quantity: delta },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (item) {
      await recalculateAverageCostForItem(entry.itemType, entry.itemId);
    }
  }

  return receipt;
};

export const listStockReceipts = async (
  filter: FilterQuery<StockReceiptDocument> = {}
): Promise<StockReceiptDocument[]> => {
  return StockReceiptModel.find(filter).sort({ occurredAt: -1, createdAt: -1 });
};

export const updateStockReceipt = async (
  id: string,
  payload: Partial<CreateReceiptInput>
): Promise<StockReceiptDocument> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new InventoryReceiptError(400, 'Некорректный идентификатор документа');
  }

  const receipt = await StockReceiptModel.findById(id);

  if (!receipt) {
    throw new InventoryReceiptError(404, 'Документ не найден');
  }

  if (receipt.type === 'inventory') {
    throw new InventoryReceiptError(409, 'Инвентаризации нельзя изменять');
  }

  await ensureNotLockedByInventory(receipt.warehouseId, receipt.occurredAt);

  const updatedItems = payload.items ? await normalizeReceiptItems(payload.items) : receipt.items;
  const supplierObjectId =
    typeof payload.supplierId === 'string' && Types.ObjectId.isValid(payload.supplierId)
      ? new Types.ObjectId(payload.supplierId)
      : undefined;

  if (payload.supplierId && !supplierObjectId) {
    throw new InventoryReceiptError(400, 'Некорректный поставщик');
  }

  if (supplierObjectId) {
    const supplierExists = await SupplierModel.exists({ _id: supplierObjectId });
    if (!supplierExists) {
      throw new InventoryReceiptError(404, 'Поставщик не найден');
    }
  }

  const newDate = payload.occurredAt ? parseReceiptDate(payload.occurredAt) : receipt.occurredAt;

  await ensureNotLockedByInventory(receipt.warehouseId, newDate);

  const sign = receipt.type === 'writeOff' ? -1 : 1;

  for (const entry of receipt.items) {
    await adjustInventoryQuantity(receipt.warehouseId, entry.itemType, entry.itemId, -sign * entry.quantity);
  }

  for (const entry of updatedItems) {
    await adjustInventoryQuantity(receipt.warehouseId, entry.itemType, entry.itemId, sign * entry.quantity);
    await recalculateAverageCostForItem(entry.itemType, entry.itemId);
  }

  receipt.items = updatedItems;
  receipt.supplierId = supplierObjectId ?? receipt.supplierId;
  receipt.occurredAt = newDate;

  await receipt.save();

  return receipt;
};

export const deleteStockReceipt = async (id: string): Promise<void> => {
  if (!Types.ObjectId.isValid(id)) {
    throw new InventoryReceiptError(400, 'Некорректный идентификатор документа');
  }

  const receipt = await StockReceiptModel.findById(id);

  if (!receipt) {
    return;
  }

  if (receipt.type === 'inventory') {
    throw new InventoryReceiptError(409, 'Инвентаризации нельзя удалять');
  }

  await ensureNotLockedByInventory(receipt.warehouseId, receipt.occurredAt);

  const sign = receipt.type === 'writeOff' ? -1 : 1;

  for (const entry of receipt.items) {
    await adjustInventoryQuantity(receipt.warehouseId, entry.itemType, entry.itemId, -sign * entry.quantity);
    await recalculateAverageCostForItem(entry.itemType, entry.itemId);
  }

  await receipt.deleteOne();
};

export interface InventoryAuditInput {
  warehouseId?: unknown;
  items?: unknown;
  performedAt?: unknown;
  performedBy: string;
}

type InventoryAuditItemInput = {
  itemType?: unknown;
  itemId?: unknown;
  countedQuantity?: unknown;
};

export const performInventoryAudit = async ({
  warehouseId,
  items,
  performedAt,
  performedBy,
}: InventoryAuditInput): Promise<InventoryAuditDocument> => {
  if (typeof warehouseId !== 'string' || !Types.ObjectId.isValid(warehouseId)) {
    throw new InventoryReceiptError(400, 'warehouseId обязателен');
  }

  const warehouseObjectId = new Types.ObjectId(warehouseId);

  const warehouseExists = await WarehouseModel.exists({ _id: warehouseObjectId });
  if (!warehouseExists) {
    throw new InventoryReceiptError(404, 'Склад не найден');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new InventoryReceiptError(400, 'Укажите позиции для инвентаризации');
  }

  const snapshotDate = parseReceiptDate(performedAt);

  await ensureNotLockedByInventory(warehouseObjectId, snapshotDate);

  const normalized: InventoryAuditDocument['items'] = [];

  const existingItems = await InventoryItemModel.find({ warehouseId: warehouseObjectId }).lean();
  const existingMap = new Map(
    existingItems.map((item) => [`${item.itemType}:${item.itemId.toString()}`, item])
  );

  let totalLossValue = 0;
  let totalGainValue = 0;

  for (const raw of items as InventoryAuditItemInput[]) {
    if (!raw || typeof raw !== 'object') {
      throw new InventoryReceiptError(400, 'Неверный формат позиции');
    }

    if (raw.itemType !== 'ingredient' && raw.itemType !== 'product') {
      throw new InventoryReceiptError(400, 'itemType должен быть ingredient или product');
    }

    if (typeof raw.itemId !== 'string' || !Types.ObjectId.isValid(raw.itemId)) {
      throw new InventoryReceiptError(400, 'itemId обязателен');
    }

    const countedQuantity = Number(raw.countedQuantity ?? 0);
    if (!Number.isFinite(countedQuantity) || countedQuantity < 0) {
      throw new InventoryReceiptError(400, 'Количество должно быть неотрицательным');
    }

    const itemId = new Types.ObjectId(raw.itemId);

    if (raw.itemType === 'ingredient') {
      const exists = await IngredientModel.exists({ _id: itemId });
      if (!exists) {
        throw new InventoryReceiptError(404, 'Ингредиент не найден');
      }
    } else {
      const exists = await ProductModel.exists({ _id: itemId });
      if (!exists) {
        throw new InventoryReceiptError(404, 'Товар не найден');
      }
    }

    const key = `${raw.itemType}:${itemId.toString()}`;
    const currentItem = existingMap.get(key);
    const previousQuantity = currentItem?.quantity ?? 0;
    const difference = countedQuantity - previousQuantity;
    const unitCostSnapshot = currentItem?.unitCost;

    normalized.push({
      itemType: raw.itemType,
      itemId,
      previousQuantity,
      countedQuantity,
      difference,
      unitCostSnapshot,
    });

    await adjustInventoryQuantity(warehouseObjectId, raw.itemType, itemId, difference);

    if (unitCostSnapshot !== undefined) {
      const valueDelta = difference * unitCostSnapshot;
      if (valueDelta < 0) {
        totalLossValue += Math.abs(valueDelta);
      } else if (valueDelta > 0) {
        totalGainValue += valueDelta;
      }
    }
  }

  const audit = await InventoryAuditModel.create({
    warehouseId: warehouseObjectId,
    performedBy: new Types.ObjectId(performedBy),
    performedAt: snapshotDate,
    items: normalized,
    totalLossValue,
    totalGainValue,
  });

  await WarehouseModel.findByIdAndUpdate(warehouseObjectId, { lastInventoryAt: snapshotDate });

  await StockReceiptModel.create({
    type: 'inventory',
    occurredAt: snapshotDate,
    warehouseId: warehouseObjectId,
    createdBy: new Types.ObjectId(performedBy),
    items: [],
  });

  return audit;
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
