import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../lib/api';
import { useToast } from '../providers/ToastProvider';
import type { Category, Product } from '../store/catalog';

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

const AdminPage: React.FC = () => {
  const { notify } = useToast();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'menu' | 'inventory' | 'suppliers'>('dashboard');
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

  const [menuLoading, setMenuLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
  const [productIngredients, setProductIngredients] = useState<Array<{ ingredientId: string; quantity: string }>>([
    { ingredientId: '', quantity: '' },
  ]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryEditName, setCategoryEditName] = useState('');
  const [categorySortOrder, setCategorySortOrder] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
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
  const [productEditIngredients, setProductEditIngredients] = useState<
    Array<{ ingredientId: string; quantity: string }>
  >([]);
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
      },
    ],
  });

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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerEditForm, setCustomerEditForm] = useState({
    name: '',
    phone: '',
    email: '',
    points: '',
    totalSpent: '',
  });

  const loadDashboard = useCallback(async () => {
    try {
      setLoadingDashboard(true);
      const [summaryRes, dailyRes, productsRes, customersRes] = await Promise.all([
        api.get('/api/reports/summary'),
        api.get('/api/reports/daily'),
        api.get('/api/reports/top-products'),
        api.get('/api/reports/top-customers'),
      ]);
      setSummary(summaryRes.data.data);
      setDaily(dailyRes.data.data);
      setTopProducts(productsRes.data.data);
      setTopCustomers(customersRes.data.data);
    } catch (error) {
      notify({ title: 'Не удалось загрузить отчеты', type: 'error' });
    } finally {
      setLoadingDashboard(false);
    }
  }, [notify]);

  const loadMenuData = useCallback(async () => {
    setMenuLoading(true);
    try {
      try {
        const response = await api.get('/api/admin/catalog');
        const payload = getResponseData<{
          categories?: Category[];
          products?: Product[];
          ingredients?: Ingredient[];
        }>(response);

        setCategories(payload?.categories ?? []);
        setProducts(payload?.products ?? []);
        setIngredients(payload?.ingredients ?? []);
        return;
      } catch (primaryError) {
        console.warn('Админский агрегированный каталог недоступен, выполняем поэлементную загрузку', primaryError);
        const [categoriesRes, productsRes, ingredientsRes] = await Promise.all([
          api.get('/api/catalog/categories'),
          api.get('/api/catalog/products', { params: { includeInactive: true } }),
          api.get('/api/catalog/ingredients'),
        ]);

        setCategories(getResponseData<Category[]>(categoriesRes) ?? []);
        setProducts(getResponseData<Product[]>(productsRes) ?? []);
        setIngredients(getResponseData<Ingredient[]>(ingredientsRes) ?? []);
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

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
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
    }

    if (activeTab === 'suppliers') {
      if (!suppliersLoading && suppliers.length === 0) {
        void loadSuppliersData();
      }
      if (!customersLoading && customers.length === 0) {
        void loadCustomers();
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
  ]);

  const loyaltySummary = useMemo<LoyaltyPointSummary>(() => ({
    totalPointsIssued: summary.totalPointsIssued,
    totalPointsRedeemed: summary.totalPointsRedeemed,
  }), [summary.totalPointsIssued, summary.totalPointsRedeemed]);

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
    setProductIngredients((prev) => [...prev, { ingredientId: '', quantity: '' }]);
  };

  const handleIngredientChange = (index: number, field: 'ingredientId' | 'quantity', value: string) => {
    setProductIngredients((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
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

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
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
        ? product.ingredients.map((entry) => ({
            ingredientId: entry.ingredientId,
            quantity: entry.quantity.toString(),
          }))
        : []
    );
  };

  const handleEditIngredientChange = (
    index: number,
    field: 'ingredientId' | 'quantity',
    value: string
  ) => {
    setProductEditIngredients((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addEditIngredientRow = () => {
    setProductEditIngredients((prev) => [...prev, { ingredientId: '', quantity: '' }]);
  };

  const removeEditIngredientRow = (index: number) => {
    setProductEditIngredients((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
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
      .map((item) => ({ ingredientId: item.ingredientId, quantity: Number(item.quantity) }));

    if (normalizedIngredients.length) {
      payload.ingredients = normalizedIngredients;
    } else {
      payload.ingredients = [];
    }

    try {
      await api.put(`/api/catalog/products/${selectedProduct._id}`, payload);
      notify({ title: 'Позиция обновлена', type: 'success' });
      await loadMenuData();
      const refreshed = products.find((product) => product._id === selectedProduct._id);
      if (refreshed) {
        handleSelectProduct(refreshed);
      }
    } catch (error) {
      notify({ title: 'Не удалось обновить позицию', type: 'error' });
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
        .map((item) => ({ ingredientId: item.ingredientId, quantity: Number(item.quantity) }));

      if (normalizedIngredients.length) {
        payload.ingredients = normalizedIngredients;
      }

      await api.post('/api/catalog/products', payload);
      notify({ title: 'Позиция добавлена', type: 'success' });
      setNewProduct({ name: '', description: '', categoryId: '', basePrice: '', discountType: '', discountValue: '', imageUrl: '' });
      setProductIngredients([{ ingredientId: '', quantity: '' }]);
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

  const handleSelectWarehouse = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setWarehouseEditForm({
      name: warehouse.name,
      location: warehouse.location ?? '',
      description: warehouse.description ?? '',
    });
  };

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

  const handleReceiptItemChange = (
    index: number,
    field: 'itemType' | 'itemId' | 'quantity' | 'unitCost',
    value: string
  ) => {
    setReceiptForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addReceiptItemRow = () => {
    setReceiptForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { itemType: 'ingredient' as 'ingredient' | 'product', itemId: '', quantity: '', unitCost: '' },
      ],
    }));
  };

  const removeReceiptItemRow = (index: number) => {
    setReceiptForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleCreateReceipt = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!receiptForm.warehouseId) {
      notify({ title: 'Выберите склад', type: 'info' });
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
      await api.post('/api/inventory/receipts', {
        warehouseId: receiptForm.warehouseId,
        supplierId: receiptForm.supplierId || undefined,
        items: payloadItems,
      });
      notify({ title: 'Поставка сохранена', type: 'success' });
      setReceiptForm({
        warehouseId: receiptForm.warehouseId,
        supplierId: receiptForm.supplierId,
        items: [
          {
            itemType: 'ingredient',
            itemId: '',
            quantity: '',
            unitCost: '',
          },
        ],
      });
      await loadInventoryData();
      await loadMenuData();
    } catch (error) {
      notify({ title: 'Не удалось сохранить поставку', type: 'error' });
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

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Админ-панель</h1>
          <p className="text-sm text-slate-500">Управление меню, запасами и поставщиками Yago Coffee</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'dashboard', label: 'Дашборд' },
            { id: 'menu', label: 'Меню' },
            { id: 'inventory', label: 'Склады' },
            { id: 'suppliers', label: 'Поставщики' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 shadow-soft hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

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
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <Card title="Выручка по дням">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 16,
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                        }}
                      />
                      <Bar dataKey="revenue" fill="#10B981" radius={[12, 12, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card title="Топ продукты">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={topProducts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#64748b" />
                      <YAxis type="category" dataKey="name" stroke="#64748b" width={120} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 16,
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                        }}
                      />
                      <Bar dataKey="qty" fill="#3B82F6" radius={[0, 12, 12, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
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
          <section className="grid gap-6 lg:grid-cols-3">
            <Card title="Категории">
              <form onSubmit={handleCreateCategory} className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="Новая категория"
                  className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm"
                />
                <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
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
            <Card title="Новая позиция">
              <form onSubmit={handleCreateProduct} className="space-y-3 text-sm">
                <input
                  type="text"
                  placeholder="Название"
                  value={newProduct.name}
                  onChange={(event) => setNewProduct((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                />
                <textarea
                  placeholder="Описание"
                  value={newProduct.description}
                  onChange={(event) => setNewProduct((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  rows={3}
                />
                <input
                  type="url"
                  placeholder="Ссылка на фото"
                  value={newProduct.imageUrl}
                  onChange={(event) => setNewProduct((prev) => ({ ...prev, imageUrl: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                />
                <select
                  value={newProduct.categoryId}
                  onChange={(event) => setNewProduct((prev) => ({ ...prev, categoryId: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                >
                  <option value="">Категория</option>
                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Базовая цена"
                    value={newProduct.basePrice}
                    onChange={(event) => setNewProduct((prev) => ({ ...prev, basePrice: event.target.value }))}
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                  />
                  <select
                    value={newProduct.discountType}
                    onChange={(event) => setNewProduct((prev) => ({ ...prev, discountType: event.target.value as typeof prev.discountType }))}
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                  >
                    <option value="">Без скидки</option>
                    <option value="percentage">Скидка %</option>
                    <option value="fixed">Фикс. скидка</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Значение скидки"
                    value={newProduct.discountValue}
                    onChange={(event) => setNewProduct((prev) => ({ ...prev, discountValue: event.target.value }))}
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Ингредиенты</p>
                  {productIngredients.map((row, index) => (
                    <div key={index} className="flex gap-2">
                      <select
                        value={row.ingredientId}
                        onChange={(event) => handleIngredientChange(index, 'ingredientId', event.target.value)}
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
                        onChange={(event) => handleIngredientChange(index, 'quantity', event.target.value)}
                        className="w-28 rounded-2xl border border-slate-200 px-3 py-2"
                        placeholder="Кол-во"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    + Добавить ингредиент
                  </button>
                </div>
                <button type="submit" className="w-full rounded-2xl bg-emerald-500 py-2 text-sm font-semibold text-white">
                  Сохранить позицию
                </button>
              </form>
            </Card>
            <Card title="Добавить ингредиент">
              <form onSubmit={handleCreateIngredient} className="space-y-3 text-sm">
                <input name="name" type="text" placeholder="Название" className="w-full rounded-2xl border border-slate-200 px-4 py-2" />
                <input name="unit" type="text" placeholder="Единица (грамм, мл)" className="w-full rounded-2xl border border-slate-200 px-4 py-2" />
                <input name="costPerUnit" type="number" step="0.01" min="0" placeholder="Цена за единицу" className="w-full rounded-2xl border border-slate-200 px-4 py-2" />
                <button type="submit" className="w-full rounded-2xl bg-slate-900 py-2 text-sm font-semibold text-white">
                  Добавить ингредиент
                </button>
              </form>
            </Card>
          </section>

          <Card title="Позиции меню">
            {menuLoading ? (
              <div className="h-32 animate-pulse rounded-2xl bg-slate-200/60" />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-slate-400">
                      <th className="px-3 py-2">Название</th>
                      <th className="px-3 py-2">Категория</th>
                      <th className="px-3 py-2">Цена</th>
                      <th className="px-3 py-2">Себестоимость</th>
                      <th className="px-3 py-2">Скидка</th>
                      <th className="px-3 py-2">Статус</th>
                      <th className="px-3 py-2 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((product) => {
                      const categoryName = categories.find((cat) => cat._id === product.categoryId)?.name || '—';
                      const discountLabel = product.discountType
                        ? product.discountType === 'percentage'
                          ? `${product.discountValue ?? 0}%`
                          : `${product.discountValue?.toFixed(2)} ₽`
                        : '—';
                      return (
                        <tr key={product._id} className="align-middle">
                          <td className="px-3 py-2 font-medium text-slate-800">{product.name}</td>
                          <td className="px-3 py-2 text-slate-500">{categoryName}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={product.basePrice ?? product.price}
                                className="w-24 rounded-xl border border-slate-200 px-2 py-1 text-sm"
                                onBlur={(event) =>
                                  handleProductPriceChange(product._id, { basePrice: Number(event.target.value) })
                                }
                              />
                              <span className="text-sm text-slate-400">({product.price.toFixed(2)} ₽)</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {product.costPrice !== undefined
                              ? `${product.costPrice.toFixed(2)} ₽`
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{discountLabel}</td>
                          <td className="px-3 py-2">
                            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-500">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                checked={product.isActive !== false}
                                onChange={(event) =>
                                  handleProductPriceChange(product._id, { isActive: event.target.checked })
                                }
                              />
                              В продаже
                            </label>
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-slate-400">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleSelectProduct(product)}
                                className="rounded-full bg-white px-3 py-1 font-semibold text-emerald-600 shadow-inner hover:bg-emerald-50"
                              >
                                Настроить
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleProductPriceChange(product._id, {
                                    discountType: null,
                                    discountValue: null,
                                    basePrice: product.basePrice ?? product.price,
                                    price: product.basePrice ?? product.price,
                                  })
                                }
                                className="rounded-full px-3 py-1 transition hover:bg-slate-200"
                              >
                                Сбросить скидку
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
                        onChange={(event) =>
                          setIngredientEditForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        className="rounded-2xl border border-slate-200 px-3 py-2"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase text-slate-400">Единица</label>
                      <input
                        type="text"
                        value={ingredientEditForm.unit}
                        onChange={(event) =>
                          setIngredientEditForm((prev) => ({ ...prev, unit: event.target.value }))
                        }
                        className="rounded-2xl border border-slate-200 px-3 py-2"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase text-slate-400">Стоимость за единицу</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ingredientEditForm.costPerUnit}
                        onChange={(event) =>
                          setIngredientEditForm((prev) => ({ ...prev, costPerUnit: event.target.value }))
                        }
                        className="rounded-2xl border border-slate-200 px-3 py-2"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold uppercase text-slate-400">Поставщик</label>
                      <select
                        value={ingredientEditForm.supplierId}
                        onChange={(event) =>
                          setIngredientEditForm((prev) => ({ ...prev, supplierId: event.target.value }))
                        }
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
                        onChange={(event) =>
                          setIngredientEditForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                        className="rounded-2xl border border-slate-200 px-3 py-2"
                        rows={3}
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-emerald-500 py-2 text-sm font-semibold text-white"
                    >
                      Сохранить ингредиент
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-slate-400">Выберите ингредиент, чтобы скорректировать себестоимость.</p>
                )}
              </div>
            </div>
          </Card>
          <Card title="Настройка выбранной позиции">
            {selectedProduct ? (
              <form onSubmit={handleUpdateProduct} className="grid gap-4 text-sm md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-400">Название</label>
                  <input
                    type="text"
                    value={productEditForm.name}
                    onChange={(event) =>
                      setProductEditForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-400">Категория</label>
                  <select
                    value={productEditForm.categoryId}
                    onChange={(event) =>
                      setProductEditForm((prev) => ({ ...prev, categoryId: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
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
                    value={productEditForm.description}
                    onChange={(event) =>
                      setProductEditForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-400">Изображение</label>
                  <input
                    type="url"
                    value={productEditForm.imageUrl}
                    onChange={(event) =>
                      setProductEditForm((prev) => ({ ...prev, imageUrl: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-400">Базовая цена</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productEditForm.basePrice}
                    onChange={(event) =>
                      setProductEditForm((prev) => ({ ...prev, basePrice: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-400">Тип скидки</label>
                  <select
                    value={productEditForm.discountType}
                    onChange={(event) =>
                      setProductEditForm((prev) => ({ ...prev, discountType: event.target.value as typeof prev.discountType }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  >
                    <option value="">Нет</option>
                    <option value="percentage">Процент</option>
                    <option value="fixed">Фиксированная</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-400">Значение скидки</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productEditForm.discountValue}
                    onChange={(event) =>
                      setProductEditForm((prev) => ({ ...prev, discountValue: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-400">Статус</label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                      checked={productEditForm.isActive}
                      onChange={(event) =>
                        setProductEditForm((prev) => ({ ...prev, isActive: event.target.checked }))
                      }
                    />
                    В продаже
                  </label>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase text-slate-400">Ингредиенты</p>
                    <button
                      type="button"
                      onClick={addEditIngredientRow}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      + Добавить
                    </button>
                  </div>
                  {productEditIngredients.length === 0 ? (
                    <p className="text-xs text-slate-400">Ингредиенты не указаны, позиция считается самостоятельной.</p>
                  ) : null}
                  {productEditIngredients.map((row, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <select
                        value={row.ingredientId}
                        onChange={(event) =>
                          handleEditIngredientChange(index, 'ingredientId', event.target.value)
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
                          handleEditIngredientChange(index, 'quantity', event.target.value)
                        }
                        className="w-28 rounded-2xl border border-slate-200 px-3 py-2"
                        placeholder="Кол-во"
                      />
                      <button
                        type="button"
                        onClick={() => removeEditIngredientRow(index)}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-200"
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
                <div className="md:col-span-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Себестоимость: {selectedProduct.costPrice !== undefined
                      ? `${selectedProduct.costPrice.toFixed(2)} ₽`
                      : '—'}
                  </span>
                  <button
                    type="submit"
                    className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Сохранить изменения
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-xs text-slate-400">Выберите позицию из списка, чтобы изменить описание, цену или состав.</p>
            )}
          </Card>
        </div>
      ) : null}

      {activeTab === 'inventory' ? (
        <div className="space-y-6">
          <section className="grid gap-6 lg:grid-cols-3">
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
                  <button type="submit" className="w-full rounded-2xl bg-emerald-500 py-2 text-sm font-semibold text-white">
                    Сохранить склад
                  </button>
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
            <Card title="Приёмка поставки">
              <form onSubmit={handleCreateReceipt} className="space-y-3 text-sm">
                <select
                  value={receiptForm.warehouseId}
                  onChange={(event) =>
                    setReceiptForm((prev) => ({ ...prev, warehouseId: event.target.value }))
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
                <select
                  value={receiptForm.supplierId}
                  onChange={(event) =>
                    setReceiptForm((prev) => ({ ...prev, supplierId: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                >
                  <option value="">Поставщик не выбран</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier._id} value={supplier._id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                <div className="space-y-3">
                  {receiptForm.items.map((item, index) => (
                    <div key={index} className="rounded-2xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={item.itemType}
                          onChange={(event) =>
                            handleReceiptItemChange(index, 'itemType', event.target.value)
                          }
                          className="rounded-2xl border border-slate-200 px-3 py-2"
                        >
                          <option value="ingredient">Ингредиент</option>
                          <option value="product">Продукт</option>
                        </select>
                        <select
                          value={item.itemId}
                          onChange={(event) =>
                            handleReceiptItemChange(index, 'itemId', event.target.value)
                          }
                          className="flex-1 rounded-2xl border border-slate-200 px-3 py-2"
                        >
                          <option value="">Позиция</option>
                          {(item.itemType === 'ingredient' ? ingredients : products).map((entry) => (
                            <option key={entry._id} value={entry._id}>
                              {'unit' in entry ? `${entry.name} (${entry.unit})` : entry.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(event) =>
                            handleReceiptItemChange(index, 'quantity', event.target.value)
                          }
                          className="w-28 rounded-2xl border border-slate-200 px-3 py-2"
                          placeholder="Кол-во"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitCost}
                          onChange={(event) =>
                            handleReceiptItemChange(index, 'unitCost', event.target.value)
                          }
                          className="w-32 rounded-2xl border border-slate-200 px-3 py-2"
                          placeholder="Цена"
                        />
                        {receiptForm.items.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeReceiptItemRow(index)}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-200"
                          >
                            Удалить
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={addReceiptItemRow}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    + Добавить позицию
                  </button>
                  <button type="submit" className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white">
                    Сохранить поставку
                  </button>
                </div>
              </form>
            </Card>
          </section>

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
                            {[ -10, -1, 1, 10 ].map((delta) => (
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
                          <button
                            type="submit"
                            className="w-full rounded-2xl bg-emerald-500 py-2 text-sm font-semibold text-white"
                          >
                            Сохранить поставщика
                          </button>
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
          <section className="grid gap-6 lg:grid-cols-2">
            <Card title="Клиенты">
              {customersLoading ? (
                <div className="h-32 animate-pulse rounded-2xl bg-slate-200/60" />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
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
                        <p className="text-xs uppercase text-slate-400">Карточка клиента</p>
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
                          Сохранить клиента
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-slate-400">Выберите клиента, чтобы управлять баллами и контактами.</p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </section>
        </div>
      ) : null}
    </div>
  );
 };

 const Card: React.FC<React.PropsWithChildren<{ title: string }>> = ({ title, children }) => (
  <section className="rounded-3xl bg-white p-6 shadow-soft">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    </div>
    {children}
  </section>
 );

 const SummaryCard: React.FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="rounded-3xl bg-white p-6 shadow-soft">
    <p className="text-sm text-slate-500">{title}</p>
    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
  </div>
 );

 export default AdminPage;
