import { Product } from '../types';

export type SKUStrategy =
  | 'category_name_seq'   // e.g., VIV-HAR-0001 (Category 3-char + Name 3-char + Sequence)
  | 'category_seq'        // e.g., VIV-00124 (Category 3-char + Sequence)
  | 'prefix_seq'          // e.g., SKU-00124 or PROD-00124
  | 'ean13'               // e.g., 7590001000427 (Valid 13-digit EAN-13 Barcode with Checksum)
  | 'name_compact'        // e.g., HARINA-PAN-1KG
  | 'date_random';        // e.g., SKU-2609-8472

export interface SKUGeneratorOptions {
  strategy?: SKUStrategy;
  category?: string;
  name?: string;
  prefix?: string;
  digits?: number;
  separator?: string;
  autoUppercase?: boolean;
}

export interface SKUValidationResult {
  isValid: boolean;
  isDuplicate: boolean;
  duplicateProduct?: Product;
  warning?: string;
  error?: string;
}

/**
 * Normalizes text to 3-4 clean uppercase alphanumeric chars without accents/diacritics.
 */
export function sanitizeToken(text: string, maxLen = 3): string {
  if (!text) return 'GEN';
  const clean = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!clean) return 'GEN';
  return clean.substring(0, maxLen).padEnd(maxLen, 'X');
}

/**
 * Calculates standard GS1 / EAN-13 Modulo-10 Checksum Digit.
 */
export function calculateEAN13CheckDigit(first12Digits: string): number {
  const digits = first12Digits.replace(/\D/g, '').padStart(12, '0').slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits[i], 10);
    sum += i % 2 === 0 ? digit * 1 : digit * 3;
  }
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

/**
 * Generates a valid 13-digit EAN-13 barcode with country prefix and verified check digit.
 * Default prefix is 759 (GS1 Country Code for Venezuela).
 */
export function generateEAN13(sequence: number, countryPrefix = '759'): string {
  // Prefix (3) + Company/Internal Sub-prefix (4) + Item Sequence (5) = 12 digits
  const internalPrefix = '0001';
  const seqStr = String(sequence % 100000).padStart(5, '0');
  const first12 = `${countryPrefix}${internalPrefix}${seqStr}`;
  const checkDigit = calculateEAN13CheckDigit(first12);
  return `${first12}${checkDigit}`;
}

/**
 * Checks if a candidate SKU is already used in existing products (case-insensitive).
 */
export function isSKUTaken(
  candidate: string,
  existingProducts: Product[],
  excludeProductId?: string | null
): boolean {
  const target = candidate.trim().toUpperCase();
  if (!target) return false;
  return existingProducts.some(
    (p) =>
      p.code &&
      p.code.trim().toUpperCase() === target &&
      (!excludeProductId || p.id !== excludeProductId)
  );
}

/**
 * Validates SKU uniqueness and syntax rules.
 */
export function validateSKU(
  sku: string,
  existingProducts: Product[],
  excludeProductId?: string | null
): SKUValidationResult {
  const clean = sku.trim();
  if (!clean) {
    return {
      isValid: false,
      isDuplicate: false,
      error: 'El código SKU no puede estar vacío.',
    };
  }

  if (clean.length < 2) {
    return {
      isValid: false,
      isDuplicate: false,
      error: 'El SKU debe tener al menos 2 caracteres.',
    };
  }

  if (clean.length > 32) {
    return {
      isValid: false,
      isDuplicate: false,
      error: 'El SKU no debe exceder 32 caracteres.',
    };
  }

  // Check for duplicate in existing products
  const duplicate = existingProducts.find(
    (p) =>
      p.code &&
      p.code.trim().toUpperCase() === clean.toUpperCase() &&
      (!excludeProductId || p.id !== excludeProductId)
  );

  if (duplicate) {
    return {
      isValid: false,
      isDuplicate: true,
      duplicateProduct: duplicate,
      error: `Código duplicado: Ya está en uso por "${duplicate.name}" (${duplicate.code}).`,
    };
  }

  // Soft warning for unusual characters
  if (/[\s]/.test(clean)) {
    return {
      isValid: true,
      isDuplicate: false,
      warning: 'Se recomienda no incluir espacios en los códigos SKU para evitar fallos de lectura óptica.',
    };
  }

  return {
    isValid: true,
    isDuplicate: false,
  };
}

