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
  CashierServiceError,
  createCashierAccount,
  listCashiers,
} from '../modules/staff/cashier.service';
import { getSalesAndShiftStats } from '../services/adminDashboardService';

const router = Router();

router.use(authMiddleware);

const ADMIN_AND_BARISTA: string[] = ['admin', 'barista'];
const DAY_IN_MS = 24 * 60 * 60 * 1000;
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

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

router.get(
  '/cashiers',
  requireRole(ADMIN_AND_BARISTA),
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
  requireRole(ADMIN_AND_BARISTA),
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

router.get(
  '/stats/sales-and-shifts',
  requireRole(ADMIN_AND_BARISTA),
  asyncHandler(async (req: Request, res: Response) => {
    const fromParam = parseDateOnly(req.query.from);
    const toParam = parseDateOnly(req.query.to);

    if (req.query.from && !fromParam) {
      res.status(400).json({ data: null, error: 'from должен быть в формате YYYY-MM-DD' });
      return;
    }

    if (req.query.to && !toParam) {
      res.status(400).json({ data: null, error: 'to должен быть в формате YYYY-MM-DD' });
      return;
    }

    if (fromParam && toParam && fromParam > toParam) {
      res
        .status(400)
        .json({ data: null, error: 'from должен быть меньше или равен значению to' });
      return;
    }

    const exclusiveTo = toParam ? new Date(toParam.getTime() + DAY_IN_MS) : undefined;

    const stats = await getSalesAndShiftStats({
      from: fromParam ?? undefined,
      to: exclusiveTo,
    });

    res.json({
      data: {
        ...stats,
        period: {
          from: fromParam ? fromParam.toISOString() : undefined,
          to: toParam ? toParam.toISOString() : undefined,
        },
      },
      error: null,
    });
  })
);

router.get(
  '/cashiers',
  requireRole(ADMIN_AND_BARISTA),
  asyncHandler(async (_req, res) => {
    const cashiers = await listCashiers();

    res.json({
      data: { cashiers },
      error: null,
    });
  })
);

router.post(
  '/cashiers',
  requireRole(ADMIN_AND_BARISTA),
  asyncHandler(async (req, res) => {
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

router.get(
  '/stats/sales-and-shifts',
  requireRole(ADMIN_AND_BARISTA),
  asyncHandler(async (req, res) => {
    const fromParam = parseDateOnly(req.query.from);
    const toParam = parseDateOnly(req.query.to);

    if (req.query.from && !fromParam) {
      res.status(400).json({ data: null, error: 'from должен быть в формате YYYY-MM-DD' });
      return;
    }

    if (req.query.to && !toParam) {
      res.status(400).json({ data: null, error: 'to должен быть в формате YYYY-MM-DD' });
      return;
    }

    if (fromParam && toParam && fromParam > toParam) {
      res
        .status(400)
        .json({ data: null, error: 'from должен быть меньше или равен значению to' });
      return;
    }

    const exclusiveTo = toParam ? new Date(toParam.getTime() + DAY_IN_MS) : undefined;

    const stats = await getSalesAndShiftStats({
      from: fromParam ?? undefined,
      to: exclusiveTo,
    });

    res.json({
      data: {
        ...stats,
        period: {
          from: fromParam ? fromParam.toISOString() : undefined,
          to: toParam ? toParam.toISOString() : undefined,
        },
      },
      error: null,
    });
  })
);

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

export default router;
