import { create } from 'zustand';

export type UserRole = 'admin' | 'manager' | 'cashier' | 'barista';

export type AuthUser = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  id?: string;
};

type Session = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  remember: boolean;
};

type AuthState = {
  session: Session | null;

  // 🔥 Совместимость со старым кодом
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  remember: boolean;

  setSession: (session: Session) => void;
  clearSession: () => void;
};

const STORAGE_KEY = 'yago-auth';

const loadSession = (): Session | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  session: loadSession(),

  // Геттеры для совместимости
  get user() {
    return this.session?.user ?? null;
  },
  get accessToken() {
    return this.session?.accessToken ?? null;
  },
  get refreshToken() {
    return this.session?.refreshToken ?? null;
  },
  get remember() {
    return this.session?.remember ?? false;
  },

  setSession: (session) => {
    set({ session });

    if (session.remember) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  },

  clearSession: () => {
    window.localStorage.removeItem(STORAGE_KEY);
    set({
      session: null,
    });
  },
}));
