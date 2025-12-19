import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore, type AuthUser } from '../store/auth';
import { useToast } from '../providers/ToastProvider';
import LandingHeader from '../components/ui/LandingHeader';

const featureGroups = [
  {
    title: 'Касса (интерфейс кассира)',
    items: [
      'выбор категории и товара',
      'добавление клиента к чеку',
      'выбор способа оплаты',
      'понятный интерфейс для работы за стойкой',
    ],
  },
  {
    title: 'Админ-панель',
    items: [
      'создание и редактирование меню',
      'категории и позиции',
      'ингредиенты в позициях',
      'расчёт себестоимости',
      'учёт остатков на складе',
      'базовая статистика по продажам',
    ],
  },
  {
    title: 'Лояльность',
    items: ['скидки и бонусы', 'начисление внутри системы'],
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

  const primaryButtonClass =
    'inline-flex items-center justify-center rounded-[12px] bg-primary px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-primary-dark hover:shadow-md';

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

  return (
    <div className="landing-shell min-h-screen">
      <LandingHeader onCtaClick={() => authSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} />

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-16 pt-10 sm:px-6 lg:gap-16">
        <section className="grid gap-8 rounded-[28px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.06)] ring-1 ring-slate-200 md:p-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Yago POS</p>
              <h1 className="heading-font text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                Yago POS — простая система для кофейни
              </h1>
            </div>
            <p className="text-lg text-slate-600">
              Касса и админ-панель в браузере: меню, склад, себестоимость, статистика и лояльность. Без лишней сложности —
              только то, что реально нужно в работе.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Сервис в активной разработке</div>
              <p className="mt-2">Сейчас Yago POS доступен бесплатно.</p>
              <p>Мы постепенно развиваем функционал и собираем обратную связь от реальных пользователей.</p>
              <p>В будущем сервис станет платным — об этом мы предупредим заранее.</p>
            </div>
            <button
              type="button"
              onClick={() => authSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className={primaryButtonClass}
            >
              Создать организацию
            </button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">Коротко о продукте</div>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-900">Касса в браузере</div>
                <p className="mt-1 text-sm text-slate-600">Понятный интерфейс, чтобы быстро принимать заказы у стойки.</p>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-900">Админ-панель владельца</div>
                <p className="mt-1 text-sm text-slate-600">Меню, склад и себестоимость собраны в одном месте.</p>
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-900">Лояльность внутри системы</div>
                <p className="mt-1 text-sm text-slate-600">Скидки и бонусы настраиваются без отдельного сервиса.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="rounded-[28px] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] ring-1 ring-slate-200 md:p-8">
          <h2 className="heading-font text-3xl font-semibold text-slate-900">Сделано на основе реальной кофейни</h2>
          <div className="mt-4 space-y-4 text-base text-slate-600">
            <p>Yago POS разрабатывается не «в вакууме». Основатель сервиса сам является владельцем кофейни, поэтому весь функционал проходит ежедневную проверку в реальной работе.</p>
            <p>Мы развиваем систему постепенно: добавляем новые возможности, улучшаем интерфейс и исправляем недочёты на основе практики, а не гипотез.</p>
            <p>Если вам нужен простой и понятный инструмент для кофейни — вы по адресу.</p>
          </div>
        </section>

        <section id="features" className="rounded-[28px] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] ring-1 ring-slate-200 md:p-8">
          <h2 className="heading-font text-3xl font-semibold text-slate-900">Что уже есть в системе</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {featureGroups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-lg font-semibold text-slate-900">{group.title}</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="progress" className="rounded-[28px] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] ring-1 ring-slate-200 md:p-8">
          <h2 className="heading-font text-3xl font-semibold text-slate-900">Система постоянно развивается</h2>
          <div className="mt-4 space-y-3 text-base text-slate-600">
            <p>Yago POS регулярно обновляется: появляются новые функции, улучшается интерфейс и логика работы.</p>
            <p>Развитие идёт постепенно, без резких изменений — с фокусом на удобство и реальные сценарии кофейни.</p>
          </div>
        </section>

        <section
          ref={authSectionRef}
          id="signup"
          className="rounded-[28px] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] ring-1 ring-slate-200 md:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Регистрация</p>
              <h2 className="heading-font text-3xl font-semibold text-slate-900">Создайте организацию</h2>
              <p className="text-base text-slate-600">
                Заполните форму — доступ владельца появится сразу. Если у вас уже есть данные, можно войти ниже.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-slate-700">
                <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">Без звонков</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-800">Доступ сразу после регистрации</span>
                <span className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-700">Работает в браузере</span>
              </div>
            </div>
            <div className="grid gap-5">
              <div className="rounded-2xl bg-slate-50/80 p-5 shadow-inner ring-1 ring-slate-200">
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
                    {signupLoading ? 'Создаем аккаунт...' : 'Создать организацию'}
                  </button>
                </form>
              </div>

              <div className="rounded-2xl bg-white px-5 py-4 text-sm shadow-[0_12px_40px_rgba(15,23,42,0.05)] ring-1 ring-primary/15">
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={loginOrganizationId}
                      onChange={(event) => setLoginOrganizationId(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-inner transition focus:border-primary"
                      placeholder="ID организации (необязательно)"
                    />
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={loginRemember}
                        onChange={(event) => setLoginRemember(event.target.checked)}
                        className="h-4 w-4 rounded border border-slate-300 text-primary focus:ring-primary"
                      />
                      Запомнить вход
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="flex h-11 w-full items-center justify-center rounded-[12px] border border-primary bg-white text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-70 disabled:hover:bg-primary/10"
                  >
                    {loginLoading ? 'Входим...' : 'Войти'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        <section id="feedback" className="rounded-[28px] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] ring-1 ring-slate-200 md:p-8">
          <h2 className="heading-font text-3xl font-semibold text-slate-900">Вопросы и предложения</h2>
          <div className="mt-4 space-y-3 text-base text-slate-600">
            <p>Если у вас есть вопросы, идеи или предложения по развитию сервиса — пишите напрямую в Telegram.</p>
            <p className="text-lg font-semibold text-slate-900">@makarov_egor</p>
            <p>Обратная связь напрямую влияет на развитие продукта.</p>
          </div>
        </section>
      </main>

      <footer className="bg-white/80 py-8 text-sm text-slate-600">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="space-y-1">
            <div className="heading-font text-lg font-semibold text-slate-900">Yago POS</div>
            <div className="text-xs text-slate-500">Текущая версия: v0.8.1</div>
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
