import { RestaurantSettingsModel, type IRestaurantSettings } from './restaurantSettings.model';

export type RestaurantBranding = {
  name: string;
  logoUrl: string;
  enableOrderTags: boolean;
  measurementUnits: string[];
};

const DEFAULT_BRANDING: RestaurantBranding = {
  name: 'Yago Coffee',
  logoUrl: '',
  enableOrderTags: false,
  measurementUnits: ['гр', 'кг', 'мл', 'л', 'шт'],
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
});

export const getRestaurantBranding = async (): Promise<RestaurantBranding> => {
  const existing = await RestaurantSettingsModel.findOne({ singletonKey: 'singleton' });
  if (existing) {
    return normalizeBranding(existing);
  }

  const created = await RestaurantSettingsModel.create(DEFAULT_BRANDING);
  return normalizeBranding(created);
};

export const updateRestaurantBranding = async (payload: Partial<RestaurantBranding>): Promise<RestaurantBranding> => {
  const updatePayload: Partial<RestaurantBranding> = {};

  if (payload.name !== undefined) {
    const name = payload.name.trim();
    updatePayload.name = name || DEFAULT_BRANDING.name;
  }

  if (payload.logoUrl !== undefined) {
    updatePayload.logoUrl = payload.logoUrl.trim();
  }

  if (payload.enableOrderTags !== undefined) {
    updatePayload.enableOrderTags = Boolean(payload.enableOrderTags);
  }

  if (payload.measurementUnits !== undefined) {
    const normalizedUnits = Array.isArray(payload.measurementUnits)
      ? Array.from(
          new Set(
            payload.measurementUnits
              .map((unit) => (typeof unit === 'string' ? unit.trim() : ''))
              .filter((unit) => unit.length > 0)
          )
        )
      : DEFAULT_BRANDING.measurementUnits;

    updatePayload.measurementUnits = normalizedUnits.length > 0 ? normalizedUnits : DEFAULT_BRANDING.measurementUnits;
  }

  const updated = await RestaurantSettingsModel.findOneAndUpdate(
    { singletonKey: 'singleton' },
    {
      $setOnInsert: DEFAULT_BRANDING,
      ...(Object.keys(updatePayload).length ? { $set: updatePayload } : {}),
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return normalizeBranding(updated);
};

export const resetRestaurantBranding = async (): Promise<RestaurantBranding> => {
  const resetDocument = await RestaurantSettingsModel.findOneAndUpdate(
    { singletonKey: 'singleton' },
    { $set: DEFAULT_BRANDING, $setOnInsert: DEFAULT_BRANDING },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return normalizeBranding(resetDocument);
};

export const restaurantBrandingDefaults = DEFAULT_BRANDING;
