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

    try {
      const response = await api.get<{ data?: { categories?: Category[]; products?: Product[] } }>('/api/catalog/pos', {
        timeout: 20000,
      });
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
