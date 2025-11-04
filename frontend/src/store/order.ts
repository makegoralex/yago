import { create } from 'zustand';

import api from '../lib/api';
import type { Product } from './catalog';
import { useAuthStore } from './auth';

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
  loading: boolean;
  activeOrders: ActiveOrder[];
  createDraft: () => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateItemQty: (productId: string, qty: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  attachCustomer: (customerId: string | null) => Promise<void>;
  payOrder: (payload: { method: PaymentMethod; amountTendered: number; change?: number }) => Promise<void>;
  completeOrder: () => Promise<void>;
  reset: () => void;
  syncItems: (items: OrderItem[], discount?: number) => Promise<void>;
  fetchActiveOrders: () => Promise<void>;
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

export const useOrderStore = create<OrderState>((set, get) => ({
  orderId: null,
  items: [],
  subtotal: 0,
  discount: 0,
  total: 0,
  status: null,
  customerId: null,
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
      const order = response.data.data;
      set({
        orderId: order._id,
        status: order.status,
        items: mapOrderItems(order.items),
        subtotal: order.subtotal ?? 0,
        discount: order.discount ?? 0,
        total: order.total ?? 0,
      });
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
  async attachCustomer(customerId) {
    set({ customerId });
    if (!get().orderId) {
      return;
    }
    await get().syncItems(get().items, get().discount);
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
      const order = response.data.data;
      set({
        status: order.status,
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
      });
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
  reset() {
    set({
      orderId: null,
      items: [],
      subtotal: 0,
      discount: 0,
      total: 0,
      status: null,
      customerId: null,
      loading: false,
    });
  },
  async syncItems(updatedItems: OrderItem[], discountValue = 0) {
    const { orderId, customerId } = get();
    if (!orderId) return;

    const payload = {
      items: updatedItems.map((item) => ({
        productId: item.productId,
        qty: item.qty,
        modifiersApplied: item.modifiersApplied,
      })),
      discount: discountValue,
      customerId,
    };

    set({ loading: true });
    try {
      const response = await api.post(`/api/orders/${orderId}/items`, payload);
      const order = response.data.data;
      set({
        items: mapOrderItems(order.items),
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
        status: order.status,
        customerId: order.customerId ? String(order.customerId) : null,
      });
    } finally {
      set({ loading: false });
    }
  },
  async fetchActiveOrders() {
    set({ loading: true });
    try {
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
    } finally {
      set({ loading: false });
    }
  },
}));
