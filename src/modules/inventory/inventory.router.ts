import { Router, type RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { ProductModel } from '../catalog/catalog.model';
import { IngredientModel } from '../catalog/ingredient.model';
import { InventoryItemModel } from './inventoryItem.model';
import { WarehouseModel } from './warehouse.model';
import {
  fetchInventoryItemsWithReferences,
  getInventorySummary,
} from './inventory.service';

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

    res.json({ data: item, error: null });
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
