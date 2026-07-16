import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Plus, RotateCcw, Trash2 } from 'lucide-react';
import ToolShell from '../../components/tools/ToolShell';
import { calculateAbcXyz, type AbcXyzInput } from '../../features/tools/calculations';
import { formatMoney, formatNumber, formatPercent } from '../../features/tools/format';
import { buildToolSchema, getTool, SITE_URL } from '../../features/tools/toolRegistry';
import { applySeo } from '../../lib/seo';

const tool = getTool('abc-xyz-analysis')!;

const exampleItems: AbcXyzInput[] = [
  { id: 1, name: 'Капучино', periods: [285000, 301000, 294000] },
  { id: 2, name: 'Латте', periods: [218000, 229000, 224000] },
  { id: 3, name: 'Фильтр-кофе', periods: [142000, 119000, 151000] },
  { id: 4, name: 'Круассан классический', periods: [97000, 104000, 99000] },
  { id: 5, name: 'Раф сезонный', periods: [38000, 122000, 61000] },
  { id: 6, name: 'Чай авторский', periods: [56000, 47000, 69000] },
  { id: 7, name: 'Чизкейк', periods: [43000, 31000, 47000] },
  { id: 8, name: 'Сэндвич', periods: [27000, 19000, 35000] },
];

const segmentClasses: Record<string, string> = {
  AX: 'bg-emerald-100 text-emerald-900',
  AY: 'bg-lime-100 text-lime-900',
  AZ: 'bg-amber-100 text-amber-900',
  BX: 'bg-cyan-100 text-cyan-900',
  BY: 'bg-sky-100 text-sky-900',
  BZ: 'bg-orange-100 text-orange-900',
  CX: 'bg-indigo-100 text-indigo-900',
  CY: 'bg-violet-100 text-violet-900',
  CZ: 'bg-rose-100 text-rose-900',
};

const recommendations: Record<string, string> = {
  AX: 'Ядро меню: держать в наличии, контролировать качество и скорость отдачи.',
  AY: 'Ключевые позиции с колебаниями: учитывать сезонность и планировать запас.',
  AZ: 'Большой вклад, нестабильный спрос: выяснить причины скачков и не допускать списаний.',
  BX: 'Стабильная середина: развивать допродажи и проверять потенциал перехода в A.',
  BY: 'Средний вклад: корректировать закупки по неделям и тестировать продвижение.',
  BZ: 'Нестабильная середина: уменьшить запас, проверить цену и место в меню.',
  CX: 'Низкий вклад, но стабильный спрос: оставить при хорошей марже или стратегической роли.',
  CY: 'Второстепенные позиции: упростить запас и сравнить с близкими аналогами.',
  CZ: 'Кандидаты на пересмотр: убрать, заменить или оставить только как сезонное предложение.',
};

