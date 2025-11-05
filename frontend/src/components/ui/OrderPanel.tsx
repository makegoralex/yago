import React from 'react';

import type { CustomerSummary, OrderItem, PaymentMethod } from '../../store/order';

type OrderPanelProps = {
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'draft' | 'paid' | 'completed' | null;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
  onPay: (method: PaymentMethod) => void;
  onComplete: () => void;
  onAddCustomer: () => void;
  onClearCustomer?: () => void;
  isProcessing: boolean;
  earnedPoints?: number;
  visible?: boolean;
  customer?: CustomerSummary | null;
  onRedeemLoyalty?: () => void;
  onClearDiscount?: () => void;
};

const statusLabels: Record<NonNullable<OrderPanelProps['status']>, string> = {
  draft: 'Черновик',
  paid: 'Оплачен',
  completed: 'Завершён',
};

const OrderPanel: React.FC<OrderPanelProps> = ({
  items,
  subtotal,
  discount,
  total,
  status,
  onIncrement,
  onDecrement,
  onRemove,
  onPay,
  onComplete,
  onAddCustomer,
  onClearCustomer,
  isProcessing,
  earnedPoints = 0,
  visible = true,
  customer,
  onRedeemLoyalty,
  onClearDiscount,
}) => {
  const hasItems = items.length > 0;
  const canPay = status === null || status === 'draft';
  const canComplete = status === 'paid';

  return (
    <aside
      className={`flex h-full w-full flex-col rounded-2xl bg-white shadow-soft transition-transform lg:w-[360px] ${
        visible ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-lg font-semibold text-slate-900">Текущий заказ</p>
          <p className="text-sm text-slate-500">{items.length} позиций</p>
        </div>
        <div className="flex items-center gap-2">
          {status ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-500">
              {statusLabels[status]}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onAddCustomer}
            className="rounded-2xl border border-secondary/30 px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary/10"
          >
            Добавить клиента
          </button>
          {onClearCustomer ? (
            <button
              type="button"
              onClick={onClearCustomer}
              className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
            >
              Сбросить
            </button>
          ) : null}
        </div>
      </div>
      {customer ? (
        <div className="mx-4 mb-3 rounded-2xl border border-secondary/20 bg-secondary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-slate-900">{customer.name}</p>
              <p className="text-sm text-slate-500">{customer.phone}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-slate-400">Баллы</p>
              <p className="text-lg font-semibold text-emerald-600">{customer.points.toFixed(0)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRedeemLoyalty}
              className="rounded-2xl bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary/80 disabled:opacity-60"
            >
              Списать баллы
            </button>
            {discount > 0 ? (
              <button
                type="button"
                onClick={onClearDiscount}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
              >
                Сбросить скидку
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto px-4">
        {!hasItems ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
            Добавьте товары из каталога
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.productId} className="rounded-2xl border border-slate-100 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">{item.price.toFixed(2)} ₽</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onDecrement(item.productId)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-base font-semibold">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => onIncrement(item.productId)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                  <span>Итого</span>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-slate-900">{item.total.toFixed(2)} ₽</span>
                    <button
                      type="button"
                      onClick={() => onRemove(item.productId)}
                      className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-500"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-3 border-t border-slate-100 p-4">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Сумма</span>
          <span className="text-base font-semibold text-slate-900">{subtotal.toFixed(2)} ₽</span>
        </div>
        {discount > 0 ? (
          <div className="flex items-center justify-between text-sm text-amber-600">
            <span>Скидка</span>
            <span className="text-base font-semibold">−{discount.toFixed(2)} ₽</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>К оплате</span>
          <span className="text-xl font-semibold text-slate-900">{total.toFixed(2)} ₽</span>
        </div>
        {earnedPoints > 0 ? (
          <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
            <span>Будет начислено</span>
            <span className="font-semibold">{earnedPoints.toFixed(0)} баллов</span>
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <ActionButton
            label="Оплата наличными"
            onClick={() => onPay('cash')}
            disabled={!hasItems || !canPay || isProcessing}
          />
          <ActionButton
            label="Оплата картой"
            onClick={() => onPay('card')}
            disabled={!hasItems || !canPay || isProcessing}
          />
        </div>
        <button
          type="button"
          disabled={!canComplete || isProcessing}
          onClick={onComplete}
          className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-slate-900 text-base font-semibold text-white shadow-soft transition hover:bg-slate-800 disabled:opacity-60"
        >
          Завершить заказ
        </button>
      </div>
    </aside>
  );
};

type ActionButtonProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

const ActionButton: React.FC<ActionButtonProps> = ({ label, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-white shadow-soft transition hover:bg-primary-dark disabled:opacity-60"
  >
    {label}
  </button>
);

export default OrderPanel;
