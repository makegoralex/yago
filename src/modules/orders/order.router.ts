import { Router, type Request, type RequestHandler } from 'express';
import { FilterQuery, isValidObjectId, Types } from 'mongoose';

import { authMiddleware, requireRole } from '../../middleware/auth';
import { enforceActiveSubscription } from '../../middleware/subscription';
import { validateRequest } from '../../middleware/validation';
import { CategoryModel, ProductModel } from '../catalog/catalog.model';
import { CustomerModel } from '../customers/customer.model';
import {
  earnLoyaltyPoints,
  redeemLoyaltyPoints,
  restoreLoyaltyPoints,
  rollbackEarnedLoyaltyPoints,
} from '../loyalty/loyalty.service';
import {
  OrderModel,
  type OrderDocument,
  type OrderItem,
  type OrderStatus,
  type PaymentMethod,
  type OrderTag,
} from './order.model';
import { WarehouseModel } from '../inventory/warehouse.model';
import { adjustInventoryQuantity } from '../inventory/inventoryCost.service';
import { calculateOrderTotals } from '../discounts/discount.service';
import { ShiftDocument, ShiftModel } from '../shifts/shift.model';
import { orderSchemas, type OrderItemsBody, type OrderPaymentBody, type StartOrderBody } from '../../validation/orderSchemas';

const router = Router();

const CASHIER_ROLES = ['cashier', 'owner', 'superAdmin'];
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card'];
const ORDER_STATUSES: OrderStatus[] = ['draft', 'paid', 'completed', 'cancelled'];
const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['draft', 'paid'];
const FULFILLED_ORDER_STATUSES: OrderStatus[] = ['paid', 'completed'];
const SHIFT_HISTORY_STATUSES: OrderStatus[] = ['paid', 'completed', 'cancelled'];
const ORDER_TAGS: OrderTag[] = ['takeaway', 'delivery'];
const CUSTOMER_PROJECTION = 'name phone points';

const cachedDefaultWarehouseIds = new Map<string, Types.ObjectId | null>();

const findDefaultWarehouse = async (organizationId: Types.ObjectId): Promise<Types.ObjectId | null> => {
  const cacheKey = organizationId.toString();

  if (cachedDefaultWarehouseIds.has(cacheKey)) {
    return cachedDefaultWarehouseIds.get(cacheKey) ?? null;
  }

  const warehouse = await WarehouseModel.findOne({ organizationId })
    .sort({ createdAt: 1 })
    .select('_id');

  const resolvedId = warehouse?._id ? (warehouse._id as Types.ObjectId) : null;
  cachedDefaultWarehouseIds.set(cacheKey, resolvedId);
  return resolvedId;
};

const resolveWarehouseId = async (
  organizationId: Types.ObjectId,
  candidate?: unknown
): Promise<Types.ObjectId | null> => {
  if (candidate instanceof Types.ObjectId) {
    return candidate;
  }

  if (typeof candidate === 'string') {
    if (!isValidObjectId(candidate)) {
      throw new Error('warehouseId must be a valid identifier');
    }

    const exists = await WarehouseModel.exists({ _id: candidate, organizationId });
    if (!exists) {
      throw new Error('Склад не найден');
    }

    return new Types.ObjectId(candidate);
  }

  return findDefaultWarehouse(organizationId);
};

const reloadOrderWithCustomer = async (
  orderId: Types.ObjectId | string | null | undefined,
  organizationId?: Types.ObjectId
) => {
  if (!orderId) {
    return null;
  }

  const filter: FilterQuery<OrderDocument> = { _id: orderId };

  if (organizationId) {
    filter.organizationId = organizationId;
  }

  return OrderModel.findOne(filter).populate('customerId', CUSTOMER_PROJECTION);
};

const getOrganizationObjectId = (req: Request): Types.ObjectId | null => {
  const organizationId = req.organization?.id;

  if (!organizationId || !isValidObjectId(organizationId)) {
    return null;
  }

  return new Types.ObjectId(organizationId);
};

