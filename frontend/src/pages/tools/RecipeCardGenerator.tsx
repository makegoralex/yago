import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, ImageIcon, ImagePlus, Palette, Plus, Trash2 } from 'lucide-react';
import NumberField from '../../components/tools/NumberField';
import ToolShell from '../../components/tools/ToolShell';
import { calculateIngredientCost } from '../../features/tools/calculations';
import { formatMoney } from '../../features/tools/format';
import { downloadRecipeCardPdf, type RecipeCardSize } from '../../features/tools/recipeCardPdf';
import { buildToolSchema, getTool, SITE_URL } from '../../features/tools/toolRegistry';
import { applySeo } from '../../lib/seo';

type PortionAmount = {
  grossAmount: number;
  netAmount: number;
};

type IngredientRow = {
  id: number;
  name: string;
  unit: 'г' | 'мл' | 'шт';
  packagePrice: number;
  packageAmount: number;
  amounts: Record<number, PortionAmount>;
};

const tool = getTool('recipe-card-generator')!;
const MAX_SIZES = 4;
const MAX_INGREDIENTS = 12;

const initialSizes: RecipeCardSize[] = [
  { id: 1, name: 'Маленький', outputAmount: 250, outputUnit: 'мл' },
  { id: 2, name: 'Средний', outputAmount: 350, outputUnit: 'мл' },
  { id: 3, name: 'Большой', outputAmount: 450, outputUnit: 'мл' },
];

const initialIngredients: IngredientRow[] = [
  {
    id: 1,
    name: 'Кофе в зёрнах',
    unit: 'г',
    packagePrice: 1800,
    packageAmount: 1000,
    amounts: {
      1: { grossAmount: 18, netAmount: 18 },
      2: { grossAmount: 18, netAmount: 18 },
      3: { grossAmount: 18, netAmount: 18 },
    },
  },
  {
    id: 2,
    name: 'Молоко',
    unit: 'мл',
    packagePrice: 95,
    packageAmount: 1000,
    amounts: {
      1: { grossAmount: 150, netAmount: 140 },
      2: { grossAmount: 240, netAmount: 230 },
      3: { grossAmount: 330, netAmount: 320 },
    },
  },
];

