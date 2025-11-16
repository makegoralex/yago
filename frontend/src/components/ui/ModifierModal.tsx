import React, { useEffect, useMemo, useState } from 'react';

import type { ModifierGroup, ModifierOption, Product } from '../../store/catalog';
import type { SelectedModifier } from '../../store/order';

type SelectionMap = Record<string, Set<string>>;

type ModifierModalProps = {
  product: Product;
  onClose: () => void;
  onConfirm: (modifiers: SelectedModifier[]) => void;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const ModifierModal: React.FC<ModifierModalProps> = ({ product, onClose, onConfirm }) => {
  const groups = useMemo<ModifierGroup[]>(() => product.modifierGroups ?? [], [product.modifierGroups]);
  const [selection, setSelection] = useState<SelectionMap>({});

  useEffect(() => {
    setSelection({});
  }, [product._id]);

  const toggleOption = (group: ModifierGroup, option: ModifierOption): void => {
    setSelection((prev) => {
      const current = new Set(prev[group._id] ?? []);

      if (group.selectionType === 'single') {
        current.clear();
        current.add(option._id);
      } else {
        if (current.has(option._id)) {
          current.delete(option._id);
        } else {
          current.add(option._id);
        }
      }

      return { ...prev, [group._id]: current };
    });
  };

  const selections: SelectedModifier[] = useMemo(() => {
    return groups
      .map((group) => {
        const selected = selection[group._id] ?? new Set<string>();
        const options = group.options
          .filter((option) => selected.has(option._id))
          .map((option) => ({
            optionId: option._id,
            name: option.name,
            priceChange: option.priceChange ?? 0,
            costChange: option.costChange ?? 0,
          }));

        return {
          groupId: group._id,
          groupName: group.name,
          selectionType: group.selectionType,
          required: group.required,
          options,
        } satisfies SelectedModifier;
      })
      .filter((modifier) => modifier.options.length > 0 || modifier.required);
  }, [groups, selection]);

  const priceAdjustment = selections.reduce(
    (acc, modifier) => acc + modifier.options.reduce((sum, option) => sum + option.priceChange, 0),
    0
  );
  const adjustedPrice = roundCurrency(product.price + priceAdjustment);

  const hasMissingRequired = groups.some((group) => group.required && !(selection[group._id]?.size));

  const handleConfirm = (): void => {
    if (hasMissingRequired) {
      return;
    }
    onConfirm(selections.filter((modifier) => modifier.options.length > 0));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-base font-semibold text-slate-900">{product.name}</p>
            <p className="text-xs text-slate-500">Выберите модификаторы</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-4">
          {groups.map((group) => {
            const selected = selection[group._id] ?? new Set<string>();
            const isSingle = group.selectionType === 'single';
            return (
              <div key={group._id} className="rounded-xl border border-slate-100 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{group.name}</p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      {isSingle ? 'Один вариант' : 'Можно несколько'}
                      {group.required ? ' · Обязательный' : ''}
                    </p>
                  </div>
                  {group.required && !selected.size ? (
                    <span className="text-[11px] font-semibold text-amber-600">Нужно выбрать</span>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {group.options.map((option) => {
                    const checked = selected.has(option._id);
                    const controlType = isSingle ? 'radio' : 'checkbox';
                    const priceLabel = option.priceChange
                      ? `${option.priceChange > 0 ? '+' : ''}${option.priceChange.toFixed(2)} ₽`
                      : null;
                    return (
                      <label
                        key={option._id}
                        className={`flex items-center justify-between rounded-lg border p-2 text-sm transition ${
                          checked ? 'border-secondary bg-secondary/5' : 'border-slate-200 hover:border-secondary/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type={controlType}
                            name={group._id}
                            checked={checked}
                            onChange={() => toggleOption(group, option)}
                          />
                          <span className="text-slate-800">{option.name}</span>
                        </div>
                        {priceLabel ? <span className="text-xs font-semibold text-slate-600">{priceLabel}</span> : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm text-slate-500">Итоговая цена</p>
            <p className="text-xl font-bold text-slate-900">{adjustedPrice.toFixed(2)} ₽</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-300"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={hasMissingRequired}
              onClick={handleConfirm}
              className="h-11 rounded-xl bg-secondary px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary/80 disabled:opacity-60"
            >
              Добавить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModifierModal;
