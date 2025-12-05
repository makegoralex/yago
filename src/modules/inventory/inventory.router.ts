import { Router, type Request, type RequestHandler } from 'express';
import { isValidObjectId, Types } from 'mongoose';
import { z } from 'zod';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import { ProductModel } from '../catalog/catalog.model';
import { IngredientModel } from '../catalog/ingredient.model';
import { InventoryItemModel } from './inventoryItem.model';
import { WarehouseModel } from './warehouse.model';
import { SupplierModel } from '../suppliers/supplier.model';
import {
  createStockReceipt,
  deleteStockReceipt,
  fetchInventoryItemsWithReferences,
  getInventorySummary,
  InventoryReceiptError,
  listStockReceipts,
  performInventoryAudit,
  updateStockReceipt,
} from './inventory.service';
import { recalculateAverageCostForItem } from './inventoryCost.service';
import { inventorySchemas } from '../../validation/inventorySchemas';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['owner', 'superAdmin']));

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  }) as RequestHandler;
};

const getOrganizationObjectId = (req: Request): Types.ObjectId | null => {
  const organizationId = req.organization?.id;

  if (!organizationId || !isValidObjectId(organizationId)) {
    return null;
  }

  return new Types.ObjectId(organizationId);
};

router.get(
  '/warehouses',
  asyncHandler(async (req, res) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const warehouses = await WarehouseModel.find({ organizationId }).sort({ name: 1 });
    res.json({ data: warehouses, error: null });
  })
);

router.post(
  '/warehouses',
  validateRequest(inventorySchemas.warehouseCreate),
  asyncHandler(async (req, res) => {
    const { name, location, description } = req.body as z.infer<
      typeof inventorySchemas.warehouseCreate.body
    >;
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const warehouse = new WarehouseModel({
      name,
      location: location?.trim(),
      description: description?.trim(),
      organizationId,
    });

    await warehouse.save();

    res.status(201).json({ data: warehouse, error: null });
  })
);

