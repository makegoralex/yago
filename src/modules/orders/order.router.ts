import { Router, type RequestHandler } from 'express';
import { isValidObjectId, Types } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { CategoryModel, ProductModel } from '../catalog/catalog.model';
import { CustomerModel } from '../customers/customer.model';
import { earnLoyaltyPoints } from '../loyalty/loyalty.service';
import {
  OrderModel,
  type OrderDocument,
  type OrderItem,
  type OrderStatus,
  type PaymentMethod,
} from './order.model';
import { WarehouseModel } from '../inventory/warehouse.model';
import { adjustInventoryQuantity } from '../inventory/inventoryCost.service';
import { calculateOrderTotals } from '../discounts/discount.service';

const router = Router();

const CASHIER_ROLES = ['admin', 'cashier', 'barista'];
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card'];
const ORDER_STATUSES: OrderStatus[] = ['draft', 'paid', 'completed'];
const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['draft', 'paid'];
const FULFILLED_ORDER_STATUSES: OrderStatus[] = ['paid', 'completed'];
const CUSTOMER_PROJECTION = 'name phone points';

let cachedDefaultWarehouseId: Types.ObjectId | null | undefined;

const findDefaultWarehouse = async (): Promise<Types.ObjectId | null> => {
  if (cachedDefaultWarehouseId !== undefined) {
    return cachedDefaultWarehouseId ?? null;
  }

  const warehouse = await WarehouseModel.findOne().sort({ createdAt: 1 }).select('_id');
  cachedDefaultWarehouseId = warehouse?._id ? (warehouse._id as Types.ObjectId) : null;
  return cachedDefaultWarehouseId ?? null;
};

const resolveWarehouseId = async (candidate?: unknown): Promise<Types.ObjectId | null> => {
  if (candidate instanceof Types.ObjectId) {
    return candidate;
  }

  if (typeof candidate === 'string') {
    if (!isValidObjectId(candidate)) {
      throw new Error('warehouseId must be a valid identifier');
    }

    const exists = await WarehouseModel.exists({ _id: candidate });
    if (!exists) {
      throw new Error('Склад не найден');
    }

    return new Types.ObjectId(candidate);
  }

  return findDefaultWarehouse();
};

