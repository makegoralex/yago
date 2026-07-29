import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  ChevronRight,
  ClipboardList,
  Cloud,
  Coffee,
  CreditCard,
  Gift,
  Headphones,
  MonitorSmartphone,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  TabletSmartphone,
  UsersRound,
  WalletCards,
  Warehouse,
  Zap,
} from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import type { AuthUser } from '../store/auth';
import { useToast } from '../providers/ToastProvider';
import LandingHeader from '../components/ui/LandingHeader';
import {
  MobileOwnerPreview,
  PosPreview,
  ProductPreviewSwitcher,
  type ProductPreviewKey,
} from '../components/landing/ProductPreviews';
import { fetchContent, loadContent, subscribeContentUpdates } from '../lib/contentStore';
import { applySeo } from '../lib/seo';
import { SITE_URL, tools } from '../features/tools/toolRegistry';

const monthlyPrice = 2050;
const yearlyPrice = 20500;
const yearlyRegular = monthlyPrice * 12;
const yearlySavings = yearlyRegular - yearlyPrice;
const yearlySavingsPercent = Math.round((yearlySavings / yearlyRegular) * 100);

const outcomes = [
  {
    icon: ReceiptText,
    title: 'Продавать без очередей',
    description: 'Понятная касса, быстрый поиск, модификаторы, разные типы заказа и удобная оплата.',
    accent: 'bg-amber-50 text-amber-700',
  },
  {
    icon: Warehouse,
    title: 'Знать реальную себестоимость',
    description: 'Техкарты связывают продажи с ингредиентами, остатками и стоимостью каждой позиции.',
    accent: 'bg-emerald-50 text-emerald-700',
  },
  {
    icon: BarChart3,
    title: 'Принимать решения по цифрам',
    description: 'Выручка, средний чек, топ товаров, смены и клиенты собраны в одной панели.',
    accent: 'bg-violet-50 text-violet-700',
  },
];

const capabilityGroups = [
  {
    eyebrow: 'Касса и заказы',
    title: 'Бариста видит только то, что нужно для продажи',
    description:
      'Категории и товары находятся за несколько касаний. В заказе доступны размеры, добавки, скидки, клиент и способ обслуживания — без перегруженных экранов.',
    items: ['Заказы в заведении, с собой и на доставку', 'Модификаторы и варианты размера', 'Наличные и безналичная оплата', 'История чеков и возвраты'],
    icon: CreditCard,
  },
  {
    eyebrow: 'Меню, техкарты и склад',
    title: 'Продажа сразу превращается в понятный учёт',
    description:
      'Добавьте рецептуру один раз: Yago рассчитает себестоимость, поможет контролировать ингредиенты, поступления и инвентаризации.',
    items: ['Ингредиенты и технологические карты', 'Автоматический расчёт себестоимости', 'Поступления, списания и инвентаризации', 'Поставщики и несколько складов'],
    icon: ClipboardList,
  },
  {
    eyebrow: 'Гости и команда',
    title: 'Лояльность, персонал и кухня работают как одна система',
    description:
      'У владельца — контроль, у кассира — быстрые продажи, у кухни — очередь заказов. Гости получают баллы, скидки и сертификаты.',
    items: ['Клиентская база и баллы', 'Скидки, акции и сертификаты', 'Сотрудники и роли доступа', 'Экран кухни и экран готовности'],
    icon: UsersRound,
  },
];

