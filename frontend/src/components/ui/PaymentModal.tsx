import React from 'react';

type PaymentModalProps = {
  open: boolean;
  total: number;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing?: boolean;
};

const PaymentModal: React.FC<PaymentModalProps> = ({ open, total, onClose, onConfirm, isProcessing }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-soft">
        <h2 className="text-xl font-semibold text-slate-900">Подтверждение оплаты</h2>
        <p className="mt-2 text-sm text-slate-500">
          Проверьте сумму к оплате и подтвердите получение средств от клиента.
        </p>
        <div className="mt-6 rounded-2xl bg-slate-100 p-4 text-center">
          <p className="text-sm text-slate-500">Сумма чека</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{total.toFixed(2)} ₽</p>
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
            onClick={onConfirm}
            disabled={isProcessing}
            className="h-14 flex-1 rounded-2xl bg-primary text-base font-semibold text-white shadow-soft transition hover:bg-primary-dark disabled:opacity-70"
          >
            {isProcessing ? 'Обработка...' : 'Оплата получена'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
