import { Router, type RequestHandler } from 'express';
import { isValidObjectId, Types } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { ProductModel } from '../catalog/catalog.model';
import { CustomerModel } from '../customers/customer.model';
import { earnLoyaltyPoints } from '../loyalty/loyalty.service';
import {
  OrderModel,
  type OrderDocument,
  type OrderItem,
  type OrderStatus,
  type PaymentMethod,
} from './order.model';

const router = Router();

const CASHIER_ROLES = ['admin', 'cashier'];
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card'];
const ORDER_STATUSES: OrderStatus[] = ['draft', 'paid', 'completed'];
const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['draft', 'paid'];
const FULFILLED_ORDER_STATUSES: OrderStatus[] = ['paid', 'completed'];

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

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

type ItemPayload = {
  productId: string;
  qty: number;
  modifiersApplied?: string[];
};

type ItemsRequestPayload = {
  items: ItemPayload[];
  discount?: number;
  customerId?: string | null;
};

const normalizeDiscount = (discount?: number): number => {
  if (discount === undefined) {
    return 0;
  }

  if (typeof discount !== 'number' || Number.isNaN(discount) || discount < 0) {
    throw new Error('Discount must be a positive number');
  }

  return roundCurrency(discount);
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

  const products = await ProductModel.find({ _id: { $in: [...uniqueIds] } }).select('name price');

  if (products.length !== uniqueIds.size) {
    throw new Error('One or more products could not be found');
  }

  const productMap = new Map<string, { name: string; price: number }>();
  for (const product of products) {
    productMap.set(product.id, { name: product.name, price: product.price });
  }

  return sanitizedItems
    .filter((item) => item.qty > 0)
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error('Product lookup failed');
      }

      const price = roundCurrency(product.price);
      const total = roundCurrency(price * item.qty);

      const modifiers = item.modifiersApplied?.length ? item.modifiersApplied : undefined;

      return {
        productId: new Types.ObjectId(item.productId),
        name: product.name,
        qty: item.qty,
        price,
        modifiersApplied: modifiers,
        total,
      } satisfies OrderItem;
    });
};

const recalculateTotals = (items: OrderItem[], discount?: number): { subtotal: number; discount: number; total: number } => {
  const subtotal = roundCurrency(items.reduce((acc, item) => acc + item.total, 0));
  const normalizedDiscount = normalizeDiscount(discount);

  if (normalizedDiscount > subtotal) {
    throw new Error('Discount cannot exceed subtotal');
  }

  const total = roundCurrency(subtotal - normalizedDiscount);

  return { subtotal, discount: normalizedDiscount, total };
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
    const { orgId, locationId, registerId, customerId } = req.body ?? {};
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

    const order = await OrderModel.create({
      orgId: String(orgId).trim(),
      locationId: String(locationId).trim(),
      registerId: String(registerId).trim(),
      cashierId: new Types.ObjectId(cashierId),
      customerId: normalizedCustomerId,
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
      status: 'draft',
    });

    res.status(201).json({ data: order, error: null });
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

    const order = await OrderModel.findById(id);

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

    let totals: { subtotal: number; discount: number; total: number };
    try {
      totals = recalculateTotals(items, payload.discount);
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
    order.subtotal = totals.subtotal;
    order.discount = totals.discount;
    order.total = totals.total;

    await order.save();

    res.json({ data: order, error: null });
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

    if (order.customerId) {
      try {
        await earnLoyaltyPoints(order.customerId.toString(), order.total);
      } catch (error) {
        console.error('Failed to apply loyalty points after payment', error);
      }
    }

    res.json({ data: order, error: null });
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

    res.json({ data: order, error: null });
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

    const orders = await OrderModel.find(filter).sort({ updatedAt: -1 });

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

    const orders = await OrderModel.find(filter).sort({ createdAt: -1 });

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

    const orders = await OrderModel.find(filter).sort({ createdAt: -1 });

    res.json({ data: orders, error: null });
  })
);

export default router;
