import { isAxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import {
  blogPosts as initialBlogPosts,
  instructionLinks as initialInstructionLinks,
  newsItems as initialNewsItems,
  screenshotGallery as initialScreenshots,
  type BlogPost,
  type InstructionLink,
  type NewsItem,
  type ScreenshotItem,
} from '../constants/content';

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

type OrganizationSettings = {
  fiscalProvider?: FiscalProviderSettings;
};

type BillingInfo = {
  plan: 'trial' | 'paid' | string;
  status: string;
  trialEndsAt?: string | null;
  trialStartedAt?: string;
  daysLeftInTrial?: number;
  daysUsedInTrial?: number;
  nextPaymentDueAt?: string | null;
  daysUntilNextPayment?: number;
  monthlyPrice: number;
  isPaymentDue: boolean;
};

type OrganizationSummary = {
  id: string;
  name: string;
  subscriptionPlan: string | null;
  subscriptionStatus: string;
  createdAt: string;
  owner: { name: string; email: string; role: string } | null;
  settings?: OrganizationSettings;
  billing?: BillingInfo;
};

type BillingSummary = {
  totalOrganizations: number;
  activeTrials: number;
  expiredTrials: number;
  activePaid: number;
  pausedPaid: number;
  overduePayments: number;
  projectedMrr: number;
  expectedNext30DaysRevenue: number;
};

type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  organization: { id: string; name: string } | null;
};

const subscriptionStatuses = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'expired', label: 'Expired' },
];

