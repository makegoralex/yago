import { create } from 'zustand';

import api from '../lib/api';

export type RestaurantBranding = {
  name: string;
  logoUrl: string;
};

type RestaurantPreferences = RestaurantBranding & {
  enableOrderTags: boolean;
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
  enableOrderTags: false,
};

const isBrowser = typeof window !== 'undefined';

const normalizeBranding = (payload: unknown): RestaurantPreferences => {
  const source =
    payload && typeof payload === 'object' && 'branding' in (payload as Record<string, unknown>)
      ? (payload as { branding?: unknown }).branding
      : payload;

  return {
    name:
      source && typeof source === 'object' && typeof (source as any).name === 'string' && (source as any).name.trim()
        ? (source as any).name.trim()
        : defaultBranding.name,
    logoUrl:
      source && typeof source === 'object' && typeof (source as any).logoUrl === 'string'
        ? (source as any).logoUrl
        : defaultBranding.logoUrl,
    enableOrderTags:
      source && typeof source === 'object' && typeof (source as any).enableOrderTags === 'boolean'
        ? (source as any).enableOrderTags
        : defaultBranding.enableOrderTags,
  };
};

const mergeBranding = (
  current: RestaurantPreferences,
  payload: Partial<RestaurantPreferences> | null | undefined
): RestaurantPreferences => ({
  name:
    typeof payload?.name === 'string' && payload.name.trim() ? payload.name.trim() : current.name,
  logoUrl: typeof payload?.logoUrl === 'string' ? payload.logoUrl : current.logoUrl,
  enableOrderTags:
    typeof payload?.enableOrderTags === 'boolean' ? payload.enableOrderTags : current.enableOrderTags,
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
      enableOrderTags: get().enableOrderTags,
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
