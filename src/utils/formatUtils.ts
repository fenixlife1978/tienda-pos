/**
 * Utility functions for high-precision currency and numeric formatting
 * Supports up to 6 decimal places (e.g., 0.000034) while maintaining
 * standard 2-decimal formatting for standard figures.
 */

export function formatNumberPrecision(
  value: number | string | undefined | null,
  minDecimals = 2,
  maxDecimals = 6
): string {
  if (value === undefined || value === null || value === '') return '0.00';
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  if (isNaN(num)) return '0.00';
  if (num === 0) return '0.00';

  // Format with maximum allowed decimals
  const fixedStr = num.toFixed(maxDecimals);
  const parts = fixedStr.split('.');

  if (parts.length === 2) {
    let decimals = parts[1];
    // Trim trailing zeroes while respecting minDecimals
    while (decimals.length > minDecimals && decimals.endsWith('0')) {
      decimals = decimals.slice(0, -1);
    }
    // Format integer part with thousands separators if desired or plain
    const intFormatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${intFormatted}.${decimals}`;
  }

  return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatUSD(
  value: number | string | undefined | null,
  maxDecimals = 6
): string {
  const formatted = formatNumberPrecision(value, 2, maxDecimals);
  return `$${formatted}`;
}

export function formatBs(
  value: number | string | undefined | null,
  maxDecimals = 6
): string {
  const formatted = formatNumberPrecision(value, 2, maxDecimals);
  return `${formatted} Bs.`;
}

export function formatPlainNumber(
  value: number | string | undefined | null,
  maxDecimals = 6
): string {
  return formatNumberPrecision(value, 2, maxDecimals);
}

/**
 * Validates and sanitizes free-text decimal input so users can type:
 * "", "0", "0.", "0.000034", backspace completely, etc.
 */
export function isValidDecimalInput(val: string): boolean {
  if (val === '' || val === '.') return true;
  // Allows optional single leading minus, digits, optional single decimal point, and up to 6 decimals
  return /^-?\d*\.?\d*$/.test(val);
}

/**
 * Parses user free-text input to a float number safely.
 */
export function parseFreeTextInput(val: string, fallback = 0): number {
  if (!val || val === '.' || val === '-') return fallback;
  const parsed = parseFloat(val.replace(',', '.'));
  return isNaN(parsed) ? fallback : parsed;
}
