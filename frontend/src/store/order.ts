import { create } from 'zustand';

import api from '../lib/api';
import type { Product } from './catalog';
import { useAuthStore } from './auth';
import { DEFAULT_POS_CONTEXT } from '../constants/posContext';

export type CustomerSummary = {
  _id: string;
  name: string;
  phone?: string;
  points: number;
};

export type PaymentMethod = 'cash' | 'card';

export type OrderTag = 'takeaway' | 'delivery';

export type SelectedModifierOption = {
  optionId: string;
  name: string;
  priceChange: number;
  costChange: number;
};

export type SelectedModifier = {
  groupId: string;
  groupName: string;
  selectionType: 'single' | 'multiple';
  required: boolean;
  options: SelectedModifierOption[];
};

export type OrderItem = {
  lineId: string;
  productId: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  qty: number;
  price: number;
  total: number;
  costPrice?: number;
  modifiersApplied?: SelectedModifier[];
};

export type ActiveOrder = {
  _id: string;
  total: number;
  status: 'draft' | 'paid';
  updatedAt: string;
  orderTag?: OrderTag | null;
};

export type OrderHistoryEntry = {
  _id: string;
  total: number;
  status: 'paid' | 'completed' | 'cancelled';
  createdAt: string;
  paymentMethod?: PaymentMethod;
  items: OrderItem[];
  customer?: CustomerSummary | null;
};

export type DiscountApplication = 'manual' | 'auto' | 'selected';

export type AppliedDiscount = {
  discountId?: string;
  name: string;
  type: 'fixed' | 'percentage';
  scope: 'order' | 'category' | 'product';
  value: number;
  amount: number;
  targetId?: string;
  targetName?: string;
  application: DiscountApplication;
};

export type DiscountSummary = {
  _id: string;
  name: string;
  description?: string;
  type: 'fixed' | 'percentage';
  scope: 'order' | 'category' | 'product';
  value: number;
  targetName?: string;
  autoApply: boolean;
  autoApplyDays?: number[];
  autoApplyStart?: string;
  autoApplyEnd?: string;
};

