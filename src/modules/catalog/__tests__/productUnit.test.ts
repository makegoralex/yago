import { getInventoryQuantity, getPricingUnit } from '../productUnit';

describe('product inventory units', () => {
  it.each([
    ['гр', 500, 0.5, 'кг'],
    ['мл', 250, 0.25, 'л'],
    ['кг', 0.75, 0.75, 'кг'],
    ['л', 1.5, 1.5, 'л'],
    ['шт', 5, 5, 'шт'],
    ['упак', 2, 2, 'упак'],
  ] as const)('converts %s POS quantity to the warehouse scale', (unit, saleQuantity, expected, warehouseUnit) => {
    expect(getInventoryQuantity(saleQuantity, unit)).toBe(expected);
    expect(getPricingUnit(unit)).toBe(warehouseUnit);
  });

  it('leaves 4.5 kg after selling 500 g from a 5 kg receipt', () => {
    expect(5 - getInventoryQuantity(500, 'гр')).toBe(4.5);
  });
});
