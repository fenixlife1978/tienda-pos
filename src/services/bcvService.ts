import { BcvHistoryEntry } from '../types';

export const BCV_PRIMARY_URL = 'https://bcv.today/api/rate.json';
export const BCV_FALLBACK_URL = 'https://bcv.today/api/v1/rate.json';
export const BCV_HISTORY_URL = 'https://bcv.today/api/v1/history.json';

export interface BcvTodayRateResponse {
  USD: number;
  EUR?: number;
  CNY?: number;
  TRY?: number;
  RUB?: number;
  updated_at?: string;
  effective_date?: string;
  date?: string;
  source?: string;
}

export interface BcvFetchResult {
  rate: number;
  effectiveDate: string;
  updatedAt: string;
  sourceUrl: string;
  currencies?: {
    EUR?: number;
    CNY?: number;
    TRY?: number;
    RUB?: number;
  };
  raw: BcvTodayRateResponse;
}

/**
 * Consulta la tasa oficial desde la fuente solicitada: https://bcv.today/api/rate.json
 * Si la URL no responde o retorna 404, prueba automáticamente https://bcv.today/api/v1/rate.json
 */
export async function fetchBcvRateFromApi(): Promise<BcvFetchResult> {
  const timeoutMs = 8000;

  const tryUrl = async (url: string): Promise<BcvTodayRateResponse | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (data && typeof data.USD === 'number' && data.USD > 0) {
        return data as BcvTodayRateResponse;
      }
      return null;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  };

  // 1. Intentar primero con la URL exacta solicitada: https://bcv.today/api/rate.json
  let rawData = await tryUrl(BCV_PRIMARY_URL);
  let resolvedUrl = BCV_PRIMARY_URL;

  // 2. Si no responde o devuelve 404, probar con la URL canónica v1: https://bcv.today/api/v1/rate.json
  if (!rawData) {
    rawData = await tryUrl(BCV_FALLBACK_URL);
    resolvedUrl = BCV_FALLBACK_URL;
  }

  if (!rawData || !rawData.USD) {
    throw new Error(
      `No se pudo obtener la tasa desde ${BCV_PRIMARY_URL} ni desde ${BCV_FALLBACK_URL}. Verifique su conexión a internet.`
    );
  }

  const rate = Number(rawData.USD);
  const effectiveDate = rawData.effective_date || rawData.date || new Date().toISOString().split('T')[0];
  const updatedAt = rawData.updated_at || new Date().toISOString();

  return {
    rate,
    effectiveDate,
    updatedAt,
    sourceUrl: resolvedUrl,
    currencies: {
      EUR: rawData.EUR ? Number(rawData.EUR) : undefined,
      CNY: rawData.CNY ? Number(rawData.CNY) : undefined,
      TRY: rawData.TRY ? Number(rawData.TRY) : undefined,
      RUB: rawData.RUB ? Number(rawData.RUB) : undefined,
    },
    raw: rawData,
  };
}

/**
 * Descarga el histórico oficial de tasas desde bcv.today (/api/v1/history.json)
 * y lo mapea al formato de historial del sistema (BcvHistoryEntry[])
 */
export async function fetchBcvOfficialHistory(daysLimit: number = 60): Promise<BcvHistoryEntry[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(BCV_HISTORY_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Error ${response.status} al consultar ${BCV_HISTORY_URL}`);
    }

    const data: any[] = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    // Tomar los últimos N días disponibles y ordenarlos del más reciente al más antiguo
    const recent = data.slice(-daysLimit);

    const historyEntries: BcvHistoryEntry[] = [];
    for (let i = recent.length - 1; i >= 0; i--) {
      const item = recent[i];
      const prevItem = i > 0 ? recent[i - 1] : null;

      const rate = Number(item.USD);
      const prevRate = prevItem ? Number(prevItem.USD) : undefined;
      const changePercent =
        prevRate && prevRate > 0
          ? Number((((rate - prevRate) / prevRate) * 100).toFixed(2))
          : 0;

      historyEntries.push({
        id: `bcv-today-${item.date || item.effective_date || i}`,
        rate: Number(rate.toFixed(4)),
        date: item.updated_at || `${item.date || item.effective_date}T12:00:00.000Z`,
        effectiveDate: item.effective_date || item.date,
        type: 'automatic',
        updatedBy: 'BCV Oficial (bcv.today)',
        source: 'https://bcv.today/api/rate.json',
        previousRate: prevRate ? Number(prevRate.toFixed(4)) : undefined,
        changePercent,
        currencies: {
          EUR: item.EUR ? Number(Number(item.EUR).toFixed(4)) : undefined,
          CNY: item.CNY ? Number(Number(item.CNY).toFixed(4)) : undefined,
          TRY: item.TRY ? Number(Number(item.TRY).toFixed(4)) : undefined,
          RUB: item.RUB ? Number(Number(item.RUB).toFixed(4)) : undefined,
        },
      });
    }

    return historyEntries;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Error fetching bcv.today history:', err);
    return [];
  }
}
