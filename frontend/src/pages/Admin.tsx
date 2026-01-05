import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import * as XLSX from 'xlsx';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Area,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import api from '../lib/api';
import { useToast } from '../providers/ToastProvider';
import { useTheme } from '../providers/ThemeProvider';
import type { Category, ModifierGroup, Product } from '../store/catalog';
import { useRestaurantStore } from '../store/restaurant';
import { useBillingInfo } from '../hooks/useBillingInfo';

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
  categoryIds?: string[];
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
  status: 'paid' | 'completed' | 'cancelled';
  paymentMethod?: 'cash' | 'card';
  items: Array<{ name: string; qty: number; total: number }>;
  customerName?: string;
  cashierName?: string;
};

const formatHistoryTime = (value: string): string =>
  new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const normalizeCustomerHeader = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

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
  const status =
    payload?.status === 'paid' || payload?.status === 'completed' || payload?.status === 'cancelled'
      ? payload.status
      : 'paid';
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
    status,
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

const FISCAL_TAX_SYSTEM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'osn', label: 'ОСНО (без НДС)' },
  { value: 'usn_income', label: 'УСН «Доходы»' },
  { value: 'usn_income_outcome', label: 'УСН «Доходы-Расходы»' },
  { value: 'envd', label: 'ЕНВД' },
  { value: 'esn', label: 'ЕСХН' },
  { value: 'patent', label: 'Патент' },
];

const formatInputDate = (date: Date): string => date.toISOString().slice(0, 10);
const parseDateInput = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const startOfDay = (value: Date): Date => {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
};