const findOrderForOrganization = (
  orderId: string,
  organizationId: Types.ObjectId
): ReturnType<typeof OrderModel.findOne<OrderDocument>> => {
  return OrderModel.findOne<OrderDocument>({ _id: orderId, organizationId });
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const normalizeOrderTag = (value: unknown): OrderTag | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('orderTag must be takeaway or delivery');
  }

  const normalized = value.trim().toLowerCase();
  if (!ORDER_TAGS.includes(normalized as OrderTag)) {
    throw new Error('orderTag must be takeaway or delivery');
  }

  return normalized as OrderTag;
};

const buildShiftHistoryFilter = (
  shift: ShiftDocument,
  until?: Date
): FilterQuery<OrderDocument> => {
  const range: Record<string, Date> = { $gte: shift.openedAt };
  const endDate = until ?? shift.closedAt ?? new Date();

  if (endDate) {
    range.$lte = endDate;
  }

  return {
    orgId: shift.orgId,
    organizationId: shift.organizationId,
    locationId: shift.locationId,
    registerId: shift.registerId,
    status: { $in: SHIFT_HISTORY_STATUSES },
    createdAt: range,
  } as FilterQuery<OrderDocument>;
};

const findActiveShiftForRegister = async (
  organizationId: Types.ObjectId,
  registerId: string,
  cashierId?: string
): Promise<ShiftDocument | null> => {
  const filter: FilterQuery<ShiftDocument> = {
    registerId,
    organizationId,
    status: 'open',
  };

  if (cashierId && isValidObjectId(cashierId)) {
    filter.cashierId = new Types.ObjectId(cashierId);
  }

  return ShiftModel.findOne(filter).sort({ openedAt: -1 });
};

const resolveDateRange = (candidate?: string | string[]) => {
  const value = Array.isArray(candidate) ? candidate[0] : candidate;
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setHours(23, 59, 59, 999);
  return { from, to };
};

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

const deductInventoryForOrder = async (order: OrderDocument): Promise<void> => {
  const organizationId = order.organizationId as Types.ObjectId | undefined;
  if (!organizationId) {
    return;
  }

  const warehouseId = await resolveWarehouseId(organizationId, order.warehouseId);

  if (!warehouseId) {
    return;
  }

  if (!Array.isArray(order.items) || order.items.length === 0) {
    return;
  }

  const productIds = order.items.map((item) => item.productId);
  const products = await ProductModel.find({ _id: { $in: productIds }, organizationId })
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
          -consumeQty,
          organizationId
        );
      }
    } else {
      if (item.qty <= 0) {
        continue;
      }

      await adjustInventoryQuantity(warehouseId, 'product', item.productId, -item.qty, organizationId);
    }
  }
};

const restoreInventoryForOrder = async (order: OrderDocument): Promise<void> => {
  const organizationId = order.organizationId as Types.ObjectId | undefined;
  if (!organizationId) {
    return;
  }

  const warehouseId = await resolveWarehouseId(organizationId, order.warehouseId);

  if (!warehouseId) {
    return;
  }

  if (!Array.isArray(order.items) || order.items.length === 0) {
    return;
  }

  const productIds = order.items.map((item) => item.productId);
  const products = await ProductModel.find({ _id: { $in: productIds }, organizationId })
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
        const restoreQty = ingredientEntry.quantity * item.qty;
        if (restoreQty <= 0) {
          continue;
        }

        await adjustInventoryQuantity(
          warehouseId,
          'ingredient',
          new Types.ObjectId(ingredientEntry.ingredientId),
          restoreQty,
          organizationId
        );
      }
    } else {
      if (item.qty <= 0) {
        continue;
      }

      await adjustInventoryQuantity(warehouseId, 'product', item.productId, item.qty, organizationId);
    }
  }
};

router.use(authMiddleware);
router.use(enforceActiveSubscription);

type ItemModifierPayload = {
  groupId: string;
  optionIds?: string[];
};

