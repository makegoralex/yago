import { Router, type Request, type RequestHandler, type Response } from 'express';

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
import {
  handleCreateDiscount,
  handleDeleteDiscount,
  handleListDiscounts,
  handleUpdateDiscount,
  withErrorHandling as withDiscountErrorHandling,
} from '../modules/discounts/discount.router';
import { fetchSalesAndShiftStats } from '../modules/adminStats/adminStats.service';
import {
  CashierServiceError,
  createCashierAccount,
  deleteCashierAccount,
  listCashiers,
  updateCashierAccount,
} from '../modules/staff/cashier.service';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('admin'));

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const parseDateOnly = (value: unknown): Date | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

router.get(
  '/cashiers',
  asyncHandler(async (_req: Request, res: Response) => {
    const cashiers = await listCashiers();

    res.json({
      data: { cashiers },
      error: null,
    });
  })
);

router.post(
  '/cashiers',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password } = req.body ?? {};

    try {
      const cashier = await createCashierAccount({
        name: typeof name === 'string' ? name : '',
        email: typeof email === 'string' ? email : '',
        password: typeof password === 'string' ? password : '',
      });

      res.status(201).json({ data: { cashier }, error: null });
    } catch (error) {
      if (error instanceof CashierServiceError) {
        res.status(error.status).json({ data: null, error: error.message });
        return;
      }

      throw error;
    }
  })
);

router.put(
  '/cashiers/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, email, password, role } = req.body ?? {};
    const normalizedRole = role === 'cashier' || role === 'barista' ? role : undefined;

    try {
      const cashier = await updateCashierAccount({
        id,
        name: typeof name === 'string' ? name : undefined,
        email: typeof email === 'string' ? email : undefined,
        password: typeof password === 'string' ? password : undefined,
        role: normalizedRole,
      });

      res.json({ data: { cashier }, error: null });
    } catch (error) {
      if (error instanceof CashierServiceError) {
        res.status(error.status).json({ data: null, error: error.message });
        return;
      }

      throw error;
    }
  })
);

router.delete(
  '/cashiers/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      await deleteCashierAccount(id);
      res.json({ data: { deleted: true }, error: null });
    } catch (error) {
      if (error instanceof CashierServiceError) {
        res.status(error.status).json({ data: null, error: error.message });
        return;
      }

      throw error;
    }
  })
);

router.get('/discounts', withDiscountErrorHandling(handleListDiscounts));
router.post('/discounts', withDiscountErrorHandling(handleCreateDiscount));
router.put('/discounts/:id', withDiscountErrorHandling(handleUpdateDiscount));
router.patch('/discounts/:id', withDiscountErrorHandling(handleUpdateDiscount));
router.delete('/discounts/:id', withDiscountErrorHandling(handleDeleteDiscount));

router.get(
  '/catalog',
  requireRole('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
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
  requireRole('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
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
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
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
  requireRole('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    const suppliers = await SupplierModel.find().sort({ name: 1 });

    res.json({ data: { suppliers }, error: null });
  })
);

router.get(
  '/inventory/low-stock',
  requireRole('admin'),
  asyncHandler(async (_req: Request, res: Response) => {
    const lowStockItems = await InventoryItemModel.find({ quantity: { $lt: 5 } })
      .sort({ quantity: 1 })
      .limit(20)
      .lean();

    res.json({ data: { items: lowStockItems }, error: null });
  })
);

router.get(
  '/stats/sales-and-shifts',
  asyncHandler(async (req: Request, res: Response) => {
    const from = parseDateOnly(req.query.from);
    const to = parseDateOnly(req.query.to);

    if (req.query.from && !from) {
      res.status(400).json({ data: null, error: 'from должен быть в формате YYYY-MM-DD' });
      return;
    }

    if (req.query.to && !to) {
      res.status(400).json({ data: null, error: 'to должен быть в формате YYYY-MM-DD' });
      return;
    }

    if (from && to && from > to) {
      res.status(400).json({ data: null, error: 'from должен быть меньше или равен to' });
      return;
    }

    const stats = await fetchSalesAndShiftStats({ from, to });

    res.json({ data: stats, error: null });
  })
);

export default router;
