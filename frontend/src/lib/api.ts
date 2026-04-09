import axios, { AxiosError } from 'axios';
import { useAuthStore } from '../store/auth';
import { detectClientPlatform, getBuildMarker, logClientEvent } from './observability';

const resolvedBaseURL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
const resolvedRefreshPath = import.meta.env.VITE_AUTH_REFRESH_PATH || '/api/auth/refresh';

const api = axios.create({
  baseURL: resolvedBaseURL,
  timeout: 30000,
});

type RefreshTokens = { accessToken: string; refreshToken: string };
type RefreshFailureReason = 'network' | 'auth-invalid' | 'unknown';

type RefreshError = Error & {
  reason: RefreshFailureReason;
};

let refreshRequest: Promise<RefreshTokens> | null = null;

const isTimeoutError = (error: unknown): boolean => {
  const axiosError = error as AxiosError;
  return (
    axiosError.code === 'ECONNABORTED' ||
    String(axiosError.message ?? '')
      .toLowerCase()
      .includes('timeout')
  );
};

const isNetworkError = (error: unknown): boolean => {
  const axiosError = error as AxiosError;
  return !axiosError.response;
};

const classifyRefreshError = (error: unknown): RefreshFailureReason => {
  const axiosError = error as AxiosError;
  if (axiosError.response?.status === 401) {
    return 'auth-invalid';
  }

  if (isTimeoutError(error) || isNetworkError(error)) {
    return 'network';
  }

  return 'unknown';
};

const delay = async (timeoutMs: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, timeoutMs));
};

const refreshSession = async (): Promise<RefreshTokens> => {
  const authState = useAuthStore.getState();
  const session =
    authState.session ??
    (authState.accessToken && authState.refreshToken && authState.user
      ? {
          user: authState.user,
          accessToken: authState.accessToken,
          refreshToken: authState.refreshToken,
          remember: authState.remember,
        }
      : null);

  if (!session?.refreshToken || !session?.user) {
    const error = new Error('Missing refresh session') as RefreshError;
    error.reason = 'auth-invalid';
    throw error;
  }

  if (!refreshRequest) {
    refreshRequest = (async () => {
      const maxAttempts = 3;
      let lastError: RefreshError | null = null;
      logClientEvent('auth_refresh_start', { maxAttempts, kpi: 'refresh_success_rate' });

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await axios.post(`${resolvedBaseURL}${resolvedRefreshPath}`, {
            refreshToken: session.refreshToken,
          });

          const nextTokens = response.data.data as RefreshTokens;
          useAuthStore.getState().setSession({
            user: session.user,
            accessToken: nextTokens.accessToken,
            refreshToken: nextTokens.refreshToken,
            remember: session.remember,
          });

          logClientEvent('auth_refresh_success', { attempt, kpi: 'refresh_success_rate' });
          return nextTokens;
        } catch (error) {
          const reason = classifyRefreshError(error);
          const refreshError = new Error('Refresh failed') as RefreshError;
          refreshError.reason = reason;
          lastError = refreshError;

          logClientEvent('auth_refresh_fail', { attempt, reason, kpi: 'unexpected_logout_rate' });

          if (reason === 'auth-invalid') {
            throw refreshError;
          }

          const shouldRetry = reason === 'network' && attempt < maxAttempts;
          if (!shouldRetry) {
            throw refreshError;
          }

          const backoffMs = 350 * 2 ** (attempt - 1);
          await delay(backoffMs);
        }
      }

      throw lastError ?? Object.assign(new Error('Refresh failed'), { reason: 'unknown' as const });
    })().finally(() => {
      refreshRequest = null;
    });
  }

  return refreshRequest;
};

api.interceptors.request.use((config) => {
  const authState = useAuthStore.getState();
  const accessToken = authState.session?.accessToken ?? authState.accessToken ?? undefined;

  config.headers = config.headers ?? {};
  config.headers['x-client-platform'] = detectClientPlatform();
  config.headers['x-client-build'] = getBuildMarker();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const method = String(originalRequest?.method ?? 'get').toLowerCase();
    const canRetryRequest = method === 'get' || method === 'head' || method === 'options';
    const timeoutError = isTimeoutError(error);
    const networkError = isNetworkError(error);

    if (originalRequest && canRetryRequest && (timeoutError || networkError)) {
      const retriesCount = Number(originalRequest._networkRetriesCount ?? 0);
      if (retriesCount < 2) {
        originalRequest._networkRetriesCount = retriesCount + 1;
        const backoffMs = 400 * 2 ** retriesCount;
        await delay(backoffMs);
        return api(originalRequest);
      }
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newTokens = await refreshSession();
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        const reason = (refreshError as RefreshError).reason ?? 'unknown';
        if (reason === 'auth-invalid') {
          useAuthStore.getState().clearSession('refresh_401_invalid');
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