const RecipeCardGeneratorPage: React.FC = () => {
  const [coffeeShopName, setCoffeeShopName] = useState('Моя кофейня');
  const [logoDataUrl, setLogoDataUrl] = useState<string>();
  const [dishPhotoDataUrl, setDishPhotoDataUrl] = useState<string>();
  const [brandColor, setBrandColor] = useState('#7c3aed');
  const [recipeName, setRecipeName] = useState('Капучино');
  const [category, setCategory] = useState('Кофейные напитки');
  const [documentNumber, setDocumentNumber] = useState('КН-001');
  const [sizes, setSizes] = useState(initialSizes);
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [technology, setTechnology] = useState('Смолоть кофе непосредственно перед приготовлением. Приготовить эспрессо. Взбить охлаждённое молоко до температуры 60–65 °C и влить в эспрессо, сохраняя однородную текстуру.');
  const [serving, setServing] = useState('Подавать сразу после приготовления в прогретой чашке или бумажном стакане выбранного объёма.');
  const [storage, setStorage] = useState('Готовый напиток хранению не подлежит. Реализовать сразу после приготовления.');
  const [allergens, setAllergens] = useState('Молоко и продукты его переработки.');
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState('');
  const [generatedPdf, setGeneratedPdf] = useState<{ url: string; filename: string }>();

  useEffect(() => {
    applySeo({
      title: 'Генератор технологических карт с размерами — PDF бесплатно',
      description: tool.description,
      keywords: tool.keywords,
      canonicalUrl: `${SITE_URL}${tool.path}`,
      structuredData: buildToolSchema(tool),
    });
  }, []);

  useEffect(() => () => {
    if (generatedPdf) URL.revokeObjectURL(generatedPdf.url);
  }, [generatedPdf]);

  const calculatedIngredients = useMemo(
    () => ingredients.map((ingredient) => ({
      name: ingredient.name,
      unit: ingredient.unit,
      amounts: sizes.map((size) => {
        const amount = ingredient.amounts[size.id] ?? { grossAmount: 0, netAmount: 0 };
        return {
          sizeId: size.id,
          ...amount,
          cost: calculateIngredientCost({
            packagePrice: ingredient.packagePrice,
            packageAmount: ingredient.packageAmount,
            recipeAmount: amount.netAmount,
          }),
        };
      }),
    })),
    [ingredients, sizes]
  );

  const costsBySize = useMemo(
    () => sizes.map((size) => ({
      ...size,
      cost: calculatedIngredients.reduce(
        (sum, ingredient) => sum + (ingredient.amounts.find((amount) => amount.sizeId === size.id)?.cost ?? 0),
        0
      ),
    })),
    [calculatedIngredients, sizes]
  );

  const updateIngredient = (id: number, patch: Partial<IngredientRow>) => {
    setIngredients((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateIngredientAmount = (ingredientId: number, sizeId: number, patch: Partial<PortionAmount>) => {
    setIngredients((current) => current.map((ingredient) => (
      ingredient.id === ingredientId
        ? {
            ...ingredient,
            amounts: {
              ...ingredient.amounts,
              [sizeId]: { ...(ingredient.amounts[sizeId] ?? { grossAmount: 0, netAmount: 0 }), ...patch },
            },
          }
        : ingredient
    )));
  };

  const addIngredient = () => {
    if (ingredients.length >= MAX_INGREDIENTS) {
      setMessage(`На одном листе помещается до ${MAX_INGREDIENTS} ингредиентов.`);
      return;
    }
    const amounts = Object.fromEntries(sizes.map((size) => [size.id, { grossAmount: 0, netAmount: 0 }]));
    setIngredients((current) => [...current, {
      id: Date.now(),
      name: 'Новый ингредиент',
      unit: 'г',
      packagePrice: 0,
      packageAmount: 1000,
      amounts,
    }]);
    setMessage('');
  };

  const addSize = () => {
    if (sizes.length >= MAX_SIZES) {
      setMessage(`В одной печатной техкарте доступно до ${MAX_SIZES} размеров.`);
      return;
    }
    const previousSize = sizes[sizes.length - 1];
    const nextId = Date.now();
    const nextOutput = (previousSize?.outputAmount || 250) + 100;
    setSizes((current) => [...current, {
      id: nextId,
      name: `Размер ${current.length + 1}`,
      outputAmount: nextOutput,
      outputUnit: previousSize?.outputUnit || 'мл',
    }]);
    setIngredients((current) => current.map((ingredient) => ({
      ...ingredient,
      amounts: {
        ...ingredient.amounts,
        [nextId]: { ...(ingredient.amounts[previousSize?.id] ?? { grossAmount: 0, netAmount: 0 }) },
      },
    })));
    setMessage('');
  };

  const removeSize = (sizeId: number) => {
    if (sizes.length === 1) return;
    setSizes((current) => current.filter((size) => size.id !== sizeId));
    setIngredients((current) => current.map((ingredient) => {
      const amounts = { ...ingredient.amounts };
      delete amounts[sizeId];
      return { ...ingredient, amounts };
    }));
  };

  const handleImage = (
    file: File | undefined,
    setter: React.Dispatch<React.SetStateAction<string | undefined>>,
    label: string,
    maxMegabytes: number
  ) => {
    setMessage('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage(`Для поля «${label}» выберите изображение PNG, JPG, WEBP или SVG.`);
      return;
    }
    if (file.size > maxMegabytes * 1024 * 1024) {
      setMessage(`${label} должно весить не более ${maxMegabytes} МБ.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result));
    reader.onerror = () => setMessage(`Не удалось прочитать файл «${label}». Попробуйте другое изображение.`);
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
      const pdf = await downloadRecipeCardPdf({
        coffeeShopName,
        logoDataUrl,
        dishPhotoDataUrl,
        brandColor,
        recipeName,
        category,
        documentNumber,
        sizes,
        ingredients: calculatedIngredients,
        technology,
        serving,
        storage,
        allergens,
      });
      setGeneratedPdf(pdf);
      setMessage('Одностраничный PDF готов и сохранён в загрузки.');
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
      intro="Оформите одну компактную техкарту для всех размеров напитка или блюда. Количество ингредиентов меняется по размерам, а технология остаётся общей. Готовый PDF занимает один лист A4."
      methodology={
        <>
          <p><strong>Одна карта — несколько размеров.</strong> Для каждого размера задаются выход, брутто и нетто ингредиентов. Технология приготовления, подача, хранение и аллергены указываются один раз.</p>
          <p><strong>Себестоимость размера</strong> складывается из стоимости нетто всех ингредиентов: закупочная цена упаковки ÷ количество в упаковке × нетто по рецептуре.</p>
          <p>Одностраничный шаблон рассчитан максимум на четыре размера и двенадцать ингредиентов. Он помогает стандартизировать рецептуру, но не заменяет обязательные документы и требования применимого законодательства.</p>
        </>
      }
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(340px,0.72fr)]">
        <section className="min-w-0 space-y-5">
          <div className="rounded-3xl border border-rose-200 bg-white p-5 sm:p-7">
            <div className="flex items-center gap-3 text-rose-700"><Palette size={21} /><span className="text-sm font-semibold uppercase tracking-wide">Оформление PDF</span></div>
            <h2 className="mt-2 heading-font text-2xl font-semibold text-slate-950">Бренд и фотография продукта</h2>
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

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                { label: 'Логотип кофейни', hint: 'PNG, JPG, WEBP или SVG до 2 МБ', value: logoDataUrl, setter: setLogoDataUrl, max: 2, icon: ImagePlus, fit: 'object-contain p-2' },
                { label: 'Фото готового продукта', hint: 'Необязательно · JPG, PNG или WEBP до 5 МБ', value: dishPhotoDataUrl, setter: setDishPhotoDataUrl, max: 5, icon: ImageIcon, fit: 'object-cover' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-2xl border border-dashed border-rose-300 bg-rose-50 p-4">
                    <div className="flex gap-3">
                      <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-rose-200">
                        {item.value ? <img src={item.value} alt={`Предпросмотр: ${item.label}`} className={`h-full w-full ${item.fit}`} /> : <Icon className="text-rose-300" size={26} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900">{item.label}</div>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{item.hint}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <label className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-white px-3 text-xs font-semibold text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100">
                            {item.value ? 'Заменить' : 'Выбрать'}
                            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(event) => handleImage(event.target.files?.[0], item.setter, item.label, item.max)} />
                          </label>
                          {item.value ? <button type="button" onClick={() => item.setter(undefined)} className="h-8 px-2 text-xs font-semibold text-slate-600 hover:bg-white">Удалить</button> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
              <label className="block sm:col-span-2 lg:col-span-1">
                <span className="text-sm font-semibold text-slate-800">Категория</span>
                <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={60} className="mt-1.5 h-11 w-full bg-white px-3 text-base" />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Варианты подачи</p><h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Размеры</h2></div>
              <button type="button" onClick={addSize} disabled={sizes.length >= MAX_SIZES} className="inline-flex h-10 items-center justify-center gap-2 bg-rose-100 px-4 text-sm font-semibold text-rose-950 hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={17} /> Добавить размер</button>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">Если у продукта один выход, оставьте одну карточку. Для напитков можно объединить до четырёх объёмов.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {sizes.map((size, index) => (
                <div key={size.id} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-center justify-between gap-3"><div className="text-xs font-bold uppercase tracking-wide text-rose-700">Размер {index + 1}</div>{sizes.length > 1 ? <button type="button" aria-label={`Удалить размер ${size.name}`} onClick={() => removeSize(size.id)} className="flex h-8 w-8 items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button> : null}</div>
                  <div className="mt-3 grid grid-cols-[1fr_100px_78px] gap-2">
                    <label className="block"><span className="text-sm font-semibold text-slate-800">Название</span><input value={size.name} onChange={(event) => setSizes((current) => current.map((item) => item.id === size.id ? { ...item, name: event.target.value } : item))} maxLength={30} className="mt-1.5 h-11 w-full bg-white px-3 text-sm" /></label>
                    <NumberField id={`size-output-${size.id}`} label="Выход" value={size.outputAmount} onChange={(value) => setSizes((current) => current.map((item) => item.id === size.id ? { ...item, outputAmount: value } : item))} step={0.1} />
                    <label className="block"><span className="text-sm font-semibold text-slate-800">Ед.</span><select value={size.outputUnit} onChange={(event) => setSizes((current) => current.map((item) => item.id === size.id ? { ...item, outputUnit: event.target.value } : item))} className="mt-1.5 h-11 w-full bg-white px-2"><option>г</option><option>мл</option><option>шт</option></select></label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Рецептура</p><h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Ингредиенты по размерам</h2></div>
              <button type="button" onClick={addIngredient} disabled={ingredients.length >= MAX_INGREDIENTS} className="inline-flex h-10 items-center justify-center gap-2 bg-rose-100 px-4 text-sm font-semibold text-rose-950 hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={17} /> Добавить ингредиент</button>
            </div>
            <p className="mt-2 text-sm text-slate-600">Брутто и нетто меняются по размеру, закупочная цена у ингредиента общая.</p>
            <div className="mt-5 space-y-4">
              {ingredients.map((ingredient, index) => (
                <div key={ingredient.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_90px_150px_170px_44px] lg:items-end">
                    <label className="block"><span className="text-sm font-semibold text-slate-800">Ингредиент {index + 1}</span><input value={ingredient.name} onChange={(event) => updateIngredient(ingredient.id, { name: event.target.value })} className="mt-1.5 h-11 w-full bg-white px-3 font-semibold" /></label>
                    <label className="block"><span className="text-sm font-semibold text-slate-800">Ед.</span><select value={ingredient.unit} onChange={(event) => updateIngredient(ingredient.id, { unit: event.target.value as IngredientRow['unit'] })} className="mt-1.5 h-11 w-full bg-white px-2"><option>г</option><option>мл</option><option>шт</option></select></label>
                    <NumberField id={`package-price-${ingredient.id}`} label="Цена упаковки" value={ingredient.packagePrice} onChange={(value) => updateIngredient(ingredient.id, { packagePrice: value })} suffix="₽" step={0.01} />
                    <NumberField id={`package-amount-${ingredient.id}`} label="В упаковке" value={ingredient.packageAmount} onChange={(value) => updateIngredient(ingredient.id, { packageAmount: value })} suffix={ingredient.unit} step={0.1} />
                    {ingredients.length > 1 ? <button type="button" aria-label={`Удалить ${ingredient.name}`} onClick={() => setIngredients((current) => current.filter((row) => row.id !== ingredient.id))} className="flex h-11 w-11 items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={18} /></button> : null}
                  </div>

                  <div className="mt-4 overflow-x-auto pb-1">
                    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${sizes.length}, minmax(190px, 1fr))`, minWidth: `${sizes.length * 200}px` }}>
                      {sizes.map((size) => {
                        const amount = ingredient.amounts[size.id] ?? { grossAmount: 0, netAmount: 0 };
                        const cost = calculateIngredientCost({ packagePrice: ingredient.packagePrice, packageAmount: ingredient.packageAmount, recipeAmount: amount.netAmount });
                        return (
                          <div key={size.id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="truncate text-xs font-bold uppercase tracking-wide text-rose-700">{size.name} · {size.outputAmount} {size.outputUnit}</div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <NumberField id={`gross-${ingredient.id}-${size.id}`} label="Брутто" value={amount.grossAmount} onChange={(value) => updateIngredientAmount(ingredient.id, size.id, { grossAmount: value })} suffix={ingredient.unit} step={0.1} />
                              <NumberField id={`net-${ingredient.id}-${size.id}`} label="Нетто" value={amount.netAmount} onChange={(value) => updateIngredientAmount(ingredient.id, size.id, { netAmount: value })} suffix={ingredient.unit} step={0.1} />
                            </div>
                            <div className="mt-2 text-xs text-slate-500">В себестоимости: <strong className="text-slate-900">{formatMoney(cost, 2)}</strong></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Для читаемого одностраничного PDF доступно до {MAX_INGREDIENTS} ингредиентов.</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Общее для всех размеров</p>
            <h2 className="mt-1 heading-font text-2xl font-semibold text-slate-950">Технология и требования</h2>
            <div className="mt-5 grid gap-4">
              {[
                ['Технология приготовления', technology, setTechnology, 600],
                ['Подача и оформление', serving, setServing, 300],
                ['Условия и срок хранения', storage, setStorage, 300],
                ['Аллергены', allergens, setAllergens, 220],
              ].map(([label, value, setter, maxLength]) => (
                <label key={String(label)} className="block">
                  <span className="text-sm font-semibold text-slate-800">{String(label)}</span>
                  <textarea value={String(value)} onChange={(event) => (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)} maxLength={Number(maxLength)} rows={label === 'Технология приготовления' ? 4 : 2} className="mt-1.5 w-full resize-y bg-white p-3 text-sm leading-6" />
                </label>
              ))}
            </div>
          </div>
        </section>

        <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-3xl border border-rose-200 bg-white">
            {dishPhotoDataUrl ? <img src={dishPhotoDataUrl} alt={`Готовый продукт: ${recipeName}`} className="h-44 w-full object-cover" /> : null}
            <div className="p-6 text-white" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(brandColor) ? brandColor : '#7c3aed' }}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0"><div className="truncate text-sm font-semibold uppercase tracking-wide opacity-80">{coffeeShopName || 'Моя кофейня'}</div><div className="mt-1 text-xs opacity-70">Технологическая карта № {documentNumber || '001'}</div></div>
                {logoDataUrl ? <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-2"><img src={logoDataUrl} alt="" className="max-h-full max-w-full" /></div> : <FileText size={30} className="shrink-0 opacity-70" />}
              </div>
            </div>
            <div className="p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Предпросмотр · один лист A4</div>
              <h2 className="mt-2 heading-font text-3xl font-semibold text-slate-950">{recipeName || 'Название продукта'}</h2>
              <p className="mt-2 text-sm text-slate-600">{category || 'Категория'} · {sizes.length} {sizes.length === 1 ? 'размер' : 'размера'}</p>
              <div className="mt-5 space-y-2">
                {costsBySize.map((size) => (
                  <div key={size.id} className="flex items-center justify-between gap-4 rounded-xl bg-rose-50 px-4 py-3">
                    <div><div className="font-semibold text-rose-950">{size.name || 'Размер'}</div><div className="text-xs text-rose-700">{size.outputAmount} {size.outputUnit}</div></div>
                    <div className="text-lg font-semibold text-rose-950">{formatMoney(size.cost, 2)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 text-xs leading-5 text-slate-500">{ingredients.length} ингредиента · одна общая технология · один PDF-лист</div>
              <button type="button" onClick={downloadPdf} disabled={isDownloading} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">
                <Download size={18} /> {isDownloading ? 'Создаём PDF…' : 'Скачать технологическую карту'}
              </button>
              {message ? <p role="status" className={`mt-3 text-sm leading-5 ${message.startsWith('Одностраничный PDF готов') ? 'text-emerald-700' : 'text-red-700'}`}>{message}</p> : null}
              {generatedPdf ? <a data-testid="generated-pdf-link" href={generatedPdf.url} download={generatedPdf.filename} className="mt-3 inline-flex text-sm font-semibold text-primary hover:text-primary-dark">Скачать готовый PDF ещё раз →</a> : null}
              <p className="mt-4 text-xs leading-5 text-slate-500">PDF создаётся локально. Фото, логотип, рецептура и цены не загружаются на сервер Yago.</p>
            </div>
          </div>
        </aside>
      </div>
    </ToolShell>
  );
};

export default RecipeCardGeneratorPage;
