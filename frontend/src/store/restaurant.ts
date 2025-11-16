import { create } from 'zustand';

export type RestaurantBranding = {
  name: string;
  logoUrl: string;
};

type RestaurantState = RestaurantBranding & {
  updateBranding: (payload: Partial<RestaurantBranding>) => void;
  resetBranding: () => void;
};

const STORAGE_KEY = 'yago-restaurant-branding';

const defaultBranding: RestaurantBranding = {
  name: 'Yago Coffee',
  logoUrl: '',
};

const isBrowser = typeof window !== 'undefined';

const loadBranding = (): RestaurantBranding => {
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

    return {
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : defaultBranding.name,
      logoUrl: typeof parsed.logoUrl === 'string' ? parsed.logoUrl : defaultBranding.logoUrl,
    };
  } catch {
    return defaultBranding;
  }
};

const persistBranding = (branding: RestaurantBranding) => {
  if (!isBrowser) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(branding));
  } catch {
    // ignore write errors to keep UX simple
  }
};

export const useRestaurantStore = create<RestaurantState>((set) => ({
  ...loadBranding(),
  updateBranding: (payload) =>
    set((state) => {
      const updated: RestaurantBranding = {
        name: payload.name !== undefined ? payload.name : state.name,
        logoUrl: payload.logoUrl !== undefined ? payload.logoUrl : state.logoUrl,
      };

      persistBranding(updated);
      return updated;
    }),
  resetBranding: () => {
    persistBranding(defaultBranding);
    set(defaultBranding);
  },
}));
