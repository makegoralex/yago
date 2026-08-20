import { Types } from 'mongoose';

const ean13CheckDigit = (firstTwelveDigits: string): number => {
  const sum = firstTwelveDigits.split('').reduce((total, digit, index) => {
    return total + Number(digit) * (index % 2 === 0 ? 1 : 3);
  }, 0);
  return (10 - (sum % 10)) % 10;
};

export const generateProductSku = (id: Types.ObjectId): string =>
  `YG-${id.toHexString().slice(-8).toUpperCase()}`;

export const generateProductBarcode = (id: Types.ObjectId): string => {
  const numericId = BigInt(`0x${id.toHexString().slice(-10)}`).toString().slice(-10).padStart(10, '0');
  const firstTwelveDigits = `20${numericId}`;
  return `${firstTwelveDigits}${ean13CheckDigit(firstTwelveDigits)}`;
};

export const isValidEan = (barcode: string): boolean => {
  if (!/^\d{8}$|^\d{13}$/.test(barcode)) return false;
  const body = barcode.slice(0, -1);
  const expected = barcode.length === 13
    ? ean13CheckDigit(body)
    : (10 - (body.split('').reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0) % 10)) % 10;
  return expected === Number(barcode.at(-1));
};
