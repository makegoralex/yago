import React, { useState, useEffect } from 'react';

export type RedeemPointsModalProps = {
  open: boolean;
  onClose: () => void;
  maxPoints: number;
  maxAmount: number;
  onSubmit: (points: number) => Promise<void> | void;
  isProcessing?: boolean;
};

const RedeemPointsModal: React.FC<RedeemPointsModalProps> = ({
  open,
  onClose,
  maxPoints,
  maxAmount,
  onSubmit,
  isProcessing = false,
}) => {
  const [points, setPoints] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPoints('');
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    const numeric = Number(points);

    if (Number.isNaN(numeric) || numeric <= 0) {
      setError('Введите количество баллов больше нуля');
      return;
    }

    if (numeric > maxPoints) {
      setError('Недостаточно баллов у клиента');
      return;
    }

    if (numeric > maxAmount) {
      setError('Баллы превышают сумму текущего заказа');
      return;
    }

    setError(null);
    await onSubmit(numeric);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Списать баллы</h2>
            <p className="mt-1 text-sm text-slate-500">
              Доступно {Math.floor(maxPoints)} баллов. Максимально можно списать {maxAmount.toFixed(2)} ₽ за заказ.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500"
          >
            Закрыть
          </button>
        </div>
        <div className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-slate-600">Количество баллов</label>
          <input
            type="number"
            min={1}
            max={Math.floor(Math.min(maxPoints, maxAmount))}
            value={points}
            onChange={(event) => setPoints(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base shadow-sm focus:border-secondary focus:bg-white"
          />
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isProcessing}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-secondary text-base font-semibold text-white shadow-soft transition hover:bg-secondary/80 disabled:opacity-60"
          >
            {isProcessing ? 'Применение...' : 'Применить'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-slate-200 text-base font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default RedeemPointsModal;