type ItemPayload = {
  productId: string;
  qty: number;
  modifiersApplied?: ItemModifierPayload[];
};

type ItemsRequestPayload = {
  items: ItemPayload[];
  manualDiscount?: number;
  discountIds?: string[];
  customerId?: string | null;
  orderTag?: string | null;
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

    if (modifiersApplied !== undefined && !Array.isArray(modifiersApplied)) {
      throw new Error('modifiersApplied must be an array');
    }

    const normalizedModifiers = Array.isArray(modifiersApplied)
      ? modifiersApplied.map((modifier) => {
          if (!modifier || typeof modifier !== 'object') {
            throw new Error('modifiersApplied must contain modifier objects');
          }

          const groupId = (modifier as ItemModifierPayload).groupId;
          const optionIds = (modifier as ItemModifierPayload).optionIds;

          if (!groupId || typeof groupId !== 'string' || !isValidObjectId(groupId)) {
            throw new Error('Each modifier must include a valid groupId');
          }

          if (optionIds !== undefined && (!Array.isArray(optionIds) || optionIds.some((id) => typeof id !== 'string'))) {
            throw new Error('optionIds must be an array of ids');
          }

          const trimmedOptionIds = optionIds?.map((value) => value.trim()).filter(Boolean) ?? [];

          return { groupId, optionIds: trimmedOptionIds } satisfies ItemModifierPayload;
        })
      : undefined;

    uniqueIds.add(productId);

    sanitizedItems.push({
      productId,
      qty,
      modifiersApplied: normalizedModifiers,
    });
  }

  const products = await ProductModel.find({ _id: { $in: [...uniqueIds] } })
    .select('name price isActive categoryId costPrice modifierGroups')
    .populate('modifierGroups')
    .lean();

  if (products.length !== uniqueIds.size) {
    throw new Error('One or more products could not be found');
  }

  const productMap = new Map<string, typeof products[number]>();
  const categoryIds = new Set<string>();
    for (const product of products) {
      const productCategoryId = new Types.ObjectId(product.categoryId);
      categoryIds.add(productCategoryId.toString());

      productMap.set(product._id.toString(), {
        ...product,
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

  const buildLineId = (productId: string, modifiers: OrderItem['modifiersApplied']): string => {
    if (!modifiers || modifiers.length === 0) {
      return productId;
    }

    const parts = modifiers
      .map((modifier) => {
        const optionPart = modifier.options.map((option) => option.optionId.toString()).sort().join(',');
        return `${modifier.groupId.toString()}:${optionPart}`;
      })
      .sort();

    return `${productId}:${parts.join('|')}`;
  };

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

      const modifierGroups = Array.isArray(product.modifierGroups) ? product.modifierGroups : [];
      const modifierGroupMap = new Map(
        modifierGroups.map((group: any) => [String(group._id ?? group.id ?? ''), group])
      );

      const selectedModifiers: OrderItem['modifiersApplied'] = [];
      const requiredGroupIds = new Set(
        modifierGroups
          .filter((group: any) => Boolean(group?.required))
          .map((group: any) => String(group?._id ?? group?.id ?? ''))
          .filter(Boolean)
      );

      for (const modifier of item.modifiersApplied ?? []) {
        const group = modifierGroupMap.get(modifier.groupId);
        if (!group) {
          throw new Error('Selected modifier group is not available for this product');
        }

        const selectionType = group.selectionType === 'multiple' ? 'multiple' : 'single';
        const optionIds = Array.isArray(modifier.optionIds) ? modifier.optionIds : [];
        const uniqueOptionIds = Array.from(new Set(optionIds));

        if (selectionType === 'single' && uniqueOptionIds.length > 1) {
          throw new Error('Only one option can be selected for this modifier group');
        }

          type OptionMapValue = { name?: string; priceChange?: number; costChange?: number };

          const optionMap = new Map<string, OptionMapValue>(
            (group.options ?? []).map((option: any) => [String(option._id ?? option.id ?? ''), option])
          );

        const resolvedOptions = uniqueOptionIds
          .map((optionId) => {
            const option = optionMap.get(optionId);
            if (!option) {
              throw new Error('Selected modifier option not found');
            }

              const optionName = typeof option.name === 'string' ? option.name : '';
              if (!optionName) {
                throw new Error('Selected modifier option not found');
              }

              return {
                optionId: new Types.ObjectId(optionId),
                name: optionName,
                priceChange: Number(option.priceChange ?? 0),
                costChange: Number(option.costChange ?? 0),
              };
            })
            .filter(Boolean);

        if (group.required && resolvedOptions.length === 0) {
          throw new Error(`Выберите вариант для модификатора «${group.name}»`);
        }

        requiredGroupIds.delete(modifier.groupId);

        if (resolvedOptions.length === 0) {
          continue;
        }

        selectedModifiers.push({
          groupId: new Types.ObjectId(modifier.groupId),
          groupName: group.name,
          selectionType,
          required: Boolean(group.required),
          options: resolvedOptions,
        });
      }

      const missingRequired = Array.from(requiredGroupIds);
      if (missingRequired.length > 0) {
        throw new Error('Не выбраны обязательные модификаторы');
      }

      const priceAdjustment = selectedModifiers.reduce(
        (acc, modifier) => acc + modifier.options.reduce((sum, option) => sum + option.priceChange, 0),
        0
      );

      const costAdjustment = selectedModifiers.reduce(
        (acc, modifier) => acc + modifier.options.reduce((sum, option) => sum + option.costChange, 0),
        0
      );

      const basePrice = roundCurrency(product.price);
      const unitPrice = Math.max(0, roundCurrency(basePrice + priceAdjustment));
      const baseCost = typeof product.costPrice === 'number' ? product.costPrice : 0;
      const unitCost = Math.max(0, roundCurrency(baseCost + costAdjustment));
      const total = roundCurrency(unitPrice * item.qty);

      const modifiers = selectedModifiers.length ? selectedModifiers : undefined;
      const categoryId = product.categoryId ?? undefined;
      const categoryName = categoryId ? categoryMap.get(categoryId.toString()) : undefined;
      const lineId = buildLineId(item.productId, modifiers);

      return {
        lineId,
        productId: new Types.ObjectId(item.productId),
        name: product.name,
        categoryId: categoryId ?? undefined,
        categoryName,
        qty: item.qty,
        price: unitPrice,
        costPrice: unitCost,
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

const ensureOrderShiftIsActive = async (
  order: OrderDocument,
  cashierId?: string | null
): Promise<void> => {
  const organizationId = order.organizationId as Types.ObjectId | undefined;
  if (!organizationId) {
    throw new Error('Организация не определена для заказа');
  }

  if (order.shiftId) {
    const shift = await ShiftModel.findOne({ _id: order.shiftId, organizationId });
    if (shift && shift.status === 'open') {
      return;
    }

    if (shift && shift.status === 'closed') {
      throw new Error('Смена уже закрыта. Откройте новую смену, чтобы продолжить работу с заказами');
    }

    order.shiftId = undefined;
  }

  const fallbackShift = await findActiveShiftForRegister(
    organizationId,
    order.registerId,
    cashierId ?? undefined
  );
  if (!fallbackShift) {
    throw new Error('Сначала откройте смену на кассе');
  }

  order.shiftId = fallbackShift._id as Types.ObjectId;
};

router.post(
  '/start',
  requireRole(CASHIER_ROLES),
  validateRequest(orderSchemas.startOrder),
  asyncHandler(async (req, res) => {
    const { locationId, registerId, customerId, warehouseId, orderTag } = req.body as StartOrderBody;
    const organizationId = getOrganizationObjectId(req);
    const cashierId = req.user?.id;

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    if (!cashierId) {
      res.status(403).json({ data: null, error: 'Unable to determine cashier' });
      return;
    }

    let normalizedCustomerId: Types.ObjectId | undefined;
    let normalizedWarehouseId: Types.ObjectId | null = null;
    if (customerId) {
      const customer = await CustomerModel.findById(customerId);
      if (!customer) {
        res.status(404).json({ data: null, error: 'Customer not found' });
        return;
      }

      normalizedCustomerId = customer._id as Types.ObjectId;
    }

    try {
      normalizedWarehouseId = await resolveWarehouseId(organizationId, warehouseId);
    } catch (error) {
      res.status(400).json({ data: null, error: error instanceof Error ? error.message : 'Invalid warehouseId' });
      return;
    }

    let normalizedOrderTag: OrderTag | null = null;
    normalizedOrderTag = normalizeOrderTag(orderTag);

    const normalizedOrgId = organizationId.toString();
    const normalizedLocationId = String(locationId).trim();
    const normalizedRegisterId = String(registerId).trim();

    const activeShift = await findActiveShiftForRegister(organizationId, normalizedRegisterId, cashierId);

    if (!activeShift) {
      res.status(409).json({ data: null, error: 'Сначала откройте смену на кассе' });
      return;
    }

    const order = await OrderModel.create({
      orgId: normalizedOrgId,
      organizationId,
      locationId: normalizedLocationId,
      registerId: normalizedRegisterId,
      shiftId: activeShift._id,
      cashierId: new Types.ObjectId(cashierId),
      warehouseId: normalizedWarehouseId ?? undefined,
      customerId: normalizedCustomerId,
      items: [],
      subtotal: 0,
      discount: 0,
      manualDiscount: 0,
      appliedDiscounts: [],
      total: 0,
      orderTag: normalizedOrderTag ?? undefined,
      status: 'draft',
    });

    const populatedOrder =
      (await reloadOrderWithCustomer(order._id as Types.ObjectId, organizationId)) ?? order;

    res.status(201).json({ data: populatedOrder, error: null });
  })
);

router.post(
  '/:id/items',
  requireRole(CASHIER_ROLES),
  validateRequest(orderSchemas.orderItems),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const order = (await findOrderForOrganization(id, organizationId).populate(
      'customerId',
      CUSTOMER_PROJECTION
    )) as OrderDocument | null;

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

    try {
      await ensureOrderShiftIsActive(order, req.user?.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Сначала откройте смену на кассе';
      res.status(409).json({ data: null, error: message });
      return;
    }

    const payload = req.body as OrderItemsBody;

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
      } else {
        const customer = await CustomerModel.findById(payload.customerId);
        if (!customer) {
          res.status(404).json({ data: null, error: 'Customer not found' });
          return;
        }

        order.customerId = customer._id as Types.ObjectId;
      }
    }

    if (payload.orderTag !== undefined) {
      try {
        const normalizedTag = normalizeOrderTag(payload.orderTag);
        order.orderTag = normalizedTag ?? undefined;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'orderTag must be takeaway or delivery';
        res.status(400).json({ data: null, error: message });
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

    const populatedOrder =
      (await reloadOrderWithCustomer(order._id as Types.ObjectId, order.organizationId)) ?? order;

    res.json({ data: populatedOrder, error: null });
  })
);

router.post(
  '/:id/pay',
  requireRole(CASHIER_ROLES),
  validateRequest(orderSchemas.orderPayment),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { method, amount, change } = req.body as OrderPaymentBody;
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const order = (await findOrderForOrganization(id, organizationId)) as OrderDocument | null;

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

    try {
      await ensureOrderShiftIsActive(order, req.user?.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Сначала откройте смену на кассе';
      res.status(409).json({ data: null, error: message });
      return;
    }

    if (order.manualDiscount > 0) {
      if (!order.customerId) {
        res.status(400).json({ data: null, error: 'Для списания баллов нужен клиент' });
        return;
      }

      try {
        await redeemLoyaltyPoints(order.customerId.toString(), order.manualDiscount);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось списать баллы';
        res.status(400).json({ data: null, error: message });
        return;
      }
    }

    order.payment = {
      method,
      amount: normalizedAmount,
      change: normalizedChange > 0 ? normalizedChange : undefined,
    };
    order.status = 'paid';
    order.receiptId = undefined;

    await order.save();

    await deductInventoryForOrder(order);

    if (order.customerId) {
      try {
        await earnLoyaltyPoints(order.customerId.toString(), order.total);
      } catch (error) {
        console.error('Failed to apply loyalty points after payment', error);
      }
    }

    const populatedOrder =
      (await reloadOrderWithCustomer(order._id as Types.ObjectId, order.organizationId)) ?? order;

    res.json({ data: populatedOrder, error: null });
  })
);

router.post(
  '/:id/complete',
  requireRole(CASHIER_ROLES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid order id' });
      return;
    }

    const order = (await findOrderForOrganization(id, organizationId)) as OrderDocument | null;

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

    const populatedOrder =
      (await reloadOrderWithCustomer(order._id as Types.ObjectId, order.organizationId)) ?? order;

    res.json({ data: populatedOrder, error: null });
  })
);

