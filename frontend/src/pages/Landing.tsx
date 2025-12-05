import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore, type AuthUser } from '../store/auth';
import { useToast } from '../providers/ToastProvider';
import { blogPosts, instructionLinks, newsItems } from '../constants/content';

const advantages = [
  { icon: '🧾', title: 'Фискальные чеки', description: 'Прямая интеграция с АТОЛ' },
  { icon: '☕', title: 'Меню', description: 'Позиции, группы и модификаторы' },
  { icon: '👥', title: 'Сотрудники', description: 'Доступы и роли' },
  { icon: '💰', title: 'Учёт смен', description: 'Оплата, возвраты, смены' },
  { icon: '🎁', title: 'Лояльность', description: 'Скидки, баллы без CRM' },
  { icon: '📊', title: 'Отчёты', description: 'Выручка, средний чек, прибыль' },
];

const onboardingSteps = [
  {
    title: 'Зарегистрируйтесь и создайте организацию',
    description: 'Получите роль владельца сразу после отправки формы. Без менеджеров и звонков.',
    screenshotTitle: 'Создание организации',
  },
  {
    title: 'Добавьте меню',
    description: 'Позиции, группы, модификаторы и себестоимость — в одном окне.',
    screenshotTitle: 'Меню и модификаторы',
  },
  {
    title: 'Подключите кассу и начинайте продажи',
    description: 'Поддержка АТОЛ, X/Z-отчёты, смены и чеки сразу в кассе.',
    screenshotTitle: 'Продажи и чеки',
  },
];

