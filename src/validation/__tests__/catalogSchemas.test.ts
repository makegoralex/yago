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

describe('catalogSchemas.productImport', () => {
  it('accepts mapped menu rows', () => {
    const result = catalogSchemas.productImport.body.safeParse({
      items: [
        {
          rowNumber: 2,
          name: 'Капучино',
          categoryName: 'Кофе',
          basePrice: 250,
          isActive: true,
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].unit).toBe('шт');
      expect(result.data.createMissingCategories).toBe(true);
    }
  });

  it('accepts retail fields used by the Excel template', () => {
    const result = catalogSchemas.productImport.body.safeParse({
      items: [
        {
          rowNumber: 2,
          name: 'Конфеты на вес',
          categoryName: 'Сладости',
          basePrice: 1_490,
          unit: 'гр',
          manufacturer: 'Фабрика',
          sku: 'SWEET-001',
          barcode: '4601234567893',
          discountType: 'percentage',
          discountValue: 10,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it('requires a discount value when a discount type is specified', () => {
    const result = catalogSchemas.productImport.body.safeParse({
      items: [
        {
          rowNumber: 2,
          name: 'Конфеты',
          categoryName: 'Сладости',
          basePrice: 1_490,
          discountType: 'percentage',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects rows without a category reference', () => {
    const result = catalogSchemas.productImport.body.safeParse({
      items: [{ rowNumber: 2, name: 'Капучино', basePrice: 250 }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects negative prices', () => {
    const result = catalogSchemas.productImport.body.safeParse({
      items: [{ rowNumber: 2, name: 'Капучино', categoryName: 'Кофе', basePrice: -1 }],
    });

    expect(result.success).toBe(false);
  });
});
