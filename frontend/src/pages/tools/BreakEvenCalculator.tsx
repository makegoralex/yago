import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Target, TrendingUp } from 'lucide-react';
import NumberField from '../../components/tools/NumberField';
import ToolShell from '../../components/tools/ToolShell';
import { calculateBreakEven } from '../../features/tools/calculations';
import { formatMoney, formatNumber, formatPercent } from '../../features/tools/format';
import { buildToolSchema, getTool, SITE_URL } from '../../features/tools/toolRegistry';
import { applySeo } from '../../lib/seo';

const tool = getTool('break-even-calculator')!;

const BreakEvenCalculatorPage: React.FC = () => {
  const [averageCheck, setAverageCheck] = useState(420);
  const [checksPerDay, setChecksPerDay] = useState(90);
  const [workingDays, setWorkingDays] = useState(30);
  const [foodCostPercent, setFoodCostPercent] = useState(30);
  const [acquiringPercent, setAcquiringPercent] = useState(2.2);
  const [taxPercent, setTaxPercent] = useState(6);
  const [otherVariablePercent, setOtherVariablePercent] = useState(2);
  const [rent, setRent] = useState(180000);
  const [payroll, setPayroll] = useState(420000);
  const [utilities, setUtilities] = useState(45000);
  const [marketing, setMarketing] = useState(30000);
  const [otherFixed, setOtherFixed] = useState(65000);
  const [targetProfit, setTargetProfit] = useState(200000);

  useEffect(() => {
    applySeo({
      title: 'Калькулятор точки безубыточности и прибыли кофейни',
      description: tool.description,
      keywords: tool.keywords,
      canonicalUrl: `${SITE_URL}${tool.path}`,
      structuredData: buildToolSchema(tool),
    });
  }, []);

  const fixedCosts = rent + payroll + utilities + marketing + otherFixed;
  const variableCostPercent = foodCostPercent + acquiringPercent + taxPercent + otherVariablePercent;
  const result = useMemo(
    () => calculateBreakEven({ averageCheck, checksPerDay, workingDays, variableCostPercent, fixedCosts, targetProfit }),
    [averageCheck, checksPerDay, workingDays, variableCostPercent, fixedCosts, targetProfit]
  );
  const progress = result.breakEvenRevenue ? Math.min(100, (result.revenue / result.breakEvenRevenue) * 100) : 0;

  return (
    <ToolShell
      tool={tool}
      intro="Введите средний чек, поток гостей и ежемесячные расходы. Вы увидите плановую прибыль, минимальную выручку и сколько чеков в день нужно для выхода в ноль."
      methodology={
        <>
          <p><strong>Маржинальность</strong> = 100% − доля переменных расходов. Переменные расходы меняются вместе с выручкой: сырьё, эквайринг, налог с оборота и подобные затраты.</p>
          <p><strong>Точка безубыточности в рублях</strong> = постоянные расходы ÷ коэффициент маржинального дохода. В чеках — полученная выручка ÷ средний чек.</p>
          <p><strong>Операционная прибыль</strong> = выручка × коэффициент маржинального дохода − постоянные расходы. Амортизация, кредитные платежи и налог на прибыль учитываются отдельно, если они не внесены в поля расходов.</p>
        </>
      }
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]">
        <section className="min-w-0 space-y-5">
          <div className="rounded-3xl border border-indigo-200 bg-white p-5 sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">План продаж</p>
            <h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Выручка кофейни</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <NumberField id="average-check" label="Средний чек" value={averageCheck} onChange={setAverageCheck} suffix="₽" />
              <NumberField id="checks-day" label="Чеков в день" value={checksPerDay} onChange={setChecksPerDay} suffix="шт" />
              <NumberField id="working-days" label="Рабочих дней" value={workingDays} onChange={setWorkingDays} suffix="дн" min={1} max={31} />
            </div>
            <div className="mt-5 rounded-2xl bg-indigo-50 p-4">
              <div className="text-sm text-indigo-800">Плановая выручка в месяц</div>
              <div className="mt-1 text-3xl font-semibold text-indigo-950">{formatMoney(result.revenue)}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Переменные расходы</p>
            <h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Доля от выручки</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField id="food-cost" label="Сырьё и товары" value={foodCostPercent} onChange={setFoodCostPercent} suffix="%" max={100} step={0.1} />
              <NumberField id="acquiring" label="Эквайринг" value={acquiringPercent} onChange={setAcquiringPercent} suffix="%" max={100} step={0.1} />
              <NumberField id="tax" label="Налог с оборота" value={taxPercent} onChange={setTaxPercent} suffix="%" max={100} step={0.1} />
              <NumberField id="other-variable-rate" label="Прочие" value={otherVariablePercent} onChange={setOtherVariablePercent} suffix="%" max={100} step={0.1} />
            </div>
            {variableCostPercent >= 100 ? (
              <div className="mt-4 flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="shrink-0" size={18} />Сумма переменных расходов должна быть меньше 100%.</div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">Всего {formatPercent(variableCostPercent)} · маржинальность {formatPercent(result.contributionMarginRate * 100)}</p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">Постоянные расходы</p>
            <h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Затраты в месяц</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField id="rent" label="Аренда" value={rent} onChange={setRent} suffix="₽" />
              <NumberField id="payroll" label="ФОТ с начислениями" value={payroll} onChange={setPayroll} suffix="₽" />
              <NumberField id="utilities" label="Коммунальные услуги" value={utilities} onChange={setUtilities} suffix="₽" />
              <NumberField id="marketing" label="Маркетинг" value={marketing} onChange={setMarketing} suffix="₽" />
              <NumberField id="other-fixed" label="Прочие постоянные" value={otherFixed} onChange={setOtherFixed} suffix="₽" />
              <NumberField id="target-profit" label="Желаемая прибыль" value={targetProfit} onChange={setTargetProfit} suffix="₽" />
            </div>
            <p className="mt-4 text-sm text-slate-600">Постоянные расходы: <strong className="text-slate-950">{formatMoney(fixedCosts)}</strong></p>
          </div>
        </section>

        <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-950 to-violet-950 text-white">
            <div className="p-6 sm:p-7">
              <div className="flex items-center gap-2 text-indigo-300"><Target size={21} /><span className="text-sm font-semibold uppercase tracking-wide">Точка безубыточности</span></div>
              <div className="mt-4 text-4xl font-semibold">{formatMoney(result.breakEvenRevenue)}</div>
              <p className="mt-2 text-sm text-slate-400">или {formatNumber(Math.ceil(result.breakEvenChecksPerDay))} чеков в день</p>
              <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${result.operatingProfit >= 0 ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${progress}%` }} /></div>
              <p className="mt-2 text-xs text-slate-400">План выполняет точку безубыточности на {formatPercent(progress, 0)}</p>
            </div>

            <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="bg-slate-950/80 p-5"><div className="text-xs text-slate-400">Операционная прибыль</div><div className={`mt-1 text-xl font-semibold ${result.operatingProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatMoney(result.operatingProfit)}</div></div>
              <div className="bg-slate-950/80 p-5"><div className="text-xs text-slate-400">Запас прочности</div><div className="mt-1 text-xl font-semibold">{formatPercent(result.safetyMarginPercent)}</div></div>
              <div className="bg-slate-950/80 p-5"><div className="text-xs text-slate-400">Чеков до нуля в месяц</div><div className="mt-1 text-xl font-semibold">{formatNumber(Math.ceil(result.breakEvenChecks))}</div></div>
              <div className="bg-slate-950/80 p-5"><div className="text-xs text-slate-400">Маржинальный доход</div><div className="mt-1 text-xl font-semibold">{formatMoney(result.contributionMargin)}</div></div>
            </div>

            <div className="p-6 sm:p-7">
              <div className="flex items-center gap-2 text-violet-300"><TrendingUp size={20} /><span className="text-sm font-semibold">Чтобы заработать {formatMoney(targetProfit)}</span></div>
              <div className="mt-3 rounded-2xl bg-white/10 p-4">
                <div className="text-xs text-slate-400">Нужная выручка</div>
                <div className="mt-1 text-2xl font-semibold">{formatMoney(result.requiredRevenueForTarget)}</div>
                <div className="mt-1 text-sm text-slate-300">≈ {formatNumber(Math.ceil(result.requiredRevenueForTarget / Math.max(1, averageCheck) / Math.max(1, workingDays)))} чеков в день</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </ToolShell>
  );
};

export default BreakEvenCalculatorPage;
