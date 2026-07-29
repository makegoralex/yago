import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const navItems = [
  { label: 'Продукт', href: '/#product' },
  { label: 'Возможности', href: '/#features' },
  { label: 'Интеграции', href: '/#integrations' },
  { label: 'Тарифы', href: '/#pricing' },
  { label: 'Инструменты', href: '/tools' },
  { label: 'FAQ', href: '/#faq' },
];

type LandingHeaderProps = {
  onCtaClick?: () => void;
  ctaLabel?: string;
  ctaMobileLabel?: string;
  ctaHref?: string;
};

const LandingHeader: React.FC<LandingHeaderProps> = ({
  onCtaClick,
  ctaLabel = 'Попробовать бесплатно 14 дней',
  ctaMobileLabel = '14 дней бесплатно',
  ctaHref = '/#signup',
}) => {
  const [compact, setCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setCompact(window.scrollY > 12);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [menuOpen]);

  return (
    <header className="landing-header sticky top-0 z-50 w-full border-b border-slate-200/80 bg-[#fbfaf7]/95 backdrop-blur-xl">
      <div className={`mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8 ${compact ? 'py-2' : 'py-3.5'}`}>
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <div
            className={`flex shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white ${
              compact ? 'h-9 w-9' : 'h-11 w-11'
            }`}
          >
            YG
          </div>
          <div className="min-w-0">
            <div className="truncate heading-font text-lg font-semibold text-slate-900">Yago App</div>
            <div className="truncate text-xs text-slate-500">POS и учёт для кофейни</div>
          </div>
        </Link>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <nav className="hidden items-center gap-2 text-sm font-medium lg:flex">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="rounded-lg px-2.5 py-2 text-nav transition hover:text-violet-700">
                {item.label}
              </a>
            ))}
          </nav>

          <Link
            to="/login"
            className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950 sm:inline-flex"
          >
            Вход
          </Link>

          {onCtaClick ? (
            <button
              type="button"
              onClick={onCtaClick}
              className="landing-primary-button rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold whitespace-nowrap text-white transition hover:bg-violet-700 sm:px-4 sm:text-sm"
            >
              <span className="hidden sm:inline">{ctaLabel}</span>
              <span className="sm:hidden">{ctaMobileLabel}</span>
            </button>
          ) : (
            <a
              href={ctaHref}
              className="landing-primary-button rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold whitespace-nowrap text-white transition hover:bg-violet-700 sm:px-4 sm:text-sm"
            >
              <span className="hidden sm:inline">{ctaLabel}</span>
              <span className="sm:hidden">{ctaMobileLabel}</span>
            </a>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:text-slate-900 lg:hidden"
            aria-label="Открыть меню"
            aria-expanded={menuOpen}
          >
            <span className="flex h-4 w-5 flex-col justify-between">
              <span className="h-0.5 w-full rounded-full bg-current" />
              <span className="h-0.5 w-full rounded-full bg-current" />
              <span className="h-0.5 w-full rounded-full bg-current" />
            </span>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-t border-slate-200 bg-[#fbfaf7] px-4 py-4 lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-2">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700">
                {item.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Link
                to="/login"
                className="rounded-[12px] border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Вход
              </Link>
              {onCtaClick ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onCtaClick();
                  }}
                  className="landing-primary-button rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white"
                >
                  <span className="hidden sm:inline">{ctaLabel}</span>
              <span className="sm:hidden">{ctaMobileLabel}</span>
                </button>
              ) : (
                <a href={ctaHref} className="landing-primary-button rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white">
                  <span className="hidden sm:inline">{ctaLabel}</span>
              <span className="sm:hidden">{ctaMobileLabel}</span>
                </a>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default LandingHeader;
