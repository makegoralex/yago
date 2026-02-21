import assert from 'node:assert/strict';

import type { OrderItem } from '../../orders/order.model';
import { buildEvotorOrderItems } from '../orderTotals';

test('buildEvotorOrderItems redistributes order total for Evotor receipt', () => {
  const items = [
    { name: 'A', qty: 1, total: 100 },
    { name: 'B', qty: 2, total: 100 },
  ] as OrderItem[];

  const discounted = buildEvotorOrderItems(items, 150);
  assert.deepStrictEqual(discounted, [
    { name: 'A', qty: 1, total: 75 },
    { name: 'B', qty: 2, total: 75 },
  ]);

  const almostFree = buildEvotorOrderItems(items, 1);
  assert.strictEqual(almostFree.reduce((sum, item) => sum + item.total, 0), 1);
  assert.ok(almostFree.some((item) => item.total === 1));
  assert.ok(almostFree.some((item) => item.total === 0));

  const invalidItems = buildEvotorOrderItems(
    [
      { name: '', qty: 1, total: 100 },
      { name: 'Valid', qty: 1, total: 100 },
    ] as OrderItem[],
    50
  );

  assert.deepStrictEqual(invalidItems, [{ name: 'Valid', qty: 1, total: 50 }]);
});
