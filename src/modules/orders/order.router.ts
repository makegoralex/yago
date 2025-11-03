import { Router, type RequestHandler } from 'express';
import { isValidObjectId, Types } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { ProductModel } from '../catalog/catalog.model';
import {
  OrderModel,
  type OrderDocument,
  type OrderItem,
  type OrderStatus,
  type OrderTotals,
  type PaymentMethod,
} from './order.model';

const router = Router();

const MANAGER_ROLES = ['admin', 'cashier'];
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'loyalty'];
const ORDER_STATUSES: OrderStatus[] = ['draft', 'paid', 'fiscalized', 'cancelled'];

const roundCurrency = (value: number): number => Number(value.toFixed(2));

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  }) as RequestHandler;
};

router.use(authMiddleware);

interface ItemInput {
  productId: string;
  name?: string;
  qty: number;
  price?: number;
  modifiersApplied?: string[];
}

interface TotalsInput {
  discount?: number;
  tax?: number;
}

const ensureItemsValid = async (items: ItemInput[]): Promise<OrderItem[]> => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one item is required');
  }

  const productIds: string[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid item payload');
    }

    const { productId, qty, price, modifiersApplied } = item;

    if (!productId || typeof productId !== 'string' || !isValidObjectId(productId)) {
      throw new Error('Each item must include a valid productId');
    }

    productIds.push(productId);

    if (typeof qty !== 'number' || Number.isNaN(qty) || qty <= 0) {
      throw new Error('Each item must include a quantity greater than zero');
    }

    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      throw new Error('Item price must be a positive number when provided');
    }

    if (
      modifiersApplied !== undefined &&
      (!Array.isArray(modifiersApplied) ||
        !modifiersApplied.every((modifier) => typeof modifier === 'string'))
    ) {
      throw new Error('modifiersApplied must be an array of strings');
    }
  }

  const uniqueIds = [...new Set(productIds)];
  const products = await ProductModel.find({ _id: { $in: uniqueIds } }).select('name price');

  if (products.length !== uniqueIds.length) {
    throw new Error('One or more products could not be found');
  }

  const productMap = new Map<string, { name: string; price: number }>();
  for (const product of products) {
    productMap.set(product.id, { name: product.name, price: product.price });
  }

  return items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error('Product lookup failed');
    }

    const normalizedName = item.name?.trim() || product.name;
    const normalizedPrice = roundCurrency(item.price ?? product.price);

    const modifiers = item.modifiersApplied
      ?.map((modifier) => modifier.trim())
      .filter(Boolean);

    const total = roundCurrency(normalizedPrice * item.qty);

    return {
      productId: new Types.ObjectId(item.productId),
      name: normalizedName,
      qty: item.qty,
      price: normalizedPrice,
      modifiersApplied: modifiers?.length ? modifiers : undefined,
      total,
    } satisfies OrderItem;
  });
};

const buildTotals = (items: OrderItem[], totalsInput?: TotalsInput): OrderTotals => {
  const subtotal = roundCurrency(items.reduce((acc, item) => acc + item.total, 0));

  const discountValue = totalsInput?.discount;
  const taxValue = totalsInput?.tax;

  if (
    (discountValue !== undefined &&
      (typeof discountValue !== 'number' || Number.isNaN(discountValue) || discountValue < 0)) ||
    (taxValue !== undefined &&
      (typeof taxValue !== 'number' || Number.isNaN(taxValue) || taxValue < 0))
  ) {
    throw new Error('Discount and tax must be positive numbers');
  }

  const normalizedDiscount = discountValue !== undefined ? roundCurrency(discountValue) : 0;
  const normalizedTax = taxValue !== undefined ? roundCurrency(taxValue) : 0;

  const grandTotal = roundCurrency(subtotal - normalizedDiscount + normalizedTax);

  if (grandTotal < 0) {
    throw new Error('Grand total cannot be negative');
  }

  const totals: OrderTotals = {
    subtotal,
    grandTotal,
  };

  if (discountValue !== undefined) {
    totals.discount = normalizedDiscount;
  }

  if (taxValue !== undefined) {
    totals.tax = normalizedTax;
  }

  return totals;
};

const assertOrderMutable = (order: OrderDocument) => {
  if (order.status === 'fiscalized') {
    throw new Error('Fiscalized orders cannot be modified');
  }

  if (order.status === 'cancelled') {
    throw new Error('Cancelled orders cannot be modified');
  }
};

