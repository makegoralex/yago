import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../store/auth';
import { useToast } from '../providers/ToastProvider';
import { useRestaurantStore } from '../store/restaurant';

const SettingsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const enableOrderTags = useRestaurantStore((state) => state.enableOrderTags);
  const measurementUnits = useRestaurantStore((state) => state.measurementUnits);
  const updateRestaurantSettings = useRestaurantStore((state) => state.updateBranding);
  const navigate = useNavigate();
  const { notify } = useToast();
  const [unitsDraft, setUnitsDraft] = useState<string[]>(measurementUnits);
  const [newUnit, setNewUnit] = useState('');
  const hasUnits = useMemo(() => unitsDraft.length > 0, [unitsDraft]);

  useEffect(() => {
    setUnitsDraft(measurementUnits);
  }, [measurementUnits]);

  const handleLogout = () => {
    clearSession();
    notify({ title: 'Вы вышли из аккаунта', type: 'info' });
    navigate('/login');
  };

  const handleToggleOrderTags = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateRestaurantSettings({ enableOrderTags: event.target.checked });
  };

  const handleAddUnit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = newUnit.trim();
    if (!normalized) {
      return;
    }

    if (unitsDraft.includes(normalized)) {
      notify({ title: 'Единица уже добавлена', type: 'info' });
      return;
    }

    setUnitsDraft((prev) => [...prev, normalized]);
    setNewUnit('');
  };

  const handleRemoveUnit = (unit: string) => {
    setUnitsDraft((prev) => prev.filter((item) => item !== unit));
  };

  const handleSaveUnits = async () => {
    try {
      await updateRestaurantSettings({ measurementUnits: unitsDraft });
      notify({ title: 'Единицы измерения сохранены', type: 'success' });
    } catch (error) {
      console.error('Failed to save measurement units', error);
      notify({ title: 'Не удалось сохранить список единиц', type: 'error' });
    }
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
        <div className="mt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Единицы измерения ингредиентов</p>
              <p className="text-sm text-slate-500">
                Добавьте список доступных единиц для ингредиентов. Эти значения используются в админке меню.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveUnits}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Сохранить список
            </button>
          </div>

          <form onSubmit={handleAddUnit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={newUnit}
              onChange={(event) => setNewUnit(event.target.value)}
              placeholder="Например, грамм, мл, шт"
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-2"
            />
            <button
              type="submit"
              className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Добавить
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {hasUnits ? (
              unitsDraft.map((unit) => (
                <span
                  key={unit}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
                >
                  {unit}
                  <button
                    type="button"
                    onClick={() => handleRemoveUnit(unit)}
                    className="text-xs text-slate-500 transition hover:text-red-500"
                  >
                    Удалить
                  </button>
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-500">Добавьте хотя бы одну единицу измерения.</p>
            )}
          </div>
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
