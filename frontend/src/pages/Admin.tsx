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

type Ingredient = {
  _id: string;
  name: string;
  unit: string;
  costPerUnit?: number;
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

  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [newWarehouse, setNewWarehouse] = useState({ name: '', location: '', description: '' });
  const [inventoryAdjustment, setInventoryAdjustment] = useState({
    warehouseId: '',
    itemType: 'ingredient' as 'ingredient' | 'product',
    itemId: '',
    quantity: '',
    unitCost: '',
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
    try {
      setMenuLoading(true);
      const [categoriesRes, productsRes, ingredientsRes] = await Promise.all([
        api.get('/api/catalog/categories'),
        api.get('/api/catalog/products'),
        api.get('/api/catalog/ingredients'),
      ]);
      setCategories(categoriesRes.data.data || []);
      setProducts(productsRes.data.data || []);
      setIngredients(ingredientsRes.data.data || []);
    } catch (error) {
      notify({ title: 'Не удалось загрузить меню', type: 'error' });
    } finally {
      setMenuLoading(false);
    }
  }, [notify]);

  const loadInventoryData = useCallback(async () => {
    try {
      setInventoryLoading(true);
      const [warehousesRes, itemsRes, summaryRes] = await Promise.all([
        api.get('/api/inventory/warehouses'),
        api.get('/api/inventory/items'),
        api.get('/api/inventory/summary'),
      ]);
      setWarehouses(warehousesRes.data.data || []);
      setInventoryItems(itemsRes.data.data || []);
      setInventorySummary(summaryRes.data.data || null);
    } catch (error) {
      notify({ title: 'Не удалось загрузить склад', type: 'error' });
    } finally {
      setInventoryLoading(false);
    }
  }, [notify]);

  const loadSuppliersData = useCallback(async () => {
    try {
      setSuppliersLoading(true);
      const res = await api.get('/api/suppliers');
      setSuppliers(res.data.data || []);
    } catch (error) {
      notify({ title: 'Не удалось загрузить поставщиков', type: 'error' });
    } finally {
      setSuppliersLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (activeTab === 'menu' && !menuLoading && categories.length === 0 && products.length === 0) {
      void loadMenuData();
    }
    if (activeTab === 'inventory' && !inventoryLoading && warehouses.length === 0) {
      void loadInventoryData();
    }
    if (activeTab === 'suppliers' && !suppliersLoading && suppliers.length === 0) {
      void loadSuppliersData();
    }
  }, [activeTab, categories.length, products.length, menuLoading, loadMenuData, inventoryLoading, loadInventoryData, warehouses.length, suppliersLoading, suppliers.length, loadSuppliersData]);

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

  const handleUpsertInventory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inventoryAdjustment.warehouseId || !inventoryAdjustment.itemId) {
      notify({ title: 'Выберите склад и позицию', type: 'info' });
      return;
    }

    try {
      await api.post('/api/inventory/items', {
        warehouseId: inventoryAdjustment.warehouseId,
        itemType: inventoryAdjustment.itemType,
        itemId: inventoryAdjustment.itemId,
        quantity: inventoryAdjustment.quantity ? Number(inventoryAdjustment.quantity) : 0,
        unitCost: inventoryAdjustment.unitCost ? Number(inventoryAdjustment.unitCost) : undefined,
      });
      notify({ title: 'Складской остаток обновлен', type: 'success' });
      setInventoryAdjustment({ warehouseId: '', itemType: 'ingredient', itemId: '', quantity: '', unitCost: '' });
      void loadInventoryData();
    } catch (error) {
      notify({ title: 'Не удалось обновить остаток', type: 'error' });
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
                  <li key={category._id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span className="text-sm font-medium text-slate-700">{category.name}</span>
                    <span className="text-xs text-slate-400">
                      {products.filter((product) => product.categoryId === category._id).length} позиций
                    </span>
                  </li>
                ))}
              </ul>
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
                          <td className="px-3 py-2 text-slate-500">{discountLabel}</td>
                          <td className="px-3 py-2">
                            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-500">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                defaultChecked={product.isActive !== false}
                                onChange={(event) =>
                                  handleProductPriceChange(product._id, { isActive: event.target.checked })
                                }
                              />
                              В продаже
                            </label>
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-slate-400">
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
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {activeTab === 'inventory' ? (
        <div className="space-y-6">
          <section className="grid gap-6 lg:grid-cols-3">
            <Card title="Новый склад">
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
            <Card title="Пополнение / списание">
              <form onSubmit={handleUpsertInventory} className="space-y-3 text-sm">
                <select
                  value={inventoryAdjustment.warehouseId}
                  onChange={(event) => setInventoryAdjustment((prev) => ({ ...prev, warehouseId: event.target.value }))}
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
                  value={inventoryAdjustment.itemType}
                  onChange={(event) => setInventoryAdjustment((prev) => ({ ...prev, itemType: event.target.value as 'ingredient' | 'product', itemId: '' }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                >
                  <option value="ingredient">Ингредиент</option>
                  <option value="product">Готовый продукт</option>
                </select>
                <select
                  value={inventoryAdjustment.itemId}
                  onChange={(event) => setInventoryAdjustment((prev) => ({ ...prev, itemId: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2"
                >
                  <option value="">Выберите позицию</option>
                  {(inventoryAdjustment.itemType === 'ingredient' ? ingredients : products).map((item) => (
                    <option key={item._id} value={item._id}>
                      {'costPerUnit' in item ? `${item.name} (${item.unit})` : `${item.name}`}
                    </option>
                  ))}
                </select>
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inventoryAdjustment.quantity}
                    onChange={(event) => setInventoryAdjustment((prev) => ({ ...prev, quantity: event.target.value }))}
                    placeholder="Количество"
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inventoryAdjustment.unitCost}
                    onChange={(event) => setInventoryAdjustment((prev) => ({ ...prev, unitCost: event.target.value }))}
                    placeholder="Цена за единицу"
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                  />
                </div>
                <button type="submit" className="w-full rounded-2xl bg-emerald-500 py-2 text-sm font-semibold text-white">
                  Обновить остаток
                </button>
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
                  <ul className="space-y-3">
                    {suppliers.map((supplier) => (
                      <li key={supplier._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
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
                )}
              </Card>
            </div>
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