const reloadOrderWithCustomer = async (orderId: Types.ObjectId | string | null | undefined) => {
  if (!orderId) {
    return null;
  }

  return OrderModel.findById(orderId).populate('customerId', CUSTOMER_PROJECTION);
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const deductInventoryForOrder = async (order: OrderDocument): Promise<void> => {
  const warehouseId = await resolveWarehouseId(order.warehouseId);

  if (!warehouseId) {
    return;
  }

  if (!Array.isArray(order.items) || order.items.length === 0) {
    return;
  }

  const productIds = order.items.map((item) => item.productId);
  const products = await ProductModel.find({ _id: { $in: productIds } })
    .select('ingredients')
    .lean();

  if (!products.length) {
    return;
  }

  const productMap = new Map<string, typeof products[number]>();
  for (const product of products) {
    productMap.set(product._id.toString(), product);
  }

  for (const item of order.items) {
    const product = productMap.get(item.productId.toString());
    if (!product) {
      continue;
    }

    if (Array.isArray(product.ingredients) && product.ingredients.length > 0) {
      for (const ingredientEntry of product.ingredients) {
        const consumeQty = ingredientEntry.quantity * item.qty;
        if (consumeQty <= 0) {
          continue;
        }

        await adjustInventoryQuantity(
          warehouseId,
          'ingredient',
          new Types.ObjectId(ingredientEntry.ingredientId),
          -consumeQty
        );
      }
    } else {
      if (item.qty <= 0) {
        continue;
      }

      await adjustInventoryQuantity(warehouseId, 'product', item.productId, -item.qty);
    }
  }
};

router.use(authMiddleware);

type ItemPayload = {
  productId: string;
  qty: number;
  modifiersApplied?: string[];
};

type ItemsRequestPayload = {
  items: ItemPayload[];
  manualDiscount?: number;
  discountIds?: string[];
  customerId?: string | null;
};
 
const buildOrderItems = async (items: ItemPayload[]): Promise<OrderItem[]> => {
  if (!Array.isArray(items)) {
    throw new Error('Items payload must be an array');
  }

  if (items.length === 0) {
    return [];
  }

  const uniqueIds = new Set<string>();
  const sanitizedItems: ItemPayload[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid item payload');
    }

    const { productId, qty, modifiersApplied } = item;

    if (!productId || typeof productId !== 'string' || !isValidObjectId(productId)) {
      throw new Error('Each item must include a valid productId');
    }

    if (typeof qty !== 'number' || Number.isNaN(qty) || qty < 0) {
      throw new Error('Each item must include a quantity greater than or equal to zero');
    }

    if (
      modifiersApplied !== undefined &&
      (!Array.isArray(modifiersApplied) || !modifiersApplied.every((modifier) => typeof modifier === 'string'))
    ) {
      throw new Error('modifiersApplied must be an array of strings');
    }

    uniqueIds.add(productId);

    sanitizedItems.push({
      productId,
      qty,
      modifiersApplied: modifiersApplied?.map((modifier) => modifier.trim()).filter(Boolean),
    });
  }

  const products = await ProductModel.find({ _id: { $in: [...uniqueIds] } })
    .select('name price isActive categoryId')
    .lean();

  if (products.length !== uniqueIds.size) {
    throw new Error('One or more products could not be found');
  }

  const productMap = new Map<
    string,
    { name: string; price: number; isActive?: boolean; categoryId?: Types.ObjectId | null }
  >();
  const categoryIds = new Set<string>();
  for (const product of products) {
    const productCategoryId = product.categoryId ? new Types.ObjectId(product.categoryId) : null;
    if (productCategoryId) {
      categoryIds.add(productCategoryId.toString());
    }

    productMap.set(product._id.toString(), {
      name: product.name,
      price: product.price,
      isActive: product.isActive,
      categoryId: productCategoryId,
    });
  }

  let categoryMap: Map<string, string> = new Map();
  if (categoryIds.size) {
    const categories = await CategoryModel.find({
      _id: { $in: Array.from(categoryIds, (id) => new Types.ObjectId(id)) },
    })
      .select('name')
      .lean();

    categoryMap = new Map(categories.map((category) => [category._id.toString(), category.name ?? '']));
  }

  return sanitizedItems
    .filter((item) => item.qty > 0)
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error('Product lookup failed');
      }

      if (product.isActive === false) {
        throw new Error(`${product.name} недоступен для продажи`);
      }

      const price = roundCurrency(product.price);
      const total = roundCurrency(price * item.qty);

      const modifiers = item.modifiersApplied?.length ? item.modifiersApplied : undefined;
      const categoryId = product.categoryId ?? undefined;
      const categoryName = categoryId ? categoryMap.get(categoryId.toString()) : undefined;

      return {
        productId: new Types.ObjectId(item.productId),
        name: product.name,
        categoryId: categoryId ?? undefined,
        categoryName,
        qty: item.qty,
        price,
        modifiersApplied: modifiers,
        total,
      } satisfies OrderItem;
    });
};

const ensureDraftOrder = (order: OrderDocument): void => {
  if (order.status !== 'draft') {
    throw new Error('Only draft orders can be modified');
  }
};

router.post(
  '/start',
  requireRole(CASHIER_ROLES),
  asyncHandler(async (req, res) => {
    const { orgId, locationId, registerId, customerId, warehouseId } = req.body ?? {};
    const cashierId = req.user?.id;

    if (!cashierId) {
      res.status(403).json({ data: null, error: 'Unable to determine cashier' });
      return;
    }

    if (!orgId || !locationId || !registerId) {
      res
        .status(400)
        .json({ data: null, error: 'orgId, locationId, and registerId are required to start an order' });
      return;
    }

    let normalizedCustomerId: Types.ObjectId | undefined;
    let normalizedWarehouseId: Types.ObjectId | null = null;
    if (customerId) {
      if (typeof customerId !== 'string' || !isValidObjectId(customerId)) {
        res.status(400).json({ data: null, error: 'customerId must be a valid identifier' });
        return;
      }

      const customer = await CustomerModel.findById(customerId);
      if (!customer) {
        res.status(404).json({ data: null, error: 'Customer not found' });
        return;
      }

      normalizedCustomerId = customer._id as Types.ObjectId;
    }

    try {
      normalizedWarehouseId = await resolveWarehouseId(warehouseId);
    } catch (error) {
      res.status(400).json({ data: null, error: error instanceof Error ? error.message : 'Invalid warehouseId' });
      return;
    }

    const normalizedOrgId = String(orgId).trim();
    const normalizedLocationId = String(locationId).trim();
    const normalizedRegisterId = String(registerId).trim();

    const existingDraft = await OrderModel.findOne({
      orgId: normalizedOrgId,
      locationId: normalizedLocationId,
      registerId: normalizedRegisterId,
      cashierId: new Types.ObjectId(cashierId),
      status: 'draft',
    })
      .sort({ updatedAt: -1 })
      .populate('customerId', CUSTOMER_PROJECTION);

    if (existingDraft) {
      res.status(200).json({ data: existingDraft, error: null });
      return;
    }

    const order = await OrderModel.create({
      orgId: normalizedOrgId,
      locationId: normalizedLocationId,
      registerId: normalizedRegisterId,
      cashierId: new Types.ObjectId(cashierId),
      warehouseId: normalizedWarehouseId ?? undefined,
      customerId: normalizedCustomerId,
      items: [],
      subtotal: 0,
      discount: 0,
      manualDiscount: 0,
      appliedDiscounts: [],
      total: 0,
      status: 'draft',
    });

    const populatedOrder = (await reloadOrderWithCustomer(order._id as Types.ObjectId)) ?? order;

    res.status(201).json({ data: populatedOrder, error: null });
  })
);

