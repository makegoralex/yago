import React, { useEffect, useMemo, useState } from 'react';
import { Coffee, Plus, Trash2 } from 'lucide-react';
import NumberField from '../../components/tools/NumberField';
import ToolShell from '../../components/tools/ToolShell';
import { calculateDrinkEconomics, calculateIngredientCost } from '../../features/tools/calculations';
import { formatMoney, formatPercent } from '../../features/tools/format';
import { buildToolSchema, getTool, SITE_URL } from '../../features/tools/toolRegistry';
import { applySeo } from '../../lib/seo';

type IngredientRow = {
  id: number;
  name: string;
  packagePrice: number;
  packageAmount: number;
  recipeAmount: number;
  unit: 'г' | 'мл' | 'шт';
};

const tool = getTool('drink-cost-calculator')!;

const initialIngredients: IngredientRow[] = [
  { id: 1, name: 'Кофе в зёрнах', packagePrice: 1800, packageAmount: 1000, recipeAmount: 18, unit: 'г' },
  { id: 2, name: 'Молоко', packagePrice: 95, packageAmount: 1000, recipeAmount: 180, unit: 'мл' },
];

const DrinkCostCalculatorPage: React.FC = () => {
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [wastePercent, setWastePercent] = useState(5);
  const [packagingCost, setPackagingCost] = useState(14);
  const [otherVariableCost, setOtherVariableCost] = useState(3);
  const [salePrice, setSalePrice] = useState(260);
  const [targetFoodCostPercent, setTargetFoodCostPercent] = useState(28);

  useEffect(() => {
    applySeo({
      title: 'Калькулятор себестоимости напитка и кофе онлайн — бесплатно',
      description: tool.description,
      keywords: tool.keywords,
      canonicalUrl: `${SITE_URL}${tool.path}`,
      structuredData: buildToolSchema(tool),
    });
  }, []);

  const ingredientCosts = useMemo(
    () => ingredients.map((item) => ({ ...item, cost: calculateIngredientCost(item) })),
    [ingredients]
  );
  const rawIngredientCost = ingredientCosts.reduce((sum, item) => sum + item.cost, 0);
  const result = calculateDrinkEconomics({
    ingredientCost: rawIngredientCost,
    wastePercent,
    packagingCost,
    otherVariableCost,
    salePrice,
    targetFoodCostPercent,
  });

  const updateIngredient = (id: number, patch: Partial<IngredientRow>) => {
    setIngredients((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addIngredient = () => {
    setIngredients((current) => [
      ...current,
      { id: Date.now(), name: 'Новый ингредиент', packagePrice: 0, packageAmount: 1000, recipeAmount: 0, unit: 'г' },
    ]);
  };

  return (
    <ToolShell
      tool={tool}
      intro="Добавьте ингредиенты по закупочным ценам и нормам рецептуры. Калькулятор покажет себестоимость порции, фудкост, валовую прибыль и цену для целевого фудкоста."
      methodology={
        <>
          <p><strong>Стоимость ингредиента</strong> = цена упаковки ÷ объём упаковки × количество в рецепте. Единицы упаковки и рецепта должны совпадать.</p>
          <p><strong>Себестоимость порции</strong> = ингредиенты с учётом потерь + упаковка + другие переменные расходы. Фудкост = себестоимость ÷ цена продажи × 100%.</p>
          <p><strong>Рекомендуемая цена</strong> = себестоимость ÷ целевой фудкост. Постоянные расходы кофейни не включаются в техкарту — их проверяют в калькуляторе безубыточности.</p>
        </>
      }
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <section className="min-w-0 rounded-3xl border border-amber-200 bg-white p-5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Состав напитка</p>
              <h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Ингредиенты на одну порцию</h2>
            </div>
            <button type="button" onClick={addIngredient} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-100 px-4 text-sm font-semibold text-amber-950 hover:bg-amber-200">
              <Plus size={17} /> Добавить ингредиент
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {ingredientCosts.map((item, index) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-900">{index + 1}</span>
                  <input
                    aria-label={`Название ингредиента ${index + 1}`}
                    value={item.name}
                    onChange={(event) => updateIngredient(item.id, { name: event.target.value })}
                    className="h-10 min-w-0 flex-1 bg-white px-3 font-semibold text-slate-900"
                  />
                  {ingredients.length > 1 ? (
                    <button type="button" onClick={() => setIngredients((current) => current.filter((row) => row.id !== item.id))} aria-label={`Удалить ${item.name}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={18} />
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <NumberField id={`price-${item.id}`} label="Цена упаковки" value={item.packagePrice} onChange={(value) => updateIngredient(item.id, { packagePrice: value })} suffix="₽" step={0.01} />
                  <NumberField id={`pack-${item.id}`} label="В упаковке" value={item.packageAmount} onChange={(value) => updateIngredient(item.id, { packageAmount: value })} suffix={item.unit} step={0.1} />
                  <div className="grid grid-cols-[1fr_78px] gap-2">
                    <NumberField id={`recipe-${item.id}`} label="В рецепте" value={item.recipeAmount} onChange={(value) => updateIngredient(item.id, { recipeAmount: value })} step={0.1} />
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">Ед.</span>
                      <select value={item.unit} onChange={(event) => updateIngredient(item.id, { unit: event.target.value as IngredientRow['unit'] })} className="mt-1.5 h-11 w-full bg-white px-2 text-sm">
                        <option>г</option><option>мл</option><option>шт</option>
                      </select>
                    </label>
                  </div>
                  <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">В порции</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{formatMoney(item.cost, 2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 rounded-2xl bg-amber-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField id="waste" label="Потери и списания" value={wastePercent} onChange={setWastePercent} suffix="%" max={100} step={0.1} hint="Пролив, остатки, естественные потери" />
            <NumberField id="packaging" label="Стакан и упаковка" value={packagingCost} onChange={setPackagingCost} suffix="₽" step={0.01} />
            <NumberField id="other-variable" label="Другие переменные" value={otherVariableCost} onChange={setOtherVariableCost} suffix="₽" step={0.01} hint="Например, эквайринг на порцию" />
            <NumberField id="sale-price" label="Цена продажи" value={salePrice} onChange={setSalePrice} suffix="₽" step={1} />
          </div>
        </section>

        <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-3xl bg-slate-950 text-white">
            <div className="border-b border-white/10 p-6">
              <div className="flex items-center gap-3 text-amber-300"><Coffee size={22} /><span className="text-sm font-semibold uppercase tracking-wide">Результат на порцию</span></div>
              <div className="mt-4 text-4xl font-semibold">{formatMoney(result.totalCost, 2)}</div>
              <p className="mt-1 text-sm text-slate-400">Полная переменная себестоимость</p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-white/10">
              <div className="bg-slate-950 p-5"><div className="text-xs text-slate-400">Фудкост</div><div className="mt-1 text-xl font-semibold">{formatPercent(result.foodCostPercent)}</div></div>
              <div className="bg-slate-950 p-5"><div className="text-xs text-slate-400">Валовая прибыль</div><div className={`mt-1 text-xl font-semibold ${result.grossProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatMoney(result.grossProfit, 2)}</div></div>
              <div className="bg-slate-950 p-5"><div className="text-xs text-slate-400">Наценка</div><div className="mt-1 text-xl font-semibold">{formatPercent(result.markupPercent)}</div></div>
              <div className="bg-slate-950 p-5"><div className="text-xs text-slate-400">Ингредиенты</div><div className="mt-1 text-xl font-semibold">{formatMoney(result.adjustedIngredients, 2)}</div></div>
            </div>
            <div className="p-6">
              <div className="rounded-2xl bg-white p-4 text-slate-900">
                <NumberField id="target-food-cost" label="Целевой фудкост" value={targetFoodCostPercent} onChange={setTargetFoodCostPercent} suffix="%" min={1} max={100} step={1} />
              </div>
              <div className="mt-4 rounded-2xl bg-amber-400 p-4 text-slate-950">
                <div className="text-xs font-bold uppercase tracking-wide">Цена для цели</div>
                <div className="mt-1 text-3xl font-semibold">{formatMoney(result.recommendedPrice)}</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </ToolShell>
  );
};

export default DrinkCostCalculatorPage;