router.post(
  '/',
  requireRole(MANAGER_ROLES),
  asyncHandler(async (req, res) => {
    const { orgId, locationId, registerId, cashierId, customerId, items, totals } = req.body ?? {};

    if (!orgId || !locationId || !registerId || !cashierId) {
      res
        .status(400)
        .json({ data: null, error: 'orgId, locationId, registerId, and cashierId are required' });
      return;
    }

    let orderItems: OrderItem[];
    try {
      orderItems = await ensureItemsValid(items);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid order items';
      res.status(400).json({ data: null, error: message });
      return;
    }

    let orderTotals: OrderTotals;
    try {
      orderTotals = buildTotals(orderItems, totals);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid totals payload';
      res.status(400).json({ data: null, error: message });
      return;
    }

    const order = await OrderModel.create({
      orgId: String(orgId).trim(),
      locationId: String(locationId).trim(),
      registerId: String(registerId).trim(),
      cashierId: String(cashierId).trim(),
      customerId:
        customerId !== undefined && customerId !== null
          ? String(customerId).trim() || undefined
          : undefined,
      items: orderItems,
      totals: orderTotals,
      payments: [],
      status: 'draft',
    });

    res.status(201).json({ data: order, error: null });
  })
);

router.put(
  '/:id/items',
  requireRole(MANAGER_ROLES),
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

    try {
      assertOrderMutable(order);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Order cannot be modified';
      res.status(400).json({ data: null, error: message });
      return;
    }

    const { items, totals } = req.body ?? {};

    let orderItems: OrderItem[];
    try {
      orderItems = await ensureItemsValid(items);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid order items';
      res.status(400).json({ data: null, error: message });
      return;
    }

    let orderTotals: OrderTotals;
    try {
      orderTotals = buildTotals(orderItems, totals);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid totals payload';
      res.status(400).json({ data: null, error: message });
      return;
    }

    order.items = orderItems;
    order.totals = orderTotals;

    await order.save();

    res.json({ data: order, error: null });
  })
);

router.post(
  '/:id/pay',
  requireRole(MANAGER_ROLES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { method, amount } = req.body ?? {};

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid order id' });
      return;
    }

    if (!method || !PAYMENT_METHODS.includes(method)) {
      res.status(400).json({ data: null, error: 'Payment method must be cash, card, or loyalty' });
      return;
    }

    if (typeof amount !== 'number' || Number.isNaN(amount) || amount <= 0) {
      res.status(400).json({ data: null, error: 'Payment amount must be provided' });
      return;
    }

    const order = await OrderModel.findById(id);

    if (!order) {
      res.status(404).json({ data: null, error: 'Order not found' });
      return;
    }

    try {
      assertOrderMutable(order);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Order cannot be modified';
      res.status(400).json({ data: null, error: message });
      return;
    }

    if (order.status === 'paid') {
      res.status(409).json({ data: null, error: 'Order is already paid' });
      return;
    }

    if (roundCurrency(amount) !== roundCurrency(order.totals.grandTotal)) {
      res.status(400).json({ data: null, error: 'Payment amount must equal the order total' });
      return;
    }

    const payment = {
      method: method as PaymentMethod,
      amount: roundCurrency(amount),
      txnId: `MOCK-${order.id}`,
    };

    order.payments = [payment];
    order.status = 'paid';

    await order.save();

    res.json({ data: order, error: null });
  })
);

router.post(
  '/:id/fiscalize',
  requireRole(MANAGER_ROLES),
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
      res
        .status(400)
        .json({ data: null, error: 'Only paid orders can be fiscalized' });
      return;
    }

    order.status = 'fiscalized';
    await order.save();

    res.json({ data: order, error: null });
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

    const order = await OrderModel.findById(id);

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
    const { status, from, to } = req.query;

    const filter: Record<string, unknown> = {};

    if (status) {
      if (
        typeof status !== 'string' ||
        !ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])
      ) {
        res.status(400).json({ data: null, error: 'Invalid status filter' });
        return;
      }

      const statusValue = status as string;
      filter.status = statusValue;
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

    const orders = await OrderModel.find(filter).sort({ createdAt: -1 });

    res.json({ data: orders, error: null });
  })
);

router.delete(
  '/:id',
  requireRole(MANAGER_ROLES),
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

    if (order.status === 'fiscalized') {
      res.status(400).json({ data: null, error: 'Fiscalized orders cannot be cancelled' });
      return;
    }

    if (order.status === 'cancelled') {
      res.status(409).json({ data: null, error: 'Order is already cancelled' });
      return;
    }

    order.status = 'cancelled';
    await order.save();

    res.json({ data: order, error: null });
  })
);

export default router;
