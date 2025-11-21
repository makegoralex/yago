import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore, type AuthUser } from '../store/auth';
import { useToast } from '../providers/ToastProvider';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();
  const { notify } = useToast();

  const [organizationName, setOrganizationName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginOrganizationId, setLoginOrganizationId] = useState('');
  const [loginRemember, setLoginRemember] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  const extractTokens = (payload: any) => {
    const accessToken = payload?.accessToken ?? payload?.tokens?.accessToken;
    const refreshToken = payload?.refreshToken ?? payload?.tokens?.refreshToken;
    if (!accessToken || !refreshToken) {
      throw new Error('Tokens are missing in response');
    }
    return { accessToken, refreshToken };
  };

  const normalizeUser = (payloadUser: any, fallbackRole: AuthUser['role']): AuthUser => {
    const identifier = payloadUser?.id ?? payloadUser?._id;
    if (!identifier) {
      throw new Error('User identifier is missing');
    }

    return {
      _id: identifier,
      id: identifier,
      name: payloadUser?.name ?? 'Новый пользователь',
      email: payloadUser?.email ?? email,
      role: payloadUser?.role ?? fallbackRole,
      organizationId: payloadUser?.organizationId ?? payloadUser?.organization?.id,
    };
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setSignupLoading(true);
    try {
      const response = await api.post('/api/organizations/create', {
        name: organizationName,
        owner: { name: ownerName, email, password },
      });

      const rawPayload = response.data?.data ?? response.data;
      const tokens = extractTokens(rawPayload);
      const payloadUser = rawPayload?.owner ?? rawPayload?.user;
      const user = normalizeUser(payloadUser, 'owner');
      user.organizationId = user.organizationId ?? rawPayload?.organization?.id;

      setSession({ user, ...tokens, remember: true });
      notify({
        title: 'Организация создана',
        description: 'Мы настроили базовые категории и подключили ваш кабинет.',
        type: 'success',
      });
      navigate('/pos');
    } catch (error) {
      notify({ title: 'Не удалось зарегистрироваться', description: 'Попробуйте еще раз', type: 'error' });
    } finally {
      setSignupLoading(false);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginLoading(true);
    try {
      const payload: Record<string, string> = { email: loginEmail, password: loginPassword };
      if (loginOrganizationId.trim()) {
        payload.organizationId = loginOrganizationId.trim();
      }

      const response = await api.post('/api/auth/login', payload);
      const rawPayload = response.data?.data ?? response.data;
      const tokens = extractTokens(rawPayload);
      const payloadUser = rawPayload?.user ?? rawPayload?.userInfo;
      const user = normalizeUser(payloadUser, 'cashier');

      setSession({ user, ...tokens, remember: loginRemember });
      notify({ title: 'Добро пожаловать!', description: `Привет, ${user.name}`, type: 'success' });
      navigate('/pos');
    } catch (error) {
      notify({ title: 'Ошибка входа', description: 'Проверьте данные и попробуйте снова.', type: 'error' });
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
            YG
          </div>
          <div>
            <div className="text-lg font-semibold">Yago POS</div>
            <div className="text-xs text-slate-500">Касса, аналитика и управление кофейней</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm font-medium text-secondary">
          <Link to="/login" className="rounded-xl px-4 py-2 hover:bg-secondary/10">
            Вход
          </Link>
          <Link
            to="#signup"
            className="rounded-xl bg-secondary px-4 py-2 text-white shadow-soft transition hover:bg-secondary/90"
          >
            Начать бесплатно
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl items-start gap-10 px-6 pb-16 lg:grid-cols-[1.2fr_1fr]">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            SaaS для кофейных сетей
          </div>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            Запустите свою кофейню в Yago за пару минут — без интеграторов и оплаты
          </h1>
          <p className="text-lg text-slate-600">
            Создайте организацию, получите доступ владельца и начните добавлять товары. Все данные изолированы по
            organizationId, поэтому ваш кабинет готов к росту сети.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-base font-semibold">Общий код, отдельные данные</div>
              <p className="mt-1 text-sm text-slate-600">Все функции автоматически доступны всем организациям.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-base font-semibold">Мгновенный старт</div>
              <p className="mt-1 text-sm text-slate-600">Мы создадим владельца, базовые категории и настройки.</p>
            </div>
          </div>
        </section>

        <section id="signup">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <div className="mb-6 space-y-1 text-center">
              <div className="text-sm font-semibold uppercase tracking-wide text-secondary">Регистрация</div>
              <h2 className="text-2xl font-bold">Создайте организацию</h2>
              <p className="text-sm text-slate-500">Доступ владельца и базовые данные — сразу после отправки формы.</p>
            </div>
            <form className="space-y-4" onSubmit={handleSignup}>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="organizationName">
                  Название кофейни
                </label>
                <input
                  id="organizationName"
                  required
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm focus:border-secondary focus:bg-white"
                  placeholder="Например, Кофе на районе"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="ownerName">
                    Имя владельца
                  </label>
                  <input
                    id="ownerName"
                    required
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm focus:border-secondary focus:bg-white"
                    placeholder="Александр"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="ownerEmail">
                    Email владельца
                  </label>
                  <input
                    id="ownerEmail"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm focus:border-secondary focus:bg-white"
                    placeholder="owner@coffee.ru"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="ownerPassword">
                  Пароль
                </label>
                <input
                  id="ownerPassword"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm focus:border-secondary focus:bg-white"
                  placeholder="Придумайте надежный пароль"
                />
              </div>
              <button
                type="submit"
                disabled={signupLoading}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-white shadow-soft transition hover:bg-primary-dark disabled:opacity-70"
              >
                {signupLoading ? 'Создаем аккаунт...' : 'Создать организацию и войти'}
              </button>
            </form>

            <div className="mt-8 space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-700">Уже есть доступ?</div>
              <form className="space-y-3" onSubmit={handleLogin}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-secondary"
                    placeholder="Email"
                  />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-secondary"
                    placeholder="Пароль"
                  />
                </div>
                <input
                  type="text"
                  value={loginOrganizationId}
                  onChange={(event) => setLoginOrganizationId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm focus:border-secondary"
                  placeholder="ID организации (опционально)"
                />
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={loginRemember}
                      onChange={(event) => setLoginRemember(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary"
                    />
                    Запомнить меня
                  </label>
                  <Link to="/login" className="font-semibold text-secondary hover:text-secondary/80">
                    Открыть страницу входа
                  </Link>
                </div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="flex h-12 w-full items-center justify-center rounded-2xl bg-secondary text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/90 disabled:opacity-70"
                >
                  {loginLoading ? 'Входим...' : 'Войти в кабинет'}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
