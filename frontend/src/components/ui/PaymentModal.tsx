import React, { useEffect, useMemo, useState } from 'react';

import type { PaymentMethod } from '../../store/order';

type PaymentModalProps = {
  open: boolean;
  total: number;
  method: PaymentMethod;
  onClose: () => void;
  onConfirm: (payload: { method: PaymentMethod; amountTendered: number; change?: number }) => void;
  isProcessing?: boolean;
};

const PaymentModal: React.FC<PaymentModalProps> = ({ open, total, method, onClose, onConfirm, isProcessing }) => {
  const [amount, setAmount] = useState(() => total.toFixed(2));

  useEffect(() => {
    if (open) {
      setAmount(total.toFixed(2));
    }
  }, [open, total]);

  const parsedAmount = useMemo(() => {
    const numeric = Number.parseFloat(amount.replace(',', '.'));
    return Number.isNaN(numeric) ? 0 : numeric;
  }, [amount]);

  const change = useMemo(() => {
    if (method !== 'cash') {
      return 0;
    }
    return Math.max(parsedAmount - total, 0);
  }, [method, parsedAmount, total]);

  if (!open) return null;

  const handleSubmit = () => {
    onConfirm({
      method,
      amountTendered: parsedAmount,
      change: method === 'cash' ? change : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-soft">
        <h2 className="text-xl font-semibold text-slate-900">Подтверждение оплаты</h2>
        <p className="mt-2 text-sm text-slate-500">
          Выбранный метод: <span className="font-semibold text-slate-700">{method === 'cash' ? 'Наличные' : 'Карта'}</span>
        </p>
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl bg-slate-100 p-4 text-center">
            <p className="text-sm text-slate-500">Сумма к оплате</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{total.toFixed(2)} ₽</p>
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
            Сумма получена
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              min={0}
              step="0.01"
              disabled={method === 'card'}
              onChange={(event) => setAmount(event.target.value)}
              className="h-14 rounded-2xl border border-slate-200 px-4 text-base font-semibold text-slate-800 focus:border-primary focus:outline-none"
            />
          </label>
          {method === 'cash' ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
              Сдача: <span className="font-semibold">{change.toFixed(2)} ₽</span>
            </div>
          ) : null}
        </div>
        <div className="mt-8 flex flex-col gap-3 md:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="h-14 flex-1 rounded-2xl border border-slate-200 text-base font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isProcessing || parsedAmount <= 0}
            className="h-14 flex-1 rounded-2xl bg-primary text-base font-semibold text-white shadow-soft transition hover:bg-primary-dark disabled:opacity-70"
          >
            {isProcessing ? 'Обработка...' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
