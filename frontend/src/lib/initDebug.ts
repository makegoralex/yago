const DEBUG_KEY = 'yago-debug-init';

const isEnabled = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  if (import.meta.env.DEV) {
    return true;
  }

  if (import.meta.env.VITE_DEBUG_INIT === '1') {
    return true;
  }

  const fromStorage = window.localStorage.getItem(DEBUG_KEY);
  if (fromStorage === '1') {
    return true;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('debugInit') === '1';
};

const toErrorPayload = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

export const initDebug = {
  start(step: string, payload: Record<string, unknown> = {}) {
    if (!isEnabled()) return;
    console.info('[init-debug:start]', step, payload);
  },
  end(step: string, payload: Record<string, unknown> = {}) {
    if (!isEnabled()) return;
    console.info('[init-debug:end]', step, payload);
  },
  error(step: string, error: unknown, payload: Record<string, unknown> = {}) {
    if (!isEnabled()) return;
    console.error('[init-debug:error]', step, {
      ...payload,
      error: toErrorPayload(error),
    });
  },
};
