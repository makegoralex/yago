import { isAxiosError } from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../store/auth';
import { useToast } from '../providers/ToastProvider';
import { useRestaurantStore } from '../store/restaurant';
import api from '../lib/api';

type FiscalProviderTest = {
  status: 'registered' | 'pending' | 'failed';
  testedAt: string;
  receiptId?: string;
  message?: string;
};

type FiscalProviderSettings = {
  enabled: boolean;
  provider: 'atol';
  mode: 'test' | 'prod';
  login: string;
  password: string;
  groupCode: string;
  inn: string;
  paymentAddress: string;
  deviceId?: string;
  lastTest?: FiscalProviderTest;
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
  const [fiscalForm, setFiscalForm] = useState<FiscalProviderSettings>({
    enabled: false,
    provider: 'atol',
    mode: 'test',
    login: '',
    password: '',
    groupCode: '',
    inn: '',
    paymentAddress: '',
    deviceId: '',
  });
  const [lastFiscalTest, setLastFiscalTest] = useState<FiscalProviderTest | null>(null);
  const [fiscalSaving, setFiscalSaving] = useState(false);
  const [fiscalMessage, setFiscalMessage] = useState('');
  const [fiscalError, setFiscalError] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const hasUnits = useMemo(() => unitsDraft.length > 0, [unitsDraft]);

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
        const provider = (response.data?.data?.settings?.fiscalProvider ?? null) as FiscalProviderSettings | null;

        setFiscalForm({
          enabled: provider?.enabled ?? false,
          provider: 'atol',
          mode: provider?.mode ?? 'test',
          login: provider?.login ?? '',
          password: provider?.password ?? '',
          groupCode: provider?.groupCode ?? '',
          inn: provider?.inn ?? '',
          paymentAddress: provider?.paymentAddress ?? '',
          deviceId: provider?.deviceId ?? '',
        });
        setLastFiscalTest(provider?.lastTest ?? null);
      } catch (error) {
        setFiscalError(extractErrorMessage(error, 'Не удалось загрузить настройки кассы'));
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

  const handleFiscalFieldChange = (field: keyof FiscalProviderSettings, value: string | boolean) => {
    setFiscalForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveFiscalSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organizationId) return;

    setFiscalSaving(true);
    setFiscalMessage('');
    setFiscalError('');

    const fiscalPayload = {
      ...fiscalForm,
      deviceId: fiscalForm.deviceId || undefined,
    };

    try {
      const response = await api.patch(`/api/organizations/${organizationId}`, {
        settings: { fiscalProvider: fiscalPayload },
      });

      setFiscalMessage('Настройки кассы сохранены');
      const provider = (response.data?.data?.settings?.fiscalProvider ?? fiscalPayload) as FiscalProviderSettings;
      setFiscalForm({ ...provider, deviceId: provider.deviceId ?? '' });
    } catch (error) {
      setFiscalError(extractErrorMessage(error, 'Не удалось сохранить настройки кассы'));
    } finally {
      setFiscalSaving(false);
    }
  };

  const handleTestFiscalReceipt = async () => {
    if (!organizationId) return;

    setTestLoading(true);
    setFiscalMessage('');
    setFiscalError('');

    try {
      const response = await api.post(`/api/organizations/${organizationId}/fiscal/test`);
      const payload = response.data?.data as FiscalProviderTest | undefined;

      if (payload) {
        setLastFiscalTest(payload);
        setFiscalMessage('Пробный чек отправлен');
      }
    } catch (error) {
      setFiscalError(extractErrorMessage(error, 'Не удалось отправить пробный чек'));
    } finally {
      setTestLoading(false);
    }
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
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
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-slate-900">Онлайн-касса АТОЛ</h2>
            <p className="text-sm text-slate-500">Настройте фискализацию заказов для своей организации.</p>
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSaveFiscalSettings}>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={fiscalForm.enabled}
                onChange={(event) => handleFiscalFieldChange('enabled', event.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-secondary focus:ring-secondary/40"
              />
              <span>Фискализация включена</span>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Режим</span>
              <select
                value={fiscalForm.mode}
                onChange={(event) => handleFiscalFieldChange('mode', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-secondary/50 focus:ring-2 focus:ring-secondary/20"
              >
                <option value="test">Тестовый</option>
                <option value="prod">Продакшн</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Логин</span>
              <input
                type="text"
                required={fiscalForm.enabled}
                value={fiscalForm.login}
                onChange={(event) => handleFiscalFieldChange('login', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-secondary/50 focus:bg-white focus:ring-2 focus:ring-secondary/20"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Пароль</span>
              <input
                type="text"
                required={fiscalForm.enabled}
                value={fiscalForm.password}
                onChange={(event) => handleFiscalFieldChange('password', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-secondary/50 focus:bg-white focus:ring-2 focus:ring-secondary/20"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Код группы</span>
              <input
                type="text"
                required={fiscalForm.enabled}
                value={fiscalForm.groupCode}
                onChange={(event) => handleFiscalFieldChange('groupCode', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-secondary/50 focus:bg-white focus:ring-2 focus:ring-secondary/20"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">ИНН</span>
              <input
                type="text"
                required={fiscalForm.enabled}
                value={fiscalForm.inn}
                onChange={(event) => handleFiscalFieldChange('inn', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-secondary/50 focus:bg-white focus:ring-2 focus:ring-secondary/20"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Адрес расчётов</span>
              <input
                type="text"
                required={fiscalForm.enabled}
                value={fiscalForm.paymentAddress}
                onChange={(event) => handleFiscalFieldChange('paymentAddress', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-secondary/50 focus:bg-white focus:ring-2 focus:ring-secondary/20"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">ID устройства</span>
              <input
                type="text"
                value={fiscalForm.deviceId}
                onChange={(event) => handleFiscalFieldChange('deviceId', event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-secondary/50 focus:bg-white focus:ring-2 focus:ring-secondary/20"
                placeholder="Опционально"
              />
            </label>

            <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-sm text-slate-600">
                {fiscalError && <div className="text-rose-600">{fiscalError}</div>}
                {fiscalMessage && <div className="text-emerald-700">{fiscalMessage}</div>}
                {lastFiscalTest && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">Последний тест</div>
                    <div>Статус: {lastFiscalTest.status}</div>
                    <div>Время: {formatDate(lastFiscalTest.testedAt)}</div>
                    {lastFiscalTest.receiptId && <div>Чек: {lastFiscalTest.receiptId}</div>}
                    {lastFiscalTest.message && <div className="text-rose-600">{lastFiscalTest.message}</div>}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => void handleTestFiscalReceipt()}
                  disabled={testLoading || !fiscalForm.enabled}
                  className="rounded-xl border border-secondary/40 px-4 py-3 text-sm font-semibold text-secondary transition hover:bg-secondary/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {testLoading ? 'Отправляем…' : 'Пробный чек'}
                </button>
                <button
                  type="submit"
                  disabled={fiscalSaving}
                  className="rounded-xl bg-secondary px-6 py-3 text-sm font-semibold text-white shadow-secondary/20 transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:bg-secondary/70"
                >
                  {fiscalSaving ? 'Сохраняем…' : 'Сохранить настройки'}
                </button>
              </div>
            </div>
          </form>
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
