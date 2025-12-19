import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../providers/ThemeProvider';

const navItems = [
  { label: 'О продукте', href: '/#about' },
  { label: 'Что уже есть', href: '/#features' },
  { label: 'Развитие', href: '/#progress' },
  { label: 'Обратная связь', href: '/#feedback' },
  { label: 'Инструкции', href: '/help' },
  { label: 'Новости', href: '/news' },
  { label: 'Блог', href: '/blog' },
];

type LandingHeaderProps = {
  onCtaClick?: () => void;
  ctaLabel?: string;
  ctaHref?: string;
};

const LandingHeader: React.FC<LandingHeaderProps> = ({
  onCtaClick,
  ctaLabel = 'Создать организацию',
  ctaHref = '/login',
}) => {
  const [compact, setCompact] = useState(false);
  const { setThemeForScope } = useTheme();
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
    setThemeForScope('admin', 'light');
  }, [setThemeForScope]);

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
    <header className="sticky top-0 z-50 w-full bg-white shadow-sm">
      <div
        className={`mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 ${
          compact ? 'py-2' : 'py-4'
        }`}
      >
        <Link to="/" className="flex items-center gap-3">
          <div
            className={`flex items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary ${
              compact ? 'h-9 w-9' : 'h-11 w-11'
            }`}
          >
            YG
          </div>
          <div>
            <div className="heading-font text-lg font-semibold text-slate-900">Yago POS</div>
            <div className="text-xs text-slate-500">Система для кофейни</div>
          </div>
        </Link>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
          <nav className="hidden items-center gap-2 text-sm font-medium lg:flex">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="rounded-lg px-3 py-2 text-nav transition hover:text-navHover">
                {item.label}
              </a>
            ))}
          </nav>
          <Link
            to="/login"
            className="hidden rounded-[12px] border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 sm:inline-flex"
          >
            Вход
          </Link>
          {onCtaClick ? (
            <button
              type="button"
              onClick={onCtaClick}
              className="rounded-[12px] bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
            >
              {ctaLabel}
            </button>
          ) : (
            <a
              href={ctaHref}
              className="rounded-[12px] bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark"
            >
              {ctaLabel}
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
        <div className="border-t border-slate-200 bg-white px-4 py-4 shadow-sm lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
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
                  className="rounded-[12px] bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm"
                >
                  {ctaLabel}
                </button>
              ) : (
                <a href={ctaHref} className="rounded-[12px] bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm">
                  {ctaLabel}
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
