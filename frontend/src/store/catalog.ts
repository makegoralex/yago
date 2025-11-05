import { create } from 'zustand';
import api from '../lib/api';

export type Category = {
  _id: string;
  name: string;
  sortOrder?: number;
};

export type Product = {
  _id: string;
  name: string;
  categoryId: string;
  price: number;
  modifiers?: string[];
  isActive?: boolean;
};

type CatalogState = {
  categories: Category[];
  products: Product[];
  activeCategoryId: string | null;
  loading: boolean;
  fetchCatalog: () => Promise<void>;
  setActiveCategory: (categoryId: string | null) => void;
};

export const useCatalogStore = create<CatalogState>((set, get) => ({
  categories: [],
  products: [],
  activeCategoryId: null,
  loading: false,
  async fetchCatalog() {
    if (get().loading) return;
    set({ loading: true });
    try {
      const [categoriesRes, productsRes] = await Promise.all([
        api.get('/api/catalog/categories'),
        api.get('/api/catalog/products'),
      ]);
      set({
        categories: categoriesRes.data.data || [],
        products: productsRes.data.data || [],
      });
    } finally {
      set({ loading: false });
    }
  },
  setActiveCategory(categoryId) {
    set({ activeCategoryId: categoryId });
  },
}));