/**
 * Core unique SKU generation engine.
 * Guarantees a collision-free identifier by checking existing products and automatically incrementing sequences.
 */
export function generateUniqueSKU(
  options: SKUGeneratorOptions,
  existingProducts: Product[],
  excludeProductId?: string | null
): string {
  const strategy = options.strategy || 'category_name_seq';
  const category = options.category || 'General';
  const name = options.name || '';
  const customPrefix = options.prefix?.trim() || 'SKU';
  const digits = options.digits || 4;
  const sep = options.separator !== undefined ? options.separator : '-';

  const catToken = sanitizeToken(category, 3);
  
  // Extract meaningful words from name
  const nameWords = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(DE|LA|EL|LOS|LAS|CON|PARA|DEL|UN|UNA)$/i.test(w));
  const primaryNameWord = nameWords[0] || name;
  const nameToken = sanitizeToken(primaryNameWord, 3);

  // Determine base prefix
  let basePrefix = '';
  switch (strategy) {
    case 'category_name_seq':
      basePrefix = `${catToken}${sep}${nameToken}${sep}`;
      break;
    case 'category_seq':
      basePrefix = `${catToken}${sep}`;
      break;
    case 'prefix_seq':
      basePrefix = `${customPrefix}${sep}`;
      break;
    case 'name_compact': {
      const cleanNameSlug = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join(sep);
      basePrefix = cleanNameSlug ? `${cleanNameSlug}${sep}` : `PROD${sep}`;
      break;
    }
    case 'date_random': {
      const date = new Date();
      const yr = String(date.getFullYear()).slice(-2);
      const mo = String(date.getMonth() + 1).padStart(2, '0');
      basePrefix = `SKU${sep}${yr}${mo}${sep}`;
      break;
    }
    case 'ean13': {
      // EAN-13 logic
      let seq = existingProducts.length + 1;
      let candidate = generateEAN13(seq);
      while (isSKUTaken(candidate, existingProducts, excludeProductId) && seq < 99999) {
        seq++;
        candidate = generateEAN13(seq);
      }
      return candidate;
    }
  }

  // Sequential counter scan
  // Find highest existing sequence with this prefix if possible
  let counter = 1;
  const upperPrefix = basePrefix.toUpperCase();
  
  for (const prod of existingProducts) {
    if (prod.code && prod.code.toUpperCase().startsWith(upperPrefix)) {
      const remainder = prod.code.substring(upperPrefix.length);
      const match = remainder.match(/^(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num >= counter) {
          counter = num + 1;
        }
      }
    }
  }

  let candidate = `${basePrefix}${String(counter).padStart(digits, '0')}`;
  
  // Guarantee uniqueness through loop if there's any gap or duplicate
  while (isSKUTaken(candidate, existingProducts, excludeProductId)) {
    counter++;
    candidate = `${basePrefix}${String(counter).padStart(digits, '0')}`;
  }

  return candidate;
}

/**
 * Audits all products and returns a diagnostic summary of duplicate or missing SKUs.
 */
export function auditInventorySKUs(products: Product[]): {
  total: number;
  validCount: number;
  duplicateCount: number;
  missingCount: number;
  duplicateClusters: { sku: string; products: Product[] }[];
} {
  const map: { [skuUpper: string]: Product[] } = {};
  let missingCount = 0;

  for (const p of products) {
    const code = p.code?.trim();
    if (!code) {
      missingCount++;
      continue;
    }
    const key = code.toUpperCase();
    if (!map[key]) map[key] = [];
    map[key].push(p);
  }

  const duplicateClusters = Object.entries(map)
    .filter(([_, list]) => list.length > 1)
    .map(([sku, list]) => ({ sku, products: list }));

  const duplicateCount = duplicateClusters.reduce((sum, c) => sum + c.products.length, 0);
  const validCount = products.length - duplicateCount - missingCount;

  return {
    total: products.length,
    validCount,
    duplicateCount,
    missingCount,
    duplicateClusters,
  };
}
