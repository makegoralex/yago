import { isValidObjectId, Types } from 'mongoose';

import { CategoryModel } from '../catalog/catalog.model';
import type { OrderItem } from '../orders/order.model';
import { DiscountModel, type Discount } from './discount.model';

type DiscountApplication = 'auto' | 'selected' | 'manual';

type DiscountCalculationInput = {
  items: OrderItem[];
  selectedDiscountIds?: string[];
  manualDiscount?: number;
  now?: Date;
};

type AppliedDiscount = {
  discountId?: Types.ObjectId;
  name: string;
  type: 'fixed' | 'percentage';
  scope: 'order' | 'category' | 'product';
  value: number;
  amount: number;
  targetId?: Types.ObjectId;
  targetName?: string;
  application: DiscountApplication;
};

type DiscountCalculationResult = {
  subtotal: number;
  total: number;
  totalDiscount: number;
  appliedDiscounts: AppliedDiscount[];
  manualDiscount: number;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const parseMinutes = (time: string | undefined): number | null => {
  if (!time) {
    return null;
  }

  const [hours, minutes] = time.split(':');
  const h = Number(hours);
  const m = Number(minutes);

  if (Number.isNaN(h) || Number.isNaN(m)) {
    return null;
  }

  return h * 60 + m;
};

type DiscountRecord = Discount & { _id: Types.ObjectId };

const getDiscountCategoryIds = (discount: Discount): Types.ObjectId[] => {
  if (Array.isArray(discount.categoryIds) && discount.categoryIds.length > 0) {
    return Array.from(new Set(discount.categoryIds.map((entry) => entry.toString()))).map(
      (entry) => new Types.ObjectId(entry)
    );
  }

  if (discount.categoryId) {
    return [discount.categoryId];
  }

  return [];
};

const isWithinTimeWindow = (discount: Discount, now: Date): boolean => {
  if (!discount.autoApply) {
    return true;
  }

  const day = now.getDay();

  if (Array.isArray(discount.autoApplyDays) && discount.autoApplyDays.length > 0) {
    if (!discount.autoApplyDays.includes(day)) {
      return false;
    }
  }

  const startMinutes = parseMinutes(discount.autoApplyStart);
  const endMinutes = parseMinutes(discount.autoApplyEnd);

  if (startMinutes === null || endMinutes === null) {
    return true;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
};

const sanitizeManualDiscount = (value: unknown): number => {
  if (value === undefined || value === null) {
    return 0;
  }

  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    throw new Error('Discount must be a positive number');
  }

  return roundCurrency(value);
};

const buildCategoryLookup = async (items: OrderItem[]): Promise<Map<string, string>> => {
  const categoryIds = new Set<string>();
  for (const item of items) {
    if (item.categoryId) {
      categoryIds.add(item.categoryId.toString());
    }
  }

  if (!categoryIds.size) {
    return new Map();
  }

  const categories = await CategoryModel.find({ _id: { $in: Array.from(categoryIds, (id) => new Types.ObjectId(id)) } })
    .select('name')
    .lean();

  const map = new Map<string, string>();
  for (const category of categories) {
    map.set(category._id.toString(), category.name ?? '');
  }

  return map;
};

const collectSelectedDiscountIds = (selected?: string[]): Types.ObjectId[] => {
  if (!Array.isArray(selected) || !selected.length) {
    return [];
  }

  const unique = new Set<string>();
  const ids: Types.ObjectId[] = [];

  for (const id of selected) {
    if (typeof id !== 'string' || !isValidObjectId(id)) {
      continue;
    }

    const normalized = id.trim();
    if (unique.has(normalized)) {
      continue;
    }

    unique.add(normalized);
    ids.push(new Types.ObjectId(normalized));
  }

  return ids;
};

export const calculateOrderTotals = async (
  input: DiscountCalculationInput
): Promise<DiscountCalculationResult> => {
  const { items, now = new Date() } = input;
  const selectedIds = collectSelectedDiscountIds(input.selectedDiscountIds);
  const manualDiscount = sanitizeManualDiscount(input.manualDiscount);

  const subtotal = roundCurrency(
    items.reduce((acc, item) => acc + (typeof item.total === 'number' ? item.total : 0), 0)
  );

  if (subtotal === 0) {
    return {
      subtotal: 0,
      total: 0,
      totalDiscount: manualDiscount,
      appliedDiscounts: manualDiscount
        ? [
            {
              name: 'Ручная скидка',
              amount: manualDiscount,
              application: 'manual',
              scope: 'order',
              type: 'fixed',
              value: manualDiscount,
            },
          ]
        : [],
      manualDiscount,
    };
  }

  const productTotals = new Map<string, { total: number; name: string }>();
  const categoryTotals = new Map<string, { total: number; name: string }>();

  for (const item of items) {
    const productKey = item.productId.toString();
    const existingProduct = productTotals.get(productKey);
    const itemTotal = typeof item.total === 'number' ? item.total : 0;
    const productName = item.name ?? '';

    if (existingProduct) {
      existingProduct.total = roundCurrency(existingProduct.total + itemTotal);
    } else {
      productTotals.set(productKey, { total: roundCurrency(itemTotal), name: productName });
    }

    if (item.categoryId) {
      const categoryKey = item.categoryId.toString();
      const existingCategory = categoryTotals.get(categoryKey);
      if (existingCategory) {
        existingCategory.total = roundCurrency(existingCategory.total + itemTotal);
      } else {
        categoryTotals.set(categoryKey, { total: roundCurrency(itemTotal), name: '' });
      }
    }
  }

  const categoryNames = await buildCategoryLookup(items);
  for (const [categoryId, entry] of categoryTotals) {
    entry.name = categoryNames.get(categoryId) ?? '';
  }

  const discountMap = new Map<string, { discount: DiscountRecord; application: DiscountApplication }>();

  if (selectedIds.length) {
    const selectedDiscounts = (await DiscountModel.find({
      _id: { $in: selectedIds },
      isActive: true,
    })
      .lean()
      .exec()) as unknown as DiscountRecord[];
    for (const discount of selectedDiscounts) {
      discountMap.set(discount._id.toString(), { discount, application: 'selected' });
    }
  }

  const autoDiscounts = (await DiscountModel.find({ autoApply: true, isActive: true })
    .lean()
    .exec()) as unknown as DiscountRecord[];
  for (const discount of autoDiscounts) {
    if (!isWithinTimeWindow(discount, now)) {
      continue;
    }

    const key = discount._id.toString();
    if (discountMap.has(key)) {
      continue;
    }

    discountMap.set(key, { discount, application: 'auto' });
  }

  const discountsToApply = Array.from(discountMap.values());

  const appliedDiscounts: AppliedDiscount[] = [];
  let remainingOrder = subtotal;
  let totalDiscount = 0;

  const applyDiscountAmount = (
    discount: DiscountRecord,
    application: DiscountApplication,
    base: number,
    targetId?: Types.ObjectId,
    targetName?: string
  ): number => {
    if (base <= 0 || remainingOrder <= 0) {
      return 0;
    }

    let amount = 0;
    if (discount.type === 'percentage') {
      amount = roundCurrency(base * (discount.value / 100));
    } else {
      amount = roundCurrency(Math.min(discount.value, base));
    }

    if (amount <= 0) {
      return 0;
    }

    amount = Math.min(amount, remainingOrder);

    if (amount <= 0) {
      return 0;
    }

    remainingOrder = roundCurrency(Math.max(remainingOrder - amount, 0));
    totalDiscount = roundCurrency(totalDiscount + amount);

    appliedDiscounts.push({
      discountId: discount._id,
      name: discount.name,
      type: discount.type,
      scope: discount.scope,
      value: discount.value,
      amount,
      targetId,
      targetName,
      application,
    });

    return amount;
  };

  for (const entry of discountsToApply) {
    const { discount, application } = entry;

    if (!discount.isActive) {
      continue;
    }

    if (discount.scope === 'order') {
      applyDiscountAmount(discount, application, remainingOrder);
      continue;
    }

    if (discount.scope === 'category') {
      const categoryIds = getDiscountCategoryIds(discount);
      if (!categoryIds.length) {
        continue;
      }

      for (const categoryId of categoryIds) {
        const key = categoryId.toString();
        const categoryEntry = categoryTotals.get(key);
        if (!categoryEntry || categoryEntry.total <= 0) {
          continue;
        }

        const base = categoryEntry.total;
        const appliedAmount = applyDiscountAmount(
          discount,
          application,
          base,
          categoryId,
          categoryEntry.name
        );
        if (appliedAmount > 0) {
          categoryEntry.total = roundCurrency(Math.max(categoryEntry.total - appliedAmount, 0));
        }
      }
      continue;
    }

    if (discount.scope === 'product') {
      if (!discount.productId) {
        continue;
      }

      const key = discount.productId.toString();
      const productEntry = productTotals.get(key);
      if (!productEntry || productEntry.total <= 0) {
        continue;
      }

      const base = productEntry.total;
      const appliedAmount = applyDiscountAmount(
        discount,
        application,
        base,
        discount.productId,
        productEntry.name
      );
      if (appliedAmount > 0) {
        productEntry.total = roundCurrency(Math.max(productEntry.total - appliedAmount, 0));
      }
    }
  }

  const manualAmount = Math.min(manualDiscount, remainingOrder);
  if (manualAmount > 0) {
    remainingOrder = roundCurrency(Math.max(remainingOrder - manualAmount, 0));
    totalDiscount = roundCurrency(totalDiscount + manualAmount);
    appliedDiscounts.push({
      name: 'Ручная скидка',
      amount: manualAmount,
      application: 'manual',
      scope: 'order',
      type: 'fixed',
      value: manualAmount,
    });
  }

  const total = roundCurrency(Math.max(subtotal - totalDiscount, 0));

  return {
    subtotal,
    total,
    totalDiscount,
    appliedDiscounts,
    manualDiscount: manualAmount,
  };
};

export const getAvailableDiscounts = async (
  organizationId: Types.ObjectId,
  now: Date = new Date()
) => {
  const discounts = (await DiscountModel.find({ organizationId, isActive: true }).lean().exec()) as unknown as DiscountRecord[];
  return discounts.filter((discount) => !discount.autoApply || isWithinTimeWindow(discount, now));
};
