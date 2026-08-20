const LEFT_ODD: Record<string, string> = {
  '0': '0001101', '1': '0011001', '2': '0010011', '3': '0111101', '4': '0100011',
  '5': '0110001', '6': '0101111', '7': '0111011', '8': '0110111', '9': '0001011',
};
const LEFT_EVEN: Record<string, string> = {
  '0': '0100111', '1': '0110011', '2': '0011011', '3': '0100001', '4': '0011101',
  '5': '0111001', '6': '0000101', '7': '0010001', '8': '0001001', '9': '0010111',
};
const RIGHT: Record<string, string> = {
  '0': '1110010', '1': '1100110', '2': '1101100', '3': '1000010', '4': '1011100',
  '5': '1001110', '6': '1010000', '7': '1000100', '8': '1001000', '9': '1110100',
};
const PARITY = ['OOOOOO', 'OOEOEE', 'OOEEOE', 'OOEEEO', 'OEOOEE', 'OEEOOE', 'OEEEOO', 'OEOEOE', 'OEOEEO', 'OEEOEO'];

export const createEan13Svg = (barcode: string, caption?: string): string => {
  if (!/^\d{13}$/.test(barcode)) throw new Error('Для скачивания нужен EAN-13');
  const parity = PARITY[Number(barcode[0])];
  let bits = '101';
  for (let index = 1; index <= 6; index += 1) {
    bits += parity[index - 1] === 'O' ? LEFT_ODD[barcode[index]] : LEFT_EVEN[barcode[index]];
  }
  bits += '01010';
  for (let index = 7; index <= 12; index += 1) bits += RIGHT[barcode[index]];
  bits += '101';

  const bars = bits.split('').map((bit, index) => bit === '1'
    ? `<rect x="${12 + index * 2}" y="12" width="2" height="72"/>`
    : '').join('');
  const safeCaption = (caption ?? '').replace(/[&<>"']/g, (value) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[value] ?? value);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="214" height="120" viewBox="0 0 214 120"><rect width="100%" height="100%" fill="white"/><g fill="black">${bars}</g><text x="107" y="101" text-anchor="middle" font-family="Arial, sans-serif" font-size="14">${barcode}</text>${safeCaption ? `<text x="107" y="116" text-anchor="middle" font-family="Arial, sans-serif" font-size="9">${safeCaption}</text>` : ''}</svg>`;
};

export const downloadEan13Svg = (barcode: string, caption?: string): void => {
  const blob = new Blob([createEan13Svg(barcode, caption)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${caption?.trim().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '') || 'barcode'}-${barcode}.svg`;
  link.click();
  URL.revokeObjectURL(url);
};