type OrderState = {
  orderId: string | null;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  manualDiscount: number;
  total: number;
  status: 'draft' | 'paid' | 'completed' | 'cancelled' | null;
  customerId: string | null;
  customer: CustomerSummary | null;
  orderTag: OrderTag | null;
  loading: boolean;
  activeOrders: ActiveOrder[];
  appliedDiscounts: AppliedDiscount[];
  availableDiscounts: DiscountSummary[];
  selectedDiscountIds: string[];
  shiftHistory: OrderHistoryEntry[];
  shiftHistoryLoading: boolean;
  createDraft: (options?: { forceNew?: boolean }) => Promise<void>;
  addProduct: (product: Product, modifiers?: SelectedModifier[]) => Promise<void>;
  updateItemQty: (lineId: string, qty: number) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  attachCustomer: (customer: CustomerSummary | null) => Promise<void>;
  payOrder: (payload: { method: PaymentMethod; amountTendered: number; change?: number }) => Promise<void>;
  completeOrder: () => Promise<void>;
  cancelOrder: () => Promise<void>;
  cancelReceipt: (orderId: string) => Promise<void>;
  reset: () => void;
  syncItems: (
    items: OrderItem[],
    options?: { manualDiscount?: number; customerId?: string | null; discountIds?: string[]; orderTag?: OrderTag | null }
  ) => Promise<void>;
  setOrderTag: (tag: OrderTag | null) => Promise<void>;
  fetchActiveOrders: () => Promise<void>;
  loadOrder: (orderId: string) => Promise<void>;
  redeemPoints: (points: number, options?: { maxAmount?: number }) => Promise<void>;
  clearDiscount: () => Promise<void>;
  fetchAvailableDiscounts: () => Promise<void>;
  toggleDiscount: (discountId: string) => Promise<void>;
  fetchShiftHistory: (options?: { registerId?: string }) => Promise<void>;
  resetShiftHistory: () => void;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const mapSelectedModifiers = (modifiers: any): SelectedModifier[] => {
  if (!Array.isArray(modifiers)) {
    return [];
  }

  const result: SelectedModifier[] = [];

  for (const modifier of modifiers) {
    if (!modifier || typeof modifier !== 'object') {
      continue;
    }

    const groupId = String((modifier as any).groupId ?? '');
    const groupName = typeof (modifier as any).groupName === 'string' ? (modifier as any).groupName : '';
    const selectionType = (modifier as any).selectionType === 'multiple' ? 'multiple' : 'single';
    const required = Boolean((modifier as any).required);
    if (!groupId || !groupName) {
      continue;
    }

    const options: SelectedModifierOption[] = Array.isArray((modifier as any).options)
        ? (modifier as any).options
            .map((option: any) => ({
                optionId: String(option?.optionId ?? option?._id ?? option?.id ?? ''),
                name: typeof option?.name === 'string' ? option.name : '',
                priceChange: typeof option?.priceChange === 'number' ? option.priceChange : 0,
                costChange: typeof option?.costChange === 'number' ? option.costChange : 0,
              }))
            .filter((option: SelectedModifierOption) => option.optionId && option.name)
        : [];

    result.push({ groupId, groupName, selectionType, required, options });
  }

  return result;
};

const buildLineId = (productId: string, modifiers?: SelectedModifier[]): string => {
  if (!modifiers || modifiers.length === 0) {
    return productId;
  }

  const parts = modifiers
    .map((modifier) => {
      const optionPart = modifier.options.map((option) => option.optionId).sort().join(',');
      return `${modifier.groupId}:${optionPart}`;
    })
    .sort();

  return `${productId}:${parts.join('|')}`;
};

const mapOrderItems = (items: any[] | undefined): OrderItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    lineId:
      typeof item.lineId === 'string' && item.lineId
        ? item.lineId
        : buildLineId(
            String(
              typeof item.productId === 'object' && item.productId
                ? item.productId._id ?? item.productId
                : item.productId ?? item._id ?? ''
            ),
            mapSelectedModifiers(item.modifiersApplied)
          ),
    productId: String(
      typeof item.productId === 'object' && item.productId
        ? item.productId._id ?? item.productId
        : item.productId ?? item._id ?? ''
    ),
    name: item.name,
    categoryId: item.categoryId
      ? String(
          typeof item.categoryId === 'object' && item.categoryId
            ? item.categoryId._id ?? item.categoryId
            : item.categoryId
        )
      : undefined,
    categoryName: typeof item.categoryName === 'string' ? item.categoryName : undefined,
    price: item.price,
    costPrice: item.costPrice,
    qty: item.qty,
    total: item.total,
    modifiersApplied: mapSelectedModifiers(item.modifiersApplied),
  }));
};

const mapModifiersToPayload = (modifiers?: SelectedModifier[]) =>
  modifiers?.map((modifier) => ({
    groupId: modifier.groupId,
    optionIds: modifier.options.map((option) => option.optionId),
  }));

