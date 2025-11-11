import { Router, type RequestHandler } from 'express';

import { authMiddleware, requireRole } from '../middleware/auth';
import { CategoryModel, ProductModel } from '../modules/catalog/catalog.model';
import { IngredientModel } from '../modules/catalog/ingredient.model';
import {
  createStockReceipt,
  fetchInventoryItemsWithReferences,
  getInventorySummary,
  InventoryReceiptError,
} from '../modules/inventory/inventory.service';
import { InventoryItemModel } from '../modules/inventory/inventoryItem.model';
import { WarehouseModel } from '../modules/inventory/warehouse.model';
import { SupplierModel } from '../modules/suppliers/supplier.model';

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
  '/catalog',
  asyncHandler(async (_req, res) => {
    const [categories, products, ingredients] = await Promise.all([
      CategoryModel.find().sort({ sortOrder: 1, name: 1 }),
      ProductModel.find().sort({ name: 1 }),
      IngredientModel.find().sort({ name: 1 }),
    ]);

    res.json({
      data: {
        categories,
        products,
        ingredients,
      },
      error: null,
    });
  })
);

router.get(
  '/inventory',
  asyncHandler(async (_req, res) => {
    const [warehouses, items, summary] = await Promise.all([
      WarehouseModel.find().sort({ name: 1 }),
      fetchInventoryItemsWithReferences({}),
      getInventorySummary(),
    ]);

    res.json({
      data: {
        warehouses,
        items,
        summary,
      },
      error: null,
    });
  })
);

router.post(
  '/inventory/receipts',
  asyncHandler(async (req, res) => {
    if (!req.user?.id) {
      res.status(403).json({ data: null, error: 'Не удалось определить пользователя' });
      return;
    }

    try {
      const receipt = await createStockReceipt({
        warehouseId: req.body?.warehouseId,
        supplierId: req.body?.supplierId,
        items: req.body?.items,
        createdBy: req.user.id,
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
  '/suppliers',
  asyncHandler(async (_req, res) => {
    const suppliers = await SupplierModel.find().sort({ name: 1 });

    res.json({ data: { suppliers }, error: null });
  })
);

router.get(
  '/inventory/low-stock',
  asyncHandler(async (_req, res) => {
    const lowStockItems = await InventoryItemModel.find({ quantity: { $lt: 5 } })
      .sort({ quantity: 1 })
      .limit(20)
      .lean();

    res.json({ data: { items: lowStockItems }, error: null });
  })
);

export default router;
