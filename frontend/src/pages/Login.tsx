import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useToast } from '../providers/ToastProvider';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { setSession, clearSession, user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const rawPayload = response.data?.data ?? response.data;

      const accessToken = rawPayload?.accessToken ?? rawPayload?.tokens?.accessToken;
      const refreshToken = rawPayload?.refreshToken ?? rawPayload?.tokens?.refreshToken;
      const payloadUser = rawPayload?.user ?? rawPayload?.userInfo;

      if (!accessToken || !refreshToken || !payloadUser) {
        throw new Error('Invalid login response payload');
      }

      setSession({ user: payloadUser, accessToken, refreshToken, remember });
      notify({ title: 'Добро пожаловать!', description: `Привет, ${payloadUser.name}`, type: 'success' });
      navigate('/pos');
    } catch (error) {
      notify({ title: 'Ошибка входа', description: 'Не удалось войти. Проверьте данные.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    notify({ title: 'Сессия завершена', type: 'info' });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-soft">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Yago POS</h1>
          <p className="mt-2 text-sm text-slate-500">Войдите, чтобы продолжить работу кассира.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-600">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm focus:border-secondary focus:bg-white"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-600">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm focus:border-secondary focus:bg-white"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary"
              />
              Запомнить меня
            </label>
            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-secondary hover:text-secondary/80"
              >
                Выйти
              </button>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-white shadow-soft transition hover:bg-primary-dark disabled:opacity-70"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
