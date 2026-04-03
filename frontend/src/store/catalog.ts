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
    const maxAttempts = 2;
    const backoffMs = [500];
    const pageLimit = 150;
    const requestTimeoutMs = 12000;

    try {
      type CatalogResponse = {
        data?: {
          categories?: Category[];
          products?: Product[];
          pagination?: {
            hasMore?: boolean;
            nextOffset?: number | null;
          } | null;
        };
      };

      const normalizeProducts = (products: Product[]) =>
        products
          .filter((product: Product) => product.isActive !== false)
          .map((product: Product) => ({
            ...product,
            price: typeof product.basePrice === 'number' ? product.basePrice : product.price ?? 0,
          }));

      const requestCatalog = async (params?: { limit?: number; offset?: number }) => {
        let response: Awaited<ReturnType<typeof api.get<CatalogResponse>>> | null = null;
        let lastError: unknown;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          try {
            response = await api.get<CatalogResponse>('/api/catalog/pos', {
              params,
              timeout: requestTimeoutMs,
            });
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
        const pagination = payload.pagination ?? null;

        return { categories, products, pagination };
      };

      try {
        const fullCatalog = await requestCatalog();
        set({
          categories: fullCatalog.categories,
          products: normalizeProducts(fullCatalog.products),
          error: null,
          loading: false,
        });
        return;
      } catch {
        // fallback ниже: частями, чтобы интерфейс не "висел" на медленных устройствах
      }

      const firstPage = await requestCatalog({ limit: pageLimit, offset: 0 });
      const categories = firstPage.categories;
      let loadedProducts = [...firstPage.products];

      let hasMore = Boolean(firstPage.pagination?.hasMore);
      let nextOffset = typeof firstPage.pagination?.nextOffset === 'number' ? firstPage.pagination.nextOffset : null;
      let pagesLoaded = 1;
      const maxPages = 50;

      set({
        categories,
        products: normalizeProducts(loadedProducts),
        error: null,
        loading: false,
      });

      while (hasMore && typeof nextOffset === 'number' && pagesLoaded < maxPages) {
        try {
          const page = await requestCatalog({ limit: pageLimit, offset: nextOffset });
          loadedProducts = [...loadedProducts, ...page.products];
          hasMore = Boolean(page.pagination?.hasMore);
          nextOffset = typeof page.pagination?.nextOffset === 'number' ? page.pagination.nextOffset : null;
          pagesLoaded += 1;

          set({
            products: normalizeProducts(loadedProducts),
            error: null,
          });
        } catch {
          break;
        }
      }
    } catch {
      set({
        categories: [],
        products: [],
        error: 'Не удалось загрузить каталог. Проверьте интернет и попробуйте снова.',
      });
    } finally {
      if (get().loading) {
        set({ loading: false });
      }
    }
  },
  setActiveCategory(categoryId) {
    set({ activeCategoryId: categoryId });
  },
}));
