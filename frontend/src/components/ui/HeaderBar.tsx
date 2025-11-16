import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useRestaurantStore } from '../../store/restaurant';
import { useTheme } from '../../providers/ThemeProvider';

const formatTime = (date: Date) =>
  date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

const HeaderBar: React.FC<{ onToggleSidebar: () => void; isSidebarCollapsed: boolean }> = ({
  onToggleSidebar,
  isSidebarCollapsed,
}) => {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const restaurantName = useRestaurantStore((state) => state.name);
  const restaurantLogo = useRestaurantStore((state) => state.logoUrl);
  const navigate = useNavigate();
  const [now, setNow] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const interval = window.setInterval(() => setNow(formatTime(new Date())), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-soft">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-secondary hover:text-secondary lg:flex"
        >
          {isSidebarCollapsed ? '☰' : '⟨'}
        </button>
        <div className="flex items-center gap-3">
          {restaurantLogo ? (
            <img
              src={restaurantLogo}
              alt={restaurantName}
              className="h-12 w-12 rounded-2xl border border-slate-100 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-400">
              Лого
            </div>
          )}
          <div>
            <p className="text-xl font-semibold text-slate-900">{restaurantName || 'Yago POS'}</p>
            <p className="text-xs text-slate-500">Управление продажами</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden flex-col text-right md:flex">
          <span className="text-sm font-medium text-slate-700">{user?.name}</span>
          <span className="text-xs text-slate-400">{user?.role === 'admin' ? 'Администратор' : 'Кассир'}</span>
        </div>
        <div className="hidden text-right text-sm font-medium text-slate-600 lg:block">{now}</div>
        {user?.role === 'admin' ? (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="hidden h-12 items-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:border-primary/40 hover:text-primary lg:flex"
          >
            Админка
          </button>
        ) : null}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
          aria-label="Переключить тему"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 md:flex"
          aria-label="Настройки"
        >
          ⚙️
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex h-12 items-center rounded-2xl bg-slate-100 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 md:hidden"
        >
          Настройки
        </button>
      </div>
    </header>
  );
};

export default HeaderBar;
