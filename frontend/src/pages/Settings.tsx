import { isAxiosError } from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../store/auth';
import { useToast } from '../providers/ToastProvider';
import { useRestaurantStore } from '../store/restaurant';
import api from '../lib/api';

type BillingInfo = {
  plan: 'trial' | 'paid' | string;
  status: string;
  trialEndsAt?: string | null;
  daysLeftInTrial?: number;
  nextPaymentDueAt?: string | null;
  daysUntilNextPayment?: number;
  monthlyPrice: number;
  isPaymentDue: boolean;
};

const SettingsPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const enableOrderTags = useRestaurantStore((state) => state.enableOrderTags);
  const measurementUnits = useRestaurantStore((state) => state.measurementUnits);
  const updateRestaurantSettings = useRestaurantStore((state) => state.updateBranding);
  const navigate = useNavigate();
  const { notify } = useToast();
  const organizationId = user?.organizationId;
  const [unitsDraft, setUnitsDraft] = useState<string[]>(measurementUnits);
  const [newUnit, setNewUnit] = useState('');
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [billingMessage, setBillingMessage] = useState('');
  const [billingError, setBillingError] = useState('');
  const [billingLoading, setBillingLoading] = useState(false);
  const hasUnits = useMemo(() => unitsDraft.length > 0, [unitsDraft]);
  const billingLocked = useMemo(
    () => ['expired', 'paused'].includes(billingInfo?.status?.toLowerCase() ?? ''),
    [billingInfo]
  );

  const extractErrorMessage = (error: unknown, fallback: string) => {
    if (isAxiosError(error)) {
      return error.response?.data?.error ?? error.message;
    }

    return error instanceof Error ? error.message : fallback;
  };

  useEffect(() => {
    setUnitsDraft(measurementUnits);
  }, [measurementUnits]);

  useEffect(() => {
    const fetchOrganization = async () => {
      if (!organizationId) return;

      try {
        const response = await api.get(`/api/organizations/${organizationId}`);
        setBillingInfo((response.data?.data?.billing ?? null) as BillingInfo | null);
      } catch (error) {
        setBillingError(extractErrorMessage(error, 'Не удалось загрузить информацию об организации'));
      }
    };

    void fetchOrganization();
  }, [organizationId]);

  const handleLogout = () => {
    clearSession();
    notify({ title: 'Вы вышли из аккаунта', type: 'info' });
    navigate('/login');
  };

  const handleToggleOrderTags = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (billingLocked) return;
    updateRestaurantSettings({ enableOrderTags: event.target.checked });
  };

  const handleAddUnit = (event: React.FormEvent) => {
    event.preventDefault();
    if (billingLocked) return;
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
    if (billingLocked) return;
    setUnitsDraft((prev) => prev.filter((item) => item !== unit));
  };

  const handleSaveUnits = async () => {
    if (billingLocked) {
      notify({ title: 'Продлите подписку, чтобы редактировать настройки', type: 'error' });
      return;
    }
    try {
      await updateRestaurantSettings({ measurementUnits: unitsDraft });
      notify({ title: 'Единицы измерения сохранены', type: 'success' });
    } catch (error) {
      console.error('Failed to save measurement units', error);
      notify({ title: 'Не удалось сохранить список единиц', type: 'error' });
    }
  };

  const handleSimulatePayment = async () => {
    if (!organizationId) return;

    setBillingLoading(true);
    setBillingMessage('');
    setBillingError('');

    try {
      const response = await api.post(`/api/organizations/${organizationId}/billing/simulate-payment`);
      setBillingInfo((response.data?.data?.billing ?? null) as BillingInfo | null);
      setBillingMessage('Подписка продлена на месяц (симуляция).');
    } catch (error) {
      setBillingError(extractErrorMessage(error, 'Не удалось обновить оплату'));
    } finally {
      setBillingLoading(false);
    }
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };

  const formatCountdown = (days?: number) => {
    if (typeof days !== 'number') return '—';
    if (days <= 0) return 'Сегодня';
    return `${days} дн.`;
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
      {organizationId && (
        <section className="rounded-3xl bg-white p-6 shadow-soft">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Подписка</h2>
              <p className="text-sm text-slate-500">Дни до оплаты или конца пробного периода.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleSimulatePayment()}
              disabled={billingLoading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-secondary/40 hover:text-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {billingLoading ? 'Обновляем…' : 'Продлить (MVP)'}
            </button>
          </div>

          {billingError && <div className="mb-3 rounded-lg border border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">{billingError}</div>}
          {billingMessage && <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{billingMessage}</div>}
          {billingLocked && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Подписка просрочена: данные доступны только для чтения до продления.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">План</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{billingInfo?.plan === 'paid' ? 'Платный' : 'Trial'}</p>
              <p className="text-sm text-slate-600">Статус: {billingInfo?.status ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Сроки</p>
              {billingInfo?.plan === 'trial' ? (
                <>
                  <p className="mt-2 text-lg font-semibold text-indigo-900">
                    Осталось: {formatCountdown(billingInfo?.daysLeftInTrial)}
                  </p>
                  <p className="text-sm text-indigo-800">
                    До: {billingInfo?.trialEndsAt ? formatDate(billingInfo.trialEndsAt) : '—'}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-lg font-semibold text-indigo-900">
                    Следующий платёж: {billingInfo?.nextPaymentDueAt ? formatDate(billingInfo.nextPaymentDueAt) : '—'}
                  </p>
                  <p className="text-sm text-indigo-800">Осталось: {formatCountdown(billingInfo?.daysUntilNextPayment)}</p>
                </>
              )}
            </div>
          </div>
        </section>
      )}
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
              disabled={billingLocked}
              className="h-5 w-5 rounded border-slate-300 text-secondary focus:ring-secondary disabled:cursor-not-allowed disabled:opacity-60"
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
              disabled={billingLocked}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Сохранить список
            </button>
          </div>

          <form onSubmit={handleAddUnit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={newUnit}
              onChange={(event) => setNewUnit(event.target.value)}
              disabled={billingLocked}
              placeholder="Например, грамм, мл, шт"
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            />
            <button
              type="submit"
              disabled={billingLocked}
              className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
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
                    disabled={billingLocked}
                    className="text-xs text-slate-500 transition hover:text-red-500 disabled:cursor-not-allowed disabled:text-slate-300"
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
