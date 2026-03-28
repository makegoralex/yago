import type { AppliedDiscount, OrderDocument, OrderItem } from '../orders/order.model';

type EvotorOrderItem = {
  name: string;
  qty: number;
  total: number;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const toCents = (value: number): number => Math.max(0, Math.round(value * 100));

const isValidItem = (item: OrderItem): boolean =>
  typeof item.name === 'string' && item.name.trim().length > 0 && typeof item.qty === 'number' && item.qty > 0;

const distributeEvenly = (lineTotalsCents: number[], discountCents: number, indexes: number[]): number[] => {
  if (!indexes.length || discountCents <= 0) {
    return new Array(lineTotalsCents.length).fill(0);
  }

  const applied = new Array(lineTotalsCents.length).fill(0);
  const eligible = indexes.filter((index) => lineTotalsCents[index] > 0);

  if (!eligible.length) {
    return applied;
  }

  let remaining = Math.min(discountCents, eligible.reduce((sum, index) => sum + lineTotalsCents[index], 0));

  while (remaining > 0) {
    const active = eligible.filter((index) => lineTotalsCents[index] - applied[index] > 0);
    if (!active.length) {
      break;
    }

    const evenShare = Math.max(1, Math.floor(remaining / active.length));

    for (const index of active) {
      if (remaining <= 0) {
        break;
      }

      const capacity = lineTotalsCents[index] - applied[index];
      if (capacity <= 0) {
        continue;
      }

      const portion = Math.min(capacity, evenShare, remaining);
      applied[index] += portion;
      remaining -= portion;
    }
  }

  return applied;
};

const buildTargetIndexes = (items: OrderItem[], discount: AppliedDiscount): number[] => {
  if (!discount.targetId) {
    return [];
  }

  const target = discount.targetId.toString();

  if (discount.scope === 'product') {
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.productId?.toString() === target)
      .map(({ index }) => index);
  }

  if (discount.scope === 'category') {
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.categoryId?.toString() === target)
      .map(({ index }) => index);
  }

  return [];
};

export const buildEvotorOrderItems = (
  items: OrderItem[] = [],
  orderTotal: number,
  orderDiscount = 0,
  manualDiscount = 0,
  appliedDiscounts: AppliedDiscount[] = []
): EvotorOrderItem[] => {
  const validItems = items.filter(isValidItem);
  if (!validItems.length) {
    return [];
  }

  const sourceTotalsCents = validItems.map((item) => toCents(typeof item.total === 'number' ? item.total : 0));
  const sourceSubtotalCents = sourceTotalsCents.reduce((sum, value) => sum + value, 0);

  if (sourceSubtotalCents <= 0) {
    const targetTotalCents = toCents(orderTotal);
    return validItems.map((item, index) => ({
      name: item.name,
      qty: item.qty,
      total: index === 0 && targetTotalCents > 0 ? roundCurrency(targetTotalCents / 100) : 0,
    }));
  }

  const finalTargetCents = toCents(orderTotal);
  const totalDiscountCents = Math.max(0, sourceSubtotalCents - finalTargetCents);

  const discountsByItem = new Array(validItems.length).fill(0);

  let targetedDiscountApplied = 0;
  for (const discount of appliedDiscounts) {
    if (discount.scope !== 'product' && discount.scope !== 'category') {
      continue;
    }

    const targetIndexes = buildTargetIndexes(validItems, discount);
    if (!targetIndexes.length) {
      continue;
    }

    const requestedCents = toCents(discount.amount);
    if (requestedCents <= 0) {
      continue;
    }

    const currentLineTotals = sourceTotalsCents.map((value, index) => value - discountsByItem[index]);
    const distributed = distributeEvenly(currentLineTotals, requestedCents, targetIndexes);

    for (let index = 0; index < discountsByItem.length; index += 1) {
      discountsByItem[index] += distributed[index];
      targetedDiscountApplied += distributed[index];
    }
  }

  const requestedGlobalDiscountCents = Math.max(0, toCents(orderDiscount) - targetedDiscountApplied);
  const fallbackGlobalDiscountCents = Math.max(0, totalDiscountCents - targetedDiscountApplied);
  const globalDiscountCents =
    requestedGlobalDiscountCents > 0 ? requestedGlobalDiscountCents : fallbackGlobalDiscountCents;

  if (globalDiscountCents > 0) {
    const remainingLineTotals = sourceTotalsCents.map((value, index) => value - discountsByItem[index]);
    const eligibleIndexes = remainingLineTotals
      .map((value, index) => ({ value, index }))
      .filter(({ value }) => value > 0)
      .map(({ index }) => index);

    const globalDistributed = distributeEvenly(remainingLineTotals, globalDiscountCents, eligibleIndexes);
    for (let index = 0; index < discountsByItem.length; index += 1) {
      discountsByItem[index] += globalDistributed[index];
    }
  }

  const finalTotalsCents = sourceTotalsCents.map((value, index) => Math.max(0, value - discountsByItem[index]));

  let finalSum = finalTotalsCents.reduce((sum, value) => sum + value, 0);
  if (finalSum !== finalTargetCents) {
    const delta = finalTargetCents - finalSum;
    const editableIndex = finalTotalsCents.findIndex((value) => value > 0 || delta > 0);
    if (editableIndex >= 0) {
      finalTotalsCents[editableIndex] = Math.max(0, finalTotalsCents[editableIndex] + delta);
    }
    finalSum = finalTotalsCents.reduce((sum, value) => sum + value, 0);
  }

  if (finalSum !== finalTargetCents && finalTotalsCents.length > 0) {
    finalTotalsCents[0] = Math.max(0, finalTotalsCents[0] + (finalTargetCents - finalSum));
  }

  return validItems.map((item, index) => ({
    name: item.name,
    qty: item.qty,
    total: roundCurrency(finalTotalsCents[index] / 100),
  }));
};

export const buildEvotorOrderSnapshot = (
  order: Pick<OrderDocument, 'items' | 'total' | 'discount' | 'manualDiscount' | 'appliedDiscounts'>
): EvotorOrderItem[] =>
  buildEvotorOrderItems(
    order.items ?? [],
    order.total ?? 0,
    order.discount ?? 0,
    order.manualDiscount ?? 0,
    order.appliedDiscounts ?? []
  );
