export type RecipeCardIngredient = {
  name: string;
  grossAmount: number;
  netAmount: number;
  unit: string;
  cost: number;
};

export type RecipeCardPdfData = {
  coffeeShopName: string;
  logoDataUrl?: string;
  brandColor: string;
  recipeName: string;
  category: string;
  outputAmount: number;
  outputUnit: string;
  documentNumber: string;
  ingredients: RecipeCardIngredient[];
  technology: string;
  serving: string;
  storage: string;
  allergens: string;
};

const WIDTH = 1240;
const HEIGHT = 1754;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 84;
const encoder = new TextEncoder();

const safeColor = (value: string) => (/^#[0-9a-f]{6}$/i.test(value) ? value : '#7c3aed');

const roundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
};

const drawText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 20
) => {
  const words = (text || '—').trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current) lines.push(current);

  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length) {
    let last = visible[visible.length - 1];
    while (context.measureText(`${last}…`).width > maxWidth && last.length > 1) last = last.slice(0, -1);
    visible[visible.length - 1] = `${last}…`;
  }

  visible.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return visible.length * lineHeight;
};

const loadLogo = (dataUrl?: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });

const createPage = () => {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Браузер не поддерживает создание PDF');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.textBaseline = 'top';
  return { canvas, context };
};

const flattenCanvasBackground = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.save();
  context.globalCompositeOperation = 'destination-over';
  context.globalAlpha = 1;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
};

const drawHeader = (
  context: CanvasRenderingContext2D,
  data: RecipeCardPdfData,
  logo: HTMLImageElement | null,
  pageLabel: string
) => {
  const color = safeColor(data.brandColor);
  context.fillStyle = color;
  context.fillRect(0, 0, WIDTH, 250);
  context.fillStyle = '#ffffff';
  context.font = '700 27px Arial, sans-serif';
  context.fillText((data.coffeeShopName || 'МОЯ КОФЕЙНЯ').toUpperCase(), MARGIN, 58);
  context.font = '400 20px Arial, sans-serif';
  context.globalAlpha = 0.82;
  context.fillText('ТЕХНОЛОГИЧЕСКАЯ КАРТА', MARGIN, 105);
  context.fillText(pageLabel, MARGIN, 145);
  context.globalAlpha = 1;

  if (logo) {
    const boxX = WIDTH - MARGIN - 170;
    const boxY = 44;
    const boxWidth = 170;
    const boxHeight = 150;
    context.save();
    roundedRect(context, boxX, boxY, boxWidth, boxHeight, 24);
    context.clip();
    context.fillStyle = '#ffffff';
    context.fillRect(boxX, boxY, boxWidth, boxHeight);
    const scale = Math.min((boxWidth - 24) / logo.width, (boxHeight - 24) / logo.height);
    const width = logo.width * scale;
    const height = logo.height * scale;
    context.drawImage(logo, boxX + (boxWidth - width) / 2, boxY + (boxHeight - height) / 2, width, height);
    context.restore();
  }
};

const drawFooter = (context: CanvasRenderingContext2D, pageNumber: number, pageCount: number, color: string) => {
  context.strokeStyle = '#e2e8f0';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(MARGIN, HEIGHT - 92);
  context.lineTo(WIDTH - MARGIN, HEIGHT - 92);
  context.stroke();
  context.fillStyle = '#64748b';
  context.font = '400 18px Arial, sans-serif';
  context.fillText('Создано бесплатно на yago-app.ru/tools', MARGIN, HEIGHT - 62);
  context.fillStyle = color;
  context.textAlign = 'right';
  context.fillText(`${pageNumber} / ${pageCount}`, WIDTH - MARGIN, HEIGHT - 62);
  context.textAlign = 'left';
};

