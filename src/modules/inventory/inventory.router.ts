import { Router, type RequestHandler } from 'express';
import { isValidObjectId, Types } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { ProductModel } from '../catalog/catalog.model';
import { IngredientModel } from '../catalog/ingredient.model';
import { InventoryItemModel } from './inventoryItem.model';
import { WarehouseModel } from './warehouse.model';
import {
  fetchInventoryItemsWithReferences,
  getInventorySummary,
} from './inventory.service';
import { recalculateAverageCostForItem } from './inventoryCost.service';
import { StockReceiptModel } from './stockReceipt.model';
import { SupplierModel } from '../suppliers/supplier.model';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('admin'));

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  }) as RequestHandler;
};

router.get(
  '/warehouses',
  asyncHandler(async (_req, res) => {
    const warehouses = await WarehouseModel.find().sort({ name: 1 });
    res.json({ data: warehouses, error: null });
  })
);

router.post(
  '/warehouses',
  asyncHandler(async (req, res) => {
    const { name, location, description } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ data: null, error: 'Name is required' });
      return;
    }

    const warehouse = new WarehouseModel({
      name: name.trim(),
      location: location?.trim(),
      description: description?.trim(),
    });

    await warehouse.save();

    res.status(201).json({ data: warehouse, error: null });
  })
);

router.put(
  '/warehouses/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid warehouse id' });
      return;
    }

    const { name, location, description } = req.body;

    const update: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name?.trim()) {
        res.status(400).json({ data: null, error: 'Name cannot be empty' });
        return;
      }
      update.name = name.trim();
    }

    if (location !== undefined) {
      update.location = location?.trim() || undefined;
    }

    if (description !== undefined) {
      update.description = description?.trim() || undefined;
    }

    const warehouse = await WarehouseModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!warehouse) {
      res.status(404).json({ data: null, error: 'Warehouse not found' });
      return;
    }

    res.json({ data: warehouse, error: null });
  })
);

router.delete(
  '/warehouses/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid warehouse id' });
      return;
    }

    const warehouse = await WarehouseModel.findById(id);

    if (!warehouse) {
      res.status(404).json({ data: null, error: 'Warehouse not found' });
      return;
    }

    await warehouse.deleteOne();

    res.json({ data: { id: warehouse.id }, error: null });
  })
);

router.get(
  '/items',
  asyncHandler(async (req, res) => {
    const { warehouseId, itemType } = req.query;

    const filter: Record<string, unknown> = {};

    if (warehouseId) {
      if (typeof warehouseId !== 'string' || !isValidObjectId(warehouseId)) {
        res.status(400).json({ data: null, error: 'Invalid warehouseId' });
        return;
      }

      filter.warehouseId = warehouseId;
    }

    if (itemType) {
      if (itemType !== 'ingredient' && itemType !== 'product') {
        res.status(400).json({ data: null, error: 'Invalid itemType' });
        return;
      }

      filter.itemType = itemType;
    }

    const enriched = await fetchInventoryItemsWithReferences(filter);

    res.json({ data: enriched, error: null });
  })
);

router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const { warehouseId, itemType, itemId, quantity, unitCost } = req.body;

    if (!warehouseId || !isValidObjectId(warehouseId)) {
      res.status(400).json({ data: null, error: 'Valid warehouseId is required' });
      return;
    }

    if (itemType !== 'ingredient' && itemType !== 'product') {
      res.status(400).json({ data: null, error: 'itemType must be ingredient or product' });
      return;
    }

    if (!itemId || !isValidObjectId(itemId)) {
      res.status(400).json({ data: null, error: 'Valid itemId is required' });
      return;
    }

    const numericQuantity = Number(quantity ?? 0);

    if (Number.isNaN(numericQuantity) || numericQuantity < 0) {
      res.status(400).json({ data: null, error: 'Quantity must be a positive number' });
      return;
    }

    if (itemType === 'ingredient') {
      const exists = await IngredientModel.exists({ _id: itemId });
      if (!exists) {
        res.status(400).json({ data: null, error: 'Ingredient not found' });
        return;
      }
    } else {
      const exists = await ProductModel.exists({ _id: itemId });
      if (!exists) {
        res.status(400).json({ data: null, error: 'Product not found' });
        return;
      }
    }

    const numericUnitCost = unitCost !== undefined ? Number(unitCost) : undefined;
    if (numericUnitCost !== undefined && (Number.isNaN(numericUnitCost) || numericUnitCost < 0)) {
      res.status(400).json({ data: null, error: 'unitCost must be a positive number' });
      return;
    }

    const item = await InventoryItemModel.findOneAndUpdate(
      { warehouseId, itemType, itemId },
      {
        warehouseId,
        itemType,
        itemId,
        quantity: numericQuantity,
        unitCost: numericUnitCost,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await recalculateAverageCostForItem(itemType, new Types.ObjectId(itemId));

    res.status(201).json({ data: item, error: null });
  })
);

