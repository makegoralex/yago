import React, { useState } from 'react';

import type {
  AppliedDiscount,
  CustomerSummary,
  DiscountSummary,
  OrderItem,
  PaymentMethod,
  OrderTag,
} from '../../store/order';

type OrderPanelProps = {
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'draft' | 'paid' | 'completed' | null;
  onIncrement: (lineId: string) => void;
  onDecrement: (lineId: string) => void;
  onRemove: (lineId: string) => void;
  onPay: (method: PaymentMethod) => void;
  onAddCustomer: () => void;
  onClearCustomer?: () => void;
  isProcessing: boolean;
  earnedPoints?: number;
  visible?: boolean;
  customer?: CustomerSummary | null;
  onRedeemLoyalty?: () => void;
  onClearDiscount?: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
  availableDiscounts?: DiscountSummary[];
  appliedDiscounts?: AppliedDiscount[];
  selectedDiscountIds?: string[];
  onToggleDiscount?: (discountId: string) => void;
  isCompleting?: boolean;
  orderTagsEnabled?: boolean;
  orderTag?: OrderTag | null;
  onChangeOrderTag?: (tag: OrderTag | null) => void;
};

const statusLabels: Record<NonNullable<OrderPanelProps['status']>, string> = {
  draft: 'В работе',
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
  onAddCustomer,
  onClearCustomer,
  isProcessing,
  earnedPoints = 0,
  visible = true,
  customer,
  onRedeemLoyalty,
  onClearDiscount,
  onCancel,
  onComplete,
  availableDiscounts = [],
  appliedDiscounts = [],
  selectedDiscountIds = [],
  onToggleDiscount,
  isCompleting = false,
  orderTagsEnabled = false,
  orderTag = null,
  onChangeOrderTag,
}) => {
  const hasItems = items.length > 0;
  const canPay = status === null || status === 'draft';
  const canCancel = status === null || status === 'draft';
  const canComplete = status === 'paid';
  const customerPoints = Number(customer?.points ?? 0);
  const selectableDiscounts = availableDiscounts.filter((discount) => !discount.autoApply);
  const autoAppliedDiscounts = availableDiscounts.filter((discount) => discount.autoApply);
  const hasManualDiscount = appliedDiscounts.some((discount) => discount.application === 'manual');
  const hasResettableDiscounts = hasManualDiscount || selectedDiscountIds.length > 0;
  const tagOptions: Array<{ value: OrderTag | null; label: string }> = [
    { value: null, label: 'В заведении' },
    { value: 'takeaway', label: 'С собой' },
    { value: 'delivery', label: 'Доставка' },
  ];
  const [isTagHintOpen, setTagHintOpen] = useState(false);

  const formatDiscountLabel = (discount: AppliedDiscount): string => {
    const parts: string[] = [discount.name];
    if (discount.targetName) {
      parts.push(`(${discount.targetName})`);
    }
    if (discount.application === 'auto') {
      parts.push('[авто]');
    } else if (discount.application === 'manual') {
      parts.push('[ручная]');
    }
    return parts.join(' ');
  };

  const formatDiscountValue = (discount: DiscountSummary): string => {
    if (discount.type === 'percentage') {
      return `−${discount.value}%`;
    }

    return `−${discount.value.toFixed(2)} ₽`;
  };

  return (
    <aside
      className={`custom-scrollbar flex h-full w-full min-h-0 flex-col overflow-y-auto rounded-xl bg-white shadow-soft transition-transform ${
        visible ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-base font-semibold text-slate-900">Текущий заказ</p>
          <p className="text-xs text-slate-500">{items.length} позиций</p>
        </div>
        <div className="flex items-center gap-2">
          {status && status !== 'draft' ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase text-slate-600">
              {statusLabels[status]}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onAddCustomer}
            className="h-10 rounded-lg border border-secondary/40 px-3 text-xs font-semibold text-secondary transition hover:bg-secondary/10"
          >
            Добавить клиента
          </button>
          {onClearCustomer ? (
            <button
              type="button"
              onClick={onClearCustomer}
              className="h-10 rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100"
            >
              Сбросить
            </button>
          ) : null}
        </div>
      </div>
      {orderTagsEnabled ? (
        <div className="mx-4 mb-3">
          <p className="mb-2 text-[11px] font-semibold uppercase text-slate-400">Тип заказа</p>
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-100 bg-slate-50 p-1.5">
            {tagOptions.map((option) => {
              const isSelected = option.value === (orderTag ?? null);
              return (
                <button
                  key={option.value ?? 'dine-in'}
                  type="button"
                  onClick={() => onChangeOrderTag?.(option.value ?? null)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    isSelected
                      ? 'border border-secondary bg-secondary/15 text-secondary shadow-sm'
                      : 'border border-transparent text-slate-600 hover:border-secondary/30'
                  } ${onChangeOrderTag ? '' : 'cursor-not-allowed opacity-60'}`}
                  disabled={!onChangeOrderTag}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="relative mx-4 mb-3 flex items-center justify-between rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          <span>Метки заказов выключены</span>
          <button
            type="button"
            onClick={() => setTagHintOpen((prev) => !prev)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:text-slate-600"
            aria-label="Подсказка по меткам заказов"
          >
            i
          </button>
          {isTagHintOpen ? (
            <div className="absolute right-6 mt-20 w-56 rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-500 shadow-soft">
              Чтобы отмечать «С собой» и «Доставка», включите метки в разделе «Ресторан» админ-панели.
            </div>
          ) : null}
        </div>
      )}
      {customer ? (
        <div className="mx-4 mb-3 rounded-xl border border-secondary/20 bg-secondary/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{customer.name}</p>
              <p className="text-xs text-slate-500">{customer.phone ?? '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase text-slate-400">Баллы</p>
              <p className="text-base font-semibold text-emerald-600">{customerPoints.toFixed(0)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRedeemLoyalty}
              className="h-10 rounded-lg bg-secondary px-4 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary/80 disabled:opacity-60"
            >
              Списать баллы
            </button>
            {hasResettableDiscounts ? (
              <button
                type="button"
                onClick={onClearDiscount}
                className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Сбросить скидку
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {selectableDiscounts.length > 0 ? (
        <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-800">Доступные скидки</p>
            {onClearDiscount && hasResettableDiscounts ? (
              <button
                type="button"
                onClick={onClearDiscount}
                className="text-xs font-semibold text-amber-700 hover:underline"
              >
                Сбросить все
              </button>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectableDiscounts.map((discountOption) => {
              const isSelected = selectedDiscountIds.includes(discountOption._id);
              return (
                <button
                  key={discountOption._id}
                  type="button"
                  onClick={() => onToggleDiscount?.(discountOption._id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500 text-white'
                      : 'border-amber-200 bg-white text-amber-700 hover:border-amber-400'
                  }`}
                >
                  <span>{discountOption.name}</span>
                  <span className="ml-2 text-[10px] uppercase text-amber-200">
                    {formatDiscountValue(discountOption)}
                  </span>
                </button>
              );
            })}
          </div>
          {autoAppliedDiscounts.length > 0 ? (
            <p className="mt-3 text-xs text-amber-700">
              Автоматические скидки активны для категорий:{' '}
              {autoAppliedDiscounts.map((discount) => discount.targetName ?? discount.name).join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex-1 px-4">
        {!hasItems ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-slate-400">
            Добавьте товары из каталога
          </div>
        ) : (
          <ul className="space-y-2.5">
            {items.map((item) => (
              <li key={item.lineId} className="rounded-xl border border-slate-100 p-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.price.toFixed(2)} ₽</p>
                    {item.modifiersApplied?.length ? (
                      <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                        {item.modifiersApplied.map((modifier) => (
                          <li key={`${item.lineId}-${modifier.groupId}`}>
                            <span className="font-semibold text-slate-600">{modifier.groupName}:</span>{' '}
                            {modifier.options.map((option) => option.name).join(', ')}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onDecrement(item.lineId)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-base font-semibold text-slate-700 transition hover:border-slate-300"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-semibold text-slate-900">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => onIncrement(item.lineId)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-base font-semibold text-slate-700 transition hover:border-slate-300"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Итого</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{item.total.toFixed(2)} ₽</span>
                    <button
                      type="button"
                      onClick={() => onRemove(item.lineId)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-xs text-slate-400 transition hover:border-red-200 hover:text-red-500"
                      aria-label="Удалить позицию"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2 border-t border-slate-100 p-4">
        <div className="space-y-1 divide-y divide-slate-100 text-sm text-slate-600">
          <div className="flex items-center justify-between pb-2">
            <span>Сумма</span>
            <span className="text-base font-semibold text-slate-900">{subtotal.toFixed(2)} ₽</span>
          </div>
          {discount > 0 ? (
            <div className="flex items-center justify-between py-2 text-amber-700">
              <span>Скидка</span>
              <span className="text-base font-semibold">−{discount.toFixed(2)} ₽</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between pt-2 text-slate-600">
            <span className="text-sm font-semibold">К оплате</span>
            <span className="text-2xl font-bold text-slate-900">{total.toFixed(2)} ₽</span>
          </div>
        </div>
        {appliedDiscounts.length > 0 ? (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
            <p className="font-semibold">Применённые скидки</p>
            <ul className="mt-2 space-y-1">
              {appliedDiscounts.map((discountEntry) => (
                <li key={`${discountEntry.discountId ?? discountEntry.name}-${discountEntry.application}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">{formatDiscountLabel(discountEntry)}</span>
                  <span className="font-semibold">−{discountEntry.amount.toFixed(2)} ₽</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {earnedPoints > 0 ? (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-600">
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
        {onComplete && canComplete ? (
          <button
            type="button"
            onClick={onComplete}
            disabled={isProcessing || isCompleting}
            className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-primary/40 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/5 disabled:opacity-60"
          >
            {isCompleting ? 'Завершение…' : 'Завершить заказ'}
          </button>
        ) : null}
        {onCancel && canCancel ? (
          <button
            type="button"
            disabled={isProcessing}
            onClick={onCancel}
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-50"
          >
            Отменить заказ
          </button>
        ) : null}
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
    className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white shadow-soft transition hover:bg-primary-dark disabled:opacity-60"
  >
    {label}
  </button>
);

export default OrderPanel;
