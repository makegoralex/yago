import { create } from 'zustand';
import { logClientEvent } from '../lib/observability';

export type UserRole = 'cashier' | 'kitchen' | 'owner' | 'superAdmin';

export type AuthUser = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  id?: string;
};

type SessionMeta = {
  createdAt: string;
  lastRefreshAt: string;
};

type Session = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  remember: boolean;
  meta?: SessionMeta;
};

type PersistedSession = Session & { meta: SessionMeta };

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  remember: boolean;
  session: PersistedSession | null;

  setSession: (session: Session) => void;
  clearSession: (reason?: string) => void;
};

const STORAGE_KEY = 'yago-auth';

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

let memoryStorageValue: string | null = null;

const inMemoryStorage: StorageLike = {
  getItem: () => memoryStorageValue,
  setItem: (_key, value) => {
    memoryStorageValue = value;
  },
  removeItem: () => {
    memoryStorageValue = null;
  },
};

const canUseStorage = (storage: Storage): boolean => {
  try {
    const key = `${STORAGE_KEY}-probe`;
    storage.setItem(key, '1');
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

const resolveStorageAdapter = (): { storage: StorageLike; type: 'localStorage' | 'sessionStorage' | 'memory' } => {
  if (typeof window === 'undefined') {
    return { storage: inMemoryStorage, type: 'memory' };
  }

  if (canUseStorage(window.localStorage)) {
    return { storage: window.localStorage, type: 'localStorage' };
  }

  if (canUseStorage(window.sessionStorage)) {
    return { storage: window.sessionStorage, type: 'sessionStorage' };
  }

  return { storage: inMemoryStorage, type: 'memory' };
};

const withSessionMeta = (session: Session, currentSession: PersistedSession | null): PersistedSession => {
  const now = new Date().toISOString();
  return {
    ...session,
    meta: {
      createdAt: session.meta?.createdAt ?? currentSession?.meta.createdAt ?? now,
      lastRefreshAt: now,
    },
  };
};

const loadSession = (): PersistedSession | null => {
  const { storage } = resolveStorageAdapter();

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Session;
    return withSessionMeta(parsed, null);
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => {
  const session = loadSession();

  return {
    user: session?.user ?? null,
    accessToken: session?.accessToken ?? null,
    refreshToken: session?.refreshToken ?? null,
    remember: session?.remember ?? false,
    session,

    setSession: (nextSession) => {
      const { storage } = resolveStorageAdapter();
      const persistedSession = withSessionMeta(nextSession, get().session);

      set({
        session: persistedSession,
        user: persistedSession.user,
        accessToken: persistedSession.accessToken,
        refreshToken: persistedSession.refreshToken,
        remember: persistedSession.remember,
      });

      if (persistedSession.remember) {
        storage.setItem(STORAGE_KEY, JSON.stringify(persistedSession));
      } else {
        storage.removeItem(STORAGE_KEY);
      }
    },

    clearSession: (reason = 'unknown') => {
      const { storage } = resolveStorageAdapter();
      storage.removeItem(STORAGE_KEY);
      logClientEvent('session_cleared_reason', { reason, kpi: 'unexpected_logout_rate' });

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