const endOfDay = (value: Date): Date => {
  const result = new Date(value);
  result.setHours(23, 59, 59, 999);
  return result;
};

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { notify } = useToast();
  const { theme, toggleTheme } = useTheme();
  const {
    billing,
    billingEnabled,
    billingLocked,
    refreshBilling,
    loading: billingLoading,
    error: billingError,
  } = useBillingInfo();
  const navItems = useMemo(
    () => [
      { id: 'dashboard' as const, label: 'Дашборд' },
      { id: 'menu' as const, label: 'Меню' },
      { id: 'inventory' as const, label: 'Склады' },
      { id: 'loyalty' as const, label: 'Лояльность' },
      { id: 'staff' as const, label: 'Персонал' },
      { id: 'suppliers' as const, label: 'Поставщики' },
      { id: 'discounts' as const, label: 'Скидки' },
      { id: 'branding' as const, label: 'Ресторан' },
    ],
    []
  );
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'menu' | 'inventory' | 'loyalty' | 'suppliers' | 'discounts' | 'staff' | 'branding'
  >(navItems[0].id);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const currentTabLabel = useMemo(
    () => navItems.find((item) => item.id === activeTab)?.label ?? 'Раздел',
    [activeTab, navItems]
  );
  const tabDescriptions = useMemo(
    () => ({
      dashboard: 'Сводные метрики, выручка и активность клиентов.',
      menu: 'Управление блюдами, категориями и модификаторами.',
      inventory: 'Склады, документы и текущие остатки.',
      loyalty: 'Настройки бонусов и база гостей.',
      staff: 'Сотрудники и доступ к системе.',
      suppliers: 'Контакты поставщиков и история закупок.',
      discounts: 'Скидки, автоакции и правила.',
      branding: 'Брендинг и параметры ресторана.',
    }),
    []
  );
  const currentTabDescription = useMemo(() => tabDescriptions[activeTab], [activeTab, tabDescriptions]);
  const [inventoryTab, setInventoryTab] = useState<'warehouses' | 'documents' | 'audit' | 'stock'>(
    'warehouses'
  );
  const [menuSection, setMenuSection] = useState<'products' | 'categories' | 'ingredients' | 'modifiers'>(
    'products'
  );
  const [loyaltySection, setLoyaltySection] = useState<'settings' | 'guests'>('settings');
  useEffect(() => {
    setIsNavOpen(false);
  }, [activeTab]);
  const todayInputValue = useMemo(() => formatInputDate(new Date()), []);
  const inventoryTabs = useMemo(
    () => [
      { id: 'warehouses' as const, label: 'Склады', description: 'Локации и сводка' },
      { id: 'documents' as const, label: 'Документы', description: 'Поставка/списание и фильтры' },
      { id: 'audit' as const, label: 'Инвентаризация', description: 'Проверка и результаты' },
      { id: 'stock' as const, label: 'Остатки', description: 'Текущие позиции' },
    ],
    []
  );
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
  const [dashboardFilters, setDashboardFilters] = useState({ from: '', to: '' });
  const [dashboardPeriod, setDashboardPeriod] = useState<{ from?: string; to?: string } | null>(null);
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
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [menuCategoryFilterId, setMenuCategoryFilterId] = useState('');
  const [menuCategorySearch, setMenuCategorySearch] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [menuStatusFilter, setMenuStatusFilter] = useState<'all' | 'active' | 'hidden'>('all');
  const [menuCostFilter, setMenuCostFilter] = useState<'all' | 'noCost'>('all');
  const [menuSort, setMenuSort] = useState<'name' | 'price' | 'markup' | 'profit'>('name');
  const [menuPriceDrafts, setMenuPriceDrafts] = useState<Record<string, string>>({});
  const [productEditDirty, setProductEditDirty] = useState(false);
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
        totalCost: '',
        priceSource: 'unitCost' as 'unitCost' | 'totalCost',
      },
    ],
  });
  const receiptItems = receiptForm?.items ?? [];
  const [receiptType, setReceiptType] = useState<'receipt' | 'writeOff'>('receipt');
  const [receiptDate, setReceiptDate] = useState(() => todayInputValue);
  const [stockReceipts, setStockReceipts] = useState<StockReceipt[]>([]);
  const [stockReceiptsLoading, setStockReceiptsLoading] = useState(false);
  const [stockReceiptsError, setStockReceiptsError] = useState<string | null>(null);
  const [selectedStockReceipt, setSelectedStockReceipt] = useState<StockReceipt | null>(null);
  const [receiptFilter, setReceiptFilter] = useState<'all' | StockReceipt['type']>('all');
  const [receiptDateFrom, setReceiptDateFrom] = useState('');
  const [receiptDateTo, setReceiptDateTo] = useState('');
  const [receiptDatePreset, setReceiptDatePreset] = useState('');
  const [receiptSupplierFilter, setReceiptSupplierFilter] = useState('');
  const [receiptAmountMin, setReceiptAmountMin] = useState('');
  const [receiptAmountMax, setReceiptAmountMax] = useState('');
  const [isReceiptDrawerOpen, setIsReceiptDrawerOpen] = useState(false);
  const [isReceiptFiltersOpen, setIsReceiptFiltersOpen] = useState(false);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [mobileReceiptPreview, setMobileReceiptPreview] = useState<StockReceipt | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [inventoryAuditForm, setInventoryAuditForm] = useState({
    warehouseId: '',
    performedAt: todayInputValue,
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
  const [editingDiscount, setEditingDiscount] = useState<AdminDiscount | null>(null);
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
    categoryIds: [] as string[],
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


  const loadDashboard = useCallback(async (filters?: { from?: string; to?: string }) => {
    try {
      setLoadingDashboard(true);
      const params = {
        ...(filters?.from ? { from: filters.from } : {}),
        ...(filters?.to ? { to: filters.to } : {}),
      };
      const [summaryRes, dailyRes, productsRes, customersRes] = await Promise.all([
        api.get('/api/reports/summary'),
        api.get('/api/reports/daily', { params }),
        api.get('/api/reports/top-products', { params }),
        api.get('/api/reports/top-customers'),
      ]);
      setSummary(summaryRes.data.data);
      setDaily(normalizeDailyReport(dailyRes.data.data));
      setTopProducts(normalizeTopProducts(productsRes.data.data));
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

  const handleCancelReceipt = useCallback(
    async (orderId: string) => {
      const confirmed = window.confirm('Отменить чек? Баллы и остатки будут возвращены.');
      if (!confirmed) {
        return;
      }

      try {
        await api.post(`/api/orders/${orderId}/cancel`);
        await loadReceiptHistory(receiptHistoryDate);
        notify({ title: 'Чек отменён', type: 'success' });
      } catch (error) {
        console.error('Не удалось отменить чек', error);
        notify({ title: 'Не удалось отменить чек', type: 'error' });
      }
    },
    [loadReceiptHistory, notify, receiptHistoryDate]
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

  const normalizeReceiptPayload = (payload: unknown): StockReceipt[] => {
    const queue: unknown[] = [];
    const seen = new WeakSet<object>();

    const isStockReceiptArray = (value: unknown): value is StockReceipt[] =>
      Array.isArray(value) &&
      value.every(
        (entry) =>
          entry &&
          typeof entry === 'object' &&
          'type' in entry &&
          ['receipt', 'writeOff', 'inventory'].includes((entry as { type?: string }).type ?? '')
      );

    const enqueueNested = (value: unknown) => {
      if (!value) return;
      if (Array.isArray(value)) {
        queue.push(value);
        return;
      }

      if (typeof value === 'object') {
        if (seen.has(value as object)) return;
        seen.add(value as object);

        const obj = value as Record<string, unknown>;
        queue.push(obj.receipts, obj.data, obj.items, obj.docs);

        for (const nested of Object.values(obj)) {
          enqueueNested(nested);
        }
      }
    };

    enqueueNested(payload);

    for (const candidate of queue) {
      if (isStockReceiptArray(candidate)) {
        return candidate;
      }
    }

    return [];
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
          const sanitizedReceipts = normalizedReceipts.map((receipt) => ({
            ...receipt,
            items: Array.isArray(receipt.items) ? receipt.items : [],
          }));

          setStockReceipts(sanitizedReceipts);
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
  const markupThresholds = useMemo(() => ({ warning: 300, danger: 100 }), []);

  const getProductPrice = useCallback((product: Product) => {
    if (product.basePrice !== undefined && product.basePrice !== null) {
      return product.basePrice;
    }

    return product.price ?? 0;
  }, []);

  const getEconomics = useCallback((price: number, cost?: number | null) => {
    if (!Number.isFinite(price)) {
      return { grossProfit: null, markupPercent: null, marginPercent: null };
    }

    if (cost === null || cost === undefined || cost === 0 || !Number.isFinite(cost)) {
      return { grossProfit: null, markupPercent: null, marginPercent: null };
    }

    const grossProfit = price - cost;
    const markupPercent = cost > 0 ? (grossProfit / cost) * 100 : null;
    const marginPercent = price > 0 ? (grossProfit / price) * 100 : null;

    return { grossProfit, markupPercent, marginPercent };
  }, []);

  const getMarkupColor = useCallback(
    (markupPercent: number | null) => {
      if (markupPercent === null || !Number.isFinite(markupPercent)) {
        return 'text-slate-400';
      }

      if (markupPercent < markupThresholds.danger) {
        return 'text-red-600';
      }

      if (markupPercent < markupThresholds.warning) {
        return 'text-amber-600';
      }

      return 'text-emerald-600';
    },
    [markupThresholds]
  );

  const getMarkupBadgeClass = useCallback(
    (markupPercent: number | null) => {
      if (markupPercent === null || !Number.isFinite(markupPercent)) {
        return 'border-slate-200 bg-slate-100 text-slate-400';
      }

      if (markupPercent < markupThresholds.danger) {
        return 'border-red-200 bg-red-50 text-red-600';
      }

      if (markupPercent < markupThresholds.warning) {
        return 'border-amber-200 bg-amber-50 text-amber-700';
      }

      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    },
    [markupThresholds]
  );

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

  const formatPositionsCount = useCallback((count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) {
      return `${count} позиция`;
    }
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      return `${count} позиции`;
    }
    return `${count} позиций`;
  }, []);

  const formatReceiptValue = useCallback((value: number) => {
    if (!Number.isFinite(value)) {
      return '0';
    }
    return value.toFixed(4).replace(/\.?0+$/, '');
  }, []);

  const calculateReceiptTotal = useCallback((receipt: StockReceipt) => {
    const sign = receipt.type === 'writeOff' ? -1 : 1;
    const items = Array.isArray(receipt.items) ? receipt.items : [];
    return items.reduce((sum, item) => sum + sign * item.quantity * item.unitCost, 0);
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

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const sortA = typeof a.sortOrder === 'number' ? a.sortOrder : 9999;
      const sortB = typeof b.sortOrder === 'number' ? b.sortOrder : 9999;
      if (sortA !== sortB) {
        return sortA - sortB;
      }
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const query = menuCategorySearch.trim().toLowerCase();
    if (!query) {
      return sortedCategories;
    }

    return sortedCategories.filter((category) => category.name.toLowerCase().includes(query));
  }, [menuCategorySearch, sortedCategories]);

  const categoryCountMap = useMemo(() => {
    return products.reduce<Record<string, number>>((acc, product) => {
      if (!product.categoryId) {
        return acc;
      }
      acc[product.categoryId] = (acc[product.categoryId] || 0) + 1;
      return acc;
    }, {});
  }, [products]);

  const filteredProducts = useMemo(() => {
    const searchQuery = menuSearch.trim().toLowerCase();

    return products
      .filter((product) => {
        if (menuCategoryFilterId && product.categoryId !== menuCategoryFilterId) {
          return false;
        }

        if (menuStatusFilter === 'active' && product.isActive === false) {
          return false;
        }

        if (menuStatusFilter === 'hidden' && product.isActive !== false) {
          return false;
        }

        const hasNoCost = !product.costPrice || product.costPrice === 0;
        if (menuCostFilter === 'noCost' && !hasNoCost) {
          return false;
        }

        if (searchQuery && !product.name.toLowerCase().includes(searchQuery)) {
          return false;
        }

        return true;
      })
      .sort((first, second) => {
        const firstPrice = getProductPrice(first);
        const secondPrice = getProductPrice(second);
        const firstCost = first.costPrice ?? 0;
        const secondCost = second.costPrice ?? 0;
        const firstEconomics = getEconomics(firstPrice, firstCost);
        const secondEconomics = getEconomics(secondPrice, secondCost);

        if (menuSort === 'price') {
          return secondPrice - firstPrice;
        }

        if (menuSort === 'markup') {
          return normalizeNumber(secondEconomics.markupPercent) - normalizeNumber(firstEconomics.markupPercent);
        }

        if (menuSort === 'profit') {
          return normalizeNumber(secondEconomics.grossProfit) - normalizeNumber(firstEconomics.grossProfit);
        }

        const firstCategory = categories.find((category) => category._id === first.categoryId)?.name ?? '';
        const secondCategory = categories.find((category) => category._id === second.categoryId)?.name ?? '';
        const categorySort = firstCategory.localeCompare(secondCategory, 'ru');
        if (categorySort !== 0) {
          return categorySort;
        }
        return first.name.localeCompare(second.name, 'ru');
      });
  }, [
    categories,
    getEconomics,
    getProductPrice,
    menuCategoryFilterId,
    menuCostFilter,
    menuSearch,
    menuSort,
    menuStatusFilter,
    products,
  ]);

  const filteredStockReceipts = useMemo(() => {
    if (!selectedWarehouse) {
      return [];
    }

    const fromDate = receiptDateFrom ? startOfDay(parseDateInput(receiptDateFrom)) : null;
    const toDate = receiptDateTo ? endOfDay(parseDateInput(receiptDateTo)) : null;
    const minAmount = receiptAmountMin.trim() ? Number(receiptAmountMin) : null;
    const maxAmount = receiptAmountMax.trim() ? Number(receiptAmountMax) : null;

    return stockReceipts.filter((receipt) => {
      if (receipt.warehouseId !== selectedWarehouse._id) {
        return false;
      }

      if (receiptFilter !== 'all' && receipt.type !== receiptFilter) {
        return false;
      }

      const occurredAt = new Date(receipt.occurredAt);

      if (fromDate && occurredAt < fromDate) {
        return false;
      }

      if (toDate && occurredAt > toDate) {
        return false;
      }

      if (receiptSupplierFilter && receipt.supplierId !== receiptSupplierFilter) {
        return false;
      }

      const total = calculateReceiptTotal(receipt);

      if (minAmount !== null && Number.isFinite(minAmount) && total < minAmount) {
        return false;
      }

      if (maxAmount !== null && Number.isFinite(maxAmount) && total > maxAmount) {
        return false;
      }

      return true;
    });
  }, [
    calculateReceiptTotal,
    receiptAmountMax,
    receiptAmountMin,
    receiptDateFrom,
    receiptDateTo,
    receiptFilter,
    receiptSupplierFilter,
    selectedWarehouse,
    stockReceipts,
  ]);

  const receiptTotals = useMemo(() => {
    const totalsMap = new Map<string, number>();
    let overall = 0;

    for (const receipt of filteredStockReceipts) {
      const total = calculateReceiptTotal(receipt);
      totalsMap.set(receipt._id, total);
      overall += total;
    }

    return { totalsMap, overall };
  }, [calculateReceiptTotal, filteredStockReceipts]);

  const getReceiptItemTotal = useCallback((item: { quantity: string; unitCost: string; totalCost: string; priceSource: string }) => {
    const quantityValue = Number(item.quantity || 0);
    const unitCostValue = Number(item.unitCost || 0);
    const totalCostValue = Number(item.totalCost || 0);

    if (item.priceSource === 'totalCost' && totalCostValue > 0) {
      return totalCostValue;
    }

    return quantityValue * unitCostValue;
  }, []);

  const receiptTotal = useMemo(
    () => receiptItems.reduce((acc, item) => acc + getReceiptItemTotal(item), 0),
    [getReceiptItemTotal, receiptItems]
  );

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

  const receiptLastTouchedLabel = useMemo(() => {
    const timestamp =
      selectedStockReceipt?.updatedAt ??
      selectedStockReceipt?.createdAt ??
      selectedStockReceipt?.occurredAt;

    return timestamp ? formatDateTime(timestamp) : '—';
  }, [selectedStockReceipt]);

  const receiptDatePresetLabels = useMemo(
    () => ({
      today: 'Сегодня',
      yesterday: 'Вчера',
      week: '7 дней',
      month: 'Этот месяц',
      lastMonth: 'Прошлый месяц',
      year: 'Этот год',
      lastYear: 'Прошлый год',
    }),
    []
  );

  const receiptFilterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onClear: () => void }> = [];

    if (receiptDatePreset) {
      chips.push({
        id: 'date-preset',
        label: receiptDatePresetLabels[receiptDatePreset as keyof typeof receiptDatePresetLabels] ?? 'Период',
        onClear: () => {
          setReceiptDatePreset('');
          setReceiptDateFrom('');
          setReceiptDateTo('');
        },
      });
    }

    if (!receiptDatePreset && (receiptDateFrom || receiptDateTo)) {
      const labelParts = [];
      if (receiptDateFrom) {
        labelParts.push(`с ${receiptDateFrom}`);
      }
      if (receiptDateTo) {
        labelParts.push(`по ${receiptDateTo}`);
      }
      chips.push({
        id: 'date-range',
        label: labelParts.length ? labelParts.join(' ') : 'Период',
        onClear: () => {
          setReceiptDateFrom('');
          setReceiptDateTo('');
          setReceiptDatePreset('');
        },
      });
    }

    if (receiptFilter !== 'all') {
      chips.push({
        id: 'type',
        label: receiptTypeLabels[receiptFilter],
        onClear: () => setReceiptFilter('all'),
      });
    }

    if (receiptSupplierFilter) {
      chips.push({
        id: 'supplier',
        label: `Поставщик: ${supplierMap.get(receiptSupplierFilter)?.name ?? receiptSupplierFilter}`,
        onClear: () => setReceiptSupplierFilter(''),
      });
    }

    if (receiptAmountMin) {
      chips.push({
        id: 'amount-min',
        label: `Сумма от ${receiptAmountMin} ₽`,
        onClear: () => setReceiptAmountMin(''),
      });
    }

    if (receiptAmountMax) {
      chips.push({
        id: 'amount-max',
        label: `Сумма до ${receiptAmountMax} ₽`,
        onClear: () => setReceiptAmountMax(''),
      });
    }

    return chips;
  }, [
    receiptAmountMax,
    receiptAmountMin,
    receiptDateFrom,
    receiptDatePreset,
    receiptDatePresetLabels,
    receiptDateTo,
    receiptFilter,
    receiptSupplierFilter,
    receiptTypeLabels,
    supplierMap,
  ]);

  const inventoryQuantityLookup = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of inventoryItems) {
      map.set(`${item.warehouseId}-${item.itemType}-${item.itemId}`, item.quantity);
    }

    return map;
  }, [inventoryItems]);

  const applyReceiptDatePreset = useCallback(
    (preset: string) => {
      let from: Date | null = null;
      let to: Date | null = null;
      const now = new Date();

      switch (preset) {
        case 'today':
          from = startOfDay(now);
          to = now;
          break;
        case 'yesterday': {
          const base = startOfDay(now);
          base.setDate(base.getDate() - 1);
          from = base;
          to = base;
          break;
        }
        case 'week':
          from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
          to = now;
          break;
        case 'month':
          from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
          to = now;
          break;
        case 'lastMonth':
          from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
          to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
          break;
        case 'year':
          from = startOfDay(new Date(now.getFullYear(), 0, 1));
          to = now;
          break;
        case 'lastYear':
          from = startOfDay(new Date(now.getFullYear() - 1, 0, 1));
          to = endOfDay(new Date(now.getFullYear() - 1, 11, 31));
          break;
        default:
          break;
      }

      setReceiptDatePreset(preset);
      setReceiptDateFrom(from ? formatInputDate(from) : '');
      setReceiptDateTo(to ? formatInputDate(to) : '');
    },
    [setReceiptDateFrom, setReceiptDateTo]
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

  const handleExportCustomersExcel = () => {
    if (!customers.length) {
      notify({ title: 'Нет гостей для выгрузки', type: 'info' });
      return;
    }

    const header = ['Имя', 'Телефон', 'Email', 'Баллы', 'Выручка'];
    const data = customers.map((customer) => ({
      Имя: customer.name,
      Телефон: customer.phone ?? '',
      Email: customer.email ?? '',
      Баллы: customer.points,
      Выручка: Number(customer.totalSpent.toFixed(2)),
    }));
    const worksheet = XLSX.utils.json_to_sheet(data, { header });
    XLSX.utils.sheet_add_aoa(worksheet, [header], { origin: 'A1' });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Гости');
    XLSX.writeFile(workbook, 'guests.xlsx', { bookType: 'xlsx' });
  };

  const handleImportCustomers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.target.value = '';

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        notify({ title: 'Файл пустой', type: 'info' });
        return;
      }
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
      if (!rows.length) {
        notify({ title: 'Файл пустой', type: 'info' });
        return;
      }

      const normalizedRows = rows.map((row) => {
        const normalized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          normalized[normalizeCustomerHeader(key)] = value;
        }
        return normalized;
      });

      const mappedCustomers = normalizedRows.map((row) => ({
        name: String(row['имя'] ?? '').trim(),
        phone: String(row['телефон'] ?? '').trim(),
        email: String(row['email'] ?? '').trim() || undefined,
        points: row['баллы'] !== '' ? Number(row['баллы']) : undefined,
        totalSpent: row['выручка'] !== '' ? Number(row['выручка']) : undefined,
      }));

      const validCustomers = mappedCustomers.filter((customer) => customer.name && customer.phone);
      if (!validCustomers.length) {
        notify({ title: 'Не удалось найти данные гостей', type: 'info' });
        return;
      }

      const response = await api.post('/api/customers/import', { customers: validCustomers });
      const payload = getResponseData<{ created: number; updated: number; skipped: number }>(response);
      notify({
        title: 'Импорт завершён',
        description: payload
          ? `Добавлено: ${payload.created}, обновлено: ${payload.updated}, пропущено: ${payload.skipped}`
          : undefined,
        type: 'success',
      });
      void loadCustomers();
    } catch (error) {
      console.error('Не удалось импортировать гостей', error);
      notify({ title: extractErrorMessage(error, 'Не удалось импортировать гостей'), type: 'error' });
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

  useEffect(() => {
    if (activeTab !== 'menu' || menuSection !== 'products') {
      return;
    }

    const categoryFromQuery = searchParams.get('cat') ?? '';
    const itemFromQuery = searchParams.get('item') ?? '';

    if (categoryFromQuery !== menuCategoryFilterId) {
      setMenuCategoryFilterId(categoryFromQuery);
    }

    if (itemFromQuery && itemFromQuery !== selectedProduct?._id) {
      const match = products.find((product) => product._id === itemFromQuery);
      if (match) {
        setIsCreatingProduct(false);
        setProductEditDirty(false);
        handleSelectProduct(match);
      }
    }
  }, [
    activeTab,
    menuCategoryFilterId,
    menuSection,
    products,
    searchParams,
    selectedProduct?._id,
  ]);

  const loyaltySummary = useMemo<LoyaltyPointSummary>(() => ({
    totalPointsIssued: summary.totalPointsIssued,
    totalPointsRedeemed: summary.totalPointsRedeemed,
  }), [summary.totalPointsIssued, summary.totalPointsRedeemed]);

  const formatBillingDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString('ru-RU') : '—';

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

  const formatCurrencyShort = (value?: number | null) =>
    normalizeNumber(value).toLocaleString('ru-RU', {
      maximumFractionDigits: 0,
    });

  const updateMenuQueryParams = useCallback(
    (updates: { cat?: string; item?: string }) => {
      const params = new URLSearchParams(searchParams);

      if ('cat' in updates) {
        if (updates.cat) {
          params.set('cat', updates.cat);
        } else {
          params.delete('cat');
        }
      }

      if ('item' in updates) {
        if (updates.item) {
          params.set('item', updates.item);
        } else {
          params.delete('item');
        }
      }

      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const normalizeDashboardFilterParams = (filters: { from: string; to: string }) => {
    const from = filters.from || undefined;
    const to = filters.to || undefined;

    if (from && to) {
      const fromDate = new Date(`${from}T00:00:00`);
      const toDate = new Date(`${to}T00:00:00`);
      if (fromDate > toDate) {
        notify({ title: 'Дата начала больше даты окончания', type: 'error' });
        return null;
      }
    }

    return { from, to };
  };

  const handleDashboardFilterSubmit = () => {
    const normalized = normalizeDashboardFilterParams(dashboardFilters);
    if (!normalized) return;

    setDashboardPeriod(normalized);
    void loadDashboard(normalized);
  };

  const handleDashboardFilterReset = () => {
    setDashboardFilters({ from: '', to: '' });
    setDashboardPeriod(null);
    void loadDashboard();
  };

  const formatDateTick = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('ru-RU', { month: '2-digit', day: '2-digit' });
  };

  const normalizeDailyReport = (
    data: unknown
  ): { date: string; revenue: number; orders: number }[] => {
    if (!Array.isArray(data)) return [];

    return data
      .map((entry) => {
        const dateRaw = typeof entry?.date === 'string' ? entry.date : '';
        const parsed = dateRaw ? new Date(dateRaw) : null;
        const safeDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : dateRaw;
        const typedEntry = entry as { revenue?: number; totalRevenue?: number; orders?: number; orderCount?: number };

        return {
          date: safeDate,
          revenue: normalizeNumber(typedEntry.revenue ?? typedEntry.totalRevenue),
          orders: normalizeNumber(typedEntry.orders ?? typedEntry.orderCount),
        };
      })
      .filter((entry) => entry.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const normalizeTopProducts = (data: unknown): { name: string; qty: number }[] => {
    if (!Array.isArray(data)) return [];

    return data
      .map((entry) => {
        const typedEntry = entry as { name?: string; qty?: number; totalQuantity?: number };

        return {
          name: typeof typedEntry.name === 'string' ? typedEntry.name : 'Позиция',
          qty: normalizeNumber(typedEntry.qty ?? typedEntry.totalQuantity),
        };
      })
      .filter((entry) => entry.name);
  };

  const revenueExtremes = useMemo(() => {
    if (!daily.length) return null;

    const max = daily.reduce((acc, entry) => (entry.revenue > acc.revenue ? entry : acc), daily[0]);
    const min = daily.reduce((acc, entry) => (entry.revenue < acc.revenue ? entry : acc), daily[0]);

    return { max, min };
  }, [daily]);

  const renderRevenueTooltip = useCallback(
    ({ active, payload, label }: TooltipProps<number, string>) => {
      if (!active || !payload?.length) {
        return null;
      }

      const point = payload[0].payload as { date: string; revenue: number; orders: number };
      const date = typeof label === 'string' ? new Date(label) : null;
      const dateLabel =
        date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              weekday: 'short',
            })
          : label;

      return (
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
          <p className="text-xs text-slate-500">{dateLabel}</p>
          <p className="text-base font-semibold text-slate-900">{formatCurrency(point.revenue)} ₽</p>
          {point.orders ? (
            <p className="text-xs text-slate-500">Заказов: {formatInteger(point.orders)}</p>
          ) : null}
        </div>
      );
    },
    [formatCurrency, formatInteger]
  );

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

  const defaultProductUnit = useMemo(() => {
    const normalizedUnits = measurementUnits.map((unit) => unit.trim()).filter((unit) => unit.length > 0);
    const fallbackUnit = normalizedUnits[0] ?? 'шт';
    return normalizedUnits.find((unit) => unit.toLowerCase() === 'шт') ?? fallbackUnit;
  }, [measurementUnits]);

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

  const ingredientCostTotal = useMemo(
    () =>
      baseIngredientsForCost.reduce((total, item) => {
        return total + item.normalizedQuantity * item.costPerUnit;
      }, 0),
    [baseIngredientsForCost]
  );

  const editorPriceValue = useMemo(() => {
    if (isCreatingProduct) {
      return Number(newProduct.basePrice || 0);
    }

    if (productEditForm.basePrice) {
      return Number(productEditForm.basePrice);
    }

    return Number(productEditForm.price || 0);
  }, [isCreatingProduct, newProduct.basePrice, productEditForm.basePrice, productEditForm.price]);

  const editorCostValue = useMemo(() => {
    if (baseIngredientsForCost.length > 0) {
      return ingredientCostTotal;
    }

    if (selectedProduct?.costPrice !== undefined && selectedProduct?.costPrice !== null) {
      return selectedProduct.costPrice;
    }

    return null;
  }, [baseIngredientsForCost.length, ingredientCostTotal, selectedProduct]);

  const editorEconomics = useMemo(
    () => getEconomics(editorPriceValue, editorCostValue),
    [editorCostValue, editorPriceValue, getEconomics]
  );

  const hasNewProductChanges = useMemo(() => {
    if (newProduct.name.trim()) return true;
    if (newProduct.description.trim()) return true;
    if (newProduct.categoryId) return true;
    if (newProduct.basePrice) return true;
    if (newProduct.discountType) return true;
    if (newProduct.discountValue) return true;
    if (newProduct.imageUrl.trim()) return true;
    if (newProductModifierIds.length) return true;
    return productIngredients.some((item) => item.ingredientId || item.quantity || item.unit);
  }, [newProduct, newProductModifierIds.length, productIngredients]);

  const isEditorOpen = isCreatingProduct || Boolean(selectedProduct);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const menuDrawerTitleId = 'menu-drawer-title';
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const actionMenuButtonRef = useRef<HTMLButtonElement | null>(null);

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

  const canDiscardProductChanges = useCallback(() => {
    if (productEditDirty || (isCreatingProduct && hasNewProductChanges)) {
      return window.confirm('Есть несохранённые изменения. Перейти без сохранения?');
    }
    return true;
  }, [hasNewProductChanges, isCreatingProduct, productEditDirty]);

  const resetNewProductDraft = useCallback(() => {
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
  }, []);

  const mapProductIngredientsToForm = useCallback(
    (product: Product) => {
      if (!Array.isArray(product.ingredients) || product.ingredients.length === 0) {
        return [{ ingredientId: '', quantity: '', unit: '' }];
      }
      return product.ingredients.map((entry) => {
        const ingredientUnit = ingredients.find((ingredient) => ingredient._id === entry.ingredientId)?.unit;
        return {
          ingredientId: entry.ingredientId,
          quantity: entry.quantity.toString(),
          unit: entry.unit || ingredientUnit || '',
        };
      });
    },
    [ingredients]
  );

  const handleMenuCategoryFilterSelect = useCallback(
    (categoryId: string) => {
      if (!canDiscardProductChanges()) {
        return;
      }

      setMenuCategoryFilterId(categoryId);
      if (selectedProduct && categoryId && selectedProduct.categoryId !== categoryId) {
        setSelectedProduct(null);
        updateMenuQueryParams({ item: '' });
      }
      updateMenuQueryParams({ cat: categoryId || undefined });
    },
    [canDiscardProductChanges, selectedProduct, updateMenuQueryParams]
  );

  const handleMenuProductSelect = useCallback(
    (product: Product) => {
      if (!canDiscardProductChanges()) {
        return;
      }
      setOpenActionMenuId(null);
      handleSelectProduct(product);
      updateMenuQueryParams({ item: product._id, cat: product.categoryId });
    },
    [canDiscardProductChanges, handleSelectProduct, updateMenuQueryParams]
  );

  const handleStartCreateProduct = useCallback(() => {
    if (!canDiscardProductChanges()) {
      return;
    }
    setOpenActionMenuId(null);
    setSelectedProduct(null);
    setProductEditDirty(false);
    setIsCreatingProduct(true);
    resetNewProductDraft();
    updateMenuQueryParams({ item: '' });
  }, [canDiscardProductChanges, resetNewProductDraft, updateMenuQueryParams]);

  const handleDuplicateProduct = useCallback(
    (product: Product) => {
      if (!canDiscardProductChanges()) {
        return;
      }
      setSelectedProduct(null);
      setProductEditDirty(false);
      setIsCreatingProduct(true);
      setNewProduct({
        name: `${product.name} (копия)`,
        description: product.description ?? '',
        categoryId: product.categoryId ?? '',
        basePrice: product.basePrice !== undefined ? product.basePrice.toString() : product.price?.toString() ?? '',
        discountType: product.discountType ?? '',
        discountValue:
          product.discountValue !== undefined && product.discountValue !== null
            ? product.discountValue.toString()
            : '',
        imageUrl: product.imageUrl ?? '',
      });
      setNewProductModifierIds(
        Array.isArray(product.modifierGroups)
          ? product.modifierGroups.map((group) => group._id).filter(Boolean)
          : []
      );
      setProductIngredients(mapProductIngredientsToForm(product));
      updateMenuQueryParams({ item: '' });
    },
    [canDiscardProductChanges, mapProductIngredientsToForm, updateMenuQueryParams]
  );

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

  function handleSelectProduct(product: Product) {
    setSelectedProduct(product);
    setIsCreatingProduct(false);
    setProductEditDirty(false);
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
  }

  const handleProductEditFieldChange = (field: keyof typeof productEditForm, value: string | boolean) => {
    setProductEditDirty(true);
    setProductEditForm((prev) => ({ ...prev, [field]: value }));
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
    setProductEditDirty(true);
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
    setProductEditDirty(true);
    setProductEditIngredients((prev) => [...prev, { ingredientId: '', quantity: '', unit: '' }]);
  };

  const removeEditIngredientRow = (index: number) => {
    setProductEditDirty(true);
    setProductEditIngredients((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleToggleNewProductModifier = (groupId: string) => {
    setNewProductModifierIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleToggleEditProductModifier = (groupId: string) => {
    setProductEditDirty(true);
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
      setProductEditDirty(false);
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
        updateMenuQueryParams({ item: '' });
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

      const response = await api.post('/api/catalog/products', payload);
      const createdProduct = getResponseData<Product>(response);
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
      setIsCreatingProduct(false);
      if (createdProduct) {
        handleSelectProduct(createdProduct);
        updateMenuQueryParams({ item: createdProduct._id, cat: createdProduct.categoryId });
      }
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

  const resetPriceDraft = useCallback(
    (product: Product) => {
      setMenuPriceDrafts((prev) => ({
        ...prev,
        [product._id]: getProductPrice(product).toString(),
      }));
    },
    [getProductPrice]
  );

  const commitPriceDraft = useCallback(
    (product: Product) => {
      const raw = menuPriceDrafts[product._id];
      if (raw === undefined) {
        return;
      }

      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        resetPriceDraft(product);
        return;
      }

      const current = getProductPrice(product);
      if (parsed !== current) {
        void handleProductPriceChange(product._id, { basePrice: parsed });
      }
    },
    [getProductPrice, handleProductPriceChange, menuPriceDrafts, resetPriceDraft]
  );

  const handleCancelProductEdit = useCallback(() => {
    if (isCreatingProduct) {
      resetNewProductDraft();
      setIsCreatingProduct(false);
      updateMenuQueryParams({ item: '' });
      return;
    }

    if (selectedProduct) {
      const refreshed = productMap.get(selectedProduct._id) ?? selectedProduct;
      handleSelectProduct(refreshed);
      setProductEditDirty(false);
    }
  }, [handleSelectProduct, isCreatingProduct, productMap, resetNewProductDraft, selectedProduct, updateMenuQueryParams]);

  const handleCloseEditor = useCallback(() => {
    if (!canDiscardProductChanges()) {
      return;
    }
    setSelectedProduct(null);
    setIsCreatingProduct(false);
    setProductEditDirty(false);
    updateMenuQueryParams({ item: '' });
  }, [canDiscardProductChanges, updateMenuQueryParams]);

  useEffect(() => {
    if (!openActionMenuId) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (actionMenuRef.current?.contains(target) || actionMenuButtonRef.current?.contains(target)) {
        return;
      }
      setOpenActionMenuId(null);
    };

    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [openActionMenuId]);

  useEffect(() => {
    if (!isEditorOpen) {
      return;
    }

    const body = document.body;
    const originalOverflow = body.style.overflow;
    const originalPaddingRight = body.style.paddingRight;
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (scrollBarWidth > 0) {
      body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      body.style.overflow = originalOverflow;
      body.style.paddingRight = originalPaddingRight;
    };
  }, [isEditorOpen]);

  useEffect(() => {
    if (!isEditorOpen) {
      return;
    }

    const drawerElement = drawerRef.current;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const getFocusableElements = (container: HTMLElement) =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

    const focusableElements = drawerElement ? getFocusableElements(drawerElement) : [];
    focusableElements[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseEditor();
        return;
      }

      if (event.key !== 'Tab' || !drawerElement) {
        return;
      }

      const elements = getFocusableElements(drawerElement);
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [handleCloseEditor, isEditorOpen]);

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

  const handleSelectWarehouse = useCallback((warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setWarehouseEditForm({
      name: warehouse.name,
      location: warehouse.location ?? '',
      description: warehouse.description ?? '',
    });

    setReceiptForm((prev) => ({ ...prev, warehouseId: warehouse._id }));
    setInventoryAuditForm((prev) => ({
      ...prev,
      warehouseId: warehouse._id,
    }));
  }, []);

  useEffect(() => {
    if (warehouses.length === 1 && !selectedWarehouse) {
      handleSelectWarehouse(warehouses[0]);
      return;
    }

    if (selectedWarehouse && !warehouses.some((warehouse) => warehouse._id === selectedWarehouse._id)) {
      setSelectedWarehouse(null);
      setReceiptForm((prev) => ({ ...prev, warehouseId: '' }));
      setInventoryAuditForm((prev) => ({ ...prev, warehouseId: '', items: [] }));
    }
  }, [handleSelectWarehouse, warehouses, selectedWarehouse]);

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
    field: 'itemType' | 'itemId' | 'quantity' | 'unitCost' | 'totalCost',
    value: string
  ) => {
    setReceiptForm((prev) => {
      const items = [...prev.items];
      const current = { ...items[index], [field]: value };
      const parseNumber = (input: string) => {
        const trimmed = input.trim();
        if (!trimmed) {
          return null;
        }
        const numberValue = Number(trimmed);
        return Number.isFinite(numberValue) ? numberValue : null;
      };
      const quantityValue = parseNumber(current.quantity);
      const unitCostValue = parseNumber(current.unitCost);
      const totalCostValue = parseNumber(current.totalCost);
      const quantityValid = quantityValue !== null && quantityValue > 0;
      const formatCurrency = (amount: number) => formatReceiptValue(amount);

      if (field === 'unitCost') {
        current.priceSource = 'unitCost';
        if (quantityValid && unitCostValue !== null) {
          current.totalCost = formatCurrency(quantityValue * unitCostValue);
        } else if (!value.trim()) {
          current.totalCost = '';
        }
      }

      if (field === 'totalCost') {
        current.priceSource = 'totalCost';
        if (quantityValid && totalCostValue !== null) {
          current.unitCost = formatCurrency(totalCostValue / quantityValue);
        } else if (!value.trim() || !quantityValid) {
          current.unitCost = '';
        }
      }

      if (field === 'quantity') {
        if (!quantityValid) {
          if (current.priceSource === 'totalCost') {
            current.unitCost = '';
          } else {
            current.totalCost = '';
          }
        } else if (current.priceSource === 'totalCost') {
          if (totalCostValue !== null) {
            current.unitCost = formatCurrency(totalCostValue / quantityValue);
          }
        } else if (unitCostValue !== null) {
          current.totalCost = formatCurrency(quantityValue * unitCostValue);
        }
      }

      items[index] = current;
      return { ...prev, items };
    });
  };

  const addReceiptItemRow = () => {
    setReceiptForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          itemType: 'ingredient' as 'ingredient' | 'product',
          itemId: '',
          quantity: '',
          unitCost: '',
          totalCost: '',
          priceSource: 'unitCost' as 'unitCost' | 'totalCost',
        },
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
    setReceiptDate(formatInputDate(new Date()));
    setReceiptForm({
      warehouseId: preserveWarehouse ? receiptForm.warehouseId : '',
      supplierId: '',
      items: [
        {
          itemType: 'ingredient',
          itemId: '',
          quantity: '',
          unitCost: '',
          totalCost: '',
          priceSource: 'unitCost',
        },
      ],
    });
  };

  const handleSelectStockReceipt = useCallback(
    (receipt: StockReceipt) => {
      if (receipt.type === 'inventory') {
        notify({ title: 'Инвентаризации нельзя редактировать', type: 'info' });
        return false;
      }

      const items = Array.isArray(receipt.items) ? receipt.items : [];

      setSelectedStockReceipt(receipt);
      setReceiptType(receipt.type === 'writeOff' ? 'writeOff' : 'receipt');
      setReceiptDate(receipt.occurredAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
      setReceiptForm({
        warehouseId: receipt.warehouseId,
        supplierId: receipt.supplierId ?? '',
        items:
          items.length > 0
            ? items.map((item) => ({
                itemType: item.itemType,
                itemId: item.itemId,
                quantity: item.quantity.toString(),
                unitCost: item.unitCost.toString(),
                totalCost: formatReceiptValue(item.quantity * item.unitCost),
                priceSource: 'unitCost',
              }))
            : [
                {
                  itemType: 'ingredient',
                  itemId: '',
                  quantity: '',
                  unitCost: '',
                  totalCost: '',
                  priceSource: 'unitCost',
                },
              ],
      });
      return true;
    },
    [formatReceiptValue, notify]
  );

  const handleOpenReceiptDrawer = useCallback(
    (receipt?: StockReceipt) => {
      if (receipt) {
        const opened = handleSelectStockReceipt(receipt);
        if (!opened) {
          return;
        }
      } else {
        resetReceiptForm(true);
      }
      setExpandedReceiptId(null);
      setMobileReceiptPreview(null);
      setIsReceiptDrawerOpen(true);
    },
    [handleSelectStockReceipt, resetReceiptForm]
  );

  const handleCloseReceiptDrawer = useCallback(() => {
    setIsReceiptDrawerOpen(false);
    setSelectedStockReceipt(null);
    resetReceiptForm(true);
  }, [resetReceiptForm]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const handleChange = () => setIsMobileView(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!isReceiptDrawerOpen && !mobileReceiptPreview) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (mobileReceiptPreview) {
        setMobileReceiptPreview(null);
      }
      if (isReceiptDrawerOpen) {
        handleCloseReceiptDrawer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCloseReceiptDrawer, isReceiptDrawerOpen, mobileReceiptPreview]);

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

    const occurredDate = parseDateInput(receiptDate);

    if (Number.isNaN(occurredDate.getTime())) {
      notify({ title: 'Некорректная дата документа', type: 'info' });
      return;
    }

    if (occurredDate.getTime() > endOfDay(new Date()).getTime()) {
      notify({ title: 'Дата документа не может быть в будущем', type: 'info' });
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

      handleCloseReceiptDrawer();
      await loadInventoryData();
      await loadStockReceipts();
      await loadMenuData();
    } catch (error) {
      const message = extractErrorMessage(error, 'Не удалось сохранить документ');
      notify({ title: message, type: 'error' });
    }
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
        handleCloseReceiptDrawer();
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

    if (!inventoryAuditForm.performedAt) {
      notify({ title: 'Укажите дату инвентаризации', type: 'info' });
      return;
    }

    const performedDate = parseDateInput(inventoryAuditForm.performedAt);

    if (Number.isNaN(performedDate.getTime())) {
      notify({ title: 'Некорректная дата инвентаризации', type: 'info' });
      return;
    }

    if (performedDate.getTime() > endOfDay(new Date()).getTime()) {
      notify({ title: 'Дата инвентаризации не может быть в будущем', type: 'info' });
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

      notify({
        title: 'Инвентаризация завершена. Документы до этой даты будут заблокированы.',
        type: 'success',
      });

      setInventoryAuditForm((prev) => ({
        ...prev,
        performedAt: formatInputDate(new Date()),
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

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!supplierId) return;
    if (!window.confirm('Удалить поставщика? Документы останутся без привязки.')) {
      return;
    }

    try {
      await api.delete(`/api/suppliers/${supplierId}`);
      notify({ title: 'Поставщик удалён', type: 'success' });
      setSuppliers((prev) => prev.filter((supplier) => supplier._id !== supplierId));

      if (selectedSupplier?._id === supplierId) {
        setSelectedSupplier(null);
        setSupplierEditForm({ name: '', contactName: '', phone: '', email: '', address: '', notes: '' });
      }
    } catch (error) {
      notify({ title: 'Не удалось удалить поставщика', type: 'error' });
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

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) {
      return;
    }

    const confirmed = window.confirm(`Удалить гостя "${selectedCustomer.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/api/customers/${selectedCustomer._id}`);
      setCustomers((prev) => prev.filter((item) => item._id !== selectedCustomer._id));
      setSelectedCustomer(null);
      notify({ title: 'Гость удалён', type: 'success' });
    } catch (error) {
      console.error('Не удалось удалить гостя', error);
      notify({ title: extractErrorMessage(error, 'Не удалось удалить гостя'), type: 'error' });
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

  const resetDiscountForm = () => {
    setDiscountForm({
      name: '',
      description: '',
      type: 'percentage',
      scope: 'order',
      value: '',
      categoryIds: [],
      productId: '',
      autoApply: false,
      autoApplyDays: [],
      autoApplyStart: '',
      autoApplyEnd: '',
    });
    setEditingDiscount(null);
  };

  const resolveDiscountCategoryIds = (discount: AdminDiscount): string[] => {
    if (Array.isArray(discount.categoryIds) && discount.categoryIds.length > 0) {
      return discount.categoryIds;
    }

    return discount.categoryId ? [discount.categoryId] : [];
  };

  const handleEditDiscount = (discount: AdminDiscount) => {
    const categoryIds = resolveDiscountCategoryIds(discount);
    setEditingDiscount(discount);
    setDiscountForm({
      name: discount.name,
      description: discount.description ?? '',
      type: discount.type,
      scope: discount.scope,
      value: discount.value.toString(),
      categoryIds,
      productId: discount.productId ?? '',
      autoApply: discount.autoApply,
      autoApplyDays: discount.autoApplyDays ?? [],
      autoApplyStart: discount.autoApplyStart ?? '',
      autoApplyEnd: discount.autoApplyEnd ?? '',
    });
  };

  const toggleDiscountCategory = (categoryId: string) => {
    setDiscountForm((prev) => {
      const exists = prev.categoryIds.includes(categoryId);
      const nextCategoryIds = exists
        ? prev.categoryIds.filter((id) => id !== categoryId)
        : [...prev.categoryIds, categoryId];
      return { ...prev, categoryIds: nextCategoryIds };
    });
  };

  const handleSubmitDiscount = async (event: React.FormEvent<HTMLFormElement>) => {
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

    if (discountForm.scope === 'category' && discountForm.categoryIds.length === 0) {
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

    if (discountForm.scope === 'category') {
      payload.categoryIds = discountForm.categoryIds;
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
      const response = editingDiscount
        ? await api.patch(`/api/admin/discounts/${editingDiscount._id}`, payload)
        : await api.post('/api/admin/discounts', payload);
      const saved = getResponseData<AdminDiscount>(response);
      if (saved) {
        setDiscounts((prev) =>
          editingDiscount ? prev.map((item) => (item._id === saved._id ? saved : item)) : [saved, ...prev]
        );
        notify({ title: editingDiscount ? 'Скидка обновлена' : 'Скидка создана', type: 'success' });
        resetDiscountForm();
      }
    } catch (error) {
      console.error('Не удалось сохранить скидку', error);
      notify({ title: 'Не удалось сохранить скидку', type: 'error' });
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

  const menuEditorTitle = isCreatingProduct
    ? 'Новая позиция'
    : selectedProduct
      ? 'Редактор позиции'
      : 'Редактор позиции';
  const editorCostMissing = !editorCostValue || editorCostValue === 0;
  const menuEditorFormId = isCreatingProduct ? 'menu-create-form' : 'menu-edit-form';

  return (
    <div className="admin-shell min-h-screen">
      <header className="admin-header border-b">
        <div className="mx-auto flex flex-col gap-3 px-4 py-3 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-soft">
                YG
              </div>
              <div className="leading-tight">
                <p className="text-xs uppercase tracking-wide text-slate-400">Админ-панель</p>
                <p className="text-sm font-semibold text-slate-900">{restaurantName || 'Yago POS'}</p>
              </div>
            </div>
            <div className="hidden flex-1 items-center justify-center md:flex">
              <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50/80 p-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold transition ${
                      activeTab === item.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/70 text-sm font-semibold text-slate-700 transition hover:border-slate-300 md:inline-flex"
                aria-pressed={theme === 'dark'}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/pos')}
                className="hidden items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:inline-flex"
              >
                Перейти в кассу
              </button>
              <button
                type="button"
                onClick={() => setIsNavOpen((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 md:hidden"
                aria-label="Открыть меню админки"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition hover:border-slate-300 md:hidden"
                aria-label="Сменить тему"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
          <div className="flex items-center md:hidden">
            <p className="text-sm font-semibold text-slate-700">{currentTabLabel}</p>
          </div>
          {isNavOpen ? (
            <div className="grid gap-2 pb-2 md:hidden">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    activeTab === item.id
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-slate-400">{item.id === activeTab ? 'Сейчас' : ''}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Панель управления</p>
            <h1 className="text-3xl font-bold text-slate-900">{currentTabLabel}</h1>
            <p className="text-sm text-slate-500">{currentTabDescription}</p>
          </div>
          <div className="hidden items-center gap-3 lg:flex">
            <div className="flex h-10 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              <span>{currentTabLabel}</span>
            </div>
          </div>
        </div>

        {billingEnabled ? (
        <div className="mb-6 space-y-2">
          <div
            className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-sm ${
              billingLocked
                ? 'border-[color:color-mix(in_srgb,var(--accent-danger)_40%,var(--border-soft))] bg-[color:color-mix(in_srgb,var(--accent-danger)_18%,var(--bg-card))]'
                : billing?.plan === 'trial'
                  ? 'border-[color:color-mix(in_srgb,var(--accent-warning)_40%,var(--border-soft))] bg-[color:color-mix(in_srgb,var(--accent-warning)_18%,var(--bg-card))]'
                  : 'border-[color:color-mix(in_srgb,var(--accent-secondary)_40%,var(--border-soft))] bg-[color:color-mix(in_srgb,var(--accent-secondary)_12%,var(--bg-card))]'
            }`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Статус подписки: {billing?.status ?? '—'}
                  {billing?.plan ? ` (${billing.plan === 'trial' ? 'триал' : 'оплачено'})` : ''}
                </p>
                <p className="text-xs text-slate-600">
                  {billing?.plan === 'trial'
                    ? `Демо до ${formatBillingDate(billing?.trialEndsAt)}`
                    : `Следующий платёж: ${formatBillingDate(billing?.nextPaymentDueAt)}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Открыть оплату
                </button>
                <button
                  type="button"
                  onClick={() => void refreshBilling()}
                  disabled={billingLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
                >
                  {billingLoading ? 'Обновляем…' : 'Обновить статус'}
                </button>
              </div>
            </div>
            {billingLocked ? (
              <p className="text-xs font-semibold text-slate-600">
                Подписка неактивна. Продлите её в настройках, чтобы снова редактировать данные.
              </p>
            ) : null}
          </div>
          {billingError ? (
            <div className="rounded-xl border border-[color:color-mix(in_srgb,var(--accent-danger)_40%,var(--border-soft))] bg-[color:color-mix(in_srgb,var(--accent-danger)_18%,var(--bg-card))] px-4 py-3 text-xs text-slate-600">
              {billingError}
            </div>
          ) : null}
        </div>
        ) : null}

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
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${
                              order.status === 'cancelled'
                                ? 'bg-rose-50 text-rose-600'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {order.status === 'paid'
                              ? 'Оплачен'
                              : order.status === 'completed'
                                ? 'Завершён'
                                : 'Отменён'}
                          </span>
                          {order.status !== 'cancelled' ? (
                            <button
                              type="button"
                              onClick={() => void handleCancelReceipt(order._id)}
                              className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50"
                            >
                              Отменить чек
                            </button>
                          ) : null}
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
            <Card title="Период для графиков">
              <p className="mb-3 text-xs text-slate-500">
                Применяется к графикам «Выручка по дням» и «Топ продукты».
              </p>
              <div className="flex flex-wrap items-end gap-3 text-sm">
                <label className="flex flex-col text-slate-600">
                  <span className="mb-1 text-xs uppercase text-slate-400">С</span>
                  <input
                    type="date"
                    value={dashboardFilters.from}
                    max={dashboardFilters.to || todayInputValue}
                    onChange={(event) =>
                      setDashboardFilters((prev) => ({ ...prev, from: event.target.value }))
                    }
                    className="rounded-2xl border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col text-slate-600">
                  <span className="mb-1 text-xs uppercase text-slate-400">По</span>
                  <input
                    type="date"
                    value={dashboardFilters.to}
                    max={todayInputValue}
                    min={dashboardFilters.from || undefined}
                    onChange={(event) =>
                      setDashboardFilters((prev) => ({ ...prev, to: event.target.value }))
                    }
                    className="rounded-2xl border border-slate-200 px-3 py-2"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDashboardFilterSubmit}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={loadingDashboard}
                >
                  Применить
                </button>
                <button
                  type="button"
                  onClick={handleDashboardFilterReset}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                  disabled={loadingDashboard}
                >
                  Сбросить
                </button>
                {dashboardPeriod ? (
                  <span className="text-xs text-slate-400">{formatPeriodLabel(dashboardPeriod)}</span>
                ) : null}
              </div>
            </Card>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <Card
                title="Выручка по дням"
                actions={
                  dashboardPeriod ? (
                    <span className="text-xs text-slate-400">{formatPeriodLabel(dashboardPeriod)}</span>
                  ) : null
                }
              >
                <div className="h-72 w-full">
                  {daily.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={daily} margin={{ left: 8, right: 8, bottom: 12, top: 12 }}>
                        <defs>
                          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          stroke="#64748b"
                          tickFormatter={formatDateTick}
                          tickMargin={10}
                          tickLine={false}
                          axisLine={{ stroke: '#e2e8f0' }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          stroke="#64748b"
                          tickFormatter={(value) => `${formatCurrencyShort(value)} ₽`}
                          width={80}
                          tickMargin={8}
                          tickLine={false}
                          axisLine={{ stroke: '#e2e8f0' }}
                          domain={[0, 'dataMax']}
                          allowDecimals={false}
                        />
                        <Tooltip cursor={{ stroke: '#10B981', strokeDasharray: '4 4' }} content={renderRevenueTooltip} />
                        {revenueExtremes ? (
                          <>
                            <ReferenceDot
                              x={revenueExtremes.max.date}
                              y={revenueExtremes.max.revenue}
                              r={6}
                              fill="#065f46"
                              stroke="#10B981"
                              strokeWidth={2}
                              label={{
                                position: 'top',
                                value: `Пик · ${formatCurrencyShort(revenueExtremes.max.revenue)} ₽`,
                                fill: '#065f46',
                                fontSize: 12,
                              }}
                            />
                            <ReferenceDot
                              x={revenueExtremes.min.date}
                              y={revenueExtremes.min.revenue}
                              r={6}
                              fill="#e0f2fe"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              label={{
                                position: 'bottom',
                                value: `Минимум · ${formatCurrencyShort(revenueExtremes.min.revenue)} ₽`,
                                fill: '#1d4ed8',
                                fontSize: 12,
                              }}
                            />
                          </>
                        ) : null}
                        <Area type="monotone" dataKey="revenue" stroke="none" fill="url(#revenueFill)" />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#10B981"
                          strokeWidth={3}
                          strokeLinecap="round"
                          dot={({ cx, cy, payload }) => {
                            const isExtreme =
                              revenueExtremes?.max.date === payload.date || revenueExtremes?.min.date === payload.date;
                            return (
                              <circle
                                cx={cx}
                                cy={cy}
                                r={isExtreme ? 6 : 4}
                                stroke={isExtreme ? '#065f46' : '#10B981'}
                                strokeWidth={isExtreme ? 3 : 2}
                                fill="#ffffff"
                              />
                            );
                          }}
                          activeDot={{ r: 8, fill: '#10B981', stroke: '#065f46', strokeWidth: 2 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
                      Нет данных
                    </div>
                  )}
                </div>
              </Card>
              <Card
                title="Топ продукты"
                actions={
                  dashboardPeriod ? (
                    <span className="text-xs text-slate-400">{formatPeriodLabel(dashboardPeriod)}</span>
                  ) : null
                }
              >
                <div className="h-72 w-full">
                  {topProducts.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={topProducts} margin={{ left: 20, right: 16, bottom: 12, top: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" stroke="#64748b" tickFormatter={(value) => `${formatCurrencyShort(value)} шт.`} />
                        <YAxis type="category" dataKey="name" stroke="#64748b" width={120} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 16,
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#ffffff',
                          }}
                          formatter={(value: number, _name, { payload }) => [
                            `${formatInteger(value)} шт.`,
                            payload?.name ?? 'Позиция',
                          ]}
                          cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                        />
                        <Bar dataKey="qty" fill="#3B82F6" radius={[0, 12, 12, 0]} barSize={22}>
                          <LabelList dataKey="qty" position="right" formatter={(value: number) => `${formatInteger(value)} шт.`} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
                      Нет данных
                    </div>
                  )}
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
        <div className="space-y-6">
          <div className="border-b border-slate-200">
            <div className="flex flex-wrap gap-6">
              {[
                { id: 'products', label: 'Позиции' },
                { id: 'categories', label: 'Категории' },
                { id: 'ingredients', label: 'Ингредиенты' },
                { id: 'modifiers', label: 'Модификаторы' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMenuSection(item.id as typeof menuSection)}
                  className={`border-b-2 pb-3 text-sm font-semibold transition ${
                    menuSection === item.id
                      ? 'border-violet-600 text-violet-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  } rounded-none`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-6">
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
              <div className="relative">
                <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <aside className="hidden md:block lg:sticky lg:top-24 lg:h-[calc(100vh-140px)]">
                    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
                      <div className="sticky top-0 z-10 space-y-3 border-b border-slate-100 bg-white/95 p-4 backdrop-blur">
                        <form onSubmit={handleCreateCategory} className="space-y-2">
                          <input
                            type="text"
                            value={newCategoryName}
                            onChange={(event) => setNewCategoryName(event.target.value)}
                            placeholder="Новая категория"
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                          />
                          <button
                            type="submit"
                            className="w-full rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
                          >
                            + Новая категория
                          </button>
                        </form>
                        {sortedCategories.length > 15 ? (
                          <input
                            type="search"
                            value={menuCategorySearch}
                            onChange={(event) => setMenuCategorySearch(event.target.value)}
                            placeholder="Поиск категории"
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 overflow-y-auto p-2">
                        <button
                          type="button"
                          onClick={() => handleMenuCategoryFilterSelect('')}
                          className={`relative flex w-full items-center justify-between rounded-xl py-2 pl-4 pr-3 text-sm transition ${
                            menuCategoryFilterId === ''
                              ? 'bg-violet-50 text-violet-700'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span
                            className={`absolute left-0 top-0 h-full w-[3px] rounded-r-full ${
                              menuCategoryFilterId === '' ? 'bg-violet-500' : 'bg-transparent'
                            }`}
                          />
                          <span className="font-semibold">Все категории</span>
                          <span className="text-xs text-slate-400">{products.length}</span>
                        </button>
                        {filteredCategories.map((category) => (
                          <button
                            key={category._id}
                            type="button"
                            onClick={() => handleMenuCategoryFilterSelect(category._id)}
                            className={`relative mt-1 flex w-full items-center justify-between rounded-xl py-2 pl-4 pr-3 text-sm transition ${
                              menuCategoryFilterId === category._id
                                ? 'bg-violet-50 text-violet-700'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span
                              className={`absolute left-0 top-0 h-full w-[3px] rounded-r-full ${
                                menuCategoryFilterId === category._id ? 'bg-violet-500' : 'bg-transparent'
                              }`}
                            />
                            <span className="font-semibold">{category.name}</span>
                            <span className="text-xs text-slate-400">{categoryCountMap[category._id] ?? 0}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </aside>
                  <div className="space-y-4">
                    <div className="sticky top-24 z-10 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-soft backdrop-blur">
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="min-w-[200px] flex-1">
                          <input
                            type="search"
                            value={menuSearch}
                            onChange={(event) => setMenuSearch(event.target.value)}
                            placeholder="Поиск позиции"
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2"
                          />
                        </div>
                        <div className="w-full md:hidden">
                          <select
                            value={menuCategoryFilterId}
                            onChange={(event) => handleMenuCategoryFilterSelect(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2"
                          >
                            <option value="">Все категории</option>
                            {sortedCategories.map((category) => (
                              <option key={category._id} value={category._id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <select
                          value={menuStatusFilter}
                          onChange={(event) => setMenuStatusFilter(event.target.value as typeof menuStatusFilter)}
                          className="rounded-2xl border border-slate-200 px-3 py-2"
                        >
                          <option value="all">Все статусы</option>
                          <option value="active">В продаже</option>
                          <option value="hidden">Скрытые</option>
                        </select>
                        <select
                          value={menuCostFilter}
                          onChange={(event) => setMenuCostFilter(event.target.value as typeof menuCostFilter)}
                          className="rounded-2xl border border-slate-200 px-3 py-2"
                        >
                          <option value="all">Любая себестоимость</option>
                          <option value="noCost">Без себестоимости</option>
                        </select>
                        <select
                          value={menuSort}
                          onChange={(event) => setMenuSort(event.target.value as typeof menuSort)}
                          className="rounded-2xl border border-slate-200 px-3 py-2"
                        >
                          <option value="name">По названию</option>
                          <option value="price">По цене</option>
                          <option value="markup">По наценке %</option>
                          <option value="profit">По прибыли ₽</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleStartCreateProduct}
                          className="ml-auto rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
                        >
                          + Новая позиция
                        </button>
                      </div>
                    </div>
                    {menuLoading ? (
                      <div className="h-32 animate-pulse rounded-2xl bg-slate-200/60" />
                    ) : filteredProducts.length ? (
                      <>
                        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_100px_120px_110px_120px_40px] gap-3 px-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          <span>Название</span>
                          <span className="text-right">Цена</span>
                          <span className="text-right">Себест.</span>
                          <span className="text-right">Наценка</span>
                          <span className="text-right">Маржа</span>
                          <span className="text-right"> </span>
                        </div>
                        <div className="hidden md:flex flex-col gap-2">
                          {filteredProducts.map((product) => {
                            const draftValue = menuPriceDrafts[product._id] ?? getProductPrice(product).toString();
                            const parsedDraft = Number(draftValue);
                            const priceValue = Number.isFinite(parsedDraft) ? parsedDraft : getProductPrice(product);
                            const costValue = product.costPrice ?? null;
                            const economics = getEconomics(priceValue, costValue);
                            const hasNoCost = !costValue || costValue === 0;
                            const isSelected = selectedProduct?._id === product._id && !isCreatingProduct;
                            const categoryName = categories.find((cat) => cat._id === product.categoryId)?.name ?? '—';
                            const marginIsNegative =
                              economics.grossProfit !== null && Number.isFinite(economics.grossProfit) && economics.grossProfit <= 0;
                            return (
                              <div
                                key={product._id}
                                className={`relative rounded-2xl border px-4 py-3 transition ${
                                  isSelected
                                    ? 'border-violet-200 bg-violet-50 shadow-sm'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                }`}
                                onClick={() => handleMenuProductSelect(product)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    handleMenuProductSelect(product);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                              >
                                <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_100px_120px_110px_120px_40px]">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                                    <p className="text-xs text-slate-400">{categoryName}</p>
                                  </div>
                                  <div className="text-right">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={draftValue}
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={(event) =>
                                        setMenuPriceDrafts((prev) => ({ ...prev, [product._id]: event.target.value }))
                                      }
                                      onBlur={() => commitPriceDraft(product)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                          event.currentTarget.blur();
                                        }
                                        if (event.key === 'Escape') {
                                          resetPriceDraft(product);
                                          event.currentTarget.blur();
                                        }
                                      }}
                                      className="w-full rounded-xl border border-slate-200 px-2 py-1 text-right text-sm font-semibold text-slate-900"
                                    />
                                  </div>
                                  <div className="text-right text-sm text-slate-600">
                                    <span>{hasNoCost ? '—' : `${formatCurrency(costValue ?? 0)} ₽`}</span>
                                    {hasNoCost ? (
                                      <span className="mt-1 block text-[10px] font-semibold text-amber-600">
                                        нет себестоимости
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="text-right">
                                    <span
                                      className={`inline-flex items-center justify-center rounded-full border px-2 py-1 text-xs font-semibold ${getMarkupBadgeClass(
                                        economics.markupPercent
                                      )}`}
                                    >
                                      {economics.markupPercent !== null
                                        ? `${economics.markupPercent.toFixed(0)}%`
                                        : '—'}
                                    </span>
                                  </div>
                                  <div
                                    className={`text-right text-sm font-semibold ${
                                      marginIsNegative ? 'text-red-600' : 'text-slate-700'
                                    }`}
                                  >
                                    {economics.grossProfit !== null
                                      ? `${formatCurrency(economics.grossProfit)} ₽`
                                      : '—'}
                                  </div>
                                  <div className="flex justify-end">
                                    <div
                                      className="relative"
                                      onClick={(event) => event.stopPropagation()}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Escape') {
                                          setOpenActionMenuId(null);
                                        }
                                      }}
                                    >
                                      <button
                                        type="button"
                                        ref={openActionMenuId === product._id ? actionMenuButtonRef : undefined}
                                        onClick={() =>
                                          setOpenActionMenuId((prev) => (prev === product._id ? null : product._id))
                                        }
                                        className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                                        aria-haspopup="menu"
                                        aria-expanded={openActionMenuId === product._id}
                                      >
                                        ⋯
                                      </button>
                                      {openActionMenuId === product._id ? (
                                        <div
                                          ref={actionMenuRef}
                                          className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-lg"
                                          role="menu"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleDuplicateProduct(product);
                                              setOpenActionMenuId(null);
                                            }}
                                            className="w-full rounded-lg px-2 py-1 text-left text-slate-600 hover:bg-slate-100"
                                            role="menuitem"
                                          >
                                            Копировать
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleProductPriceChange(product._id, { isActive: false });
                                              setOpenActionMenuId(null);
                                            }}
                                            className="w-full rounded-lg px-2 py-1 text-left text-slate-600 hover:bg-slate-100"
                                            role="menuitem"
                                          >
                                            Архивировать
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleDeleteProduct(product._id);
                                              setOpenActionMenuId(null);
                                            }}
                                            className="w-full rounded-lg px-2 py-1 text-left text-red-600 hover:bg-red-50"
                                            role="menuitem"
                                          >
                                            Удалить
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="space-y-3 md:hidden">
                          {filteredProducts.map((product) => {
                            const draftValue = menuPriceDrafts[product._id] ?? getProductPrice(product).toString();
                            const parsedDraft = Number(draftValue);
                            const priceValue = Number.isFinite(parsedDraft) ? parsedDraft : getProductPrice(product);
                            const costValue = product.costPrice ?? null;
                            const economics = getEconomics(priceValue, costValue);
                            const categoryName = categories.find((cat) => cat._id === product.categoryId)?.name ?? '—';
                            const hasNoCost = !costValue || costValue === 0;
                            const marginIsNegative =
                              economics.grossProfit !== null && Number.isFinite(economics.grossProfit) && economics.grossProfit <= 0;
                            return (
                              <div
                                key={product._id}
                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                onClick={() => handleMenuProductSelect(product)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    handleMenuProductSelect(product);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                                    <p className="text-xs text-slate-400">{categoryName}</p>
                                  </div>
                                  <div
                                    className="relative"
                                    onClick={(event) => event.stopPropagation()}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Escape') {
                                        setOpenActionMenuId(null);
                                      }
                                    }}
                                  >
                                    <button
                                      type="button"
                                      ref={openActionMenuId === product._id ? actionMenuButtonRef : undefined}
                                      onClick={() =>
                                        setOpenActionMenuId((prev) => (prev === product._id ? null : product._id))
                                      }
                                      className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500"
                                      aria-haspopup="menu"
                                      aria-expanded={openActionMenuId === product._id}
                                    >
                                      ⋯
                                    </button>
                                    {openActionMenuId === product._id ? (
                                      <div
                                        ref={actionMenuRef}
                                        className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-lg"
                                        role="menu"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleDuplicateProduct(product);
                                            setOpenActionMenuId(null);
                                          }}
                                          className="w-full rounded-lg px-2 py-1 text-left text-slate-600 hover:bg-slate-100"
                                          role="menuitem"
                                        >
                                          Копировать
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleProductPriceChange(product._id, { isActive: false });
                                            setOpenActionMenuId(null);
                                          }}
                                          className="w-full rounded-lg px-2 py-1 text-left text-slate-600 hover:bg-slate-100"
                                          role="menuitem"
                                        >
                                          Архивировать
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            handleDeleteProduct(product._id);
                                            setOpenActionMenuId(null);
                                          }}
                                          className="w-full rounded-lg px-2 py-1 text-left text-red-600 hover:bg-red-50"
                                          role="menuitem"
                                        >
                                          Удалить
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="mt-4 grid gap-2 text-sm">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Цена</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={draftValue}
                                      onClick={(event) => event.stopPropagation()}
                                      onChange={(event) =>
                                        setMenuPriceDrafts((prev) => ({ ...prev, [product._id]: event.target.value }))
                                      }
                                      onBlur={() => commitPriceDraft(product)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                          event.currentTarget.blur();
                                        }
                                        if (event.key === 'Escape') {
                                          resetPriceDraft(product);
                                          event.currentTarget.blur();
                                        }
                                      }}
                                      className="w-28 rounded-xl border border-slate-200 px-2 py-1 text-right text-sm font-semibold text-slate-900"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Себестоимость</span>
                                    <span className="text-sm text-slate-600">
                                      {hasNoCost ? '—' : `${formatCurrency(costValue ?? 0)} ₽`}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Наценка</span>
                                    <span
                                      className={`inline-flex items-center justify-center rounded-full border px-2 py-1 text-xs font-semibold ${getMarkupBadgeClass(
                                        economics.markupPercent
                                      )}`}
                                    >
                                      {economics.markupPercent !== null
                                        ? `${economics.markupPercent.toFixed(0)}%`
                                        : '—'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Маржа</span>
                                    <span className={marginIsNegative ? 'text-red-600' : 'text-slate-700'}>
                                      {economics.grossProfit !== null
                                        ? `${formatCurrency(economics.grossProfit)} ₽`
                                        : '—'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">
                        Нет позиций по выбранным фильтрам
                      </div>
                    )}
                  </div>
                </div>
                {isEditorOpen ? (
                  <div className="fixed inset-0 z-50 flex">
                    <div
                      className="absolute inset-0 bg-slate-900/30"
                      onClick={handleCloseEditor}
                      aria-hidden="true"
                    />
                    <div className="relative ml-auto flex h-full w-full max-w-[480px] flex-col bg-white shadow-xl">
                      <div
                        ref={drawerRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={menuDrawerTitleId}
                        className="flex h-full flex-col"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                          <p id={menuDrawerTitleId} className="text-sm font-semibold text-slate-800">
                            {menuEditorTitle}
                          </p>
                          <button
                            type="button"
                            onClick={handleCloseEditor}
                            className="relative z-10 inline-flex h-8 items-center justify-center rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer pointer-events-auto"
                          >
                            Закрыть
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 py-4">
                          <form
                            id={menuEditorFormId}
                            onSubmit={isCreatingProduct ? handleCreateProduct : handleUpdateProduct}
                            className="space-y-4 text-sm"
                          >
                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase text-slate-400">Название</label>
                              <input
                                type="text"
                                value={isCreatingProduct ? newProduct.name : productEditForm.name}
                                onChange={(event) =>
                                  isCreatingProduct
                                    ? setNewProduct((prev) => ({ ...prev, name: event.target.value }))
                                    : handleProductEditFieldChange('name', event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 px-3 py-2"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase text-slate-400">Категория</label>
                              <select
                                value={isCreatingProduct ? newProduct.categoryId : productEditForm.categoryId}
                                onChange={(event) =>
                                  isCreatingProduct
                                    ? setNewProduct((prev) => ({ ...prev, categoryId: event.target.value }))
                                    : handleProductEditFieldChange('categoryId', event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 px-3 py-2"
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
                                value={isCreatingProduct ? newProduct.description : productEditForm.description}
                                onChange={(event) =>
                                  isCreatingProduct
                                    ? setNewProduct((prev) => ({ ...prev, description: event.target.value }))
                                    : handleProductEditFieldChange('description', event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 px-3 py-2"
                                rows={3}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase text-slate-400">Фото (URL)</label>
                              <input
                                type="url"
                                value={isCreatingProduct ? newProduct.imageUrl : productEditForm.imageUrl}
                                onChange={(event) =>
                                  isCreatingProduct
                                    ? setNewProduct((prev) => ({ ...prev, imageUrl: event.target.value }))
                                    : handleProductEditFieldChange('imageUrl', event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 px-3 py-2"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase text-slate-400">Цена ₽</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={
                                  isCreatingProduct
                                    ? newProduct.basePrice
                                    : productEditForm.basePrice || productEditForm.price
                                }
                                onChange={(event) =>
                                  isCreatingProduct
                                    ? setNewProduct((prev) => ({ ...prev, basePrice: event.target.value }))
                                    : handleProductEditFieldChange('basePrice', event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 px-3 py-2"
                              />
                            </div>
                            {!isCreatingProduct ? (
                              <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase text-slate-400">Статус</label>
                                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                    checked={productEditForm.isActive}
                                    onChange={(event) => handleProductEditFieldChange('isActive', event.target.checked)}
                                  />
                                  В продаже
                                </label>
                              </div>
                            ) : null}
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs font-semibold uppercase text-slate-400">Экономика</p>
                              <div className="mt-3 grid gap-3">
                                <div className="space-y-1">
                                  <label className="text-[11px] uppercase text-slate-400">Себестоимость ₽</label>
                                  <div className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                                    {editorCostMissing ? '—' : `${formatCurrency(editorCostValue ?? 0)} ₽`}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-[11px] uppercase text-slate-400">Наценка %</label>
                                    <div className={`rounded-xl bg-white px-3 py-2 text-sm font-semibold ${getMarkupColor(editorEconomics.markupPercent)}`}>
                                      {editorEconomics.markupPercent !== null
                                        ? `${editorEconomics.markupPercent.toFixed(0)}%`
                                        : '—'}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[11px] uppercase text-slate-400">Маржа ₽</label>
                                    <div
                                      className={`rounded-xl bg-white px-3 py-2 text-sm font-semibold ${
                                        editorEconomics.grossProfit !== null && editorEconomics.grossProfit <= 0
                                          ? 'text-red-600'
                                          : 'text-slate-700'
                                      }`}
                                    >
                                      {editorEconomics.grossProfit !== null
                                        ? `${formatCurrency(editorEconomics.grossProfit)} ₽`
                                        : '—'}
                                    </div>
                                  </div>
                                </div>
                                {editorCostMissing ? (
                                  <span className="text-xs font-semibold text-amber-600">Нет себестоимости</span>
                                ) : null}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase text-slate-400">Ингредиенты</p>
                                <button
                                  type="button"
                                  onClick={isCreatingProduct ? handleAddIngredientRow : addEditIngredientRow}
                                  className="text-xs font-semibold text-violet-600 hover:text-violet-700"
                                >
                                  + Добавить
                                </button>
                              </div>
                              {(isCreatingProduct ? productIngredients : productEditIngredients).length === 0 ? (
                                <p className="text-xs text-slate-400">
                                  Ингредиенты не указаны, позиция считается самостоятельной.
                                </p>
                              ) : null}
                              {(isCreatingProduct ? productIngredients : productEditIngredients).map((row, index) => (
                                <div key={index} className="flex flex-wrap items-center gap-2">
                                  <select
                                    value={row.ingredientId}
                                    onChange={(event) =>
                                      isCreatingProduct
                                        ? handleIngredientChange(index, 'ingredientId', event.target.value)
                                        : handleEditIngredientChange(index, 'ingredientId', event.target.value)
                                    }
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
                                    onChange={(event) =>
                                      isCreatingProduct
                                        ? handleIngredientChange(index, 'quantity', event.target.value)
                                        : handleEditIngredientChange(index, 'quantity', event.target.value)
                                    }
                                    className="w-24 rounded-2xl border border-slate-200 px-3 py-2"
                                    placeholder="Кол-во"
                                  />
                                  <select
                                    value={row.unit || ''}
                                    onChange={(event) =>
                                      isCreatingProduct
                                        ? handleIngredientChange(index, 'unit', event.target.value)
                                        : handleEditIngredientChange(index, 'unit', event.target.value)
                                    }
                                    className="w-20 rounded-2xl border border-slate-200 px-3 py-2"
                                  >
                                    <option value="">Ед.</option>
                                    {measurementUnits.map((unit) => (
                                      <option key={unit} value={unit}>
                                        {unit}
                                      </option>
                                    ))}
                                  </select>
                                  {!isCreatingProduct ? (
                                    <button
                                      type="button"
                                      onClick={() => removeEditIngredientRow(index)}
                                      className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-200"
                                    >
                                      Удалить
                                    </button>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase text-slate-400">Модификаторы</p>
                                <button
                                  type="button"
                                  onClick={() => setMenuSection('modifiers')}
                                  className="text-xs font-semibold text-violet-600 hover:text-violet-700"
                                >
                                  Настроить
                                </button>
                              </div>
                              {modifierGroups.length ? (
                                <div className="space-y-2 rounded-2xl border border-slate-100 p-3">
                                  {modifierGroups.map((group) => {
                                    const checked = isCreatingProduct
                                      ? newProductModifierIds.includes(group._id)
                                      : productEditModifiers.includes(group._id);
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
                                          onChange={() =>
                                            isCreatingProduct
                                              ? handleToggleNewProductModifier(group._id)
                                              : handleToggleEditProductModifier(group._id)
                                          }
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
                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase text-slate-400">Тип скидки</label>
                              <select
                                value={isCreatingProduct ? newProduct.discountType : productEditForm.discountType}
                                onChange={(event) =>
                                  isCreatingProduct
                                    ? setNewProduct((prev) => ({
                                        ...prev,
                                        discountType: event.target.value as typeof prev.discountType,
                                      }))
                                    : handleProductEditFieldChange('discountType', event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 px-3 py-2"
                              >
                                <option value="">Без скидки</option>
                                <option value="percentage">Скидка %</option>
                                <option value="fixed">Фикс. скидка</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-semibold uppercase text-slate-400">Значение скидки</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={isCreatingProduct ? newProduct.discountValue : productEditForm.discountValue}
                                onChange={(event) =>
                                  isCreatingProduct
                                    ? setNewProduct((prev) => ({ ...prev, discountValue: event.target.value }))
                                    : handleProductEditFieldChange('discountValue', event.target.value)
                                }
                                className="w-full rounded-2xl border border-slate-200 px-3 py-2"
                              />
                            </div>
                          </form>
                        </div>
                        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={handleCancelProductEdit}
                              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                            >
                              Отмена
                            </button>
                            <button
                              type="submit"
                              form={menuEditorFormId}
                              className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
                            >
                              Сохранить
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
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
          <div className="flex flex-wrap items-center gap-2">
            {inventoryTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setInventoryTab(tab.id)}
                className={`flex flex-col rounded-2xl border px-4 py-3 text-left shadow-soft transition hover:border-emerald-300 ${
                  inventoryTab === tab.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'
                }`}
              >
                <span className="text-sm font-semibold text-slate-800">{tab.label}</span>
                <span className="text-xs text-slate-500">{tab.description}</span>
              </button>
            ))}
          </div>

          {inventoryTab === 'warehouses' ? (
            <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
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
            </section>
          ) : null}

          {inventoryTab === 'documents' ? (
            <section className="relative">
              <Card
                title="Документы склада"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadStockReceipts()}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Обновить список
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenReceiptDrawer()}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-soft hover:bg-emerald-500"
                    >
                      Создать документ
                    </button>
                  </div>
                }
              >
                <p className="text-sm text-slate-600">Просмотр и анализ складских документов</p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsReceiptFiltersOpen((prev) => !prev)}
                      className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600 hover:bg-slate-200"
                    >
                      Фильтры {isReceiptFiltersOpen ? '▴' : '▾'}
                    </button>
                    <select
                      value={receiptFilter}
                      onChange={(event) => setReceiptFilter(event.target.value as typeof receiptFilter)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                    >
                      <option value="all">Все</option>
                      <option value="receipt">Поставки</option>
                      <option value="writeOff">Списания</option>
                      <option value="inventory">Инвентаризации</option>
                    </select>
                  </div>
                  <span className="text-xs text-slate-500">Всего: {filteredStockReceipts.length}</span>
                </div>

                {receiptFilterChips.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {receiptFilterChips.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={chip.onClear}
                        className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                      >
                        {chip.label}
                        <span className="text-[10px]">✕</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {isReceiptFiltersOpen ? (
                  <div className="mt-4 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label className="flex flex-col gap-1 text-slate-600">
                        <span className="text-[11px] uppercase text-slate-400">Период с</span>
                        <input
                          type="date"
                          value={receiptDateFrom}
                          max={todayInputValue}
                          onChange={(event) => {
                            setReceiptDatePreset('');
                            setReceiptDateFrom(event.target.value);
                          }}
                          className="rounded-2xl border border-slate-200 px-3 py-2"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-slate-600">
                        <span className="text-[11px] uppercase text-slate-400">Период по</span>
                        <input
                          type="date"
                          value={receiptDateTo}
                          max={todayInputValue}
                          onChange={(event) => {
                            setReceiptDatePreset('');
                            setReceiptDateTo(event.target.value);
                          }}
                          className="rounded-2xl border border-slate-200 px-3 py-2"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-slate-600">
                        <span className="text-[11px] uppercase text-slate-400">Поставщик</span>
                        <select
                          value={receiptSupplierFilter}
                          onChange={(event) => setReceiptSupplierFilter(event.target.value)}
                          className="rounded-2xl border border-slate-200 px-3 py-2"
                        >
                          <option value="">Все поставщики</option>
                          {suppliers.map((supplier) => (
                            <option key={supplier._id} value={supplier._id}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1 text-slate-600">
                          <span className="text-[11px] uppercase text-slate-400">Сумма от</span>
                          <input
                            type="number"
                            step="0.01"
                            value={receiptAmountMin}
                            onChange={(event) => setReceiptAmountMin(event.target.value)}
                            className="rounded-2xl border border-slate-200 px-3 py-2"
                            placeholder="0"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-slate-600">
                          <span className="text-[11px] uppercase text-slate-400">Сумма до</span>
                          <input
                            type="number"
                            step="0.01"
                            value={receiptAmountMax}
                            onChange={(event) => setReceiptAmountMax(event.target.value)}
                            className="rounded-2xl border border-slate-200 px-3 py-2"
                            placeholder="∞"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Быстрый выбор:</span>
                      {Object.entries(receiptDatePresetLabels).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => applyReceiptDatePreset(id)}
                          className={`rounded-full px-3 py-1 font-semibold transition ${
                            receiptDatePreset === id
                              ? 'bg-emerald-600 text-white shadow-soft'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-2 py-2" />
                        <th className="px-2 py-2">Дата и время</th>
                        <th className="px-2 py-2">Тип</th>
                        <th className="px-2 py-2">Склад</th>
                        <th className="px-2 py-2">Поставщик</th>
                        <th className="px-2 py-2">Позиции</th>
                        <th className="px-2 py-2 text-right">Сумма</th>
                        <th className="px-2 py-2 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStockReceipts.map((receipt) => {
                        const total = receiptTotals.totalsMap.get(receipt._id) ?? 0;
                        const isExpanded = expandedReceiptId === receipt._id;
                        const receiptLineItems = Array.isArray(receipt.items) ? receipt.items : [];
                        const previewItems = receiptLineItems.slice(0, 5);
                        const remainingCount = receiptLineItems.length - previewItems.length;

                        return (
                          <React.Fragment key={receipt._id}>
                            <tr className="transition hover:bg-slate-50">
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isMobileView) {
                                      setMobileReceiptPreview(receipt);
                                      return;
                                    }
                                    setExpandedReceiptId((prev) => (prev === receipt._id ? null : receipt._id));
                                  }}
                                  className="text-slate-400 hover:text-slate-600"
                                  aria-label="Показать состав"
                                >
                                  {isExpanded ? '▾' : '▸'}
                                </button>
                              </td>
                              <td className="px-2 py-2 text-slate-600">
                                <span className="whitespace-nowrap">{formatReceiptDateTime(receipt.occurredAt)}</span>
                              </td>
                              <td className="px-2 py-2">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                                    receipt.type === 'receipt'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : receipt.type === 'writeOff'
                                        ? 'bg-red-50 text-red-600'
                                        : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {receipt.type === 'receipt' ? '⬆' : receipt.type === 'writeOff' ? '⬇' : '🧾'}
                                  {receiptTypeLabels[receipt.type]}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-slate-500">
                                {warehouseMap.get(receipt.warehouseId)?.name ?? '—'}
                              </td>
                              <td className="px-2 py-2 text-slate-500">
                                {receipt.supplierId ? supplierMap.get(receipt.supplierId)?.name ?? '—' : 'Не указан'}
                              </td>
                              <td className="px-2 py-2 text-slate-500">
                                {formatPositionsCount(receiptLineItems.length)}
                              </td>
                              <td className="px-2 py-2 text-right font-semibold text-slate-800">
                                {formatCurrency(Math.abs(total))} ₽
                              </td>
                              <td className="px-2 py-2 text-right text-xs">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReceiptDrawer(receipt)}
                                    className="rounded-full bg-white px-2 py-1 text-sm shadow-inner transition hover:bg-slate-50"
                                    aria-label="Редактировать"
                                  >
                                    ✏️
                                  </button>
                                  {receipt.type !== 'inventory' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteStockReceipt(receipt._id)}
                                      className="rounded-full bg-red-50 px-2 py-1 text-sm text-red-600 transition hover:bg-red-100"
                                      aria-label="Удалить"
                                    >
                                      🗑
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                            {isExpanded ? (
                              <tr className="bg-slate-50/70">
                                <td colSpan={8} className="px-4 py-3 text-xs text-slate-600">
                                  <div className="space-y-1">
                                    <p className="text-[11px] uppercase text-slate-400">Состав документа</p>
                                    <div className="space-y-1">
                                      {previewItems.map((item, index) => {
                                        const itemId = item.itemId ?? '';
                                        const unitLabel =
                                          item.itemType === 'ingredient'
                                            ? ingredientUnitMap[itemId] || 'ед.'
                                            : defaultProductUnit;
                                        const totalValue = item.quantity * item.unitCost;
                                        return (
                                          <div key={`${itemId}-${index}`} className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-slate-700">
                                              {getInventoryItemName(item.itemType, itemId)}
                                            </span>
                                            <span>
                                              — {item.quantity} {unitLabel} × {formatCurrency(item.unitCost)} ₽ ={' '}
                                              {formatCurrency(totalValue)} ₽
                                            </span>
                                          </div>
                                        );
                                      })}
                                      {remainingCount > 0 ? (
                                        <div className="text-[11px] text-slate-400">+ ещё {remainingCount} позиции</div>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2">
                                      <span className="font-semibold text-slate-700">
                                        Итого: {formatCurrency(Math.abs(total))} ₽
                                      </span>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenReceiptDrawer(receipt)}
                                          className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-600 shadow-inner"
                                        >
                                          Редактировать
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setExpandedReceiptId(null)}
                                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500"
                                        >
                                          Закрыть
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="text-sm font-semibold text-slate-700">
                        <td className="px-2 py-2" colSpan={6}>
                          Всего документов: {filteredStockReceipts.length}
                        </td>
                        <td className="px-2 py-2 text-right" colSpan={2}>
                          Сумма: {formatCurrency(Math.abs(receiptTotals.overall))} ₽
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>

              {isReceiptDrawerOpen ? (
                <div className="fixed inset-0 z-50 flex">
                  <div
                    className="absolute inset-0 bg-slate-900/30"
                    onClick={handleCloseReceiptDrawer}
                    aria-hidden="true"
                  />
                  <div className="relative ml-auto flex h-full w-full flex-col bg-white shadow-xl sm:w-[38%] sm:max-w-[520px]">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800">
                        {selectedStockReceipt ? 'Редактирование поставки' : 'Новая поставка'}
                      </p>
                      <button
                        type="button"
                        onClick={handleCloseReceiptDrawer}
                        className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-4">
                      <form id="receipt-drawer-form" onSubmit={handleSaveStockReceipt} className="space-y-4 text-sm">
                        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                          <p className="text-[11px] uppercase text-slate-400">Тип и дата</p>
                          <div className="grid gap-2 md:grid-cols-2">
                            <select
                              value={receiptType}
                              onChange={(event) => setReceiptType(event.target.value as typeof receiptType)}
                              className="w-full rounded-2xl border border-slate-200 px-3 py-2"
                            >
                              <option value="receipt">Поставка</option>
                              <option value="writeOff">Списание</option>
                            </select>
                            <input
                              type="date"
                              value={receiptDate}
                              max={todayInputValue}
                              onChange={(event) => setReceiptDate(event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 px-3 py-2"
                            />
                          </div>
                        </div>

                        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                          <p className="text-[11px] uppercase text-slate-400">Контекст</p>
                          <select
                            value={receiptForm.warehouseId}
                            onChange={(event) =>
                              setReceiptForm((prev) => ({ ...prev, warehouseId: event.target.value }))
                            }
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2"
                          >
                            <option value="">Выберите склад</option>
                            {warehouses.map((warehouse) => (
                              <option key={warehouse._id} value={warehouse._id}>
                                {warehouse.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={receiptForm.supplierId ?? ''}
                            onChange={(event) =>
                              setReceiptForm((prev) => ({ ...prev, supplierId: event.target.value }))
                            }
                            className="w-full rounded-2xl border border-slate-200 px-3 py-2"
                          >
                            <option value="">Поставщик (опционально)</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier._id} value={supplier._id}>
                                {supplier.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-[11px] uppercase text-slate-400">
                            <span>Позиции документа</span>
                            <button
                              type="button"
                              onClick={addReceiptItemRow}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                              + Добавить позицию
                            </button>
                          </div>
                          <div className="space-y-2">
                            {receiptItems.map((item, index) => (
                              <div
                                key={`${item.itemId}-${index}`}
                                className="grid items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-xs sm:grid-cols-[1fr_1.2fr_1fr_0.8fr_0.8fr_auto]"
                              >
                                <select
                                  value={item.itemType}
                                  onChange={(event) =>
                                    handleReceiptItemChange(
                                      index,
                                      'itemType',
                                      event.target.value as 'ingredient' | 'product'
                                    )
                                  }
                                  className="rounded-xl border border-slate-200 px-2 py-2"
                                >
                                  <option value="ingredient">Ингредиент</option>
                                  <option value="product">Продукт</option>
                                </select>
                                <select
                                  value={item.itemId}
                                  onChange={(event) => handleReceiptItemChange(index, 'itemId', event.target.value)}
                                  className="rounded-xl border border-slate-200 px-2 py-2"
                                >
                                  <option value="">Выберите позицию</option>
                                  {item.itemType === 'ingredient'
                                    ? ingredients.map((ingredient) => (
                                        <option key={ingredient._id} value={ingredient._id}>
                                          {ingredient.name}
                                        </option>
                                      ))
                                    : products.map((product) => (
                                        <option key={product._id} value={product._id}>
                                          {product.name}
                                        </option>
                                      ))}
                                </select>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.quantity}
                                    onChange={(event) => handleReceiptItemChange(index, 'quantity', event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-2 py-2"
                                    placeholder="Количество"
                                  />
                                  <span className="text-[11px] text-slate-500">
                                    {item.itemType === 'ingredient'
                                      ? ingredientUnitMap[item.itemId] || 'ед.'
                                      : defaultProductUnit}
                                  </span>
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitCost}
                                  onChange={(event) => handleReceiptItemChange(index, 'unitCost', event.target.value)}
                                  className="rounded-xl border border-slate-200 px-2 py-2"
                                  placeholder="Цена"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.totalCost}
                                  onChange={(event) => handleReceiptItemChange(index, 'totalCost', event.target.value)}
                                  className="rounded-xl border border-slate-200 px-2 py-2"
                                  placeholder="Сумма"
                                />
                                {receiptItems.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => removeReceiptItemRow(index)}
                                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-200"
                                  >
                                    ×
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </form>
                    </div>
                    <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase text-slate-400">Итоговая сумма</p>
                          <p className="text-lg font-semibold text-slate-800">{formatCurrency(receiptTotal)} ₽</p>
                          <p className="text-[11px] text-slate-400">Последнее изменение: {receiptLastTouchedLabel}</p>
                        </div>
                        <button
                          type="submit"
                          form="receipt-drawer-form"
                          className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-soft hover:bg-emerald-500"
                        >
                          Сохранить документ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {mobileReceiptPreview ? (
                <div className="fixed inset-0 z-50 flex items-end sm:hidden">
                  <div
                    className="absolute inset-0 bg-slate-900/30"
                    onClick={() => setMobileReceiptPreview(null)}
                    aria-hidden="true"
                  />
                  <div className="relative w-full rounded-t-3xl bg-white p-4 shadow-xl">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Состав документа</p>
                        <p className="text-xs text-slate-500">
                          {formatReceiptDateTime(mobileReceiptPreview.occurredAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMobileReceiptPreview(null)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                      >
                        Закрыть
                      </button>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      {(Array.isArray(mobileReceiptPreview.items) ? mobileReceiptPreview.items : [])
                        .slice(0, 5)
                        .map((item, index) => {
                        const itemId = item.itemId ?? '';
                        const unitLabel =
                          item.itemType === 'ingredient'
                            ? ingredientUnitMap[itemId] || 'ед.'
                            : defaultProductUnit;
                        const totalValue = item.quantity * item.unitCost;
                        return (
                          <div key={`${itemId}-${index}`}>
                            <span className="font-semibold text-slate-700">
                              {getInventoryItemName(item.itemType, itemId)}
                            </span>{' '}
                            — {item.quantity} {unitLabel} × {formatCurrency(item.unitCost)} ₽ ={' '}
                            {formatCurrency(totalValue)} ₽
                          </div>
                        );
                      })}
                      {(mobileReceiptPreview.items?.length ?? 0) > 5 ? (
                        <div className="text-[11px] text-slate-400">
                          + ещё {(mobileReceiptPreview.items?.length ?? 0) - 5} позиции
                        </div>
                      ) : null}
                      <div className="border-t border-slate-200 pt-2 font-semibold text-slate-700">
                        Итого:{' '}
                        {formatCurrency(Math.abs(receiptTotals.totalsMap.get(mobileReceiptPreview._id) ?? 0))} ₽
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenReceiptDrawer(mobileReceiptPreview)}
                        className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileReceiptPreview(null)}
                        className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                      >
                        Закрыть
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {inventoryTab === 'audit' ? (
            <section className="space-y-6">
              <Card title="Инвентаризация">
                <form onSubmit={handleSubmitInventoryAudit} className="space-y-3 text-sm">
                  <p className="text-[11px] text-amber-700">
                    Документы до выбранной даты будут заблокированы для изменений после проведения инвентаризации.
                  </p>
                  <select
                    value={inventoryAuditForm.warehouseId}
                    onChange={(event) =>
                      setInventoryAuditForm((prev) => ({ ...prev, warehouseId: event.target.value }))
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
                    max={todayInputValue}
                    onChange={(event) =>
                      setInventoryAuditForm((prev) => ({ ...prev, performedAt: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  />
                  <div className="space-y-2 rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-[11px] uppercase text-slate-400">
                      <span>Позиции</span>
                      <button
                        type="button"
                        onClick={addAuditItemRow}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                      >
                        + Добавить
                      </button>
                    </div>
                    {inventoryAuditForm.items.map((item, index) => {
                      const previousQuantity = inventoryQuantityLookup.get(
                        `${inventoryAuditForm.warehouseId}-${item.itemType}-${item.itemId}`
                      );

                      return (
                        <div key={`${item.itemId}-${index}`} className="space-y-2 rounded-2xl bg-white p-3 shadow-soft">
                          <div className="grid gap-2 md:grid-cols-2">
                            <select
                              value={item.itemType}
                              onChange={(event) =>
                                handleAuditItemChange(index, 'itemType', event.target.value as 'ingredient' | 'product')
                              }
                              className="w-full rounded-xl border border-slate-200 px-3 py-2"
                            >
                              <option value="ingredient">Ингредиент</option>
                              <option value="product">Продукт</option>
                            </select>
                            <select
                              value={item.itemId}
                              onChange={(event) => handleAuditItemChange(index, 'itemId', event.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2"
                            >
                              <option value="">Выберите позицию</option>
                              {item.itemType === 'ingredient'
                                ? ingredients.map((ingredient) => (
                                    <option key={ingredient._id} value={ingredient._id}>
                                      {ingredient.name}
                                    </option>
                                  ))
                                : products.map((product) => (
                                    <option key={product._id} value={product._id}>
                                      {product.name}
                                    </option>
                                  ))}
                            </select>
                          </div>
                          <div className="grid gap-2 md:grid-cols-[repeat(3,_minmax(0,_1fr))_auto]">
                            <div>
                              <p className="text-[11px] uppercase text-slate-400">Было</p>
                              <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                                {previousQuantity ?? '—'}
                              </p>
                            </div>
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
                      );
                    })}
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
          ) : null}

          {inventoryTab === 'stock' ? (
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
                              {[-10, -1, 1, 10].map((delta) => (
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
          ) : null}
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
                <Card
                  title="Гости"
                  actions={
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportCustomersExcel}
                        disabled={customersLoading || customers.length === 0}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-emerald-300 disabled:opacity-60"
                      >
                        Экспорт XLSX
                      </button>
                      <label className="cursor-pointer rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-emerald-300">
                        Импорт XLSX
                        <input type="file" accept=".xlsx" onChange={handleImportCustomers} className="sr-only" />
                      </label>
                    </div>
                  }
                >
                  {customersLoading ? (
                    <div className="h-32 animate-pulse rounded-2xl bg-slate-200/60" />
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                        Формат импорта XLSX: «Имя», «Телефон», «Email», «Баллы», «Выручка».
                      </div>
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
                            <button
                              type="button"
                              onClick={handleDeleteCustomer}
                              className="w-full rounded-2xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                            >
                              Удалить гостя
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
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              type="submit"
                              className="w-full rounded-2xl bg-emerald-500 py-2 text-sm font-semibold text-white"
                            >
                              Сохранить поставщика
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSupplier(selectedSupplier._id)}
                              className="w-full rounded-2xl border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                            >
                              Удалить поставщика
                            </button>
                          </div>
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
          <Card title={editingDiscount ? 'Редактирование скидки' : 'Новая скидка'}>
            <form onSubmit={handleSubmitDiscount} className="grid gap-4 text-sm md:grid-cols-2">
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
                        categoryIds: scope === 'category' ? prev.categoryIds : [],
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
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="mb-2 text-xs uppercase text-slate-500">Категории</p>
                    {categories.length === 0 ? (
                      <p className="text-xs text-slate-400">Категории ещё не созданы.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {categories.map((category) => {
                          const checked = discountForm.categoryIds.includes(category._id);
                          return (
                            <label key={category._id} className="flex items-center gap-2 text-sm text-slate-600">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleDiscountCategory(category._id)}
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              <span>{category.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
                  {creatingDiscount ? 'Сохранение…' : editingDiscount ? 'Сохранить изменения' : 'Создать скидку'}
                </button>
                {editingDiscount ? (
                  <button
                    type="button"
                    onClick={resetDiscountForm}
                    className="ml-3 rounded-2xl border border-slate-200 px-6 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
                  >
                    Отменить
                  </button>
                ) : null}
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
                                onClick={() => handleEditDiscount(discount)}
                                disabled={discountActionId === discount._id}
                                className="rounded-2xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-60"
                              >
                                Редактировать
                              </button>
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
      </main>
    </div>
  );
};

const Card: React.FC<
  React.PropsWithChildren<{ title: string; id?: string; className?: string; actions?: React.ReactNode }>
> = ({ title, children, id, className, actions }) => (
  <section
    id={id}
    className={`rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)]/90 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.45)] backdrop-blur ${
      className ?? ''
    }`}
  >
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{title}</h2>
      {actions ?? null}
    </div>
    {children}
  </section>
);

const SummaryCard: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-bg-card)] p-5 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-info)]">{title}</p>
    <p className="mt-2 text-2xl font-bold text-[color:var(--color-text)]">{value}</p>
  </div>
);

export default AdminPage;
