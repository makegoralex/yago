import { inventorySchemas } from '../inventorySchemas';

describe('inventorySchemas.warehouseCreate', () => {
  it('rejects empty name', () => {
    const result = inventorySchemas.warehouseCreate.body.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('inventorySchemas.itemsQuery', () => {
  it('rejects bad warehouseId', () => {
    const result = inventorySchemas.itemsQuery.query.safeParse({ warehouseId: '123' });
    expect(result.success).toBe(false);
  });
});

describe('inventorySchemas.itemUpsert', () => {
  it('requires positive quantity', () => {
    const result = inventorySchemas.itemUpsert.body.safeParse({
      warehouseId: '60f6f9f9f9f9f9f9f9f9f9f9',
      itemType: 'ingredient',
      itemId: '60f6f9f9f9f9f9f9f9f9f9f9',
      quantity: -5,
    });

    expect(result.success).toBe(false);
  });
});
