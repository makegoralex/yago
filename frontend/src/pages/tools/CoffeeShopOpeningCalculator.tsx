import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarClock, WalletCards } from 'lucide-react';
import NumberField from '../../components/tools/NumberField';
import ToolShell from '../../components/tools/ToolShell';
import { calculateOpeningPlan } from '../../features/tools/calculations';
import { formatMoney, formatNumber, formatPercent } from '../../features/tools/format';
import { buildToolSchema, getTool, SITE_URL } from '../../features/tools/toolRegistry';
import { applySeo } from '../../lib/seo';

const tool = getTool('coffee-shop-opening-calculator')!;

type OpeningCosts = {
  depositAndRent: number;
  renovation: number;
  coffeeEquipment: number;
  kitchenEquipment: number;
  furniture: number;
  cashAndAutomation: number;
  initialStock: number;
  legalAndPermits: number;
  launchMarketing: number;
};

type Preset = {
  label: string;
  costs: OpeningCosts;
  averageCheck: number;
  checksPerDay: number;
  fixedCosts: number;
};

const presets: Record<string, Preset> = {
  island: {
    label: 'Островок / coffee-to-go',
    costs: { depositAndRent: 180000, renovation: 250000, coffeeEquipment: 650000, kitchenEquipment: 80000, furniture: 120000, cashAndAutomation: 90000, initialStock: 100000, legalAndPermits: 50000, launchMarketing: 100000 },
    averageCheck: 300, checksPerDay: 110, fixedCosts: 480000,
  },
  coffeeShop: {
    label: 'Кофейня с посадкой',
    costs: { depositAndRent: 450000, renovation: 1800000, coffeeEquipment: 950000, kitchenEquipment: 450000, furniture: 650000, cashAndAutomation: 140000, initialStock: 180000, legalAndPermits: 90000, launchMarketing: 220000 },
    averageCheck: 470, checksPerDay: 120, fixedCosts: 850000,
  },
  bakery: {
    label: 'Кофейня-пекарня',
    costs: { depositAndRent: 600000, renovation: 2600000, coffeeEquipment: 1000000, kitchenEquipment: 1700000, furniture: 850000, cashAndAutomation: 180000, initialStock: 300000, legalAndPermits: 130000, launchMarketing: 300000 },
    averageCheck: 620, checksPerDay: 140, fixedCosts: 1250000,
  },
};

const costLabels: Record<keyof OpeningCosts, string> = {
  depositAndRent: 'Депозит и аренда до открытия',
  renovation: 'Ремонт и инженерные работы',
  coffeeEquipment: 'Кофейное оборудование',
  kitchenEquipment: 'Кухня и прочее оборудование',
  furniture: 'Мебель, свет и интерьер',
  cashAndAutomation: 'Касса и автоматизация',
  initialStock: 'Первая закупка сырья',
  legalAndPermits: 'Регистрация и документы',
  launchMarketing: 'Вывеска и запуск рекламы',
};

