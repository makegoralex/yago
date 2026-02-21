import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import type { AuthUser } from '../store/auth';
import { useToast } from '../providers/ToastProvider';
import LandingHeader from '../components/ui/LandingHeader';
import { fetchContent, loadContent, subscribeContentUpdates } from '../lib/contentStore';
import { applySeo } from '../lib/seo';

const featureItems = [
  'Управление продажами и заказами',
  'Работа с меню и товарами',
  'Складской учёт',
  'Система скидок и акций',
  'Программы лояльности',
  'Отчёты и аналитика',
  'Облачный доступ с любого устройства',
];

const howToStartSteps = ['Зарегистрируйтесь', 'Настройте товары и кассу', 'Начните продажи'];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();
  const { notify } = useToast();
  const authSectionRef = useRef<HTMLDivElement | null>(null);
  const [content, setContent] = useState(loadContent());
  const { newsItems } = content;

  const [organizationName, setOrganizationName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [personalDataConsent, setPersonalDataConsent] = useState(false);
  const [cookieConsent, setCookieConsent] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  useEffect(() => {
    const consent = window.localStorage.getItem('landingCookieConsent') === 'accepted';
    setCookieConsent(consent);
  }, []);


  const extractTokens = (payload: any) => {
    const accessToken = payload?.accessToken ?? payload?.tokens?.accessToken;
    const refreshToken = payload?.refreshToken ?? payload?.tokens?.refreshToken;
    if (!accessToken || !refreshToken) {
      throw new Error('Tokens are missing in response');
    }
    return { accessToken, refreshToken };
  };

  const normalizeUser = (payloadUser: any): AuthUser => {
    const identifier = payloadUser?.id ?? payloadUser?._id;
    if (!identifier) {
      throw new Error('User identifier is missing');
    }

    return {
      _id: identifier,
      id: identifier,
      name: payloadUser?.name ?? 'Новый пользователь',
      email: payloadUser?.email ?? email,
      role: payloadUser?.role ?? 'owner',
      organizationId: payloadUser?.organizationId ?? payloadUser?.organization?.id,
    };
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!personalDataConsent) {
      notify({
        title: 'Нужно согласие на обработку данных',
        description: 'Подтвердите согласие на обработку персональных данных, чтобы завершить регистрацию.',
        type: 'error',
      });
      return;
    }

    setSignupLoading(true);
    try {
      const response = await api.post('/api/organizations/public/create', {
        name: organizationName,
        owner: { name: ownerName, email, password },
      });

      const rawPayload = response.data?.data ?? response.data;
      const tokens = extractTokens(rawPayload);
      const payloadUser = rawPayload?.owner ?? rawPayload?.user;
      const user = normalizeUser(payloadUser);
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

  const acceptCookieConsent = () => {
    window.localStorage.setItem('landingCookieConsent', 'accepted');
    setCookieConsent(true);
  };

  useEffect(() => {
    applySeo({
      title: 'Yago POS — облачная POS-система для кафе и малого бизнеса',
      description:
        'Продажи, склад, аналитика и лояльность в одном сервисе. Работает с кассами пользователя, включая устройства Эвотор.',
      keywords: 'Yago POS, POS, кафе, малый бизнес, касса, эвотор, склад, аналитика, лояльность',
    });
  }, []);

  useEffect(() => subscribeContentUpdates(setContent), []);

  useEffect(() => {
    let isActive = true;
    fetchContent().then((nextContent) => {
      if (isActive) setContent(nextContent);
    });
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="landing-shell min-h-screen bg-slate-50">
      <LandingHeader
        onCtaClick={() => authSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
        ctaLabel="Попробовать бесплатно 14 дней"
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:gap-8 lg:py-10">
        <section className="grid gap-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-primary p-6 text-white shadow-xl md:grid-cols-[1.05fr_0.95fr] md:p-8 lg:p-10">
          <div className="space-y-5">
            <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              SaaS для кафе и малого бизнеса
            </p>
            <h1 className="heading-font text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
              Облачная POS-система для кафе и малого бизнеса
            </h1>
            <p className="max-w-2xl text-base text-white/85 sm:text-lg">
              Продажи, склад, аналитика и лояльность в одном сервисе. Работает с кассами пользователя.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => authSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Попробовать бесплатно 14 дней
              </button>
              <a
                href="#pricing"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/40 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Посмотреть тарифы
              </a>
            </div>
            <p className="text-sm text-white/80">Без установки. Без долгосрочных обязательств.</p>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur sm:p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-8 w-32 rounded-xl bg-white/25" />
                <div className="h-8 w-24 rounded-xl bg-white/35" />
              </div>
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-16 rounded-xl bg-white/20" />
                  <div className="h-16 rounded-xl bg-white/20" />
                  <div className="h-16 rounded-xl bg-white/20" />
                  <div className="h-16 rounded-xl bg-white/20" />
                </div>
                <div className="mt-3 h-10 rounded-xl bg-white/35" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-8 rounded-lg bg-white/20" />
                <div className="h-8 rounded-lg bg-white/20" />
                <div className="h-8 rounded-lg bg-white/20" />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <h2 className="heading-font text-3xl font-semibold text-slate-900">Возможности</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featureItems.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                <p className="text-sm font-medium text-slate-700">{item}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-slate-500">
            Фискализация осуществляется через кассовое оборудование пользователя.
          </p>
        </section>

        <section id="integrations" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <h2 className="heading-font text-3xl font-semibold text-slate-900">Интеграции</h2>
          <p className="mt-4 text-base text-slate-600">
            Сервис интегрируется с кассовыми решениями пользователя, включая устройства Эвотор.
          </p>
        </section>

        <section id="pricing" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <h2 className="heading-font text-3xl font-semibold text-slate-900">Тарифы</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Месячный тариф</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">1 490 ₽ / месяц</p>
              <p className="mt-2 text-sm text-slate-600">НДС включён · Автоматическое продление</p>
              <button
                type="button"
                onClick={() => authSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-dark"
              >
                Начать 14 дней бесплатно
              </button>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">Годовой тариф</p>
                <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Экономия 33% · 5 880 ₽ в год
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-900">12 000 ₽ / год</p>
              <p className="mt-2 text-sm text-slate-600">НДС включён</p>
              <p className="mt-3 text-sm text-slate-600">
                Оплата по счёту. Запросить у менеджера:{' '}
                <a href="https://t.me/makarov_egor" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary">
                  @makarov_egor
                </a>
              </p>
              <a
                href="https://t.me/makarov_egor"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:border-primary hover:text-primary"
              >
                Запросить счёт
              </a>
            </article>
          </div>
        </section>

        <section id="news" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="heading-font text-3xl font-semibold text-slate-900">Новости продукта</h2>
              <p className="mt-2 text-sm text-slate-500">Обновляется через кабинет суперадмина.</p>
            </div>
            <Link to="/news" className="text-sm font-semibold text-primary">
              Все новости
            </Link>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {newsItems.slice(0, 3).map((item) => (
              <article
                key={item.slug}
                className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-5 shadow-sm"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.date}</div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                <Link to={`/news/${item.slug}`} className="mt-4 inline-flex text-sm font-semibold text-primary">
                  Открыть новость
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section id="how-to-start" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <h2 className="heading-font text-3xl font-semibold text-slate-900">Как начать</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {howToStartSteps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <p className="mt-3 text-base font-medium text-slate-800">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          ref={authSectionRef}
          id="signup"
          className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-3">
              <h2 className="heading-font text-3xl font-semibold text-slate-900">Запустить демо за 2 минуты</h2>
              <p className="text-base text-slate-600">
                Заполните короткую форму — доступ владельца появится сразу после регистрации.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition focus:border-primary"
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
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition focus:border-primary"
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
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition focus:border-primary"
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
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition focus:border-primary"
                    placeholder="Придумайте надёжный пароль"
                  />
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={personalDataConsent}
                    onChange={(event) => setPersonalDataConsent(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    required
                  />
                  <span>
                    Я согласен на обработку персональных данных и принимаю условия{' '}
                    <a
                      href="/privacy-policy.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary hover:text-primary-dark"
                    >
                      политики обработки персональных данных
                    </a>
                    .
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={signupLoading}
                  className="flex h-12 w-full items-center justify-center rounded-[12px] bg-primary text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:opacity-70"
                >
                  {signupLoading ? 'Создаем аккаунт...' : 'Попробовать бесплатно 14 дней'}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-sm text-slate-600">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-2">
            <div className="heading-font text-lg font-semibold text-slate-900">Yago POS</div>
            <p>ООО «Джемьюн»</p>
            <p>ИНН 5800012413</p>
            <p>ОГРН 1255800000554</p>
            <p>Тел.: +7 900 317-35-57</p>
            <p>Email: makegoralex@yandex.ru</p>
          </div>
          <div className="grid gap-3 text-sm font-semibold text-slate-700 sm:grid-cols-2">
            <a
              href="/license-agreement.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary"
            >
              Публичная оферта
            </a>
            <a
              href="/privacy-policy.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary"
            >
              Политика обработки персональных данных
            </a>
            <a
              href="/personal-data-consent.html"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary"
            >
              Согласие на обработку персональных данных
            </a>
            <a
              href="/company-details.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary"
            >
              Реквизиты
            </a>
          </div>
        </div>
      </footer>

      {!cookieConsent && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Мы используем cookie, чтобы сайт работал корректно и помогал улучшать сервис. Продолжая пользоваться сайтом,
              вы соглашаетесь с использованием cookie.
            </p>
            <button
              type="button"
              onClick={acceptCookieConsent}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Принять
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
