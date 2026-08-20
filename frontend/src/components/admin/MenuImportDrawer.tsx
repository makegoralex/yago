import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

import api from '../../lib/api';
import type { Category, Product } from '../../store/catalog';
import AdminDrawer from './AdminDrawer';
import { normalizeProductUnit, PRODUCT_UNITS, type ProductUnit } from '../../lib/productUnit';

type ImportField =
  | 'ignore'
  | 'name'
  | 'category'
  | 'basePrice'
  | 'unit'
  | 'manufacturer'
  | 'sku'
  | 'barcode'
  | 'discountType'
  | 'discountValue'
  | 'description'
  | 'imageUrl'
  | 'isActive';

type SourceColumn = {
  id: string;
  label: string;
  sample: string;
};

type SourceRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type ImportItem = {
  rowNumber: number;
  name: string;
  categoryId?: string;
  categoryName?: string;
  basePrice: number;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  unit: ProductUnit;
  manufacturer?: string;
  sku?: string;
  barcode?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
};

type AnalyzedRow = {
  rowNumber: number;
  name: string;
  category: string;
  price: string;
  status: 'ready' | 'skipped' | 'error';
  reason?: string;
  item?: ImportItem;
};

type ImportResponse = {
  imported: number;
  skipped: Array<{ rowNumber: number; reason: string }>;
  createdCategories: string[];
};

type MenuImportDrawerProps = {
  isOpen: boolean;
  categories: Category[];
  products: Product[];
  onClose: () => void;
  onImported: (result: { imported: number; skipped: number; createdCategories: number }) => Promise<void> | void;
};

const FIELD_OPTIONS: Array<{ value: ImportField; label: string }> = [
  { value: 'ignore', label: 'Не импортировать' },
  { value: 'name', label: 'Название *' },
  { value: 'category', label: 'Категория' },
  { value: 'basePrice', label: 'Цена *' },
  { value: 'unit', label: 'Единица продажи' },
  { value: 'manufacturer', label: 'Производитель' },
  { value: 'sku', label: 'Артикул' },
  { value: 'barcode', label: 'Штрихкод' },
  { value: 'discountType', label: 'Тип скидки' },
  { value: 'discountValue', label: 'Значение скидки' },
  { value: 'description', label: 'Описание' },
  { value: 'imageUrl', label: 'Ссылка на изображение' },
  { value: 'isActive', label: 'Статус продажи' },
];

const HEADER_ALIASES: Record<Exclude<ImportField, 'ignore'>, string[]> = {
  name: ['название', 'наименование', 'товар', 'позиция', 'блюдо', 'name', 'product'],
  category: ['категория', 'раздел', 'группа', 'category'],
  basePrice: ['цена', 'стоимость', 'цена продажи', 'розничная цена', 'price', 'base price'],
  unit: ['единица', 'единица продажи', 'ед измерения', 'unit'],
  manufacturer: ['производитель', 'бренд', 'изготовитель', 'manufacturer', 'vendor'],
  sku: ['артикул', 'sku', 'код товара'],
  barcode: ['штрихкод', 'штрих код', 'ean', 'barcode', 'gtin'],
  discountType: ['тип скидки', 'скидка тип', 'discount type'],
  discountValue: ['значение скидки', 'скидка', 'discount value'],
  description: ['описание', 'состав', 'description'],
  imageUrl: ['изображение', 'фото', 'ссылка на фото', 'image', 'image url'],
  isActive: ['статус', 'в продаже', 'активен', 'active', 'status'],
};