router.post(
  '/:id/cancel',
  requireRole(CASHIER_ROLES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid order id' });
      return;
    }

    const order = (await findOrderForOrganization(id, organizationId)) as OrderDocument | null;

    if (!order) {
      res.status(404).json({ data: null, error: 'Order not found' });
      return;
    }

    const isAdmin = ['owner', 'superAdmin'].includes(req.user?.role ?? '');
    if (!isAdmin && (!req.user?.id || order.cashierId.toString() !== req.user.id)) {
      res.status(403).json({ data: null, error: 'Forbidden' });
      return;
    }

    if (order.status === 'cancelled') {
      res.status(409).json({ data: null, error: 'Order already cancelled' });
      return;
    }

    if (order.status === 'draft') {
      res.status(409).json({ data: null, error: 'Only paid orders can be cancelled' });
      return;
    }

    if (order.status !== 'paid' && order.status !== 'completed') {
      res.status(409).json({ data: null, error: 'Only paid orders can be cancelled' });
      return;
    }

    await restoreInventoryForOrder(order);

    if (order.customerId) {
      if (order.manualDiscount > 0) {
        try {
          await restoreLoyaltyPoints(order.customerId.toString(), order.manualDiscount);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Не удалось вернуть баллы';
          res.status(400).json({ data: null, error: message });
          return;
        }
      }

      if (order.total > 0) {
        try {
          await rollbackEarnedLoyaltyPoints(order.customerId.toString(), order.total);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Не удалось откатить начисление баллов';
          res.status(400).json({ data: null, error: message });
          return;
        }
      }
    }

    order.status = 'cancelled';
    await order.save();

    const populatedOrder =
      (await reloadOrderWithCustomer(order._id as Types.ObjectId, order.organizationId)) ?? order;

    res.json({ data: populatedOrder, error: null });
  })
);

