import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../lib/api';
import { useToast } from '../providers/ToastProvider';
import type { Category, ModifierGroup, Product } from '../store/catalog';
import { useRestaurantStore } from '../store/restaurant';

const getResponseData = <T,>(response: { data?: unknown }): T | undefined => {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const payload = (response as { data?: unknown }).data;

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data?: T }).data;
  }

  return payload as T | undefined;
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    const responseError =
      typeof error.response?.data === 'object' && error.response?.data !== null
        ? (error.response?.data as { error?: unknown }).error
        : undefined;

    if (typeof responseError === 'string' && responseError.trim()) {
      return responseError.trim();
    }
  }

  return fallback;
};

type Ingredient = {
  _id: string;
  name: string;
  unit: string;
  costPerUnit?: number;
  supplierId?: string;
  description?: string;
};

type Supplier = {
  _id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
};

type Warehouse = {
  _id: string;
  name: string;
  location?: string;
  description?: string;
  lastInventoryAt?: string;
};

type InventoryItem = {
  _id: string;
  warehouseId: string;
  itemType: 'ingredient' | 'product';
  itemId: string;
  quantity: number;
  unitCost?: number;
  warehouse?: Warehouse | null;
  ingredient?: Ingredient | null;
  product?: Product | null;
};

type InventorySummary = {
  productsTracked: number;
  ingredientsTracked: number;
  stockValue: number;
};

type StockReceiptItem = {
  itemType: 'ingredient' | 'product';
  itemId: string;
  quantity: number;
  unitCost: number;
};

type StockReceipt = {
  _id: string;
  type: 'receipt' | 'writeOff' | 'inventory';
  occurredAt: string;
  warehouseId: string;
  supplierId?: string;
  createdAt?: string;
  updatedAt?: string;
  items: StockReceiptItem[];
};

type InventoryAuditItem = {
  itemType: 'ingredient' | 'product';
  itemId: string;
  previousQuantity: number;
  countedQuantity: number;
  difference: number;
  unitCostSnapshot?: number;
};

type InventoryAudit = {
  _id: string;
  warehouseId: string;
  performedBy: string;
  performedAt: string;
  totalLossValue: number;
  totalGainValue: number;
  items: InventoryAuditItem[];
};

type CashierSummary = {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
};

type SalesAndShiftStats = {
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  openShiftCount: number;
  closedShiftCount: number;
  currentOpenShiftCount: number;
  averageRevenuePerClosedShift: number;
  takeawayOrders: number;
  deliveryOrders: number;
  period?: {
    from?: string;
    to?: string;
  };
};

type LegacySalesAndShiftStats = {
  orders?: {
    totalOrders?: number;
    totalRevenue?: number;
  } | null;
  shifts?:
    | Array<{
        status?: 'open' | 'closed';
        totals?: {
          total?: number;
        } | null;
      }>
    | null;
};

const normalizeNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const unitKey = (fromUnit?: string | null, toUnit?: string | null) =>
  `${(fromUnit ?? '').toLowerCase()}->${(toUnit ?? '').toLowerCase()}`;

const CONVERSION_FACTORS = new Map<string, number>([
  ['гр->кг', 0.001],
  ['г->кг', 0.001],
  ['кг->гр', 1000],
  ['кг->г', 1000],
  ['мл->л', 0.001],
  ['л->мл', 1000],
]);

const convertQuantity = (quantity: number, fromUnit?: string | null, toUnit?: string | null): number => {
  if (!Number.isFinite(quantity) || quantity === 0) {
    return 0;
  }

  if (!fromUnit || !toUnit || fromUnit === toUnit) {
    return quantity;
  }

  const factor = CONVERSION_FACTORS.get(unitKey(fromUnit, toUnit));

  if (!factor) {
    return quantity;
  }

  return quantity * factor;
};

const normalizeSalesAndShiftStats = (
  payload?: SalesAndShiftStats | LegacySalesAndShiftStats | null
): SalesAndShiftStats | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if ('totalRevenue' in payload || 'orderCount' in payload || 'openShiftCount' in payload) {
    const stats = payload as Partial<SalesAndShiftStats>;
    return {
      totalRevenue: normalizeNumber(stats.totalRevenue),
      orderCount: normalizeNumber(stats.orderCount),
      averageOrderValue: normalizeNumber(stats.averageOrderValue),
      openShiftCount: normalizeNumber(stats.openShiftCount),
      closedShiftCount: normalizeNumber(stats.closedShiftCount),
      currentOpenShiftCount: normalizeNumber(stats.currentOpenShiftCount),
      averageRevenuePerClosedShift: normalizeNumber(stats.averageRevenuePerClosedShift),
      takeawayOrders: normalizeNumber(stats.takeawayOrders),
      deliveryOrders: normalizeNumber(stats.deliveryOrders),
      period:
        stats.period && typeof stats.period === 'object'
          ? {
              ...(typeof stats.period.from === 'string' ? { from: stats.period.from } : {}),
              ...(typeof stats.period.to === 'string' ? { to: stats.period.to } : {}),
            }
          : undefined,
    };
  }

  if ('orders' in payload || 'shifts' in payload) {
    const legacy = payload as LegacySalesAndShiftStats;
    const totalRevenue = normalizeNumber(legacy.orders?.totalRevenue);
    const orderCount = normalizeNumber(legacy.orders?.totalOrders);
    let openShiftCount = 0;
    let closedShiftCount = 0;
    let totalClosedRevenue = 0;

    for (const shift of legacy.shifts ?? []) {
      if (!shift || typeof shift !== 'object') {
        continue;
      }

      if (shift.status === 'open') {
        openShiftCount += 1;
      } else if (shift.status === 'closed') {
        closedShiftCount += 1;
        totalClosedRevenue += normalizeNumber(shift.totals?.total);
      }
    }

    return {
      totalRevenue,
      orderCount,
      averageOrderValue: orderCount > 0 ? totalRevenue / orderCount : 0,
      openShiftCount,
      closedShiftCount,
      currentOpenShiftCount: openShiftCount,
      averageRevenuePerClosedShift:
        closedShiftCount > 0 ? totalClosedRevenue / closedShiftCount : 0,
      takeawayOrders: 0,
      deliveryOrders: 0,
    };
  }

  return null;
};

type LoyaltyPointSummary = {
  totalPointsIssued: number;
  totalPointsRedeemed: number;
};

type Customer = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  points: number;
  totalSpent: number;
};

type ModifierIngredientDelta = {
  ingredientId: string;
  delta: string;
  unit?: string;
};

type ModifierOptionForm = {
  name: string;
  priceChange: string;
  costChange: string;
  ingredientDeltas: ModifierIngredientDelta[];
};

type AdminDiscount = {
  _id: string;
  name: string;
  description?: string;
  type: 'fixed' | 'percentage';
  scope: 'order' | 'category' | 'product';
  value: number;
  categoryId?: string;
  productId?: string;
  targetName?: string;
  autoApply: boolean;
  autoApplyDays?: number[];
  autoApplyStart?: string;
  autoApplyEnd?: string;
  isActive: boolean;
};

type ReceiptHistoryOrder = {
  _id: string;
  total: number;
  createdAt: string;
  paymentMethod?: 'cash' | 'card';
  items: Array<{ name: string; qty: number; total: number }>;
  customerName?: string;
  cashierName?: string;
};

const formatHistoryTime = (value: string): string =>
  new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const mapReceiptHistoryOrder = (payload: any): ReceiptHistoryOrder => {
  const id = payload?._id ?? payload?.id ?? `${Date.now()}-${Math.random()}`;
  const createdAt =
    typeof payload?.createdAt === 'string'
      ? payload.createdAt
      : payload?.createdAt
        ? new Date(payload.createdAt).toISOString()
        : new Date().toISOString();

  const items = Array.isArray(payload?.items)
    ? payload.items.map((item: any) => ({
        name: typeof item?.name === 'string' ? item.name : 'Позиция',
        qty: typeof item?.qty === 'number' ? item.qty : 0,
        total: typeof item?.total === 'number' ? item.total : 0,
      }))
    : [];

  const paymentMethod = payload?.payment?.method;
  const customerName =
    typeof payload?.customerId?.name === 'string'
      ? payload.customerId.name
      : typeof payload?.customerName === 'string'
        ? payload.customerName
        : undefined;
  const cashierName =
    typeof payload?.cashierId?.name === 'string' ? payload.cashierId.name : undefined;

  return {
    _id: String(id),
    total: typeof payload?.total === 'number' ? payload.total : 0,
    createdAt,
    paymentMethod: paymentMethod === 'cash' || paymentMethod === 'card' ? paymentMethod : undefined,
    items,
    customerName,
    cashierName,
  };
};

const DAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
];

