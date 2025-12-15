import { Router, type Request, type RequestHandler, type Response } from 'express';
import { Types } from 'mongoose';

import { authMiddleware, requireRole } from '../middleware/auth';
import { enforceActiveSubscription } from '../middleware/subscription';
import { OrganizationModel } from '../models/Organization';
import { CategoryModel, ProductModel } from '../modules/catalog/catalog.model';
import { IngredientModel } from '../modules/catalog/ingredient.model';
import {
  createStockReceipt,
  fetchInventoryItemsWithReferences,
  getInventorySummary,
  InventoryReceiptError,
  listStockReceipts,
  updateStockReceipt,
  deleteStockReceipt,
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
import {
  FiscalDeviceError,
  closeShift as closeFiscalShift,
  createFiscalDevice,
  deleteFiscalDevice,
  getShiftStatus,
  listFiscalDevices,
  openShift as openFiscalShift,
  sellTestReceipt,
  sendXReport,
  updateFiscalDevice,
} from '../modules/fiscalDevices/fiscalDevice.service';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['owner', 'superAdmin']));
router.use(enforceActiveSubscription);

const isReadOnlyMethod = (method: string): boolean => ['GET', 'HEAD', 'OPTIONS'].includes(method);

router.use(async (req, res, next) => {
  if (req.user?.role === 'superAdmin' || isReadOnlyMethod(req.method)) {
    next();
    return;
  }

  const organizationId = getOrganizationObjectId(req);

  if (!organizationId) {
    res.status(403).json({ data: null, error: 'Organization context is required' });
    return;
  }

  const organization = await OrganizationModel.findById(organizationId).select('subscriptionStatus').lean();

  if (!organization) {
    res.status(404).json({ data: null, error: 'Organization not found' });
    return;
  }

  if (['expired', 'paused'].includes(organization.subscriptionStatus)) {
    res.status(402).json({
      data: null,
      error: 'Подписка неактивна. Продлите её, чтобы продолжить редактирование данных.',
    });
    return;
  }

  next();
});

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const getOrganizationObjectId = (req: Request): Types.ObjectId | null => {
  const organizationId = req.organization?.id;

  if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
    return null;
  }

  return new Types.ObjectId(organizationId);
};

