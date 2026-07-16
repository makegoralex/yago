import React from 'react';
import { Link } from 'react-router-dom';
import LandingHeader from '../ui/LandingHeader';
import { tools, type ToolDefinition, type ToolTheme } from '../../features/tools/toolRegistry';
import ToolSignupCta from './ToolSignupCta';
import ToolsFooter from './ToolsFooter';

const themeClasses: Record<ToolTheme, { badge: string; panel: string; glow: string }> = {
  amber: {
    badge: 'bg-amber-100 text-amber-900 ring-amber-200',
    panel: 'from-amber-50 via-orange-50 to-white border-amber-200',
    glow: 'bg-amber-400',
  },
  indigo: {
    badge: 'bg-indigo-100 text-indigo-900 ring-indigo-200',
    panel: 'from-indigo-50 via-violet-50 to-white border-indigo-200',
    glow: 'bg-indigo-500',
  },
  emerald: {
    badge: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
    panel: 'from-emerald-50 via-teal-50 to-white border-emerald-200',
    glow: 'bg-emerald-500',
  },
  rose: {
    badge: 'bg-rose-100 text-rose-900 ring-rose-200',
    panel: 'from-rose-50 via-orange-50 to-white border-rose-200',
    glow: 'bg-rose-500',
  },
  cyan: {
    badge: 'bg-cyan-100 text-cyan-900 ring-cyan-200',
    panel: 'from-cyan-50 via-sky-50 to-white border-cyan-200',
    glow: 'bg-cyan-500',
  },
};

type ToolShellProps = {
  tool: ToolDefinition;
  intro: string;
  children: React.ReactNode;
  methodology: React.ReactNode;
};

const ToolShell: React.FC<ToolShellProps> = ({ tool, intro, children, methodology }) => {
  const theme = themeClasses[tool.theme];

  return (
    <div className="landing-shell min-h-screen bg-slate-50">
      <LandingHeader ctaHref="/#signup" />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <nav aria-label="Хлебные крошки" className="mb-5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link to="/" className="hover:text-primary">Yago</Link>
          <span aria-hidden="true">/</span>
          <Link to="/tools" className="hover:text-primary">Бесплатные инструменты</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-slate-700">{tool.shortTitle}</span>
        </nav>

        <header className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 sm:p-8 lg:p-10 ${theme.panel}`}>
          <div className={`absolute -right-20 -top-24 h-56 w-56 rounded-full opacity-10 blur-3xl ${theme.glow}`} />
          <div className="relative max-w-4xl">
            <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ring-1 ${theme.badge}`}>
              {tool.eyebrow} · {tool.estimatedTime}
            </div>
            <h1 className="mt-5 heading-font text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
              {tool.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-700 sm:text-lg">{intro}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm text-slate-600">
              <span className="rounded-full bg-white/80 px-3 py-1.5 ring-1 ring-slate-200">Бесплатно</span>
              <span className="rounded-full bg-white/80 px-3 py-1.5 ring-1 ring-slate-200">Без регистрации</span>
              <span className="rounded-full bg-white/80 px-3 py-1.5 ring-1 ring-slate-200">Данные не отправляются</span>
            </div>
          </div>
        </header>

        <div className="mt-6">{children}</div>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="heading-font text-2xl font-semibold text-slate-950">Как считается результат</h2>
          <div className="mt-4 max-w-4xl space-y-3 text-sm leading-7 text-slate-600 sm:text-base">{methodology}</div>
          <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Расчёт носит справочный характер. Проверяйте исходные данные, налоги, условия аренды и цены поставщиков перед инвестиционным решением.
          </p>
        </section>

        <ToolSignupCta />

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Ещё полезное</p>
              <h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Другие бесплатные инструменты</h2>
            </div>
            <Link to="/tools" className="hidden text-sm font-semibold text-primary hover:text-primary-dark sm:inline">Все инструменты →</Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {tools.filter((item) => item.slug !== tool.slug).map((item) => (
              <Link key={item.slug} to={item.path} className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-primary/40">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.estimatedTime}</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{item.shortTitle}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <ToolsFooter />
    </div>
  );
};

export default ToolShell;
