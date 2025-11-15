import axios from 'axios';
import { useAuthStore } from '../store/auth';


const resolvedBaseURL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

const api = axios.create({
  baseURL: resolvedBaseURL,
});

api.interceptors.request.use((config) => {
  const session = useAuthStore.getState().session;

  if (session?.accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const session = useAuthStore.getState().session;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!session?.refreshToken || !session?.user) {
        useAuthStore.getState().clearSession();
        return Promise.reject(error);
      }

      try {
        const refreshResponse = await axios.post(`${resolvedBaseURL}/api/auth/refresh`, {
          refreshToken: session.refreshToken,
        });

        const newTokens = refreshResponse.data.data;

        useAuthStore
          .getState()
          .setSession({
            user: session.user,
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            remember: session.remember,
          });

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
