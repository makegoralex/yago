export type RecipeCardSize = {
  id: number;
  name: string;
  outputAmount: number;
  outputUnit: string;
};

export type RecipeCardSizeAmount = {
  sizeId: number;
  grossAmount: number;
  netAmount: number;
  cost: number;
};

export type RecipeCardIngredient = {
  name: string;
  unit: string;
  amounts: RecipeCardSizeAmount[];
};

export type RecipeCardPdfData = {
  coffeeShopName: string;
  logoDataUrl?: string;
  dishPhotoDataUrl?: string;
  brandColor: string;
  recipeName: string;
  category: string;
  documentNumber: string;
  sizes: RecipeCardSize[];
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
const MARGIN = 68;
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

const loadImage = (dataUrl?: string) =>
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

const drawImageContain = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  padding = 12
) => {
  const scale = Math.min((width - padding * 2) / image.width, (height - padding * 2) / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  context.drawImage(image, x + (width - imageWidth) / 2, y + (height - imageHeight) / 2, imageWidth, imageHeight);
};

const drawImageCover = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const scale = Math.max(width / image.width, height / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  context.save();
  roundedRect(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(image, x + (width - imageWidth) / 2, y + (height - imageHeight) / 2, imageWidth, imageHeight);
  context.restore();
};

const createPage = () => {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
  if (!context) throw new Error('Браузер не поддерживает создание PDF');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.textBaseline = 'top';
  return { canvas, context };
};

const getAmount = (ingredient: RecipeCardIngredient, sizeId: number) =>
  ingredient.amounts.find((amount) => amount.sizeId === sizeId) ?? {
    sizeId,
    grossAmount: 0,
    netAmount: 0,
    cost: 0,
  };

const drawHeader = (
  context: CanvasRenderingContext2D,
  data: RecipeCardPdfData,
  logo: HTMLImageElement | null,
  dishPhoto: HTMLImageElement | null
) => {
  const color = safeColor(data.brandColor);
  context.fillStyle = color;
  context.fillRect(0, 0, WIDTH, 218);

  let textX = MARGIN;
  if (logo) {
    const logoX = MARGIN;
    const logoY = 46;
    const logoWidth = 150;
    const logoHeight = 118;
    roundedRect(context, logoX, logoY, logoWidth, logoHeight, 20);
    context.fillStyle = '#ffffff';
    context.fill();
    drawImageContain(context, logo, logoX, logoY, logoWidth, logoHeight);
    textX = logoX + logoWidth + 28;
  }

  const photoWidth = dishPhoto ? 220 : 0;
  const textWidth = WIDTH - textX - MARGIN - photoWidth - (dishPhoto ? 28 : 0);
  context.fillStyle = '#ffffff';
  context.font = '700 27px Arial, sans-serif';
  drawText(context, (data.coffeeShopName || 'МОЯ КОФЕЙНЯ').toUpperCase(), textX, 48, textWidth, 32, 1);
  context.font = '400 18px Arial, sans-serif';
  context.globalAlpha = 0.82;
  context.fillText('ТЕХНОЛОГИЧЕСКАЯ КАРТА', textX, 92);
  context.fillText(`№ ${data.documentNumber || '001'}`, textX, 126);
  context.globalAlpha = 1;

  if (dishPhoto) drawImageCover(context, dishPhoto, WIDTH - MARGIN - photoWidth, 30, photoWidth, 158, 24);
};

const drawRecipeTitle = (context: CanvasRenderingContext2D, data: RecipeCardPdfData) => {
  context.fillStyle = '#0f172a';
  context.font = '700 40px Arial, sans-serif';
  const titleHeight = drawText(context, data.recipeName || 'Название блюда или напитка', MARGIN, 252, WIDTH - MARGIN * 2, 46, 2);
  const metaY = 252 + titleHeight + 10;
  context.fillStyle = '#64748b';
  context.font = '400 18px Arial, sans-serif';
  context.fillText(data.category || 'Без категории', MARGIN, metaY);
  context.textAlign = 'right';
  context.fillText(`${data.sizes.length} ${data.sizes.length === 1 ? 'размер' : data.sizes.length < 5 ? 'размера' : 'размеров'}`, WIDTH - MARGIN, metaY);
  context.textAlign = 'left';
  return metaY + 42;
};

const drawIngredientTable = (context: CanvasRenderingContext2D, data: RecipeCardPdfData, startY: number) => {
  const color = safeColor(data.brandColor);
  const sizes = data.sizes.slice(0, 4);
  const ingredients = data.ingredients.slice(0, 12);
  const tableWidth = WIDTH - MARGIN * 2;
  const nameWidth = sizes.length === 1 ? 390 : sizes.length === 2 ? 330 : 270;
  const sizeWidth = (tableWidth - nameWidth) / sizes.length;
  const headerHeight = 70;
  const rowHeight = ingredients.length > 9 ? 44 : ingredients.length > 6 ? 50 : 56;

  roundedRect(context, MARGIN, startY, tableWidth, headerHeight, 16);
  context.fillStyle = '#f1f5f9';
  context.fill();
  context.fillStyle = '#475569';
  context.font = '700 16px Arial, sans-serif';
  context.fillText('ИНГРЕДИЕНТ', MARGIN + 18, startY + 25);

  sizes.forEach((size, index) => {
    const x = MARGIN + nameWidth + index * sizeWidth;
    context.strokeStyle = '#cbd5e1';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, startY + 12);
    context.lineTo(x, startY + headerHeight - 12);
    context.stroke();
    context.fillStyle = '#0f172a';
    context.font = '700 17px Arial, sans-serif';
    context.fillText(size.name || `Размер ${index + 1}`, x + 16, startY + 14);
    context.fillStyle = '#64748b';
    context.font = '400 14px Arial, sans-serif';
    context.fillText(`${size.outputAmount || 0} ${size.outputUnit || 'г'} · брутто / нетто`, x + 16, startY + 40);
  });

  let y = startY + headerHeight;
  ingredients.forEach((ingredient, rowIndex) => {
    if (rowIndex % 2 === 0) {
      context.fillStyle = '#f8fafc';
      context.fillRect(MARGIN, y, tableWidth, rowHeight);
    }
    context.fillStyle = '#0f172a';
    context.font = '600 17px Arial, sans-serif';
    const availableCharacters = sizes.length > 2 ? 25 : 34;
    const ingredientName = ingredient.name.length > availableCharacters
      ? `${ingredient.name.slice(0, availableCharacters - 1)}…`
      : ingredient.name;
    context.fillText(ingredientName || '—', MARGIN + 18, y + 10);
    context.fillStyle = '#64748b';
    context.font = '400 13px Arial, sans-serif';
    context.fillText(ingredient.unit || 'г', MARGIN + 18, y + 31);

    sizes.forEach((size, sizeIndex) => {
      const amount = getAmount(ingredient, size.id);
      const x = MARGIN + nameWidth + sizeIndex * sizeWidth;
      context.fillStyle = '#0f172a';
      context.font = '600 16px Arial, sans-serif';
      context.fillText(`${amount.grossAmount || 0} / ${amount.netAmount || 0} ${ingredient.unit}`, x + 16, y + 9);
      context.fillStyle = '#64748b';
      context.font = '400 13px Arial, sans-serif';
      context.fillText(`${amount.cost.toFixed(2)} ₽`, x + 16, y + 31);
    });
    y += rowHeight;
  });

  const costY = y + 12;
  context.fillStyle = color;
  context.font = '700 16px Arial, sans-serif';
  context.fillText('СЕБЕСТОИМОСТЬ', MARGIN, costY + 18);
  sizes.forEach((size, index) => {
    const total = ingredients.reduce((sum, ingredient) => sum + getAmount(ingredient, size.id).cost, 0);
    const x = MARGIN + nameWidth + index * sizeWidth;
    context.fillStyle = color;
    context.font = '700 20px Arial, sans-serif';
    context.fillText(`${total.toFixed(2)} ₽`, x + 16, costY + 15);
  });

  return costY + 58;
};

const drawProcess = (context: CanvasRenderingContext2D, data: RecipeCardPdfData, startY: number) => {
  const color = safeColor(data.brandColor);
  const availableHeight = HEIGHT - startY - 106;
  const leftWidth = 650;
  const gap = 42;
  const rightX = MARGIN + leftWidth + gap;
  const rightWidth = WIDTH - MARGIN - rightX;

  context.fillStyle = color;
  context.font = '700 18px Arial, sans-serif';
  context.fillText('ТЕХНОЛИЯ ПРИГОТОВЛЕНИЯ', MARGIN, startY);
  context.fillStyle = '#334155';
  context.font = '400 18px Arial, sans-serif';
  drawText(context, data.technology, MARGIN, startY + 31, leftWidth, 27, Math.max(4, Math.floor((availableHeight - 31) / 27)));

  const sections = [
    ['ПОДАЧА', data.serving],
    ['ХРАНЕНИЕ', data.storage],
    ['АЛЛЕРГЕНЫ', data.allergens],
  ];
  let rightY = startY;
  const sectionHeight = Math.floor(availableHeight / 3);
  sections.forEach(([title, value]) => {
    context.fillStyle = color;
    context.font = '700 17px Arial, sans-serif';
    context.fillText(title, rightX, rightY);
    context.fillStyle = '#334155';
    context.font = '400 16px Arial, sans-serif';
    drawText(context, value, rightX, rightY + 28, rightWidth, 23, Math.max(2, Math.floor((sectionHeight - 36) / 23)));
    rightY += sectionHeight;
  });
};

const drawFooter = (context: CanvasRenderingContext2D, color: string) => {
  context.strokeStyle = '#e2e8f0';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(MARGIN, HEIGHT - 78);
  context.lineTo(WIDTH - MARGIN, HEIGHT - 78);
  context.stroke();
  context.fillStyle = '#64748b';
  context.font = '400 15px Arial, sans-serif';
  context.fillText('Создано бесплатно на yago-app.ru/tools', MARGIN, HEIGHT - 52);
  context.fillStyle = color;
  context.textAlign = 'right';
  context.fillText('Технологическая карта · 1 лист', WIDTH - MARGIN, HEIGHT - 52);
  context.textAlign = 'left';
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

const canvasToPdf = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d');
  if (context) {
    context.save();
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
  }

  const jpeg = dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.94));
  const content = encoder.encode(`q\n${PAGE_WIDTH} 0 0 ${PAGE_HEIGHT} 0 0 cm\n/Im0 Do\nQ`);
  const objects: Uint8Array[] = [
    new Uint8Array(),
    encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'),
    encoder.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    concatBytes([
      encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
      jpeg,
      encoder.encode('\nendstream'),
    ]),
    concatBytes([
      encoder.encode(`<< /Length ${content.length} >>\nstream\n`),
      content,
      encoder.encode('\nendstream'),
    ]),
  ];

  const parts: Uint8Array[] = [encoder.encode('%PDF-1.4\n%Yago\n')];
  const offsets = new Array(objects.length).fill(0);
  let cursor = parts[0].length;
  for (let objectNumber = 1; objectNumber < objects.length; objectNumber += 1) {
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
    `xref\n0 ${objects.length}\n`,
    '0000000000 65535 f \n',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
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
  const [logo, dishPhoto] = await Promise.all([loadImage(data.logoDataUrl), loadImage(data.dishPhotoDataUrl)]);
  const { canvas, context } = createPage();
  drawHeader(context, data, logo, dishPhoto);
  const titleEndY = drawRecipeTitle(context, data);
  const tableEndY = drawIngredientTable(context, data, titleEndY);
  drawProcess(context, data, tableEndY + 12);
  drawFooter(context, safeColor(data.brandColor));

  const url = URL.createObjectURL(canvasToPdf(canvas));
  const filename = `${slugify(data.recipeName)}.pdf`;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return { url, filename };
};
