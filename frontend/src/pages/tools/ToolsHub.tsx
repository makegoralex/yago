import React, { useEffect } from 'react';
import { ArrowRight, Calculator, Coffee, LineChart, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import LandingHeader from '../../components/ui/LandingHeader';
import ToolSignupCta from '../../components/tools/ToolSignupCta';
import { applySeo } from '../../lib/seo';
import { SITE_URL, tools } from '../../features/tools/toolRegistry';

const iconBySlug = {
  'drink-cost-calculator': Coffee,
  'break-even-calculator': LineChart,
  'coffee-shop-opening-calculator': Calculator,
};

const cardClasses = {
  amber: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white hover:border-amber-300',
  indigo: 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-white hover:border-indigo-300',
  emerald: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white hover:border-emerald-300',
};

const iconClasses = {
  amber: 'bg-amber-100 text-amber-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  emerald: 'bg-emerald-100 text-emerald-800',
};

const ToolsHubPage: React.FC = () => {
  useEffect(() => {
    applySeo({
      title: 'Бесплатные калькуляторы для кофейни и кафе — Yago',
      description:
        'Бесплатные онлайн-калькуляторы для владельцев кофеен: себестоимость напитков, прибыль, точка безубыточности и бюджет открытия. Без регистрации.',
      keywords:
        'калькуляторы для кофейни, калькулятор кафе, себестоимость кофе, точка безубыточности кофейни, открытие кофейни',
      canonicalUrl: `${SITE_URL}/tools`,
      structuredData: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Бесплатные инструменты для владельцев кофеен',
          description: 'Калькуляторы экономики, себестоимости и открытия кофейни от Yago App.',
          url: `${SITE_URL}/tools`,
          inLanguage: 'ru-RU',
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: tools.map((tool, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: tool.title,
              url: `${SITE_URL}${tool.path}`,
            })),
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'Нужно ли регистрироваться для расчёта?',
              acceptedAnswer: { '@type': 'Answer', text: 'Нет. Все калькуляторы работают бесплатно и без регистрации.' },
            },
            {
              '@type': 'Question',
              name: 'Сохраняет ли Yago введённые данные?',
              acceptedAnswer: { '@type': 'Answer', text: 'Нет. Расчёты выполняются в браузере и введённые значения не отправляются на сервер.' },
            },
          ],
        },
      ],
    });
  }, []);

  return (
    <div className="landing-shell min-h-screen bg-slate-50">
      <LandingHeader ctaHref="/#signup" />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-12 text-white sm:px-10 sm:py-16 lg:px-14">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-violet-500/25 blur-3xl" />
          <div className="absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">
              <Sparkles size={14} /> Инструменты Yago
            </div>
            <h1 className="mt-5 heading-font text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Бесплатные калькуляторы для кофейни
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
              Проверяйте себестоимость напитков, прибыль, точку безубыточности и бюджет запуска. Без регистрации, сложных таблиц и передачи данных.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#calculators" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-slate-100">
                Выбрать калькулятор <ArrowRight size={17} />
              </a>
              <Link to="/" className="inline-flex h-12 items-center rounded-xl border border-white/20 px-5 text-sm font-semibold text-white hover:bg-white/10">
                Узнать о Yago
              </Link>
            </div>
          </div>
        </section>

        <section id="calculators" className="scroll-mt-24 py-10 sm:py-14">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Считать прямо сейчас</p>
            <h2 className="mt-2 heading-font text-3xl font-semibold text-slate-950 sm:text-4xl">Три инструмента для ежедневных решений</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">Каждый калькулятор имеет собственную форму и объясняет методику результата.</p>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-3">
            {tools.map((tool) => {
              const Icon = iconBySlug[tool.slug as keyof typeof iconBySlug];
              return (
                <article key={tool.slug} className={`flex min-h-[330px] flex-col rounded-3xl border p-6 transition hover:-translate-y-1 ${cardClasses[tool.theme]}`}>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconClasses[tool.theme]}`}>
                    <Icon size={23} aria-hidden="true" />
                  </div>
                  <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{tool.eyebrow} · {tool.estimatedTime}</p>
                  <h2 className="mt-2 heading-font text-2xl font-semibold text-slate-950">{tool.shortTitle}</h2>
                  <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{tool.description}</p>
                  <Link to={tool.path} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-950 hover:text-primary">
                    Открыть калькулятор <ArrowRight size={17} />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 sm:grid-cols-3 sm:p-8">
          <div>
            <div className="text-2xl font-semibold text-slate-950">0 ₽</div>
            <p className="mt-1 text-sm text-slate-600">Все инструменты бесплатны</p>
          </div>
          <div>
            <div className="text-2xl font-semibold text-slate-950">Без аккаунта</div>
            <p className="mt-1 text-sm text-slate-600">Результат доступен сразу</p>
          </div>
          <div>
            <div className="text-2xl font-semibold text-slate-950">В браузере</div>
            <p className="mt-1 text-sm text-slate-600">Исходные данные никуда не отправляются</p>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="heading-font text-2xl font-semibold text-slate-950">Частые вопросы</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <article><h3 className="font-semibold text-slate-900">Нужно ли регистрироваться?</h3><p className="mt-2 text-sm leading-6 text-slate-600">Нет. Калькуляторы доступны бесплатно и не требуют контактных данных.</p></article>
            <article><h3 className="font-semibold text-slate-900">Сохраняются ли расчёты?</h3><p className="mt-2 text-sm leading-6 text-slate-600">Нет. Значения обрабатываются локально в браузере. При обновлении страницы расчёт начинается заново.</p></article>
            <article><h3 className="font-semibold text-slate-900">Можно ли использовать результат для бизнес-плана?</h3><p className="mt-2 text-sm leading-6 text-slate-600">Да, как предварительную оценку. Перед вложениями проверьте аренду, поставщиков, налоги и локальный спрос.</p></article>
            <article><h3 className="font-semibold text-slate-900">Что появится дальше?</h3><p className="mt-2 text-sm leading-6 text-slate-600">Планируются калькуляторы меню, фонда оплаты труда, инвентаризации, лояльности и оборудования.</p></article>
          </div>
        </section>

        <ToolSignupCta />
      </main>
    </div>
  );
};

export default ToolsHubPage;
