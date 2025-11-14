import { create } from 'zustand';

export type UserRole = 'admin' | 'manager' | 'cashier' | 'barista';

export type AuthUser = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  id?: string;
};

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  remember: boolean;

  setSession: (payload: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
    remember: boolean;
  }) => void;

  clearSession: () => void;
};

const STORAGE_KEY = 'yago-auth';

const loadSession = () => {
  if (typeof window === 'undefined') {
    return { user: null, accessToken: null, refreshToken: null, remember: false };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { user: null, accessToken: null, refreshToken: null, remember: false };
    }
    return JSON.parse(raw);
  } catch {
    return { user: null, accessToken: null, refreshToken: null, remember: false };
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  ...loadSession(),

  setSession: ({ user, accessToken, refreshToken, remember }) => {
    const session = { user, accessToken, refreshToken, remember };

    if (typeof window !== 'undefined') {
      if (remember) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    set(session);
  },

  clearSession: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      remember: false,
    });
  },
}));
