import assert from 'node:assert/strict';

import { Types } from 'mongoose';

import { __test__ } from '../discount.router';

const { parseDiscountPayload, buildDiscountUpdate } = __test__;

const run = async () => {
  const organizationId = new Types.ObjectId();

  const parsedEmpty = await parseDiscountPayload({}, organizationId, true);
  assert.strictEqual(parsedEmpty.autoApply, undefined);
  assert.strictEqual(parsedEmpty.isActive, undefined);

  const parsedIsActiveOnly = await parseDiscountPayload({ isActive: false }, organizationId, true);
  const updateIsActiveOnly = buildDiscountUpdate(parsedIsActiveOnly);
  assert.deepStrictEqual(updateIsActiveOnly, { isActive: false });

  const parsedDisableAutoApply = await parseDiscountPayload({ autoApply: false }, organizationId, true);
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
