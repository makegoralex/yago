import { Types } from 'mongoose';

import { RestaurantSettingsModel, type IRestaurantSettings } from './restaurantSettings.model';

export type RestaurantBranding = {
  name: string;
  logoUrl: string;
  enableOrderTags: boolean;
  measurementUnits: string[];
  loyaltyRate: number;
};

const DEFAULT_BRANDING: RestaurantBranding = {
  name: 'Yago Coffee',
  logoUrl: '',
  enableOrderTags: false,
  measurementUnits: ['гр', 'кг', 'мл', 'л', 'шт'],
  loyaltyRate: 5,
};

const clampLoyaltyRate = (value: unknown): number => {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_BRANDING.loyaltyRate;
  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return Number(numeric.toFixed(2));
};

const normalizeBranding = (branding: Partial<RestaurantBranding> | IRestaurantSettings | null | undefined): RestaurantBranding => ({
  name:
    branding && typeof branding === 'object' && typeof (branding as any).name === 'string' && (branding as any).name.trim()
      ? (branding as any).name.trim()
      : DEFAULT_BRANDING.name,
  logoUrl:
    branding && typeof branding === 'object' && typeof (branding as any).logoUrl === 'string'
      ? (branding as any).logoUrl.trim()
      : DEFAULT_BRANDING.logoUrl,
  enableOrderTags:
    Boolean(
      branding && typeof branding === 'object' && typeof (branding as any).enableOrderTags === 'boolean'
        ? (branding as any).enableOrderTags
        : DEFAULT_BRANDING.enableOrderTags
    ),
  measurementUnits:
    branding && typeof branding === 'object' && Array.isArray((branding as any).measurementUnits)
      ? (() => {
          const normalizedUnits: string[] = Array.from(
            new Set(
              (branding as any).measurementUnits
                .map((unit: unknown) => (typeof unit === 'string' ? unit.trim() : ''))
                .filter((unit: string): unit is string => unit.length > 0)
            )
          );

          return normalizedUnits.length > 0 ? normalizedUnits : DEFAULT_BRANDING.measurementUnits;
        })()
      : DEFAULT_BRANDING.measurementUnits,
  loyaltyRate: clampLoyaltyRate(branding && typeof branding === 'object' ? (branding as any).loyaltyRate : undefined),
});

export const getRestaurantBranding = async (
  organizationId: Types.ObjectId
): Promise<RestaurantBranding> => {
  const existing = await RestaurantSettingsModel.findOne({ organizationId });
  if (existing) {
    return normalizeBranding(existing);
  }

  const created = await RestaurantSettingsModel.create({ ...DEFAULT_BRANDING, organizationId });
  return normalizeBranding(created);
};

export const updateRestaurantBranding = async (
  organizationId: Types.ObjectId,
  payload: Partial<RestaurantBranding>
): Promise<RestaurantBranding> => {
  const existing = await RestaurantSettingsModel.findOne({ organizationId });
  const brandingDoc = existing ?? new RestaurantSettingsModel({ ...DEFAULT_BRANDING, organizationId });

  if (!brandingDoc.organizationId) {
    brandingDoc.organizationId = organizationId;
  }

  if (typeof payload.name === 'string') {
    const name = payload.name.trim();
    brandingDoc.name = name || DEFAULT_BRANDING.name;
  }

  if (typeof payload.logoUrl === 'string') {
    brandingDoc.logoUrl = payload.logoUrl.trim();
  }

  if (typeof payload.enableOrderTags === 'boolean') {
    brandingDoc.enableOrderTags = Boolean(payload.enableOrderTags);
  }

  if (Array.isArray(payload.measurementUnits)) {
    const normalizedUnits = Array.from(
      new Set(payload.measurementUnits.map((unit) => (typeof unit === 'string' ? unit.trim() : '')).filter((unit) => unit.length > 0))
    );

    brandingDoc.measurementUnits = normalizedUnits.length > 0 ? normalizedUnits : DEFAULT_BRANDING.measurementUnits;
  }

  if (typeof payload.loyaltyRate === 'number') {
    brandingDoc.loyaltyRate = clampLoyaltyRate(payload.loyaltyRate);
  }

  const saved = await brandingDoc.save();
  return normalizeBranding(saved);
};

export const resetRestaurantBranding = async (
  organizationId: Types.ObjectId
): Promise<RestaurantBranding> => {
  const resetDocument = await RestaurantSettingsModel.findOneAndUpdate(
    { organizationId },
    { $set: { ...DEFAULT_BRANDING, organizationId }, $setOnInsert: { ...DEFAULT_BRANDING, organizationId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return normalizeBranding(resetDocument);
};

export const restaurantBrandingDefaults = DEFAULT_BRANDING;

export const getLoyaltyAccrualRate = async (organizationId: Types.ObjectId): Promise<number> => {
  const branding = await getRestaurantBranding(organizationId);
  return clampLoyaltyRate(branding.loyaltyRate);
};