const faqItems = [
  {
    question: 'Подойдёт ли Yago для небольшой кофейни?',
    answer:
      'Да. Yago рассчитан на независимые кофейни, форматы coffee-to-go и небольшие кафе, которым нужны касса, меню, склад, себестоимость, сотрудники и лояльность в одном сервисе.',
  },
  {
    question: 'Какое кассовое оборудование поддерживается?',
    answer:
      'Yago работает с кассами Эвотор и АТОЛ. Фискализация выполняется через кассовое оборудование пользователя, а сама POS-система может работать на планшете или компьютере.',
  },
  {
    question: 'Нужно ли устанавливать программу?',
    answer:
      'Основные экраны Yago работают в браузере. Для начала достаточно устройства с интернетом; требования к интеграции зависят от выбранной кассы.',
  },
  {
    question: 'Можно ли сначала попробовать бесплатно?',
    answer:
      'Да. После регистрации доступен пробный период 14 дней. Банковская карта для старта не нужна, базовые категории создаются автоматически.',
  },
  {
    question: 'Есть ли складской учёт и техкарты?',
    answer:
      'Да. В Yago можно вести ингредиенты, рецептуры, себестоимость продуктов, склады, поступления, поставщиков и инвентаризации.',
  },
];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setSession } = useAuthStore();
  const { notify } = useToast();
  const authSectionRef = useRef<HTMLDivElement | null>(null);
  const [content, setContent] = useState(loadContent());
  const [activePreview, setActivePreview] = useState<ProductPreviewKey>('pos');
  const { newsItems } = content;

  const [organizationName, setOrganizationName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [personalDataConsent, setPersonalDataConsent] = useState(false);
  const [cookieConsent, setCookieConsent] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  const scrollToSignup = () => authSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  useEffect(() => {
    const consent = window.localStorage.getItem('landingCookieConsent') === 'accepted';
    setCookieConsent(consent);
  }, []);

  const extractTokens = (payload: any) => {
    const accessToken = payload?.accessToken ?? payload?.tokens?.accessToken;
    const refreshToken = payload?.refreshToken ?? payload?.tokens?.refreshToken;
    if (!accessToken || !refreshToken) throw new Error('Tokens are missing in response');
    return { accessToken, refreshToken };
  };

  const normalizeUser = (payloadUser: any): AuthUser => {
    const identifier = payloadUser?.id ?? payloadUser?._id;
    if (!identifier) throw new Error('User identifier is missing');
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
      title: 'Yago — POS-система для кофейни: касса, склад, учёт',
      description:
        'Облачная POS-система для кофейни и кафе: касса, меню, техкарты, склад, себестоимость, аналитика и лояльность. Эвотор и АТОЛ. 14 дней бесплатно.',
      keywords:
        'POS система для кофейни, программа для кофейни, автоматизация кофейни, касса для кафе, складской учет кафе, техкарты, Эвотор, АТОЛ',
      canonicalUrl: `${SITE_URL}/`,
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Yago App',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web, Android, iOS',
          description: 'Облачная POS-система, складской учёт и лояльность для кофеен и небольших кафе.',
          url: `${SITE_URL}/`,
          inLanguage: 'ru-RU',
          featureList: [
            'Касса и управление заказами',
            'Меню, модификаторы и техкарты',
            'Складской учёт и себестоимость',
            'Отчёты и аналитика',
            'Программа лояльности',
            'Интеграции с Эвотор и АТОЛ',
          ],
          offers: [
            { '@type': 'Offer', price: monthlyPrice, priceCurrency: 'RUB', category: 'Месячная подписка' },
            { '@type': 'Offer', price: yearlyPrice, priceCurrency: 'RUB', category: 'Годовая подписка' },
          ],
          provider: { '@type': 'Organization', name: 'ООО «Джемьюн»', url: `${SITE_URL}/` },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqItems.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Yago App',
          legalName: 'ООО «Джемьюн»',
          url: `${SITE_URL}/`,
          email: 'makegoralex@yandex.ru',
          telephone: '+7 900 317-35-57',
        },
      ],
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
    <div className="landing-shell min-h-screen overflow-hidden bg-[#fbfaf7] text-slate-950">
      <LandingHeader onCtaClick={scrollToSignup} ctaLabel="Попробовать бесплатно" />

      <main>
        <section className="relative border-b border-slate-200/80">
          <div className="landing-orb landing-orb-one" />
          <div className="landing-orb landing-orb-two" />
          <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-20">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-violet-700 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> POS и учёт для независимых кофеен
              </div>
              <h1 className="mt-6 max-w-3xl heading-font text-[42px] font-semibold leading-[1.03] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-[68px]">
                Кофейня под контролем. <span className="text-violet-600">От кассы до склада.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                Облачная POS-система для кофейни: касса, меню, техкарты, склад, себестоимость, аналитика и лояльность — в одном понятном сервисе.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={scrollToSignup} className="landing-primary-button inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-violet-700">
                  Попробовать 14 дней бесплатно <ArrowRight className="h-4 w-4" />
                </button>
                <a href="#product" className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 hover:border-slate-400 hover:text-slate-950">
                  Посмотреть интерфейс <ChevronRight className="h-4 w-4" />
                </a>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> Без банковской карты</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> Работает в браузере</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> Поможем с запуском</span>
              </div>
            </div>
            <div className="relative z-10 lg:-mr-20">
              <div className="landing-preview-glow absolute inset-8 rounded-full bg-violet-300/30 blur-3xl" />
              <div className="relative origin-center lg:scale-[1.02]"><PosPreview hero /></div>
              <div className="landing-float-card landing-shadow absolute -bottom-6 left-4 hidden items-center gap-3 rounded-2xl border border-white/80 bg-white/95 p-3 backdrop-blur sm:flex lg:-left-8">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><BadgeCheck className="h-5 w-5" /></div>
                <div><div className="text-xs font-bold text-slate-800">Смена открыта</div><div className="text-[10px] text-slate-400">Касса готова к продажам</div></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200/80 bg-white">
          <div className="mx-auto grid max-w-7xl gap-4 px-4 py-7 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {[
              [TabletSmartphone, 'Любое устройство', 'Планшет или компьютер'],
              [CreditCard, 'Эвотор и АТОЛ', 'Интеграция с кассами'],
              [Cloud, 'Облачный доступ', 'Данные всегда под рукой'],
              [Headphones, 'Помощь на старте', 'Не останетесь один на один'],
            ].map(([Icon, title, text]) => {
              const Glyph = Icon as React.ComponentType<{ className?: string }>;
              return (
                <div key={title as string} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700"><Glyph className="h-4.5 w-4.5" /></div>
                  <div><div className="text-sm font-bold text-slate-800">{title as string}</div><div className="mt-0.5 text-xs text-slate-400">{text as string}</div></div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Не набор функций, а рабочий процесс</p>
            <h2 className="mt-4 heading-font text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl">Всё, что происходит в кофейне, связано между собой</h2>
            <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">Бариста продаёт, склад обновляется, а владелец сразу видит результат — без таблиц и ручного переноса данных.</p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {outcomes.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="landing-card rounded-[26px] border border-slate-200 bg-white p-6 sm:p-7">
                  <div className={`grid h-12 w-12 place-items-center rounded-2xl ${item.accent}`}><Icon className="h-5 w-5" /></div>
                  <h3 className="mt-6 text-xl font-bold tracking-[-0.02em] text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="product" className="border-y border-slate-200/80 bg-[#f3f0ff]">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="grid gap-8 lg:grid-cols-[0.66fr_1fr] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Посмотрите Yago изнутри</p>
                <h2 className="mt-4 heading-font text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl">Понятно бариста. Полезно владельцу.</h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-slate-600 lg:justify-self-end">Переключайтесь между ключевыми экранами. Интерфейс повторяет реальные сценарии Yago: продажа, контроль показателей и складской учёт.</p>
            </div>
            <div className="mt-10"><ProductPreviewSwitcher active={activePreview} onChange={setActivePreview} /></div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="space-y-20 lg:space-y-28">
            {capabilityGroups.map((group, index) => {
              const Icon = group.icon;
              const visual = index === 0 ? (
                <div className="rounded-[30px] bg-gradient-to-br from-amber-100 via-orange-50 to-white p-4 sm:p-7"><PosPreview /></div>
              ) : index === 1 ? (
                <div className="rounded-[30px] bg-gradient-to-br from-emerald-100 via-teal-50 to-white p-6 sm:p-9">
                  <div className="landing-shadow overflow-hidden rounded-2xl border border-emerald-100 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><b className="text-xs text-slate-800">Техкарта · Капучино</b><div className="text-[9px] text-slate-400">Автоматический расчёт</div></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-bold text-emerald-700">Себестоимость 29%</span></div>
                    <div className="p-4">
                      <div className="grid grid-cols-[1.3fr_0.7fr_0.8fr] gap-2 text-[8px] font-bold uppercase text-slate-400"><span>Ингредиент</span><span>Норма</span><span>Стоимость</span></div>
                      {[['Эспрессо', '18 г', '28,40 ₽'], ['Молоко', '220 мл', '21,12 ₽'], ['Стакан + крышка', '1 шт.', '12,50 ₽']].map((row) => <div key={row[0]} className="mt-2 grid grid-cols-[1.3fr_0.7fr_0.8fr] gap-2 rounded-lg bg-slate-50 px-2 py-2.5 text-[9px] text-slate-600"><b>{row[0]}</b><span>{row[1]}</span><span>{row[2]}</span></div>)}
                      <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-950 p-3 text-white"><div className="text-[8px] text-white/50">Себестоимость</div><div className="mt-1 text-base font-bold">62,02 ₽</div></div><div className="rounded-xl bg-violet-600 p-3 text-white"><div className="text-[8px] text-white/60">Цена продажи</div><div className="mt-1 text-base font-bold">250 ₽</div></div></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[30px] bg-gradient-to-br from-violet-100 via-fuchsia-50 to-white p-8"><MobileOwnerPreview /></div>
              );

              return (
                <article key={group.title} className={`grid gap-10 lg:grid-cols-2 lg:items-center ${index % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                  <div>{visual}</div>
                  <div className="lg:px-8">
                    <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-600"><Icon className="h-4 w-4" /> {group.eyebrow}</div>
                    <h2 className="mt-4 heading-font text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">{group.title}</h2>
                    <p className="mt-5 text-base leading-7 text-slate-600">{group.description}</p>
                    <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                      {group.items.map((item) => <li key={item} className="flex items-start gap-2 text-sm font-semibold leading-5 text-slate-700"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Check className="h-3 w-3" /></span>{item}</li>)}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bg-slate-950 text-white">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8 lg:py-28">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Одна система для всей команды</p>
              <h2 className="mt-4 heading-font text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">Каждому — свой экран. Владельцу — общая картина.</h2>
              <p className="mt-5 text-base leading-7 text-slate-300">Разделяйте доступ по ролям и не перегружайте сотрудников лишними функциями.</p>
              <button type="button" onClick={scrollToSignup} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 hover:bg-violet-50">Запустить свою кофейню <ArrowRight className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [Store, 'Владелец', 'Выручка, себестоимость, склад, команда и настройки.'],
                [CreditCard, 'Кассир', 'Быстрые продажи, гости, оплаты и история чеков.'],
                [Coffee, 'Кухня', 'Очередь заказов и понятные статусы приготовления.'],
                [UsersRound, 'Гость', 'Баллы, скидки, сертификаты и готовность заказа.'],
              ].map(([Icon, title, text]) => {
                const Glyph = Icon as React.ComponentType<{ className?: string }>;
                return <article key={title as string} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5"><Glyph className="h-5 w-5 text-violet-300" /><h3 className="mt-5 text-lg font-bold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text as string}</p></article>;
              })}
            </div>
          </div>
        </section>

        <section id="integrations" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Интеграции</p>
              <h2 className="mt-4 heading-font text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl">Подключается к кассе, которая уже есть</h2>
              <p className="mt-5 text-base leading-7 text-slate-600">Yago работает с кассовым оборудованием Эвотор и АТОЛ. Вы сохраняете привычную фискализацию и получаете современный интерфейс и облачный учёт.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="landing-card rounded-[26px] border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between"><div className="text-2xl font-black tracking-tight text-slate-900">ЭВОТОР</div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Поддерживается</span></div>
                <p className="mt-5 text-sm leading-6 text-slate-600">Касса Эвотор с прошивкой 5+, планшет Android или iOS и стабильный Wi‑Fi.</p>
                <a href="https://market.evotor.ru/store/apps/c2c3cb64-70d6-4d54-9450-0a4efd302ea3" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-violet-700">В Эвотор Маркете <ArrowRight className="h-3.5 w-3.5" /></a>
              </article>
              <article className="landing-card rounded-[26px] border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between"><div className="text-2xl font-black tracking-tight text-slate-900">АТОЛ</div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">Поддерживается</span></div>
                <p className="mt-5 text-sm leading-6 text-slate-600">Планшет на Android, подключение к Wi‑Fi и прямая оплата подписки Yago.</p>
                <button type="button" onClick={scrollToSignup} className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-violet-700">Попробовать подключение <ArrowRight className="h-3.5 w-3.5" /></button>
              </article>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Запуск без большого внедрения</p><h2 className="mt-4 heading-font text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl">От регистрации до первой продажи — три понятных шага</h2></div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                ['01', 'Создайте кофейню', 'Зарегистрируйтесь — базовые категории и кабинет владельца появятся автоматически.', MonitorSmartphone],
                ['02', 'Добавьте меню и кассу', 'Настройте товары, размеры, добавки и подключите Эвотор или АТОЛ.', PackageCheck],
                ['03', 'Начните продавать', 'Откройте смену, принимайте заказы и смотрите результат в аналитике.', Zap],
              ].map(([number, title, text, Icon]) => {
                const Glyph = Icon as React.ComponentType<{ className?: string }>;
                return <article key={number as string} className="relative rounded-[26px] border border-slate-200 bg-[#fbfaf7] p-6"><div className="flex items-center justify-between"><span className="text-xs font-black tracking-[0.2em] text-violet-600">{number as string}</span><Glyph className="h-5 w-5 text-slate-400" /></div><h3 className="mt-8 text-xl font-bold text-slate-900">{title as string}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text as string}</p></article>;
              })}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Прозрачный тариф</p>
              <h2 className="mt-4 heading-font text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl">Все основные возможности уже включены</h2>
              <p className="mt-5 text-base leading-7 text-slate-600">Сначала 14 дней бесплатно. Затем выберите помесячную оплату или годовой тариф со скидкой.</p>
              <div className="mt-7 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><span>Для Эвотор подписка оплачивается через Эвотор Маркет. Для АТОЛ — напрямую через Yago.</span></div>
            </div>
            <div className="landing-shadow overflow-hidden rounded-[30px] border border-violet-200 bg-white">
              <div className="grid md:grid-cols-2">
                <article className="p-7 sm:p-8">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Ежемесячно</p>
                  <p className="mt-4 heading-font text-4xl font-semibold tracking-tight text-slate-950">{monthlyPrice.toLocaleString('ru-RU')} ₽</p>
                  <p className="mt-1 text-sm text-slate-500">в месяц · НДС включён</p>
                  <button type="button" onClick={scrollToSignup} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800 hover:border-violet-400 hover:text-violet-700">Начать бесплатно <ArrowRight className="h-4 w-4" /></button>
                </article>
                <article className="relative bg-slate-950 p-7 text-white sm:p-8">
                  <div className="absolute right-5 top-5 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-black text-emerald-950">−{yearlySavingsPercent}%</div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">На год</p>
                  <p className="mt-4 heading-font text-4xl font-semibold tracking-tight">{yearlyPrice.toLocaleString('ru-RU')} ₽</p>
                  <p className="mt-1 text-sm text-slate-400">за год · экономия {yearlySavings.toLocaleString('ru-RU')} ₽</p>
                  <a href="https://t.me/makarov_egor" target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-bold text-white hover:bg-violet-400">Запросить счёт <ArrowRight className="h-4 w-4" /></a>
                </article>
              </div>
              <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-7 py-5 text-xs font-semibold text-slate-600 sm:grid-cols-3">
                <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /> Все модули</span>
                <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /> Обновления</span>
                <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /> Поддержка</span>
              </div>
            </div>
          </div>
        </section>

        <section id="tools" className="border-y border-slate-200 bg-gradient-to-br from-violet-50 via-white to-emerald-50">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Полезно ещё до покупки</p><h2 className="mt-4 heading-font text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl">Бесплатные инструменты для владельца кофейни</h2><p className="mt-4 text-base leading-7 text-slate-600">Посчитайте экономику, подготовьте техкарты и разберите ассортимент — без регистрации и передачи данных.</p></div>
              <Link to="/tools" className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-violet-700">Все инструменты <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool, index) => (
                <Link key={tool.slug} to={tool.path} className="landing-card group rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{tool.estimatedTime}</span><span className={`grid h-8 w-8 place-items-center rounded-lg ${index % 3 === 0 ? 'bg-amber-50 text-amber-700' : index % 3 === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'}`}><WalletCards className="h-4 w-4" /></span></div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900 group-hover:text-violet-700">{tool.shortTitle}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{tool.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.65fr_1.35fr] lg:px-8 lg:py-28">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Вопросы и ответы</p><h2 className="mt-4 heading-font text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl">Перед началом работы</h2><p className="mt-5 text-base leading-7 text-slate-600">Если вашего вопроса нет в списке, напишите нам — поможем оценить подключение под вашу кассу и процессы.</p><a href="https://t.me/makarov_egor" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-violet-700">Задать вопрос <ArrowRight className="h-4 w-4" /></a></div>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {faqItems.map((item, index) => <details key={item.question} className="landing-faq group py-5" open={index === 0}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold text-slate-900"><span>{item.question}</span><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-lg font-normal text-slate-500 group-open:rotate-45">+</span></summary><p className="max-w-2xl pt-4 text-sm leading-6 text-slate-600">{item.answer}</p></details>)}
          </div>
        </section>

        {newsItems.length > 0 ? (
          <section id="news" className="border-t border-slate-200 bg-white">
            <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Развитие продукта</p><h2 className="mt-3 heading-font text-3xl font-semibold text-slate-950">Что нового в Yago</h2></div><Link to="/news" className="text-sm font-bold text-violet-700">Все новости →</Link></div>
              <div className="mt-8 grid gap-4 lg:grid-cols-3">{newsItems.slice(0, 3).map((item) => <Link key={item.slug} to={`/news/${item.slug}`} className="rounded-2xl border border-slate-200 bg-[#fbfaf7] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Обновление</p><h3 className="mt-3 text-lg font-bold text-slate-900">{item.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{item.description}</p></Link>)}</div>
            </div>
          </section>
        ) : null}

        <section id="signup" ref={authSectionRef} className="bg-violet-600 text-white scroll-mt-24">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-violet-100"><Gift className="h-3.5 w-3.5" /> 14 дней бесплатно</div>
              <h2 className="mt-5 heading-font text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Посмотрите, как Yago работает именно для вашей кофейни</h2>
              <p className="mt-5 text-base leading-7 text-violet-100">Создадим кабинет сразу после регистрации. Без звонка, банковской карты и долгосрочных обязательств.</p>
              <div className="mt-7 grid gap-3 text-sm font-semibold text-white/85 sm:grid-cols-2"><span className="flex items-center gap-2"><Check className="h-4 w-4" /> Базовое меню уже внутри</span><span className="flex items-center gap-2"><Check className="h-4 w-4" /> Полный доступ к функциям</span><span className="flex items-center gap-2"><Check className="h-4 w-4" /> Можно отменить в любой момент</span><span className="flex items-center gap-2"><Check className="h-4 w-4" /> Помощь с подключением</span></div>
            </div>
            <div className="landing-shadow rounded-[28px] bg-white p-5 text-slate-900 sm:p-7">
              <form className="space-y-4" onSubmit={handleSignup}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="block text-xs font-bold text-slate-700" htmlFor="organizationName">Название кофейни</label><input id="organizationName" required value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-violet-500" placeholder="Кофе на районе" /></div>
                  <div><label className="block text-xs font-bold text-slate-700" htmlFor="ownerName">Ваше имя</label><input id="ownerName" required value={ownerName} onChange={(event) => setOwnerName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-violet-500" placeholder="Александр" /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="block text-xs font-bold text-slate-700" htmlFor="ownerEmail">Email</label><input id="ownerEmail" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-violet-500" placeholder="owner@coffee.ru" /></div>
                  <div><label className="block text-xs font-bold text-slate-700" htmlFor="ownerPassword">Пароль</label><input id="ownerPassword" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-violet-500" placeholder="Минимум 8 символов" /></div>
                </div>
                <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={personalDataConsent} onChange={(event) => setPersonalDataConsent(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-600" required /><span>Я согласен на обработку персональных данных и принимаю условия <a href="/privacy-policy.pdf" target="_blank" rel="noopener noreferrer" className="font-bold text-violet-700">политики обработки персональных данных</a>.</span></label>
                <button type="submit" disabled={signupLoading} className="landing-primary-button flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-70">{signupLoading ? 'Создаём аккаунт…' : 'Создать аккаунт бесплатно'} {!signupLoading ? <ArrowRight className="h-4 w-4" /> : null}</button>
                <p className="text-center text-[11px] text-slate-400">Нажимая кнопку, вы запускаете бесплатный пробный период на 14 дней.</p>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 py-12 text-sm text-slate-400">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 border-b border-white/10 pb-10 md:grid-cols-[1.3fr_0.7fr_0.7fr]">
            <div><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500 text-sm font-black text-white">YG</div><div><div className="heading-font text-lg font-semibold text-white">Yago App</div><div className="text-xs text-slate-500">POS и учёт для кофейни</div></div></div><p className="mt-5 max-w-sm text-sm leading-6">Касса, меню, склад, себестоимость, аналитика и лояльность в одном облачном сервисе.</p></div>
            <div><div className="text-xs font-bold uppercase tracking-[0.16em] text-white">Продукт</div><div className="mt-4 grid gap-3"><a href="#features" className="hover:text-white">Возможности</a><a href="#integrations" className="hover:text-white">Интеграции</a><a href="#pricing" className="hover:text-white">Тарифы</a><Link to="/tools" className="hover:text-white">Инструменты</Link><Link to="/login" className="hover:text-white">Вход</Link></div></div>
            <div><div className="text-xs font-bold uppercase tracking-[0.16em] text-white">Связаться</div><div className="mt-4 grid gap-3"><a href="tel:+79003173557" className="hover:text-white">+7 900 317-35-57</a><a href="mailto:makegoralex@yandex.ru" className="hover:text-white">makegoralex@yandex.ru</a><a href="https://t.me/makarov_egor" target="_blank" rel="noopener noreferrer" className="hover:text-white">Telegram</a></div></div>
          </div>
          <div className="grid gap-5 pt-8 lg:grid-cols-[1fr_1.5fr] lg:items-center"><div className="space-y-1 text-xs"><p>ООО «Джемьюн» · ИНН 5800012413 · ОГРН 1255800000554</p><p>© {new Date().getFullYear()} Yago App</p></div><div className="flex flex-wrap gap-x-5 gap-y-2 text-xs lg:justify-end"><a href="/license-agreement.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-white">Публичная оферта</a><a href="/privacy-policy.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-white">Политика обработки данных</a><a href="/personal-data-consent.html" target="_blank" rel="noopener noreferrer" className="hover:text-white">Согласие на обработку данных</a><a href="/company-details.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-white">Реквизиты</a></div></div>
        </div>
      </footer>

      {!cookieConsent ? (
        <div className="landing-shadow fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-slate-600">Мы используем cookie, чтобы сайт работал корректно и помогал улучшать сервис.</p><button type="button" onClick={acceptCookieConsent} className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-bold text-white hover:bg-slate-800">Принять</button></div>
        </div>
      ) : null}
    </div>
  );
};

export default LandingPage;
