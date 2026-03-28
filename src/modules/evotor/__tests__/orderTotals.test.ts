import assert from 'node:assert/strict';

import type { AppliedDiscount, OrderItem } from '../../orders/order.model';
import { buildEvotorOrderItems } from '../orderTotals';

test('buildEvotorOrderItems applies item-level discounts to target positions and spreads global discount evenly', () => {
  const items = [
    { name: 'A', qty: 1, total: 100, productId: '65f000000000000000000001' },
    { name: 'B', qty: 1, total: 100, productId: '65f000000000000000000002' },
  ] as unknown as OrderItem[];

  const appliedDiscounts = [
    {
      scope: 'product',
      amount: 20,
      targetId: '65f000000000000000000001',
    },
  ] as unknown as AppliedDiscount[];

  const result = buildEvotorOrderItems(items, 150, 50, 0, appliedDiscounts);

  assert.deepStrictEqual(result, [
    { name: 'A', qty: 1, total: 65 },
    { name: 'B', qty: 1, total: 85 },
  ]);
});

test('buildEvotorOrderItems spreads order-level discount evenly across eligible items', () => {
  const items = [
    { name: 'A', qty: 1, total: 100 },
    { name: 'B', qty: 1, total: 100 },
    { name: 'C', qty: 1, total: 100 },
  ] as OrderItem[];

  const result = buildEvotorOrderItems(items, 240, 60, 0, []);

  assert.deepStrictEqual(result, [
    { name: 'A', qty: 1, total: 80 },
    { name: 'B', qty: 1, total: 80 },
    { name: 'C', qty: 1, total: 80 },
  ]);
});

test('buildEvotorOrderItems handles low totals and invalid lines safely', () => {
  const items = [
    { name: 'A', qty: 1, total: 100 },
    { name: 'B', qty: 2, total: 100 },
  ] as OrderItem[];

  const almostFree = buildEvotorOrderItems(items, 1, 199, 0, []);
  assert.strictEqual(almostFree.reduce((sum, item) => sum + item.total, 0), 1);
  assert.ok(almostFree.every((item) => item.total >= 0));

  const invalidItems = buildEvotorOrderItems(
    [
      { name: '', qty: 1, total: 100 },
      { name: 'Valid', qty: 1, total: 100 },
    ] as OrderItem[],
    50,
    50,
    0,
    []
  );

  assert.deepStrictEqual(invalidItems, [{ name: 'Valid', qty: 1, total: 50 }]);
});