router.put(
  '/warehouses/:id',
  validateRequest(inventorySchemas.warehouseUpdate),
  asyncHandler(async (req, res) => {
    const { id } = req.params as z.infer<typeof inventorySchemas.warehouseUpdate.params>;
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const { name, location, description } = req.body as z.infer<
      typeof inventorySchemas.warehouseUpdate.body
    >;

    const update: Record<string, unknown> = {};

    if (name !== undefined) {
      update.name = name;
    }

    if (location !== undefined) {
      update.location = location?.trim() || undefined;
    }

    if (description !== undefined) {
      update.description = description?.trim() || undefined;
    }

    const warehouse = await WarehouseModel.findOneAndUpdate({ _id: id, organizationId }, update, {
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
    const organizationId = getOrganizationObjectId(req);

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid warehouse id' });
      return;
    }

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const warehouse = await WarehouseModel.findOne({ _id: id, organizationId });

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
  validateRequest(inventorySchemas.itemsQuery),
  asyncHandler(async (req, res) => {
    const { warehouseId, itemType } = req.query as z.infer<
      typeof inventorySchemas.itemsQuery.query
    >;
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const filter: Record<string, unknown> = { organizationId };

    if (warehouseId) {
      filter.warehouseId = warehouseId;

      const warehouseExists = await WarehouseModel.exists({ _id: warehouseId, organizationId });
      if (!warehouseExists) {
        res.status(404).json({ data: null, error: 'Warehouse not found' });
        return;
      }
    }

    if (itemType) {
      filter.itemType = itemType;
    }

    const enriched = await fetchInventoryItemsWithReferences(filter, organizationId);

    res.json({ data: enriched, error: null });
  })
);

router.post(
  '/items',
  validateRequest(inventorySchemas.itemUpsert),
  asyncHandler(async (req, res) => {
    const { warehouseId, itemType, itemId, quantity, unitCost } = req.body as z.infer<
      typeof inventorySchemas.itemUpsert.body
    >;
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const numericQuantity = Number(quantity ?? 0);

    if (itemType === 'ingredient') {
      const exists = await IngredientModel.exists({ _id: itemId, organizationId });
      if (!exists) {
        res.status(400).json({ data: null, error: 'Ingredient not found' });
        return;
      }
    } else {
      const exists = await ProductModel.exists({ _id: itemId, organizationId });
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
      { warehouseId, itemType, itemId, organizationId },
      {
        warehouseId,
        itemType,
        itemId,
        quantity: numericQuantity,
        unitCost: numericUnitCost,
        organizationId,
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
    const organizationId = getOrganizationObjectId(req);

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid inventory item id' });
      return;
    }

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
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

    const item = await InventoryItemModel.findOne({ _id: id, organizationId });

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
    if (!req.user?.id) {
      res.status(403).json({ data: null, error: 'Не удалось определить пользователя' });
      return;
    }

    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    try {
      const receipt = await createStockReceipt({
        warehouseId: req.body?.warehouseId,
        supplierId: req.body?.supplierId,
        items: req.body?.items,
        occurredAt: req.body?.occurredAt,
        createdBy: req.user.id,
        organizationId,
      });

      res.status(201).json({ data: receipt, error: null });
    } catch (error) {
      if (error instanceof InventoryReceiptError) {
        res.status(error.status).json({ data: null, error: error.message });
        return;
      }

      throw error;
    }
  })
);

router.get(
  '/receipts',
  asyncHandler(async (req, res) => {
    const { type, warehouseId, supplierId } = req.query;
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const filter: Record<string, unknown> = { organizationId };

    if (type) {
      if (type !== 'receipt' && type !== 'writeOff' && type !== 'inventory') {
        res.status(400).json({ data: null, error: 'Некорректный тип документа' });
        return;
      }

      filter.type = type;
    }

    if (warehouseId) {
      if (typeof warehouseId !== 'string' || !isValidObjectId(warehouseId)) {
        res.status(400).json({ data: null, error: 'Некорректный склад' });
        return;
      }

      filter.warehouseId = warehouseId;

      const warehouseExists = await WarehouseModel.exists({ _id: warehouseId, organizationId });
      if (!warehouseExists) {
        res.status(404).json({ data: null, error: 'Склад не найден' });
        return;
      }
    }

    if (supplierId) {
      if (typeof supplierId !== 'string' || !isValidObjectId(supplierId)) {
        res.status(400).json({ data: null, error: 'Некорректный поставщик' });
        return;
      }

      filter.supplierId = supplierId;

      const supplierExists = await SupplierModel.exists({ _id: supplierId, organizationId });
      if (!supplierExists) {
        res.status(404).json({ data: null, error: 'Поставщик не найден' });
        return;
      }
    }

    const receipts = await listStockReceipts(filter, organizationId);

    res.json({ data: receipts, error: null });
  })
);

router.put(
  '/receipts/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    try {
      const receipt = await updateStockReceipt(id, {
        items: req.body?.items,
        supplierId: req.body?.supplierId,
        occurredAt: req.body?.occurredAt,
        organizationId,
        createdBy: req.user?.id ?? '',
        warehouseId: undefined,
        type: undefined,
      });

      res.json({ data: receipt, error: null });
    } catch (error) {
      if (error instanceof InventoryReceiptError) {
        res.status(error.status).json({ data: null, error: error.message });
        return;
      }

      throw error;
    }
  })
);

router.delete(
  '/receipts/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    try {
      await deleteStockReceipt(id, organizationId);
      res.json({ data: { id }, error: null });
    } catch (error) {
      if (error instanceof InventoryReceiptError) {
        res.status(error.status).json({ data: null, error: error.message });
        return;
      }

      throw error;
    }
  })
);

router.post(
  '/write-offs',
  asyncHandler(async (req, res) => {
    if (!req.user?.id) {
      res.status(403).json({ data: null, error: 'Не удалось определить пользователя' });
      return;
    }

    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    try {
      const receipt = await createStockReceipt({
        warehouseId: req.body?.warehouseId,
        supplierId: req.body?.supplierId,
        items: req.body?.items,
        createdBy: req.user.id,
        type: 'writeOff',
        occurredAt: req.body?.occurredAt,
        organizationId,
      });

      res.status(201).json({ data: receipt, error: null });
    } catch (error) {
      if (error instanceof InventoryReceiptError) {
        res.status(error.status).json({ data: null, error: error.message });
        return;
      }

      throw error;
    }
  })
);

router.post(
  '/inventory/audits',
  asyncHandler(async (req, res) => {
    if (!req.user?.id) {
      res.status(403).json({ data: null, error: 'Не удалось определить пользователя' });
      return;
    }

    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    try {
      const audit = await performInventoryAudit({
        warehouseId: req.body?.warehouseId,
        items: req.body?.items,
        performedAt: req.body?.performedAt,
        performedBy: req.user.id,
        organizationId,
      });

      res.status(201).json({ data: audit, error: null });
    } catch (error) {
      if (error instanceof InventoryReceiptError) {
        res.status(error.status).json({ data: null, error: error.message });
        return;
      }

      throw error;
    }
  })
);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const summary = await getInventorySummary(organizationId);

    res.json({ data: summary, error: null });
  })
);

export default router;
