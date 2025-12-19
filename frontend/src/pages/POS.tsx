import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import HeaderBar from '../components/ui/HeaderBar';
import CategorySidebar from '../components/ui/CategorySidebar';
import ProductCard from '../components/ui/ProductCard';
import OrderPanel from '../components/ui/OrderPanel';
import PaymentModal from '../components/ui/PaymentModal';
import LoyaltyModal from '../components/ui/LoyaltyModal';
import RedeemPointsModal from '../components/ui/RedeemPointsModal';
import ModifierModal from '../components/ui/ModifierModal';
import { useCatalogStore, type Product } from '../store/catalog';
import {
  useOrderStore,
  type PaymentMethod,
  type CustomerSummary,
  type OrderHistoryEntry,
  type OrderTag,
  type SelectedModifier,
} from '../store/order';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useToast } from '../providers/ToastProvider';
import { useShiftStore, type ShiftSummary } from '../store/shift';
import { useRestaurantStore } from '../store/restaurant';
import { useBillingInfo } from '../hooks/useBillingInfo';

const POSPage: React.FC = () => {
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1280px)');
  const isTablet = useMediaQuery('(min-width: 1024px)');
  const {
    billing,
    billingEnabled,
    billingLocked,
    refreshBilling,
    loading: billingLoading,
    error: billingError,
  } = useBillingInfo();
  const categories = useCatalogStore((state) => state.categories);
  const products = useCatalogStore((state) => state.products);
  const activeCategoryId = useCatalogStore((state) => state.activeCategoryId);
  const setActiveCategory = useCatalogStore((state) => state.setActiveCategory);
  const fetchCatalog = useCatalogStore((state) => state.fetchCatalog);
  const loading = useCatalogStore((state) => state.loading);

  const items = useOrderStore((state) => state.items);
  const subtotal = useOrderStore((state) => state.subtotal);
  const discount = useOrderStore((state) => state.discount);
  const total = useOrderStore((state) => state.total);
  const status = useOrderStore((state) => state.status);
  const orderId = useOrderStore((state) => state.orderId);
  const orderTag = useOrderStore((state) => state.orderTag);
  const customer = useOrderStore((state) => state.customer);
  const addProduct = useOrderStore((state) => state.addProduct);
  const updateItemQty = useOrderStore((state) => state.updateItemQty);
  const removeItem = useOrderStore((state) => state.removeItem);
  const payOrder = useOrderStore((state) => state.payOrder);
  const completeOrder = useOrderStore((state) => state.completeOrder);
  const createDraft = useOrderStore((state) => state.createDraft);
  const attachCustomer = useOrderStore((state) => state.attachCustomer);
  const fetchActiveOrders = useOrderStore((state) => state.fetchActiveOrders);
  const activeOrders = useOrderStore((state) => state.activeOrders);
  const loadOrder = useOrderStore((state) => state.loadOrder);
  const redeemPoints = useOrderStore((state) => state.redeemPoints);
  const clearDiscount = useOrderStore((state) => state.clearDiscount);
  const cancelOrder = useOrderStore((state) => state.cancelOrder);
  const availableDiscounts = useOrderStore((state) => state.availableDiscounts);
  const appliedDiscounts = useOrderStore((state) => state.appliedDiscounts);
  const selectedDiscountIds = useOrderStore((state) => state.selectedDiscountIds);
  const fetchAvailableDiscounts = useOrderStore((state) => state.fetchAvailableDiscounts);
  const toggleDiscount = useOrderStore((state) => state.toggleDiscount);
  const shiftHistory = useOrderStore((state) => state.shiftHistory);
  const shiftHistoryLoading = useOrderStore((state) => state.shiftHistoryLoading);
  const fetchShiftHistory = useOrderStore((state) => state.fetchShiftHistory);
  const resetShiftHistory = useOrderStore((state) => state.resetShiftHistory);
  const setOrderTag = useOrderStore((state) => state.setOrderTag);
  const currentShift = useShiftStore((state) => state.currentShift);
  const fetchCurrentShift = useShiftStore((state) => state.fetchCurrentShift);
  const openShift = useShiftStore((state) => state.openShift);
  const closeShift = useShiftStore((state) => state.closeShift);
  const isShiftLoading = useShiftStore((state) => state.loading);
  const isOpeningShift = useShiftStore((state) => state.opening);
  const isClosingShift = useShiftStore((state) => state.closing);

  const { notify } = useToast();
  const formatBillingDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString('ru-RU') : '—';
  const requireActiveSubscription = useCallback(() => {
    if (!billingLocked) return true;

    notify({
      title: 'Подписка неактивна',
      description: 'Продлите подписку в настройках, чтобы продолжить оформлять заказы.',
      type: 'error',
    });

    return false;
  }, [billingLocked, notify]);
  const [isPaymentOpen, setPaymentOpen] = useState(false);
  const [isLoyaltyOpen, setLoyaltyOpen] = useState(false);
  const [isPaying, setPaying] = useState(false);
  const [isStartingOrder, setStartingOrder] = useState(false);
  const [isCompleting, setCompleting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [activeSection, setActiveSection] = useState<'products' | 'customers' | 'reports'>('products');
  const [isRedeemOpen, setRedeemOpen] = useState(false);
  const [isRedeeming, setRedeeming] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [isShiftPanelOpen, setShiftPanelOpen] = useState(false);
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null);
  const orderTagsEnabled = useRestaurantStore((state) => state.enableOrderTags);

  useEffect(() => {
    void fetchCatalog();
    void fetchActiveOrders();
    void fetchAvailableDiscounts();
  }, [fetchCatalog, fetchActiveOrders, fetchAvailableDiscounts]);

  useEffect(() => {
    if (orderId || activeOrders.length === 0) {
      return;
    }

    const draftOrder = activeOrders.find((order) => order.status === 'draft') ?? activeOrders[0];
    if (!draftOrder) {
      return;
    }

    void loadOrder(draftOrder._id);
  }, [orderId, activeOrders, loadOrder]);

  useEffect(() => {
    if (activeSection === 'reports') {
      void fetchActiveOrders();
    }
  }, [activeSection, fetchActiveOrders]);

  useEffect(() => {
    void fetchCurrentShift().catch(() =>
      notify({ title: 'Смена', description: 'Не удалось загрузить состояние смены', type: 'error' })
    );
  }, [fetchCurrentShift, notify]);

  const currentShiftId = currentShift?._id;

  useEffect(() => {
    if (!currentShiftId) {
      resetShiftHistory();
      return;
    }

    void fetchShiftHistory().catch(() =>
      notify({ title: 'История чеков', description: 'Не удалось обновить историю смены', type: 'error' })
    );
  }, [currentShiftId, fetchShiftHistory, resetShiftHistory, notify]);

  const filteredProducts = useMemo(() => {
    if (!activeCategoryId) {
      return products;
    }
    return products.filter((product) => product.categoryId === activeCategoryId);
  }, [products, activeCategoryId]);

  const searchResults = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return products
      .filter((product) => product.name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      .slice(0, 8);
  }, [products, searchQuery]);

  const earnedPoints = total * 0.05;
  const startOrderButtonLabel = isStartingOrder ? 'Создание…' : 'Создать заказ';
  const shiftStatus = isShiftLoading ? 'loading' : currentShift ? 'open' : 'closed';
  const shouldShowProductSearch = isTablet || activeSection === 'products';

  const handleStartOrder = async () => {
    if (!requireActiveSubscription()) {
      return;
    }

    if (!currentShift) {
      notify({
        title: 'Смена закрыта',
        description: 'Откройте смену, чтобы начать продажи',
        type: 'info',
      });
      return;
    }

    setStartingOrder(true);
    try {
      await createDraft({ forceNew: true });
    } catch (error) {
      notify({
        title: 'Ошибка заказа',
        description: 'Не удалось создать черновик заказа',
        type: 'error',
      });
    } finally {
      setStartingOrder(false);
    }
  };

  const openPaymentModal = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setPaymentOpen(true);
  };

  const handlePayConfirm = async (payload: { method: PaymentMethod; amountTendered: number; change?: number }) => {
    if (!requireActiveSubscription()) {
      return;
    }

    setPaying(true);
    try {
      await payOrder(payload);
      notify({
        title: 'Оплата проведена',
        description: 'Завершите заказ, чтобы отправить его в историю',
        type: 'success',
      });
      setPaymentOpen(false);
    } catch (error) {
      notify({ title: 'Ошибка оплаты', description: 'Попробуйте снова', type: 'error' });
    } finally {
      setPaying(false);
    }
  };

  const handleCompleteCurrentOrder = async () => {
    if (!requireActiveSubscription()) {
      return;
    }

    if (!orderId) {
      return;
    }

    setCompleting(true);
    try {
      await completeOrder();
      notify({ title: 'Заказ завершён', description: 'Чек отправлен в историю', type: 'success' });
      await fetchShiftHistory().catch(() => undefined);
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Не удалось завершить заказ';
      notify({ title: 'Ошибка завершения', description, type: 'error' });
    } finally {
      setCompleting(false);
    }
  };

  const handleAttachCustomer = async (customerToAttach: CustomerSummary | null) => {
    if (!requireActiveSubscription()) {
      return;
    }

    try {
      await attachCustomer(customerToAttach);
    } catch (error) {
      notify({ title: 'Не удалось привязать клиента', type: 'error' });
    } finally {
      setLoyaltyOpen(false);
    }
  };

  const handleRemoveCustomer = async () => {
    if (!requireActiveSubscription()) {
      return;
    }

    try {
      await clearDiscount();
      await attachCustomer(null);
      notify({ title: 'Клиент отвязан', type: 'info' });
    } catch (error) {
      notify({ title: 'Не удалось отвязать клиента', type: 'error' });
    }
    setLoyaltyOpen(false);
  };

  const handleOrderTagChange = async (nextTag: OrderTag | null) => {
    if (!requireActiveSubscription()) {
      return;
    }

    try {
      await setOrderTag(nextTag);
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Не удалось изменить тип заказа';
      notify({ title: 'Ошибка метки заказа', description, type: 'error' });
    }
  };

  const handleRedeemConfirm = async (pointsValue: number) => {
    if (!requireActiveSubscription()) {
      return;
    }

    setRedeeming(true);
    try {
      if (!customer) {
        setRedeeming(false);
        setRedeemOpen(false);
        return;
      }
      await redeemPoints(pointsValue);
      notify({ title: 'Баллы списаны', type: 'success' });
      setRedeemOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось списать баллы';
      notify({ title: 'Ошибка списания', description: message, type: 'error' });
    } finally {
      setRedeeming(false);
    }
  };

  const handleOpenShift = async () => {
    if (!requireActiveSubscription()) {
      return;
    }

    try {
      await openShift();
      notify({ title: 'Смена открыта', type: 'success' });
      await fetchShiftHistory().catch(() => undefined);
      setShiftPanelOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось открыть смену';
      notify({ title: 'Не удалось открыть смену', description: message, type: 'error' });
    }
  };

  const handleCloseShift = async () => {
    if (!requireActiveSubscription()) {
      return;
    }

    if (!currentShift) {
      return;
    }

    const confirmed = window.confirm('Закрыть текущую смену?');
    if (!confirmed) {
      return;
    }

    try {
      await closeShift();
      resetShiftHistory();
      notify({ title: 'Смена закрыта', type: 'info' });
      setShiftPanelOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось закрыть смену';
      notify({ title: 'Не удалось закрыть смену', description: message, type: 'error' });
    }
  };

  const handleRefreshHistory = () => {
    if (!currentShift) {
      notify({ title: 'Смена закрыта', description: 'Откройте смену, чтобы просматривать чеки', type: 'info' });
      return;
    }

    void fetchShiftHistory().catch(() =>
      notify({ title: 'История чеков', description: 'Не удалось обновить историю', type: 'error' })
    );
  };

  const handleAddProduct = (product: typeof products[number]) => {
    if (!requireActiveSubscription()) {
      return;
    }

    if (product.modifierGroups?.length) {
      setModifierProduct(product);
      return;
    }

    void addProduct(product).catch(() => {
      notify({ title: 'Не удалось добавить товар', type: 'error' });
    });
  };

  const handleModifierConfirm = (modifiers: SelectedModifier[]) => {
    if (!requireActiveSubscription()) {
      return;
    }

    if (!modifierProduct) return;

    void addProduct(modifierProduct, modifiers).catch(() => {
      notify({ title: 'Не удалось добавить товар', type: 'error' });
    });
    setModifierProduct(null);
  };

  const handleModifierClose = () => setModifierProduct(null);

  const handleProductSearchSelect = (product: Product) => {
    handleAddProduct(product);
    setSearchQuery('');
  };

  return (
    <div className="pos-shell flex h-screen min-h-0 flex-col gap-2 overflow-hidden px-2 py-2 pb-28 sm:gap-2.5 sm:px-2.5 sm:py-2.5 lg:px-4 lg:pb-5 xl:px-5">
      <HeaderBar
        onShowHistory={() => setHistoryOpen(true)}
        onShowShift={() => setShiftPanelOpen(true)}
        shiftStatus={shiftStatus}
      />
      {billingEnabled ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm shadow-sm ${
            billingLocked ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Подписка: {billing?.status ?? '—'}
                {billing?.plan ? ` (${billing.plan === 'trial' ? 'триал' : 'оплачено'})` : ''}
              </p>
              <p className="text-xs text-slate-600">
                {billing?.plan === 'trial'
                  ? `Демо до ${formatBillingDate(billing?.trialEndsAt)}`
                  : `Следующий платёж: ${formatBillingDate(billing?.nextPaymentDueAt)}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white shadow-soft transition hover:bg-primary-dark"
              >
                Перейти к продлению
              </button>
              <button
                type="button"
                onClick={() => void refreshBilling()}
                disabled={billingLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
              >
                {billingLoading ? 'Обновляем…' : 'Обновить статус'}
              </button>
            </div>
          </div>
          {billingError ? (
            <p className="mt-2 text-xs text-rose-700">{billingError}</p>
          ) : billingLocked ? (
            <p className="mt-2 text-xs text-rose-700">
              Подписка неактивна. Продлите её в настройках, чтобы пробивать чеки и изменять данные.
            </p>
          ) : null}
        </div>
      ) : null}
      {!isTablet ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="w-full rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
            Интерфейс кассира доступен на планшетах и ПК. На телефонах он скрыт.
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row lg:gap-4 xl:gap-5">
          <div className="custom-scrollbar hidden min-h-0 flex-shrink-0 lg:flex lg:h-full lg:w-auto lg:overflow-y-auto">
            <CategorySidebar
              categories={categories}
              activeCategoryId={activeCategoryId}
              onSelectCategory={(categoryId) => setActiveCategory(categoryId)}
              collapsed={false}
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:min-w-0 lg:px-1.5">
            {shouldShowProductSearch ? (
              <div className="mb-3 flex flex-col gap-2">
                <ProductSearchBar
                  query={searchQuery}
                  onQueryChange={setSearchQuery}
                  results={searchResults}
                  onSelect={handleProductSearchSelect}
                />
              </div>
            ) : null}
            <div className="custom-scrollbar flex min-h-0 flex-1 flex-col space-y-2 overflow-y-auto pr-1 sm:space-y-2.5">
              <div className="rounded-xl bg-white p-2 shadow-soft sm:p-2.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Текущие заказы</h3>
                  <button
                    type="button"
                    onClick={() => void handleStartOrder()}
                    disabled={isStartingOrder || billingLocked}
                    className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-dark disabled:opacity-60 sm:w-auto"
                  >
                    {startOrderButtonLabel}
                  </button>
                </div>
                {activeOrders.length > 0 ? (
                  <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {activeOrders.map((order) => {
                      const isActive = orderId === order._id;
                      const tagLabel = getOrderTagLabel(order.orderTag);
                      return (
                        <button
                          type="button"
                          key={order._id}
                          onClick={() => void loadOrder(order._id)}
                          className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                            isActive
                              ? 'border-2 border-secondary/70 bg-secondary/10 text-secondary shadow-sm'
                              : 'border-slate-100 bg-white text-slate-700 hover:border-secondary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-slate-900">#{order._id.slice(-5)}</p>
                            {tagLabel ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                                {tagLabel}
                              </span>
                            ) : null}
                          </div>
                          {order.status === 'paid' ? (
                            <p className="text-xs uppercase text-slate-400">оплачен</p>
                          ) : null}
                          <p className="mt-2 text-base font-semibold text-slate-900">{order.total.toFixed(2)} ₽</p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Нет активных заказов.</p>
                )}
              </div>
              {loading ? (
                <div className="grid gap-2 sm:gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
                  ))}
                </div>
              ) : (
                <div
                  className={`grid gap-2 sm:gap-2.5 ${
                    activeSection === 'products'
                      ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
                      : 'grid-cols-1'
                  }`}
                >
                  {activeSection === 'products'
                    ? filteredProducts.map((product) => (
                        <ProductCard
                          key={product._id}
                          product={product}
                          onSelect={(selectedProduct) => handleAddProduct(selectedProduct)}
                        />
                      ))
                    : null}
                  {activeSection === 'customers' ? (
                    <div className="col-span-full rounded-2xl bg-white p-6 shadow-soft">
                      <p className="text-lg font-semibold text-slate-900">Быстрые действия</p>
                      <div className="mt-4 flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => setLoyaltyOpen(true)}
                          className="min-h-[56px] rounded-2xl bg-secondary text-base font-semibold text-white shadow-soft transition hover:bg-secondary/80"
                        >
                          Найти или добавить клиента
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveCustomer}
                          className="min-h-[56px] rounded-2xl border border-slate-200 text-base font-semibold text-slate-600"
                        >
                          Очистить клиента
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {activeSection === 'reports' ? (
                    <div className="col-span-full rounded-2xl bg-white p-6 shadow-soft">
                      <p className="text-lg font-semibold text-slate-900">Активные заказы</p>
                      {activeOrders.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">Нет активных заказов кассира.</p>
                      ) : (
                        <ul className="mt-3 space-y-3">
                          {activeOrders.map((order) => {
                            const tagLabel = getOrderTagLabel(order.orderTag);
                            return (
                              <li
                                key={order._id}
                                className="flex items-center justify-between rounded-2xl border border-slate-100 p-3"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-base font-semibold text-slate-900">Заказ #{order._id.slice(-5)}</p>
                                    {tagLabel ? (
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                                        {tagLabel}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="text-sm text-slate-500">
                                    {new Date(order.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-slate-900">{order.total.toFixed(2)} ₽</p>
                                  <p className="text-xs uppercase text-slate-400">{order.status === 'draft' ? 'В работе' : 'Оплачен'}</p>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  ) : null}
                  {filteredProducts.length === 0 && activeSection === 'products' ? (
                    <div className="col-span-full rounded-2xl bg-white p-6 text-center text-slate-400 shadow-soft">
                      Нет товаров в категории
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          <div className="hidden min-h-0 lg:flex lg:h-full lg:flex-[0_0_300px] lg:min-w-[300px] lg:max-w-[300px] xl:flex-[0_0_320px] xl:min-w-[320px] xl:max-w-[320px] 2xl:flex-[0_0_360px] 2xl:min-w-[360px] 2xl:max-w-[360px] lg:flex-shrink-0 lg:flex-col lg:pr-1">
            <OrderPanel
              items={items}
              subtotal={subtotal}
              discount={discount}
              total={total}
              status={status}
              isCompleting={isCompleting}
              onIncrement={(lineId) =>
                void updateItemQty(lineId, (items.find((item) => item.lineId === lineId)?.qty || 0) + 1)
              }
              onDecrement={(lineId) =>
                void updateItemQty(lineId, (items.find((item) => item.lineId === lineId)?.qty || 0) - 1)
              }
              onRemove={(lineId) => void removeItem(lineId)}
              onPay={(method) => openPaymentModal(method)}
              onAddCustomer={() => setLoyaltyOpen(true)}
              onClearCustomer={handleRemoveCustomer}
              isProcessing={isPaying}
              earnedPoints={earnedPoints}
              customer={customer}
              orderTagsEnabled={orderTagsEnabled}
              orderTag={orderTag}
              onChangeOrderTag={(nextTag) => void handleOrderTagChange(nextTag)}
              onRedeemLoyalty={() => {
                if (!customer || customer.points <= 0) {
                  notify({ title: 'Нет доступных баллов', type: 'info' });
                  return;
                }
                setRedeemOpen(true);
              }}
              onClearDiscount={() =>
                void clearDiscount().catch(() => notify({ title: 'Не удалось сбросить скидку', type: 'error' }))
              }
              onCancel={() =>
                void cancelOrder()
                  .then(() => {
                  notify({ title: 'Заказ отменён', type: 'info' });
                })
                  .catch(() => notify({ title: 'Не удалось отменить заказ', type: 'error' }))
              }
              onComplete={() => void handleCompleteCurrentOrder()}
              availableDiscounts={availableDiscounts}
              appliedDiscounts={appliedDiscounts}
              selectedDiscountIds={selectedDiscountIds}
              onToggleDiscount={(discountId) =>
                void toggleDiscount(discountId).catch(() =>
                  notify({ title: 'Не удалось применить скидку', type: 'error' })
                )
              }
              visible
            />
          </div>
        </div>
      )}
      <PaymentModal
        open={isPaymentOpen}
        total={total}
        method={paymentMethod}
        onClose={() => setPaymentOpen(false)}
        onConfirm={handlePayConfirm}
        isProcessing={isPaying}
      />
      {modifierProduct ? (
        <ModifierModal
          product={modifierProduct}
          onClose={handleModifierClose}
          onConfirm={handleModifierConfirm}
        />
      ) : null}
      <LoyaltyModal
        open={isLoyaltyOpen}
        onClose={() => setLoyaltyOpen(false)}
        onAttach={(selectedCustomer) => void handleAttachCustomer(selectedCustomer)}
      />
      <RedeemPointsModal
        open={isRedeemOpen}
        onClose={() => setRedeemOpen(false)}
        maxPoints={customer?.points ?? 0}
        maxAmount={Math.max(subtotal - discount, 0)}
        onSubmit={(value) => handleRedeemConfirm(value)}
        isProcessing={isRedeeming}
      />
      <FloatingPanelOverlay open={isHistoryOpen} onClose={() => setHistoryOpen(false)}>
        <ReceiptHistoryCard
          shift={currentShift}
          history={shiftHistory}
          loading={shiftHistoryLoading}
          shiftLoading={isShiftLoading}
          onRefresh={handleRefreshHistory}
          className="mb-0"
        />
      </FloatingPanelOverlay>
      <FloatingPanelOverlay open={isShiftPanelOpen} onClose={() => setShiftPanelOpen(false)}>
        <ShiftStatusPanel
          shift={currentShift}
          loading={isShiftLoading}
          isOpening={isOpeningShift}
          isClosing={isClosingShift}
          onOpen={() => {
            void handleOpenShift();
          }}
          onClose={() => {
            void handleCloseShift();
          }}
        />
      </FloatingPanelOverlay>
    </div>
  );
};

type TabButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

const TabButton: React.FC<TabButtonProps> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex h-12 flex-1 items-center justify-center text-sm font-semibold transition ${
      active ? 'text-primary' : 'text-slate-500'
    }`}
  >
    {label}
  </button>
);

type FloatingPanelOverlayProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

const FloatingPanelOverlay: React.FC<FloatingPanelOverlayProps> = ({ open, onClose, children }) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative z-10 flex h-full items-end justify-center px-4 py-6 sm:items-center">
        <div className="relative w-full max-w-2xl rounded-[32px] bg-white p-4 shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
            aria-label="Закрыть окно"
          >
            ✕
          </button>
          <div className="max-h-[75vh] overflow-y-auto pr-1 pt-4 sm:pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
};

type ProductSearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  results: Product[];
  onSelect: (product: Product) => void;
};

