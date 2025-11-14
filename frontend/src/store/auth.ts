import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'admin' | 'manager' | 'cashier' | 'barista';

export type AuthUser = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  id?: string;
};

type StoredSession = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  remember: boolean;
};

type AuthState = StoredSession & {
  setSession: (payload: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
    remember: boolean;
  }) => void;
  clearSession: () => void;
};

const STORAGE_KEY = 'yago-auth';

const loadSession = (): StoredSession => {
  if (typeof window === 'undefined') {
    return { user: null, accessToken: null, refreshToken: null, remember: false };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { user: null, accessToken: null, refreshToken: null, remember: false };
    }

    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return {
      user: (parsed.user as AuthUser | null) ?? null,
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      remember: parsed.remember ?? false,
    };
  } catch (error) {
    return { user: null, accessToken: null, refreshToken: null, remember: false };
  }
};

const initialSession = loadSession();

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: initialSession.user,
      accessToken: initialSession.accessToken,
      refreshToken: initialSession.refreshToken,
      remember: initialSession.remember,
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
        set({ user: null, accessToken: null, refreshToken: null, remember: false });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) =>
        state.remember
          ? {
              accessToken: state.accessToken,
              refreshToken: state.refreshToken,
              user: state.user,
              remember: state.remember,
            }
          : {},
    }
  )
);
