import { create } from 'zustand';

import api from '../lib/api';
import type { Product } from './catalog';
import { useAuthStore } from './auth';

export type CustomerSummary = {
  _id: string;
  name: string;
  phone?: string;
  points: number;
};

export type PaymentMethod = 'cash' | 'card';

export type OrderItem = {
  productId: string;
  name: string;
  qty: number;
  price: number;
  total: number;
  modifiersApplied?: string[];
};

export type ActiveOrder = {
  _id: string;
  total: number;
  status: 'draft' | 'paid';
  updatedAt: string;
};

type OrderState = {
  orderId: string | null;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'draft' | 'paid' | 'completed' | null;
  customerId: string | null;
  customer: CustomerSummary | null;
  loading: boolean;
  activeOrders: ActiveOrder[];
  createDraft: () => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateItemQty: (productId: string, qty: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  attachCustomer: (customer: CustomerSummary | null) => Promise<void>;
  payOrder: (payload: { method: PaymentMethod; amountTendered: number; change?: number }) => Promise<void>;
  completeOrder: () => Promise<void>;
  cancelOrder: () => Promise<void>;
  reset: () => void;
  syncItems: (items: OrderItem[], discount?: number, customerOverride?: string | null) => Promise<void>;
  fetchActiveOrders: () => Promise<void>;
  loadOrder: (orderId: string) => Promise<void>;
  redeemPoints: (points: number) => Promise<void>;
  clearDiscount: () => Promise<void>;
};

const DEFAULT_CONTEXT = {
  orgId: 'yago-coffee',
  locationId: 'main-store',
  registerId: 'front-register',
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const mapOrderItems = (items: any[] | undefined): OrderItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => ({
    productId: String(
      typeof item.productId === 'object' && item.productId
        ? item.productId._id ?? item.productId
        : item.productId ?? item._id ?? ''
    ),
    name: item.name,
    price: item.price,
    qty: item.qty,
    total: item.total,
    modifiersApplied: item.modifiersApplied,
  }));
};

const parseStatus = (status: unknown): OrderState['status'] => {
  if (status === 'draft' || status === 'paid' || status === 'completed') {
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
      total: 0,
      status: null,
      customerId: null,
      customer: null,
    };
  }

  const customer = mapCustomer(order.customerId);

  return {
    orderId: order._id ? String(order._id) : null,
    items: mapOrderItems(order.items),
    subtotal: typeof order.subtotal === 'number' ? order.subtotal : 0,
    discount: typeof order.discount === 'number' ? order.discount : 0,
    total: typeof order.total === 'number' ? order.total : 0,
    status: parseStatus(order.status),
    customerId: customer?._id ?? null,
    customer,
  };
};

export const useOrderStore = create<OrderState>((set, get) => ({
  orderId: null,
  items: [],
  subtotal: 0,
  discount: 0,
  total: 0,
  status: null,
  customerId: null,
  customer: null,
  loading: false,
  activeOrders: [],
  async createDraft() {
    const state = get();
    if (state.orderId) return;

    const auth = useAuthStore.getState();
    if (!auth.user) {
      throw new Error('Не удалось определить кассира');
    }

    set({ loading: true });
    try {
      const response = await api.post('/api/orders/start', {
        ...DEFAULT_CONTEXT,
      });
      set(buildOrderState(response.data.data));
      void get().fetchActiveOrders();
    } finally {
      set({ loading: false });
    }
  },
  async addProduct(product) {
    const state = get();
    if (!state.orderId) {
      await state.createDraft();
    }

    const currentItems = get().items;
    const existing = currentItems.find((item) => item.productId === product._id);
    const updatedItems = existing
      ? currentItems.map((item) =>
          item.productId === product._id
            ? {
                ...item,
                qty: item.qty + 1,
                total: roundCurrency((item.qty + 1) * item.price),
              }
            : item
        )
      : [
          ...currentItems,
          {
            productId: product._id,
            name: product.name,
            price: product.price,
            qty: 1,
            total: roundCurrency(product.price),
          },
        ];

    await get().syncItems(updatedItems, get().discount);
  },
  async updateItemQty(productId, qty) {
    const updatedItems = get()
      .items.map((item) =>
        item.productId === productId
          ? { ...item, qty, total: roundCurrency(qty * item.price) }
          : item
      )
      .filter((item) => item.qty > 0);

    await get().syncItems(updatedItems, get().discount);
  },
  async removeItem(productId) {
    const updatedItems = get().items.filter((item) => item.productId !== productId);
    await get().syncItems(updatedItems, get().discount);
  },
  async attachCustomer(customer) {
    const customerId = customer?._id ?? null;
    const discount = customer ? get().discount : 0;

    set({
      customerId,
      customer: customer ? { ...customer, points: Number(customer.points ?? 0) } : null,
    });

    if (!get().orderId) {
      if (!customer) {
        set({ discount: 0 });
      }
      return;
    }

    await get().syncItems(get().items, discount, customerId);
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
      set(buildOrderState(response.data.data));
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
      await get().createDraft();
      return;
    }

    set({ loading: true });
    try {
      await api.delete(`/api/orders/${orderId}`);
      get().reset();
      void get().fetchActiveOrders();
      await get().createDraft();
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
      total: 0,
      status: null,
      customerId: null,
      customer: null,
      loading: false,
    });
  },
  async syncItems(updatedItems: OrderItem[], discountValue, customerOverride) {
    const { orderId } = get();
    if (!orderId) return;

    const effectiveDiscount =
      typeof discountValue === 'number' && !Number.isNaN(discountValue)
        ? discountValue
        : get().discount;
    const customerId =
      customerOverride !== undefined ? customerOverride : get().customerId;

    const payload = {
      items: updatedItems.map((item) => ({
        productId: item.productId,
        qty: item.qty,
        modifiersApplied: item.modifiersApplied,
      })),
      discount: effectiveDiscount,
      customerId,
    };

    set({ loading: true });
    try {
      const response = await api.post(`/api/orders/${orderId}/items`, payload);
      set(buildOrderState(response.data.data));
      void get().fetchActiveOrders();
    } finally {
      set({ loading: false });
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
      set(buildOrderState(response.data.data));
    } finally {
      set({ loading: false });
    }
  },
  async redeemPoints(points) {
    const { customer, customerId, orderId, subtotal, discount } = get();

    if (!orderId || !customerId || !customer) {
      throw new Error('Нет клиента для списания баллов');
    }

    if (typeof points !== 'number' || Number.isNaN(points) || points <= 0) {
      throw new Error('Укажите количество баллов для списания');
    }

    const remainingTotal = Math.max(subtotal - discount, 0);
    if (points > remainingTotal) {
      throw new Error('Баллы превышают сумму заказа');
    }

    if (points > customer.points) {
      throw new Error('Недостаточно баллов у клиента');
    }

    set({ loading: true });
    try {
      const response = await api.post('/api/loyalty/redeem', { customerId, points });
      const updatedCustomer = mapCustomer(response.data.data?.customer) ?? {
        ...customer,
        points: customer.points - points,
      };

      set({ customer: updatedCustomer });

      const newDiscount = roundCurrency(discount + points);
      await get().syncItems(get().items, newDiscount, customerId);
    } finally {
      set({ loading: false });
    }
  },
  async clearDiscount() {
    const { orderId, discount } = get();

    if (!orderId) {
      set({ discount: 0 });
      return;
    }

    if (discount <= 0) {
      set({ discount: 0 });
      return;
    }

    await get().syncItems(get().items, 0);
  },
}));
