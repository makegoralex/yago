import { Types } from 'mongoose';

import { generateProductBarcode, generateProductSku, isValidEan } from '../productIdentifiers';
import { getPricingQuantity, getPricingUnit, normalizeProductUnit } from '../productUnit';

describe('retail product helpers', () => {
  it('keeps legacy products in pieces', () => {
    expect(normalizeProductUnit(undefined)).toBe('шт');
    expect(getPricingQuantity(undefined)).toBe(1);
  });

  it('prices grams per kilogram and milliliters per liter', () => {
    expect(getPricingQuantity('гр')).toBe(1000);
    expect(getPricingUnit('гр')).toBe('кг');
    expect(getPricingQuantity('мл')).toBe(1000);
    expect(getPricingUnit('мл')).toBe('л');
  });

  it('generates stable internal identifiers and a valid EAN-13', () => {
    const id = new Types.ObjectId('64d112233445566778899001');
    expect(generateProductSku(id)).toBe('YG-78899001');
    const barcode = generateProductBarcode(id);
    expect(barcode).toMatch(/^20\d{11}$/);
    expect(isValidEan(barcode)).toBe(true);
  });
});