const normalizeText = (value: unknown): string => String(value ?? '').replace(/\s+/g, ' ').trim();
const normalizeKey = (value: string): string =>
  value
    .toLocaleLowerCase('ru-RU')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parsePrice = (value: string): number | null => {
  let normalized = value.replace(/\s/g, '').replace(/[^0-9,.-]/g, '');
  if (!normalized) return null;

  const commaIndex = normalized.lastIndexOf(',');
  const dotIndex = normalized.lastIndexOf('.');
  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalIndex = Math.max(commaIndex, dotIndex);
    normalized = `${normalized.slice(0, decimalIndex).replace(/[.,]/g, '')}.${normalized.slice(decimalIndex + 1)}`;
  } else if (commaIndex >= 0) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const parseActive = (value: string): boolean => {
  const normalized = normalizeKey(value);
  if (!normalized) return true;
  return !['нет', 'неактивен', 'скрыт', 'скрыто', 'архив', '0', 'false', 'off', 'inactive'].includes(normalized);
};

const parseDiscountType = (value: string): 'percentage' | 'fixed' | undefined => {
  if (value.trim() === '%') return 'percentage';
  const normalized = normalizeKey(value);
  if (!normalized) return undefined;
  if (['процент', 'процентная', 'percentage'].includes(normalized)) return 'percentage';
  if (['фиксированная', 'фикс', 'fixed', 'руб'].includes(normalized)) return 'fixed';
  return undefined;
};

const normalizeImportedUnit = (value: string): ProductUnit | null => {
  const normalized = normalizeKey(value);
  if (!normalized) return 'шт';
  const aliases: Record<string, ProductUnit> = {
    'шт': 'шт', 'штука': 'шт', 'штуки': 'шт',
    'г': 'гр', 'гр': 'гр', 'грамм': 'гр', 'граммы': 'гр',
    'кг': 'кг', 'килограмм': 'кг',
    'мл': 'мл', 'миллилитр': 'мл',
    'л': 'л', 'литр': 'л',
    'упак': 'упак', 'упаковка': 'упак',
  };
  return aliases[normalized] ?? null;
};

const detectField = (header: string): ImportField => {
  const normalized = normalizeKey(header);
  const match = (Object.entries(HEADER_ALIASES) as Array<[Exclude<ImportField, 'ignore'>, string[]]>).find(
    ([, aliases]) => aliases.some((alias) => normalized === alias || normalized.startsWith(`${alias} `))
  );
  return match?.[0] ?? 'ignore';
};

