import { computeUpdatedProductPricing, resolveStoredProductPricing } from '../productPricing';

describe('product pricing updates', () => {
  it('uses a changed base price as the selling price when there is no discount', () => {
    const pricing = computeUpdatedProductPricing(
      { basePrice: 61, price: 61 },
      { basePrice: 70 }
    );

    expect(pricing).toEqual({
      basePrice: 70,
      price: 70,
      discountType: undefined,
      discountValue: undefined,
    });
  });

  it('recalculates an existing discount from the changed base price', () => {
    const pricing = computeUpdatedProductPricing(
      { basePrice: 100, price: 90, discountType: 'percentage', discountValue: 10 },
      { basePrice: 200 }
    );

    expect(pricing.price).toBe(180);
    expect(pricing.basePrice).toBe(200);
  });

  it('keeps the selling price when an unrelated pricing field is updated', () => {
    const pricing = computeUpdatedProductPricing(
      { basePrice: 70, price: 70 },
      {}
    );

    expect(pricing.price).toBe(70);
  });

  it('repairs a legacy mismatch when an order resolves the stored selling price', () => {
    const pricing = resolveStoredProductPricing({ basePrice: 70, price: 61 });

    expect(pricing.price).toBe(70);
  });
});
