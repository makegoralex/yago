import React, { useEffect, useMemo, useState } from 'react';

import HeaderBar from '../components/ui/HeaderBar';
import CategorySidebar from '../components/ui/CategorySidebar';
import ProductCard from '../components/ui/ProductCard';
import OrderPanel from '../components/ui/OrderPanel';
import PaymentModal from '../components/ui/PaymentModal';
import LoyaltyModal from '../components/ui/LoyaltyModal';
import RedeemPointsModal from '../components/ui/RedeemPointsModal';
import { useCatalogStore } from '../store/catalog';
import { useOrderStore, type PaymentMethod, type CustomerSummary } from '../store/order';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useToast } from '../providers/ToastProvider';

const POSPage: React.FC = () => {
  const isDesktop = useMediaQuery('(min-width: 1280px)');
  const isTablet = useMediaQuery('(min-width: 1024px)');
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

  const { notify } = useToast();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOrderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [isPaymentOpen, setPaymentOpen] = useState(false);
  const [isLoyaltyOpen, setLoyaltyOpen] = useState(false);
  const [isPaying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [activeSection, setActiveSection] = useState<'products' | 'customers' | 'reports'>('products');
  const [isRedeemOpen, setRedeemOpen] = useState(false);
  const [isRedeeming, setRedeeming] = useState(false);

  useEffect(() => {
    void fetchCatalog();
    createDraft().catch(() => {
      notify({ title: 'Ошибка заказа', description: 'Не удалось создать черновик заказа', type: 'error' });
    });
    void fetchActiveOrders();
  }, [fetchCatalog, createDraft, fetchActiveOrders, notify]);

  useEffect(() => {
    if (!activeCategoryId && categories.length > 0) {
      setActiveCategory(categories[0]._id);
    }
  }, [activeCategoryId, categories, setActiveCategory]);

  useEffect(() => {
    if (activeSection === 'reports') {
      void fetchActiveOrders();
    }
  }, [activeSection, fetchActiveOrders]);

  const filteredProducts = useMemo(() => {
    if (!activeCategoryId) {
      return products;
    }
    return products.filter((product) => product.categoryId === activeCategoryId);
  }, [products, activeCategoryId]);

  const earnedPoints = total * 0.05;

  const openPaymentModal = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setPaymentOpen(true);
  };

  const handlePayConfirm = async (payload: { method: PaymentMethod; amountTendered: number; change?: number }) => {
    setPaying(true);
    try {
      await payOrder(payload);
      await completeOrder();
      notify({
        title: 'Заказ завершён',
        description: 'Оплата проведена и чек закрыт',
        type: 'success',
      });
      setPaymentOpen(false);
      setOrderDrawerOpen(false);
    } catch (error) {
      notify({ title: 'Ошибка оплаты', description: 'Попробуйте снова', type: 'error' });
    } finally {
      setPaying(false);
    }
  };

  const handleAttachCustomer = async (customerToAttach: CustomerSummary | null) => {
    try {
      await attachCustomer(customerToAttach);
    } catch (error) {
      notify({ title: 'Не удалось привязать клиента', type: 'error' });
    } finally {
      setLoyaltyOpen(false);
    }
  };

  const handleRemoveCustomer = async () => {
    try {
      await clearDiscount();
      await attachCustomer(null);
      notify({ title: 'Клиент отвязан', type: 'info' });
    } catch (error) {
      notify({ title: 'Не удалось отвязать клиента', type: 'error' });
    }
    setLoyaltyOpen(false);
  };

  const handleRedeemConfirm = async (pointsValue: number) => {
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

  const handleAddProduct = (product: typeof products[number]) => {
    void addProduct(product)
      .then(() => {
        notify({ title: product.name, description: 'Добавлено в заказ', type: 'success' });
      })
      .catch(() => {
        notify({ title: 'Не удалось добавить товар', type: 'error' });
      });
    if (!isTablet) {
      setOrderDrawerOpen(true);
    }
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-100 px-4 py-4 pb-32 lg:px-6 lg:pb-6">
      <HeaderBar onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)} isSidebarCollapsed={sidebarCollapsed} />
      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <div className={`lg:w-auto ${isTablet ? 'flex-shrink-0' : 'hidden lg:flex'}`}>
          <CategorySidebar
            categories={categories}
            activeCategoryId={activeCategoryId}
            onSelectCategory={(categoryId) => setActiveCategory(categoryId)}
            collapsed={!isDesktop && (sidebarCollapsed || !isTablet)}
          />
        </div>
        <div className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Меню</h2>
            <div className="flex items-center gap-3 lg:hidden">
              <button
                type="button"
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-500"
                onClick={() => setOrderDrawerOpen(true)}
              >
                Смотреть заказ ({items.length})
              </button>
              <button
                type="button"
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-500"
                onClick={handleRemoveCustomer}
              >
                Сбросить клиента
              </button>
            </div>
          </div>
          {activeOrders.length > 0 ? (
            <div className="mb-4 rounded-2xl bg-white p-4 shadow-soft">
              <h3 className="text-sm font-semibold text-slate-900">Текущие заказы</h3>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {activeOrders.map((order) => {
                  const isActive = orderId === order._id;
                  return (
                    <button
                      type="button"
                      key={order._id}
                      onClick={() => void loadOrder(order._id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        isActive
                          ? 'border-secondary bg-secondary/10 text-secondary'
                          : 'border-slate-100 text-slate-600 hover:border-secondary/60'
                      }`}
                    >
                      <p className="font-semibold text-slate-900">#{order._id.slice(-5)}</p>
                      {order.status === 'paid' ? (
                        <p className="text-xs uppercase text-slate-400">оплачен</p>
                      ) : null}
                      <p className="mt-2 text-base font-semibold text-slate-900">{order.total.toFixed(2)} ₽</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-2xl bg-slate-200/70" />
              ))}
            </div>
          ) : (
            <div
              className={`grid gap-4 ${
                isDesktop ? 'xl:grid-cols-3' : isTablet ? 'lg:grid-cols-2' : activeSection === 'products' ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1'
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
                      {activeOrders.map((order) => (
                        <li key={order._id} className="flex items-center justify-between rounded-2xl border border-slate-100 p-3">
                          <div>
                            <p className="text-base font-semibold text-slate-900">Заказ #{order._id.slice(-5)}</p>
                            <p className="text-sm text-slate-500">{new Date(order.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">{order.total.toFixed(2)} ₽</p>
                            <p className="text-xs uppercase text-slate-400">{order.status === 'draft' ? 'В работе' : 'Оплачен'}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
              {activeSection !== 'products' && !isTablet ? (
                <button
                  type="button"
                  onClick={() => setActiveSection('products')}
                  className="col-span-full rounded-2xl border border-slate-200 py-4 text-sm font-semibold text-slate-600"
                >
                  Вернуться к товарам
                </button>
              ) : null}
              {filteredProducts.length === 0 && activeSection === 'products' ? (
                <div className="col-span-full rounded-2xl bg-white p-6 text-center text-slate-400 shadow-soft">
                  Нет товаров в категории
                </div>
              ) : null}
            </div>
          )}
        </div>
        <div className="hidden lg:block lg:w-[360px]">
          <OrderPanel
            items={items}
            subtotal={subtotal}
            discount={discount}
            total={total}
            status={status}
            onIncrement={(productId) =>
              void updateItemQty(
                productId,
                (items.find((item) => item.productId === productId)?.qty || 0) + 1
              )
            }
            onDecrement={(productId) =>
              void updateItemQty(
                productId,
                (items.find((item) => item.productId === productId)?.qty || 0) - 1
              )
            }
            onRemove={(productId) => void removeItem(productId)}
            onPay={(method) => openPaymentModal(method)}
            onComplete={() =>
              void completeOrder()
                .then(() => {
                  setOrderDrawerOpen(false);
                  notify({ title: 'Заказ завершён', type: 'success' });
                })
                .catch(() => notify({ title: 'Не удалось завершить заказ', type: 'error' }))
            }
            onAddCustomer={() => setLoyaltyOpen(true)}
            onClearCustomer={handleRemoveCustomer}
            isProcessing={isPaying}
            earnedPoints={earnedPoints}
            customer={customer}
            onRedeemLoyalty={() => {
              if (!customer || customer.points <= 0) {
                notify({ title: 'Нет доступных баллов', type: 'info' });
                return;
              }
              setRedeemOpen(true);
            }}
            onClearDiscount={() =>
              void clearDiscount().catch(() =>
                notify({ title: 'Не удалось сбросить скидку', type: 'error' })
              )
            }
            onCancel={() =>
              void cancelOrder()
                .then(() => {
                  setOrderDrawerOpen(false);
                  notify({ title: 'Заказ отменён', type: 'info' });
                })
                .catch(() => notify({ title: 'Не удалось отменить заказ', type: 'error' }))
            }
            visible
          />
        </div>
      </div>
      <PaymentModal
        open={isPaymentOpen}
        total={total}
        method={paymentMethod}
        onClose={() => setPaymentOpen(false)}
        onConfirm={handlePayConfirm}
        isProcessing={isPaying}
      />
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
      {!isTablet ? (
        <div className="fixed inset-x-0 bottom-20 z-40 bg-white">
          <div className="flex items-center justify-around border-b border-slate-200 bg-white py-2">
            <TabButton label="Товары" active={activeSection === 'products'} onClick={() => setActiveSection('products')} />
            <TabButton label="Клиенты" active={activeSection === 'customers'} onClick={() => setActiveSection('customers')} />
            <TabButton label="Отчёты" active={activeSection === 'reports'} onClick={() => setActiveSection('reports')} />
          </div>
          <div
            className={`border-t border-slate-200 bg-white p-4 transition ${
              isOrderDrawerOpen ? 'shadow-2xl' : 'shadow-soft'
            }`}
          >
            <button
              type="button"
              onClick={() => setOrderDrawerOpen((prev) => !prev)}
              className="flex h-14 w-full items-center justify-between rounded-2xl bg-primary px-4 text-base font-semibold text-white shadow-soft"
            >
              <span>Заказ ({items.length})</span>
              <span>{total.toFixed(2)} ₽</span>
            </button>
            <div
              className={`fixed inset-x-0 bottom-36 z-30 max-h-[65vh] transform overflow-hidden rounded-t-3xl bg-white shadow-2xl transition-transform ${
                isOrderDrawerOpen ? 'translate-y-0' : 'translate-y-full'
              }`}
            >
              <OrderPanel
                items={items}
                subtotal={subtotal}
                discount={discount}
                total={total}
                status={status}
                onIncrement={(productId) =>
                  void updateItemQty(
                    productId,
                    (items.find((item) => item.productId === productId)?.qty || 0) + 1
                  )
                }
                onDecrement={(productId) =>
                  void updateItemQty(
                    productId,
                    (items.find((item) => item.productId === productId)?.qty || 0) - 1
                  )
                }
                onRemove={(productId) => void removeItem(productId)}
                onPay={(method) => openPaymentModal(method)}
                onComplete={() =>
                  void completeOrder()
                    .then(() => {
                      setOrderDrawerOpen(false);
                      notify({ title: 'Заказ завершён', type: 'success' });
                    })
                    .catch(() => notify({ title: 'Не удалось завершить заказ', type: 'error' }))
                }
                onAddCustomer={() => setLoyaltyOpen(true)}
                onClearCustomer={handleRemoveCustomer}
                isProcessing={isPaying}
                earnedPoints={earnedPoints}
                customer={customer}
                onRedeemLoyalty={() => {
                  if (!customer || customer.points <= 0) {
                    notify({ title: 'Нет доступных баллов', type: 'info' });
                    return;
                  }
                  setRedeemOpen(true);
                }}
                onClearDiscount={() =>
                  void clearDiscount().catch(() =>
                    notify({ title: 'Не удалось сбросить скидку', type: 'error' })
                  )
                }
                onCancel={() =>
                  void cancelOrder()
                    .then(() => {
                      setOrderDrawerOpen(false);
                      notify({ title: 'Заказ отменён', type: 'info' });
                    })
                    .catch(() => notify({ title: 'Не удалось отменить заказ', type: 'error' }))
                }
                visible={isOrderDrawerOpen}
              />
            </div>
          </div>
        </div>
      ) : null}
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

export default POSPage;
