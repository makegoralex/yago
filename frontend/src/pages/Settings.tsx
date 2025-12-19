import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../store/auth';
import { useToast } from '../providers/ToastProvider';
import { useRestaurantStore } from '../store/restaurant';
import { useTheme } from '../providers/ThemeProvider';

const SettingsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const restaurantName = useRestaurantStore((state) => state.name);
  const restaurantLogo = useRestaurantStore((state) => state.logoUrl);
  const navigate = useNavigate();
  const { notify } = useToast();
  const { theme, setThemeForScope } = useTheme();

  const handleLogout = () => {
    clearSession();
    notify({ title: 'Вы вышли из аккаунта', type: 'info' });
    navigate('/login');
  };

  const handleThemeToggle = () => {
    setThemeForScope('pos', theme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="pos-shell flex min-h-screen flex-col gap-6 px-4 py-6 lg:px-4">
      <header className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-soft">
        <div className="flex items-center gap-2">
          {restaurantLogo ? (
            <img
              src={restaurantLogo}
              alt={restaurantName}
              className="h-10 w-10 rounded-lg border border-slate-100 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-400">
              Лого
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-slate-900 leading-tight">{restaurantName || 'Yago POS'}</p>
            <p className="text-[11px] text-slate-500">Управление продажами</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/pos')}
          className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary"
        >
          Вернуться в кассу
        </button>
      </header>

      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-slate-900">Профиль</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>Имя: {user?.name}</p>
          <p>Email: {user?.email}</p>
          <p>Роль: {user?.role}</p>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-slate-900">Тема кассы</h2>
        <button
          type="button"
          onClick={handleThemeToggle}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          {theme === 'light' ? 'Переключить на тёмную' : 'Переключить на светлую'}
        </button>
      </section>

      <button
        type="button"
        onClick={handleLogout}
        className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
      >
        Выйти из аккаунта
      </button>
    </div>
  );
};

export default SettingsPage;
