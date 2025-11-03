import React from 'react';
import type { OrderItem } from '../../store/order';

export type OrderPanelProps = {
  items: OrderItem[];
  subtotal: number;
  grandTotal: number;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
  onPay: () => void;
  onAddCustomer: () => void;
  isPaying: boolean;
  earnedPoints?: number;
  visible?: boolean;
};

const OrderPanel: React.FC<OrderPanelProps> = ({
  items,
  subtotal,
  grandTotal,
  onIncrement,
  onDecrement,
  onRemove,
  onPay,
  onAddCustomer,
  isPaying,
  earnedPoints = 0,
  visible = true,
}) => {
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
        <button
          type="button"
          onClick={onAddCustomer}
          className="rounded-2xl border border-secondary/30 px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary/10"
        >
          Добавить клиента
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4">
        {items.length === 0 ? (
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
        {earnedPoints > 0 ? (
          <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
            <span>Будет начислено</span>
            <span className="font-semibold">{earnedPoints.toFixed(0)} баллов</span>
          </div>
        ) : null}
        <button
          type="button"
          disabled={items.length === 0 || isPaying}
          onClick={onPay}
          className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-white shadow-soft transition hover:bg-primary-dark disabled:opacity-70"
        >
          Оплатить {grandTotal.toFixed(2)} ₽
        </button>
      </div>
    </aside>
  );
};

export default OrderPanel;
