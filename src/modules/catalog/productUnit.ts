export const PRODUCT_UNITS = ['шт', 'гр', 'кг', 'мл', 'л', 'упак'] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const DEFAULT_PRODUCT_UNIT: ProductUnit = 'шт';

export const getPricingQuantity = (unit?: string | null): number =>
  unit === 'гр' || unit === 'мл' ? 1000 : 1;

export const getPricingUnit = (unit?: string | null): ProductUnit => {
  if (unit === 'гр') return 'кг';
  if (unit === 'мл') return 'л';
  return PRODUCT_UNITS.includes(unit as ProductUnit) ? (unit as ProductUnit) : DEFAULT_PRODUCT_UNIT;
};

/**
 * Inventory keeps measured products in the unit used for pricing (kg/l), while
 * POS quantities for gram/ml products are entered in their smaller sale unit.
 */
export const getInventoryQuantity = (quantity: number, unit?: string | null): number =>
  quantity / getPricingQuantity(unit);

export const normalizeProductUnit = (unit?: string | null): ProductUnit => {
  const normalized = unit?.trim().toLocaleLowerCase('ru-RU');
  if (normalized === 'г') return 'гр';
  if (normalized === 'штука' || normalized === 'штуки') return 'шт';
  return PRODUCT_UNITS.includes(normalized as ProductUnit)
    ? (normalized as ProductUnit)
    : DEFAULT_PRODUCT_UNIT;
};
