import { RestaurantSettingsModel, type IRestaurantSettings } from './restaurantSettings.model';

export type RestaurantBranding = {
  name: string;
  logoUrl: string;
  enableOrderTags: boolean;
};

const DEFAULT_BRANDING: RestaurantBranding = {
  name: 'Yago Coffee',
  logoUrl: '',
  enableOrderTags: false,
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