const CoffeeShopOpeningCalculatorPage: React.FC = () => {
  const [format, setFormat] = useState('coffeeShop');
  const [costs, setCosts] = useState<OpeningCosts>(presets.coffeeShop.costs);
  const [contingencyPercent, setContingencyPercent] = useState(12);
  const [reserveMonths, setReserveMonths] = useState(2);
  const [monthlyFixedCosts, setMonthlyFixedCosts] = useState(presets.coffeeShop.fixedCosts);
  const [averageCheck, setAverageCheck] = useState(presets.coffeeShop.averageCheck);
  const [checksPerDay, setChecksPerDay] = useState(presets.coffeeShop.checksPerDay);
  const [workingDays, setWorkingDays] = useState(30);
  const [variableCostPercent, setVariableCostPercent] = useState(39);

  useEffect(() => {
    applySeo({
      title: 'Калькулятор открытия кофейни: бюджет и окупаемость',
      description: tool.description,
      keywords: tool.keywords,
      canonicalUrl: `${SITE_URL}${tool.path}`,
      structuredData: buildToolSchema(tool),
    });
  }, []);

  const oneTimeCosts = Object.values(costs).reduce((sum, value) => sum + value, 0);
  const result = useMemo(
    () => calculateOpeningPlan({ oneTimeCosts, contingencyPercent, monthlyFixedCosts, reserveMonths, averageCheck, checksPerDay, workingDays, variableCostPercent }),
    [oneTimeCosts, contingencyPercent, monthlyFixedCosts, reserveMonths, averageCheck, checksPerDay, workingDays, variableCostPercent]
  );

  const applyPreset = (nextFormat: string) => {
    const preset = presets[nextFormat];
    setFormat(nextFormat);
    setCosts(preset.costs);
    setAverageCheck(preset.averageCheck);
    setChecksPerDay(preset.checksPerDay);
    setMonthlyFixedCosts(preset.fixedCosts);
  };

  return (
    <ToolShell
      tool={tool}
      intro="Выберите формат и скорректируйте расходы под свой город и помещение. Калькулятор соберёт полный объём финансирования, месячную экономику и ориентировочный срок окупаемости."
      methodology={
        <>
          <p><strong>Бюджет запуска</strong> = разовые расходы + резерв на непредвиденные работы + оборотный капитал. Оборотный капитал рассчитан как постоянные расходы за выбранное число месяцев.</p>
          <p><strong>Прогноз прибыли</strong> использует средний чек × чеки в день × рабочие дни, затем вычитает переменные и постоянные расходы.</p>
          <p><strong>Срок окупаемости</strong> = полный объём финансирования ÷ плановая операционная прибыль. Это упрощённая оценка без дисконтирования, кредитных процентов и сезонности.</p>
        </>
      }
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <section className="min-w-0 space-y-5">
          <div className="rounded-3xl border border-emerald-200 bg-white p-5 sm:p-7">
            <div className="grid gap-5 sm:grid-cols-[1fr_1.2fr] sm:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Сценарий</p>
                <h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Формат заведения</h2>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Использовать стартовый пример</span>
                <select value={format} onChange={(event) => applyPreset(event.target.value)} className="mt-1.5 h-11 w-full bg-white px-3 text-base font-medium">
                  {Object.entries(presets).map(([key, preset]) => <option key={key} value={key}>{preset.label}</option>)}
                </select>
              </label>
            </div>
            <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">Примерные значения нужны только как отправная точка. Замените их предложениями арендодателя и поставщиков вашего города.</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Разовые расходы</p>
            <h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Что понадобится до открытия</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(costLabels) as (keyof OpeningCosts)[]).map((key) => (
                <NumberField key={key} id={`opening-${key}`} label={costLabels[key]} value={costs[key]} onChange={(value) => setCosts((current) => ({ ...current, [key]: value }))} suffix="₽" />
              ))}
            </div>
            <div className="mt-5 grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
              <NumberField id="contingency" label="Резерв на непредвиденное" value={contingencyPercent} onChange={setContingencyPercent} suffix="%" max={100} hint="Обычно закладывают поверх сметы" />
              <NumberField id="reserve-months" label="Оборотный запас" value={reserveMonths} onChange={setReserveMonths} suffix="мес" max={12} step={0.5} hint="Сколько месяцев постоянных расходов держать в запасе" />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">После запуска</p>
            <h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Плановая экономика месяца</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField id="opening-average-check" label="Средний чек" value={averageCheck} onChange={setAverageCheck} suffix="₽" />
              <NumberField id="opening-checks" label="Чеков в день" value={checksPerDay} onChange={setChecksPerDay} suffix="шт" />
              <NumberField id="opening-days" label="Рабочих дней" value={workingDays} onChange={setWorkingDays} suffix="дн" min={1} max={31} />
              <NumberField id="opening-variable" label="Переменные расходы" value={variableCostPercent} onChange={setVariableCostPercent} suffix="%" max={99} hint="Сырьё, упаковка, эквайринг, налоги с оборота" />
              <div className="sm:col-span-2">
                <NumberField id="opening-fixed" label="Постоянные расходы в месяц" value={monthlyFixedCosts} onChange={setMonthlyFixedCosts} suffix="₽" hint="Аренда, ФОТ, коммунальные, маркетинг и сервисы" />
              </div>
            </div>
          </div>
        </section>

        <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-950 via-slate-950 to-teal-950 text-white">
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-2 text-emerald-300"><WalletCards size={22} /><span className="text-sm font-semibold uppercase tracking-wide">Нужно на открытие</span></div>
              <div className="mt-4 text-4xl font-semibold sm:text-5xl">{formatMoney(result.totalFunding)}</div>
              <p className="mt-2 text-sm text-slate-400">Полный объём финансирования с резервом</p>
            </div>

            <div className="space-y-3 border-y border-white/10 p-6 sm:p-8">
              {[
                ['Разовая смета', result.baseInvestment],
                [`Непредвиденное (${formatPercent(contingencyPercent, 0)})`, result.contingency],
                [`Оборотный запас (${formatNumber(reserveMonths, 1)} мес.)`, result.workingCapital],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between gap-4 text-sm"><span className="text-slate-400">{label}</span><span className="font-semibold text-white">{formatMoney(Number(value))}</span></div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-px bg-white/10">
              <div className="bg-slate-950/80 p-5"><div className="text-xs text-slate-400">Выручка в месяц</div><div className="mt-1 text-xl font-semibold">{formatMoney(result.revenue)}</div></div>
              <div className="bg-slate-950/80 p-5"><div className="text-xs text-slate-400">Прибыль в месяц</div><div className={`mt-1 text-xl font-semibold ${result.operatingProfit > 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatMoney(result.operatingProfit)}</div></div>
              <div className="bg-slate-950/80 p-5"><div className="text-xs text-slate-400">Безубыточность</div><div className="mt-1 text-xl font-semibold">{formatMoney(result.breakEvenRevenue)}</div></div>
              <div className="bg-slate-950/80 p-5"><div className="text-xs text-slate-400">Чеков до нуля</div><div className="mt-1 text-xl font-semibold">{formatNumber(Math.ceil(result.breakEvenChecksPerDay))}/день</div></div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-2 text-teal-300"><CalendarClock size={21} /><span className="text-sm font-semibold">Ориентир окупаемости</span></div>
              <div className="mt-3 rounded-2xl bg-white/10 p-5">
                {result.paybackMonths === null ? (
                  <><div className="text-2xl font-semibold text-amber-300">Не окупается</div><p className="mt-2 text-sm text-slate-300">При текущем плане прибыль отрицательная. Увеличьте поток/чек или сократите расходы.</p></>
                ) : (
                  <><div className="text-3xl font-semibold">≈ {formatNumber(result.paybackMonths, 1)} мес.</div><p className="mt-2 text-sm text-slate-300">Без учёта сезонности, кредита и стоимости денег во времени.</p></>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-emerald-950">
            <div className="flex items-center gap-2 font-semibold"><Building2 size={18} /> Перед подписанием аренды</div>
            <p className="mt-2">Сделайте три сценария: осторожный, базовый и оптимистичный. Если проект окупается только в оптимистичном, запас прочности недостаточен.</p>
          </div>
        </aside>
      </div>
    </ToolShell>
  );
};

export default CoffeeShopOpeningCalculatorPage;
