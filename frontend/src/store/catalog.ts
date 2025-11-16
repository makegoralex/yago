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
  ingredients?: Array<{ ingredientId: string; quantity: number }>;
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
        products: (productsRes.data.data || []).filter((product: Product) => product.isActive !== false),
      });
    } finally {
      set({ loading: false });
    }
  },
  setActiveCategory(categoryId) {
    set({ activeCategoryId: categoryId });
  },
}));