const mapAppliedDiscounts = (discounts: any): AppliedDiscount[] => {
  if (!Array.isArray(discounts)) {
    return [];
  }

  const allowedTypes = new Set(['fixed', 'percentage']);
  const allowedScopes = new Set(['order', 'category', 'product']);
  const allowedApplications = new Set<DiscountApplication>(['manual', 'auto', 'selected']);

  const result: AppliedDiscount[] = [];

  for (const discount of discounts) {
    if (!discount || typeof discount !== 'object') {
      continue;
    }

    const type =
      typeof discount.type === 'string' && allowedTypes.has(discount.type)
        ? (discount.type as AppliedDiscount['type'])
        : null;
    const scope =
      typeof discount.scope === 'string' && allowedScopes.has(discount.scope)
        ? (discount.scope as AppliedDiscount['scope'])
        : null;
    const application =
      typeof discount.application === 'string' && allowedApplications.has(discount.application)
        ? (discount.application as DiscountApplication)
        : null;

    if (!type || !scope || !application) {
      continue;
    }

    const amount = typeof discount.amount === 'number' ? discount.amount : 0;
    const value = typeof discount.value === 'number' ? discount.value : 0;

    const discountIdRaw = discount.discountId ?? discount._id;
    const discountId = discountIdRaw
      ? String(
          typeof discountIdRaw === 'object' && discountIdRaw ? discountIdRaw._id ?? discountIdRaw : discountIdRaw
        )
      : undefined;

    const targetIdRaw = discount.targetId;
    const targetId = targetIdRaw
      ? String(typeof targetIdRaw === 'object' && targetIdRaw ? targetIdRaw._id ?? targetIdRaw : targetIdRaw)
      : undefined;

    const mapped: AppliedDiscount = {
      name: typeof discount.name === 'string' ? discount.name : 'Скидка',
      type,
      scope,
      value,
      amount,
      application,
    };

    if (discountId) {
      mapped.discountId = discountId;
    }

    if (targetId) {
      mapped.targetId = targetId;
    }

    if (typeof discount.targetName === 'string') {
      mapped.targetName = discount.targetName;
    }

    result.push(mapped);
  }

  return result;
};

const extractSelectedDiscountIds = (discounts: AppliedDiscount[]): string[] => {
  return discounts
    .filter((discount) => discount.application === 'selected' && discount.discountId)
    .map((discount) => discount.discountId!)
    .filter((value, index, array) => array.indexOf(value) === index);
};

const mapDiscountSummaries = (discounts: any): DiscountSummary[] => {
  if (!Array.isArray(discounts)) {
    return [];
  }

  const allowedTypes = new Set(['fixed', 'percentage']);
  const allowedScopes = new Set(['order', 'category', 'product']);

  const result: DiscountSummary[] = [];

  for (const discount of discounts) {
    if (!discount || typeof discount !== 'object') {
      continue;
    }

    const type =
      typeof discount.type === 'string' && allowedTypes.has(discount.type)
        ? (discount.type as DiscountSummary['type'])
        : null;
    const scope =
      typeof discount.scope === 'string' && allowedScopes.has(discount.scope)
        ? (discount.scope as DiscountSummary['scope'])
        : null;

    if (!type || !scope) {
      continue;
    }

    const value = typeof discount.value === 'number' ? discount.value : 0;
    const autoApply = Boolean(discount.autoApply);

    const autoApplyDays = Array.isArray(discount.autoApplyDays)
      ? discount.autoApplyDays
          .map((day: unknown) => Number(day))
          .filter((day: number) => Number.isInteger(day) && day >= 0 && day <= 6)
      : undefined;

    const normalizeTime = (time: unknown): string | undefined => {
      if (typeof time !== 'string') {
        return undefined;
      }
      return time;
    };

    const idRaw = discount._id ?? discount.id;
    const id = idRaw
      ? String(typeof idRaw === 'object' && idRaw ? idRaw._id ?? idRaw : idRaw)
      : undefined;

    if (!id) {
      continue;
    }

    const mapped: DiscountSummary = {
      _id: id,
      name: typeof discount.name === 'string' ? discount.name : 'Скидка',
      type,
      scope,
      value,
      autoApply,
    };

    if (typeof discount.description === 'string') {
      mapped.description = discount.description;
    }

    if (typeof discount.targetName === 'string') {
      mapped.targetName = discount.targetName;
    }

    if (autoApplyDays && autoApplyDays.length) {
      mapped.autoApplyDays = autoApplyDays;
    }

    const autoApplyStart = normalizeTime(discount.autoApplyStart);
    if (autoApplyStart) {
      mapped.autoApplyStart = autoApplyStart;
    }

    const autoApplyEnd = normalizeTime(discount.autoApplyEnd);
    if (autoApplyEnd) {
      mapped.autoApplyEnd = autoApplyEnd;
    }

    result.push(mapped);
  }

  return result;
};