const AdminPage: React.FC = () => {
  const { notify } = useToast();
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'menu' | 'inventory' | 'loyalty' | 'suppliers' | 'discounts' | 'staff' | 'branding'
  >('dashboard');
  const [menuSection, setMenuSection] = useState<'products' | 'categories' | 'ingredients' | 'modifiers'>(
    'products'
  );
  const [loyaltySection, setLoyaltySection] = useState<'settings' | 'guests'>('settings');
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [summary, setSummary] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    avgCheck: 0,
    totalCustomers: 0,
    totalPointsIssued: 0,
    totalPointsRedeemed: 0,
  });
  const [daily, setDaily] = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number }[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; totalSpent: number }[]>([]);
  const [salesShiftStats, setSalesShiftStats] = useState<SalesAndShiftStats | null>(null);
  const [salesStatsLoading, setSalesStatsLoading] = useState(false);
  const [salesStatsError, setSalesStatsError] = useState<string | null>(null);
  const [salesStatsFilters, setSalesStatsFilters] = useState({ from: '', to: '' });
  const [salesStatsLoaded, setSalesStatsLoaded] = useState(false);
  const [receiptHistoryDate, setReceiptHistoryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptHistory, setReceiptHistory] = useState<ReceiptHistoryOrder[]>([]);
  const [receiptHistoryLoading, setReceiptHistoryLoading] = useState(false);
  const [receiptHistoryError, setReceiptHistoryError] = useState<string | null>(null);

  const [menuLoading, setMenuLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    categoryId: '',
    basePrice: '',
    discountType: '' as '' | 'percentage' | 'fixed',
    discountValue: '',
    imageUrl: '',
  });
  const [newProductModifierIds, setNewProductModifierIds] = useState<string[]>([]);
  const [productIngredients, setProductIngredients] = useState<
    Array<{ ingredientId: string; quantity: string; unit?: string }>
  >([{ ingredientId: '', quantity: '', unit: '' }]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryEditName, setCategoryEditName] = useState('');
  const [categorySortOrder, setCategorySortOrder] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productEditForm, setProductEditForm] = useState({
    name: '',
    description: '',
    imageUrl: '',
    categoryId: '',
    price: '',
    basePrice: '',
    discountType: '' as '' | 'percentage' | 'fixed',
    discountValue: '',
    isActive: true,
  });
  const [productEditModifiers, setProductEditModifiers] = useState<string[]>([]);
  const [productEditIngredients, setProductEditIngredients] = useState<
    Array<{ ingredientId: string; quantity: string; unit?: string }>
  >([]);
  const [selectedModifierGroup, setSelectedModifierGroup] = useState<ModifierGroup | null>(null);
  const [modifierGroupForm, setModifierGroupForm] = useState({
    name: '',
    selectionType: 'single' as 'single' | 'multiple',
    required: false,
    sortOrder: '',
    options: [
      {
        name: '',
        priceChange: '',
        costChange: '',
        ingredientDeltas: [] as ModifierOptionForm['ingredientDeltas'],
      },
    ],
  });
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [ingredientEditForm, setIngredientEditForm] = useState({
    name: '',
    unit: '',
    costPerUnit: '',
    supplierId: '',
    description: '',
  });

  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [newWarehouse, setNewWarehouse] = useState({ name: '', location: '', description: '' });
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [warehouseEditForm, setWarehouseEditForm] = useState({ name: '', location: '', description: '' });
  const [receiptForm, setReceiptForm] = useState({
    warehouseId: '',
    supplierId: '',
    items: [
      {
        itemType: 'ingredient' as 'ingredient' | 'product',
        itemId: '',
        quantity: '',
        unitCost: '',
      },
    ],
  });
  const [receiptType, setReceiptType] = useState<'receipt' | 'writeOff'>('receipt');
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [stockReceipts, setStockReceipts] = useState<StockReceipt[]>([]);
  const [stockReceiptsLoading, setStockReceiptsLoading] = useState(false);
  const [stockReceiptsError, setStockReceiptsError] = useState<string | null>(null);
  const [selectedStockReceipt, setSelectedStockReceipt] = useState<StockReceipt | null>(null);
  const [receiptFilter, setReceiptFilter] = useState<'all' | StockReceipt['type']>('all');
  const [inventoryAuditForm, setInventoryAuditForm] = useState({
    warehouseId: '',
    performedAt: new Date().toISOString().slice(0, 10),
    items: [] as Array<{ itemType: 'ingredient' | 'product'; itemId: string; countedQuantity: string }>,
  });
  const [auditSubmitting, setAuditSubmitting] = useState(false);
  const [lastAuditResult, setLastAuditResult] = useState<InventoryAudit | null>(null);

  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierEditForm, setSupplierEditForm] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });
  const [cashiers, setCashiers] = useState<CashierSummary[]>([]);
  const [cashiersLoading, setCashiersLoading] = useState(false);
  const [cashiersLoaded, setCashiersLoaded] = useState(false);
  const [cashiersError, setCashiersError] = useState<string | null>(null);
  const [cashierForm, setCashierForm] = useState({ name: '', email: '', password: '' });
  const [creatingCashier, setCreatingCashier] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerEditForm, setCustomerEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    points: '',
    totalSpent: '',
  });
  const [discounts, setDiscounts] = useState<AdminDiscount[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [discountsReady, setDiscountsReady] = useState(false);
  const [discountsError, setDiscountsError] = useState<string | null>(null);
  const [discountActionId, setDiscountActionId] = useState<string | null>(null);
  const [creatingDiscount, setCreatingDiscount] = useState(false);
  const restaurantName = useRestaurantStore((state) => state.name);
  const restaurantLogo = useRestaurantStore((state) => state.logoUrl);
  const enableOrderTags = useRestaurantStore((state) => state.enableOrderTags);
  const measurementUnits = useRestaurantStore((state) => state.measurementUnits);
  const loyaltyRate = useRestaurantStore((state) => state.loyaltyRate);
  const updateRestaurantBranding = useRestaurantStore((state) => state.updateBranding);
  const resetRestaurantBranding = useRestaurantStore((state) => state.resetBranding);
  const [loyaltyRateDraft, setLoyaltyRateDraft] = useState(loyaltyRate.toString());
  const [savingLoyaltyRate, setSavingLoyaltyRate] = useState(false);
  const [brandingForm, setBrandingForm] = useState({ name: restaurantName, logoUrl: restaurantLogo });
  const [brandingSaving, setBrandingSaving] = useState(false);

  useEffect(() => {
    setBrandingForm({ name: restaurantName, logoUrl: restaurantLogo });
  }, [restaurantName, restaurantLogo]);
  const [discountForm, setDiscountForm] = useState({
    name: '',
    description: '',
    type: 'percentage' as 'percentage' | 'fixed',
    scope: 'order' as 'order' | 'category' | 'product',
    value: '',
    categoryId: '',
    productId: '',
    autoApply: false,
    autoApplyDays: [] as number[],
    autoApplyStart: '',
    autoApplyEnd: '',
  });

  useEffect(() => {
    if (!inventoryAuditForm.warehouseId || inventoryAuditForm.items.length > 0) {
      return;
    }

    const defaults = inventoryItems
      .filter((item) => item.warehouseId === inventoryAuditForm.warehouseId)
      .map((item) => ({
        itemType: item.itemType,
        itemId: item.itemId,
        countedQuantity: item.quantity.toString(),
      }));

    setInventoryAuditForm((prev) => ({
      ...prev,
      items:
        defaults.length > 0
          ? defaults
          : [
              {
                itemType: 'ingredient',
                itemId: '',
                countedQuantity: '',
              },
            ],
    }));
  }, [inventoryAuditForm.items.length, inventoryAuditForm.warehouseId, inventoryItems]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoadingDashboard(true);
      const [summaryRes, dailyRes, productsRes, customersRes] = await Promise.all([
        api.get('/api/reports/summary'),
        api.get('/api/reports/daily'),
        api.get('/api/reports/top-products'),
        api.get('/api/reports/top-customers'),
      ]);
      setSummary(summaryRes.data.data);
      setDaily(dailyRes.data.data);
      setTopProducts(productsRes.data.data);
      setTopCustomers(customersRes.data.data);
    } catch (error) {
      notify({ title: 'Не удалось загрузить отчеты', type: 'error' });
    } finally {
      setLoadingDashboard(false);
    }
  }, [notify]);

  const loadSalesAndShiftStats = useCallback(
    async (filters?: { from?: string; to?: string }) => {
      setSalesStatsLoading(true);
      setSalesStatsError(null);
      try {
        const params = {
          ...(filters?.from ? { from: filters.from } : {}),
          ...(filters?.to ? { to: filters.to } : {}),
        };

        const response = await api.get('/api/admin/stats/sales-and-shifts', {
          params,
        });

        const payload = getResponseData<SalesAndShiftStats | LegacySalesAndShiftStats>(response);
        setSalesShiftStats(normalizeSalesAndShiftStats(payload));
      } catch (error) {
        console.error('Не удалось загрузить статистику смен', error);
        let message = 'Не удалось загрузить статистику смен';
        if (isAxiosError(error)) {
          const responseError =
            typeof error.response?.data === 'object' && error.response?.data !== null
              ? (error.response?.data as { error?: unknown }).error
              : undefined;
          if (typeof responseError === 'string' && responseError.trim()) {
            message = responseError.trim();
          }
        }
        setSalesStatsError(message);
        notify({ title: message, type: 'error' });
      } finally {
        setSalesStatsLoading(false);
        setSalesStatsLoaded(true);
      }
    },
    [notify]
  );

  const loadReceiptHistory = useCallback(
    async (date: string) => {
      setReceiptHistoryLoading(true);
      setReceiptHistoryError(null);
      try {
        const response = await api.get('/api/orders/history/by-date', {
          params: { date },
        });
        const data = Array.isArray(response.data?.data) ? response.data.data : [];
        setReceiptHistory(data.map((order: unknown) => mapReceiptHistoryOrder(order)));
      } catch (error) {
        console.error('Не удалось загрузить историю чеков', error);
        setReceiptHistoryError('Не удалось загрузить историю чеков');
        notify({ title: 'Не удалось загрузить историю чеков', type: 'error' });
      } finally {
        setReceiptHistoryLoading(false);
      }
    },
    [notify]
  );

  const loadMenuData = useCallback(async () => {
    setMenuLoading(true);
    try {
      let aggregatedModifiers: ModifierGroup[] | null = null;

      try {
        const response = await api.get('/api/admin/catalog');
        const payload = getResponseData<{
          categories?: Category[];
          products?: Product[];
          ingredients?: Ingredient[];
          modifierGroups?: ModifierGroup[];
        }>(response);

        setCategories(payload?.categories ?? []);
        setProducts(payload?.products ?? []);
        setIngredients(payload?.ingredients ?? []);
        if (payload?.modifierGroups) {
          aggregatedModifiers = payload.modifierGroups;
          setModifierGroups(payload.modifierGroups);
        }
      } catch (primaryError) {
        console.warn('Админский агрегированный каталог недоступен, выполняем поэлементную загрузку', primaryError);
        const [categoriesRes, productsRes, ingredientsRes, modifierGroupsRes] = await Promise.all([
          api.get('/api/catalog/categories'),
          api.get('/api/catalog/products', { params: { includeInactive: true } }),
          api.get('/api/catalog/ingredients'),
          api.get('/api/catalog/modifier-groups'),
        ]);

        setCategories(getResponseData<Category[]>(categoriesRes) ?? []);
        setProducts(getResponseData<Product[]>(productsRes) ?? []);
        setIngredients(getResponseData<Ingredient[]>(ingredientsRes) ?? []);
        setModifierGroups(getResponseData<ModifierGroup[]>(modifierGroupsRes) ?? []);
      }

      if (!aggregatedModifiers) {
        try {
          const modifierGroupsRes = await api.get('/api/catalog/modifier-groups');
          setModifierGroups(getResponseData<ModifierGroup[]>(modifierGroupsRes) ?? []);
        } catch (modifierError) {
          console.error('Не удалось загрузить модификаторы', modifierError);
          notify({ title: 'Не удалось загрузить модификаторы', type: 'error' });
        }
      }

      if (!aggregatedModifiers) {
        try {
          const modifierGroupsRes = await api.get('/api/catalog/modifier-groups');
          setModifierGroups(getResponseData<ModifierGroup[]>(modifierGroupsRes) ?? []);
        } catch (modifierError) {
          console.error('Не удалось загрузить модификаторы', modifierError);
          notify({ title: 'Не удалось загрузить модификаторы', type: 'error' });
        }
      }
    } catch (error) {
      console.error('Не удалось загрузить меню', error);
      notify({ title: 'Не удалось загрузить меню', type: 'error' });
    } finally {
      setMenuLoading(false);
    }
  }, [notify]);

  const loadInventoryData = useCallback(async () => {
    setInventoryLoading(true);
    try {
      try {
        const response = await api.get('/api/admin/inventory');
        const payload = getResponseData<{
          warehouses?: Warehouse[];
          items?: InventoryItem[];
          summary?: InventorySummary | null;
        }>(response);

        setWarehouses(payload?.warehouses ?? []);
        setInventoryItems(payload?.items ?? []);
        setInventorySummary(payload?.summary ?? null);
        return;
      } catch (primaryError) {
        console.warn('Агрегированный склад недоступен, выполняем загрузку по эндпоинтам', primaryError);
        const [warehousesRes, itemsRes, summaryRes] = await Promise.all([
          api.get('/api/inventory/warehouses'),
          api.get('/api/inventory/items'),
          api.get('/api/inventory/summary'),
        ]);

        setWarehouses(getResponseData<Warehouse[]>(warehousesRes) ?? []);
        setInventoryItems(getResponseData<InventoryItem[]>(itemsRes) ?? []);
        setInventorySummary(getResponseData<InventorySummary | null>(summaryRes) ?? null);
      }
    } catch (error) {
      console.error('Не удалось загрузить складские данные', error);
      notify({ title: 'Не удалось загрузить склад', type: 'error' });
    } finally {
      setInventoryLoading(false);
    }
  }, [notify]);

  const normalizeReceiptPayload = (
    payload: unknown
  ): StockReceipt[] | undefined => {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      const withReceipts = payload as { receipts?: unknown; data?: unknown };
      const nestedData = withReceipts.data as
        | undefined
        | { receipts?: unknown; data?: unknown };

      const candidates = [
        withReceipts.receipts,
        nestedData && (nestedData as { receipts?: unknown }).receipts,
        nestedData && (nestedData as { data?: unknown }).data,
      ];

      for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
          return candidate as StockReceipt[];
        }
      }
    }

    return undefined;
  };

  const loadStockReceipts = useCallback(async () => {
    setStockReceiptsLoading(true);
    setStockReceiptsError(null);

    try {
      let lastError: unknown;

      for (const endpoint of ['/api/admin/inventory/receipts', '/api/inventory/receipts']) {
        try {
          const response = await api.get(endpoint);
          const payload = getResponseData<
            StockReceipt[] | { receipts?: StockReceipt[]; data?: unknown }
          >(response);
          const normalizedReceipts = normalizeReceiptPayload(payload ?? response?.data);

          setStockReceipts(Array.isArray(normalizedReceipts) ? normalizedReceipts : []);
          lastError = undefined;
          break;
        } catch (error) {
          if (isAxiosError(error) && error.response?.status === 404) {
            lastError = error;
            continue;
          }

          throw error;
        }
      }

      if (lastError) {
        throw lastError;
      }
    } catch (error) {
      const message = extractErrorMessage(error, 'Не удалось загрузить документы склада');
      console.error(message, error);
      setStockReceiptsError(message);
      notify({ title: message, type: 'error' });
    } finally {
      setStockReceiptsLoading(false);
    }
  }, [notify]);

  const loadSuppliersData = useCallback(async () => {
    setSuppliersLoading(true);
    try {
      try {
        const response = await api.get('/api/admin/suppliers');
        const payload = getResponseData<{ suppliers?: Supplier[] }>(response);
        setSuppliers(payload?.suppliers ?? []);
        return;
      } catch (primaryError) {
        console.warn('Агрегированный список поставщиков недоступен, выполняем прямой запрос', primaryError);
        const fallbackResponse = await api.get('/api/suppliers');
        setSuppliers(getResponseData<Supplier[]>(fallbackResponse) ?? []);
      }
    } catch (error) {
      console.error('Не удалось загрузить поставщиков', error);
      notify({ title: 'Не удалось загрузить поставщиков', type: 'error' });
    } finally {
      setSuppliersLoading(false);
    }
  }, [notify]);

  const warehouseMap = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse._id, warehouse])), [warehouses]);
  const supplierMap = useMemo(() => new Map(suppliers.map((supplier) => [supplier._id, supplier])), [suppliers]);
  const ingredientMap = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient._id, ingredient])),
    [ingredients]
  );
  const productMap = useMemo(() => new Map(products.map((product) => [product._id, product])), [products]);

  const receiptTypeLabels: Record<StockReceipt['type'], string> = useMemo(
    () => ({
      receipt: 'Поставка',
      writeOff: 'Списание',
      inventory: 'Инвентаризация',
    }),
    []
  );

  const formatReceiptDateTime = useCallback((value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString('ru-RU', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }, []);

  const calculateReceiptTotal = useCallback((receipt: StockReceipt) => {
    const sign = receipt.type === 'writeOff' ? -1 : 1;
    return receipt.items.reduce((sum, item) => sum + sign * item.quantity * item.unitCost, 0);
  }, []);

  const getInventoryItemName = useCallback(
    (itemType: 'ingredient' | 'product', itemId: string): string => {
      if (itemType === 'ingredient') {
        return ingredientMap.get(itemId)?.name ?? 'Ингредиент';
      }

      return productMap.get(itemId)?.name ?? 'Продукт';
    },
    [ingredientMap, productMap]
  );

  const filteredStockReceipts = useMemo(
    () =>
      stockReceipts.filter((receipt) =>
        receiptFilter === 'all' ? true : receipt.type === receiptFilter
      ),
    [stockReceipts, receiptFilter]
  );

  const loadCashiersData = useCallback(async () => {
    setCashiersLoading(true);
    setCashiersError(null);
    try {
      const response = await api.get('/api/admin/cashiers');
      const payload = getResponseData<{ cashiers?: CashierSummary[] }>(response);
      setCashiers(payload?.cashiers ?? []);
    } catch (error) {
      console.error('Не удалось загрузить кассиров', error);
      let message = 'Не удалось загрузить кассиров';
      if (isAxiosError(error)) {
        const responseError =
          typeof error.response?.data === 'object' && error.response?.data !== null
            ? (error.response?.data as { error?: unknown }).error
            : undefined;
        if (typeof responseError === 'string' && responseError.trim()) {
          message = responseError.trim();
        }
      }
      setCashiersError(message);
      notify({ title: message, type: 'error' });
    } finally {
      setCashiersLoading(false);
      setCashiersLoaded(true);
    }
  }, [notify]);

  const loadDiscounts = useCallback(async () => {
    try {
      setDiscountsLoading(true);
      setDiscountsError(null);
      const response = await api.get('/api/admin/discounts');
      const payload = getResponseData<AdminDiscount[]>(response);
      setDiscounts(payload ?? []);
    } catch (error) {
      console.error('Не удалось загрузить скидки', error);
      let message = 'Не удалось загрузить скидки';
      if (isAxiosError(error)) {
        const responseError =
          typeof error.response?.data === 'object' && error.response?.data !== null
            ? (error.response?.data as { error?: unknown }).error
            : undefined;
        if (typeof responseError === 'string' && responseError.trim()) {
          message = responseError.trim();
        }
      }
      setDiscountsError(message);
      notify({ title: message, type: 'error' });
    } finally {
      setDiscountsLoading(false);
      setDiscountsReady(true);
    }
  }, [notify]);

  const handleReloadDiscounts = () => {
    setDiscountsReady(false);
    setDiscountsError(null);
  };

  const handleApplySalesStats = (event: React.FormEvent) => {
    event.preventDefault();
    if (salesStatsFilters.from && salesStatsFilters.to) {
      const from = new Date(`${salesStatsFilters.from}T00:00:00`);
      const to = new Date(`${salesStatsFilters.to}T00:00:00`);
      if (from > to) {
        notify({
          title: 'Дата начала должна быть меньше или равна дате окончания',
          type: 'info',
        });
        return;
      }
    }

    void loadSalesAndShiftStats({
      from: salesStatsFilters.from || undefined,
      to: salesStatsFilters.to || undefined,
    });
  };

  const handleResetSalesStats = () => {
    setSalesStatsFilters({ from: '', to: '' });
    setSalesStatsError(null);
    setSalesStatsLoaded(false);
    void loadSalesAndShiftStats();
  };

  const handleCashierFieldChange = (field: 'name' | 'email' | 'password', value: string) => {
    setCashierForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateCashier = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = cashierForm.name.trim();
    const email = cashierForm.email.trim();
    const password = cashierForm.password;

    if (!name || !email || !password) {
      notify({ title: 'Заполните имя, email и пароль', type: 'info' });
      return;
    }

    if (password.length < 6) {
      notify({ title: 'Пароль должен содержать минимум 6 символов', type: 'info' });
      return;
    }

    try {
      setCreatingCashier(true);
      const response = await api.post('/api/admin/cashiers', { name, email, password });
      const payload = getResponseData<{ cashier?: CashierSummary }>(response);
      const created = payload?.cashier;
      if (created) {
        setCashiers((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
        setCashierForm({ name: '', email: '', password: '' });
        setCashiersError(null);
        notify({ title: 'Кассир создан', type: 'success' });
      } else {
        void loadCashiersData();
      }
    } catch (error) {
      console.error('Не удалось создать кассира', error);
      let message = 'Не удалось создать кассира';
      if (isAxiosError(error)) {
        const responseError =
          typeof error.response?.data === 'object' && error.response?.data !== null
            ? (error.response?.data as { error?: unknown }).error
            : undefined;
        if (typeof responseError === 'string' && responseError.trim()) {
          message = responseError.trim();
        }
      }
      notify({ title: message, type: 'error' });
    } finally {
      setCreatingCashier(false);
    }
  };

  const handleReloadCashiers = () => {
    setCashiersLoaded(false);
    void loadCashiersData();
  };

  useEffect(() => {
    setLoyaltyRateDraft(loyaltyRate.toString());
  }, [loyaltyRate]);

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const response = await api.get('/api/customers');
      setCustomers(getResponseData<Customer[]>(response) ?? []);
    } catch (error) {
      console.error('Не удалось загрузить клиентов', error);
      notify({ title: 'Не удалось загрузить клиентов', type: 'error' });
    } finally {
      setCustomersLoading(false);
    }
  }, [notify]);

  const handleSaveLoyaltyRate = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericValue = Number(loyaltyRateDraft);

    if (!Number.isFinite(numericValue) || numericValue < 0) {
      notify({ title: 'Введите корректный процент от 0 до 100', type: 'info' });
      return;
    }

    const clampedValue = Math.min(Math.max(Number(numericValue.toFixed(2)), 0), 100);
    setLoyaltyRateDraft(clampedValue.toString());

    try {
      setSavingLoyaltyRate(true);
      await updateRestaurantBranding({ loyaltyRate: clampedValue });
      notify({ title: 'Настройки лояльности обновлены', type: 'success' });
    } catch (error) {
      console.error('Не удалось сохранить процент лояльности', error);
      notify({ title: 'Не удалось сохранить процент лояльности', type: 'error' });
    } finally {
      setSavingLoyaltyRate(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadReceiptHistory(receiptHistoryDate);
  }, [loadReceiptHistory, receiptHistoryDate]);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      if (!salesStatsLoading && !salesStatsLoaded) {
        void loadSalesAndShiftStats();
      }
    }

    if (activeTab === 'menu') {
      if (!menuLoading && categories.length === 0 && products.length === 0) {
        void loadMenuData();
      }
      if (!customersLoading && customers.length === 0) {
        void loadCustomers();
      }
      if (!suppliersLoading && suppliers.length === 0) {
        void loadSuppliersData();
      }
    }

    if (activeTab === 'inventory') {
      if (!inventoryLoading && warehouses.length === 0) {
        void loadInventoryData();
      }
      if (!menuLoading && (products.length === 0 || ingredients.length === 0)) {
        void loadMenuData();
      }
      if (!suppliersLoading && suppliers.length === 0) {
        void loadSuppliersData();
      }
      if (!stockReceiptsLoading && stockReceipts.length === 0) {
        void loadStockReceipts();
      }
    }

    if (activeTab === 'suppliers') {
      if (!suppliersLoading && suppliers.length === 0) {
        void loadSuppliersData();
      }
      if (!customersLoading && customers.length === 0) {
        void loadCustomers();
      }
    }

    if (activeTab === 'loyalty') {
      if (!customersLoading && customers.length === 0) {
        void loadCustomers();
      }
    }

    if (activeTab === 'discounts') {
      if (!menuLoading && (categories.length === 0 || products.length === 0)) {
        void loadMenuData();
      }
      if (!discountsLoading && !discountsReady) {
        void loadDiscounts();
      }
    }

    if (activeTab === 'staff') {
      if (!cashiersLoading && !cashiersLoaded) {
        void loadCashiersData();
      }
    }
  }, [
    activeTab,
    categories.length,
    products.length,
    ingredients.length,
    customers.length,
    menuLoading,
    customersLoading,
    loadMenuData,
    loadCustomers,
    inventoryLoading,
    loadInventoryData,
    warehouses.length,
    suppliersLoading,
    suppliers.length,
    loadSuppliersData,
    stockReceipts.length,
    stockReceiptsLoading,
    loadStockReceipts,
    discountsLoading,
    discountsReady,
    loadDiscounts,
    salesStatsLoading,
    salesStatsLoaded,
    loadSalesAndShiftStats,
    cashiersLoading,
    cashiersLoaded,
    loadCashiersData,
  ]);

  const loyaltySummary = useMemo<LoyaltyPointSummary>(() => ({
    totalPointsIssued: summary.totalPointsIssued,
    totalPointsRedeemed: summary.totalPointsRedeemed,
  }), [summary.totalPointsIssued, summary.totalPointsRedeemed]);

  const formatDateTime = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return date.toLocaleString('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const formatPeriodLabel = (period?: { from?: string; to?: string }) => {
    if (!period) {
      return '';
    }

    const fromLabel = period.from ? new Date(period.from).toLocaleDateString('ru-RU') : '';
    const toLabel = period.to ? new Date(period.to).toLocaleDateString('ru-RU') : '';

    if (fromLabel && toLabel) {
      return `${fromLabel} — ${toLabel}`;
    }

    if (fromLabel) {
      return `с ${fromLabel}`;
    }

    if (toLabel) {
      return `по ${toLabel}`;
    }

    return '';
  };

  const formatCurrency = (value?: number | null) =>
    normalizeNumber(value).toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatInteger = (value?: number | null) => normalizeNumber(value).toLocaleString('ru-RU');

  const ingredientCostMap = useMemo(
    () =>
      ingredients.reduce<Record<string, number>>((acc, ingredient) => {
        acc[ingredient._id] = ingredient.costPerUnit ?? 0;
        return acc;
      }, {}),
    [ingredients]
  );

  const ingredientUnitMap = useMemo(
    () =>
      ingredients.reduce<Record<string, string>>((acc, ingredient) => {
        acc[ingredient._id] = ingredient.unit;
        return acc;
      }, {}),
    [ingredients]
  );

  const baseIngredientDeltas = useMemo(
    () =>
      (selectedProduct ? productEditIngredients : productIngredients)
        .filter((item) => item.ingredientId)
        .map((item) => {
          const ingredientUnit = ingredients.find((entry) => entry._id === item.ingredientId)?.unit;
          return { ingredientId: item.ingredientId, delta: '', unit: item.unit || ingredientUnit };
        }),
    [ingredients, productEditIngredients, productIngredients, selectedProduct]
  );

  const baseIngredientsForCost = useMemo(
    () =>
      (selectedProduct ? productEditIngredients : productIngredients)
        .filter((item) => item.ingredientId && item.quantity)
        .map((item) => {
          const ingredient = ingredients.find((entry) => entry._id === item.ingredientId);
          const ingredientUnit = ingredient?.unit ?? '';
          const recipeUnit = item.unit || ingredientUnit;
          const normalizedQuantity = convertQuantity(Number(item.quantity) || 0, recipeUnit, ingredientUnit);
          return {
            ingredientId: item.ingredientId,
            quantity: Number(item.quantity) || 0,
            normalizedQuantity,
            unit: recipeUnit,
            ingredientUnit,
            name: ingredient?.name ?? 'Ингредиент',
            costPerUnit: ingredient?.costPerUnit ?? 0,
          };
        }),
    [ingredients, productEditIngredients, productIngredients, selectedProduct]
  );

  const mergeOptionWithBaseIngredients = useCallback(
    (option: ModifierOptionForm): ModifierOptionForm => {
      if (!baseIngredientDeltas.length) {
        return { ...option, ingredientDeltas: option.ingredientDeltas ?? [] };
      }

      const merged = baseIngredientDeltas.map((base) => {
        const existing = option.ingredientDeltas?.find((entry) => entry.ingredientId === base.ingredientId);
        return { ...base, delta: existing?.delta ?? '' };
      });

      return { ...option, ingredientDeltas: merged };
    },
    [baseIngredientDeltas]
  );

  useEffect(() => {
    setModifierGroupForm((prev) => ({
      ...prev,
      options: prev.options.map((option) => mergeOptionWithBaseIngredients(option)),
    }));
  }, [mergeOptionWithBaseIngredients]);

  const calculateCostChangeFromDeltas = useCallback(
    (deltas: ModifierIngredientDelta[]) =>
      deltas.reduce((sum, entry) => {
        const baseUnit = ingredientUnitMap[entry.ingredientId];
        const deltaUnit = entry.unit || baseUnit;
        const normalizedDelta = convertQuantity(Number(entry.delta) || 0, deltaUnit, baseUnit);

        return sum + normalizedDelta * (ingredientCostMap[entry.ingredientId] ?? 0);
      }, 0),
    [ingredientCostMap, ingredientUnitMap]
  );

  const handleCreateCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCategoryName.trim()) {
      notify({ title: 'Введите название категории', type: 'info' });
      return;
    }
    try {
      await api.post('/api/catalog/categories', { name: newCategoryName.trim() });
      setNewCategoryName('');
      notify({ title: 'Категория добавлена', type: 'success' });
      void loadMenuData();
    } catch (error) {
      notify({ title: 'Не удалось создать категорию', type: 'error' });
    }
  };

  const handleAddIngredientRow = () => {
    setProductIngredients((prev) => [...prev, { ingredientId: '', quantity: '', unit: '' }]);
  };

  const handleIngredientChange = (index: number, field: 'ingredientId' | 'quantity' | 'unit', value: string) => {
    setProductIngredients((prev) => {
      const copy = [...prev];
      const ingredientUnit =
        field === 'ingredientId'
          ? ingredients.find((entry) => entry._id === value)?.unit
          : ingredients.find((entry) => entry._id === copy[index].ingredientId)?.unit;

      copy[index] = {
        ...copy[index],
        [field]: value,
        ...(field === 'ingredientId'
          ? { unit: ingredientUnit || '' }
          : field === 'unit'
            ? { unit: value }
            : { unit: copy[index].unit || ingredientUnit || '' }),
      };
      return copy;
    });
  };

  const handleSelectCategory = (category: Category) => {
    setSelectedCategory(category);
    setCategoryEditName(category.name);
    setCategorySortOrder(
      typeof category.sortOrder === 'number' && !Number.isNaN(category.sortOrder)
        ? String(category.sortOrder)
        : ''
    );
  };

  const handleUpdateCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCategory) return;

    if (!categoryEditName.trim()) {
      notify({ title: 'Введите название категории', type: 'info' });
      return;
    }

    const payload: Record<string, unknown> = { name: categoryEditName.trim() };

    if (categorySortOrder.trim()) {
      const numeric = Number(categorySortOrder);
      if (Number.isNaN(numeric)) {
        notify({ title: 'Порядок должен быть числом', type: 'info' });
        return;
      }
      payload.sortOrder = numeric;
    }

    try {
      await api.put(`/api/catalog/categories/${selectedCategory._id}`, payload);
      notify({ title: 'Категория обновлена', type: 'success' });
      void loadMenuData();
    } catch (error) {
      notify({ title: 'Не удалось обновить категорию', type: 'error' });
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductEditForm({
      name: product.name,
      description: product.description ?? '',
      imageUrl: product.imageUrl ?? '',
      categoryId: product.categoryId,
      price: product.price.toFixed(2),
      basePrice: product.basePrice !== undefined ? product.basePrice.toString() : '',
      discountType: product.discountType ?? '',
      discountValue:
        product.discountValue !== undefined && product.discountValue !== null
          ? product.discountValue.toString()
          : '',
      isActive: product.isActive !== false,
    });
    setProductEditIngredients(
      Array.isArray(product.ingredients)
        ? product.ingredients.map((entry) => {
            const ingredientUnit = ingredients.find((ingredient) => ingredient._id === entry.ingredientId)?.unit;
            return {
              ingredientId: entry.ingredientId,
              quantity: entry.quantity.toString(),
              unit: entry.unit || ingredientUnit || '',
            };
          })
        : []
    );
    setProductEditModifiers(
      Array.isArray(product.modifierGroups)
        ? product.modifierGroups.map((group) => group._id).filter(Boolean)
        : []
    );
  };

  const handleSelectModifierGroup = (group: ModifierGroup) => {
    setSelectedModifierGroup(group);
    setModifierGroupForm({
      name: group.name,
      selectionType: group.selectionType,
      required: group.required,
      sortOrder: group.sortOrder !== undefined && group.sortOrder !== null ? group.sortOrder.toString() : '',
      options:
        group.options?.length
          ? group.options.map((option) =>
              mergeOptionWithBaseIngredients({
                name: option.name,
                priceChange:
                  option.priceChange !== undefined && option.priceChange !== null ? option.priceChange.toString() : '',
                costChange:
                  option.costChange !== undefined && option.costChange !== null ? option.costChange.toString() : '',
                ingredientDeltas: [],
              })
            )
          : [mergeOptionWithBaseIngredients({ name: '', priceChange: '', costChange: '', ingredientDeltas: [] })],
    });
  };

  const resetModifierGroupForm = () => {
    setSelectedModifierGroup(null);
    setModifierGroupForm({
      name: '',
      selectionType: 'single',
      required: false,
      sortOrder: '',
      options: [mergeOptionWithBaseIngredients({ name: '', priceChange: '', costChange: '', ingredientDeltas: [] })],
    });
  };

  const handleModifierGroupFieldChange = (
    field: 'name' | 'selectionType' | 'required' | 'sortOrder',
    value: string | boolean
  ) => {
    setModifierGroupForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleModifierOptionChange = (
    index: number,
    field: 'name' | 'priceChange' | 'costChange',
    value: string
  ) => {
    setModifierGroupForm((prev) => {
      const options = [...prev.options];
      options[index] = mergeOptionWithBaseIngredients({ ...options[index], [field]: value });
      return { ...prev, options };
    });
  };

  const handleModifierOptionIngredientDeltaChange = (
    index: number,
    ingredientId: string,
    delta: string
  ) => {
    setModifierGroupForm((prev) => {
      const options = [...prev.options];
      const normalizedOption = mergeOptionWithBaseIngredients(options[index]);
      const deltas = normalizedOption.ingredientDeltas.map((entry) =>
        entry.ingredientId === ingredientId ? { ...entry, delta } : entry
      );
      const costChange = calculateCostChangeFromDeltas(deltas);
      options[index] = {
        ...normalizedOption,
        ingredientDeltas: deltas,
        costChange: costChange ? costChange.toFixed(2) : '',
      };
      return { ...prev, options };
    });
  };

  const addModifierOptionRow = () => {
    setModifierGroupForm((prev) => ({
      ...prev,
      options: [
        ...prev.options,
        mergeOptionWithBaseIngredients({ name: '', priceChange: '', costChange: '', ingredientDeltas: [] }),
      ],
    }));
  };

  const removeModifierOptionRow = (index: number) => {
    setModifierGroupForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, optionIndex) => optionIndex !== index),
    }));
  };

  const buildModifierGroupPayload = (): Record<string, unknown> | null => {
    if (!modifierGroupForm.name.trim()) {
      notify({ title: 'Введите название группы модификаторов', type: 'info' });
      return null;
    }

    const payload: Record<string, unknown> = {
      name: modifierGroupForm.name.trim(),
      selectionType: modifierGroupForm.selectionType,
      required: modifierGroupForm.required,
      options: modifierGroupForm.options
        .map((option) => ({
          name: option.name.trim(),
          priceChange: option.priceChange ? Number(option.priceChange) : 0,
          costChange: option.costChange ? Number(option.costChange) : 0,
        }))
        .filter((option) => option.name),
    };

    if (modifierGroupForm.sortOrder) {
      const numeric = Number(modifierGroupForm.sortOrder);
      if (Number.isNaN(numeric)) {
        notify({ title: 'Порядок группы должен быть числом', type: 'info' });
        return null;
      }
      payload.sortOrder = numeric;
    }

    return payload;
  };

  const handleCreateModifierGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = buildModifierGroupPayload();
    if (!payload) return;

    try {
      await api.post('/api/catalog/modifier-groups', payload);
      notify({ title: 'Группа модификаторов создана', type: 'success' });
      resetModifierGroupForm();
      void loadMenuData();
    } catch (error) {
      notify({ title: 'Не удалось создать группу', type: 'error' });
    }
  };

  const handleUpdateModifierGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedModifierGroup) return;
    const payload = buildModifierGroupPayload();
    if (!payload) return;

    try {
      await api.put(`/api/catalog/modifier-groups/${selectedModifierGroup._id}`, payload);
      notify({ title: 'Группа обновлена', type: 'success' });
      void loadMenuData();
    } catch (error) {
      notify({ title: 'Не удалось обновить группу', type: 'error' });
    }
  };

  const handleDeleteModifierGroup = async (groupId: string) => {
    const confirmed = window.confirm('Удалить группу модификаторов?');
    if (!confirmed) return;

    try {
      await api.delete(`/api/catalog/modifier-groups/${groupId}`);
      notify({ title: 'Группа удалена', type: 'success' });
      if (selectedModifierGroup?._id === groupId) {
        resetModifierGroupForm();
      }
      void loadMenuData();
    } catch (error) {
      notify({ title: 'Не удалось удалить группу', type: 'error' });
    }
  };

  const handleEditIngredientChange = (
    index: number,
    field: 'ingredientId' | 'quantity' | 'unit',
    value: string
  ) => {
    setProductEditIngredients((prev) => {
      const copy = [...prev];
      const ingredientUnit =
        field === 'ingredientId'
          ? ingredients.find((entry) => entry._id === value)?.unit
          : ingredients.find((entry) => entry._id === copy[index].ingredientId)?.unit;

      copy[index] = {
        ...copy[index],
        [field]: value,
        ...(field === 'ingredientId'
          ? { unit: ingredientUnit || '' }
          : field === 'unit'
            ? { unit: value }
            : { unit: copy[index].unit || ingredientUnit || '' }),
      };
      return copy;
    });
  };

  const addEditIngredientRow = () => {
    setProductEditIngredients((prev) => [...prev, { ingredientId: '', quantity: '', unit: '' }]);
  };

  const removeEditIngredientRow = (index: number) => {
    setProductEditIngredients((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleToggleNewProductModifier = (groupId: string) => {
    setNewProductModifierIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleToggleEditProductModifier = (groupId: string) => {
    setProductEditModifiers((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleUpdateProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProduct) return;

    if (!productEditForm.name.trim()) {
      notify({ title: 'Введите название позиции', type: 'info' });
      return;
    }

    const payload: Record<string, unknown> = {
      name: productEditForm.name.trim(),
      description: productEditForm.description.trim() || undefined,
      imageUrl: productEditForm.imageUrl.trim() || undefined,
      categoryId: productEditForm.categoryId,
      isActive: productEditForm.isActive,
    };

    if (productEditForm.price) {
      payload.price = Number(productEditForm.price);
    }
    if (productEditForm.basePrice) {
      payload.basePrice = Number(productEditForm.basePrice);
    }

    payload.discountType = productEditForm.discountType || undefined;
    payload.discountValue = productEditForm.discountValue
      ? Number(productEditForm.discountValue)
      : undefined;

    const normalizedIngredients = productEditIngredients
      .filter((item) => item.ingredientId && item.quantity)
      .map((item) => {
        const ingredientUnit = ingredients.find((entry) => entry._id === item.ingredientId)?.unit;
        return {
          ingredientId: item.ingredientId,
          quantity: Number(item.quantity),
          unit: item.unit || ingredientUnit,
        };
      });

    if (normalizedIngredients.length) {
      payload.ingredients = normalizedIngredients;
    } else {
      payload.ingredients = [];
    }

    payload.modifierGroups = productEditModifiers;

    try {
      await api.put(`/api/catalog/products/${selectedProduct._id}`, payload);
      notify({ title: 'Позиция обновлена', type: 'success' });
      await loadMenuData();
      const refreshed = products.find((product) => product._id === selectedProduct._id);
      if (refreshed) {
        handleSelectProduct(refreshed);
      }
    } catch (error) {
      notify({ title: 'Не удалось обновить позицию', type: 'error' });
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!productId) return;
    if (!window.confirm('Удалить позицию? Действие нельзя отменить.')) {
      return;
    }

    try {
      await api.delete(`/api/catalog/products/${productId}`);
      notify({ title: 'Позиция удалена', type: 'success' });
      if (selectedProduct?._id === productId) {
        setSelectedProduct(null);
      }
      await loadMenuData();
    } catch (error) {
      notify({ title: 'Не удалось удалить позицию', type: 'error' });
    }
  };

  const handleSelectIngredient = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setIngredientEditForm({
      name: ingredient.name,
      unit: ingredient.unit,
      costPerUnit:
        ingredient.costPerUnit !== undefined && ingredient.costPerUnit !== null
          ? ingredient.costPerUnit.toString()
          : '',
      supplierId: ingredient.supplierId ?? '',
      description: ingredient.description ?? '',
    });
  };

  const handleUpdateIngredient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedIngredient) return;

    if (!ingredientEditForm.name.trim() || !ingredientEditForm.unit.trim()) {
      notify({ title: 'Заполните название и единицу измерения', type: 'info' });
      return;
    }

    const payload: Record<string, unknown> = {
      name: ingredientEditForm.name.trim(),
      unit: ingredientEditForm.unit.trim(),
      description: ingredientEditForm.description.trim() || undefined,
      supplierId: ingredientEditForm.supplierId || undefined,
    };

    if (ingredientEditForm.costPerUnit) {
      payload.costPerUnit = Number(ingredientEditForm.costPerUnit);
    }

    try {
      await api.put(`/api/catalog/ingredients/${selectedIngredient._id}`, payload);
      notify({ title: 'Ингредиент обновлён', type: 'success' });
      await loadMenuData();
      await loadInventoryData();
    } catch (error) {
      notify({ title: 'Не удалось обновить ингредиент', type: 'error' });
    }
  };

  const handleDeleteIngredient = async (ingredientId: string) => {
    if (!ingredientId) return;
    if (!window.confirm('Удалить ингредиент? Он пропадёт из рецептур и складов.')) {
      return;
    }

    try {
      await api.delete(`/api/catalog/ingredients/${ingredientId}`);
      notify({ title: 'Ингредиент удалён', type: 'success' });
      if (selectedIngredient?._id === ingredientId) {
        setSelectedIngredient(null);
      }
      await loadMenuData();
      await loadInventoryData();
    } catch (error) {
      notify({ title: 'Не удалось удалить ингредиент', type: 'error' });
    }
  };

  const handleCreateProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newProduct.name.trim() || !newProduct.categoryId) {
      notify({ title: 'Заполните название и категорию', type: 'info' });
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        name: newProduct.name.trim(),
        categoryId: newProduct.categoryId,
        description: newProduct.description.trim() || undefined,
        basePrice: newProduct.basePrice ? Number(newProduct.basePrice) : undefined,
        imageUrl: newProduct.imageUrl.trim() || undefined,
        discountType: newProduct.discountType || undefined,
        discountValue: newProduct.discountValue ? Number(newProduct.discountValue) : undefined,
      };

      const normalizedIngredients = productIngredients
        .filter((item) => item.ingredientId && item.quantity)
        .map((item) => {
          const ingredientUnit = ingredients.find((entry) => entry._id === item.ingredientId)?.unit;
          return { ingredientId: item.ingredientId, quantity: Number(item.quantity), unit: item.unit || ingredientUnit };
        });

      if (normalizedIngredients.length) {
        payload.ingredients = normalizedIngredients;
      }

      if (newProductModifierIds.length) {
        payload.modifierGroups = newProductModifierIds;
      }

      await api.post('/api/catalog/products', payload);
      notify({ title: 'Позиция добавлена', type: 'success' });
      setNewProduct({
        name: '',
        description: '',
        categoryId: '',
        basePrice: '',
        discountType: '',
        discountValue: '',
        imageUrl: '',
      });
      setNewProductModifierIds([]);
      setProductIngredients([{ ingredientId: '', quantity: '' }]);
      void loadMenuData();
    } catch (error) {
      notify({ title: 'Не удалось создать позицию', type: 'error' });
    }
  };

  const handleProductPriceChange = async (
    productId: string,
    data: Partial<{
      basePrice: number;
      price: number;
      discountType: 'percentage' | 'fixed' | null | undefined;
      discountValue: number | null | undefined;
      isActive: boolean;
    }>
  ) => {
    const payload: Record<string, unknown> = {};
    if (data.basePrice !== undefined) {
      payload.basePrice = data.basePrice;
    }
    if (data.price !== undefined) {
      payload.price = data.price;
    }
    if ('discountType' in data) {
      payload.discountType = data.discountType ?? undefined;
    }
    if ('discountValue' in data) {
      payload.discountValue = data.discountValue ?? undefined;
    }
    if (data.isActive !== undefined) {
      payload.isActive = data.isActive;
    }

    try {
      await api.put(`/api/catalog/products/${productId}`, payload);
      notify({ title: 'Меню обновлено', type: 'success' });
      void loadMenuData();
    } catch (error) {
      notify({ title: 'Не удалось обновить позицию', type: 'error' });
    }
  };

  const handleCreateIngredient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: (formData.get('name') as string)?.trim(),
      unit: (formData.get('unit') as string)?.trim(),
      costPerUnit: formData.get('costPerUnit') ? Number(formData.get('costPerUnit')) : undefined,
    };

    if (!payload.name || !payload.unit) {
      notify({ title: 'Заполните название и единицу измерения', type: 'info' });
      return;
    }

    try {
      await api.post('/api/catalog/ingredients', payload);
      form.reset();
      notify({ title: 'Ингредиент добавлен', type: 'success' });
      void loadMenuData();
    } catch (error) {
      notify({ title: 'Не удалось создать ингредиент', type: 'error' });
    }
  };

  const handleCreateWarehouse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newWarehouse.name.trim()) {
      notify({ title: 'Введите название склада', type: 'info' });
      return;
    }

    try {
      await api.post('/api/inventory/warehouses', {
        name: newWarehouse.name.trim(),
        location: newWarehouse.location.trim() || undefined,
        description: newWarehouse.description.trim() || undefined,
      });
      notify({ title: 'Склад добавлен', type: 'success' });
      setNewWarehouse({ name: '', location: '', description: '' });
      void loadInventoryData();
    } catch (error) {
      notify({ title: 'Не удалось создать склад', type: 'error' });
    }
  };

  const handleAdjustExistingInventory = async (itemId: string, delta: number) => {
    if (!delta) return;
    try {
      await api.post(`/api/inventory/items/${itemId}/adjust`, { delta });
      notify({ title: 'Остаток скорректирован', type: 'success' });
      void loadInventoryData();
    } catch (error) {
      notify({ title: 'Не удалось скорректировать остаток', type: 'error' });
    }
  };

  const handleSelectWarehouse = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setWarehouseEditForm({
      name: warehouse.name,
      location: warehouse.location ?? '',
      description: warehouse.description ?? '',
    });
  };

  const handleUpdateWarehouse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedWarehouse) return;

    if (!warehouseEditForm.name.trim()) {
      notify({ title: 'Введите название склада', type: 'info' });
      return;
    }

    try {
      await api.put(`/api/inventory/warehouses/${selectedWarehouse._id}`, {
        name: warehouseEditForm.name.trim(),
        location: warehouseEditForm.location.trim() || undefined,
        description: warehouseEditForm.description.trim() || undefined,
      });
      notify({ title: 'Склад обновлён', type: 'success' });
      void loadInventoryData();
    } catch (error) {
      notify({ title: 'Не удалось обновить склад', type: 'error' });
    }
  };

  const handleDeleteWarehouse = async (warehouseId: string) => {
    if (!warehouseId) return;
    if (!window.confirm('Удалить склад и все связанные остатки?')) {
      return;
    }

    try {
      await api.delete(`/api/inventory/warehouses/${warehouseId}`);
      notify({ title: 'Склад удалён', type: 'success' });
      if (selectedWarehouse?._id === warehouseId) {
        setSelectedWarehouse(null);
        setWarehouseEditForm({ name: '', location: '', description: '' });
      }
      void loadInventoryData();
    } catch (error) {
      notify({ title: 'Не удалось удалить склад', type: 'error' });
    }
  };

  const handleReceiptItemChange = (
    index: number,
    field: 'itemType' | 'itemId' | 'quantity' | 'unitCost',
    value: string
  ) => {
    setReceiptForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addReceiptItemRow = () => {
    setReceiptForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { itemType: 'ingredient' as 'ingredient' | 'product', itemId: '', quantity: '', unitCost: '' },
      ],
    }));
  };

  const removeReceiptItemRow = (index: number) => {
    setReceiptForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const resetReceiptForm = (preserveWarehouse = false) => {
    setSelectedStockReceipt(null);
    setReceiptType('receipt');
    setReceiptDate(new Date().toISOString().slice(0, 10));
    setReceiptForm({
      warehouseId: preserveWarehouse ? receiptForm.warehouseId : '',
      supplierId: '',
      items: [
        {
          itemType: 'ingredient',
          itemId: '',
          quantity: '',
          unitCost: '',
        },
      ],
    });
  };

  const handleSaveStockReceipt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!receiptForm.warehouseId) {
      notify({ title: 'Выберите склад', type: 'info' });
      return;
    }

    if (!receiptDate) {
      notify({ title: 'Укажите дату документа', type: 'info' });
      return;
    }

    const payloadItems = receiptForm.items
      .map((entry) => ({
        itemType: entry.itemType,
        itemId: entry.itemId,
        quantity: entry.quantity ? Number(entry.quantity) : 0,
        unitCost: entry.unitCost ? Number(entry.unitCost) : 0,
      }))
      .filter((entry) => entry.itemId && entry.quantity > 0);

    if (!payloadItems.length) {
      notify({ title: 'Добавьте хотя бы одну позицию', type: 'info' });
      return;
    }

    try {
      if (selectedStockReceipt) {
        await api.put(`/api/inventory/receipts/${selectedStockReceipt._id}`, {
          warehouseId: receiptForm.warehouseId,
          supplierId: receiptForm.supplierId || undefined,
          items: payloadItems,
          occurredAt: receiptDate,
          type: receiptType,
        });
        notify({ title: 'Документ обновлён', type: 'success' });
      } else {
        let lastError: unknown;

        for (const endpoint of ['/api/admin/inventory/receipts', '/api/inventory/receipts']) {
          try {
            await api.post(endpoint, {
              warehouseId: receiptForm.warehouseId,
              supplierId: receiptForm.supplierId || undefined,
              items: payloadItems,
              occurredAt: receiptDate,
              type: receiptType,
            });
            lastError = undefined;
            break;
          } catch (error) {
            if (isAxiosError(error) && error.response?.status === 404) {
              lastError = error;
              continue;
            }

            throw error;
          }
        }

        if (lastError) {
          throw lastError;
        }

        notify({ title: receiptType === 'writeOff' ? 'Списание сохранено' : 'Поставка сохранена', type: 'success' });
      }

      resetReceiptForm(true);
      await loadInventoryData();
      await loadStockReceipts();
      await loadMenuData();
    } catch (error) {
      const message = extractErrorMessage(error, 'Не удалось сохранить документ');
      notify({ title: message, type: 'error' });
    }
  };

  const handleSelectStockReceipt = (receipt: StockReceipt) => {
    setSelectedStockReceipt(receipt);

    if (receipt.type === 'inventory') {
      notify({ title: 'Инвентаризации нельзя редактировать', type: 'info' });
      return;
    }

    setReceiptType(receipt.type === 'writeOff' ? 'writeOff' : 'receipt');
    setReceiptDate(receipt.occurredAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setReceiptForm({
      warehouseId: receipt.warehouseId,
      supplierId: receipt.supplierId ?? '',
      items:
        receipt.items.length > 0
          ? receipt.items.map((item) => ({
              itemType: item.itemType,
              itemId: item.itemId,
              quantity: item.quantity.toString(),
              unitCost: item.unitCost.toString(),
            }))
          : [
              {
                itemType: 'ingredient',
                itemId: '',
                quantity: '',
                unitCost: '',
              },
            ],
    });
  };

  const handleDeleteStockReceipt = async (receiptId: string) => {
    if (!receiptId) return;
    if (!window.confirm('Удалить документ? Остатки будут пересчитаны.')) {
      return;
    }

    try {
      await api.delete(`/api/inventory/receipts/${receiptId}`);
      notify({ title: 'Документ удалён', type: 'success' });
      if (selectedStockReceipt?._id === receiptId) {
        resetReceiptForm();
      }
      await loadInventoryData();
      await loadStockReceipts();
      await loadMenuData();
    } catch (error) {
      const message = extractErrorMessage(error, 'Не удалось удалить документ');
      notify({ title: message, type: 'error' });
    }
  };

  const handleAuditItemChange = (
    index: number,
    field: 'itemType' | 'itemId' | 'countedQuantity',
    value: string
  ) => {
    setInventoryAuditForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addAuditItemRow = () => {
    setInventoryAuditForm((prev) => ({
      ...prev,
      items: [...prev.items, { itemType: 'ingredient', itemId: '', countedQuantity: '' }],
    }));
  };

  const removeAuditItemRow = (index: number) => {
    setInventoryAuditForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSubmitInventoryAudit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!inventoryAuditForm.warehouseId) {
      notify({ title: 'Выберите склад для инвентаризации', type: 'info' });
      return;
    }

    const payloadItems = inventoryAuditForm.items
      .map((item) => ({
        itemType: item.itemType,
        itemId: item.itemId,
        countedQuantity: Number(item.countedQuantity),
      }))
      .filter((item) => item.itemId);

    if (!payloadItems.length) {
      notify({ title: 'Добавьте хотя бы одну позицию в инвентаризацию', type: 'info' });
      return;
    }

    if (payloadItems.some((item) => item.countedQuantity < 0 || Number.isNaN(item.countedQuantity))) {
      notify({ title: 'Количество не может быть отрицательным', type: 'info' });
      return;
    }

    try {
      setAuditSubmitting(true);
      const response = await api.post('/api/inventory/inventory/audits', {
        warehouseId: inventoryAuditForm.warehouseId,
        performedAt: inventoryAuditForm.performedAt,
        items: payloadItems,
      });

      const audit = getResponseData<InventoryAudit>(response) ?? null;
      if (audit) {
        setLastAuditResult(audit);
      }
      await loadInventoryData();
      await loadStockReceipts();
      await loadMenuData();
    } catch (error) {
      const message = extractErrorMessage(error, 'Не удалось удалить документ');
      notify({ title: message, type: 'error' });
    }
  };

  const handleAuditItemChange = (
    index: number,
    field: 'itemType' | 'itemId' | 'countedQuantity',
    value: string
  ) => {
    setInventoryAuditForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addAuditItemRow = () => {
    setInventoryAuditForm((prev) => ({
      ...prev,
      items: [...prev.items, { itemType: 'ingredient', itemId: '', countedQuantity: '' }],
    }));
  };

  const removeAuditItemRow = (index: number) => {
    setInventoryAuditForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSubmitInventoryAudit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!inventoryAuditForm.warehouseId) {
      notify({ title: 'Выберите склад для инвентаризации', type: 'info' });
      return;
    }

    const payloadItems = inventoryAuditForm.items
      .map((item) => ({
        itemType: item.itemType,
        itemId: item.itemId,
        countedQuantity: Number(item.countedQuantity),
      }))
      .filter((item) => item.itemId);

      notify({
        title: 'Инвентаризация завершена. Документы до этой даты будут заблокированы.',
        type: 'success',
      });

      setInventoryAuditForm((prev) => ({
        ...prev,
        performedAt: new Date().toISOString().slice(0, 10),
        items: [],
      }));

      await loadInventoryData();
      await loadStockReceipts();
    } catch (error) {
      const message = extractErrorMessage(error, 'Не удалось провести инвентаризацию');
      notify({ title: message, type: 'error' });
    } finally {
      setAuditSubmitting(false);
    }
  };

  const handleDeleteCashier = async (cashierId: string) => {
    if (!cashierId) return;
    if (!window.confirm('Удалить сотрудника? Доступ к системе будет отозван.')) {
      return;
    }

    try {
      await api.delete(`/api/admin/cashiers/${cashierId}`);
      notify({ title: 'Сотрудник удалён', type: 'success' });
      setCashiers((prev) => prev.filter((cashier) => cashier.id !== cashierId));
    } catch (error) {
      notify({ title: 'Не удалось удалить сотрудника', type: 'error' });
    }
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setSupplierEditForm({
      name: supplier.name,
      contactName: supplier.contactName ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      address: supplier.address ?? '',
      notes: supplier.notes ?? '',
    });
  };

  const handleUpdateSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSupplier) return;

    if (!supplierEditForm.name.trim()) {
      notify({ title: 'Введите название поставщика', type: 'info' });
      return;
    }

    try {
      await api.put(`/api/suppliers/${selectedSupplier._id}`, {
        name: supplierEditForm.name.trim(),
        contactName: supplierEditForm.contactName.trim() || undefined,
        phone: supplierEditForm.phone.trim() || undefined,
        email: supplierEditForm.email.trim() || undefined,
        address: supplierEditForm.address.trim() || undefined,
        notes: supplierEditForm.notes.trim() || undefined,
      });
      notify({ title: 'Поставщик обновлён', type: 'success' });
      void loadSuppliersData();
    } catch (error) {
      notify({ title: 'Не удалось обновить поставщика', type: 'error' });
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerEditForm({
      name: customer.name,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      points: customer.points.toString(),
      totalSpent: customer.totalSpent.toFixed(2),
    });
  };

  const handleUpdateCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer) return;

    if (!customerEditForm.name.trim() || !customerEditForm.phone.trim()) {
      notify({ title: 'Заполните имя и телефон', type: 'info' });
      return;
    }

    try {
      await api.put(`/api/customers/${selectedCustomer._id}`, {
        name: customerEditForm.name.trim(),
        phone: customerEditForm.phone.trim(),
        email: customerEditForm.email.trim() || undefined,
        points: customerEditForm.points ? Number(customerEditForm.points) : undefined,
        totalSpent: customerEditForm.totalSpent ? Number(customerEditForm.totalSpent) : undefined,
      });
      notify({ title: 'Клиент обновлён', type: 'success' });
      void loadCustomers();
    } catch (error) {
      notify({ title: 'Не удалось обновить клиента', type: 'error' });
    }
  };

  const handleCreateSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newSupplier.name.trim()) {
      notify({ title: 'Введите название поставщика', type: 'info' });
      return;
    }

    try {
      await api.post('/api/suppliers', {
        name: newSupplier.name.trim(),
        contactName: newSupplier.contactName.trim() || undefined,
        phone: newSupplier.phone.trim() || undefined,
        email: newSupplier.email.trim() || undefined,
        address: newSupplier.address.trim() || undefined,
        notes: newSupplier.notes.trim() || undefined,
      });
      notify({ title: 'Поставщик добавлен', type: 'success' });
      setNewSupplier({ name: '', contactName: '', phone: '', email: '', address: '', notes: '' });
      void loadSuppliersData();
    } catch (error) {
      notify({ title: 'Не удалось создать поставщика', type: 'error' });
    }
  };

  const toggleDiscountDay = (day: number) => {
    setDiscountForm((prev) => {
      if (!prev.autoApply) {
        return prev;
      }

      const exists = prev.autoApplyDays.includes(day);
      const nextDays = exists ? prev.autoApplyDays.filter((value) => value !== day) : [...prev.autoApplyDays, day];
      return { ...prev, autoApplyDays: nextDays };
    });
  };

  const handleCreateDiscount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = discountForm.name.trim();
    if (!trimmedName) {
      notify({ title: 'Введите название скидки', type: 'info' });
      return;
    }

    const numericValue = Number(discountForm.value);
    if (Number.isNaN(numericValue) || numericValue < 0) {
      notify({ title: 'Укажите корректное значение скидки', type: 'info' });
      return;
    }

    if (discountForm.type === 'percentage' && (numericValue < 0 || numericValue > 100)) {
      notify({ title: 'Процент скидки должен быть от 0 до 100', type: 'info' });
      return;
    }

    if (discountForm.scope === 'category' && !discountForm.categoryId) {
      notify({ title: 'Выберите категорию для скидки', type: 'info' });
      return;
    }

    if (discountForm.scope === 'product' && !discountForm.productId) {
      notify({ title: 'Выберите товар для скидки', type: 'info' });
      return;
    }

    if (discountForm.autoApply && discountForm.scope !== 'category') {
      notify({ title: 'Автоприменение доступно только для категорий', type: 'info' });
      return;
    }

    if (
      discountForm.autoApply &&
      (discountForm.autoApplyStart.trim() === '' || discountForm.autoApplyEnd.trim() === '')
    ) {
      notify({ title: 'Укажите время действия автоматической скидки', type: 'info' });
      return;
    }

    const payload: Record<string, unknown> = {
      name: trimmedName,
      description: discountForm.description.trim() || undefined,
      type: discountForm.type,
      scope: discountForm.scope,
      value: numericValue,
      autoApply: discountForm.scope === 'category' ? discountForm.autoApply : false,
    };

    if (discountForm.scope === 'category' && discountForm.categoryId) {
      payload.categoryId = discountForm.categoryId;
    }

    if (discountForm.scope === 'product' && discountForm.productId) {
      payload.productId = discountForm.productId;
    }

    if (payload.autoApply) {
      payload.autoApplyDays = discountForm.autoApplyDays;
      payload.autoApplyStart = discountForm.autoApplyStart || undefined;
      payload.autoApplyEnd = discountForm.autoApplyEnd || undefined;
    }

    try {
      setCreatingDiscount(true);
      const response = await api.post('/api/admin/discounts', payload);
      const created = getResponseData<AdminDiscount>(response);
      if (created) {
        setDiscounts((prev) => [created, ...prev]);
        notify({ title: 'Скидка создана', type: 'success' });
        setDiscountForm({
          name: '',
          description: '',
          type: 'percentage',
          scope: 'order',
          value: '',
          categoryId: '',
          productId: '',
          autoApply: false,
          autoApplyDays: [],
          autoApplyStart: '',
          autoApplyEnd: '',
        });
      }
    } catch (error) {
      console.error('Не удалось создать скидку', error);
      notify({ title: 'Не удалось создать скидку', type: 'error' });
    } finally {
      setCreatingDiscount(false);
    }
  };

  const handleToggleDiscountActive = async (discount: AdminDiscount) => {
    try {
      setDiscountActionId(discount._id);
      const response = await api.patch(`/api/admin/discounts/${discount._id}`, {
        isActive: !discount.isActive,
      });
      const updated = getResponseData<AdminDiscount>(response);
      if (updated) {
        setDiscounts((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
        notify({
          title: updated.isActive ? 'Скидка активирована' : 'Скидка отключена',
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Не удалось обновить скидку', error);
      notify({ title: 'Не удалось обновить скидку', type: 'error' });
    } finally {
      setDiscountActionId(null);
    }
  };

  const handleDeleteDiscount = async (discount: AdminDiscount) => {
    const confirmed = window.confirm(`Удалить скидку "${discount.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      setDiscountActionId(discount._id);
      await api.delete(`/api/admin/discounts/${discount._id}`);
      setDiscounts((prev) => prev.filter((item) => item._id !== discount._id));
      notify({ title: 'Скидка удалена', type: 'success' });
    } catch (error) {
      console.error('Не удалось удалить скидку', error);
      notify({ title: 'Не удалось удалить скидку', type: 'error' });
    } finally {
      setDiscountActionId(null);
    }
  };

  const handleSubmitBranding = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedName = brandingForm.name.trim() || 'Yago Coffee';
    setBrandingSaving(true);
    try {
      await updateRestaurantBranding({ name: normalizedName, logoUrl: brandingForm.logoUrl.trim() });
      notify({ title: 'Брендинг обновлён', description: 'Новые данные уже применены на кассе', type: 'success' });
    } catch (error) {
      console.error('Не удалось обновить брендинг', error);
      notify({ title: 'Не удалось сохранить брендинг', type: 'error' });
    } finally {
      setBrandingSaving(false);
    }
  };

  const handleResetBranding = async () => {
    setBrandingSaving(true);
    try {
      await resetRestaurantBranding();
      notify({ title: 'Настройки сброшены', description: 'Возвращено название Yago Coffee', type: 'info' });
    } catch (error) {
      console.error('Не удалось сбросить брендинг', error);
      notify({ title: 'Не удалось сбросить настройки', type: 'error' });
    } finally {
      setBrandingSaving(false);
    }
  };

  const handleToggleOrderTags = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setBrandingSaving(true);
    try {
      await updateRestaurantBranding({ enableOrderTags: checked });
      notify({
        title: checked ? 'Метки включены' : 'Метки отключены',
        description: checked
          ? 'Кассиры увидят переключатели «С собой» и «Доставка» в POS'
          : 'Переключатели скрыты до повторного включения',
        type: 'info',
      });
    } catch (error) {
      console.error('Не удалось обновить метки заказов', error);
      notify({ title: 'Не удалось сохранить настройки меток', type: 'error' });
    } finally {
      setBrandingSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Админ-панель</h1>
          <p className="text-sm text-slate-500">
            Управление персоналом, меню, запасами, скидками и поставщиками {restaurantName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'dashboard', label: 'Дашборд' },
            { id: 'menu', label: 'Меню' },
            { id: 'inventory', label: 'Склады' },
            { id: 'loyalty', label: 'Лояльность' },
            { id: 'staff', label: 'Персонал' },
            { id: 'suppliers', label: 'Поставщики' },
            { id: 'discounts', label: 'Скидки' },
            { id: 'branding', label: 'Ресторан' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 shadow-soft hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'dashboard' ? (
        loadingDashboard ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        ) : (
          <> 
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard title="Выручка" value={`${summary.totalRevenue.toFixed(2)} ₽`} />
              <SummaryCard title="Средний чек" value={`${summary.avgCheck.toFixed(2)} ₽`} />
              <SummaryCard title="Заказы" value={summary.totalOrders.toString()} />
              <SummaryCard title="Клиенты" value={summary.totalCustomers.toString()} />
            </div>
            <div className="mt-6">
              <Card title="Продажи и смены">
                <form onSubmit={handleApplySalesStats} className="mb-4 flex flex-wrap items-end gap-3 text-sm">
                  <label className="flex flex-col text-slate-600">
                    <span className="mb-1 text-xs uppercase text-slate-400">С даты</span>
                    <input
                      type="date"
                      value={salesStatsFilters.from}
                      onChange={(event) =>
                        setSalesStatsFilters((prev) => ({ ...prev, from: event.target.value }))
                      }
                      className="rounded-2xl border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col text-slate-600">
                    <span className="mb-1 text-xs uppercase text-slate-400">По дату</span>
                    <input
                      type="date"
                      value={salesStatsFilters.to}
                      onChange={(event) =>
                        setSalesStatsFilters((prev) => ({ ...prev, to: event.target.value }))
                      }
                      className="rounded-2xl border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={salesStatsLoading}
                    >
                      Применить
                    </button>
                    <button
                      type="button"
                      onClick={handleResetSalesStats}
                      className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
                      disabled={salesStatsLoading}
                    >
                      Сбросить
                    </button>
                  </div>
                </form>
                {salesStatsError ? (
                  <p className="mb-3 text-sm text-red-500">{salesStatsError}</p>
                ) : null}
                {salesStatsLoading ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-200/70" />
                    ))}
                  </div>
                ) : salesShiftStats ? (
                  <>
                    {formatPeriodLabel(salesShiftStats.period) ? (
                      <p className="mb-3 text-xs uppercase text-slate-400">
                        Период: {formatPeriodLabel(salesShiftStats.period)}
                      </p>
                    ) : null}
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {[
                        {
                          label: 'Выручка',
                          value: `${formatCurrency(salesShiftStats.totalRevenue)} ₽`,
                        },
                        {
                          label: 'Средний чек',
                          value: `${formatCurrency(salesShiftStats.averageOrderValue)} ₽`,
                        },
                        {
                          label: 'Заказы',
                          value: formatInteger(salesShiftStats.orderCount),
                        },
                        {
                          label: 'С собой',
                          value: formatInteger(salesShiftStats.takeawayOrders),
                        },
                        {
                          label: 'Доставка',
                          value: formatInteger(salesShiftStats.deliveryOrders),
                        },
                        {
                          label: 'Открытых смен',
                          value: formatInteger(salesShiftStats.openShiftCount),
                        },
                        {
                          label: 'Закрыто за период',
                          value: formatInteger(salesShiftStats.closedShiftCount),
                        },
                        {
                          label: 'Активно сейчас',
                          value: formatInteger(salesShiftStats.currentOpenShiftCount),
                        },
                        {
                          label: 'Выручка на смену',
                          value: `${formatCurrency(salesShiftStats.averageRevenuePerClosedShift)} ₽`,
                        },
                      ].map((metric) => (
                        <div
                          key={metric.label}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                        >
                          <p className="text-xs font-semibold uppercase text-slate-400">{metric.label}</p>
                          <p className="mt-1 text-lg font-semibold text-slate-800">{metric.value}</p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Нет данных за выбранный период</p>
                )}
              </Card>
            </div>
            <div className="mt-6">
              <Card title="История чеков по дате">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void loadReceiptHistory(receiptHistoryDate);
                  }}
                  className="mb-4 flex flex-wrap items-end gap-3 text-sm"
                >
                  <label className="flex flex-col text-slate-600">
                    <span className="mb-1 text-xs uppercase text-slate-400">Дата</span>
                    <input
                      type="date"
                      value={receiptHistoryDate}
                      onChange={(event) => setReceiptHistoryDate(event.target.value)}
                      className="rounded-2xl border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={receiptHistoryLoading}
                  >
                    Обновить
                  </button>
                </form>
                {receiptHistoryError ? (
                  <p className="mb-3 text-sm text-red-500">{receiptHistoryError}</p>
                ) : null}
                {receiptHistoryLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-200/70" />
                    ))}
                  </div>
                ) : receiptHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">Чеки за выбранную дату не найдены.</p>
                ) : (
                  <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
                    {receiptHistory.map((order) => (
                      <li key={order._id} className="rounded-2xl border border-slate-100 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              #{order._id.slice(-5)} · {formatHistoryTime(order.createdAt)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {order.customerName ?? 'Гость'} · {order.cashierName ?? 'Кассир'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold text-slate-900">{order.total.toFixed(2)} ₽</p>
                            <p className="text-xs uppercase text-slate-400">
                              {order.paymentMethod === 'card'
                                ? 'Карта'
                                : order.paymentMethod === 'cash'
                                  ? 'Наличные'
                                  : '—'}
                            </p>
                          </div>
                        </div>
                        {order.items.length ? (
                          <p className="mt-2 text-xs text-slate-500">
                            {order.items.map((item) => `${item.qty}× ${item.name}`).join(', ')}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <Card title="Выручка по дням">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 16,
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                        }}
                      />
                      <Bar dataKey="revenue" fill="#10B981" radius={[12, 12, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card title="Топ продукты">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={topProducts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#64748b" />
                      <YAxis type="category" dataKey="name" stroke="#64748b" width={120} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 16,
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                        }}
                      />
                      <Bar dataKey="qty" fill="#3B82F6" radius={[0, 12, 12, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <Card title="Лучшие клиенты">
                <ul className="space-y-3">
                  {topCustomers.map((customer) => (
                    <li
                      key={customer.name}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-soft"
                    >
                      <span className="text-sm font-semibold text-slate-700">{customer.name}</span>
                      <span className="text-sm text-slate-500">{customer.totalSpent.toFixed(2)} ₽</span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card title="Баллы лояльности">
                <div className="rounded-2xl bg-emerald-50 p-6 text-emerald-700">
                  <p className="text-sm">Начислено</p>
                  <p className="text-3xl font-bold">{loyaltySummary.totalPointsIssued.toFixed(0)} баллов</p>
                  <p className="mt-4 text-sm">Использовано: {loyaltySummary.totalPointsRedeemed.toFixed(0)} баллов</p>
                </div>
              </Card>
            </div>
          </>
        )
      ) : null}

      {activeTab === 'menu' ? (
        <div className="lg:flex lg:items-start lg:gap-6">
          <aside className="mb-4 w-full lg:mb-0 lg:w-64">
            <Card title="Раздел меню">
              <div className="mt-2 flex flex-col gap-2">
                {[
                  { id: 'products', label: 'Позиции', description: 'Создание и настройка блюд' },
                  { id: 'categories', label: 'Категории', description: 'Группировка и порядок' },
                  { id: 'ingredients', label: 'Ингредиенты', description: 'Себестоимость и закупки' },
                  { id: 'modifiers', label: 'Модификаторы', description: 'Дополнения и опции' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMenuSection(item.id as typeof menuSection)}
                    className={`flex flex-col rounded-xl border px-3 py-2 text-left transition hover:border-emerald-300 ${
                      menuSection === item.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                    <span className="text-xs text-slate-500">{item.description}</span>
                  </button>
                ))}
              </div>
            </Card>
          </aside>
          <div className="flex-1 space-y-6">
            {menuSection === 'categories' ? (
              <Card title="Категории">
                <form onSubmit={handleCreateCategory} className="mb-4 flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="Новая категория"
                    className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Добавить
                  </button>
                </form>
                <ul className="space-y-2">
                  {categories.map((category) => (
                    <li
                      key={category._id}
                      onClick={() => handleSelectCategory(category)}
                      className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition hover:bg-emerald-50 ${
                        selectedCategory?._id === category._id ? 'bg-emerald-100' : 'bg-slate-50'
                      }`}
                    >
                      <span className="text-sm font-medium text-slate-700">{category.name}</span>
                      <span className="text-xs text-slate-400">
                        {products.filter((product) => product.categoryId === category._id).length} позиций
                      </span>
                    </li>
                  ))}
                </ul>
                {selectedCategory ? (
                  <form onSubmit={handleUpdateCategory} className="mt-4 space-y-3 text-sm">
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase text-slate-400">Название</label>
                      <input
                        type="text"
                        value={categoryEditName}
                        onChange={(event) => setCategoryEditName(event.target.value)}
                        className="rounded-2xl border border-slate-200 px-3 py-2"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase text-slate-400">Порядок</label>
                      <input
                        type="number"
                        value={categorySortOrder}
                        onChange={(event) => setCategorySortOrder(event.target.value)}
                        className="rounded-2xl border border-slate-200 px-3 py-2"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-emerald-500 py-2 text-sm font-semibold text-white"
                    >
                      Сохранить изменения
                    </button>
                  </form>
                ) : (
                  <p className="mt-4 text-xs text-slate-400">Выберите категорию для редактирования</p>
                )}
              </Card>
            ) : null}

            {menuSection === 'products' ? (
              <>
                <Card title="Новая позиция">
                  <form onSubmit={handleCreateProduct} className="space-y-3 text-sm">
                    <input
                      type="text"
                      placeholder="Название"
                      value={newProduct.name}
                      onChange={(event) => setNewProduct((prev) => ({ ...prev, name: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    />
                    <textarea
                      placeholder="Описание"
                      value={newProduct.description}
                      onChange={(event) => setNewProduct((prev) => ({ ...prev, description: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                      rows={3}
                    />
                    <input
                      type="url"
                      placeholder="Ссылка на фото"
                      value={newProduct.imageUrl}
                      onChange={(event) => setNewProduct((prev) => ({ ...prev, imageUrl: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    />
                    <select
                      value={newProduct.categoryId}
                      onChange={(event) => setNewProduct((prev) => ({ ...prev, categoryId: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    >
                      <option value="">Категория</option>
                      {categories.map((category) => (
                        <option key={category._id} value={category._id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Базовая цена"
                        value={newProduct.basePrice}
                        onChange={(event) => setNewProduct((prev) => ({ ...prev, basePrice: event.target.value }))}
                        className="rounded-2xl border border-slate-200 px-4 py-2"
                      />
                      <select
                        value={newProduct.discountType}
                        onChange={(event) =>
                          setNewProduct((prev) => ({ ...prev, discountType: event.target.value as typeof prev.discountType }))
                        }
                        className="rounded-2xl border border-slate-200 px-4 py-2"
                      >
                        <option value="">Без скидки</option>
                        <option value="percentage">Скидка %</option>
                        <option value="fixed">Фикс. скидка</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Значение скидки"
                        value={newProduct.discountValue}
                        onChange={(event) => setNewProduct((prev) => ({ ...prev, discountValue: event.target.value }))}
                        className="rounded-2xl border border-slate-200 px-4 py-2"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-slate-500">Модификаторы</p>
                      {modifierGroups.length ? (
                        <div className="max-h-32 space-y-2 overflow-y-auto rounded-2xl border border-slate-100 p-3">
                          {modifierGroups.map((group) => {
                            const checked = newProductModifierIds.includes(group._id);
                            return (
                              <label
                                key={group._id}
                                className="flex items-center justify-between rounded-xl px-2 py-1 text-sm transition hover:bg-slate-50"
                              >
                                <span className="text-slate-700">
                                  {group.name}
                                  <span className="ml-2 text-[11px] uppercase text-slate-400">
                                    {group.selectionType === 'single' ? '1 вариант' : 'Несколько'}
                                    {group.required ? ' · Обязательная' : ''}
                                  </span>
                                </span>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggleNewProductModifier(group._id)}
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                />
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Создайте группы модификаторов и привяжите их к позиции.</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-slate-500">Ингредиенты</p>
                      {productIngredients.map((row, index) => (
                        <div key={index} className="flex gap-2">
                        <select
                          value={row.ingredientId}
                          onChange={(event) => handleIngredientChange(index, 'ingredientId', event.target.value)}
                          className="flex-1 rounded-2xl border border-slate-200 px-3 py-2"
                        >
                            <option value="">Ингредиент</option>
                            {ingredients.map((ingredient) => (
                              <option key={ingredient._id} value={ingredient._id}>
                                {ingredient.name}
                              </option>
                            ))}
                          </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.quantity}
                          onChange={(event) => handleIngredientChange(index, 'quantity', event.target.value)}
                          className="w-28 rounded-2xl border border-slate-200 px-3 py-2"
                          placeholder="Кол-во"
                        />
                        <select
                          value={row.unit || ''}
                          onChange={(event) => handleIngredientChange(index, 'unit', event.target.value)}
                          className="w-28 rounded-2xl border border-slate-200 px-3 py-2"
                        >
                          <option value="">Ед.</option>
                          {measurementUnits.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleAddIngredientRow}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                      >
                        + Добавить ингредиент
                      </button>
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-emerald-500 py-2 text-sm font-semibold text-white"
                    >
                      Сохранить позицию
                    </button>
                  </form>
                </Card>
                <Card title="Позиции меню">
                  {menuLoading ? (
                    <div className="h-32 animate-pulse rounded-2xl bg-slate-200/60" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="text-xs uppercase text-slate-400">
                            <th className="px-3 py-2">Название</th>
                            <th className="px-3 py-2">Категория</th>
                            <th className="px-3 py-2">Цена</th>
                            <th className="px-3 py-2">Себестоимость</th>
                            <th className="px-3 py-2">Скидка</th>
                            <th className="px-3 py-2">Статус</th>
                            <th className="px-3 py-2 text-right">Действия</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {products.map((product) => {
                            const categoryName = categories.find((cat) => cat._id === product.categoryId)?.name || '—';
                            const discountLabel = product.discountType
                              ? product.discountType === 'percentage'
                                ? `${product.discountValue ?? 0}%`
                                : `${product.discountValue?.toFixed(2)} ₽`
                              : '—';
                            return (
                              <tr key={product._id} className="align-middle">
                                <td className="px-3 py-2 font-medium text-slate-800">{product.name}</td>
                                <td className="px-3 py-2 text-slate-500">{categoryName}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      defaultValue={product.basePrice ?? product.price}
                                      className="w-24 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                                      onBlur={(event) =>
                                        handleProductPriceChange(product._id, { basePrice: Number(event.target.value) })
                                      }
                                    />
                                    <span className="text-sm text-slate-400">({product.price.toFixed(2)} ₽)</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-slate-500">
                                  {product.costPrice !== undefined ? `${product.costPrice.toFixed(2)} ₽` : '—'}
                                </td>
                                <td className="px-3 py-2 text-slate-500">{discountLabel}</td>
                                <td className="px-3 py-2">
                                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-500">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                      checked={product.isActive !== false}
                                      onChange={(event) =>
                                        handleProductPriceChange(product._id, { isActive: event.target.checked })
                                      }
                                    />
                                    В продаже
                                  </label>
                                </td>
                                <td className="px-3 py-2 text-right text-xs text-slate-400">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectProduct(product)}
                                      className="rounded-full bg-white px-3 py-1 font-semibold text-emerald-600 shadow-inner hover:bg-emerald-50"
                                    >
                                      Настроить
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleProductPriceChange(product._id, {
                                          discountType: null,
                                          discountValue: null,
                                          basePrice: product.basePrice ?? product.price,
                                          price: product.basePrice ?? product.price,
                                        })
                                      }
                                      className="rounded-full px-3 py-1 transition hover:bg-slate-200"
                                    >
                                      Сбросить скидку
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteProduct(product._id)}
                                      className="rounded-full px-3 py-1 font-semibold text-red-600 transition hover:bg-red-50"
                                    >
                                      Удалить
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
                <Card title="Настройка выбранной позиции">
                  {selectedProduct ? (
                    <form onSubmit={handleUpdateProduct} className="grid gap-4 text-sm md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">Название</label>
                        <input
                          type="text"
                          value={productEditForm.name}
                          onChange={(event) => setProductEditForm((prev) => ({ ...prev, name: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">Категория</label>
                        <select
                          value={productEditForm.categoryId}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({ ...prev, categoryId: event.target.value }))
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                        >
                          <option value="">Выберите категорию</option>
                          {categories.map((category) => (
                            <option key={category._id} value={category._id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">Описание</label>
                        <textarea
                          value={productEditForm.description}
                          onChange={(event) => setProductEditForm((prev) => ({ ...prev, description: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">Изображение</label>
                        <input
                          type="url"
                          value={productEditForm.imageUrl}
                          onChange={(event) => setProductEditForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">Базовая цена</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={productEditForm.basePrice}
                          onChange={(event) => setProductEditForm((prev) => ({ ...prev, basePrice: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">Тип скидки</label>
                        <select
                          value={productEditForm.discountType}
                          onChange={(event) =>
                            setProductEditForm((prev) => ({ ...prev, discountType: event.target.value as typeof prev.discountType }))
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                        >
                          <option value="">Нет</option>
                          <option value="percentage">Процент</option>
                          <option value="fixed">Фиксированная</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">Значение скидки</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={productEditForm.discountValue}
                          onChange={(event) => setProductEditForm((prev) => ({ ...prev, discountValue: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-slate-400">Статус</label>
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                            checked={productEditForm.isActive}
                            onChange={(event) => setProductEditForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                          />
                          В продаже
                        </label>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-slate-400">Модификаторы</p>
                        {modifierGroups.length ? (
                          <div className="max-h-32 space-y-2 overflow-y-auto rounded-2xl border border-slate-100 p-3">
                            {modifierGroups.map((group) => {
                              const checked = productEditModifiers.includes(group._id);
                              return (
                                <label
                                  key={group._id}
                                  className="flex items-center justify-between rounded-xl px-2 py-1 text-sm transition hover:bg-slate-50"
                                >
                                  <span className="text-slate-700">
                                    {group.name}
                                    <span className="ml-2 text-[11px] uppercase text-slate-400">
                                      {group.selectionType === 'single' ? '1 вариант' : 'Несколько'}
                                      {group.required ? ' · Обязательная' : ''}
                                    </span>
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => handleToggleEditProductModifier(group._id)}
                                    className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                  />
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">Группы модификаторов пока не созданы.</p>
                        )}
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase text-slate-400">Ингредиенты</p>
                          <button
                            type="button"
                            onClick={addEditIngredientRow}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                          >
                            + Добавить
                          </button>
                        </div>
                        {productEditIngredients.length === 0 ? (
                          <p className="text-xs text-slate-400">Ингредиенты не указаны, позиция считается самостоятельной.</p>
                        ) : null}
                        {productEditIngredients.map((row, index) => (
                          <div key={index} className="flex flex-wrap items-center gap-2">
                          <select
                            value={row.ingredientId}
                            onChange={(event) => handleEditIngredientChange(index, 'ingredientId', event.target.value)}
                            className="flex-1 rounded-2xl border border-slate-200 px-3 py-2"
                          >
                              <option value="">Ингредиент</option>
                              {ingredients.map((ingredient) => (
                                <option key={ingredient._id} value={ingredient._id}>
                                  {ingredient.name}
                                </option>
                              ))}
                            </select>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.quantity}
                            onChange={(event) => handleEditIngredientChange(index, 'quantity', event.target.value)}
                            className="w-28 rounded-2xl border border-slate-200 px-3 py-2"
                            placeholder="Кол-во"
                          />
                          <select
                            value={row.unit || ''}
                            onChange={(event) => handleEditIngredientChange(index, 'unit', event.target.value)}
                            className="w-28 rounded-2xl border border-slate-200 px-3 py-2"
                          >
                            <option value="">Ед.</option>
                            {measurementUnits.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                            <button
                              type="button"
                              onClick={() => removeEditIngredientRow(index)}
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-200"
                            >
                              Удалить
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="md:col-span-2 flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          Себестоимость: {selectedProduct.costPrice !== undefined ? `${selectedProduct.costPrice.toFixed(2)} ₽` : '—'}
                        </span>
                        <button
                          type="submit"
                          className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
                        >
                          Сохранить изменения
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="text-xs text-slate-400">Выберите позицию из списка, чтобы изменить описание, цену или состав.</p>
                  )}
                </Card>
              </>
            ) : null}

            {menuSection === 'ingredients' ? (
              <>
                <Card title="Добавить ингредиент">
                  <form onSubmit={handleCreateIngredient} className="space-y-3 text-sm">
                    <input name="name" type="text" placeholder="Название" className="w-full rounded-2xl border border-slate-200 px-4 py-2" />
                    <select name="unit" defaultValue="" className="w-full rounded-2xl border border-slate-200 px-4 py-2">
                      <option value="" disabled>
                        Выберите единицу измерения
                      </option>
                      {measurementUnits.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                    <input name="costPerUnit" type="number" step="0.01" min="0" placeholder="Цена за единицу" className="w-full rounded-2xl border border-slate-200 px-4 py-2" />
                    <button type="submit" className="w-full rounded-2xl bg-slate-900 py-2 text-sm font-semibold text-white">
                      Добавить ингредиент
                    </button>
                  </form>
                </Card>
                <Card title="Ингредиенты">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <ul className="space-y-2">
                        {ingredients.map((ingredient) => (
                          <li
                            key={ingredient._id}
                            onClick={() => handleSelectIngredient(ingredient)}
                            className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition hover:bg-emerald-50 ${
                              selectedIngredient?._id === ingredient._id ? 'bg-emerald-100' : 'bg-slate-50'
                            }`}
                          >
                            <span className="text-sm font-medium text-slate-700">{ingredient.name}</span>
                            <span className="text-xs text-slate-400">
                              {ingredient.costPerUnit !== undefined ? `${ingredient.costPerUnit.toFixed(2)} ₽ / ${ingredient.unit}` : ingredient.unit}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      {selectedIngredient ? (
                        <form onSubmit={handleUpdateIngredient} className="space-y-3 text-sm">
                          <div className="grid gap-2">
                            <label className="text-xs font-semibold uppercase text-slate-400">Название</label>
                            <input
                              type="text"
                              value={ingredientEditForm.name}
                              onChange={(event) => setIngredientEditForm((prev) => ({ ...prev, name: event.target.value }))}
                              className="rounded-2xl border border-slate-200 px-3 py-2"
                            />
                          </div>
                          <div className="grid gap-2">
                            <label className="text-xs font-semibold uppercase text-slate-400">Единица</label>
                            <select
                              value={ingredientEditForm.unit}
                              onChange={(event) => setIngredientEditForm((prev) => ({ ...prev, unit: event.target.value }))}
                              className="rounded-2xl border border-slate-200 px-3 py-2"
                            >
                              <option value="" disabled>
                                Выберите единицу измерения
                              </option>
                              {measurementUnits.map((unit) => (
                                <option key={unit} value={unit}>
                                  {unit}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <label className="text-xs font-semibold uppercase text-slate-400">Стоимость за единицу</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={ingredientEditForm.costPerUnit}
                              onChange={(event) => setIngredientEditForm((prev) => ({ ...prev, costPerUnit: event.target.value }))}
                              className="rounded-2xl border border-slate-200 px-3 py-2"
                            />
                          </div>
                          <div className="grid gap-2">
                            <label className="text-xs font-semibold uppercase text-slate-400">Поставщик</label>
                            <select
                              value={ingredientEditForm.supplierId}
                              onChange={(event) => setIngredientEditForm((prev) => ({ ...prev, supplierId: event.target.value }))}
                              className="rounded-2xl border border-slate-200 px-3 py-2"
                            >
                              <option value="">Не указан</option>
                              {suppliers.map((supplier) => (
                                <option key={supplier._id} value={supplier._id}>
                                  {supplier.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid gap-2">
                            <label className="text-xs font-semibold uppercase text-slate-400">Описание</label>
                            <textarea
                              value={ingredientEditForm.description}
                              onChange={(event) => setIngredientEditForm((prev) => ({ ...prev, description: event.target.value }))}
                              className="rounded-2xl border border-slate-200 px-3 py-2"
                              rows={3}
                            />
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              type="submit"
                              className="w-full rounded-2xl bg-emerald-500 py-2 text-sm font-semibold text-white"
                            >
                              Сохранить ингредиент
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteIngredient(selectedIngredient._id)}
                              className="w-full rounded-2xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                            >
                              Удалить ингредиент
                            </button>
                          </div>
                        </form>
                      ) : (
                        <p className="text-xs text-slate-400">Выберите ингредиент, чтобы скорректировать себестоимость.</p>
                      )}
                    </div>
                  </div>
                </Card>
              </>
            ) : null}

            {menuSection === 'modifiers' ? (
              <Card title="Группы модификаторов">
                <form
                  onSubmit={selectedModifierGroup ? handleUpdateModifierGroup : handleCreateModifierGroup}
                  className="space-y-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase text-slate-400">
                      {selectedModifierGroup ? 'Редактирование группы' : 'Новая группа'}
                    </p>
                    {selectedModifierGroup ? (
                      <button
                        type="button"
                        onClick={resetModifierGroupForm}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                      >
                        Очистить
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    placeholder="Название группы"
                    value={modifierGroupForm.name}
                    onChange={(event) => handleModifierGroupFieldChange('name', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <select
                      value={modifierGroupForm.selectionType}
                      onChange={(event) => handleModifierGroupFieldChange('selectionType', event.target.value as 'single' | 'multiple')}
                      className="rounded-2xl border border-slate-200 px-4 py-2"
                    >
                      <option value="single">Один вариант</option>
                      <option value="multiple">Несколько вариантов</option>
                    </select>
                    <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">
                      <span>Обязательная группа</span>
                      <input
                        type="checkbox"
                        checked={modifierGroupForm.required}
                        onChange={(event) => handleModifierGroupFieldChange('required', event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                      />
                    </label>
                  </div>
                  <input
                    type="number"
                    placeholder="Порядок сортировки"
                    value={modifierGroupForm.sortOrder}
                    onChange={(event) => handleModifierGroupFieldChange('sortOrder', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase text-slate-400">Опции</p>
                      <button
                        type="button"
                        onClick={addModifierOptionRow}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                      >
                        + Добавить
                      </button>
                    </div>
                    {modifierGroupForm.options.map((option, index) => (
                      <div key={`${option.name || 'option'}-${index}`} className="space-y-3 rounded-2xl border border-slate-200 p-3">
                        <div className="grid gap-2 md:grid-cols-3">
                          <input
                            type="text"
                            placeholder="Название"
                            value={option.name}
                            onChange={(event) => handleModifierOptionChange(index, 'name', event.target.value)}
                            className="rounded-xl border border-slate-200 px-3 py-2"
                          />
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Δ цена"
                            value={option.priceChange}
                            onChange={(event) => handleModifierOptionChange(index, 'priceChange', event.target.value)}
                            className="rounded-xl border border-slate-200 px-3 py-2"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Δ себестоимость"
                              value={option.costChange}
                              onChange={(event) => handleModifierOptionChange(index, 'costChange', event.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                            {modifierGroupForm.options.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeModifierOptionRow(index)}
                                className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300"
                                aria-label="Удалить опцию"
                              >
                                ✕
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">Состав позиции</span>
                            <span className="text-[11px] text-slate-500">Δ себестоимость: {option.costChange || '0'} ₽</span>
                          </div>
                          {baseIngredientsForCost.length ? (
                            baseIngredientsForCost.map((ingredient) => {
                              const deltaEntry = option.ingredientDeltas?.find((entry) => entry.ingredientId === ingredient.ingredientId);
                              const deltaValue = deltaEntry?.delta ?? '';
                              const estimatedCost =
                                convertQuantity(Number(deltaValue) || 0, deltaEntry?.unit || ingredient.unit, ingredient.ingredientUnit) *
                                (ingredient.costPerUnit ?? 0);
                              return (
                                <div key={`${ingredient.ingredientId}-${index}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2">
                                  <div className="min-w-[160px] flex-1">
                                    <p className="text-xs font-semibold text-slate-800">{ingredient.name}</p>
                                    <p className="text-[11px] text-slate-500">
                                      Базово: {ingredient.quantity} {ingredient.unit} ·{' '}
                                      {ingredient.costPerUnit
                                        ? `${ingredient.costPerUnit.toFixed(2)} ₽/${ingredient.ingredientUnit || ingredient.unit}`
                                        : 'нет цены'}
                                    </p>
                                  </div>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={deltaValue}
                                    onChange={(event) =>
                                      handleModifierOptionIngredientDeltaChange(index, ingredient.ingredientId, event.target.value)
                                    }
                                    className="w-32 rounded-xl border border-slate-200 px-2 py-1"
                                    placeholder="Изменение"
                                  />
                                  <span className="text-[11px] text-slate-500">≈ {estimatedCost.toFixed(2)} ₽</span>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-[11px] text-slate-500">Добавьте ингредиенты к позиции, чтобы считать себестоимость автоматически.</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
                      {selectedModifierGroup ? 'Сохранить изменения' : 'Создать группу'}
                    </button>
                    {selectedModifierGroup ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteModifierGroup(selectedModifierGroup._id)}
                        className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
                      >
                        Удалить
                      </button>
                    ) : null}
                  </div>
                </form>
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase text-slate-400">Список групп</p>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {modifierGroups.length === 0 ? (
                      <p className="text-xs text-slate-400">Пока ни одной группы не создано.</p>
                    ) : null}
                    {modifierGroups.map((group) => (
                      <div
                        key={group._id}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition hover:border-emerald-300 ${
                          selectedModifierGroup?._id === group._id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-slate-800">{group.name}</p>
                          <p className="text-[11px] uppercase text-slate-400">
                            {group.selectionType === 'single' ? 'Один вариант' : 'Несколько вариантов'}
                            {group.required ? ' · Обязательная' : ''}
                          </p>
                          <p className="text-[11px] text-slate-500">{group.options.length} опций · Сортировка {group.sortOrder ?? '—'}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectModifierGroup(group)}
                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-600 shadow-inner hover:bg-emerald-50"
                          >
                            Редактировать
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteModifierGroup(group._id)}
                            className="rounded-full px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}
      {activeTab === 'inventory' ? (
        <div className="space-y-6">
          <section className="grid gap-6 lg:grid-cols-3">
            <Card title="Склады">
              <form onSubmit={handleCreateWarehouse} className="space-y-3 text-sm">
                <input
                  type="text"
                  value={newWarehouse.name}
                  onChange={(event) => setNewWarehouse((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Название"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                />
                <input
                  type="text"
                  value={newWarehouse.location}
                  onChange={(event) => setNewWarehouse((prev) => ({ ...prev, location: event.target.value }))}
                  placeholder="Адрес"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                />
                <textarea
                  value={newWarehouse.description}
                  onChange={(event) => setNewWarehouse((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Описание"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  rows={3}
                />
                <button type="submit" className="w-full rounded-2xl bg-slate-900 py-2 text-sm font-semibold text-white">
                  Добавить склад
                </button>
              </form>
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase text-slate-400">Список складов</p>
                <ul className="space-y-2 text-sm">
                  {warehouses.map((warehouse) => (
                    <li
                      key={warehouse._id}
                      onClick={() => handleSelectWarehouse(warehouse)}
                      className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition hover:bg-emerald-50 ${
                        selectedWarehouse?._id === warehouse._id ? 'bg-emerald-100' : 'bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-slate-700">{warehouse.name}</p>
                        <p className="text-xs text-slate-400">{warehouse.location || 'Адрес не задан'}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              {selectedWarehouse ? (
                <form onSubmit={handleUpdateWarehouse} className="mt-4 space-y-3 text-sm">
                  <p className="text-xs uppercase text-slate-400">Редактирование склада</p>
                  <input
                    type="text"
                    value={warehouseEditForm.name}
                    onChange={(event) =>
                      setWarehouseEditForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  />
                  <input
                    type="text"
                    value={warehouseEditForm.location}
                    onChange={(event) =>
                      setWarehouseEditForm((prev) => ({ ...prev, location: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    placeholder="Адрес"
                  />
                  <textarea
                    value={warehouseEditForm.description}
                    onChange={(event) =>
                      setWarehouseEditForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    rows={2}
                    placeholder="Описание"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-emerald-500 py-2 text-sm font-semibold text-white"
                    >
                      Сохранить склад
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteWarehouse(selectedWarehouse._id)}
                      className="w-full rounded-2xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      Удалить склад
                    </button>
                  </div>
                </form>
              ) : null}
            </Card>
            <Card title="Сводка">
              {inventorySummary ? (
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center justify-between">
                    <span className="text-slate-500">Продуктов</span>
                    <span className="font-semibold text-slate-800">{inventorySummary.productsTracked}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-slate-500">Ингредиентов</span>
                    <span className="font-semibold text-slate-800">{inventorySummary.ingredientsTracked}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-slate-500">Стоимость запасов</span>
                    <span className="font-semibold text-slate-800">{inventorySummary.stockValue.toFixed(2)} ₽</span>
                  </li>
                </ul>
              ) : (
                <p className="text-sm text-slate-400">Нет данных</p>
              )}
            </Card>
            <Card title="Поставка / списание">
              <form onSubmit={handleSaveStockReceipt} className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>
                    {selectedStockReceipt
                      ? `Редактирование: ${receiptTypeLabels[selectedStockReceipt.type]}`
                      : 'Новый документ склада'}
                  </span>
                  {selectedStockReceipt ? (
                    <button
                      type="button"
                      onClick={() => resetReceiptForm()}
                      className="font-semibold text-slate-600 hover:text-slate-800"
                    >
                      Очистить форму
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={receiptType}
                    onChange={(event) => setReceiptType(event.target.value as typeof receiptType)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  >
                    <option value="receipt">Поставка</option>
                    <option value="writeOff">Списание</option>
                  </select>
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={(event) => setReceiptDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  />
                </div>
                <select
                  value={receiptForm.warehouseId}
                  onChange={(event) =>
                    setReceiptForm((prev) => ({ ...prev, warehouseId: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                >
                  <option value="">Выберите склад</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse._id} value={warehouse._id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                <select
                  value={receiptForm.supplierId}
                  onChange={(event) =>
                    setReceiptForm((prev) => ({ ...prev, supplierId: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                >
                  <option value="">Поставщик не выбран</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                {receiptForm.warehouseId ? (
                  <p className="text-[11px] text-slate-500">
                    Последняя инвентаризация склада:{' '}
                    {warehouseMap.get(receiptForm.warehouseId)?.lastInventoryAt
                      ? formatDateTime(warehouseMap.get(receiptForm.warehouseId)?.lastInventoryAt)
                      : 'нет данных'}
                  </p>
                ) : null}
                <div className="space-y-3">
                  {receiptForm.items.map((item, index) => (
                    <div key={index} className="rounded-2xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={item.itemType}
                          onChange={(event) =>
                            handleReceiptItemChange(index, 'itemType', event.target.value)
                          }
                          className="rounded-2xl border border-slate-200 px-3 py-2"
                        >
                          <option value="ingredient">Ингредиент</option>
                          <option value="product">Продукт</option>
                        </select>
                        <select
                          value={item.itemId}
                          onChange={(event) =>
                            handleReceiptItemChange(index, 'itemId', event.target.value)
                          }
                          className="flex-1 rounded-2xl border border-slate-200 px-3 py-2"
                        >
                          <option value="">Позиция</option>
                          {(item.itemType === 'ingredient' ? ingredients : products).map((entry) => (
                            <option key={entry._id} value={entry._id}>
                              {'unit' in entry ? `${entry.name} (${entry.unit})` : entry.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(event) =>
                            handleReceiptItemChange(index, 'quantity', event.target.value)
                          }
                          className="w-28 rounded-2xl border border-slate-200 px-3 py-2"
                          placeholder="Кол-во"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(event) =>
                            handleReceiptItemChange(index, 'unitCost', event.target.value)
                          }
                          className="w-32 rounded-2xl border border-slate-200 px-3 py-2"
                          placeholder="Цена"
                        />
                        {receiptForm.items.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeReceiptItemRow(index)}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-200"
                          >
                            Удалить
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={addReceiptItemRow}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      + Добавить позицию
                    </button>
                    <p className="text-[11px] text-amber-600">
                      После инвентаризации документы с более ранней датой будут заблокированы для изменений.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedStockReceipt && selectedStockReceipt.type !== 'inventory' ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteStockReceipt(selectedStockReceipt._id)}
                        className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        Удалить
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
                    >
                      {selectedStockReceipt ? 'Обновить документ' : 'Сохранить документ'}
                    </button>
                  </div>
                </div>
              </form>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card title="Документы склада">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Показать:</span>
                  <select
                    value={receiptFilter}
                    onChange={(event) => setReceiptFilter(event.target.value as typeof receiptFilter)}
                    className="rounded-xl border border-slate-200 px-3 py-1"
                  >
                    <option value="all">Все</option>
                    <option value="receipt">Поставки</option>
                    <option value="writeOff">Списания</option>
                    <option value="inventory">Инвентаризации</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => void loadStockReceipts()}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Обновить список
                </button>
              </div>
              {stockReceiptsLoading ? (
                <div className="mt-3 h-24 animate-pulse rounded-2xl bg-slate-200/70" />
              ) : stockReceiptsError ? (
                <p className="mt-3 text-sm text-red-600">{stockReceiptsError}</p>
              ) : filteredStockReceipts.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">Документы не найдены.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {filteredStockReceipts.map((receipt) => {
                    const total = calculateReceiptTotal(receipt);
                    const warehouseName = warehouseMap.get(receipt.warehouseId)?.name ?? '—';
                    const supplierName = receipt.supplierId
                      ? supplierMap.get(receipt.supplierId)?.name ?? '—'
                      : '—';

                    return (
                      <li
                        key={receipt._id}
                        className={`rounded-2xl border px-3 py-2 text-sm transition hover:border-emerald-300 ${
                          selectedStockReceipt?._id === receipt._id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                                {receiptTypeLabels[receipt.type]}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {formatReceiptDateTime(receipt.occurredAt)}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Склад: {warehouseName} · Поставщик: {supplierName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Позиции: {receipt.items.length} · Сумма: {total.toFixed(2)} ₽
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {receipt.type !== 'inventory' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSelectStockReceipt(receipt)}
                                  className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-600 shadow-inner hover:bg-emerald-50"
                                >
                                  Редактировать
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStockReceipt(receipt._id)}
                                  className="rounded-full px-3 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
                                >
                                  Удалить
                                </button>
                              </>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                                Заблокировано
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card title="Инвентаризация">
              <form onSubmit={handleSubmitInventoryAudit} className="space-y-3 text-sm">
                <p className="text-[11px] text-amber-700">
                  После завершения инвентаризации документы до выбранной даты будут заблокированы для изменений.
                </p>
                <select
                  value={inventoryAuditForm.warehouseId}
                  onChange={(event) =>
                    setInventoryAuditForm((prev) => ({ ...prev, warehouseId: event.target.value, items: [] }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                >
                  <option value="">Выберите склад</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse._id} value={warehouse._id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={inventoryAuditForm.performedAt}
                  onChange={(event) =>
                    setInventoryAuditForm((prev) => ({ ...prev, performedAt: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                />
                <div className="space-y-3">
                  {inventoryAuditForm.items.map((item, index) => (
                    <div key={`${item.itemId || 'item'}-${index}`} className="rounded-2xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={item.itemType}
                          onChange={(event) =>
                            handleAuditItemChange(index, 'itemType', event.target.value)
                          }
                          className="rounded-2xl border border-slate-200 px-3 py-2"
                        >
                          <option value="ingredient">Ингредиент</option>
                          <option value="product">Продукт</option>
                        </select>
                        <select
                          value={item.itemId}
                          onChange={(event) => handleAuditItemChange(index, 'itemId', event.target.value)}
                          className="flex-1 rounded-2xl border border-slate-200 px-3 py-2"
                        >
                          <option value="">Позиция</option>
                          {(item.itemType === 'ingredient' ? ingredients : products).map((entry) => (
                            <option key={entry._id} value={entry._id}>
                              {'unit' in entry ? `${entry.name} (${entry.unit})` : entry.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.countedQuantity}
                          onChange={(event) =>
                            handleAuditItemChange(index, 'countedQuantity', event.target.value)
                          }
                          className="w-28 rounded-2xl border border-slate-200 px-3 py-2"
                          placeholder="Кол-во"
                        />
                        {inventoryAuditForm.items.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeAuditItemRow(index)}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-200"
                          >
                            Удалить
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={addAuditItemRow}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    + Добавить позицию
                  </button>
                  <button
                    type="submit"
                    disabled={auditSubmitting}
                    className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {auditSubmitting ? 'Сохраняем…' : 'Провести инвентаризацию'}
                  </button>
                </div>
              </form>

              {lastAuditResult ? (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-800">Последняя инвентаризация</p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(lastAuditResult.performedAt)} · Склад:{' '}
                      {warehouseMap.get(lastAuditResult.warehouseId)?.name ?? '—'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    Потери: {lastAuditResult.totalLossValue.toFixed(2)} ₽ · Излишки:{' '}
                    {lastAuditResult.totalGainValue.toFixed(2)} ₽
                  </p>
                  <div className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs text-slate-700">
                    {lastAuditResult.items.map((item, index) => (
                      <div key={`${item.itemId}-${index}`} className="rounded-xl bg-white px-3 py-2">
                        <p className="font-semibold text-slate-800">
                          {getInventoryItemName(item.itemType, item.itemId)}
                        </p>
                        <p>
                          Было {item.previousQuantity} → Стало {item.countedQuantity} ({item.difference >= 0 ? '+' : ''}
                          {item.difference})
                        </p>
                        {item.unitCostSnapshot !== undefined ? (
                          <p className="text-[11px] text-slate-500">
                            Стоимость изменения: {(item.difference * (item.unitCostSnapshot ?? 0)).toFixed(2)} ₽
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          </section>

          <Card title="Складские остатки">
            {inventoryLoading ? (
              <div className="h-32 animate-pulse rounded-2xl bg-slate-200/60" />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-slate-400">
                      <th className="px-3 py-2">Склад</th>
                      <th className="px-3 py-2">Позиция</th>
                      <th className="px-3 py-2">Количество</th>
                      <th className="px-3 py-2">Стоимость</th>
                      <th className="px-3 py-2 text-right">Корректировка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventoryItems.map((item) => (
                      <tr key={item._id}>
                        <td className="px-3 py-2 text-slate-500">{item.warehouse?.name ?? '—'}</td>
                        <td className="px-3 py-2 font-medium text-slate-700">
                          {item.itemType === 'ingredient'
                            ? item.ingredient?.name
                            : item.product?.name}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{item.quantity}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {item.unitCost ? `${(item.unitCost * item.quantity).toFixed(2)} ₽` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-xs">
                          <div className="flex justify-end gap-2">
                            {[ -10, -1, 1, 10 ].map((delta) => (
                              <button
                                key={delta}
                                type="button"
                                onClick={() => handleAdjustExistingInventory(item._id, delta)}
                                className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-500 hover:bg-slate-200"
                              >
                                {delta > 0 ? `+${delta}` : delta}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {activeTab === 'loyalty' ? (
        <div className="lg:flex lg:items-start lg:gap-6">
          <aside className="mb-4 w-full lg:mb-0 lg:w-64">
            <Card title="Раздел лояльности">
              <div className="mt-2 flex flex-col gap-2">
                {[
                  { id: 'settings', label: 'Настройки', description: 'Процент начисления баллов' },
                  { id: 'guests', label: 'Гости', description: 'Список гостей и их баллы' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setLoyaltySection(item.id as typeof loyaltySection)}
                    className={`flex flex-col rounded-xl border px-3 py-2 text-left transition hover:border-emerald-300 ${
                      loyaltySection === item.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-800">{item.label}</span>
                    <span className="text-xs text-slate-500">{item.description}</span>
                  </button>
                ))}
              </div>
            </Card>
          </aside>
          <div className="flex-1 space-y-6">
            {loyaltySection === 'settings' ? (
              <section className="grid gap-6 lg:grid-cols-2">
                <Card title="Начисление баллов">
                  <form onSubmit={handleSaveLoyaltyRate} className="space-y-4 text-sm">
                    <label className="block text-slate-600">
                      <span className="mb-1 block text-xs uppercase text-slate-400">Процент от суммы чека</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={loyaltyRateDraft}
                        onChange={(event) => setLoyaltyRateDraft(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                        placeholder="Например, 5"
                      />
                    </label>
                    <p className="text-xs text-slate-500">
                      Гость получит указанную долю от суммы оплаченного чека в виде баллов. Сейчас: {loyaltyRate}%.
                    </p>
                    <button
                      type="submit"
                      className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={savingLoyaltyRate}
                    >
                      {savingLoyaltyRate ? 'Сохранение…' : 'Сохранить настройку'}
                    </button>
                  </form>
                </Card>
                <Card title="Баллы лояльности">
                  <div className="rounded-2xl bg-emerald-50 p-6 text-emerald-700">
                    <p className="text-sm">Начислено</p>
                    <p className="text-3xl font-bold">{loyaltySummary.totalPointsIssued.toFixed(0)} баллов</p>
                    <p className="mt-4 text-sm">Использовано: {loyaltySummary.totalPointsRedeemed.toFixed(0)} баллов</p>
                  </div>
                </Card>
              </section>
            ) : null}

            {loyaltySection === 'guests' ? (
              <section className="grid gap-6 lg:grid-cols-2">
                <Card title="Гости">
                  {customersLoading ? (
                    <div className="h-32 animate-pulse rounded-2xl bg-slate-200/60" />
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <ul className="space-y-3 text-sm">
                        {customers.map((customer) => (
                          <li
                            key={customer._id}
                            onClick={() => handleSelectCustomer(customer)}
                            className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition hover:border-emerald-300 ${
                              selectedCustomer?._id === customer._id ? 'ring-2 ring-emerald-400' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{customer.name}</p>
                                <p className="text-xs text-slate-400">{customer.phone || 'Телефон не указан'}</p>
                              </div>
                              <div className="text-right text-xs text-slate-500">
                                <p>{customer.totalSpent.toFixed(2)} ₽</p>
                                <p>{customer.points} баллов</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div>
                        {selectedCustomer ? (
                          <form onSubmit={handleUpdateCustomer} className="space-y-3 text-sm">
                            <p className="text-xs uppercase text-slate-400">Карточка гостя</p>
                            <input
                              type="text"
                              value={customerEditForm.name}
                              onChange={(event) =>
                                setCustomerEditForm((prev) => ({ ...prev, name: event.target.value }))
                              }
                              className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                              placeholder="Имя"
                            />
                            <input
                              type="tel"
                              value={customerEditForm.phone}
                              onChange={(event) =>
                                setCustomerEditForm((prev) => ({ ...prev, phone: event.target.value }))
                              }
                              className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                              placeholder="Телефон"
                            />
                            <input
                              type="email"
                              value={customerEditForm.email}
                              onChange={(event) =>
                                setCustomerEditForm((prev) => ({ ...prev, email: event.target.value }))
                              }
                              className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                              placeholder="Email"
                            />
                            <div className="grid gap-3 md:grid-cols-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={customerEditForm.points}
                                onChange={(event) =>
                                  setCustomerEditForm((prev) => ({ ...prev, points: event.target.value }))
                                }
                                className="rounded-2xl border border-slate-200 px-4 py-2"
                                placeholder="Баллы"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={customerEditForm.totalSpent}
                                onChange={(event) =>
                                  setCustomerEditForm((prev) => ({ ...prev, totalSpent: event.target.value }))
                                }
                                className="rounded-2xl border border-slate-200 px-4 py-2"
                                placeholder="Выручка"
                              />
                            </div>
                            <button
                              type="submit"
                              className="w-full rounded-2xl bg-emerald-500 py-2 text-sm font-semibold text-white"
                            >
                              Сохранить гостя
                            </button>
                          </form>
                        ) : (
                          <p className="text-xs text-slate-400">
                            Выберите гостя, чтобы управлять баллами и контактами.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === 'staff' ? (
        <div className="space-y-6">
          <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Card title="Новый кассир">
              <form onSubmit={handleCreateCashier} className="space-y-3 text-sm">
                <label className="block text-slate-600">
                  <span className="mb-1 block text-xs uppercase">Имя</span>
                  <input
                    type="text"
                    value={cashierForm.name}
                    onChange={(event) => handleCashierFieldChange('name', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    placeholder="ФИО или имя"
                    autoComplete="name"
                  />
                </label>
                <label className="block text-slate-600">
                  <span className="mb-1 block text-xs uppercase">Email</span>
                  <input
                    type="email"
                    value={cashierForm.email}
                    onChange={(event) => handleCashierFieldChange('email', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    placeholder="user@yago.cafe"
                    autoComplete="email"
                  />
                </label>
                <label className="block text-slate-600">
                  <span className="mb-1 block text-xs uppercase">Пароль</span>
                  <input
                    type="password"
                    value={cashierForm.password}
                    onChange={(event) => handleCashierFieldChange('password', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    placeholder="Минимум 6 символов"
                    autoComplete="new-password"
                  />
                </label>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-emerald-500 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={creatingCashier}
                >
                  {creatingCashier ? 'Создание…' : 'Добавить кассира'}
                </button>
                <p className="text-xs text-slate-400">
                  Администратор или бариста сможет передать кассиру логин и пароль сразу после создания.
                </p>
              </form>
            </Card>
            <Card title="Кассиры">
              {cashiersLoading ? (
                <div className="grid gap-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-200/70" />
                  ))}
                </div>
              ) : cashiersError ? (
                <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-600">
                  <p className="text-sm">{cashiersError}</p>
                  <button
                    type="button"
                    onClick={handleReloadCashiers}
                    className="rounded-2xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    Повторить попытку
                  </button>
                </div>
              ) : cashiers.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Имя</th>
                        <th className="px-3 py-2 text-left">Email</th>
                        <th className="px-3 py-2 text-left">Создан</th>
                        <th className="px-3 py-2 text-left">Обновлён</th>
                        <th className="px-3 py-2 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cashiers.map((cashier) => (
                        <tr key={cashier.id}>
                          <td className="px-3 py-2 font-semibold text-slate-800">{cashier.name || '—'}</td>
                          <td className="px-3 py-2 text-slate-500">{cashier.email || '—'}</td>
                          <td className="px-3 py-2 text-slate-500">{formatDateTime(cashier.createdAt)}</td>
                          <td className="px-3 py-2 text-slate-500">{formatDateTime(cashier.updatedAt)}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteCashier(cashier.id)}
                              className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                            >
                              Удалить
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">
                    Пока кассиров нет. Добавьте первых сотрудников, чтобы выдать им доступ к системе.
                  </p>
                  <button
                    type="button"
                    onClick={handleReloadCashiers}
                    className="rounded-2xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Обновить список
                  </button>
                </div>
              )}
            </Card>
          </section>
        </div>
      ) : null}

      {activeTab === 'suppliers' ? (
        <div className="space-y-6">
          <section className="grid gap-6 lg:grid-cols-3">
            <Card title="Новый поставщик">
              <form onSubmit={handleCreateSupplier} className="space-y-3 text-sm">
                <input
                  type="text"
                  value={newSupplier.name}
                  onChange={(event) => setNewSupplier((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Название"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                />
                <input
                  type="text"
                  value={newSupplier.contactName}
                  onChange={(event) => setNewSupplier((prev) => ({ ...prev, contactName: event.target.value }))}
                  placeholder="Контактное лицо"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                />
                <input
                  type="tel"
                  value={newSupplier.phone}
                  onChange={(event) => setNewSupplier((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="Телефон"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                />
                <input
                  type="email"
                  value={newSupplier.email}
                  onChange={(event) => setNewSupplier((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="Email"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                />
                <input
                  type="text"
                  value={newSupplier.address}
                  onChange={(event) => setNewSupplier((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Адрес"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                />
                <textarea
                  value={newSupplier.notes}
                  onChange={(event) => setNewSupplier((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Заметки"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  rows={3}
                />
                <button type="submit" className="w-full rounded-2xl bg-slate-900 py-2 text-sm font-semibold text-white">
                  Добавить поставщика
                </button>
              </form>
            </Card>
            <div className="lg:col-span-2">
              <Card title="Список поставщиков">
                {suppliersLoading ? (
                  <div className="h-32 animate-pulse rounded-2xl bg-slate-200/60" />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <ul className="space-y-3">
                      {suppliers.map((supplier) => (
                        <li
                          key={supplier._id}
                          onClick={() => handleSelectSupplier(supplier)}
                          className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition hover:border-emerald-300 ${
                            selectedSupplier?._id === supplier._id ? 'ring-2 ring-emerald-400' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{supplier.name}</p>
                              <p className="text-xs text-slate-400">{supplier.contactName || 'Контакт не указан'}</p>
                            </div>
                            <div className="text-right text-xs text-slate-500">
                              {supplier.phone && <p>{supplier.phone}</p>}
                              {supplier.email && <p>{supplier.email}</p>}
                            </div>
                          </div>
                          {supplier.notes ? <p className="mt-2 text-xs text-slate-400">{supplier.notes}</p> : null}
                        </li>
                      ))}
                    </ul>
                    <div>
                      {selectedSupplier ? (
                        <form onSubmit={handleUpdateSupplier} className="space-y-3 text-sm">
                          <p className="text-xs uppercase text-slate-400">Редактирование поставщика</p>
                          <input
                            type="text"
                            value={supplierEditForm.name}
                            onChange={(event) =>
                              setSupplierEditForm((prev) => ({ ...prev, name: event.target.value }))
                            }
                            className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                          />
                          <input
                            type="text"
                            value={supplierEditForm.contactName}
                            onChange={(event) =>
                              setSupplierEditForm((prev) => ({ ...prev, contactName: event.target.value }))
                            }
                            className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                            placeholder="Контактное лицо"
                          />
                          <input
                            type="tel"
                            value={supplierEditForm.phone}
                            onChange={(event) =>
                              setSupplierEditForm((prev) => ({ ...prev, phone: event.target.value }))
                            }
                            className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                            placeholder="Телефон"
                          />
                          <input
                            type="email"
                            value={supplierEditForm.email}
                            onChange={(event) =>
                              setSupplierEditForm((prev) => ({ ...prev, email: event.target.value }))
                            }
                            className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                            placeholder="Email"
                          />
                          <input
                            type="text"
                            value={supplierEditForm.address}
                            onChange={(event) =>
                              setSupplierEditForm((prev) => ({ ...prev, address: event.target.value }))
                            }
                            className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                            placeholder="Адрес"
                          />
                          <textarea
                            value={supplierEditForm.notes}
                            onChange={(event) =>
                              setSupplierEditForm((prev) => ({ ...prev, notes: event.target.value }))
                            }
                            className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                            rows={3}
                            placeholder="Заметки"
                          />
                          <button
                            type="submit"
                            className="w-full rounded-2xl bg-emerald-500 py-2 text-sm font-semibold text-white"
                          >
                            Сохранить поставщика
                          </button>
                        </form>
                      ) : (
                        <p className="text-xs text-slate-400">Выберите поставщика для редактирования данных.</p>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'discounts' ? (
        <div className="space-y-6">
          <Card title="Новая скидка">
            <form onSubmit={handleCreateDiscount} className="grid gap-4 text-sm md:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-slate-600">
                  <span className="mb-1 block text-xs uppercase">Название</span>
                  <input
                    type="text"
                    value={discountForm.name}
                    onChange={(event) => setDiscountForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    placeholder="Название скидки"
                  />
                </label>
                <label className="block text-slate-600">
                  <span className="mb-1 block text-xs uppercase">Описание</span>
                  <textarea
                    value={discountForm.description}
                    onChange={(event) => setDiscountForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    rows={3}
                    placeholder="Краткое описание механики"
                  />
                </label>
                <label className="block text-slate-600">
                  <span className="mb-1 block text-xs uppercase">Область действия</span>
                  <select
                    value={discountForm.scope}
                    onChange={(event) => {
                      const scope = event.target.value as typeof discountForm.scope;
                      setDiscountForm((prev) => ({
                        ...prev,
                        scope,
                        categoryId: scope === 'category' ? prev.categoryId : '',
                        productId: scope === 'product' ? prev.productId : '',
                        autoApply: scope === 'category' ? prev.autoApply : false,
                        autoApplyDays: scope === 'category' ? prev.autoApplyDays : [],
                        autoApplyStart: scope === 'category' ? prev.autoApplyStart : '',
                        autoApplyEnd: scope === 'category' ? prev.autoApplyEnd : '',
                      }));
                    }}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  >
                    <option value="order">На весь чек</option>
                    <option value="category">На категорию</option>
                    <option value="product">На товар</option>
                  </select>
                </label>
                {discountForm.scope === 'category' ? (
                  <label className="block text-slate-600">
                    <span className="mb-1 block text-xs uppercase">Категория</span>
                    <select
                      value={discountForm.categoryId}
                      onChange={(event) => setDiscountForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    >
                      <option value="">Выберите категорию</option>
                      {categories.map((category) => (
                        <option key={category._id} value={category._id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {discountForm.scope === 'product' ? (
                  <label className="block text-slate-600">
                    <span className="mb-1 block text-xs uppercase">Товар</span>
                    <select
                      value={discountForm.productId}
                      onChange={(event) => setDiscountForm((prev) => ({ ...prev, productId: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    >
                      <option value="">Выберите товар</option>
                      {products.map((product) => (
                        <option key={product._id} value={product._id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <div className="space-y-3">
                <label className="block text-slate-600">
                  <span className="mb-1 block text-xs uppercase">Тип скидки</span>
                  <select
                    value={discountForm.type}
                    onChange={(event) =>
                      setDiscountForm((prev) => ({ ...prev, type: event.target.value as typeof prev.type }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  >
                    <option value="percentage">Процент</option>
                    <option value="fixed">Фиксированная сумма</option>
                  </select>
                </label>
                <label className="block text-slate-600">
                  <span className="mb-1 block text-xs uppercase">Значение</span>
                  <input
                    type="number"
                    step={discountForm.type === 'percentage' ? 1 : 0.01}
                    min={0}
                    max={discountForm.type === 'percentage' ? 100 : undefined}
                    value={discountForm.value}
                    onChange={(event) => setDiscountForm((prev) => ({ ...prev, value: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    placeholder={discountForm.type === 'percentage' ? 'Процент' : 'Сумма в ₽'}
                  />
                </label>
                {discountForm.scope === 'category' ? (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={discountForm.autoApply}
                        onChange={(event) =>
                          setDiscountForm((prev) => ({
                            ...prev,
                            autoApply: event.target.checked,
                            autoApplyDays: event.target.checked ? prev.autoApplyDays : [],
                            autoApplyStart: event.target.checked ? prev.autoApplyStart : '',
                            autoApplyEnd: event.target.checked ? prev.autoApplyEnd : '',
                          }))
                        }
                      />
                      Автоматическое применение по времени
                    </label>
                    {discountForm.autoApply ? (
                      <div className="mt-3 space-y-3">
                        <div>
                          <p className="mb-1 text-xs uppercase text-slate-400">Дни недели</p>
                          <div className="flex flex-wrap gap-2">
                            {DAY_OPTIONS.map((day) => {
                              const selected = discountForm.autoApplyDays.includes(day.value);
                              return (
                                <label
                                  key={day.value}
                                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                    selected
                                      ? 'border-emerald-500 bg-emerald-500 text-white'
                                      : 'border-slate-200 text-slate-500 hover:border-emerald-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={selected}
                                    onChange={() => toggleDiscountDay(day.value)}
                                  />
                                  {day.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="block text-slate-600">
                            <span className="mb-1 block text-xs uppercase">Начало</span>
                            <input
                              type="time"
                              value={discountForm.autoApplyStart}
                              onChange={(event) =>
                                setDiscountForm((prev) => ({ ...prev, autoApplyStart: event.target.value }))
                              }
                              className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                            />
                          </label>
                          <label className="block text-slate-600">
                            <span className="mb-1 block text-xs uppercase">Окончание</span>
                            <input
                              type="time"
                              value={discountForm.autoApplyEnd}
                              onChange={(event) =>
                                setDiscountForm((prev) => ({ ...prev, autoApplyEnd: event.target.value }))
                              }
                              className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={creatingDiscount}
                  className="rounded-2xl bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {creatingDiscount ? 'Создание…' : 'Создать скидку'}
                </button>
              </div>
            </form>
          </Card>
          <Card title="Список скидок">
            {discountsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-200/60" />
                ))}
              </div>
            ) : discounts.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                <p>{discountsError ?? 'Скидки ещё не созданы.'}</p>
                {discountsError ? (
                  <button
                    type="button"
                    onClick={handleReloadDiscounts}
                    className="rounded-full border border-slate-300 px-4 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Попробовать снова
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Название</th>
                      <th className="px-3 py-2 text-left">Тип</th>
                      <th className="px-3 py-2 text-left">Значение</th>
                      <th className="px-3 py-2 text-left">Область</th>
                      <th className="px-3 py-2 text-left">Цель</th>
                      <th className="px-3 py-2 text-left">Авто</th>
                      <th className="px-3 py-2 text-left">Статус</th>
                      <th className="px-3 py-2 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {discounts.map((discount) => {
                      const valueLabel =
                        discount.type === 'percentage'
                          ? `${discount.value}%`
                          : `${discount.value.toFixed(2)} ₽`;
                      const scopeLabel =
                        discount.scope === 'order'
                          ? 'Чек'
                          : discount.scope === 'category'
                          ? 'Категория'
                          : 'Товар';
                      const dayLabels =
                        discount.autoApplyDays && discount.autoApplyDays.length
                          ? discount.autoApplyDays
                              .map((day) => DAY_OPTIONS.find((option) => option.value === day)?.label ?? '')
                              .filter(Boolean)
                              .join(', ')
                          : '';
                      const schedule = discount.autoApply
                        ? `${discount.autoApplyStart ?? '—'} — ${discount.autoApplyEnd ?? '—'}${dayLabels ? ` (${dayLabels})` : ''}`
                        : '—';
                      return (
                        <tr key={discount._id}>
                          <td className="px-3 py-2">
                            <p className="font-semibold text-slate-800">{discount.name}</p>
                            {discount.description ? (
                              <p className="text-xs text-slate-400">{discount.description}</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{discount.type === 'percentage' ? 'Процент' : 'Сумма'}</td>
                          <td className="px-3 py-2 text-slate-500">{valueLabel}</td>
                          <td className="px-3 py-2 text-slate-500">{scopeLabel}</td>
                          <td className="px-3 py-2 text-slate-500">{discount.targetName ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-500">{discount.autoApply ? schedule : '—'}</td>
                          <td className="px-3 py-2 text-slate-500">
                            {discount.isActive ? (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-600">
                                Активна
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                Выключена
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleDiscountActive(discount)}
                                disabled={discountActionId === discount._id}
                                className="rounded-2xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-60"
                              >
                                {discount.isActive ? 'Отключить' : 'Включить'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDiscount(discount)}
                                disabled={discountActionId === discount._id}
                                className="rounded-2xl border border-red-200 px-3 py-1 text-xs font-semibold text-red-500 hover:border-red-300 disabled:opacity-60"
                              >
                                Удалить
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {activeTab === 'branding' ? (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <Card title="Кастомизация ресторана">
            <form onSubmit={handleSubmitBranding} className="space-y-6 text-sm text-slate-600">
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase text-slate-400">Название ресторана</span>
                <input
                  type="text"
                  value={brandingForm.name}
                  onChange={(event) => setBrandingForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="Например, Кофейня на Арбате"
                  required
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase text-slate-400">Ссылка на логотип</span>
                <input
                  type="url"
                  value={brandingForm.logoUrl}
                  onChange={(event) => setBrandingForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
                  className="rounded-2xl border border-slate-200 px-4 py-3"
                  placeholder="https://example.com/logo.png"
                />
                <span className="text-xs text-slate-400">
                  Поддерживаются только публичные ссылки. Изображение автоматически подставится в шапку кассы.
                </span>
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={brandingSaving}
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={handleResetBranding}
                  className="rounded-2xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
                >
                  Сбросить настройки
                </button>
              </div>
            </form>
          </Card>
          <Card title="Предпросмотр шапки POS">
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                {brandingForm.logoUrl ? (
                  <img
                    src={brandingForm.logoUrl}
                    alt={brandingForm.name}
                    className="h-14 w-14 rounded-2xl border border-slate-100 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-xs font-semibold text-slate-400">
                    Лого
                  </div>
                )}
                <div>
                  <p className="text-lg font-semibold text-slate-900">{brandingForm.name || 'Название ресторана'}</p>
                  <p className="text-xs text-slate-500">Управление продажами</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Так будет выглядеть заголовок на странице /pos. Изменения применяются сразу после сохранения.
              </p>
            </div>
          </Card>
          <Card title="Метки заказов">
            <div className="space-y-4 text-sm text-slate-600">
              <p>
                Включите подписи «С собой» и «Доставка», чтобы кассир мог помечать тип исполнения заказа в колонке
                оформления. Данные попадут в аналитику смен и отчётов.
              </p>
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                <span>Показывать переключатели в кассе</span>
                <input
                  type="checkbox"
                  checked={enableOrderTags}
                  onChange={handleToggleOrderTags}
                  className="h-5 w-5 rounded border-slate-300 text-secondary focus:ring-secondary"
                />
              </label>
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
                {enableOrderTags ? (
                  <p>В POS уже доступны кнопки «В заведении», «С собой» и «Доставка» в блоке текущего заказа.</p>
                ) : (
                  <p>После включения здесь появится блок выбора типа заказа в правой колонке POS.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
 };

 const Card: React.FC<React.PropsWithChildren<{ title: string }>> = ({ title, children }) => (
  <section className="rounded-3xl bg-white p-6 shadow-soft">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    </div>
    {children}
  </section>
 );

 const SummaryCard: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="rounded-3xl bg-white p-6 shadow-soft">
    <p className="text-sm text-slate-500">{title}</p>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
  </div>
 );

 export default AdminPage;