const drawIngredientPage = (
  context: CanvasRenderingContext2D,
  data: RecipeCardPdfData,
  logo: HTMLImageElement | null,
  ingredients: RecipeCardIngredient[],
  startIndex: number,
  pageNumber: number,
  pageCount: number
) => {
  const color = safeColor(data.brandColor);
  drawHeader(context, data, logo, pageNumber === 1 ? `№ ${data.documentNumber || '001'}` : 'Состав — продолжение');
  let y = 305;

  if (pageNumber === 1) {
    context.fillStyle = '#0f172a';
    context.font = '700 46px Arial, sans-serif';
    y += drawText(context, data.recipeName || 'Название блюда или напитка', MARGIN, y, WIDTH - MARGIN * 2, 56, 2) + 24;

    const cards = [
      ['Категория', data.category || 'Напитки'],
      ['Выход', `${data.outputAmount || 0} ${data.outputUnit || 'г'}`],
      ['Себестоимость', `${ingredients.reduce((sum, item) => sum + item.cost, 0).toFixed(2)} ₽`],
    ];
    const cardWidth = (WIDTH - MARGIN * 2 - 32) / 3;
    cards.forEach(([label, value], index) => {
      const x = MARGIN + index * (cardWidth + 16);
      roundedRect(context, x, y, cardWidth, 104, 18);
      context.fillStyle = '#f8fafc';
      context.fill();
      context.fillStyle = '#64748b';
      context.font = '400 17px Arial, sans-serif';
      context.fillText(label, x + 20, y + 20);
      context.fillStyle = '#0f172a';
      context.font = '700 23px Arial, sans-serif';
      context.fillText(value, x + 20, y + 55);
    });
    y += 144;
  }

  context.fillStyle = color;
  context.font = '700 24px Arial, sans-serif';
  context.fillText(pageNumber === 1 ? 'СОСТАВ И НОРМЫ ЗАКЛАДКИ' : 'ПРОДОЛЖЕНИЕ СОСТАВА', MARGIN, y);
  y += 48;

  const columns = [MARGIN, MARGIN + 500, MARGIN + 670, MARGIN + 840, MARGIN + 1010];
  const labels = ['Ингредиент', 'Брутто', 'Нетто', 'Ед.', 'Стоимость'];
  context.fillStyle = '#0f172a';
  context.font = '700 17px Arial, sans-serif';
  labels.forEach((label, index) => context.fillText(label, columns[index], y));
  y += 38;

  ingredients.forEach((item, index) => {
    if ((startIndex + index) % 2 === 0) {
      context.fillStyle = '#f8fafc';
      context.fillRect(MARGIN - 14, y - 12, WIDTH - MARGIN * 2 + 28, 62);
    }
    context.fillStyle = '#0f172a';
    context.font = '400 19px Arial, sans-serif';
    const name = item.name.length > 38 ? `${item.name.slice(0, 37)}…` : item.name;
    context.fillText(name || '—', columns[0], y);
    context.fillText(String(item.grossAmount || 0), columns[1], y);
    context.fillText(String(item.netAmount || 0), columns[2], y);
    context.fillText(item.unit || 'г', columns[3], y);
    context.fillText(`${(item.cost || 0).toFixed(2)} ₽`, columns[4], y);
    y += 62;
  });

  drawFooter(context, pageNumber, pageCount, color);
};

const drawTechnologyPage = (
  context: CanvasRenderingContext2D,
  data: RecipeCardPdfData,
  logo: HTMLImageElement | null,
  pageNumber: number,
  pageCount: number
) => {
  const color = safeColor(data.brandColor);
  drawHeader(context, data, logo, 'Технология приготовления');
  let y = 315;
  const sections = [
    ['ТЕХНОЛИЯ ПРИГОТОВЛЕНИЯ', data.technology],
    ['ПОДАЧА И ОФОРМЛЕНИЕ', data.serving],
    ['УСЛОВИЯ И СРОК ХРАНЕНИЯ', data.storage],
    ['АЛЛЕРГЕНЫ', data.allergens],
  ];

  sections.forEach(([title, body], index) => {
    context.fillStyle = color;
    context.font = '700 22px Arial, sans-serif';
    context.fillText(title, MARGIN, y);
    y += 42;
    context.fillStyle = '#334155';
    context.font = '400 22px Arial, sans-serif';
    const maxLines = index === 0 ? 10 : 5;
    y += drawText(context, body || 'Не указано', MARGIN, y, WIDTH - MARGIN * 2, 34, maxLines) + 34;
  });

  const totalCost = data.ingredients.reduce((sum, item) => sum + Math.max(0, item.cost || 0), 0);
  roundedRect(context, MARGIN, Math.min(y + 10, HEIGHT - 250), WIDTH - MARGIN * 2, 112, 20);
  context.fillStyle = '#f8fafc';
  context.fill();
  context.fillStyle = '#64748b';
  context.font = '400 18px Arial, sans-serif';
  context.fillText('ИТОГОВАЯ СЕБЕСТОИМОСТЬ', MARGIN + 24, Math.min(y + 34, HEIGHT - 226));
  context.fillStyle = '#0f172a';
  context.font = '700 32px Arial, sans-serif';
  context.fillText(`${totalCost.toFixed(2)} ₽`, MARGIN + 24, Math.min(y + 64, HEIGHT - 196));
  drawFooter(context, pageNumber, pageCount, color);
};