const MenuImportDrawer = ({ isOpen, categories, products, onClose, onImported }: MenuImportDrawerProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [columns, setColumns] = useState<SourceColumn[]>([]);
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, ImportField>>({});
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [processedRows, setProcessedRows] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number; createdCategories: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setFileName('');
      setSheetName('');
      setColumns([]);
      setRows([]);
      setMapping({});
      setDefaultCategoryId('');
      setFileError(null);
      setImportError(null);
      setIsImporting(false);
      setProcessedRows(0);
      setResult(null);
    }
  }, [isOpen]);

  const mappedColumn = useMemo(() => {
    const resultMap = new Map<ImportField, string>();
    for (const [columnId, field] of Object.entries(mapping)) {
      if (field !== 'ignore') resultMap.set(field, columnId);
    }
    return resultMap;
  }, [mapping]);

  const analysis = useMemo(() => {
    const nameColumn = mappedColumn.get('name');
    const priceColumn = mappedColumn.get('basePrice');
    const categoryColumn = mappedColumn.get('category');
    const existingNames = new Set(products.map((product) => normalizeKey(product.name)));
    const fileNames = new Set<string>();

    return rows.map<AnalyzedRow>((row) => {
      const name = nameColumn ? normalizeText(row.values[nameColumn]) : '';
      const rawPrice = priceColumn ? normalizeText(row.values[priceColumn]) : '';
      const price = parsePrice(rawPrice);
      const categoryName = categoryColumn ? normalizeText(row.values[categoryColumn]) : '';
      const fallbackCategory = categories.find((category) => category._id === defaultCategoryId);
      const category = categoryName || fallbackCategory?.name || '';

      if (!nameColumn || !priceColumn) {
        return { rowNumber: row.rowNumber, name, category, price: rawPrice, status: 'error', reason: 'Сопоставьте название и цену' };
      }
      if (!name) {
        return { rowNumber: row.rowNumber, name, category, price: rawPrice, status: 'error', reason: 'Пустое название' };
      }
      if (price === null) {
        return { rowNumber: row.rowNumber, name, category, price: rawPrice, status: 'error', reason: 'Некорректная цена' };
      }
      if (!category) {
        return { rowNumber: row.rowNumber, name, category, price: rawPrice, status: 'error', reason: 'Не указана категория' };
      }

      const unitColumn = mappedColumn.get('unit');
      const unit = normalizeImportedUnit(unitColumn ? normalizeText(row.values[unitColumn]) : '');
      if (!unit) {
        return {
          rowNumber: row.rowNumber,
          name,
          category,
          price: rawPrice,
          status: 'error',
          reason: `Неизвестная единица. Допустимо: ${PRODUCT_UNITS.join(', ')}`,
        };
      }

      const discountTypeColumn = mappedColumn.get('discountType');
      const discountValueColumn = mappedColumn.get('discountValue');
      const rawDiscountType = discountTypeColumn ? normalizeText(row.values[discountTypeColumn]) : '';
      const discountType = parseDiscountType(rawDiscountType);
      const rawDiscountValue = discountValueColumn ? normalizeText(row.values[discountValueColumn]) : '';
      const discountValue = rawDiscountValue ? parsePrice(rawDiscountValue) : null;
      if (rawDiscountType && !discountType) {
        return { rowNumber: row.rowNumber, name, category, price: rawPrice, status: 'error', reason: 'Тип скидки: «Процент» или «Фиксированная»' };
      }
      if (discountType && discountValue === null) {
        return { rowNumber: row.rowNumber, name, category, price: rawPrice, status: 'error', reason: 'Укажите значение скидки' };
      }
      if (discountType === 'percentage' && (discountValue ?? 0) > 100) {
        return { rowNumber: row.rowNumber, name, category, price: rawPrice, status: 'error', reason: 'Процент скидки не может быть больше 100' };
      }

      const nameKey = normalizeKey(name);
      if (existingNames.has(nameKey)) {
        return { rowNumber: row.rowNumber, name, category, price: rawPrice, status: 'skipped', reason: 'Уже есть в меню' };
      }
      if (fileNames.has(nameKey)) {
        return { rowNumber: row.rowNumber, name, category, price: rawPrice, status: 'skipped', reason: 'Дубликат в файле' };
      }
      fileNames.add(nameKey);

      const item: ImportItem = {
        rowNumber: row.rowNumber,
        name,
        basePrice: Number(price.toFixed(2)),
        isActive: mappedColumn.get('isActive') ? parseActive(row.values[mappedColumn.get('isActive')!] ?? '') : true,
        unit,
      };
      if (categoryName) item.categoryName = categoryName;
      else item.categoryId = defaultCategoryId;

      const descriptionColumn = mappedColumn.get('description');
      const imageColumn = mappedColumn.get('imageUrl');
      const manufacturerColumn = mappedColumn.get('manufacturer');
      const skuColumn = mappedColumn.get('sku');
      const barcodeColumn = mappedColumn.get('barcode');
      const description = descriptionColumn ? normalizeText(row.values[descriptionColumn]).slice(0, 2000) : '';
      const imageUrl = imageColumn ? normalizeText(row.values[imageColumn]).slice(0, 2000) : '';
      const manufacturer = manufacturerColumn ? normalizeText(row.values[manufacturerColumn]).slice(0, 200) : '';
      const sku = skuColumn ? normalizeText(row.values[skuColumn]).slice(0, 64) : '';
      const barcode = barcodeColumn ? normalizeText(row.values[barcodeColumn]).replace(/\D/g, '') : '';
      if (barcode && barcode.length !== 8 && barcode.length !== 13) {
        return { rowNumber: row.rowNumber, name, category, price: rawPrice, status: 'error', reason: 'Штрихкод должен содержать 8 или 13 цифр' };
      }
      if (description) item.description = description;
      if (imageUrl) item.imageUrl = imageUrl;
      if (manufacturer) item.manufacturer = manufacturer;
      if (sku) item.sku = sku;
      if (barcode) item.barcode = barcode;
      if (discountType) {
        item.discountType = discountType;
        item.discountValue = Number((discountValue ?? 0).toFixed(2));
      }

      return { rowNumber: row.rowNumber, name, category, price: price.toFixed(2), status: 'ready', item };
    });
  }, [categories, defaultCategoryId, mappedColumn, products, rows]);

  const readyItems = useMemo(
    () => analysis.flatMap((row) => (row.status === 'ready' && row.item ? [row.item] : [])),
    [analysis]
  );
  const errorCount = analysis.filter((row) => row.status === 'error').length;
  const skippedCount = analysis.filter((row) => row.status === 'skipped').length;
  const canImport = readyItems.length > 0 && errorCount === 0 && !isImporting;

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFileError(null);
    setImportError(null);
    setResult(null);
    if (file.size > 10 * 1024 * 1024) {
      setFileError('Файл слишком большой. Максимальный размер — 10 МБ.');
      return;
    }

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error('В файле нет листов');

      const matrix = XLSX.utils.sheet_to_json<Array<unknown>>(workbook.Sheets[firstSheetName], {
        header: 1,
        defval: '',
        raw: false,
        blankrows: false,
      });
      const headerIndex = matrix.findIndex((row) => row.some((cell) => normalizeText(cell)));
      if (headerIndex < 0) throw new Error('Файл пуст');

      const headerRow = matrix[headerIndex];
      const sourceColumns = headerRow.map((cell, index) => ({
        id: `column-${index}`,
        label: normalizeText(cell) || `Колонка ${index + 1}`,
        sample: normalizeText(matrix[headerIndex + 1]?.[index]),
      }));
      const sourceRows = matrix
        .slice(headerIndex + 1)
        .filter((row) => row.some((cell) => normalizeText(cell)))
        .slice(0, 2000)
        .map((row, index) => ({
          rowNumber: headerIndex + index + 2,
          values: Object.fromEntries(sourceColumns.map((column, columnIndex) => [column.id, normalizeText(row[columnIndex])])),
        }));

      if (sourceRows.length === 0) throw new Error('После строки заголовков нет данных');
      if (matrix.length - headerIndex - 1 > 2000) throw new Error('В одном файле можно импортировать не более 2000 строк');

      const detectedMapping: Record<string, ImportField> = {};
      const usedFields = new Set<ImportField>();
      for (const column of sourceColumns) {
        const field = detectField(column.label);
        detectedMapping[column.id] = field !== 'ignore' && !usedFields.has(field) ? field : 'ignore';
        usedFields.add(detectedMapping[column.id]);
      }

      setFileName(file.name);
      setSheetName(firstSheetName);
      setColumns(sourceColumns);
      setRows(sourceRows);
      setMapping(detectedMapping);
    } catch (error) {
      setColumns([]);
      setRows([]);
      setFileError(error instanceof Error ? error.message : 'Не удалось прочитать файл');
    }
  };

  const handleMappingChange = (columnId: string, field: ImportField) => {
    setMapping((current) => {
      const next = { ...current };
      if (field !== 'ignore') {
        for (const key of Object.keys(next)) {
          if (next[key] === field) next[key] = 'ignore';
        }
      }
      next[columnId] = field;
      return next;
    });
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/yago-menu-import-template.xlsx';
    link.download = 'yago-menu-import-template.xlsx';
    link.click();
  };

  const handleExportProducts = () => {
    const categoryMap = new Map(categories.map((category) => [category._id, category.name]));
    const rows = products.map((product) => [
      product.name,
      categoryMap.get(product.categoryId) ?? '',
      product.basePrice ?? product.price ?? 0,
      normalizeProductUnit(product.unit),
      product.manufacturer ?? '',
      product.sku ?? '',
      product.barcode ?? '',
      product.discountType === 'percentage' ? 'Процент' : product.discountType === 'fixed' ? 'Фиксированная' : '',
      product.discountValue ?? '',
      product.description ?? '',
      product.imageUrl ?? '',
      product.isActive === false ? 'Скрыта' : 'В продаже',
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Название', 'Категория', 'Цена', 'Единица продажи', 'Производитель', 'Артикул', 'Штрихкод', 'Тип скидки', 'Значение скидки', 'Описание', 'Ссылка на изображение', 'Статус'],
      ...rows,
    ]);
    worksheet['!cols'] = [
      { wch: 28 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 24 }, { wch: 18 },
      { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 36 }, { wch: 34 }, { wch: 16 },
    ];
    for (let row = 1; row <= rows.length; row += 1) {
      for (const column of ['F', 'G']) {
        const cell = worksheet[`${column}${row + 1}`];
        if (cell) {
          cell.t = 's';
          cell.z = '@';
        }
      }
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Меню');
    XLSX.writeFile(workbook, `yago-menu-${new Date().toISOString().slice(0, 10)}.xlsx`, { bookType: 'xlsx' });
  };

  const handleImport = async () => {
    if (!canImport) return;
    setIsImporting(true);
    setImportError(null);
    setProcessedRows(0);

    let imported = 0;
    let serverSkipped = 0;
    const createdCategories = new Set<string>();
    try {
      for (let offset = 0; offset < readyItems.length; offset += 200) {
        const chunk = readyItems.slice(offset, offset + 200);
        const response = await api.post('/api/catalog/products/import', {
          items: chunk,
          skipExisting: true,
        });
        const payload = (response.data?.data ?? response.data) as ImportResponse;
        imported += payload.imported ?? 0;
        serverSkipped += payload.skipped?.length ?? 0;
        for (const category of payload.createdCategories ?? []) createdCategories.add(category);
        setProcessedRows(Math.min(offset + chunk.length, readyItems.length));
      }

      const summary = {
        imported,
        skipped: skippedCount + serverSkipped,
        createdCategories: createdCategories.size,
      };
      setResult(summary);
      await onImported(summary);
    } catch (error) {
      const responseMessage =
        typeof (error as { response?: { data?: { error?: unknown } } }).response?.data?.error === 'string'
          ? String((error as { response?: { data?: { error?: unknown } } }).response?.data?.error)
          : '';
      setImportError(
        imported > 0
          ? `Импорт прерван после ${imported} позиций. ${responseMessage || 'Проверьте соединение и повторите импорт — уже добавленные позиции будут пропущены.'}`
          : responseMessage || 'Не удалось импортировать меню. Проверьте соединение и повторите попытку.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const progress = readyItems.length > 0 ? Math.round((processedRows / readyItems.length) * 100) : 0;

  return (
    <AdminDrawer
      isOpen={isOpen}
      title="Импорт меню"
      onClose={() => {
        if (!isImporting) onClose();
      }}
      widthClassName="max-w-[760px]"
      footer={
        result ? (
          <button type="button" onClick={onClose} className="w-full rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white">
            Готово
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onClose} disabled={isImporting} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50">
              Отмена
            </button>
            <button type="button" onClick={handleImport} disabled={!canImport} className="rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {isImporting ? `Импортируем… ${progress}%` : `Импортировать ${readyItems.length} позиций`}
            </button>
          </div>
        )
      }
    >
      <div className="space-y-6 text-sm">
        {result ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Меню импортировано</h3>
            <p className="mt-2 text-slate-600">Добавлено позиций: {result.imported}</p>
            {result.createdCategories > 0 ? <p className="text-slate-600">Создано категорий: {result.createdCategories}</p> : null}
            {result.skipped > 0 ? <p className="text-slate-600">Пропущено: {result.skipped}</p> : null}
          </div>
        ) : (
          <>
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">1. Выберите файл</h3>
                  <p className="mt-1 text-xs text-slate-500">Excel или CSV до 10 МБ, максимум 2000 строк. Заголовки должны быть в первой заполненной строке.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleDownloadTemplate} className="inline-flex items-center gap-1 rounded-full border border-violet-200 px-3 py-1.5 text-xs font-semibold text-violet-600 hover:bg-violet-50">
                    <Download size={14} /> Шаблон Excel
                  </button>
                  <button type="button" onClick={handleExportProducts} disabled={products.length === 0} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                    <Download size={14} /> Экспорт текущих
                  </button>
                </div>
              </div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="sr-only" />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isImporting}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-8 text-violet-700 transition hover:border-violet-400 hover:bg-violet-50"
              >
                {fileName ? <FileSpreadsheet size={24} /> : <Upload size={24} />}
                <span className="text-left">
                  <span className="block font-semibold">{fileName || 'Выбрать Excel или CSV'}</span>
                  {fileName ? <span className="block text-xs text-violet-500">Лист «{sheetName}», строк: {rows.length}. Нажмите, чтобы заменить файл.</span> : null}
                </span>
              </button>
              {fileError ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{fileError}</p> : null}
            </section>

            {columns.length > 0 ? (
              <section>
                <h3 className="font-semibold text-slate-900">2. Сопоставьте столбцы</h3>
                <p className="mt-1 text-xs text-slate-500">Мы определили знакомые заголовки автоматически. Проверьте соответствия перед импортом.</p>
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                  {columns.map((column) => (
                    <div key={column.id} className="grid gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{column.label}</p>
                        <p className="truncate text-xs text-slate-400">Пример: {column.sample || '—'}</p>
                      </div>
                      <select value={mapping[column.id] ?? 'ignore'} onChange={(event) => handleMappingChange(column.id, event.target.value as ImportField)} disabled={isImporting} className="rounded-xl border border-slate-200 px-3 py-2">
                        {FIELD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {!mappedColumn.has('category') ? (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs font-semibold uppercase text-slate-400">Категория для всех позиций *</span>
                    <select value={defaultCategoryId} onChange={(event) => setDefaultCategoryId(event.target.value)} disabled={isImporting} className="w-full rounded-xl border border-slate-200 px-3 py-2">
                      <option value="">Выберите категорию</option>
                      {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
                    </select>
                  </label>
                ) : (
                  <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-3 text-emerald-800">
                    <span className="block font-semibold">Новые категории создадим автоматически</span>
                    <span className="text-xs">Например, значение «Напитки» создаст одноимённую категорию, если её ещё нет.</span>
                  </div>
                )}
              </section>
            ) : null}

            {rows.length > 0 ? (
              <section>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">3. Проверьте данные</h3>
                    <p className="mt-1 text-xs text-slate-500">Готово: {readyItems.length} · Ошибки: {errorCount} · Дубликаты: {skippedCount}</p>
                  </div>
                  <span className="text-xs text-slate-400">Показаны первые 10 строк</span>
                </div>
                <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-3 py-2">Строка</th><th className="px-3 py-2">Название</th><th className="px-3 py-2">Категория</th><th className="px-3 py-2">Цена</th><th className="px-3 py-2">Проверка</th></tr></thead>
                    <tbody>
                      {analysis.slice(0, 10).map((row) => (
                        <tr key={row.rowNumber} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-400">{row.rowNumber}</td><td className="max-w-[180px] truncate px-3 py-2 font-medium text-slate-700">{row.name || '—'}</td><td className="max-w-[140px] truncate px-3 py-2 text-slate-600">{row.category || '—'}</td><td className="px-3 py-2 text-slate-600">{row.price || '—'}</td>
                          <td className={`px-3 py-2 ${row.status === 'ready' ? 'text-emerald-600' : row.status === 'skipped' ? 'text-amber-600' : 'text-red-600'}`}>{row.status === 'ready' ? 'Готово' : row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {errorCount > 0 ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">Исправьте сопоставление или файл: строки с ошибками не будут импортированы.</p> : null}
              </section>
            ) : null}

            {isImporting ? <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} /></div> : null}
            {importError ? <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{importError}</p> : null}
          </>
        )}
      </div>
    </AdminDrawer>
  );
};

export default MenuImportDrawer;
