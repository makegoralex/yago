import type { OrderDocument, OrderItem } from '../orders/order.model';

type EvotorOrderItem = {
  name: string;
  qty: number;
  total: number;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const toCents = (value: number): number => Math.max(0, Math.round(value * 100));

const isValidItem = (item: OrderItem): boolean =>
  typeof item.name === 'string' && item.name.trim().length > 0 && typeof item.qty === 'number' && item.qty > 0;

export const buildEvotorOrderItems = (
  items: OrderItem[] = [],
  orderTotal: number
): EvotorOrderItem[] => {
  const validItems = items.filter(isValidItem);
  if (!validItems.length) {
    return [];
  }

  const targetTotalCents = toCents(orderTotal);
  const sourceTotalsCents = validItems.map((item) => toCents(typeof item.total === 'number' ? item.total : 0));
  const sourceSubtotalCents = sourceTotalsCents.reduce((sum, value) => sum + value, 0);

  if (targetTotalCents === 100 && sourceSubtotalCents > targetTotalCents) {
    const maxIndex = sourceTotalsCents.reduce(
      (bestIndex, value, index, totals) => (value > totals[bestIndex] ? index : bestIndex),
      0
    );

    return validItems.map((item, index) => ({
      name: item.name,
      qty: item.qty,
      total: index === maxIndex ? 1 : 0,
    }));
  }

  if (sourceSubtotalCents <= 0) {
    return validItems.map((item, index) => ({
      name: item.name,
      qty: item.qty,
      total: index === 0 && targetTotalCents > 0 ? roundCurrency(targetTotalCents / 100) : 0,
    }));
  }

  const scaled = sourceTotalsCents.map((value, index) => {
    const exact = (value * targetTotalCents) / sourceSubtotalCents;
    const floored = Math.floor(exact);
    return {
      index,
      floored,
      fraction: exact - floored,
    };
  });

  let distributedCents = scaled.reduce((sum, entry) => sum + entry.floored, 0);
  let remainder = targetTotalCents - distributedCents;

  scaled
    .sort((a, b) => {
      if (b.fraction !== a.fraction) {
        return b.fraction - a.fraction;
      }

      return sourceTotalsCents[b.index] - sourceTotalsCents[a.index];
    })
    .forEach((entry) => {
      if (remainder <= 0) {
        return;
      }

      entry.floored += 1;
      remainder -= 1;
    });

  distributedCents = scaled.reduce((sum, entry) => sum + entry.floored, 0);
  if (distributedCents !== targetTotalCents && scaled.length > 0) {
    const delta = targetTotalCents - distributedCents;
    scaled[0].floored += delta;
  }

  const totalsByIndex = new Map<number, number>();
  for (const entry of scaled) {
    totalsByIndex.set(entry.index, Math.max(0, entry.floored));
  }

  return validItems.map((item, index) => ({
    name: item.name,
    qty: item.qty,
    total: roundCurrency((totalsByIndex.get(index) ?? 0) / 100),
  }));
};

export const buildEvotorOrderSnapshot = (order: Pick<OrderDocument, 'items' | 'total'>): EvotorOrderItem[] =>
  buildEvotorOrderItems(order.items ?? [], order.total ?? 0);
