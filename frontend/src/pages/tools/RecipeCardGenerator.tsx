import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, ImagePlus, Palette, Plus, Trash2 } from 'lucide-react';
import NumberField from '../../components/tools/NumberField';
import ToolShell from '../../components/tools/ToolShell';
import { calculateIngredientCost } from '../../features/tools/calculations';
import { formatMoney } from '../../features/tools/format';
import { downloadRecipeCardPdf } from '../../features/tools/recipeCardPdf';
import { buildToolSchema, getTool, SITE_URL } from '../../features/tools/toolRegistry';
import { applySeo } from '../../lib/seo';

type IngredientRow = {
  id: number;
  name: string;
  grossAmount: number;
  netAmount: number;
  unit: 'г' | 'мл' | 'шт';
  packagePrice: number;
  packageAmount: number;
};

const tool = getTool('recipe-card-generator')!;

const initialIngredients: IngredientRow[] = [
  { id: 1, name: 'Кофе в зёрнах', grossAmount: 18, netAmount: 18, unit: 'г', packagePrice: 1800, packageAmount: 1000 },
  { id: 2, name: 'Молоко', grossAmount: 190, netAmount: 180, unit: 'мл', packagePrice: 95, packageAmount: 1000 },
];

const RecipeCardGeneratorPage: React.FC = () => {
  const [coffeeShopName, setCoffeeShopName] = useState('Моя кофейня');
  const [logoDataUrl, setLogoDataUrl] = useState<string>();
  const [brandColor, setBrandColor] = useState('#7c3aed');
  const [recipeName, setRecipeName] = useState('Капучино 300 мл');
  const [category, setCategory] = useState('Кофейные напитки');
  const [outputAmount, setOutputAmount] = useState(300);
  const [outputUnit, setOutputUnit] = useState<'г' | 'мл' | 'шт'>('мл');
  const [documentNumber, setDocumentNumber] = useState('КН-001');
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [technology, setTechnology] = useState('Смолоть кофе непосредственно перед приготовлением. Приготовить эспрессо. Взбить охлаждённое молоко до температуры 60–65 °C и влить в эспрессо, сохраняя однородную текстуру.');
  const [serving, setServing] = useState('Подавать сразу после приготовления в прогретой чашке или бумажном стакане объёмом 300 мл.');
  const [storage, setStorage] = useState('Готовый напиток хранению не подлежит. Реализовать сразу после приготовления.');
  const [allergens, setAllergens] = useState('Молоко и продукты его переработки.');
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    applySeo({
      title: 'Генератор технологических карт онлайн — скачать PDF бесплатно',
      description: tool.description,
      keywords: tool.keywords,
      canonicalUrl: `${SITE_URL}${tool.path}`,
      structuredData: buildToolSchema(tool),
    });
  }, []);

  const calculatedIngredients = useMemo(
    () => ingredients.map((item) => ({
      ...item,
      cost: calculateIngredientCost({ packagePrice: item.packagePrice, packageAmount: item.packageAmount, recipeAmount: item.netAmount }),
    })),
    [ingredients]
  );
  const totalCost = calculatedIngredients.reduce((sum, item) => sum + item.cost, 0);

  const updateIngredient = (id: number, patch: Partial<IngredientRow>) => {
    setIngredients((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addIngredient = () => {
    setIngredients((current) => [...current, {
      id: Date.now(),
      name: 'Новый ингредиент',
      grossAmount: 0,
      netAmount: 0,
      unit: 'г',
      packagePrice: 0,
      packageAmount: 1000,
    }]);
  };

  const handleLogo = (file?: File) => {
    setMessage('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Выберите изображение в формате PNG, JPG, WEBP или SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage('Логотип должен весить не более 2 МБ.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result));
    reader.onerror = () => setMessage('Не удалось прочитать логотип. Попробуйте другой файл.');
    reader.readAsDataURL(file);
  };

  const downloadPdf = async () => {
    if (!recipeName.trim()) {
      setMessage('Укажите название блюда или напитка.');
      return;
    }
    setIsDownloading(true);
    setMessage('');
    try {
      await downloadRecipeCardPdf({
        coffeeShopName,
        logoDataUrl,
        brandColor,
        recipeName,
        category,
        outputAmount,
        outputUnit,
        documentNumber,
        ingredients: calculatedIngredients,
        technology,
        serving,
        storage,
        allergens,
      });
      setMessage('PDF готов и сохранён в загрузки.');
    } catch (error) {
      console.error(error);
      setMessage('Не удалось создать PDF в этом браузере. Попробуйте Chrome, Safari или Яндекс Браузер.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <ToolShell
      tool={tool}
      intro="Заполните состав и технологию, добавьте название кофейни, логотип и фирменный цвет. Получите аккуратную технологическую карту в PDF — бесплатно и без регистрации."
      methodology={
        <>
          <p><strong>Себестоимость ингредиента</strong> = закупочная цена упаковки ÷ количество в упаковке × нетто по рецептуре. Единицы закупки и рецепта должны совпадать.</p>
          <p><strong>Брутто</strong> — масса или объём сырья до обработки, <strong>нетто</strong> — количество, которое фактически попадает в продукт. Для кофе и готовых жидкостей значения часто совпадают.</p>
          <p>Этот шаблон помогает стандартизировать рецептуру, но не заменяет обязательные документы и требования вашего формата, производственного контроля и применимого законодательства.</p>
        </>
      }
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section className="min-w-0 space-y-5">
          <div className="rounded-3xl border border-rose-200 bg-white p-5 sm:p-7">
            <div className="flex items-center gap-3 text-rose-700"><Palette size={21} /><span className="text-sm font-semibold uppercase tracking-wide">Оформление PDF</span></div>
            <h2 className="mt-2 heading-font text-2xl font-semibold text-slate-950">Добавьте фирменный стиль</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Название кофейни</span>
                <input value={coffeeShopName} onChange={(event) => setCoffeeShopName(event.target.value)} maxLength={80} className="mt-1.5 h-11 w-full bg-white px-3 text-base" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Фирменный цвет</span>
                <span className="mt-1.5 flex h-11 items-center gap-3 rounded-xl border border-slate-300 bg-white px-3">
                  <input aria-label="Выбрать фирменный цвет" type="color" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} className="h-7 w-10 cursor-pointer border-0 p-0" />
                  <input aria-label="Код фирменного цвета" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} maxLength={7} className="h-8 min-w-0 flex-1 border-0 p-0 font-mono text-sm uppercase" />
                </span>
              </label>
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-rose-300 bg-rose-50 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-rose-200">
                  {logoDataUrl ? <img src={logoDataUrl} alt="Предпросмотр логотипа" className="h-full w-full object-contain p-2" /> : <ImagePlus className="text-rose-300" size={28} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">Логотип кофейни</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">PNG, JPG, WEBP или SVG до 2 МБ. Лучше использовать горизонтальный логотип на светлом фоне.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center rounded-xl bg-white px-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100">
                      {logoDataUrl ? 'Заменить' : 'Выбрать файл'}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(event) => handleLogo(event.target.files?.[0])} />
                    </label>
                    {logoDataUrl ? <button type="button" onClick={() => setLogoDataUrl(undefined)} className="h-9 px-3 text-sm font-semibold text-slate-600 hover:bg-white">Удалить</button> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Основные данные</p>
            <h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Блюдо или напиток</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-slate-800">Название продукта</span>
                <input value={recipeName} onChange={(event) => setRecipeName(event.target.value)} maxLength={100} className="mt-1.5 h-11 w-full bg-white px-3 text-base" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Номер карты</span>
                <input value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} maxLength={30} className="mt-1.5 h-11 w-full bg-white px-3 text-base" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Категория</span>
                <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={60} className="mt-1.5 h-11 w-full bg-white px-3 text-base" />
              </label>
              <div className="grid grid-cols-[1fr_88px] gap-2">
                <NumberField id="recipe-output" label="Выход" value={outputAmount} onChange={setOutputAmount} step={0.1} />
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Ед.</span>
                  <select value={outputUnit} onChange={(event) => setOutputUnit(event.target.value as typeof outputUnit)} className="mt-1.5 h-11 w-full bg-white px-2"><option>г</option><option>мл</option><option>шт</option></select>
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Рецептура</p><h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Ингредиенты</h2></div>
              <button type="button" onClick={addIngredient} className="inline-flex h-10 items-center justify-center gap-2 bg-rose-100 px-4 text-sm font-semibold text-rose-950 hover:bg-rose-200"><Plus size={17} /> Добавить</button>
            </div>
            <div className="mt-5 space-y-4">
              {calculatedIngredients.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-900">{index + 1}</span>
                    <input aria-label={`Название ингредиента ${index + 1}`} value={item.name} onChange={(event) => updateIngredient(item.id, { name: event.target.value })} className="h-10 min-w-0 flex-1 bg-white px-3 font-semibold" />
                    {ingredients.length > 1 ? <button type="button" aria-label={`Удалить ${item.name}`} onClick={() => setIngredients((current) => current.filter((row) => row.id !== item.id))} className="flex h-10 w-10 shrink-0 items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={18} /></button> : null}
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="grid grid-cols-[1fr_78px] gap-2">
                      <NumberField id={`gross-${item.id}`} label="Брутто" value={item.grossAmount} onChange={(value) => updateIngredient(item.id, { grossAmount: value })} step={0.1} />
                      <label className="block"><span className="text-sm font-semibold text-slate-800">Ед.</span><select value={item.unit} onChange={(event) => updateIngredient(item.id, { unit: event.target.value as IngredientRow['unit'] })} className="mt-1.5 h-11 w-full bg-white px-2"><option>г</option><option>мл</option><option>шт</option></select></label>
                    </div>
                    <NumberField id={`net-${item.id}`} label="Нетто" value={item.netAmount} onChange={(value) => updateIngredient(item.id, { netAmount: value })} suffix={item.unit} step={0.1} />
                    <NumberField id={`package-price-${item.id}`} label="Цена упаковки" value={item.packagePrice} onChange={(value) => updateIngredient(item.id, { packagePrice: value })} suffix="₽" step={0.01} />
                    <NumberField id={`package-amount-${item.id}`} label="Количество в упаковке" value={item.packageAmount} onChange={(value) => updateIngredient(item.id, { packageAmount: value })} suffix={item.unit} step={0.1} />
                    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">В себестоимости</div><div className="mt-1 text-lg font-semibold text-slate-950">{formatMoney(item.cost, 2)}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Описание процесса</p>
            <h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Технология и требования</h2>
            <div className="mt-5 grid gap-4">
              {[
                ['Технология приготовления', technology, setTechnology, 700],
                ['Подача и оформление', serving, setServing, 400],
                ['Условия и срок хранения', storage, setStorage, 400],
                ['Аллергены', allergens, setAllergens, 300],
              ].map(([label, value, setter, maxLength]) => (
                <label key={String(label)} className="block">
                  <span className="text-sm font-semibold text-slate-800">{String(label)}</span>
                  <textarea value={String(value)} onChange={(event) => (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)} maxLength={Number(maxLength)} rows={label === 'Технология приготовления' ? 5 : 3} className="mt-1.5 w-full resize-y bg-white p-3 text-sm leading-6" />
                </label>
              ))}
            </div>
          </div>
        </section>

        <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-3xl border border-rose-200 bg-white">
            <div className="p-6 text-white" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(brandColor) ? brandColor : '#7c3aed' }}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0"><div className="truncate text-sm font-semibold uppercase tracking-wide opacity-80">{coffeeShopName || 'Моя кофейня'}</div><div className="mt-1 text-xs opacity-70">Технологическая карта № {documentNumber || '001'}</div></div>
                {logoDataUrl ? <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-2"><img src={logoDataUrl} alt="" className="max-h-full max-w-full" /></div> : <FileText size={30} className="shrink-0 opacity-70" />}
              </div>
            </div>
            <div className="p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Предпросмотр</div>
              <h2 className="mt-2 heading-font text-3xl font-semibold text-slate-950">{recipeName || 'Название продукта'}</h2>
              <p className="mt-2 text-sm text-slate-600">{category || 'Категория'} · выход {outputAmount} {outputUnit}</p>
              <div className="mt-5 rounded-2xl bg-rose-50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Себестоимость</div><div className="mt-1 text-3xl font-semibold text-rose-950">{formatMoney(totalCost, 2)}</div></div>
              <div className="mt-5 space-y-2 text-sm text-slate-600">
                {calculatedIngredients.slice(0, 5).map((item) => <div key={item.id} className="flex justify-between gap-3"><span className="truncate">{item.name}</span><span className="shrink-0 font-semibold text-slate-900">{item.netAmount} {item.unit}</span></div>)}
                {calculatedIngredients.length > 5 ? <div className="text-xs text-slate-500">И ещё {calculatedIngredients.length - 5} позиций в PDF</div> : null}
              </div>
              <button type="button" onClick={downloadPdf} disabled={isDownloading} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">
                <Download size={18} /> {isDownloading ? 'Создаём PDF…' : 'Скачать технологическую карту'}
              </button>
              {message ? <p role="status" className={`mt-3 text-sm leading-5 ${message.startsWith('PDF готов') ? 'text-emerald-700' : 'text-red-700'}`}>{message}</p> : null}
              <p className="mt-4 text-xs leading-5 text-slate-500">PDF создаётся локально. Логотип, рецептура и цены не загружаются на сервер Yago.</p>
            </div>
          </div>
        </aside>
      </div>
    </ToolShell>
  );
};

export default RecipeCardGeneratorPage;
