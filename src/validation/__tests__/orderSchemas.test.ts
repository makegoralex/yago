import { orderSchemas } from '../orderSchemas';

describe('orderSchemas.startOrder', () => {
  it('requires register and location ids', () => {
    const result = orderSchemas.startOrder.body.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid customerId', () => {
    const result = orderSchemas.startOrder.body.safeParse({
      locationId: 'loc',
      registerId: 'reg',
      customerId: '123',
    });
    expect(result.success).toBe(false);
  });
});

describe('orderSchemas.orderItems', () => {
  it('rejects invalid modifier id', () => {
    const result = orderSchemas.orderItems.body.safeParse({
      items: [
        {
          productId: '60f6f9f9f9f9f9f9f9f9f9f9',
          qty: 1,
          modifiersApplied: [{ groupId: 'bad-id' }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing product id', () => {
    const result = orderSchemas.orderItems.body.safeParse({ items: [{ qty: 1 }] });
    expect(result.success).toBe(false);
  });
});

describe('orderSchemas.orderPayment', () => {
  it('rejects negative amount', () => {
    const result = orderSchemas.orderPayment.body.safeParse({ method: 'cash', amount: -1 });
    expect(result.success).toBe(false);
  });
});