router.post(
  '/:id/items',
  requireRole(CASHIER_ROLES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid order id' });
      return;
    }

    const order = await OrderModel.findById(id).populate('customerId', CUSTOMER_PROJECTION);

    if (!order) {
      res.status(404).json({ data: null, error: 'Order not found' });
      return;
    }

    try {
      ensureDraftOrder(order);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Order cannot be modified';
      res.status(400).json({ data: null, error: message });
      return;
    }

    const payload = (req.body ?? {}) as ItemsRequestPayload;

    let items: OrderItem[] = [];
    try {
      items = await buildOrderItems(payload.items ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid order items';
      res.status(400).json({ data: null, error: message });
      return;
    }

    let calculation: Awaited<ReturnType<typeof calculateOrderTotals>>;
    try {
      calculation = await calculateOrderTotals({
        items,
        selectedDiscountIds: payload.discountIds,
        manualDiscount: payload.manualDiscount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to calculate totals';
      res.status(400).json({ data: null, error: message });
      return;
    }

    if (payload.customerId !== undefined) {
      if (payload.customerId === null) {
        order.customerId = undefined;
      } else if (typeof payload.customerId === 'string') {
        const trimmedCustomerId = payload.customerId.trim();

        if (!isValidObjectId(trimmedCustomerId)) {
          res.status(400).json({ data: null, error: 'customerId must be a valid identifier or null' });
          return;
        }

        const customer = await CustomerModel.findById(trimmedCustomerId);
        if (!customer) {
          res.status(404).json({ data: null, error: 'Customer not found' });
          return;
        }

        order.customerId = customer._id as Types.ObjectId;
      } else {
        res.status(400).json({ data: null, error: 'customerId must be a valid identifier or null' });
        return;
      }
    }

    order.items = items;
    order.subtotal = calculation.subtotal;
    order.discount = calculation.totalDiscount;
    order.manualDiscount = calculation.manualDiscount;
    order.appliedDiscounts = calculation.appliedDiscounts;
    order.total = calculation.total;

    await order.save();

    const populatedOrder = (await reloadOrderWithCustomer(order._id as Types.ObjectId)) ?? order;

    res.json({ data: populatedOrder, error: null });
  })
);

router.post(
  '/:id/pay',
  requireRole(CASHIER_ROLES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { method, amount, change } = req.body ?? {};

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid order id' });
      return;
    }

    if (!method || !PAYMENT_METHODS.includes(method)) {
      res.status(400).json({ data: null, error: 'Payment method must be cash or card' });
      return;
    }

    if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
      res.status(400).json({ data: null, error: 'Payment amount must be greater than zero' });
      return;
    }

    const order = await OrderModel.findById(id);

    if (!order) {
      res.status(404).json({ data: null, error: 'Order not found' });
      return;
    }

    if (order.status !== 'draft') {
      res.status(409).json({ data: null, error: 'Only draft orders can be paid' });
      return;
    }

    if (order.total <= 0) {
      res.status(400).json({ data: null, error: 'Cannot pay for an empty order' });
      return;
    }

    const normalizedAmount = roundCurrency(amount);
    if (normalizedAmount < order.total) {
      res.status(400).json({ data: null, error: 'Payment amount cannot be less than order total' });
      return;
    }

    const normalizedChange = method === 'cash'
      ? roundCurrency(change ?? normalizedAmount - order.total)
      : 0;

    if (method === 'cash' && normalizedAmount < order.total) {
      res.status(400).json({ data: null, error: 'Cash payments must cover the order total' });
      return;
    }

    if (normalizedChange < 0) {
      res.status(400).json({ data: null, error: 'Change cannot be negative' });
      return;
    }

    order.payment = {
      method,
      amount: normalizedAmount,
      change: normalizedChange > 0 ? normalizedChange : undefined,
    };
    order.status = 'paid';

    await order.save();

    await deductInventoryForOrder(order);

    if (order.customerId) {
      try {
        await earnLoyaltyPoints(order.customerId.toString(), order.total);
      } catch (error) {
        console.error('Failed to apply loyalty points after payment', error);
      }
    }

    const populatedOrder = (await reloadOrderWithCustomer(order._id as Types.ObjectId)) ?? order;

    res.json({ data: populatedOrder, error: null });
  })
);

