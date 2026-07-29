import React from 'react';
import {
  BarChart3,
  Check,
  ChevronDown,
  Coffee,
  CreditCard,
  LayoutDashboard,
  Menu,
  PackageOpen,
  Search,
  ShoppingBag,
  UsersRound,
  Warehouse,
} from 'lucide-react';

export type ProductPreviewKey = 'pos' | 'analytics' | 'inventory';

const products = [
  { name: 'Капучино', price: '250 ₽', tone: 'from-amber-100 to-orange-50', label: '☕' },
  { name: 'Флэт уайт', price: '270 ₽', tone: 'from-stone-100 to-amber-50', label: '◉' },
  { name: 'Раф ванильный', price: '310 ₽', tone: 'from-rose-100 to-orange-50', label: '✦' },
  { name: 'Матча латте', price: '290 ₽', tone: 'from-lime-100 to-emerald-50', label: '●' },
  { name: 'Круассан', price: '190 ₽', tone: 'from-yellow-100 to-amber-50', label: '◒' },
  { name: 'Чизкейк', price: '260 ₽', tone: 'from-violet-100 to-pink-50', label: '△' },
];

const WindowChrome: React.FC<React.PropsWithChildren<{ title: string; compact?: boolean }>> = ({
  title,
  compact = false,
  children,
}) => (
  <div className="landing-window landing-shadow overflow-hidden rounded-[22px] border border-slate-200/80 bg-white">
    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-4 py-3">
      <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
      <div className="mx-auto rounded-full bg-white px-4 py-1 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
        {title}
      </div>
      {!compact ? <span className="w-[30px]" /> : null}
    </div>
    {children}
  </div>
);

