export const formatMoney = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0);

export const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits }).format(Number.isFinite(value) ? value : 0);

export const formatPercent = (value: number, maximumFractionDigits = 1) =>
  `${formatNumber(value, maximumFractionDigits)}%`;
