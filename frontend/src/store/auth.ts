import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'admin' | 'manager' | 'cashier' | 'barista';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      remember: false,
      setSession: ({ user, accessToken, refreshToken, remember }) =>
        set({ user, accessToken, refreshToken, remember }),
      clearSession: () => set({ user: null, accessToken: null, refreshToken: null, remember: false }),
    }),
    {
      name: 'yago-auth',
      partialize: (state) => (state.remember ? state : {}),
    }
  )
);
