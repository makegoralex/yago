import React, { useEffect, useMemo, useState } from 'react';
import HeaderBar from '../components/ui/HeaderBar';
import CategorySidebar from '../components/ui/CategorySidebar';
import ProductCard from '../components/ui/ProductCard';
import OrderPanel from '../components/ui/OrderPanel';
import PaymentModal from '../components/ui/PaymentModal';
import LoyaltyModal from '../components/ui/LoyaltyModal';
import { useCatalogStore } from '../store/catalog';
import { useOrderStore } from '../store/order';
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
  const totals = useOrderStore((state) => state.totals);
  const addProduct = useOrderStore((state) => state.addProduct);
  const updateItemQty = useOrderStore((state) => state.updateItemQty);
  const removeItem = useOrderStore((state) => state.removeItem);
  const payOrder = useOrderStore((state) => state.payOrder);
  const createDraft = useOrderStore((state) => state.createDraft);
  const attachCustomer = useOrderStore((state) => state.attachCustomer);

  const { notify } = useToast();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOrderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [isPaymentOpen, setPaymentOpen] = useState(false);
  const [isLoyaltyOpen, setLoyaltyOpen] = useState(false);
  const [isPaying, setPaying] = useState(false);

  useEffect(() => {
    void fetchCatalog();
    createDraft().catch(() => {
      notify({ title: 'Ошибка заказа', description: 'Не удалось создать черновик заказа', type: 'error' });
    });
  }, [fetchCatalog, createDraft, notify]);

  useEffect(() => {
    if (!activeCategoryId && categories.length > 0) {
      setActiveCategory(categories[0]._id);
    }
  }, [activeCategoryId, categories, setActiveCategory]);

  const filteredProducts = useMemo(() => {
    if (!activeCategoryId) {
      return products;
    }
    return products.filter((product) => product.categoryId === activeCategoryId);
  }, [products, activeCategoryId]);

  const earnedPoints = totals.grandTotal * 0.05;

  const handlePay = async () => {
    setPaying(true);
    try {
      await payOrder();
      notify({ title: 'Оплата проведена', description: 'Чек успешно закрыт', type: 'success' });
      setPaymentOpen(false);
    } catch (error) {
      notify({ title: 'Ошибка оплаты', description: 'Попробуйте снова', type: 'error' });
    } finally {
      setPaying(false);
    }
  };

  const handleAttachCustomer = (customerId: string) => {
    attachCustomer(customerId);
    setLoyaltyOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-slate-100 px-4 py-4 pb-32 lg:px-6 lg:pb-6">
      <HeaderBar
        onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
        isSidebarCollapsed={sidebarCollapsed}
      />
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
            <button
              type="button"
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-500 lg:hidden"
              onClick={() => setOrderDrawerOpen(true)}
            >
              Смотреть заказ ({items.length})
            </button>
          </div>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-36 animate-pulse rounded-2xl bg-slate-200/70" />
              ))}
            </div>
          ) : (
            <div
              className={`grid gap-4 ${
                isDesktop ? 'xl:grid-cols-3' : isTablet ? 'lg:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
              }`}
            >
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  onSelect={(selectedProduct) => {
                    void addProduct(selectedProduct);
                    if (!isTablet) {
                      setOrderDrawerOpen(true);
                    }
                  }}
                />
              ))}
              {filteredProducts.length === 0 ? (
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
            subtotal={totals.subtotal}
            grandTotal={totals.grandTotal}
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
            onPay={() => setPaymentOpen(true)}
            onAddCustomer={() => setLoyaltyOpen(true)}
            isPaying={isPaying}
            earnedPoints={earnedPoints}
            visible
          />
        </div>
      </div>
      <PaymentModal
        open={isPaymentOpen}
        total={totals.grandTotal}
        onClose={() => setPaymentOpen(false)}
        onConfirm={handlePay}
        isProcessing={isPaying}
      />
      <LoyaltyModal open={isLoyaltyOpen} onClose={() => setLoyaltyOpen(false)} onAttach={handleAttachCustomer} />
      {!isTablet ? (
        <div
          className={`fixed inset-x-0 bottom-20 z-40 border-t border-slate-200 bg-white p-4 transition ${
            isOrderDrawerOpen ? 'shadow-2xl' : 'shadow-soft'
          }`}
        >
          <button
            type="button"
            onClick={() => setOrderDrawerOpen((prev) => !prev)}
            className="flex h-14 w-full items-center justify-between rounded-2xl bg-primary px-4 text-base font-semibold text-white shadow-soft"
          >
            <span>Заказ ({items.length})</span>
            <span>{totals.grandTotal.toFixed(2)} ₽</span>
          </button>
          <div
            className={`fixed inset-x-0 bottom-36 z-30 max-h-[65vh] transform overflow-hidden rounded-t-3xl bg-white shadow-2xl transition-transform ${
              isOrderDrawerOpen ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            <OrderPanel
              items={items}
              subtotal={totals.subtotal}
              grandTotal={totals.grandTotal}
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
              onPay={() => setPaymentOpen(true)}
              onAddCustomer={() => setLoyaltyOpen(true)}
              isPaying={isPaying}
              earnedPoints={earnedPoints}
              visible={isOrderDrawerOpen}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default POSPage;