router.delete(
  '/:id',
  requireRole(CASHIER_ROLES),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid order id' });
      return;
    }

    const order = (await findOrderForOrganization(id, organizationId)) as OrderDocument | null;

    if (!order) {
      res.status(404).json({ data: null, error: 'Order not found' });
      return;
    }

    const isAdmin = ['owner', 'superAdmin'].includes(req.user?.role ?? '');
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
    const organizationId = getOrganizationObjectId(req);
    const cashierId = req.user?.id;

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }
    if (!cashierId) {
      res.status(403).json({ data: null, error: 'Unable to determine cashier' });
      return;
    }

    const { registerId } = req.query;

    const filter: Record<string, unknown> = {
      cashierId: new Types.ObjectId(cashierId),
      status: { $in: ACTIVE_ORDER_STATUSES },
      organizationId,
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
  '/history/current-shift',
  requireRole(CASHIER_ROLES),
  asyncHandler(async (req, res) => {
    const { registerId, cashierId: cashierParam } = req.query;
    const organizationId = getOrganizationObjectId(req);
    const normalizedRegisterId = typeof registerId === 'string' && registerId.trim() ? registerId.trim() : undefined;
    const isAdmin = ['owner', 'superAdmin'].includes(req.user?.role ?? '');

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const shiftFilter: FilterQuery<ShiftDocument> = { status: 'open', organizationId };

    if (normalizedRegisterId) {
      shiftFilter.registerId = normalizedRegisterId;
    }

    if (isAdmin && typeof cashierParam === 'string' && cashierParam.trim()) {
      if (!isValidObjectId(cashierParam)) {
        res.status(400).json({ data: null, error: 'cashierId must be a valid identifier' });
        return;
      }
      shiftFilter.cashierId = new Types.ObjectId(cashierParam.trim());
    } else if (req.user?.id) {
      shiftFilter.cashierId = new Types.ObjectId(req.user.id);
    }

    const shift = await ShiftModel.findOne(shiftFilter).sort({ openedAt: -1 });

    if (!shift) {
      res.json({ data: [], meta: { shift: null }, error: null });
      return;
    }

    const orders = await OrderModel.find(buildShiftHistoryFilter(shift))
      .sort({ createdAt: -1 })
      .populate('customerId', CUSTOMER_PROJECTION);

    const range = {
      from: shift.openedAt.toISOString(),
      to: (shift.closedAt ?? new Date()).toISOString(),
    };

    res.json({
      data: orders,
      meta: {
        shift: {
          _id: shift._id,
          registerId: shift.registerId,
          openedAt: shift.openedAt,
          closedAt: shift.closedAt ?? null,
        },
        range,
      },
      error: null,
    });
  })
);

