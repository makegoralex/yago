import React from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../store/auth';
import { useToast } from '../providers/ToastProvider';

const SettingsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const { notify } = useToast();

  const handleLogout = () => {
    clearSession();
    notify({ title: 'Вы вышли из аккаунта', type: 'info' });
    navigate('/login');
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