export const PosPreview: React.FC<{ hero?: boolean }> = ({ hero = false }) => (
  <WindowChrome title="app.yago-app.ru / pos">
    <div className={`grid bg-[#f7f8fb] ${hero ? 'min-h-[390px]' : 'min-h-[430px]'} grid-cols-[58px_1fr_150px] sm:grid-cols-[72px_1fr_200px]`}>
      <aside className="border-r border-slate-200 bg-white px-2 py-4">
        <div className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-violet-600 text-xs font-bold text-white">YG</div>
        <div className="mt-6 space-y-2">
          {['Все', 'Кофе', 'Еда'].map((item, index) => (
            <div
              key={item}
              className={`rounded-xl px-2 py-2 text-center text-[9px] font-semibold ${
                index === 0 ? 'bg-violet-50 text-violet-700' : 'text-slate-400'
              }`}
            >
              <span className="hidden sm:inline">{item}</span>
              <span className="sm:hidden">{item.slice(0, 1)}</span>
            </div>
          ))}
        </div>
      </aside>
      <div className="min-w-0 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] text-slate-400">
            <Search className="h-3.5 w-3.5" /> Поиск по меню
          </div>
          <div className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold text-emerald-600 sm:block">
            Смена открыта
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
          {products.map((product) => (
            <div key={product.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
              <div className={`grid h-12 place-items-center rounded-lg bg-gradient-to-br ${product.tone} text-lg text-slate-500 sm:h-16`}>
                {product.label}
              </div>
              <div className="mt-2 truncate text-[9px] font-semibold text-slate-700 sm:text-[10px]">{product.name}</div>
              <div className="mt-0.5 text-[9px] font-bold text-violet-700 sm:text-[10px]">{product.price}</div>
            </div>
          ))}
        </div>
      </div>
      <aside className="flex min-w-0 flex-col border-l border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-800 sm:text-xs">Текущий заказ</div>
            <div className="text-[8px] text-slate-400 sm:text-[9px]">В заведении · № 0182</div>
          </div>
          <ShoppingBag className="h-4 w-4 text-violet-500" />
        </div>
        <div className="mt-4 space-y-3">
          <div className="flex items-start justify-between gap-2 text-[9px] sm:text-[10px]">
            <div><b className="block text-slate-700">Капучино 350 мл</b><span className="text-slate-400">Овсяное молоко</span></div>
            <b className="whitespace-nowrap text-slate-700">310 ₽</b>
          </div>
          <div className="flex items-start justify-between gap-2 text-[9px] sm:text-[10px]">
            <div><b className="block text-slate-700">Круассан</b><span className="text-slate-400">1 шт.</span></div>
            <b className="whitespace-nowrap text-slate-700">190 ₽</b>
          </div>
        </div>
        <div className="mt-auto border-t border-dashed border-slate-200 pt-3">
          <div className="flex justify-between text-[9px] text-slate-500"><span>Сумма</span><span>500 ₽</span></div>
          <div className="mt-1 flex justify-between text-xs font-bold text-slate-900 sm:text-sm"><span>К оплате</span><span>500 ₽</span></div>
          <div className="mt-3 grid gap-2">
            <div className="flex items-center justify-center gap-1 rounded-xl bg-violet-600 px-2 py-2 text-[9px] font-bold text-white sm:text-[10px]">
              <CreditCard className="h-3 w-3" /> Оплата картой
            </div>
            <div className="rounded-xl border border-slate-200 px-2 py-2 text-center text-[9px] font-semibold text-slate-500 sm:text-[10px]">Наличными</div>
          </div>
        </div>
      </aside>
    </div>
  </WindowChrome>
);

const metricCards = [
  { label: 'Выручка сегодня', value: '84 560 ₽', change: '+18,4%', accent: 'text-emerald-600' },
  { label: 'Средний чек', value: '487 ₽', change: '+6,2%', accent: 'text-emerald-600' },
  { label: 'Заказы', value: '174', change: 'за сегодня', accent: 'text-slate-400' },
  { label: 'Себестоимость', value: '29,7%', change: 'в норме', accent: 'text-violet-600' },
];

export const AnalyticsPreview: React.FC = () => (
  <WindowChrome title="app.yago-app.ru / admin">
    <div className="grid min-h-[430px] grid-cols-[74px_1fr] bg-[#f7f8fb] sm:grid-cols-[170px_1fr]">
      <aside className="border-r border-slate-200 bg-[#151525] p-3 text-white sm:p-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-600 text-[10px] font-bold">YG</div>
          <span className="hidden text-xs font-bold sm:block">Yago Admin</span>
        </div>
        <div className="mt-6 space-y-1.5">
          {[
            [LayoutDashboard, 'Дашборд'],
            [Coffee, 'Меню'],
            [Warehouse, 'Склады'],
            [UsersRound, 'Лояльность'],
            [BarChart3, 'Отчёты'],
          ].map(([Icon, label], index) => {
            const Glyph = Icon as React.ComponentType<{ className?: string }>;
            return (
              <div key={label as string} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[10px] ${index === 0 ? 'bg-white/10 text-white' : 'text-white/50'}`}>
                <Glyph className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label as string}</span>
              </div>
            );
          })}
        </div>
      </aside>
      <div className="min-w-0 p-3 sm:p-5">
        <div className="flex items-center justify-between">
          <div><div className="text-sm font-bold text-slate-900">Добрый день, Александр</div><div className="text-[9px] text-slate-400">Кофейня «На районе» · сегодня</div></div>
          <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-semibold text-slate-500">Все точки⌄</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {metricCards.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="truncate text-[8px] text-slate-400 sm:text-[9px]">{metric.label}</div>
              <div className="mt-1 text-xs font-bold text-slate-800 sm:text-sm">{metric.value}</div>
              <div className={`mt-1 text-[8px] font-semibold ${metric.accent}`}>{metric.change}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.55fr_0.75fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-center justify-between"><b className="text-[10px] text-slate-700 sm:text-xs">Выручка по дням</b><span className="text-[8px] text-slate-400">Последние 7 дней</span></div>
            <div className="mt-5 flex h-28 items-end gap-2 border-b border-l border-slate-100 px-2">
              {[42, 57, 48, 74, 66, 90, 82].map((height, index) => (
                <div key={index} className="flex flex-1 items-end justify-center">
                  <div className="w-full max-w-[28px] rounded-t bg-gradient-to-t from-violet-600 to-violet-400" style={{ height: `${height}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between px-1 text-[7px] text-slate-400"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <b className="text-[10px] text-slate-700 sm:text-xs">Топ позиций</b>
            <div className="mt-4 space-y-3">
              {[['Капучино', '28 410 ₽', '82%'], ['Флэт уайт', '18 720 ₽', '61%'], ['Круассан', '12 350 ₽', '43%']].map(([name, value, width]) => (
                <div key={name}>
                  <div className="flex justify-between text-[8px] sm:text-[9px]"><span className="font-semibold text-slate-600">{name}</span><span className="text-slate-400">{value}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-400" style={{ width }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </WindowChrome>
);

export const InventoryPreview: React.FC = () => (
  <WindowChrome title="app.yago-app.ru / admin / warehouse">
    <div className="min-h-[430px] bg-[#f7f8fb] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div><div className="text-sm font-bold text-slate-900">Остатки и себестоимость</div><div className="text-[9px] text-slate-400">Основной склад · обновлено сейчас</div></div>
        <div className="rounded-xl bg-violet-600 px-3 py-2 text-[9px] font-bold text-white">+ Поступление</div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ['Стоимость запасов', '124 800 ₽'],
          ['Позиций на контроле', '7'],
          ['Себестоимость меню', '31,2%'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[8px] text-slate-400 sm:text-[9px]">{label}</div><div className="mt-1 text-xs font-bold text-slate-800 sm:text-sm">{value}</div></div>
        ))}
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr] gap-2 bg-slate-50 px-3 py-2 text-[8px] font-bold uppercase tracking-wide text-slate-400 sm:text-[9px]">
          <span>Ингредиент</span><span>Остаток</span><span>Себестоимость</span><span>Статус</span>
        </div>
        {[
          ['Кофе зерновой', '8,4 кг', '1 580 ₽/кг', 'В норме', true],
          ['Молоко 3,2%', '18 л', '96 ₽/л', 'В норме', true],
          ['Молоко овсяное', '4 л', '210 ₽/л', 'Заказать', false],
          ['Сироп ванильный', '2,6 л', '480 ₽/л', 'В норме', true],
          ['Стакан 350 мл', '84 шт.', '8,40 ₽/шт.', 'Заказать', false],
        ].map(([name, stock, cost, status, ok]) => (
          <div key={name as string} className="grid grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr] items-center gap-2 border-t border-slate-100 px-3 py-3 text-[8px] sm:text-[10px]">
            <span className="truncate font-semibold text-slate-700">{name as string}</span><span className="text-slate-500">{stock as string}</span><span className="text-slate-500">{cost as string}</span>
            <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[7px] font-bold sm:text-[8px] ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {ok ? <Check className="h-2.5 w-2.5" /> : <PackageOpen className="h-2.5 w-2.5" />}{status as string}
            </span>
          </div>
        ))}
      </div>
    </div>
  </WindowChrome>
);

const previewOptions: { key: ProductPreviewKey; label: string; description: string }[] = [
  { key: 'pos', label: 'Касса', description: 'Быстрый заказ без лишних действий' },
  { key: 'analytics', label: 'Аналитика', description: 'Выручка и решения в цифрах' },
  { key: 'inventory', label: 'Склад', description: 'Остатки и себестоимость' },
];

export const ProductPreviewSwitcher: React.FC<{
  active: ProductPreviewKey;
  onChange: (key: ProductPreviewKey) => void;
}> = ({ active, onChange }) => (
  <div>
    <div className="mb-5 grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-3">
      {previewOptions.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition ${
            active === option.key ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span><b className="block text-sm">{option.label}</b><span className={`mt-0.5 hidden text-[11px] sm:block ${active === option.key ? 'text-white/60' : 'text-slate-400'}`}>{option.description}</span></span>
          <ChevronDown className={`h-4 w-4 transition ${active === option.key ? '-rotate-90 text-violet-300' : 'text-slate-300'}`} />
        </button>
      ))}
    </div>
    {active === 'pos' ? <PosPreview /> : null}
    {active === 'analytics' ? <AnalyticsPreview /> : null}
    {active === 'inventory' ? <InventoryPreview /> : null}
  </div>
);

export const MobileOwnerPreview: React.FC = () => (
  <div className="landing-phone landing-shadow mx-auto w-[250px] rounded-[36px] border-[7px] border-slate-950 bg-slate-950 p-1">
    <div className="overflow-hidden rounded-[25px] bg-[#f7f8fb]">
      <div className="flex items-center justify-between bg-white px-4 pb-3 pt-4 text-[8px] font-semibold text-slate-500"><span>09:41</span><span>● ◒</span></div>
      <div className="px-4 py-4">
        <div className="text-[10px] text-slate-400">Кофейня «На районе»</div>
        <div className="mt-1 text-lg font-bold text-slate-900">84 560 ₽</div>
        <div className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-bold text-emerald-700">↑ 18,4% к прошлой пятнице</div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[['174', 'заказа'], ['487 ₽', 'средний чек'], ['29,7%', 'food cost'], ['4,8', 'оценка']].map(([value, label]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-sm font-bold text-slate-800">{value}</div><div className="mt-1 text-[8px] text-slate-400">{label}</div></div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex justify-between text-[9px]"><b>Выручка</b><span className="text-slate-400">7 дней</span></div>
          <div className="mt-4 flex h-16 items-end gap-1.5">
            {[35, 55, 42, 70, 62, 88, 78].map((height, index) => <div key={index} className="flex-1 rounded-t bg-violet-500" style={{ height: `${height}%` }} />)}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-[9px] font-semibold text-amber-800"><PackageOpen className="h-3.5 w-3.5" /> 2 позиции пора заказать</div>
      </div>
      <div className="flex justify-around border-t border-slate-200 bg-white px-3 py-3 text-slate-400"><LayoutDashboard className="h-4 w-4 text-violet-600" /><BarChart3 className="h-4 w-4" /><Menu className="h-4 w-4" /></div>
    </div>
  </div>
);