router.get(
  '/history/by-date',
  requireRole(['owner', 'superAdmin']),
  asyncHandler(async (req, res) => {
    const { date, registerId, cashierId } = req.query;
    const organizationId = getOrganizationObjectId(req);

    const resolvedRange =
      (typeof date === 'string' && date ? resolveDateRange(date) : null) ??
      resolveDateRange(new Date().toISOString());

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    if (!resolvedRange) {
      res.status(400).json({ data: null, error: 'Не удалось определить дату' });
      return;
    }

    const filter: FilterQuery<OrderDocument> = {
      status: { $in: SHIFT_HISTORY_STATUSES },
      createdAt: { $gte: resolvedRange.from, $lte: resolvedRange.to },
      organizationId,
    };

    if (typeof registerId === 'string' && registerId.trim()) {
      filter.registerId = registerId.trim();
    }

    if (typeof cashierId === 'string' && cashierId.trim()) {
      if (!isValidObjectId(cashierId)) {
        res.status(400).json({ data: null, error: 'cashierId must be a valid identifier' });
        return;
      }
      filter.cashierId = new Types.ObjectId(cashierId.trim());
    }

    const orders = await OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .populate('customerId', CUSTOMER_PROJECTION)
      .populate('cashierId', 'name email');

    res.json({
      data: orders,
      meta: {
        range: {
          from: resolvedRange.from.toISOString(),
          to: resolvedRange.to.toISOString(),
        },
      },
      error: null,
    });
  })
);

router.get(
  '/today',
  requireRole(CASHIER_ROLES),
  asyncHandler(async (req, res) => {
    const organizationId = getOrganizationObjectId(req);
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const filter: Record<string, unknown> = {
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: FULFILLED_ORDER_STATUSES },
      organizationId,
    };

    const { cashierId: cashierParam } = req.query;

    if (['owner', 'superAdmin'].includes(req.user?.role ?? '') && typeof cashierParam === 'string') {
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
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    if (!isValidObjectId(id)) {
      res.status(400).json({ data: null, error: 'Invalid order id' });
      return;
    }

    const order = (await findOrderForOrganization(id, organizationId).populate(
      'customerId',
      CUSTOMER_PROJECTION
    )) as OrderDocument | null;

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
    const organizationId = getOrganizationObjectId(req);

    if (!organizationId) {
      res.status(403).json({ data: null, error: 'Organization context is required' });
      return;
    }

    const filter: Record<string, unknown> = {};

    filter.organizationId = organizationId;

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
