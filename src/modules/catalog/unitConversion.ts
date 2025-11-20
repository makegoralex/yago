const unitKey = (fromUnit?: string | null, toUnit?: string | null) =>
  `${(fromUnit ?? '').toLowerCase()}->${(toUnit ?? '').toLowerCase()}`;

const CONVERSION_FACTORS = new Map<string, number>([
  ['гр->кг', 0.001],
  ['г->кг', 0.001],
  ['кг->гр', 1000],
  ['кг->г', 1000],
  ['мл->л', 0.001],
  ['л->мл', 1000],
]);

export const convertQuantity = (quantity: number, fromUnit?: string | null, toUnit?: string | null): number => {
  if (!Number.isFinite(quantity) || quantity === 0) {
    return 0;
  }

  if (!fromUnit || !toUnit || fromUnit === toUnit) {
    return quantity;
  }

  const factor = CONVERSION_FACTORS.get(unitKey(fromUnit, toUnit));

  if (!factor) {
    return quantity;
  }

  return quantity * factor;
};

export const canConvertUnit = (fromUnit?: string | null, toUnit?: string | null): boolean => {
  if (!fromUnit || !toUnit) {
    return false;
  }

  if (fromUnit === toUnit) {
    return true;
  }

  return CONVERSION_FACTORS.has(unitKey(fromUnit, toUnit));
};