const resolveOrganizationId = (req: Request): Types.ObjectId | null => {
  return (
    getOrganizationObjectId(req) ??
    (typeof req.body?.organizationId === 'string' && Types.ObjectId.isValid(req.body.organizationId)
      ? new Types.ObjectId(req.body.organizationId)
      : null) ??
    (typeof req.query.organizationId === 'string' && Types.ObjectId.isValid(req.query.organizationId)
      ? new Types.ObjectId(req.query.organizationId)
      : null)
  );
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
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);
    const isSuperAdmin = req.user?.role === 'superAdmin';
    const requestedOrganizationId =
      isSuperAdmin && typeof req.query.organizationId === 'string' && Types.ObjectId.isValid(req.query.organizationId)
        ? new Types.ObjectId(req.query.organizationId)
        : null;

    if (!isSuperAdmin && !organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const filter = organizationId ? { organizationId } : requestedOrganizationId ? { organizationId: requestedOrganizationId } : {};
    const cashiers = await listCashiers(isSuperAdmin ? filter : filter);

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
    const organizationId =
      getOrganizationObjectId(req) ??
      (typeof req.body?.organizationId === 'string' && Types.ObjectId.isValid(req.body.organizationId)
        ? new Types.ObjectId(req.body.organizationId)
        : null) ??
      (typeof req.query.organizationId === 'string' && Types.ObjectId.isValid(req.query.organizationId)
        ? new Types.ObjectId(req.query.organizationId)
        : null);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    try {
      const cashier = await createCashierAccount({
        name: typeof name === 'string' ? name : '',
        email: typeof email === 'string' ? email : '',
        password: typeof password === 'string' ? password : '',
        organizationId,
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
    const normalizedRole = role === 'cashier' ? role : undefined;
    const organizationId =
      getOrganizationObjectId(req) ??
      (typeof req.body?.organizationId === 'string' && Types.ObjectId.isValid(req.body.organizationId)
        ? new Types.ObjectId(req.body.organizationId)
        : null) ??
      (typeof req.query.organizationId === 'string' && Types.ObjectId.isValid(req.query.organizationId)
        ? new Types.ObjectId(req.query.organizationId)
        : null);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    try {
      const cashier = await updateCashierAccount({
        id,
        name: typeof name === 'string' ? name : undefined,
        email: typeof email === 'string' ? email : undefined,
        password: typeof password === 'string' ? password : undefined,
        role: normalizedRole,
        organizationId,
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
    const organizationId =
      getOrganizationObjectId(req) ??
      (typeof req.body?.organizationId === 'string' && Types.ObjectId.isValid(req.body.organizationId)
        ? new Types.ObjectId(req.body.organizationId)
        : null) ??
      (typeof req.query.organizationId === 'string' && Types.ObjectId.isValid(req.query.organizationId)
        ? new Types.ObjectId(req.query.organizationId)
        : null);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    try {
      await deleteCashierAccount(id, organizationId);
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
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const [categories, products, ingredients] = await Promise.all([
      CategoryModel.find({ organizationId }).sort({ sortOrder: 1, name: 1 }),
      ProductModel.find({ organizationId }).sort({ name: 1 }),
      IngredientModel.find({ organizationId }).sort({ name: 1 }),
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
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const [warehouses, items, summary] = await Promise.all([
      WarehouseModel.find({ organizationId }).sort({ name: 1 }),
      fetchInventoryItemsWithReferences({}, organizationId),
      getInventorySummary(organizationId),
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
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req: Request, res: Response) => {
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
  '/inventory/receipts',
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req: Request, res: Response) => {
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
      if (typeof warehouseId !== 'string' || !warehouseId.trim()) {
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
      if (typeof supplierId !== 'string' || !supplierId.trim()) {
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
  '/inventory/receipts/:id',
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req: Request, res: Response) => {
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
        type: undefined,
        warehouseId: undefined,
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
  '/inventory/receipts/:id',
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req: Request, res: Response) => {
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

router.get(
  '/suppliers',
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const suppliers = await SupplierModel.find({ organizationId }).sort({ name: 1 });

    res.json({ data: { suppliers }, error: null });
  })
);

router.get(
  '/inventory/low-stock',
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const lowStockItems = await InventoryItemModel.find({ quantity: { $lt: 5 }, organizationId })
      .sort({ quantity: 1 })
      .limit(20)
      .lean();

    res.json({ data: { items: lowStockItems }, error: null });
  })
);

router.get(
  '/stats/sales-and-shifts',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

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

    const stats = await fetchSalesAndShiftStats({ organizationId: organizationId.toString(), from, to });

    res.json({ data: stats, error: null });
  })
);

router.get(
  '/fiscal-devices',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const devices = await listFiscalDevices(organizationId);

    res.json({ data: { devices }, error: null });
  })
);

router.post(
  '/fiscal-devices',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    try {
      const device = await createFiscalDevice({
        organizationId,
        name: req.body?.name,
        ip: req.body?.ip,
        port: req.body?.port,
        taxationSystem: req.body?.taxationSystem,
        operatorName: req.body?.operatorName,
        operatorVatin: req.body?.operatorVatin,
        auth: req.body?.auth,
      });

      res.status(201).json({ data: { device }, error: null });
    } catch (error) {
      if (error instanceof FiscalDeviceError) {
        res.status(error.status).json({ data: null, error: error.message });
        return;
      }

      throw error;
    }
  })
);

router.put(
  '/fiscal-devices/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    try {
      const device = await updateFiscalDevice({
        id,
        organizationId,
        name: req.body?.name,
        ip: req.body?.ip,
        port: req.body?.port,
        taxationSystem: req.body?.taxationSystem,
        operatorName: req.body?.operatorName,
        operatorVatin: req.body?.operatorVatin,
        auth: req.body?.auth,
      });

      res.json({ data: { device }, error: null });
    } catch (error) {
      if (error instanceof FiscalDeviceError) {
        res.status(error.status).json({ data: null, error: error.message });
        return;
      }

      throw error;
    }
  })
);

router.delete(
  '/fiscal-devices/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    try {
      await deleteFiscalDevice(id, organizationId);
      res.json({ data: { deleted: true }, error: null });
    } catch (error) {
      if (error instanceof FiscalDeviceError) {
        res.status(error.status).json({ data: null, error: error.message });
        return;
      }

      throw error;
    }
  })
);

const handleFiscalAction = (
  action: (id: string, organizationId: Types.ObjectId) => Promise<unknown>
): RequestHandler => {
  return asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    try {
      const result = await action(id, organizationId);
      res.json({ data: result, error: null });
    } catch (error) {
      if (error instanceof FiscalDeviceError) {
        res.status(error.status).json({ data: null, error: error.message });
        return;
      }

      throw error;
    }
  });
};

router.post('/fiscal-devices/:id/ping', handleFiscalAction(getShiftStatus));
router.post('/fiscal-devices/:id/open-shift', handleFiscalAction(openFiscalShift));
router.post('/fiscal-devices/:id/close-shift', handleFiscalAction(closeFiscalShift));
router.post('/fiscal-devices/:id/x-report', handleFiscalAction(sendXReport));
router.post('/fiscal-devices/:id/sell-test', handleFiscalAction(sellTestReceipt));

export default router;
