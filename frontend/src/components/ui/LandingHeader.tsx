import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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

  useEffect(() => {
    const handleScroll = () => {
      setCompact(window.scrollY > 12);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('light');
    return () => {
      document.documentElement.classList.remove('light');
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-white shadow-sm">
      <div className={`mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 ${compact ? 'py-2' : 'py-4'}`}>
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
        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-3 text-sm font-medium lg:flex">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="rounded-lg px-3 py-2 text-nav transition hover:text-navHover">
                {item.label}
              </a>
            ))}
          </nav>
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
        </div>
      </div>
    </header>
  );
};

export default LandingHeader;
