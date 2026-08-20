export const PRODUCT_UNITS = ['шт', 'гр', 'кг', 'мл', 'л', 'упак'] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const normalizeProductUnit = (unit?: string | null): ProductUnit =>
  PRODUCT_UNITS.includes(unit as ProductUnit) ? (unit as ProductUnit) : 'шт';

export const getPricingQuantity = (unit?: string | null): number =>
  unit === 'гр' || unit === 'мл' ? 1000 : 1;

export const getPricingUnit = (unit?: string | null): ProductUnit => {
  if (unit === 'гр') return 'кг';
  if (unit === 'мл') return 'л';
  return normalizeProductUnit(unit);
};

export const isMeasuredProduct = (unit?: string | null): boolean =>
  unit === 'гр' || unit === 'кг' || unit === 'мл' || unit === 'л';

export const formatQuantity = (quantity: number, unit?: string | null): string => {
  const maximumFractionDigits = unit === 'кг' || unit === 'л' ? 3 : 0;
  return `${quantity.toLocaleString('ru-RU', { maximumFractionDigits })} ${normalizeProductUnit(unit)}`;
};