const parseStatus = (status: unknown): OrderState['status'] => {
  if (status === 'draft' || status === 'paid' || status === 'completed' || status === 'cancelled') {
    return status;
  }

  return null;
};

const mapCustomer = (customer: any): CustomerSummary | null => {
  if (!customer) {
    return null;
  }

  if (typeof customer === 'string') {
    return { _id: customer, name: 'Гость', points: 0 };
  }

  const id = customer._id ?? customer.id;

  if (!id) {
    return null;
  }

  return {
    _id: String(id),
    name: customer.name ?? 'Гость',
    phone: customer.phone ? String(customer.phone) : undefined,
    points: typeof customer.points === 'number' ? customer.points : 0,
  };
};

const buildOrderState = (order: any): Partial<OrderState> => {
  if (!order) {
    return {
      orderId: null,
      items: [],
      subtotal: 0,
      discount: 0,
      manualDiscount: 0,
      total: 0,
      status: null,
      customerId: null,
      customer: null,
      appliedDiscounts: [],
      orderTag: null,
    };
  }

  const customer = mapCustomer(order.customerId);
  const appliedDiscounts = mapAppliedDiscounts(order.appliedDiscounts);

  return {
    orderId: order._id ? String(order._id) : null,
    items: mapOrderItems(order.items),
    subtotal: typeof order.subtotal === 'number' ? order.subtotal : 0,
    discount: typeof order.discount === 'number' ? order.discount : 0,
    manualDiscount: typeof order.manualDiscount === 'number' ? order.manualDiscount : 0,
    total: typeof order.total === 'number' ? order.total : 0,
    status: parseStatus(order.status),
    customerId: customer?._id ?? null,
    customer,
    appliedDiscounts,
    orderTag: order.orderTag === 'takeaway' || order.orderTag === 'delivery' ? order.orderTag : null,
  };
};