const dataUrlToBytes = (dataUrl: string) => {
  const binary = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const concatBytes = (parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
};

const canvasesToPdf = (canvases: HTMLCanvasElement[]) => {
  const objectCount = 2 + canvases.length * 3;
  const objects: Uint8Array[] = new Array(objectCount + 1);
  objects[1] = encoder.encode('<< /Type /Catalog /Pages 2 0 R >>');
  const pageReferences = canvases.map((_, index) => `${3 + index * 3} 0 R`).join(' ');
  objects[2] = encoder.encode(`<< /Type /Pages /Kids [${pageReferences}] /Count ${canvases.length} >>`);

  canvases.forEach((canvas, index) => {
    const pageObject = 3 + index * 3;
    const imageObject = pageObject + 1;
    const contentObject = pageObject + 2;
    flattenCanvasBackground(canvas);
    const jpeg = dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.94));
    const imageHeader = encoder.encode(
      `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
    );
    objects[imageObject] = concatBytes([imageHeader, jpeg, encoder.encode('\nendstream')]);
    const content = encoder.encode(`q\n${PAGE_WIDTH} 0 0 ${PAGE_HEIGHT} 0 0 cm\n/Im0 Do\nQ`);
    objects[contentObject] = concatBytes([
      encoder.encode(`<< /Length ${content.length} >>\nstream\n`),
      content,
      encoder.encode('\nendstream'),
    ]);
    objects[pageObject] = encoder.encode(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`
    );
  });

  const parts: Uint8Array[] = [encoder.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  const offsets = new Array(objectCount + 1).fill(0);
  let cursor = parts[0].length;
  for (let objectNumber = 1; objectNumber <= objectCount; objectNumber += 1) {
    offsets[objectNumber] = cursor;
    const object = concatBytes([
      encoder.encode(`${objectNumber} 0 obj\n`),
      objects[objectNumber],
      encoder.encode('\nendobj\n'),
    ]);
    parts.push(object);
    cursor += object.length;
  }

  const xrefOffset = cursor;
  const xref = [
    `xref\n0 ${objectCount + 1}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
  ].join('');
  parts.push(encoder.encode(xref));
  return new Blob([concatBytes(parts)], { type: 'application/pdf' });
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'tehnologicheskaya-karta';

export const downloadRecipeCardPdf = async (data: RecipeCardPdfData) => {
  const logo = await loadLogo(data.logoDataUrl);
  const ingredients = data.ingredients.length ? data.ingredients : [{ name: 'Ингредиент', grossAmount: 0, netAmount: 0, unit: 'г', cost: 0 }];
  const chunks: RecipeCardIngredient[][] = [];
  for (let index = 0; index < ingredients.length; index += 12) chunks.push(ingredients.slice(index, index + 12));
  const pageCount = chunks.length + 1;
  const canvases = chunks.map((chunk, index) => {
    const { canvas, context } = createPage();
    drawIngredientPage(context, data, logo, chunk, index * 12, index + 1, pageCount);
    return canvas;
  });
  const technologyPage = createPage();
  drawTechnologyPage(technologyPage.context, data, logo, pageCount, pageCount);
  canvases.push(technologyPage.canvas);

  const url = URL.createObjectURL(canvasesToPdf(canvases));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(data.recipeName)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
};
