/**
 * Netzwerk-Utilities für intelligente API-Aufrufe
 * 
 * Problem: Mobile Daten sind "online" (navigator.onLine = true), 
 * aber Backend nicht erreichbar (außerhalb Firmen-WLAN)
 * 
 * Lösung: Schnelles Timeout + Cache-Fallback
 */

interface ApiCallOptions {
  timeout?: number;
  retries?: number;
  cacheFallback?: boolean;
}

/**
 * Wrapper für API-Calls mit intelligentem Timeout und Cache-Fallback
 * 
 * @param apiCall - Die API-Funktion die aufgerufen werden soll
 * @param cacheGetter - Funktion um Cache-Daten zu laden (optional)
 * @param options - Timeout, Retries, Cache-Fallback
 * @returns Promise mit API-Daten oder Cache-Fallback
 */
export async function smartApiCall<T>(
  apiCall: () => Promise<T>,
  cacheGetter?: () => Promise<T | null>,
  options: ApiCallOptions = {}
): Promise<{ data: T | null; fromCache: boolean; error?: Error }> {
  const { timeout = 3000, retries = 0, cacheFallback = true } = options;

  // Versuche API-Call mit Timeout
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await Promise.race([
        apiCall(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('API_TIMEOUT')), timeout)
        ),
      ]);

      console.log(`[SmartApiCall] Erfolgreich (Versuch ${attempt + 1}/${retries + 1})`);
      return { data: result, fromCache: false };
    } catch (error: any) {
      console.warn(`[SmartApiCall] Versuch ${attempt + 1}/${retries + 1} fehlgeschlagen:`, error?.message);

      // Letzter Versuch fehlgeschlagen
      if (attempt === retries) {
        // Versuche Cache-Fallback
        if (cacheFallback && cacheGetter) {
          try {
            const cachedData = await cacheGetter();
            if (cachedData) {
              console.log('[SmartApiCall] Cache-Fallback erfolgreich');
              return { data: cachedData, fromCache: true };
            }
          } catch (cacheError) {
            console.warn('[SmartApiCall] Cache-Fallback fehlgeschlagen:', cacheError);
          }
        }

        // Kein Cache oder Cache-Fehler
        return { data: null, fromCache: false, error: error as Error };
      }

      // Warte vor erneutem Versuch (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
    }
  }

  // Sollte nie erreicht werden, aber TypeScript braucht es
  return { data: null, fromCache: false, error: new Error('UNKNOWN_ERROR') };
}

/**
 * Prüft ob das Backend erreichbar ist (schneller Check)
 * 
 * @param timeout - Timeout in Millisekunden
 * @returns true wenn Backend erreichbar, false sonst
 */
export async function isBackendReachable(timeout: number = 2000): Promise<boolean> {
  // Schneller Check: Browser offline?
  if (!navigator.onLine) {
    console.log('[NetworkUtils] Browser ist offline');
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch('/api/health', {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timeoutId);
    const isReachable = response.ok;
    console.log('[NetworkUtils] Backend erreichbar:', isReachable);
    return isReachable;
  } catch (error) {
    console.log('[NetworkUtils] Backend nicht erreichbar:', error);
    return false;
  }
}

/**
 * Exponentielles Backoff für Retries
 * 
 * @param attempt - Versuch-Nummer (0-basiert)
 * @param baseDelay - Basis-Verzögerung in ms
 * @returns Verzögerung in ms
 */
export function getBackoffDelay(attempt: number, baseDelay: number = 500): number {
  return Math.min(Math.pow(2, attempt) * baseDelay, 10000); // Max 10 Sekunden
}

/**
 * Cached Network Status - verhindert zu viele Backend-Checks
 */
let cachedNetworkStatus: { isOnline: boolean; timestamp: number } | null = null;
const CACHE_DURATION = 5000; // 5 Sekunden Cache

export async function getCachedNetworkStatus(): Promise<boolean> {
  const now = Date.now();

  // Cache gültig?
  if (cachedNetworkStatus && now - cachedNetworkStatus.timestamp < CACHE_DURATION) {
    console.log('[NetworkUtils] Nutze gecachten Network-Status:', cachedNetworkStatus.isOnline);
    return cachedNetworkStatus.isOnline;
  }

  // Neuer Check
  const isOnline = await isBackendReachable(2000);
  cachedNetworkStatus = { isOnline, timestamp: now };
  return isOnline;
}

/**
 * Invalidiert den Network-Status-Cache (für manuelle Refreshes)
 */
export function invalidateNetworkCache(): void {
  console.log('[NetworkUtils] Network-Cache invalidiert');
  cachedNetworkStatus = null;
}