const userRoles = [
  { value: 'superAdmin', label: 'Суперадмин' },
  { value: 'owner', label: 'Владелец' },
  { value: 'cashier', label: 'Кассир' },
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
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [billingSummaryError, setBillingSummaryError] = useState('');
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState('');
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
  const [editForm, setEditForm] = useState({
    name: '',
    subscriptionPlan: '',
    subscriptionStatus: 'trial',
    trialEndsAt: '',
    nextPaymentDueAt: '',
  });
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [fiscalOrganizationId, setFiscalOrganizationId] = useState('');
  const [fiscalForm, setFiscalForm] = useState({
    enabled: false,
    mode: 'test' as 'test' | 'prod',
    provider: 'atol' as const,
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
  const [testError, setTestError] = useState('');
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'cashier', organizationId: '' });
  const [userUpdateLoading, setUserUpdateLoading] = useState(false);
  const [userUpdateError, setUserUpdateError] = useState('');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [newsDrafts, setNewsDrafts] = useState<NewsItem[]>(initialNewsItems);
  const [newsForm, setNewsForm] = useState({ title: '', date: '', description: '', content: '' });
  const [instructionDrafts, setInstructionDrafts] = useState<InstructionLink[]>(initialInstructionLinks);
  const [instructionForm, setInstructionForm] = useState({ title: '', href: '' });
  const [blogDrafts, setBlogDrafts] = useState<BlogPost[]>(initialBlogPosts);
  const [blogForm, setBlogForm] = useState({ title: '', date: '', excerpt: '', content: '' });
  const [screenshotDrafts, setScreenshotDrafts] = useState<ScreenshotItem[]>(initialScreenshots);
  const [screenshotForm, setScreenshotForm] = useState({ title: '', description: '' });

  const greeting = useMemo(() => {
    const name = user?.name?.trim();
    return name ? `Привет, ${name}!` : 'Привет, суперадмин!';
  }, [user?.name]);

  const selectedFiscalOrganization = useMemo(
    () => organizations.find((org) => org.id === fiscalOrganizationId) ?? null,
    [fiscalOrganizationId, organizations]
  );

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-') || `entry-${Date.now()}`;

  const contentFromText = (text: string) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const extractErrorMessage = (error: unknown, fallback: string) => {
    if (isAxiosError(error)) {
      return error.response?.data?.error ?? error.message;
    }

    return error instanceof Error ? error.message : fallback;
  };

  const handleFiscalFieldChange = (field: keyof typeof fiscalForm, value: string | boolean) => {
    setFiscalForm((form) => ({ ...form, [field]: value }));
  };

  const handleSaveFiscalSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!fiscalOrganizationId) return;

    setFiscalSaving(true);
    setFiscalMessage('');
    setFiscalError('');

    const fiscalPayload = fiscalForm.enabled
      ? { ...fiscalForm, deviceId: fiscalForm.deviceId || undefined }
      : null;

    try {
      await api.patch(`/api/organizations/${fiscalOrganizationId}`, {
        settings: {
          fiscalProvider: fiscalPayload,
        },
      });

      setFiscalMessage('Настройки кассы сохранены.');
      await fetchOrganizations();
    } catch (error) {
      setFiscalError(extractErrorMessage(error, 'Не удалось сохранить настройки кассы'));
    } finally {
      setFiscalSaving(false);
    }
  };

  const handleTestFiscalReceipt = async () => {
    if (!fiscalOrganizationId) return;

    setTestLoading(true);
    setTestError('');

    try {
      const response = await api.post(`/api/organizations/${fiscalOrganizationId}/fiscal/test`);
      const payload = response.data?.data as FiscalProviderTest | undefined;

      if (payload) {
        setLastFiscalTest(payload);
        setFiscalMessage('Пробный чек отправлен.');
      }
    } catch (error) {
      setTestError(extractErrorMessage(error, 'Не удалось отправить пробный чек'));
    } finally {
      setTestLoading(false);
    }
  };

  const handleOpenOrganization = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedId = organizationId.trim();

    if (!normalizedId) {
      return;
    }

    navigate(`/admin?organizationId=${encodeURIComponent(normalizedId)}`);
  };

  const handleAddNews = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = contentFromText(newsForm.content);
    const date = newsForm.date || new Intl.DateTimeFormat('ru-RU').format(new Date());
    setNewsDrafts((items) => [
      {
        slug: slugify(newsForm.title || date),
        date,
        title: newsForm.title || 'Без названия',
        description: newsForm.description || 'Описание обновления появится позже.',
        content: content.length ? content : ['Описание обновления появится позже.'],
      },
      ...items,
    ]);
    setNewsForm({ title: '', date: '', description: '', content: '' });
  };

  const handleAddInstruction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!instructionForm.title.trim() || !instructionForm.href.trim()) return;
    setInstructionDrafts((items) => [
      { title: instructionForm.title.trim(), href: instructionForm.href.trim() },
      ...items,
    ]);
    setInstructionForm({ title: '', href: '' });
  };

  const handleAddBlogPost = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = contentFromText(blogForm.content);
    const date = blogForm.date || new Intl.DateTimeFormat('ru-RU').format(new Date());
    setBlogDrafts((posts) => [
      {
        slug: slugify(blogForm.title || date),
        title: blogForm.title || 'Черновик поста',
        date,
        excerpt: blogForm.excerpt || 'Добавьте превью статьи.',
        content: content.length ? content : ['Содержимое статьи появится позже.'],
      },
      ...posts,
    ]);
    setBlogForm({ title: '', date: '', excerpt: '', content: '' });
  };

  const handleAddScreenshot = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!screenshotForm.title.trim() || !screenshotForm.description.trim()) return;
    setScreenshotDrafts((items) => [
      { title: screenshotForm.title.trim(), description: screenshotForm.description.trim() },
      ...items,
    ]);
    setScreenshotForm({ title: '', description: '' });
  };

  const fetchOrganizations = useCallback(async () => {
    setLoadingOrganizations(true);
    setOrganizationsError('');

    try {
      const response = await api.get('/api/organizations');
      const payload = response.data?.data ?? [];
      setOrganizations(payload);
    } catch (error) {
      setOrganizationsError(extractErrorMessage(error, 'Не удалось загрузить организации'));
    } finally {
      setLoadingOrganizations(false);
    }
  }, []);

  const fetchBillingSummary = useCallback(async () => {
    setBillingSummaryError('');

    try {
      const response = await api.get('/api/organizations/billing/summary');
      setBillingSummary(response.data?.data ?? null);
    } catch (error) {
      setBillingSummaryError(extractErrorMessage(error, 'Не удалось загрузить статистику по подпискам'));
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersError('');

    try {
      const response = await api.get('/api/organizations/users');
      const payload = response.data?.data ?? [];
      setUsers(payload);
    } catch (error) {
      setUsersError(extractErrorMessage(error, 'Не удалось загрузить пользователей'));
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrganizations();
    void fetchUsers();
    void fetchBillingSummary();
  }, [fetchBillingSummary, fetchOrganizations, fetchUsers]);

  useEffect(() => {
    if (!fiscalOrganizationId && organizations.length > 0) {
      setFiscalOrganizationId(organizations[0].id);
    }
  }, [fiscalOrganizationId, organizations]);

  useEffect(() => {
    if (!selectedFiscalOrganization) {
      return;
    }

    const provider = selectedFiscalOrganization.settings?.fiscalProvider;

    setFiscalForm({
      enabled: provider?.enabled ?? false,
      mode: provider?.mode ?? 'test',
      provider: 'atol',
      login: provider?.login ?? '',
      password: provider?.password ?? '',
      groupCode: provider?.groupCode ?? '',
      inn: provider?.inn ?? '',
      paymentAddress: provider?.paymentAddress ?? '',
      deviceId: provider?.deviceId ?? '',
    });
    setLastFiscalTest(provider?.lastTest ?? null);
  }, [selectedFiscalOrganization]);

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
      await fetchUsers();
    } catch (error) {
      setCreateError(extractErrorMessage(error, 'Не удалось создать организацию'));
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
      trialEndsAt: formatDateInputValue(organization.billing?.trialEndsAt ?? null),
      nextPaymentDueAt: formatDateInputValue(organization.billing?.nextPaymentDueAt ?? null),
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
        trialEndsAt: editForm.trialEndsAt || null,
        nextPaymentDueAt: editForm.nextPaymentDueAt || null,
      });

      await fetchOrganizations();
      setEditingOrganization(null);
    } catch (error) {
      setUpdateError(extractErrorMessage(error, 'Не удалось обновить организацию'));
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
      setOrganizationsError(extractErrorMessage(error, 'Не удалось удалить организацию'));
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const handleOpenUserEdit = (user: UserSummary) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organization?.id ?? '',
    });
    setUserUpdateError('');
  };

  const handleUpdateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingUser) return;

    setUserUpdateLoading(true);
    setUserUpdateError('');

    try {
      await api.patch(`/api/organizations/users/${editingUser.id}`, {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        organizationId: userForm.organizationId,
      });

      await fetchUsers();
      setEditingUser(null);
    } catch (error) {
      setUserUpdateError(extractErrorMessage(error, 'Не удалось обновить пользователя'));
    } finally {
      setUserUpdateLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmed = window.confirm('Удалить пользователя? Действие необратимо.');
    if (!confirmed) return;

    setDeleteUserId(userId);
    try {
      await api.delete(`/api/organizations/users/${userId}`);
      await fetchUsers();
    } catch (error) {
      setUsersError(extractErrorMessage(error, 'Не удалось удалить пользователя'));
    } finally {
      setDeleteUserId(null);
    }
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };

  const formatDateInputValue = (isoDate?: string | null) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);

  const formatCountdown = (days?: number) => {
    if (typeof days !== 'number') return '—';
    if (days <= 0) return 'Сегодня';
    return `${days} дн.`;
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

      <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Онлайн-касса АТОЛ</h2>
            <p className="text-sm text-slate-600">Управляйте реквизитами фискализации и отправляйте тестовый чек.</p>
          </div>
          <div className="flex flex-col gap-2 sm:w-80">
            <label className="text-sm font-semibold text-slate-700">Организация</label>
            <select
              value={fiscalOrganizationId}
              onChange={(event) => setFiscalOrganizationId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSaveFiscalSettings}>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={fiscalForm.enabled}
              onChange={(event) => handleFiscalFieldChange('enabled', event.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary/30"
            />
            <span>Фискализация включена</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Режим</span>
            <select
              value={fiscalForm.mode}
              onChange={(event) => handleFiscalFieldChange('mode', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
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
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Пароль</span>
            <input
              type="text"
              required={fiscalForm.enabled}
              value={fiscalForm.password}
              onChange={(event) => handleFiscalFieldChange('password', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Код группы</span>
            <input
              type="text"
              required={fiscalForm.enabled}
              value={fiscalForm.groupCode}
              onChange={(event) => handleFiscalFieldChange('groupCode', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">ИНН</span>
            <input
              type="text"
              required={fiscalForm.enabled}
              value={fiscalForm.inn}
              onChange={(event) => handleFiscalFieldChange('inn', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Адрес расчётов</span>
            <input
              type="text"
              required={fiscalForm.enabled}
              value={fiscalForm.paymentAddress}
              onChange={(event) => handleFiscalFieldChange('paymentAddress', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">ID устройства</span>
            <input
              type="text"
              value={fiscalForm.deviceId}
              onChange={(event) => handleFiscalFieldChange('deviceId', event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
              placeholder="Опционально"
            />
          </label>

          <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm text-slate-600">
              {fiscalError && <div className="text-rose-600">{fiscalError}</div>}
              {testError && <div className="text-rose-600">{testError}</div>}
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
                className="rounded-xl border border-primary/40 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testLoading ? 'Отправляем…' : 'Пробный чек'}
              </button>
              <button
                type="submit"
                disabled={fiscalSaving}
                className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/70"
              >
                {fiscalSaving ? 'Сохраняем…' : 'Сохранить настройки'}
              </button>
            </div>
          </div>
        </form>
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

      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Биллинг по организациям</h2>
            <p className="text-sm text-slate-600">
              Следите за триалами и платными планами, чтобы продления не проходили незамеченными.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchBillingSummary()}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary"
          >
            Обновить
          </button>
        </div>

        {billingSummaryError && (
          <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {billingSummaryError}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Всего организаций</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{billingSummary?.totalOrganizations ?? '—'}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Триал</p>
            <p className="mt-2 text-2xl font-bold text-amber-900">
              {billingSummary ? `${billingSummary.activeTrials} активных` : '—'}
            </p>
            <p className="text-sm text-amber-800">{billingSummary ? `${billingSummary.expiredTrials} завершено` : '—'}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Платные</p>
            <p className="mt-2 text-2xl font-bold text-emerald-900">
              {billingSummary ? `${billingSummary.activePaid} активных` : '—'}
            </p>
            <p className="text-sm text-emerald-800">{billingSummary ? `${billingSummary.pausedPaid} на паузе` : '—'}</p>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Выручка</p>
            <p className="mt-2 text-2xl font-bold text-indigo-900">
              {billingSummary ? formatCurrency(billingSummary.projectedMrr) : '—'} / мес
            </p>
            <p className="text-sm text-indigo-800">
              {billingSummary ? `Ожидаем ${formatCurrency(billingSummary.expectedNext30DaysRevenue)} в 30 дней` : '—'}
            </p>
          </div>
        </div>
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
                <th className="px-4 py-3">Оплата</th>
                <th className="px-4 py-3 text-right">Создана</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingOrganizations ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Загружаем организации…
                  </td>
                </tr>
              ) : organizations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
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
                    <td className="px-4 py-4 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">
                        {organization.billing?.plan === 'paid' ? 'Оплачено' : 'Триал'}
                      </div>
                      <div className="text-xs text-slate-600">
                        {organization.billing?.plan === 'trial'
                          ? organization.billing?.trialEndsAt
                            ? `До конца: ${formatCountdown(organization.billing?.daysLeftInTrial)}`
                            : 'Триал завершён'
                          : organization.billing?.nextPaymentDueAt
                            ? `След. платёж: ${formatDate(organization.billing?.nextPaymentDueAt)}`
                            : 'Счет запланирован'}
                      </div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {organization.billing ? `${formatCurrency(organization.billing.monthlyPrice)} / мес` : '—'}
                      </div>
                    </td>
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

      <section id="users" className="mt-10 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Все пользователи</h2>
            <p className="text-sm text-slate-600">Отслеживайте, кто к какой организации привязан, и управляйте доступами.</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">Всего: {users.length}</span>
            <button
              type="button"
              onClick={() => void fetchUsers()}
              disabled={loadingUsers}
              className="rounded-xl bg-primary px-4 py-2 font-semibold text-white shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/70"
            >
              {loadingUsers ? 'Обновляем…' : 'Обновить'}
            </button>
          </div>
        </div>

        {usersError && (
          <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{usersError}</div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-3 pr-4">Пользователь</th>
                <th className="px-4 py-3">Роль</th>
                <th className="px-4 py-3">Организация</th>
                <th className="px-4 py-3 text-right">Создан</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingUsers ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Загружаем пользователей…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Пока нет пользователей. Создайте организацию или добавьте сотрудников.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="align-top">
                    <td className="py-4 pr-4">
                      <div className="font-semibold text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {user.organization ? (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-slate-900">{user.organization.name}</div>
                          <div className="text-xs text-slate-500">ID: {user.organization.id}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Не привязан</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-xs font-medium text-slate-600">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-4 text-right text-xs font-medium text-slate-600">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenUserEdit(user)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={deleteUserId === user.id}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {deleteUserId === user.id ? 'Удаляем…' : 'Удалить'}
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

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Дата конца trial</span>
                  <input
                    type="date"
                    value={editForm.trialEndsAt}
                    onChange={(event) => setEditForm((form) => ({ ...form, trialEndsAt: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Следующий платёж</span>
                  <input
                    type="date"
                    value={editForm.nextPaymentDueAt}
                    onChange={(event) => setEditForm((form) => ({ ...form, nextPaymentDueAt: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
                  />
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

      {editingUser && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Редактировать пользователя</h3>
                <p className="text-sm text-slate-600">Обновите контактные данные, роль и организацию.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-500 transition hover:text-slate-900"
              >
                ✕
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleUpdateUser}>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Имя</span>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(event) => setUserForm((form) => ({ ...form, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(event) => setUserForm((form) => ({ ...form, email: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Роль</span>
                  <select
                    value={userForm.role}
                    onChange={(event) => setUserForm((form) => ({ ...form, role: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  >
                    {userRoles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">ID организации</span>
                <input
                  type="text"
                  value={userForm.organizationId}
                  onChange={(event) => setUserForm((form) => ({ ...form, organizationId: event.target.value }))}
                  placeholder="Оставьте пустым, чтобы отвязать"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 shadow-inner shadow-slate-100 outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
                />
              </label>

              {userUpdateError && <div className="text-sm text-rose-600">{userUpdateError}</div>}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={userUpdateLoading}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/70"
                >
                  {userUpdateLoading ? 'Сохраняем…' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section
        id="content-management"
        className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/70 lg:mt-8"
      >
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-slate-900">Контент: новости, блог, инструкции и скриншоты</h2>
          <p className="text-sm text-slate-600">
            /docs занят Swagger API, поэтому весь управляемый контент вынесен в суперадминку: обновления, инструкции, блог и
            галерея скриншотов лендинга. Добавляйте записи — данные можно выгрузить в CMS или передать редакторам.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Новости / changelog</p>
                <h3 className="text-lg font-semibold text-slate-900">Что нового</h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-secondary shadow-inner">CMS-ready</span>
            </div>
            <form className="grid gap-3" onSubmit={handleAddNews}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Название
                  <input
                    type="text"
                    value={newsForm.title}
                    onChange={(event) => setNewsForm((form) => ({ ...form, title: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    placeholder="Добавлен блог"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Дата
                  <input
                    type="text"
                    value={newsForm.date}
                    onChange={(event) => setNewsForm((form) => ({ ...form, date: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    placeholder="05.12.2025"
                  />
                </label>
              </div>
              <label className="text-sm text-slate-700">
                Превью
                <input
                  type="text"
                  value={newsForm.description}
                  onChange={(event) => setNewsForm((form) => ({ ...form, description: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  placeholder="Описание на лендинге"
                />
              </label>
              <label className="text-sm text-slate-700">
                Полный текст (каждый абзац с новой строки)
                <textarea
                  value={newsForm.content}
                  onChange={(event) => setNewsForm((form) => ({ ...form, content: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  rows={3}
                  placeholder="Расскажите, что обновили"
                />
              </label>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-secondary/90"
              >
                Сохранить запись в драфты
              </button>
            </form>
            <div className="space-y-2 text-sm text-slate-700">
              {newsDrafts.slice(0, 4).map((item) => (
                <div key={item.slug} className="rounded-lg bg-white px-3 py-2 shadow-inner shadow-slate-100">
                  <div className="text-xs font-semibold uppercase tracking-wide text-secondary">{item.date}</div>
                  <div className="font-semibold text-slate-900">{item.title}</div>
                  <div className="text-slate-600">{item.description}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Инструкции /help</p>
                  <h4 className="text-base font-semibold text-slate-900">Ссылки для планшетов</h4>
                </div>
                <span className="text-xs font-semibold text-slate-500">{instructionDrafts.length} шт.</span>
              </div>
              <form className="grid gap-3 sm:grid-cols-[1.3fr_1fr]" onSubmit={handleAddInstruction}>
                <input
                  type="text"
                  required
                  value={instructionForm.title}
                  onChange={(event) => setInstructionForm((form) => ({ ...form, title: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
                  placeholder="Как подключить кассу"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={instructionForm.href}
                    onChange={(event) => setInstructionForm((form) => ({ ...form, href: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
                    placeholder="/help#fiscal"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
                  >
                    Добавить
                  </button>
                </div>
              </form>
              <div className="space-y-2 text-sm text-slate-700">
                {instructionDrafts.slice(0, 4).map((item) => (
                  <div key={`${item.title}-${item.href}`} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                    <div>
                      <div className="font-semibold text-slate-900">{item.title}</div>
                      <div className="text-xs text-slate-500">{item.href}</div>
                    </div>
                    <span className="text-xs font-semibold text-secondary">/help</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Блог</p>
                <h3 className="text-lg font-semibold text-slate-900">Статьи для владельцев</h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-secondary shadow-inner">/blog</span>
            </div>
            <form className="grid gap-3" onSubmit={handleAddBlogPost}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Заголовок
                  <input
                    type="text"
                    value={blogForm.title}
                    onChange={(event) => setBlogForm((form) => ({ ...form, title: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    placeholder="Новый пост"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Дата
                  <input
                    type="text"
                    value={blogForm.date}
                    onChange={(event) => setBlogForm((form) => ({ ...form, date: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    placeholder="07.12.2025"
                  />
                </label>
              </div>
              <label className="text-sm text-slate-700">
                Превью
                <input
                  type="text"
                  value={blogForm.excerpt}
                  onChange={(event) => setBlogForm((form) => ({ ...form, excerpt: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  placeholder="Короткое описание"
                />
              </label>
              <label className="text-sm text-slate-700">
                Текст статьи (абзацы через новую строку)
                <textarea
                  value={blogForm.content}
                  onChange={(event) => setBlogForm((form) => ({ ...form, content: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  rows={3}
                  placeholder="Контент для /blog/:slug"
                />
              </label>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
              >
                Сохранить пост
              </button>
            </form>
            <div className="space-y-2 text-sm text-slate-700">
              {blogDrafts.slice(0, 4).map((post) => (
                <div key={post.slug} className="rounded-lg bg-white px-3 py-2 shadow-inner shadow-slate-100">
                  <div className="text-xs font-semibold uppercase tracking-wide text-secondary">{post.date}</div>
                  <div className="font-semibold text-slate-900">{post.title}</div>
                  <div className="text-slate-600">{post.excerpt}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Скриншоты лендинга</p>
                  <h4 className="text-base font-semibold text-slate-900">Галерея / демо</h4>
                </div>
                <span className="text-xs font-semibold text-slate-500">{screenshotDrafts.length} шт.</span>
              </div>
              <form className="grid gap-3 sm:grid-cols-[1.1fr_1.2fr_auto]" onSubmit={handleAddScreenshot}>
                <input
                  type="text"
                  required
                  value={screenshotForm.title}
                  onChange={(event) => setScreenshotForm((form) => ({ ...form, title: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
                  placeholder="Касса"
                />
                <input
                  type="text"
                  required
                  value={screenshotForm.description}
                  onChange={(event) => setScreenshotForm((form) => ({ ...form, description: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20"
                  placeholder="Описание для подписи"
                />
                <button
                  type="submit"
                  className="mt-2 h-[38px] shrink-0 rounded-lg border border-secondary/40 px-3 text-xs font-semibold text-secondary transition hover:bg-secondary/10 sm:mt-0"
                >
                  Добавить
                </button>
              </form>
              <div className="space-y-2 text-sm text-slate-700">
                {screenshotDrafts.slice(0, 4).map((item) => (
                  <div key={`${item.title}-${item.description}`} className="rounded-md bg-slate-50 px-3 py-2">
                    <div className="font-semibold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

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
