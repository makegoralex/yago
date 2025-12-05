import { catalogSchemas } from '../catalogSchemas';

describe('catalogSchemas.modifierGroup', () => {
  it('requires valid selectionType', () => {
    const result = catalogSchemas.modifierGroup.body.safeParse({ name: 'Group', selectionType: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('catalogSchemas.categoryUpdate', () => {
  it('rejects invalid id', () => {
    const result = catalogSchemas.categoryUpdate.params.safeParse({ id: 'abc' });
    expect(result.success).toBe(false);
  });
});

describe('catalogSchemas.productCreate', () => {
  it('requires categoryId', () => {
    const result = catalogSchemas.productCreate.body.safeParse({ name: 'Product' });
    expect(result.success).toBe(false);
  });
});
