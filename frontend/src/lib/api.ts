import axios from 'axios';
import { useAuthStore } from '../store/auth';


const resolvedBaseURL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

const api = axios.create({
  baseURL: resolvedBaseURL,
  timeout: 30000,
});

let refreshRequest: Promise<{ accessToken: string; refreshToken: string }> | null = null;

const refreshSession = async () => {
  const authState = useAuthStore.getState();
  const session = authState.session ??
    (authState.accessToken && authState.refreshToken && authState.user
      ? {
          user: authState.user,
          accessToken: authState.accessToken,
          refreshToken: authState.refreshToken,
          remember: authState.remember,
        }
      : null);

  if (!session?.refreshToken || !session?.user) {
    useAuthStore.getState().clearSession();
    throw new Error('Missing refresh session');
  }

  if (!refreshRequest) {
    refreshRequest = axios
      .post(`${resolvedBaseURL}/api/auth/refresh`, {
        refreshToken: session.refreshToken,
      })
      .then((response) => {
        const nextTokens = response.data.data as { accessToken: string; refreshToken: string };
        useAuthStore
          .getState()
          .setSession({
            user: session.user,
            accessToken: nextTokens.accessToken,
            refreshToken: nextTokens.refreshToken,
            remember: session.remember,
          });
        return nextTokens;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
};

api.interceptors.request.use((config) => {
  const authState = useAuthStore.getState();
  const accessToken = authState.session?.accessToken ?? authState.accessToken ?? undefined;

  if (accessToken) {
    config.headers = config.headers ?? {};
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
    const isTimeout = error.code === 'ECONNABORTED' || String(error.message ?? '').toLowerCase().includes('timeout');
    const isNetworkError = !error.response;

    if (originalRequest && canRetryRequest && (isTimeout || isNetworkError)) {
      const retriesCount = Number(originalRequest._networkRetriesCount ?? 0);
      if (retriesCount < 2) {
        originalRequest._networkRetriesCount = retriesCount + 1;
        const backoffMs = 400 * 2 ** retriesCount;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
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
        useAuthStore.getState().clearSession();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
