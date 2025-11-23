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
      const response = await api.post('/api/organizations/public/create', {
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
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error ?? 'Попробуйте еще раз';
      notify({ title: 'Не удалось зарегистрироваться', description: errorMessage, type: 'error' });
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

  const featureCards = [
    {
      title: 'Касса и меню',
      description: 'Добавляйте товары, цены и модификаторы, пробивайте чеки и отслеживайте продажи по часам.',
    },
    {
      title: 'Лояльность и клиенты',
      description: 'Запускайте бонусы, скидки и промокоды без интеграций — все хранится внутри Yago.',
    },
    {
      title: 'Склад и себестоимость',
      description: 'Управляйте списаниями и остатками, смотрите себестоимость и маржу по категориям.',
    },
    {
      title: 'Сеть без боли',
      description: 'Несколько точек? Создавайте филиалы, назначайте роли и смотрите единую аналитику.',
    },
  ];

  const steps = [
    'Создайте организацию и получите доступ владельца сразу после отправки формы.',
    'Добавьте точки продаж, сотрудников и права — все готово к масштабированию.',
    'Заведите товары и запустите кассу — чеки и аналитика появятся автоматически.',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-slate-900">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
            YG
          </div>
          <div>
            <div className="text-lg font-semibold">Yago POS</div>
            <div className="text-xs text-slate-500">Автономная касса и аналитика для кофеен</div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end gap-3 text-sm font-medium text-secondary sm:flex-none">
          <Link to="/login" className="rounded-xl px-4 py-2 transition hover:bg-secondary/10">
            Вход
          </Link>
          <Link
            to="#signup"
            className="rounded-xl bg-secondary px-4 py-2 text-white shadow-soft transition hover:bg-secondary/90"
          >
            Регистрация
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-16 sm:px-6 lg:gap-14">
        <section className="grid items-center gap-8 rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-soft backdrop-blur md:p-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div className="space-y-6 lg:space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary sm:text-sm">
              Открытая регистрация
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-primary/80">без менеджеров и оплат</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              Управляйте кофейней в Yago: касса, склад, лояльность и сеть в одном окне
            </h1>
            <p className="text-base text-slate-600 sm:text-lg">
              Создайте организацию, получите доступ владельца и начните работать через пару минут. Все функции сразу
              доступны, а данные вашей сети изолированы по organizationId.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap" id="signup">
              <Link
                to="#signup"
                className="w-full rounded-2xl bg-primary px-5 py-3 text-center text-sm font-semibold text-white shadow-soft transition hover:bg-primary-dark sm:w-auto"
              >
                Зарегистрироваться и начать
              </Link>
              <Link
                to="/login"
                className="w-full rounded-2xl px-5 py-3 text-center text-sm font-semibold text-secondary transition hover:bg-secondary/10 sm:w-auto"
              >
                Войти в кабинет
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="text-2xl font-bold text-primary">2 мин</div>
                <div>от регистрации до первого чека</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="text-2xl font-bold text-primary">Без интеграторов</div>
                <div>вся настройка в вашем кабинете</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="text-2xl font-bold text-primary">Сеть готова</div>
                <div>ролей и филиалов сколько нужно</div>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-secondary/30 bg-secondary/5 p-4 shadow-soft md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-white">
              <span className="text-center sm:text-left">Регистрация открыта</span>
              <Link to="/login" className="rounded-xl bg-white/15 px-3 py-1 text-white transition hover:bg-white/25">
                Уже есть вход
              </Link>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm md:p-5">
              <div className="mb-4 space-y-1 text-center">
                <div className="text-xs font-semibold uppercase tracking-wide text-secondary">Шаг 1</div>
                <h2 className="text-xl font-bold">Создайте организацию</h2>
                <p className="text-sm text-slate-500">Владелец и базовые данные появятся автоматически.</p>
              </div>
              <form className="space-y-3" onSubmit={handleSignup}>
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="organizationName">
                    Название кофейни
                  </label>
                  <input
                    id="organizationName"
                    required
                    value={organizationName}
                    onChange={(event) => setOrganizationName(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm transition focus:border-secondary focus:bg-white"
                    placeholder="Например, Кофе на районе"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700" htmlFor="ownerName">
                      Имя владельца
                    </label>
                    <input
                      id="ownerName"
                      required
                      value={ownerName}
                      onChange={(event) => setOwnerName(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm transition focus:border-secondary focus:bg-white"
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
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm transition focus:border-secondary focus:bg-white"
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
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm transition focus:border-secondary focus:bg-white"
                    placeholder="Придумайте надежный пароль"
                  />
                </div>
                <button
                  type="submit"
                  disabled={signupLoading}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white shadow-soft transition hover:bg-primary-dark disabled:opacity-70 disabled:hover:bg-primary"
                >
                  {signupLoading ? 'Создаем аккаунт...' : 'Создать организацию и войти'}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-dashed border-secondary/40 bg-white px-5 py-4 text-sm shadow-sm">
              <div className="font-semibold text-slate-800">Есть доступ? Войдите сразу.</div>
              <form className="mt-3 space-y-3" onSubmit={handleLogin}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm transition focus:border-secondary"
                    placeholder="Email"
                  />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm transition focus:border-secondary"
                    placeholder="Пароль"
                  />
                </div>
                <input
                  type="text"
                  value={loginOrganizationId}
                  onChange={(event) => setLoginOrganizationId(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-sm transition focus:border-secondary"
                  placeholder="ID организации (опционально)"
                />
                <div className="flex items-center justify-between text-xs text-slate-600">
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
                    Отдельная страница входа
                  </Link>
                </div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-secondary text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/90 disabled:opacity-70"
                >
                  {loginLoading ? 'Входим...' : 'Войти в кабинет'}
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft md:p-8 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Что внутри</p>
            <h2 className="text-2xl font-bold sm:text-3xl">Вся операционная кофейни без подключения сторонних сервисов</h2>
            <p className="text-base text-slate-600">
              Вы получаете полный набор инструментов: касса, склад, лояльность, роли и единая аналитика по сети. Настройка
              занимает минуты, а данные хранятся внутри Yago — ничего не нужно подключать дополнительно.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {featureCards.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
                <div className="text-base font-semibold text-slate-900">{feature.title}</div>
                <p className="mt-1 text-sm text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-secondary/5 via-white to-primary/5 p-5 shadow-soft md:p-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Как начать</p>
            <h2 className="text-2xl font-bold sm:text-3xl">Три шага до работы в кассе</h2>
            <ul className="space-y-3 text-base text-slate-700">
              {steps.map((step) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-1 h-6 w-6 shrink-0 rounded-full bg-primary/10 text-center text-sm font-semibold text-primary">
                    ✓
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Готовы начать?</div>
              <Link to="#signup" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
                Создать организацию
              </Link>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Поддержка</div>
              <p className="mt-1">Вопросы — пишите на support@yago-app.ru. Мы ответим и поможем настроиться.</p>
            </div>
            <div className="rounded-xl bg-secondary/10 p-4 text-sm text-secondary">
              Вход и регистрация работают прямо на этой странице. Если нужна отдельная ссылка, используйте /login.
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