const AbcXyzAnalysisPage: React.FC = () => {
  const [items, setItems] = useState(exampleItems);
  const [metric, setMetric] = useState<'revenue' | 'profit'>('revenue');
  const [periodLabels, setPeriodLabels] = useState(['Месяц 1', 'Месяц 2', 'Месяц 3']);

  useEffect(() => {
    applySeo({
      title: 'ABC/XYZ-анализ ассортимента и меню онлайн — бесплатно',
      description: tool.description,
      keywords: tool.keywords,
      canonicalUrl: `${SITE_URL}${tool.path}`,
      structuredData: buildToolSchema(tool),
    });
  }, []);

  const results = useMemo(() => calculateAbcXyz(items), [items]);
  const total = results.reduce((sum, item) => sum + item.total, 0);
  const segmentCounts = results.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.segment] = (accumulator[item.segment] || 0) + 1;
    return accumulator;
  }, {});

  const updateItem = (id: number, patch: Partial<AbcXyzInput>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updatePeriod = (id: number, periodIndex: number, value: number) => {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const periods = [...item.periods];
      periods[periodIndex] = Number.isFinite(value) ? Math.max(0, value) : 0;
      return { ...item, periods };
    }));
  };

  const addItem = () => setItems((current) => [...current, { id: Date.now(), name: 'Новая позиция', periods: [0, 0, 0] }]);

  return (
    <ToolShell
      tool={tool}
      intro="Введите выручку или валовую прибыль по позициям за три сопоставимых периода. Инструмент распределит меню по вкладу в результат и стабильности спроса, а затем подскажет действия для каждого сегмента."
      methodology={
        <>
          <p><strong>ABC-анализ</strong> сортирует позиции по выбранному показателю. Группа A формирует первые 80% результата, B — следующие 15%, C — оставшиеся 5%. Пограничная позиция включается в более значимую группу.</p>
          <p><strong>XYZ-анализ</strong> оценивает устойчивость спроса через коэффициент вариации: X — до 10%, Y — от 10% до 25%, Z — выше 25%. Чем выше значение, тем менее предсказуемы продажи.</p>
          <p>Используйте сопоставимые периоды одинаковой длины. Для сезонного меню анализируйте отдельно сезоны или добавляйте больше периодов в профессиональной системе учёта.</p>
        </>
      }
    >
      <section className="rounded-3xl border border-cyan-200 bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-cyan-700"><BarChart3 size={21} /><span className="text-sm font-semibold uppercase tracking-wide">Исходные данные</span></div>
            <h2 className="mt-2 heading-font text-2xl font-semibold text-slate-950">Продажи за три периода</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Возьмите три месяца или недели одинаковой длины. Для ABC лучше использовать валовую прибыль, если себестоимость по позициям заполнена корректно.</p>
          </div>
          <label className="block w-full lg:w-64">
            <span className="text-sm font-semibold text-slate-800">Показатель анализа</span>
            <select value={metric} onChange={(event) => setMetric(event.target.value as typeof metric)} className="mt-1.5 h-11 w-full bg-white px-3 text-sm font-medium">
              <option value="revenue">Выручка, ₽</option>
              <option value="profit">Валовая прибыль, ₽</option>
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl bg-cyan-50 p-4 sm:grid-cols-3">
          {periodLabels.map((label, index) => (
            <label key={index} className="block"><span className="text-xs font-semibold uppercase tracking-wide text-cyan-800">Период {index + 1}</span><input value={label} onChange={(event) => setPeriodLabels((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} maxLength={30} className="mt-1 h-10 w-full bg-white px-3 text-sm font-medium" /></label>
          ))}
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Позиция меню</th>{periodLabels.map((label, index) => <th key={index} className="px-3 py-3">{label || `Период ${index + 1}`}, ₽</th>)}<th aria-label="Удалить позицию" className="w-14 px-3 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item, rowIndex) => (
                <tr key={item.id}>
                  <td className="p-3"><input aria-label={`Название позиции ${rowIndex + 1}`} value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} className="h-10 w-full min-w-[210px] bg-white px-3 font-semibold" /></td>
                  {item.periods.map((value, periodIndex) => <td key={periodIndex} className="p-3"><input aria-label={`${item.name}, ${periodLabels[periodIndex]}`} type="number" min={0} step={100} value={value} onChange={(event) => updatePeriod(item.id, periodIndex, Number(event.target.value))} className="h-10 w-full min-w-[140px] bg-white px-3 tabular-nums" /></td>)}
                  <td className="p-3">{items.length > 1 ? <button type="button" aria-label={`Удалить ${item.name}`} onClick={() => setItems((current) => current.filter((row) => row.id !== item.id))} className="flex h-10 w-10 items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={17} /></button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={addItem} className="inline-flex h-10 items-center gap-2 bg-cyan-100 px-4 text-sm font-semibold text-cyan-950 hover:bg-cyan-200"><Plus size={17} /> Добавить позицию</button>
          <button type="button" onClick={() => setItems(exampleItems)} className="inline-flex h-10 items-center gap-2 border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw size={16} /> Вернуть пример</button>
          <button type="button" onClick={() => setItems([{ id: Date.now(), name: 'Новая позиция', periods: [0, 0, 0] }])} className="h-10 px-4 text-sm font-semibold text-slate-500 hover:bg-slate-50">Очистить</button>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl bg-slate-950 text-white">
        <div className="grid gap-px bg-white/10 sm:grid-cols-3">
          <div className="bg-slate-950 p-5 sm:p-6"><div className="text-xs uppercase tracking-wide text-slate-400">Позиций</div><div className="mt-1 text-3xl font-semibold">{results.length}</div></div>
          <div className="bg-slate-950 p-5 sm:p-6"><div className="text-xs uppercase tracking-wide text-slate-400">{metric === 'revenue' ? 'Выручка' : 'Валовая прибыль'} за 3 периода</div><div className="mt-1 text-3xl font-semibold">{formatMoney(total)}</div></div>
          <div className="bg-slate-950 p-5 sm:p-6"><div className="text-xs uppercase tracking-wide text-slate-400">Нестабильных Z</div><div className="mt-1 text-3xl font-semibold text-amber-300">{results.filter((item) => item.xyz === 'Z').length}</div></div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700">Результат</p>
        <h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Матрица ABC/XYZ</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Сначала смотрите на AX–AZ: они дают основной вклад. Затем разбирайте Z-позиции — их спрос сложнее прогнозировать.</p>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ'].map((segment) => (
            <div key={segment} className={`rounded-2xl p-3 sm:p-4 ${segmentClasses[segment]}`}>
              <div className="text-xl font-bold sm:text-2xl">{segment}</div>
              <div className="mt-1 text-xs font-semibold opacity-75">{segmentCounts[segment] || 0} поз.</div>
            </div>
          ))}
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Позиция</th><th className="px-4 py-3">Сумма</th><th className="px-4 py-3">Доля</th><th className="px-4 py-3">Вариация</th><th className="px-4 py-3">Сегмент</th><th className="px-4 py-3">Рекомендация</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {results.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-4 font-semibold text-slate-950">{item.name || 'Без названия'}</td>
                  <td className="px-4 py-4 tabular-nums text-slate-700">{formatMoney(item.total)}</td>
                  <td className="px-4 py-4 tabular-nums text-slate-700">{formatPercent(item.sharePercent)}<div className="mt-1 text-xs text-slate-400">накоплено {formatPercent(item.cumulativeSharePercent)}</div></td>
                  <td className="px-4 py-4 tabular-nums text-slate-700">{formatPercent(item.coefficientOfVariation)}</td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-lg px-2.5 py-1 font-bold ${segmentClasses[item.segment]}`}>{item.segment}</span></td>
                  <td className="max-w-sm px-4 py-4 text-sm leading-6 text-slate-600">{recommendations[item.segment]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 rounded-2xl bg-cyan-50 p-4 text-sm leading-6 text-cyan-950">
          <strong>Как читать вариативность:</strong> коэффициент показывает отклонение продаж от среднего. Например, 8% — стабильная X-позиция, а {formatNumber(42, 0)}% — непредсказуемая Z-позиция, для которой опасно держать большой запас.
        </div>
      </section>
    </ToolShell>
  );
};

export default AbcXyzAnalysisPage;