const galleryShots = [
  { title: 'Касса', description: 'Быстрые кнопки, модификаторы и скидки.' },
  { title: 'Меню', description: 'Категории, теги и фото позиций.' },
  { title: 'Склад', description: 'Остатки, списания и инвентаризация.' },
  { title: 'Аналитика', description: 'Выручка, средний чек и маржа по точкам.' },
];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();
  const { notify } = useToast();
  const authSectionRef = useRef<HTMLDivElement | null>(null);

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
  const [activeStep, setActiveStep] = useState(0);

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

  const handleDemoClick = () => {
    setLoginEmail('demo@yago.app');
    setLoginPassword('demo12345');
    setLoginOrganizationId('demo-coffee');
    authSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-slate-900">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
            YG
          </div>
          <div>
            <div className="text-lg font-semibold">Yago POS</div>
            <div className="text-xs text-slate-500">Касса и учёт для кофейни</div>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 text-sm font-medium text-secondary sm:flex-none sm:gap-4">
          <a href="#advantages" className="rounded-lg px-3 py-2 transition hover:bg-secondary/10">
            Преимущества
          </a>
          <a href="#instructions" className="rounded-lg px-3 py-2 transition hover:bg-secondary/10">
            Инструкции
          </a>
          <Link to="/blog" className="rounded-lg px-3 py-2 transition hover:bg-secondary/10">
            Блог
          </Link>
          <Link to="/login" className="rounded-xl px-4 py-2 transition hover:bg-secondary/10">
            Вход
          </Link>
          <button
            type="button"
            onClick={() => authSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="rounded-xl bg-secondary px-4 py-2 text-white shadow-soft transition hover:bg-secondary/90"
          >
            Создать организацию
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-16 sm:px-6 lg:gap-16">
        <section className="grid items-center gap-8 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-soft backdrop-blur md:p-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          <div className="space-y-6 lg:space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary sm:text-sm">
              Касса и учёт для кофейни
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-primary/80">без интеграций, CRM и сложностей</span>
            </div>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              Касса и учёт для кофейни — без интеграций, CRM и сложностей
            </h1>
            <p className="text-base text-slate-600 sm:text-lg">
              Меню, продажи, сотрудники и смены — в одном окне. Без менеджеров и лишнего. Создайте организацию и начните
              пробивать чеки через АТОЛ за пару минут.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={handleDemoClick}
                className="w-full rounded-2xl bg-primary px-5 py-3 text-center text-sm font-semibold text-white shadow-soft transition hover:bg-primary-dark sm:w-auto"
              >
                Попробовать демо
              </button>
              <button
                type="button"
                onClick={() => authSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full rounded-2xl px-5 py-3 text-center text-sm font-semibold text-secondary transition hover:bg-secondary/10 sm:w-auto"
              >
                Создать организацию
              </button>
            </div>
            <div className="text-sm text-slate-500">Работает на любом планшете. Печатает чеки через АТОЛ.</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="text-2xl font-bold text-primary">2 мин</div>
                <div>от регистрации до первого чека</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="text-2xl font-bold text-primary">X/Z отчёты</div>
                <div>смены и контроль кассы</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="text-2xl font-bold text-primary">Лояльность</div>
                <div>скидки и баллы без CRM</div>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-secondary/30 bg-secondary/5 p-4 shadow-soft md:p-6">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-wide text-secondary">Скриншот терминала</div>
              <div className="mt-3 rounded-2xl border border-dashed border-secondary/40 bg-gradient-to-br from-secondary/5 via-white to-primary/10 p-5 text-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold text-secondary">
                  <span>Yago POS · Терминал</span>
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-700">Онлайн</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="rounded-xl bg-white/80 p-3 shadow-inner">
                    <div className="text-xs font-semibold text-slate-500">Заказ</div>
                    <div className="mt-1 flex items-center justify-between text-base font-bold text-slate-900">
                      <span>Флэт уайт</span>
                      <span>210 ₽</span>
                    </div>
                    <p className="text-xs text-slate-500">Добавить сироп, альтернативное молоко</p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-3 shadow-inner">
                    <div className="text-xs font-semibold text-slate-500">Смена</div>
                    <div className="mt-1 flex items-center justify-between text-sm text-slate-800">
                      <span>Чеков за сегодня</span>
                      <span className="font-semibold text-primary">46</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm text-slate-800">
                      <span>Выручка</span>
                      <span className="font-semibold text-primary">38 200 ₽</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-white">
              <span className="text-center sm:text-left">Демо-организация заполнится автоматически</span>
              <Link to="/login" className="rounded-lg bg-white/15 px-3 py-1 text-white transition hover:bg-white/25">
                Или войти
              </Link>
            </div>
          </div>
        </section>

        <section id="advantages" className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft md:p-8 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Преимущества</p>
            <h2 className="text-2xl font-bold sm:text-3xl">Меню, смены и чеки в одном окне</h2>
            <p className="text-base text-slate-600">
              Запускайте кассу, лояльность и склад без интеграторов. Все хранится внутри Yago POS — роли, отчёты и права
              доступа уже настроены.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {advantages.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <span>{feature.icon}</span>
                  {feature.title}
                </div>
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
              {onboardingSteps.map((step) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span className="mt-1 h-6 w-6 shrink-0 rounded-full bg-primary/10 text-center text-sm font-semibold text-primary">
                    ✓
                  </span>
                  <span>
                    <div className="font-semibold text-slate-900">{step.title}</div>
                    <div className="text-sm text-slate-600">{step.description}</div>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Шаг {activeStep + 1} из {onboardingSteps.length}</div>
              <div className="flex gap-2 text-sm font-semibold text-secondary">
                <button
                  type="button"
                  onClick={() => setActiveStep((prev) => (prev - 1 + onboardingSteps.length) % onboardingSteps.length)}
                  className="rounded-lg px-3 py-1 transition hover:bg-secondary/10"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep((prev) => (prev + 1) % onboardingSteps.length)}
                  className="rounded-lg px-3 py-1 transition hover:bg-secondary/10"
                >
                  →
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-secondary">{onboardingSteps[activeStep].title}</div>
              <div className="mt-2 text-lg font-bold text-slate-900">{onboardingSteps[activeStep].screenshotTitle}</div>
              <p className="mt-1 text-slate-600">{onboardingSteps[activeStep].description}</p>
              <div className="mt-4 rounded-xl border border-dashed border-secondary/30 bg-white/80 p-4 text-center text-sm font-semibold text-secondary">
                Карусель со скриншотами шага · уже реализована
              </div>
            </div>
            <div className="rounded-xl bg-secondary/10 p-4 text-sm text-secondary">
              Вход и регистрация работают прямо на этой странице. Если нужна отдельная ссылка, используйте /login.
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft md:p-8 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Скриншоты и видео</p>
            <h2 className="text-2xl font-bold sm:text-3xl">Посмотрите интерфейсы</h2>
            <p className="text-base text-slate-600">Касса, меню, склад и аналитика — выберите нужный экран или откройте видео «Как пробить чек в Yago».</p>
          </div>
          <div className="grid gap-3 lg:col-span-2 lg:grid-cols-2">
            {galleryShots.map((shot) => (
              <div key={shot.title} className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 via-white to-primary/5 p-5 shadow-sm">
                <div className="text-lg font-semibold text-slate-900">{shot.title}</div>
                <p className="mt-1 text-sm text-slate-600">{shot.description}</p>
                <div className="mt-3 h-28 rounded-xl border border-dashed border-secondary/40 bg-white/60 text-center text-sm font-semibold text-secondary/80">
                  Скриншот интерфейса
                </div>
              </div>
            ))}
            <div className="lg:col-span-2">
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <div className="aspect-video w-full bg-black/5">
                  <iframe
                    className="h-full w-full"
                    src="https://www.youtube.com/embed/2vjPBrBU-TM"
                    title="Как пробить чек в Yago"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section ref={authSectionRef} id="signup" className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft md:p-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Онбординг без менеджеров</p>
            <h2 className="text-2xl font-bold sm:text-3xl">Создайте организацию или войдите</h2>
            <p className="text-base text-slate-600">
              Форма регистрации и входа работает прямо на лендинге. После создания организации вы сразу попадёте в кассу и сможете
              настроить меню, сотрудников и права.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">Без звонков</span>
              <span className="rounded-full bg-secondary/10 px-3 py-1 font-semibold text-secondary">Демо-профиль заполняется</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">Поддержка: support@yagopos.ru</span>
            </div>
          </div>
          <div className="grid gap-6">
            <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm md:p-5">
              <div className="mb-4 space-y-1 text-center">
                <div className="text-xs font-semibold uppercase tracking-wide text-secondary">Шаг 1</div>
                <h3 className="text-xl font-bold">Создайте организацию</h3>
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
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
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

        <section id="news" className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft md:p-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Что нового</p>
            <h2 className="text-2xl font-bold sm:text-3xl">Новости и обновления</h2>
            <p className="text-base text-slate-600">Следите за релизами: changelog закреплён на лендинге и доступен по ссылке /news.</p>
            <Link to="/news" className="inline-flex items-center justify-center rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/90">
              Перейти в /news
            </Link>
          </div>
          <div className="space-y-3">
            {newsItems.map((item) => (
              <div key={item.date} className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-secondary">{item.date}</div>
                  <div className="text-base font-semibold text-slate-900">{item.title}</div>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </div>
                <span className="text-lg">🆕</span>
              </div>
            ))}
          </div>
        </section>

        <section id="instructions" className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft md:p-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Инструкции</p>
            <h2 className="text-2xl font-bold sm:text-3xl">Готовые гайды внутри /docs</h2>
            <p className="text-base text-slate-600">Открывайте статьи в CMS или markdown-файлах. Добавили кнопку, ведущую в раздел инструкции.</p>
            <Link
              to="/docs"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
            >
              Перейти к инструкциям
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {instructionLinks.map((item) => (
              <a
                key={item.title}
                href={item.href}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-secondary/50 hover:shadow-md"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-secondary">Гайд</div>
                <div className="mt-1 text-base font-semibold text-slate-900">{item.title}</div>
                <p className="text-sm text-slate-600">Ссылка: {item.href}</p>
              </a>
            ))}
          </div>
        </section>

        <section id="blog" className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft md:p-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Блог</p>
            <h2 className="text-2xl font-bold sm:text-3xl">Блог для владельцев кофеен</h2>
            <p className="text-base text-slate-600">Последние статьи о запуске, лояльности и управлении кофейней.</p>
            <Link
              to="/blog"
              className="inline-flex items-center justify-center rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/90"
            >
              Читать все статьи
            </Link>
          </div>
          <div className="grid gap-3">
            {blogPosts.slice(0, 3).map((post) => (
              <article key={post.slug} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-secondary">{post.date}</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{post.title}</div>
                <p className="mt-1 text-sm text-slate-600">{post.excerpt}</p>
                <Link to={`/blog/${post.slug}`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-secondary">
                  Читать
                  <span>→</span>
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-10 bg-slate-900 py-8 text-sm text-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <div className="text-base font-semibold text-white">Yago POS</div>
            <div className="text-xs text-slate-400">Текущая версия: v0.8.1</div>
            <a href="mailto:support@yagopos.ru" className="text-secondary">support@yagopos.ru</a>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
            <Link to="/docs" className="rounded-lg px-2 py-1 hover:bg-white/10">
              Инструкции
            </Link>
            <Link to="/blog" className="rounded-lg px-2 py-1 hover:bg-white/10">
              Блог
            </Link>
            <Link to="/news" className="rounded-lg px-2 py-1 hover:bg-white/10">
              Новости
            </Link>
            <a href="/rules" className="rounded-lg px-2 py-1 hover:bg-white/10">
              Правила
            </a>
            <a href="/policy" className="rounded-lg px-2 py-1 hover:bg-white/10">
              Политика
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
