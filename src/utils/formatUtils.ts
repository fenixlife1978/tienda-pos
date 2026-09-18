/**
 * Formateo monetario centralizado para todo el sistema.
 * Moneda Venezuela: separador de miles "." y decimales ",".
 * Ejemplos: Bs 12.345,67 / $12.345,67.
 */

export function formatNumberPrecision(value: number | string | undefined | null, minDecimals = 2, maxDecimals = 6): string {
  if (value === undefined || value === null || value === '') return '0.00';
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (isNaN(num)) return '0.00';
  if (num === 0) return '0.00';
  const fixedStr = num.toFixed(maxDecimals);
  const parts = fixedStr.split('.');
  if (parts.length === 2) {
    let decimals = parts[1];
    while (decimals.length > minDecimals && decimals.endsWith('0')) decimals = decimals.slice(0, -1);
    const intFormatted = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
    return parts[0] ? intFormatted + '.' + decimals : '0.' + decimals;
  }
  return parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
}

/** Formato monetario venezolano: $XX.XXX,XX */
export function formatUSD(value: number | string | undefined | null, _maxDecimals = 2): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(num)) return '$0,00';
  return '$' + num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formato monetario venezolano: Bs XX.XXX,XX */
export function formatBs(value: number | string | undefined | null, _maxDecimals = 2): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(num)) return 'Bs 0,00';
  return 'Bs ' + num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPlainNumber(value: number | string | undefined | null, maxDecimals = 6): string {
  return formatNumberPrecision(value, 2, maxDecimals);
}

export function isValidDecimalInput(val: string): boolean {
  if (val === '' || val === '.') return true;
  return /^-?\\d*\\.?\\d*$/.test(val);
}

export function parseFreeTextInput(val: string, fallback = 0): number {
  if (!val || val === '.' || val === '-') return fallback;
  const parsed = parseFloat(val.replace(',', '.'));
  return isNaN(parsed) ? fallback : parsed;
}
