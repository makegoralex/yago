import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';

type OrganizationSummary = {
  id: string;
  name: string;
  subscriptionPlan: string | null;
  subscriptionStatus: string;
  createdAt: string;
  owner: { name: string; email: string; role: string } | null;
};

const subscriptionStatuses = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'expired', label: 'Expired' },
];

const quickActions = [
  {
    title: 'Создать новую организацию',
    description: 'Запустите новый бизнес за несколько минут, чтобы владельцу сразу пришли доступы.',
    href: '#create-organization',
  },
  {
    title: 'Перейти в кабинет владельца',
    description: 'Используйте форму ниже, чтобы открыть нужную организацию в административной панели.',
    href: '#open-organization',
  },
  {
    title: 'Памятка по тарифам',
    description: 'Проверьте рекомендации, чтобы продлевать подписки без простоев и блокировок.',
    href: '#billing-tips',
  },
];

const SuperAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [organizationId, setOrganizationId] = useState('');
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  const [organizationsError, setOrganizationsError] = useState('');
  const [createForm, setCreateForm] = useState({
    name: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    subscriptionPlan: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState('');
  const [createError, setCreateError] = useState('');
  const [editingOrganization, setEditingOrganization] = useState<OrganizationSummary | null>(null);
  const [editForm, setEditForm] = useState({ name: '', subscriptionPlan: '', subscriptionStatus: 'trial' });
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const greeting = useMemo(() => {
    const name = user?.name?.trim();
    return name ? `Привет, ${name}!` : 'Привет, суперадмин!';
  }, [user?.name]);

  const handleOpenOrganization = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedId = organizationId.trim();

    if (!normalizedId) {
      return;
    }

    navigate(`/admin?organizationId=${encodeURIComponent(normalizedId)}`);
  };

  const fetchOrganizations = useCallback(async () => {
    setLoadingOrganizations(true);
    setOrganizationsError('');

    try {
      const response = await api.get('/api/organizations');
      const payload = response.data?.data ?? [];
      setOrganizations(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить организации';
      setOrganizationsError(message);
    } finally {
      setLoadingOrganizations(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  const handleCreateOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    setCreateMessage('');

    try {
      await api.post('/api/organizations/create', {
        name: createForm.name,
        owner: {
          name: createForm.ownerName,
          email: createForm.ownerEmail,
          password: createForm.ownerPassword,
        },
        subscriptionPlan: createForm.subscriptionPlan,
      });

      setCreateMessage('Организация создана. Данные отправлены владельцу.');
      setCreateForm({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '', subscriptionPlan: '' });
      await fetchOrganizations();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось создать организацию';
      setCreateError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenEdit = (organization: OrganizationSummary) => {
    setEditingOrganization(organization);
    setEditForm({
      name: organization.name,
      subscriptionPlan: organization.subscriptionPlan ?? '',
      subscriptionStatus: organization.subscriptionStatus,
    });
    setUpdateError('');
  };

  const handleUpdateOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingOrganization) return;

    setUpdateLoading(true);
    setUpdateError('');

    try {
      await api.patch(`/api/organizations/${editingOrganization.id}`, {
        name: editForm.name,
        subscriptionPlan: editForm.subscriptionPlan,
        subscriptionStatus: editForm.subscriptionStatus,
      });

      await fetchOrganizations();
      setEditingOrganization(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось обновить организацию';
      setUpdateError(message);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDeleteOrganization = async (organizationId: string) => {
    const confirmed = window.confirm('Удалить организацию? Действие необратимо.');
    if (!confirmed) return;

    setDeleteLoadingId(organizationId);
    try {
      await api.delete(`/api/organizations/${organizationId}`);
      await fetchOrganizations();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось удалить организацию';
      setOrganizationsError(message);
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };

  const renderStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
      trial: 'bg-primary/10 text-primary ring-primary/20',
      expired: 'bg-rose-50 text-rose-600 ring-rose-200',
      paused: 'bg-amber-50 text-amber-700 ring-amber-200',
    };

    const classes =
      statusStyles[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200';

    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${classes}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 pb-12 pt-10 text-slate-900 lg:px-12">
      <header className="mb-10 flex flex-col gap-3">
        <p className="text-sm font-medium text-primary/80">Панель суперадмина</p>
        <h1 className="text-3xl font-semibold leading-tight text-slate-900">{greeting}</h1>
        <p className="max-w-4xl text-base text-slate-600">
          Здесь собраны быстрые действия для управления организациями: создавайте новые кабинеты,
          помогайте владельцам с настройками и контролируйте подписки. Мы вынесли всё в отдельную
          страницу, чтобы не смешивать задачи суперадмина с интерфейсами кассиров и владельцев.
        </p>
      </header>

      <section className="mb-8 grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div id="open-organization" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="mb-5 flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-900">Открыть организацию</h2>
            <p className="text-sm text-slate-600">
              Введите идентификатор организации, чтобы моментально перейти в её административную панель.
              Это удобно для сопровождения и онбординга.
            </p>
          </div>
          <form className="flex flex-col gap-4 sm:flex-row" onSubmit={handleOpenOrganization}>
            <label className="flex-1">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                ID организации
              </span>
              <input
                type="text"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
                placeholder="64f..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <button
              type="submit"
              className="h-[52px] shrink-0 rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Открыть
            </button>
          </form>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-white to-white p-6 shadow-sm ring-1 ring-primary/10">
          <h2 className="text-lg font-semibold text-slate-900">Быстрый статус</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            <li className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-inner shadow-primary/10">🏢</span>
              <div>
                <p className="font-semibold text-slate-900">Организации</p>
                <p className="text-slate-600">Создавайте и сопровождайте любые кабинеты.</p>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-inner shadow-primary/10">👥</span>
              <div>
                <p className="font-semibold text-slate-900">Команды</p>
                <p className="text-slate-600">Помогайте владельцам добавлять сотрудников и роли.</p>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-inner shadow-primary/10">💳</span>
              <div>
                <p className="font-semibold text-slate-900">Подписки</p>
                <p className="text-slate-600">Следите, чтобы доступы и тарифы всегда были активны.</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((action) => (
          <a
            key={action.title}
            href={action.href}
            className="group relative flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{action.title}</h3>
              <span className="text-lg">→</span>
            </div>
            <p className="text-sm text-slate-600">{action.description}</p>
            <span className="text-xs font-semibold uppercase tracking-wide text-primary/80">Перейти</span>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/0 via-primary/0 to-primary/5 opacity-0 transition group-hover:opacity-100" />
          </a>
        ))}
      </section>

      <section
        id="create-organization"
        className="mt-8 grid gap-4 lg:grid-cols-[3fr,2fr] xl:grid-cols-[2fr,1fr]"
      >
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
          <div className="mb-5 flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-slate-900">Создать организацию</h2>
            <p className="text-sm text-slate-600">Заполните данные владельца и выберите план, чтобы сразу выдать доступ.</p>
          </div>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateOrganization}>
            <label className="md:col-span-2">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Название</span>
              <input
                type="text"
                required
                value={createForm.name}
                onChange={(event) => setCreateForm((form) => ({ ...form, name: event.target.value }))}
                placeholder="Кофейня на Патриарших"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Имя владельца</span>
              <input
                type="text"
                required
                value={createForm.ownerName}
                onChange={(event) => setCreateForm((form) => ({ ...form, ownerName: event.target.value }))}
                placeholder="Алексей"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email владельца</span>
              <input
                type="email"
                required
                value={createForm.ownerEmail}
                onChange={(event) => setCreateForm((form) => ({ ...form, ownerEmail: event.target.value }))}
                placeholder="owner@example.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Пароль владельца</span>
              <input
                type="password"
                required
                value={createForm.ownerPassword}
                onChange={(event) => setCreateForm((form) => ({ ...form, ownerPassword: event.target.value }))}
                placeholder="Минимум 8 символов"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Тариф</span>
              <input
                type="text"
                value={createForm.subscriptionPlan}
                onChange={(event) => setCreateForm((form) => ({ ...form, subscriptionPlan: event.target.value }))}
                placeholder="Pro или Custom"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <div className="flex items-center justify-between md:col-span-2">
              <div className="space-y-1 text-sm text-slate-600">
                {createError && <div className="text-rose-600">{createError}</div>}
                {createMessage && <div className="text-emerald-700">{createMessage}</div>}
              </div>
              <button
                type="submit"
                disabled={createLoading}
                className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/70"
              >
                {createLoading ? 'Создаем…' : 'Создать'}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white to-primary/10 p-6 shadow-sm ring-1 ring-primary/10">
          <h3 className="text-lg font-semibold text-slate-900">Советы по созданию</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Используйте рабочий email владельца — туда придет ссылка в кабинет.</li>
            <li>Пароль можно сменить позже из админки организации.</li>
            <li>Если тариф ещё обсуждается, оставьте поле пустым и активируйте после оплаты.</li>
          </ul>
        </div>
      </section>

      <section className="mt-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Организации</h2>
            <p className="text-sm text-slate-600">Полный список всех организаций, доступных суперадмину.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              Всего: {organizations.length}
            </span>
            <button
              type="button"
              onClick={() => void fetchOrganizations()}
              disabled={loadingOrganizations}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/70"
            >
              {loadingOrganizations ? 'Обновляем…' : 'Обновить'}
            </button>
          </div>
        </div>

        {organizationsError && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {organizationsError}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-3 pr-4">Организация</th>
                <th className="px-4 py-3">Владелец</th>
                <th className="px-4 py-3">Тариф</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3 text-right">Создана</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingOrganizations ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Загружаем организации…
                  </td>
                </tr>
              ) : organizations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Пока нет организаций. Создайте первую прямо сейчас.
                  </td>
                </tr>
              ) : (
                organizations.map((organization) => (
                  <tr key={organization.id} className="align-top">
                    <td className="py-4 pr-4">
                      <div className="font-semibold text-slate-900">{organization.name}</div>
                      <div className="text-xs text-slate-500">ID: {organization.id}</div>
                    </td>
                    <td className="px-4 py-4">
                      {organization.owner ? (
                        <div className="space-y-0.5">
                          <div className="font-medium text-slate-900">{organization.owner.name}</div>
                          <div className="text-xs text-slate-500">{organization.owner.email}</div>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                            {organization.owner.role}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Владелец не назначен</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-slate-900">
                        {organization.subscriptionPlan || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-4">{renderStatusBadge(organization.subscriptionStatus)}</td>
                    <td className="px-4 py-4 text-right text-xs font-medium text-slate-600">
                      {formatDate(organization.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right text-xs font-medium text-slate-600">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(organization)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOrganization(organization.id)}
                          disabled={deleteLoadingId === organization.id}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {deleteLoadingId === organization.id ? 'Удаляем…' : 'Удалить'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editingOrganization && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Редактировать организацию</h3>
                <p className="text-sm text-slate-600">Измените название, тариф или статус подписки.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrganization(null)}
                className="text-slate-500 transition hover:text-slate-900"
              >
                ✕
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleUpdateOrganization}>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Название</span>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(event) => setEditForm((form) => ({ ...form, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Тариф</span>
                  <input
                    type="text"
                    value={editForm.subscriptionPlan}
                    onChange={(event) => setEditForm((form) => ({ ...form, subscriptionPlan: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Статус</span>
                  <select
                    value={editForm.subscriptionStatus}
                    onChange={(event) => setEditForm((form) => ({ ...form, subscriptionStatus: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  >
                    {subscriptionStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {updateError && <div className="text-sm text-rose-600">{updateError}</div>}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingOrganization(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={updateLoading}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/70"
                >
                  {updateLoading ? 'Сохраняем…' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section
        id="billing-tips"
        className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 lg:mt-8"
      >
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-slate-900">Рекомендации по тарифам</h2>
          <p className="text-sm text-slate-600">
            Используйте эту памятку, чтобы продлевать и переключать подписки без простоев в работе
            организаций.
          </p>
        </div>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>Всегда уточняйте активный тариф перед продлением и фиксируйте изменения в CRM.</li>
          <li>После смены плана проверяйте, что у владельца есть доступ в личный кабинет.</li>
          <li>Если нужно экстренно продлить доступ, используйте пробный период и договоритесь о платежах позже.</li>
        </ul>
      </section>
    </div>
  );
};

export default SuperAdminPage;