router.post(
  '/:id/complete',
  requireRole(CASHIER_ROLES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid order id' });
      return;
    }

    const order = await OrderModel.findById(id);

    if (!order) {
      res.status(404).json({ data: null, error: 'Order not found' });
      return;
    }

    if (order.status !== 'paid') {
      res.status(400).json({ data: null, error: 'Only paid orders can be completed' });
      return;
    }

    order.status = 'completed';
    await order.save();

    const populatedOrder = (await reloadOrderWithCustomer(order._id as Types.ObjectId)) ?? order;

    res.json({ data: populatedOrder, error: null });
  })
);

router.delete(
  '/:id',
  requireRole(CASHIER_ROLES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid order id' });
      return;
    }

    const order = await OrderModel.findById(id);

    if (!order) {
      res.status(404).json({ data: null, error: 'Order not found' });
      return;
    }

    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && (!req.user?.id || order.cashierId.toString() !== req.user.id)) {
      res.status(403).json({ data: null, error: 'Forbidden' });
      return;
    }

    if (order.status !== 'draft') {
      res.status(409).json({ data: null, error: 'Only draft orders can be cancelled' });
      return;
    }

    await order.deleteOne();

    res.json({ data: { cancelled: true }, error: null });
  })
);

router.get(
  '/active',
  requireRole(CASHIER_ROLES),
  asyncHandler(async (req, res) => {
    const cashierId = req.user?.id;
    if (!cashierId) {
      res.status(403).json({ data: null, error: 'Unable to determine cashier' });
      return;
    }

    const { registerId } = req.query;

    const filter: Record<string, unknown> = {
      cashierId: new Types.ObjectId(cashierId),
      status: { $in: ACTIVE_ORDER_STATUSES },
    };

    if (registerId && typeof registerId === 'string') {
      filter.registerId = registerId;
    }

    const orders = await OrderModel.find(filter)
      .sort({ updatedAt: -1 })
      .populate('customerId', CUSTOMER_PROJECTION);

    res.json({ data: orders, error: null });
  })
);

router.get(
  '/today',
  requireRole(CASHIER_ROLES),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const filter: Record<string, unknown> = {
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: FULFILLED_ORDER_STATUSES },
    };

    const { cashierId: cashierParam } = req.query;

    if (req.user?.role === 'admin' && typeof cashierParam === 'string') {
      if (!isValidObjectId(cashierParam)) {
        res.status(400).json({ data: null, error: 'cashierId must be a valid identifier' });
        return;
      }

      filter.cashierId = new Types.ObjectId(cashierParam);
    } else if (req.user?.id) {
      filter.cashierId = new Types.ObjectId(req.user.id);
    }

    const orders = await OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .populate('customerId', CUSTOMER_PROJECTION);

    res.json({ data: orders, error: null });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid order id' });
      return;
    }

    const order = await OrderModel.findById(id).populate('customerId', CUSTOMER_PROJECTION);

    if (!order) {
      res.status(404).json({ data: null, error: 'Order not found' });
      return;
    }

    res.json({ data: order, error: null });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, from, to, cashierId, registerId } = req.query;

    const filter: Record<string, unknown> = {};

    if (status) {
      if (typeof status !== 'string' || !ORDER_STATUSES.includes(status as OrderStatus)) {
        res.status(400).json({ data: null, error: 'Invalid status filter' });
        return;
      }

      filter.status = status;
    }

    if (cashierId) {
      if (typeof cashierId !== 'string' || !isValidObjectId(cashierId)) {
        res.status(400).json({ data: null, error: 'cashierId must be a valid identifier' });
        return;
      }

      filter.cashierId = new Types.ObjectId(cashierId);
    }

    if (registerId && typeof registerId === 'string') {
      filter.registerId = registerId;
    }

    if (from) {
      const fromDate = new Date(String(from));
      if (Number.isNaN(fromDate.getTime())) {
        res.status(400).json({ data: null, error: 'Invalid from date filter' });
        return;
      }

      filter.createdAt = { ...(filter.createdAt as Record<string, unknown>), $gte: fromDate };
    }

    if (to) {
      const toDate = new Date(String(to));
      if (Number.isNaN(toDate.getTime())) {
        res.status(400).json({ data: null, error: 'Invalid to date filter' });
        return;
      }

      filter.createdAt = { ...(filter.createdAt as Record<string, unknown>), $lte: toDate };
    }

    const orders = await OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .populate('customerId', CUSTOMER_PROJECTION);

    res.json({ data: orders, error: null });
  })
);

export default router;
