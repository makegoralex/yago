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
  // старая структура (нужна старому фронту + Codex-коду)
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  remember: boolean;

  // новая структура — для новых модулей Codex
  session: Session | null;

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

export const useAuthStore = create<AuthState>((set) => {
  const session = loadSession();

  return {
    // старая модель данных
    user: session?.user ?? null,
    accessToken: session?.accessToken ?? null,
    refreshToken: session?.refreshToken ?? null,
    remember: session?.remember ?? false,

    // новая модель данных
    session,

    setSession: (session) => {
      // сохраняем в Zustand
      set({
        session,
        user: session.user,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        remember: session.remember,
      });

      // сохраняем в localStorage
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
        user: null,
        accessToken: null,
        refreshToken: null,
        remember: false,
      });
    },
  };
});