const ProductSearchBar: React.FC<ProductSearchBarProps> = ({ query, onQueryChange, results, onSelect }) => {
  const hasQuery = query.trim().length > 0;

  return (
    <div className="relative w-full max-w-4xl">
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Поиск"
        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-800 placeholder:text-slate-500 shadow-soft transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {query ? (
        <button
          type="button"
          onClick={() => onQueryChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500"
          aria-label="Очистить поиск"
        >
          Очистить
        </button>
      ) : (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">⌕</span>
      )}
      {hasQuery ? (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">Ничего не найдено</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map((product) => (
                <li key={product._id}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelect(product);
                    }}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="truncate pr-3">{product.name}</span>
                    <span className="text-sm font-semibold text-slate-900">{product.price.toFixed(2)} ₽</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};

type MobileQuickActionsProps = {
  onShowOrder: () => void;
  onResetCustomer: () => void;
  itemCount: number;
};

const MobileQuickActions: React.FC<MobileQuickActionsProps> = ({ onShowOrder, onResetCustomer, itemCount }) => (
  <div className="flex items-center gap-3">
    <button
      type="button"
      className="flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600"
      onClick={onShowOrder}
    >
      Смотреть заказ ({itemCount})
    </button>
    <button
      type="button"
      className="flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600"
      onClick={onResetCustomer}
    >
      Сбросить клиента
    </button>
  </div>
);

const formatTimeLabel = (value: string): string =>
  new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const getOrderTagLabel = (tag?: OrderTag | null): string | null => {
  if (tag === 'takeaway') {
    return 'С собой';
  }
  if (tag === 'delivery') {
    return 'Доставка';
  }
  return null;
};

type ShiftStatusPanelProps = {
  shift: ShiftSummary | null;
  loading: boolean;
  isOpening: boolean;
  isClosing: boolean;
  onOpen: () => void;
  onClose: () => void;
};

const ShiftStatusPanel: React.FC<ShiftStatusPanelProps> = ({
  shift,
  loading,
  isOpening,
  isClosing,
  onOpen,
  onClose,
}) => {
  const actionDisabled = loading || isOpening || isClosing;
  const shiftOpenedAt = shift ? formatTimeLabel(shift.openedAt) : null;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Текущая смена</p>
          {loading ? (
            <div className="mt-2 h-5 w-32 animate-pulse rounded-full bg-slate-200" />
          ) : (
            <p className="text-lg font-semibold text-slate-900">
              {shift ? `Открыта с ${shiftOpenedAt}` : 'Смена закрыта'}
            </p>
          )}
          {shift?.registerId ? (
            <p className="text-xs text-slate-400">Касса {shift.registerId}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {shift ? (
            <button
              type="button"
              onClick={onClose}
              disabled={actionDisabled}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-60"
            >
              {isClosing ? 'Закрытие…' : 'Закрыть смену'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              disabled={actionDisabled}
              className="rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
            >
              {isOpening ? 'Открытие…' : 'Открыть смену'}
            </button>
          )}
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Управляйте сменой из любого места интерфейса: откройте смену, чтобы начать продавать, или закройте, когда закончили
        работу.
      </p>
    </div>
  );
};

type ReceiptHistoryCardProps = {
  shift: ShiftSummary | null;
  history: OrderHistoryEntry[];
  loading: boolean;
  shiftLoading: boolean;
  onRefresh: () => void;
  className?: string;
};

const ReceiptHistoryCard: React.FC<ReceiptHistoryCardProps> = ({
  shift,
  history,
  loading,
  shiftLoading,
  onRefresh,
  className,
}) => {
  const paymentLabel = (method?: PaymentMethod) => {
    if (method === 'card') return 'Карта';
    if (method === 'cash') return 'Наличные';
    return 'Без данных';
  };

  return (
    <div className={`rounded-2xl bg-white p-6 shadow-soft ${className ?? ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-slate-900">История чеков</p>
          <p className="text-xs text-slate-500">
            {shift ? `Смена с ${formatTimeLabel(shift.openedAt)}` : 'Откройте смену, чтобы видеть чеки'}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={!shift || loading || shiftLoading}
          className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
        >
          Обновить
        </button>
      </div>
      {shiftLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : !shift ? (
        <p className="mt-4 text-sm text-slate-500">Чтобы просматривать историю чеков, откройте смену.</p>
      ) : loading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Заказов в этой смене пока нет.</p>
      ) : (
        <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
          {history.map((order) => (
            <li key={order._id} className="rounded-2xl border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Чек #{order._id.slice(-5)}</p>
                  <p className="text-xs text-slate-400">{formatTimeLabel(order.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-semibold text-slate-900">{order.total.toFixed(2)} ₽</p>
                  <p className="text-xs uppercase text-slate-400">{paymentLabel(order.paymentMethod)}</p>
                </div>
              </div>
              {order.items.length ? (
                <p className="mt-2 text-xs text-slate-500">
                  {order.items.map((item) => `${item.qty}× ${item.name}`).join(', ')}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default POSPage;
