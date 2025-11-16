import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../store/auth';
import { useToast } from '../providers/ToastProvider';
import { useRestaurantStore } from '../store/restaurant';

const SettingsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const enableOrderTags = useRestaurantStore((state) => state.enableOrderTags);
  const updateRestaurantSettings = useRestaurantStore((state) => state.updateBranding);
  const navigate = useNavigate();
  const { notify } = useToast();

  const handleLogout = () => {
    clearSession();
    notify({ title: 'Вы вышли из аккаунта', type: 'info' });
    navigate('/login');
  };

  const handleToggleOrderTags = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateRestaurantSettings({ enableOrderTags: event.target.checked });
  };

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-slate-100 px-4 py-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Настройки</h1>
        <p className="mt-2 text-sm text-slate-500">Страница профиля и управление аккаунтом появится в следующей версии.</p>
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
        <h2 className="text-lg font-semibold text-slate-900">Настройки ресторана</h2>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Метки заказов</p>
            <p className="text-sm text-slate-500">Отображать переключатели «С собой» и «Доставка» на кассе</p>
          </div>
          <label className="inline-flex items-center gap-3">
            <span className="text-sm text-slate-600">Включено</span>
            <input
              type="checkbox"
              checked={enableOrderTags}
              onChange={handleToggleOrderTags}
              className="h-5 w-5 rounded border-slate-300 text-secondary focus:ring-secondary"
            />
          </label>
        </div>
      </section>
      <section className="rounded-3xl bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-slate-900">Управление</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="min-h-[48px] flex-1 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:border-secondary hover:text-secondary"
          >
            Вернуться в кассу
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[48px] flex-1 rounded-2xl bg-red-50 px-4 text-sm font-semibold text-red-500 transition hover:bg-red-100"
          >
            Выйти из аккаунта
          </button>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