const mapOrderHistoryEntry = (order: any): OrderHistoryEntry | null => {
  if (!order || typeof order !== 'object') {
    return null;
  }

  const status: OrderHistoryEntry['status'] | null =
    order.status === 'paid' || order.status === 'completed' || order.status === 'cancelled'
      ? order.status
      : null;
  if (!status) {
    return null;
  }
  const createdAtValue =
    typeof order.createdAt === 'string'
      ? order.createdAt
      : order.createdAt instanceof Date
        ? order.createdAt.toISOString()
        : new Date().toISOString();

  const orderId = order._id ?? order.id;
  const historyEntry: OrderHistoryEntry = {
    _id:
      orderId
        ? String(orderId)
        : `history-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    total: typeof order.total === 'number' ? order.total : 0,
    status,
    createdAt: createdAtValue,
    items: mapOrderItems(order.items),
    customer: mapCustomer(order.customerId),
  };

  const paymentMethod = order.payment?.method;
  if (paymentMethod === 'cash' || paymentMethod === 'card') {
    historyEntry.paymentMethod = paymentMethod;
  }

  return historyEntry;
};

export const useOrderStore = create<OrderState>((set, get) => ({
  orderId: null,
  items: [],
  subtotal: 0,
  discount: 0,
  manualDiscount: 0,
  total: 0,
  status: null,
  customerId: null,
  customer: null,
  orderTag: null,
  loading: false,
  activeOrders: [],
  appliedDiscounts: [],
  availableDiscounts: [],
  selectedDiscountIds: [],
  shiftHistory: [],
  shiftHistoryLoading: false,
  async createDraft(options) {
    const state = get();
    const forceNew = Boolean(options?.forceNew);
    if (state.orderId && !forceNew) return;

    if (state.orderId && forceNew) {
      state.reset();
    }

    const auth = useAuthStore.getState();
    if (!auth.user) {
      throw new Error('Не удалось определить кассира');
    }

    set({ loading: true });
    try {
      const response = await api.post('/api/orders/start', {
        ...DEFAULT_POS_CONTEXT,
      });
      const nextState = buildOrderState(response.data.data);
      const selectedDiscountIds = extractSelectedDiscountIds(nextState.appliedDiscounts ?? []);
      set((prev) => ({
        ...prev,
        ...nextState,
        selectedDiscountIds,
      }));

      void get().fetchActiveOrders();
    } finally {
      set({ loading: false });
    }
  },
  async addProduct(product, modifiers) {
    const state = get();
    if (!state.orderId) {
      await state.createDraft();
    }

    const priceAdjustment = modifiers?.reduce(
      (acc, modifier) => acc + modifier.options.reduce((sum, option) => sum + option.priceChange, 0),
      0
    );
    const costAdjustment = modifiers?.reduce(
      (acc, modifier) => acc + modifier.options.reduce((sum, option) => sum + option.costChange, 0),
      0
    );

    const unitPrice = roundCurrency(product.price + (priceAdjustment ?? 0));
    const unitCost = roundCurrency((product.costPrice ?? 0) + (costAdjustment ?? 0));
    const lineId = buildLineId(product._id, modifiers);

    const currentItems = get().items;
    const existing = currentItems.find((item) => item.lineId === lineId);
    const updatedItems = existing
      ? currentItems.map((item) =>
          item.lineId === lineId
            ? {
                ...item,
                qty: item.qty + 1,
                total: roundCurrency((item.qty + 1) * unitPrice),
              }
            : item
        )
      : [
          ...currentItems,
          {
            lineId,
            productId: product._id,
            name: product.name,
            price: unitPrice,
            costPrice: unitCost,
            qty: 1,
            total: roundCurrency(unitPrice),
            modifiersApplied: modifiers,
          },
        ];

    await get().syncItems(updatedItems);
  },
  async updateItemQty(lineId, qty) {
    const updatedItems = get()
      .items.map((item) =>
        item.lineId === lineId ? { ...item, qty, total: roundCurrency(qty * item.price) } : item
      )
      .filter((item) => item.qty > 0);

    await get().syncItems(updatedItems);
  },
  async removeItem(lineId) {
    const updatedItems = get().items.filter((item) => item.lineId !== lineId);
    await get().syncItems(updatedItems);
  },
  async attachCustomer(customer) {
    const customerId = customer?._id ?? null;

    set({
      customerId,
      customer: customer ? { ...customer, points: Number(customer.points ?? 0) } : null,
    });

    if (!get().orderId) {
      if (!customer) {
        set({ discount: 0, manualDiscount: 0, appliedDiscounts: [], selectedDiscountIds: [] });
      }
      return;
    }

    const manualOverride = customer ? get().manualDiscount : 0;
    if (!customer) {
      set({ manualDiscount: 0 });
    }

    await get().syncItems(get().items, { manualDiscount: manualOverride, customerId });
  },
  async payOrder({ method, amountTendered, change }) {
    const { orderId, total } = get();
    if (!orderId) {
      throw new Error('Нет активного заказа для оплаты');
    }

    const normalizedChange = method === 'cash' ? roundCurrency(change ?? amountTendered - total) : undefined;

    set({ loading: true });
    try {
      const response = await api.post(`/api/orders/${orderId}/pay`, {
        method,
        amount: amountTendered,
        change: normalizedChange,
      });
      const nextState = buildOrderState(response.data.data);
      const selectedDiscountIds = extractSelectedDiscountIds(nextState.appliedDiscounts ?? []);
      set((prev) => ({
        ...prev,
        ...nextState,
        selectedDiscountIds,
      }));

      try {
        await api.post('/api/evotor/sale-commands', { orderId });
      } catch (error) {
        console.warn('Failed to enqueue Evotor sale command', error);
      }

      void get().fetchActiveOrders();
    } finally {
      set({ loading: false });
    }
  },
  async completeOrder() {
    const { orderId } = get();
    if (!orderId) {
      return;
    }

    set({ loading: true });
    try {
      await api.post(`/api/orders/${orderId}/complete`);
      get().reset();
      void get().fetchActiveOrders();
    } finally {
      set({ loading: false });
    }
  },
  async cancelOrder() {
    const { orderId } = get();
    if (!orderId) {
      return;
    }

    set({ loading: true });
    try {
      await api.delete(`/api/orders/${orderId}`);
      get().reset();
      void get().fetchActiveOrders();
    } finally {
      set({ loading: false });
    }
  },
  async cancelReceipt(orderId) {
    if (!orderId) {
      return;
    }

    set({ loading: true });
    try {
      await api.post(`/api/orders/${orderId}/cancel`);
      if (get().orderId === orderId) {
        get().reset();
      }
      void get().fetchShiftHistory().catch(() => undefined);
      void get().fetchActiveOrders();
    } finally {
      set({ loading: false });
    }
  },
  reset() {
    set({
      orderId: null,
      items: [],
      subtotal: 0,
      discount: 0,
      manualDiscount: 0,
      total: 0,
      status: null,
      customerId: null,
      customer: null,
      orderTag: null,
      loading: false,
      appliedDiscounts: [],
      selectedDiscountIds: [],
    });
  },
  async syncItems(
    updatedItems: OrderItem[],
    options: { manualDiscount?: number; customerId?: string | null; discountIds?: string[]; orderTag?: OrderTag | null } = {}
  ) {
    const { orderId } = get();
    if (!orderId) return;

    const manualDiscountOverride =
      options && typeof options.manualDiscount === 'number' && !Number.isNaN(options.manualDiscount)
        ? options.manualDiscount
        : get().manualDiscount;
    const customerId = options && options.customerId !== undefined ? options.customerId : get().customerId;
    const discountIds = options && Array.isArray(options.discountIds)
      ? options.discountIds
      : get().selectedDiscountIds;
    const requestedOrderTag =
      options && Object.prototype.hasOwnProperty.call(options, 'orderTag')
        ? options.orderTag ?? null
        : get().orderTag;
    const normalizedOrderTag =
      requestedOrderTag === 'takeaway' || requestedOrderTag === 'delivery' ? requestedOrderTag : null;

    const payload = {
      items: updatedItems.map((item) => ({
        productId: item.productId,
        qty: item.qty,
        modifiersApplied: mapModifiersToPayload(item.modifiersApplied),
      })),
      manualDiscount: manualDiscountOverride,
      discountIds,
      customerId,
      orderTag: normalizedOrderTag,
    };

    set({ loading: true });
    try {
      const response = await api.post(`/api/orders/${orderId}/items`, payload);
      const nextState = buildOrderState(response.data.data);
      const selectedDiscountIds = extractSelectedDiscountIds(nextState.appliedDiscounts ?? []);
      const resolvedItems =
        (nextState.items && nextState.items.length > 0 ? nextState.items : updatedItems) ?? [];
      set((prev) => ({
        ...prev,
        ...nextState,
        items: resolvedItems,
        selectedDiscountIds,
      }));
      void get().fetchActiveOrders();
    } finally {
      set({ loading: false });
    }
  },
  async setOrderTag(tag) {
    const previousTag = get().orderTag;
    set({ orderTag: tag });
    const { orderId } = get();
    if (!orderId) {
      return;
    }

    try {
      await get().syncItems(get().items, { orderTag: tag });
    } catch (error) {
      set({ orderTag: previousTag });
      throw error;
    }
  },
  async fetchActiveOrders() {
    const response = await api.get('/api/orders/active');
    const orders = Array.isArray(response.data.data)
      ? response.data.data.map((order: any) => ({
          _id: order._id,
          total: order.total ?? 0,
          status: order.status,
          updatedAt: order.updatedAt,
          orderTag: order.orderTag === 'takeaway' || order.orderTag === 'delivery' ? order.orderTag : null,
        }))
      : [];
    set({ activeOrders: orders });
  },
  async loadOrder(orderId) {
    if (!orderId) {
      return;
    }

    set({ loading: true });
    try {
      const response = await api.get(`/api/orders/${orderId}`);
      const nextState = buildOrderState(response.data.data);
      const selectedDiscountIds = extractSelectedDiscountIds(nextState.appliedDiscounts ?? []);
      set((prev) => ({
        ...prev,
        ...nextState,
        selectedDiscountIds,
      }));
    } finally {
      set({ loading: false });
    }
  },
  async redeemPoints(points, options) {
    const { customer, customerId, orderId, subtotal, discount, manualDiscount } = get();

    if (!orderId || !customerId || !customer) {
      throw new Error('Нет клиента для списания баллов');
    }

    if (typeof points !== 'number' || Number.isNaN(points) || points <= 0) {
      throw new Error('Укажите количество баллов для списания');
    }

    const minimumPayable = subtotal >= 1 ? 1 : subtotal;
    const remainingTotal = Math.max(subtotal - discount - minimumPayable, 0);
    const cappedMax =
      typeof options?.maxAmount === 'number' && Number.isFinite(options.maxAmount)
        ? Math.min(options.maxAmount, remainingTotal)
        : remainingTotal;
    if (points > cappedMax) {
      throw new Error('Баллы превышают сумму заказа');
    }

    const remainingPoints = Math.max(customer.points - manualDiscount, 0);
    if (points > remainingPoints) {
      throw new Error('Недостаточно баллов у клиента');
    }

    set({ loading: true });
    try {
      const newManualDiscount = roundCurrency(manualDiscount + points);

      set({ manualDiscount: newManualDiscount });

      await get().syncItems(get().items, { manualDiscount: newManualDiscount, customerId });
    } finally {
      set({ loading: false });
    }
  },
  async clearDiscount() {
    const { orderId } = get();

    if (!orderId) {
      set({ discount: 0, manualDiscount: 0, selectedDiscountIds: [], appliedDiscounts: [] });
      return;
    }

    set({ manualDiscount: 0, selectedDiscountIds: [] });
    await get().syncItems(get().items, { manualDiscount: 0, discountIds: [] });
  },
  async fetchAvailableDiscounts() {
    try {
      const response = await api.get('/api/orders/discounts/available');
      const discounts = mapDiscountSummaries(response.data?.data);
      set({ availableDiscounts: discounts });
    } catch (error) {
      console.error('Не удалось загрузить скидки', error);
      set({ availableDiscounts: [] });
    }
  },
  async toggleDiscount(discountId) {
    if (!discountId) {
      return;
    }

    const state = get();
    const current = state.selectedDiscountIds;
    const hasDiscount = current.includes(discountId);
    const nextSelection = hasDiscount
      ? current.filter((id) => id !== discountId)
      : [...current, discountId];

    set({ selectedDiscountIds: nextSelection });

    try {
      await state.syncItems(state.items, { discountIds: nextSelection });
    } catch (error) {
      set({ selectedDiscountIds: current });
      throw error;
    }
  },
  async fetchShiftHistory(options) {
    const registerId = options?.registerId ?? DEFAULT_POS_CONTEXT.registerId;
    set({ shiftHistoryLoading: true });
    try {
      const response = await api.get('/api/orders/history/current-shift', {
        params: { registerId },
      });
      const payload = Array.isArray(response.data?.data) ? response.data.data : [];
      const mapped = payload
        .map((entry: unknown) => mapOrderHistoryEntry(entry))
        .filter((entry: OrderHistoryEntry | null | undefined): entry is OrderHistoryEntry => Boolean(entry));
      set({ shiftHistory: mapped });
    } catch (error) {
      set({ shiftHistory: [] });
      throw error;
    } finally {
      set({ shiftHistoryLoading: false });
    }
  },
  resetShiftHistory() {
    set({ shiftHistory: [] });
  },
}));
