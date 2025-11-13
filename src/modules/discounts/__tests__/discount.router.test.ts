import assert from 'node:assert/strict';

import { __test__ } from '../discount.router';

const { parseDiscountPayload, buildDiscountUpdate } = __test__;

const run = async () => {
  const parsedEmpty = await parseDiscountPayload({}, true);
  assert.strictEqual(parsedEmpty.autoApply, undefined);
  assert.strictEqual(parsedEmpty.isActive, undefined);

  const parsedIsActiveOnly = await parseDiscountPayload({ isActive: false }, true);
  const updateIsActiveOnly = buildDiscountUpdate(parsedIsActiveOnly);
  assert.deepStrictEqual(updateIsActiveOnly, { isActive: false });

  const parsedDisableAutoApply = await parseDiscountPayload({ autoApply: false }, true);
  const updateDisableAutoApply = buildDiscountUpdate(parsedDisableAutoApply);
  assert.deepStrictEqual(updateDisableAutoApply, {
    autoApply: false,
    autoApplyDays: undefined,
    autoApplyStart: undefined,
    autoApplyEnd: undefined,
  });

  console.log('discount.router tests passed');
};

void run();