router.post(
  '/items/:id/adjust',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { delta, unitCost } = req.body;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid inventory item id' });
      return;
    }

    const numericDelta = Number(delta ?? 0);

    if (Number.isNaN(numericDelta)) {
      res.status(400).json({ data: null, error: 'delta must be a number' });
      return;
    }

    const numericUnitCost = unitCost !== undefined ? Number(unitCost) : undefined;
    if (numericUnitCost !== undefined && (Number.isNaN(numericUnitCost) || numericUnitCost < 0)) {
      res.status(400).json({ data: null, error: 'unitCost must be a positive number' });
      return;
    }

    const item = await InventoryItemModel.findById(id);

    if (!item) {
      res.status(404).json({ data: null, error: 'Inventory item not found' });
      return;
    }

    item.quantity = Math.max(0, item.quantity + numericDelta);

    if (numericUnitCost !== undefined) {
      item.unitCost = numericUnitCost;
    }

    await item.save();

    await recalculateAverageCostForItem(item.itemType, item.itemId as Types.ObjectId);

    res.json({ data: item, error: null });
  })
);

router.post(
  '/receipts',
  asyncHandler(async (req, res) => {
    const { warehouseId, supplierId, items } = req.body ?? {};

    if (!warehouseId || !isValidObjectId(warehouseId)) {
      res.status(400).json({ data: null, error: 'warehouseId обязателен' });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ data: null, error: 'Добавьте хотя бы одну позицию' });
      return;
    }

    const warehouseExists = await WarehouseModel.exists({ _id: warehouseId });
    if (!warehouseExists) {
      res.status(404).json({ data: null, error: 'Склад не найден' });
      return;
    }

    if (supplierId) {
      if (!isValidObjectId(supplierId)) {
        res.status(400).json({ data: null, error: 'Некорректный поставщик' });
        return;
      }

      const supplierExists = await SupplierModel.exists({ _id: supplierId });
      if (!supplierExists) {
        res.status(404).json({ data: null, error: 'Поставщик не найден' });
        return;
      }
    }

    const normalizedItems: Array<{
      itemType: 'ingredient' | 'product';
      itemId: Types.ObjectId;
      quantity: number;
      unitCost: number;
    }> = [];

    for (const entry of items) {
      if (!entry || typeof entry !== 'object') {
        res.status(400).json({ data: null, error: 'Неверный формат позиции' });
        return;
      }

      const { itemType, itemId, quantity, unitCost } = entry;

      if (itemType !== 'ingredient' && itemType !== 'product') {
        res.status(400).json({ data: null, error: 'itemType должен быть ingredient или product' });
        return;
      }

      if (!itemId || !isValidObjectId(itemId)) {
        res.status(400).json({ data: null, error: 'itemId обязателен' });
        return;
      }

      const numericQty = Number(quantity);
      const numericCost = Number(unitCost);

      if (Number.isNaN(numericQty) || numericQty <= 0) {
        res.status(400).json({ data: null, error: 'Количество должно быть больше нуля' });
        return;
      }

      if (Number.isNaN(numericCost) || numericCost < 0) {
        res.status(400).json({ data: null, error: 'Цена должна быть неотрицательной' });
        return;
      }

      if (itemType === 'ingredient') {
        const exists = await IngredientModel.exists({ _id: itemId });
        if (!exists) {
          res.status(404).json({ data: null, error: 'Ингредиент не найден' });
          return;
        }
      } else {
        const product = await ProductModel.findById(itemId).select('_id');
        if (!product) {
          res.status(404).json({ data: null, error: 'Товар не найден' });
          return;
        }
      }

      normalizedItems.push({
        itemType,
        itemId: new Types.ObjectId(itemId),
        quantity: numericQty,
        unitCost: numericCost,
      });
    }

    if (!req.user?.id) {
      res.status(403).json({ data: null, error: 'Не удалось определить пользователя' });
      return;
    }

    const receipt = await StockReceiptModel.create({
      warehouseId,
      supplierId: supplierId ? new Types.ObjectId(supplierId) : undefined,
      createdBy: new Types.ObjectId(req.user.id),
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

    res.status(201).json({ data: receipt, error: null });
  })
);

router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const summary = await getInventorySummary();

    res.json({ data: summary, error: null });
  })
);

export default router;
