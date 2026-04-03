import { create } from 'zustand';
import api from '../lib/api';

export type Category = {
  _id: string;
  name: string;
  sortOrder?: number;
};

export type ModifierOption = {
  _id: string;
  name: string;
  priceChange?: number;
  costChange?: number;
};

export type ModifierGroup = {
  _id: string;
  name: string;
  selectionType: 'single' | 'multiple';
  required: boolean;
  sortOrder?: number;
  options: ModifierOption[];
};

export type Product = {
  _id: string;
  name: string;
  categoryId: string;
  description?: string;
  imageUrl?: string;
  basePrice?: number;
  costPrice?: number;
  price: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  modifierGroups?: ModifierGroup[];
  isActive?: boolean;
  ingredients?: Array<{ ingredientId: string; quantity: number; unit?: string }>;
};

type CatalogState = {
  categories: Category[];
  products: Product[];
  activeCategoryId: string | null;
  loading: boolean;
  error: string | null;
  fetchCatalog: () => Promise<void>;
  setActiveCategory: (categoryId: string | null) => void;
};

export const useCatalogStore = create<CatalogState>((set, get) => ({
  categories: [],
  products: [],
  activeCategoryId: null,
  loading: false,
  error: null,
  async fetchCatalog() {
    if (get().loading) return;
    set({ loading: true, error: null });

    const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    const maxAttempts = 3;
    const backoffMs = [500, 1200];

    try {
      let response: Awaited<ReturnType<typeof api.get<{ data?: { categories?: Category[]; products?: Product[] } }>>> | null = null;
      let lastError: unknown;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          response = await api.get('/api/catalog/pos', { timeout: 8000 });
          break;
        } catch (error) {
          lastError = error;

          if (attempt < maxAttempts - 1) {
            await sleep(backoffMs[attempt] ?? backoffMs[backoffMs.length - 1]);
          }
        }
      }

      if (!response) {
        throw lastError ?? new Error('Каталог временно недоступен');
      }

      const payload = response.data?.data ?? {};
      const categories = Array.isArray(payload.categories) ? payload.categories : [];
      const products = Array.isArray(payload.products) ? payload.products : [];

      set({
        categories,
        products: products
          .filter((product: Product) => product.isActive !== false)
          .map((product: Product) => ({
            ...product,
            price: typeof product.basePrice === 'number' ? product.basePrice : product.price ?? 0,
          })),
        error: null,
      });
    } catch {
      set({
        categories: [],
        products: [],
        error: 'Не удалось загрузить каталог. Проверьте интернет и попробуйте снова.',
      });
    } finally {
      set({ loading: false });
    }
  },
  setActiveCategory(categoryId) {
    set({ activeCategoryId: categoryId });
  },
}));
