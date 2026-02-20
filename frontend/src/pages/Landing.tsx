import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import type { AuthUser } from '../store/auth';
import { useToast } from '../providers/ToastProvider';
import LandingHeader from '../components/ui/LandingHeader';
import { fetchContent, loadContent, subscribeContentUpdates } from '../lib/contentStore';
import { applySeo } from '../lib/seo';

const featureGroups = [
  {
    title: 'Касса (интерфейс кассира)',
    items: [
      'выбор категории и товара',
      'добавление клиента к чеку',
      'выбор способа оплаты',
      'простой поток продажи',
    ],
  },
  {
    title: 'Админ-панель',
    items: [
      'создание и редактирование меню',
      'ингредиенты в позициях',
      'расчёт себестоимости',
      'учёт остатков на складе',
      'базовая статистика продаж',
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
  const [content, setContent] = useState(loadContent());
  const { blogPosts, newsItems } = content;

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

  const primaryButtonClass =
    'inline-flex items-center justify-center rounded-[12px] bg-primary px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-primary-dark';

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
      title: 'Yago POS — система кассы и админ-панели для кофейни',
      description:
        'Yago POS — касса и админ-панель в браузере: меню, склад, себестоимость, статистика и лояльность для кофейни.',
      keywords: 'Yago POS, касса, POS, кофейня, учет, меню, склад',
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
    <div className="landing-shell min-h-screen bg-white">
      <LandingHeader onCtaClick={() => authSectionRef.current?.scrollIntoView({ behavior: 'smooth' })} />

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-10 sm:px-6 lg:gap-14">
        <section className="grid gap-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="order-1 space-y-6">
            <div>
              <h1 className="heading-font text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                Yago POS — простая система для кофейни
              </h1>
            </div>
            <p className="text-lg text-slate-600">
              Касса и админ-панель в браузере: меню, склад, себестоимость, статистика и лояльность. Без лишней сложности —
              только то, что реально нужно в работе.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
              <p>Сервис в активной разработке.</p>
              <p>Сечас Yago POS доступен бесплатно.</p>
              <p>В будущем сервис станет платным — об этом мы предупредим заранее.</p>
            </div>
            <a href="/login" className={primaryButtonClass}>
              Создать организацию
            </a>
          </div>
          <div className="order-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-8 w-32 rounded-xl bg-[#F3F4F6]" />
                <div className="h-8 w-20 rounded-xl bg-[#EDE9FE]" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-[#F3F4F6]" />
                  <div className="h-10 flex-1 rounded-2xl bg-[#F3F4F6]" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="h-20 rounded-2xl bg-[#F5F5F5]" />
                  <div className="h-20 rounded-2xl bg-[#F5F5F5]" />
                  <div className="h-20 rounded-2xl bg-[#F5F5F5]" />
                  <div className="h-20 rounded-2xl bg-[#F5F5F5]" />
                </div>
                <div className="mt-4 h-12 rounded-2xl bg-[#EDE9FE]" />
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <h2 className="heading-font text-3xl font-semibold text-slate-900">Сделано на основе реальной кофейни</h2>
          <div className="mt-4 space-y-4 text-base text-slate-600">
            <p>Yago POS разрабатывается на основе реальной практики.</p>
            <p>
              Основатель сервиса сам является владельцем кофейни, поэтому весь функционал ежедневно используется и
              проверяется в работе.
            </p>
            <p>Продукт развивается постепенно — от реальных задач, а не гипотез.</p>
          </div>
        </section>

        <section id="features" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <h2 className="heading-font text-3xl font-semibold text-slate-900">Что уже есть в системе</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {featureGroups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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

        <section id="blog" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="heading-font text-3xl font-semibold text-slate-900">Блог кофейни</h2>
            <Link to="/blog" className="text-sm font-semibold text-primary">
              Все статьи
            </Link>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {blogPosts.slice(0, 3).map((post) => (
              <article key={post.slug} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{post.date}</div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{post.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{post.excerpt}</p>
                <Link to={`/blog/${post.slug}`} className="mt-3 inline-flex text-sm font-semibold text-primary">
                  Читать статью
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section id="news" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="heading-font text-3xl font-semibold text-slate-900">Что нового</h2>
            <Link to="/news" className="text-sm font-semibold text-primary">
              Все новости
            </Link>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {newsItems.slice(0, 3).map((item) => (
              <article key={item.slug} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.date}</div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                <Link to={`/news/${item.slug}`} className="mt-3 inline-flex text-sm font-semibold text-primary">
                  Открыть новость
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section id="progress" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <h2 className="heading-font text-3xl font-semibold text-slate-900">Система постоянно развивается</h2>
          <div className="mt-4 space-y-3 text-base text-slate-600">
            <p>Мы регулярно улучшаем интерфейс и добавляем новые возможности.</p>
            <p>Приоритеты развития формируются на основе реального использования системы в кофейне.</p>
            <p>Без резких изменений и «ломающих» обновлений.</p>
          </div>
        </section>

        <section
          ref={authSectionRef}
          id="signup"
          className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8"
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-3">
              <h2 className="heading-font text-3xl font-semibold text-slate-900">Создать организацию</h2>
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
                  {signupLoading ? 'Создаем аккаунт...' : 'Создать организацию'}
                </button>
              </form>
            </div>
          </div>
        </section>

        <section id="feedback" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <h2 className="heading-font text-3xl font-semibold text-slate-900">Вопросы и предложения</h2>
          <div className="mt-4 space-y-3 text-base text-slate-600">
            <p>Если у вас есть вопросы или идеи по развитию сервиса — пишите напрямую в Telegram.</p>
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
          <div className="flex flex-wrap items-start gap-6 text-xs font-semibold text-slate-700">
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/help" className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary">
                Инструкции
              </Link>
              <Link to="/blog" className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary">
                Блог
              </Link>
              <Link to="/news" className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary">
                Новости
              </Link>
            </div>
            <div className="space-y-1">
              <div className="px-2 text-[11px] uppercase tracking-wide text-slate-500">Документы</div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="/license-agreement.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary"
                >
                  Оферта
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
                  href="/company-details.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-2 py-1 transition hover:bg-primary/10 hover:text-primary"
                >
                  Реквизиты
                </a>
              </div>
            </div>
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
