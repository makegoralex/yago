import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Coffee,
  CreditCard,
  Gift,
  Headset,
  MapPin,
  Receipt,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Users,
  Wallet2,
} from 'lucide-react';
import api from '../lib/api';
import { useAuthStore, type AuthUser } from '../store/auth';
import { useToast } from '../providers/ToastProvider';
import { blogPosts, instructionLinks, newsItems, screenshotGallery } from '../constants/content';

const advantages = [
  { icon: Receipt, title: 'Онлайн-чек и ФН', description: 'Работаем с АТОЛ: фискализация, X/Z-отчёты, смены' },
  { icon: Coffee, title: 'Меню кофейни', description: 'Категории, модификаторы, альтернативное молоко, доп.соусы' },
  { icon: CreditCard, title: 'Эквайринг', description: 'Принимаем карты, QR и Apple Pay без доп. интеграций' },
  { icon: Wallet2, title: 'Учёт смен', description: 'Выручка, инкассация, возвраты, контроль по кассирам' },
  { icon: Gift, title: 'Лояльность', description: 'Скидки и бонусы без отдельной CRM, автоматическое начисление' },
  { icon: BarChart3, title: 'Отчёты', description: 'Средний чек, маржинальность, топ-позиции по времени' },
];

const onboardingSteps = [
  {
    title: 'Заявка без звонков',
    description: 'Создайте организацию — касса активируется сразу, как на restik.com/automation.',
    screenshotTitle: 'Создание организации',
  },
  {
    title: 'Настройка меню и оплаты',
    description: 'Загрузите позиции, подключите эквайринг и кассу АТОЛ — всё в личном кабинете.',
    screenshotTitle: 'Меню и модификаторы',
  },
  {
    title: 'Старт продаж за 1 день',
    description: 'Кассиры работают в веб-терминале: чеки, скидки, возвраты, смены.',
    screenshotTitle: 'Продажи и чеки',
  },
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

  const primaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-[12px] bg-primary px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-primary-dark hover:shadow-md';
  const secondaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-[12px] border border-slate-300 px-5 py-3 text-base font-semibold text-slate-800 transition hover:bg-slate-100';

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
    <div className="min-h-screen bg-[#f6f7fb] text-slate-800">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(124,58,237,0.15),transparent_35%),radial-gradient(circle_at_75%_10%,rgba(99,102,241,0.12),transparent_32%),linear-gradient(120deg,rgba(124,58,237,0.04),transparent_38%,rgba(124,58,237,0.06))]" />
        <header className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
              YG
            </div>
            <div>
              <div className="heading-font text-xl font-semibold text-slate-900">Yago POS</div>
              <div className="text-xs text-slate-500">Автоматизация кофейни</div>
            </div>
          </div>
          <nav className="flex flex-1 flex-wrap items-center justify-end gap-2 text-sm font-medium sm:flex-none sm:gap-4">
            <a href="#advantages" className="rounded-lg px-3 py-2 text-nav transition hover:text-navHover">
              Возможности
            </a>
            <a href="#flow" className="rounded-lg px-3 py-2 text-nav transition hover:text-navHover">
              Как подключиться
            </a>
            <a href="#signup" className="rounded-lg px-3 py-2 text-nav transition hover:text-navHover">
              Заявка
            </a>
            <Link to="/login" className="rounded-lg px-3 py-2 text-nav transition hover:text-navHover">
              Вход
            </Link>
            <button
              type="button"
              onClick={() => authSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="rounded-[12px] bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark hover:shadow-md"
            >
              Создать организацию
            </button>
          </nav>
        </header>
      </div>

      <main className="relative mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-16 sm:px-6 lg:gap-16">
        <section className="relative grid items-center gap-10 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-[#f6f1ff] to-[#eef2ff] p-6 shadow-[0_20px_70px_rgba(124,58,237,0.08)] md:p-10 lg:grid-cols-[1.05fr_1fr]">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -right-10 -bottom-16 h-48 w-48 rounded-full bg-secondary/20 blur-3xl" />
          <div className="relative space-y-6 lg:space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary">
              Подобие restik.com/automation
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-primary/80">автоматизация кофейни за 1 день</span>
            </div>
            <h1 className="heading-font text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
              Полноценная касса и эквайринг для кофейни — теперь в светлом стиле
            </h1>
            <p className="text-lg text-slate-600">
              Веб-терминал, АТОЛ, лояльность и учёт смен без интеграторов. Запускайтесь по сценарию, знакомому по restik.com/automation/kofejnya: заявка → касса → первые чеки.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button type="button" onClick={handleDemoClick} className={primaryButtonClass}>
                Попробовать демо, как на лендинге
              </button>
              <button
                type="button"
                onClick={() => authSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className={secondaryButtonClass}
              >
                Создать организацию
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                <div className="text-2xl font-bold text-primary">24/7</div>
                <div>онлайн-терминал и смены без установки</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                <div className="text-2xl font-bold text-primary">1 день</div>
                <div>от заявки до пробитого чека</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                <div className="text-2xl font-bold text-primary">Без CRM</div>
                <div>лояльность и скидки внутри Yago</div>
              </div>
            </div>
          </div>

          <div className="relative space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-lg md:p-6">
            <div className="absolute inset-x-6 top-6 h-24 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 blur-2xl" />
            <div className="relative rounded-2xl border border-dashed border-primary/30 bg-white p-5 shadow-inner">
              <div className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-primary">
                <span>Терминал кофейни</span>
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] text-green-700">Онлайн</span>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-inner">
                  <div className="text-xs font-semibold text-slate-500">Заказ · Столы / Навынос</div>
                  <div className="mt-2 flex items-center justify-between text-base font-bold text-slate-900">
                    <span>Флэт уайт</span>
                    <span>210 ₽</span>
                  </div>
                  <p className="text-xs text-slate-500">Сироп Ваниль · Овсяное молоко</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-inner">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Смена</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">Кассир онлайн</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-800">
                    <div className="rounded-lg bg-white p-2 shadow-sm">
                      <div className="text-[11px] text-slate-500">Чеков сегодня</div>
                      <div className="text-lg font-semibold text-primary">46</div>
                    </div>
                    <div className="rounded-lg bg-white p-2 shadow-sm">
                      <div className="text-[11px] text-slate-500">Выручка</div>
                      <div className="text-lg font-semibold text-primary">38 200 ₽</div>
                    </div>
                    <div className="rounded-lg bg-white p-2 shadow-sm">
                      <div className="text-[11px] text-slate-500">Средний чек</div>
                      <div className="text-lg font-semibold text-primary">830 ₽</div>
                    </div>
                    <div className="rounded-lg bg-white p-2 shadow-sm">
                      <div className="text-[11px] text-slate-500">Безнал</div>
                      <div className="text-lg font-semibold text-primary">82%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative flex flex-col gap-3 rounded-2xl bg-primary/10 px-4 py-3 text-sm font-semibold text-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-center sm:text-left">Демо-организация заполнится автоматически — как на референсе</span>
              <Link to="/login" className="rounded-lg border border-primary/30 px-3 py-1 text-primary transition hover:bg-primary/10">
                Или войти
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.05)] md:p-6 lg:grid-cols-3">
          {[
            { icon: MapPin, title: 'Работа по всей России', text: 'Касса в браузере — подходит для островков, каворкингов и точек без стойки.' },
            { icon: TimerReset, title: 'Запуск за день', text: 'Повторяем сценарий restik: регистрация, эквайринг, первый чек в тот же день.' },
            { icon: Headset, title: 'Поддержка без менеджеров', text: 'Чаты и инструкции в /help, e-mail support@yagopos.ru, без звонков.' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {React.createElement(item.icon, { size: 22, className: 'mt-1 text-primary' })}
              <div>
                <div className="font-semibold text-slate-900">{item.title}</div>
                <p className="text-sm text-slate-600">{item.text}</p>
              </div>
            </div>
          ))}
        </section>

        <section id="advantages" className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] md:p-8">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Что входит</p>
              <h2 className="heading-font text-3xl font-semibold text-slate-900">Yago POS для кофейни</h2>
              <p className="text-base text-slate-600">Все основные блоки референса restik: касса, оплата, лояльность, отчёты и роли в одном окне.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <Sparkles size={18} className="text-primary" />
              <span>Кнопки крупные, радиус 12px, без лишних теней</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {advantages.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    {React.createElement(feature.icon, { size: 20, className: 'text-primary' })}
                    <span>{feature.title}</span>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">Включено</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="flow" className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] md:p-8 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Как подключиться</p>
            <h2 className="heading-font text-3xl font-semibold text-slate-900">Повторяем сценарий restik.com/automation</h2>
            <p className="text-base text-slate-600">Три шага, без звонков менеджеров. После шага 3 касса уже готова: авторизация, АТОЛ, эквайринг и лояльность.</p>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <ShieldCheck size={18} className="text-primary" />
              <span>Данные шифруются, токены храним только в localStorage пользователя.</span>
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-slate-900">Шаг {activeStep + 1} из {onboardingSteps.length}</div>
              <div className="flex gap-2 text-sm font-semibold text-primary">
                <button
                  type="button"
                  onClick={() => setActiveStep((prev) => (prev - 1 + onboardingSteps.length) % onboardingSteps.length)}
                  className="rounded-lg border border-slate-200 px-3 py-1 transition hover:border-primary/50 hover:text-primary"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStep((prev) => (prev + 1) % onboardingSteps.length)}
                  className="rounded-lg border border-slate-200 px-3 py-1 transition hover:border-primary/50 hover:text-primary"
                >
                  →
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-primary/25 bg-white p-5 text-sm text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-primary">{onboardingSteps[activeStep].title}</div>
              <div className="mt-2 text-lg font-bold text-slate-900">{onboardingSteps[activeStep].screenshotTitle}</div>
              <p className="mt-1 text-slate-600">{onboardingSteps[activeStep].description}</p>
              <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-4 text-center text-sm font-semibold text-primary">
                Карусель со скриншотами шага · интерфейс совпадает с демо
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              Вход и регистрация работают прямо на этой странице. Нужна ссылка для кассира? Используйте /login.
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] md:p-8 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Скриншоты и видео</p>
            <h2 className="heading-font text-3xl font-semibold text-slate-900">Интерфейсы Yago POS</h2>
            <p className="text-base text-slate-600">Касса, меню, склад и аналитика — посмотрите, что увидит кассир и владелец.</p>
          </div>
          <div className="grid gap-3 lg:col-span-2 lg:grid-cols-2">
            {screenshotGallery.map((shot) => (
              <div key={shot.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                <div className="text-lg font-semibold text-slate-900">{shot.title}</div>
                <p className="mt-1 text-sm text-slate-600">{shot.description}</p>
                <div className="mt-3 h-28 rounded-xl border border-dashed border-primary/30 bg-white text-center text-sm font-semibold text-primary">
                  Скриншот интерфейса
                </div>
              </div>
            ))}
            <div className="lg:col-span-2">
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                <div className="aspect-video w-full bg-slate-100">
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

        <section ref={authSectionRef} id="signup" className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] md:p-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Онбординг без менеджеров</p>
            <h2 className="heading-font text-3xl font-semibold text-slate-900">Заявка и вход как на restik</h2>
            <p className="text-base text-slate-600">
              Форма повторяет логику restik.com/automation/kofejnya: заявка → данные владельца → сразу вход в кассу. После создания организации вы можете настроить меню, сотрудников и права.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-slate-700">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">Без звонков</span>
              <span className="rounded-full bg-secondary/10 px-3 py-1 font-semibold text-slate-800">Демо-профиль заполняется</span>
              <span className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-700">Поддержка: support@yagopos.ru</span>
            </div>
          </div>
          <div className="grid gap-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm md:p-5">
              <div className="mb-4 space-y-1 text-center">
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">Шаг 1</div>
                <h3 className="heading-font text-2xl font-semibold text-slate-900">Создайте организацию</h3>
                <p className="text-sm text-slate-600">Владелец и базовые данные появятся автоматически.</p>
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
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-inner transition focus:border-primary"
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
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-inner transition focus:border-primary"
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
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-inner transition focus:border-primary"
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
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-inner transition focus:border-primary"
                    placeholder="Придумайте надёжный пароль"
                  />
                </div>
                <button
                  type="submit"
                  disabled={signupLoading}
                  className="flex h-12 w-full items-center justify-center rounded-[12px] bg-primary text-sm font-semibold text-slate-50 transition hover:bg-primary-dark disabled:opacity-70 disabled:hover:bg-primary"
                >
                  {signupLoading ? 'Создаем аккаунт...' : 'Создать организацию и войти'}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-dashed border-primary/30 bg-white px-5 py-4 text-sm shadow-sm">
              <div className="font-semibold text-slate-900">Есть доступ? Войдите сразу.</div>
              <form className="mt-3 space-y-3" onSubmit={handleLogin}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-inner transition focus:border-primary"
                    placeholder="Email"
                  />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-inner transition focus:border-primary"
                    placeholder="Пароль"
                  />
                </div>
                <input
                  type="text"
                  value={loginOrganizationId}
                  onChange={(event) => setLoginOrganizationId(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-inner transition focus:border-primary"
                  placeholder="ID организации (опционально)"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={loginRemember}
                      onChange={(event) => setLoginRemember(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 bg-white text-primary focus:ring-primary"
                    />
                    Запомнить меня
                  </label>
                  <Link to="/login" className="font-semibold text-primary hover:text-primary/80">
                    Отдельная страница входа
                  </Link>
                </div>
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="flex h-11 w-full items-center justify-center rounded-[12px] border border-primary bg-transparent text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-70 disabled:hover:bg-primary/10"
                >
                  {loginLoading ? 'Входим...' : 'Войти'}
                </button>
              </form>
            </div>
          </div>
        </section>

        <section id="news" className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] md:p-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Новости</p>
            <h2 className="heading-font text-3xl font-semibold text-slate-900">Новости и обновления</h2>
            <p className="text-base text-slate-600">Следите за релизами: changelog закреплён на лендинге и доступен по ссылке /news.</p>
            <Link to="/news" className={primaryButtonClass}>
              Перейти в /news
            </Link>
          </div>
          <div className="space-y-3">
            {newsItems.map((item) => (
              <div
                key={item.date}
                className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary">{item.date}</div>
                  <div className="text-base font-semibold text-slate-900">{item.title}</div>
                  <p className="text-sm text-slate-600">{item.description}</p>
                  <Link to={`/news/${item.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Читать полностью
                    <span>→</span>
                  </Link>
                </div>
                <span className="text-lg">🆕</span>
              </div>
            ))}
          </div>
        </section>

        <section id="instructions" className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] md:p-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Инструкции</p>
            <h2 className="heading-font text-3xl font-semibold text-slate-900">Готовые гайды внутри /help</h2>
            <p className="text-base text-slate-600">/docs оставили под Swagger API. Все инструкции вынесли в /help — открывайте статьи в CMS или markdown-файлах.</p>
            <Link to="/help" className={secondaryButtonClass}>
              Перейти к инструкциям
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {instructionLinks.map((item) => (
              <a
                key={item.title}
                href={item.href}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">Гайд</div>
                <div className="mt-1 text-base font-semibold text-slate-900">{item.title}</div>
                <p className="text-sm text-slate-600">Ссылка: {item.href}</p>
              </a>
            ))}
          </div>
        </section>

        <section id="blog" className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] md:p-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Блог</p>
            <h2 className="heading-font text-3xl font-semibold text-slate-900">Блог для владельцев кофеен</h2>
            <p className="text-base text-slate-600">Последние статьи о запуске, лояльности и управлении кофейней.</p>
            <Link to="/blog" className={primaryButtonClass}>
              Читать все статьи
            </Link>
          </div>
          <div className="grid gap-3">
            {blogPosts.slice(0, 3).map((post) => (
              <article key={post.slug} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-primary">{post.date}</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{post.title}</div>
                <p className="mt-1 text-sm text-slate-600">{post.excerpt}</p>
                <Link to={`/blog/${post.slug}`} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Читать
                  <span>→</span>
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-10 bg-white py-8 text-sm text-slate-600">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <div className="heading-font text-lg font-semibold text-slate-900">Yago POS</div>
            <div className="text-xs text-slate-500">Текущая версия: v0.8.1</div>
            <a href="mailto:support@yagopos.ru" className="text-primary">support@yagopos.ru</a>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-700">
            <Link to="/help" className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary">
              Инструкции
            </Link>
            <Link to="/blog" className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary">
              Блог
            </Link>
            <Link to="/news" className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary">
              Новости
            </Link>
            <a href="/rules" className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary">
              Правила
            </a>
            <a href="/policy" className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary">
              Политика
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
