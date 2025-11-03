import { create } from 'zustand';
import api from '../lib/api';
import type { Product } from './catalog';

export type OrderItem = {
  productId: string;
  name: string;
  qty: number;
  price: number;
  total: number;
};

type Totals = {
  subtotal: number;
  discount?: number;
  tax?: number;
  grandTotal: number;
};

type OrderState = {
  orderId: string | null;
  items: OrderItem[];
  totals: Totals;
  customerId: string | null;
  loading: boolean;
  createDraft: () => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  updateItemQty: (productId: string, qty: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  attachCustomer: (customerId: string | null) => void;
  payOrder: () => Promise<void>;
  reset: () => void;
  syncItems: (items: OrderItem[]) => Promise<void>;
};

const emptyTotals: Totals = {
  subtotal: 0,
  grandTotal: 0,
};

export const useOrderStore = create<OrderState>((set, get) => ({
  orderId: null,
  items: [],
  totals: emptyTotals,
  customerId: null,
  loading: false,
  async createDraft() {
    if (get().orderId) return;
    set({ loading: true });
    try {
      const response = await api.post('/api/orders', {
        items: [],
        totals: emptyTotals,
      });
      set({ orderId: response.data.data._id });
    } finally {
      set({ loading: false });
    }
  },
  async addProduct(product) {
    const state = get();
    if (!state.orderId) {
      await state.createDraft();
    }
    const existing = state.items.find((item) => item.productId === product._id);
    const updatedItems = existing
      ? state.items.map((item) =>
          item.productId === product._id
            ? { ...item, qty: item.qty + 1, total: (item.qty + 1) * item.price }
            : item
        )
      : [
          ...state.items,
          { productId: product._id, name: product.name, price: product.price, qty: 1, total: product.price },
        ];

    await get().syncItems(updatedItems);
  },
  async updateItemQty(productId, qty) {
    const state = get();
    const updatedItems = state.items
      .map((item) => (item.productId === productId ? { ...item, qty, total: qty * item.price } : item))
      .filter((item) => item.qty > 0);
    await get().syncItems(updatedItems);
  },
  async removeItem(productId) {
    const state = get();
    const updatedItems = state.items.filter((item) => item.productId !== productId);
    await get().syncItems(updatedItems);
  },
  attachCustomer(customerId) {
    set({ customerId });
  },
  async payOrder() {
    const { orderId, customerId } = get();
    if (!orderId) return;
    await api.post(`/api/orders/${orderId}/pay`, { payments: [{ method: 'cash', amount: get().totals.grandTotal }] });
    if (customerId) {
      await api.post('/api/loyalty/earn', {
        customerId,
        orderId,
        amount: get().totals.grandTotal,
      });
    }
    set({ orderId: null, items: [], totals: emptyTotals, customerId: null });
  },
  reset() {
    set({ orderId: null, items: [], totals: emptyTotals, customerId: null });
  },
  async syncItems(updatedItems: OrderItem[]) {
    const { orderId } = get();
    if (!orderId) return;
    const totals = updatedItems.reduce(
      (acc, item) => {
        acc.subtotal += item.total;
        acc.grandTotal += item.total;
        return acc;
      },
      { subtotal: 0, grandTotal: 0 } as Totals
    );
    const response = await api.put(`/api/orders/${orderId}/items`, {
      items: updatedItems.map((item) => ({
        productId: item.productId,
        qty: item.qty,
        price: item.price,
      })),
    });
    set({ items: updatedItems, totals: response.data.data.totals ?? totals });
  },
}));
