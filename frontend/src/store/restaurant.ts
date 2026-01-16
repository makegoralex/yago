import { create } from 'zustand';

import api from '../lib/api';

export type RestaurantBranding = {
  name: string;
  logoUrl: string;
  measurementUnits: string[];
};

type RestaurantPreferences = RestaurantBranding & {
  enableOrderTags: boolean;
  loyaltyRate: number;
  loyaltyRedeemAllCategories: boolean;
  loyaltyRedeemCategoryIds: string[];
};

type RestaurantState = RestaurantPreferences & {
  loading: boolean;
  fetchBranding: () => Promise<RestaurantPreferences | null>;
  updateBranding: (payload: Partial<RestaurantPreferences>) => Promise<RestaurantPreferences>;
  resetBranding: () => Promise<RestaurantPreferences>;
};

const STORAGE_KEY = 'yago-restaurant-branding';

const defaultBranding: RestaurantPreferences = {
  name: 'Yago Coffee',
  logoUrl: '',
  measurementUnits: ['гр', 'кг', 'мл', 'л', 'шт'],
  enableOrderTags: false,
  loyaltyRate: 5,
  loyaltyRedeemAllCategories: true,
  loyaltyRedeemCategoryIds: [],
};

const isBrowser = typeof window !== 'undefined';

const normalizeCategoryIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return defaultBranding.loyaltyRedeemCategoryIds;
  }

  return Array.from(
    new Set(
      value
        .filter((id: unknown): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    )
  );
};

const normalizeBranding = (payload: unknown): RestaurantPreferences => {
  const source =
    payload && typeof payload === 'object' && 'branding' in (payload as Record<string, unknown>)
      ? (payload as { branding?: unknown }).branding
      : payload;

  const loyaltyRedeemAllCategories =
    source && typeof source === 'object' && typeof (source as any).loyaltyRedeemAllCategories === 'boolean'
      ? (source as any).loyaltyRedeemAllCategories
      : defaultBranding.loyaltyRedeemAllCategories;
  const loyaltyRedeemCategoryIds =
    source && typeof source === 'object'
      ? normalizeCategoryIds((source as any).loyaltyRedeemCategoryIds)
      : defaultBranding.loyaltyRedeemCategoryIds;

  return {
    name:
      source && typeof source === 'object' && typeof (source as any).name === 'string' && (source as any).name.trim()
        ? (source as any).name.trim()
        : defaultBranding.name,
    logoUrl:
      source && typeof source === 'object' && typeof (source as any).logoUrl === 'string'
        ? (source as any).logoUrl
        : defaultBranding.logoUrl,
    measurementUnits:
      source && typeof source === 'object' && Array.isArray((source as any).measurementUnits)
        ? (() => {
            const normalizedUnits: string[] = Array.from(
              new Set(
                (source as any).measurementUnits
                  .map((unit: unknown) => (typeof unit === 'string' ? unit.trim() : ''))
                  .filter((unit: string) => unit.length > 0)
              )
            );

            return normalizedUnits.length > 0 ? normalizedUnits : defaultBranding.measurementUnits;
          })()
        : defaultBranding.measurementUnits,
    enableOrderTags:
      source && typeof source === 'object' && typeof (source as any).enableOrderTags === 'boolean'
        ? (source as any).enableOrderTags
        : defaultBranding.enableOrderTags,
    loyaltyRate:
      source && typeof source === 'object' && typeof (source as any).loyaltyRate === 'number'
        ? Math.min(Math.max((source as any).loyaltyRate, 0), 100)
        : defaultBranding.loyaltyRate,
    loyaltyRedeemAllCategories,
    loyaltyRedeemCategoryIds: loyaltyRedeemAllCategories ? [] : loyaltyRedeemCategoryIds,
  };
};

const mergeBranding = (
  current: RestaurantPreferences,
  payload: Partial<RestaurantPreferences> | null | undefined
): RestaurantPreferences => ({
  name:
    typeof payload?.name === 'string' && payload.name.trim() ? payload.name.trim() : current.name,
  logoUrl: typeof payload?.logoUrl === 'string' ? payload.logoUrl : current.logoUrl,
  measurementUnits:
    Array.isArray(payload?.measurementUnits)
      ? (() => {
          const normalized = Array.from(
            new Set(payload?.measurementUnits?.map((unit) => unit.trim()).filter((unit) => unit.length > 0))
          );
          return normalized.length > 0 ? normalized : defaultBranding.measurementUnits;
        })()
      : current.measurementUnits,
  enableOrderTags:
    typeof payload?.enableOrderTags === 'boolean' ? payload.enableOrderTags : current.enableOrderTags,
  loyaltyRate:
    typeof payload?.loyaltyRate === 'number'
      ? Math.min(Math.max(Number(payload.loyaltyRate.toFixed(2)), 0), 100)
      : current.loyaltyRate,
  loyaltyRedeemAllCategories:
    typeof payload?.loyaltyRedeemAllCategories === 'boolean'
      ? payload.loyaltyRedeemAllCategories
      : current.loyaltyRedeemAllCategories,
  loyaltyRedeemCategoryIds:
    payload?.loyaltyRedeemAllCategories === true
      ? []
      : Array.isArray(payload?.loyaltyRedeemCategoryIds)
        ? normalizeCategoryIds(payload.loyaltyRedeemCategoryIds)
        : current.loyaltyRedeemCategoryIds,
});

const loadBranding = (): RestaurantPreferences => {
  if (!isBrowser) {
    return defaultBranding;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultBranding;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return defaultBranding;
    }

    return normalizeBranding(parsed);
  } catch {
    return defaultBranding;
  }
};

const persistBranding = (branding: RestaurantPreferences) => {
  if (!isBrowser) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(branding));
  } catch {
    // ignore write errors to keep UX simple
  }
};

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  ...loadBranding(),
  loading: false,
  fetchBranding: async () => {
    if (!isBrowser) {
      return null;
    }

    try {
      const response = await api.get('/api/restaurant/branding');
      const branding = normalizeBranding(response.data?.data ?? response.data);
      persistBranding(branding);
      set((state) => ({ ...state, ...branding }));
      return branding;
    } catch (error) {
      console.error('Failed to fetch restaurant branding', error);
      return null;
    }
  },
  updateBranding: async (payload) => {
    const current: RestaurantPreferences = {
      name: get().name,
      logoUrl: get().logoUrl,
      measurementUnits: get().measurementUnits,
      enableOrderTags: get().enableOrderTags,
      loyaltyRate: get().loyaltyRate,
      loyaltyRedeemAllCategories: get().loyaltyRedeemAllCategories,
      loyaltyRedeemCategoryIds: get().loyaltyRedeemCategoryIds,
    };

    const merged = mergeBranding(current, payload);

    try {
      set((state) => ({ ...state, loading: true }));
      const response = await api.put('/api/restaurant/branding', merged);
      const branding = normalizeBranding(response.data?.data ?? response.data);
      persistBranding(branding);
      set((state) => ({ ...state, ...branding, loading: false }));
      return branding;
    } catch (error) {
      set((state) => ({ ...state, loading: false }));
      throw error;
    }
  },
  resetBranding: async () => {
    try {
      set((state) => ({ ...state, loading: true }));
      const response = await api.post('/api/restaurant/branding/reset');
      const branding = normalizeBranding(response.data?.data ?? response.data);
      persistBranding(branding);
      set((state) => ({ ...state, ...branding, loading: false }));
      return branding;
    } catch (error) {
      set((state) => ({ ...state, loading: false }));
      throw error;
    }
  },
}));
