import React from 'react';
import { Link } from 'react-router-dom';
import LandingHeader from '../components/ui/LandingHeader';

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
  const primaryButtonClass =
    'inline-flex items-center justify-center rounded-[12px] bg-primary px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-primary-dark';

  return (
    <div className="landing-shell min-h-screen">
      <LandingHeader />

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
                <div className="h-8 w-32 rounded-xl bg-[#EEF2F7]" />
                <div className="h-8 w-20 rounded-xl bg-[#EDE9FE]" />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-[#EEF2F7]" />
                  <div className="h-10 flex-1 rounded-2xl bg-[#F1F5F9]" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="h-20 rounded-2xl bg-[#F8FAFC]" />
                  <div className="h-20 rounded-2xl bg-[#F8FAFC]" />
                  <div className="h-20 rounded-2xl bg-[#F8FAFC]" />
                  <div className="h-20 rounded-2xl bg-[#F8FAFC]" />
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

        <section id="progress" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8">
          <h2 className="heading-font text-3xl font-semibold text-slate-900">Система постоянно развивается</h2>
          <div className="mt-4 space-y-3 text-base text-slate-600">
            <p>Мы регулярно улучшаем интерфейс и добавляем новые возможности.</p>
            <p>Приоритеты развития формируются на основе реального использования системы в кофейне.</p>
            <p>Без резких изменений и «ломающих» обновлений.</p>
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
