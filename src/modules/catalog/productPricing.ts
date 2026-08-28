export type ProductPricing = {
  basePrice: number;
  price: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
};

export const computeProductPricing = (
  basePriceInput: unknown,
  priceInput: unknown,
  discountTypeInput: unknown,
  discountValueInput: unknown
): ProductPricing => {
  const basePriceRaw =
    basePriceInput !== undefined ? Number(basePriceInput) : priceInput !== undefined ? Number(priceInput) : undefined;

  if (basePriceRaw === undefined || Number.isNaN(basePriceRaw) || basePriceRaw < 0) {
    throw new Error('Valid basePrice or price is required');
  }

  const discountType =
    discountTypeInput === 'percentage' || discountTypeInput === 'fixed' ? discountTypeInput : undefined;

  const discountValue = discountValueInput !== undefined ? Number(discountValueInput) : undefined;

  if (discountType && (discountValue === undefined || Number.isNaN(discountValue) || discountValue < 0)) {
    throw new Error('discountValue must be a positive number');
  }

  let finalPrice = priceInput !== undefined ? Number(priceInput) : basePriceRaw;

  if (discountType) {
    if (discountType === 'percentage') {
      if (discountValue === undefined || discountValue > 100) {
        throw new Error('discountValue must be between 0 and 100 for percentage discounts');
      }
      finalPrice = basePriceRaw * (1 - discountValue / 100);
    } else {
      finalPrice = basePriceRaw - (discountValue ?? 0);
    }
  }

  if (Number.isNaN(finalPrice) || finalPrice < 0) {
    finalPrice = 0;
  }

  return {
    basePrice: Number(basePriceRaw.toFixed(2)),
    price: Number(finalPrice.toFixed(2)),
    discountType: discountType ?? undefined,
    discountValue: discountValue ?? undefined,
  };
};

export const computeUpdatedProductPricing = (
  existing: ProductPricing,
  update: Partial<ProductPricing>
): ProductPricing => {
  const basePriceChanged = update.basePrice !== undefined;

  return computeProductPricing(
    update.basePrice ?? existing.basePrice ?? existing.price,
    update.price !== undefined ? update.price : basePriceChanged ? undefined : existing.price,
    update.discountType ?? existing.discountType,
    update.discountValue ?? existing.discountValue
  );
};

export const resolveStoredProductPricing = (
  stored: Omit<ProductPricing, 'basePrice'> & { basePrice?: number }
): ProductPricing => {
  if (stored.basePrice === undefined) {
    return computeProductPricing(undefined, stored.price, stored.discountType, stored.discountValue);
  }

  return computeProductPricing(stored.basePrice, undefined, stored.discountType, stored.discountValue);
};
