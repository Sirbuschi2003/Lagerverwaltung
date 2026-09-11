/**
 * GLOBALER Network-Status Store (Singleton)
 * 
 * Problem: Jeder useNetworkStatus() Hook erstellt eigene Checks
 * Lösung: Ein zentraler Store für ALLE Komponenten
 */

import { create } from 'zustand';

interface NetworkStore {
  isOnline: boolean;
  isChecking: boolean;
  lastCheck: Date | null;
  checkCount: number;
  setOnline: (online: boolean) => void;
  setChecking: (checking: boolean) => void;
  setLastCheck: (date: Date) => void;
  incrementCheckCount: () => void;
}

// SINGLETON - nur EINE Instanz für gesamte App
export const useNetworkStore = create<NetworkStore>((set) => ({
  isOnline: false, // Optimistisch offline - wird beim ersten Check gesetzt
  isChecking: false,
  lastCheck: null,
  checkCount: 0,
  
  setOnline: (online: boolean) => set({ isOnline: online }),
  setChecking: (checking: boolean) => set({ isChecking: checking }),
  setLastCheck: (date: Date) => set({ lastCheck: date }),
  incrementCheckCount: () => set((state) => ({ checkCount: state.checkCount + 1 })),
}));

// Globaler Backend-Check (wird NUR EINMAL zur gleichen Zeit ausgeführt)
let isCheckingGlobal = false;
let lastCheckPromise: Promise<boolean> | null = null;

// Selbstheilendes Check-Intervall: bei bestaetigtem Online-Status selten
// pruefen (2 Min.), bei (moeglicherweise faelschlich) erkanntem Offline-
// Status schnell erneut pruefen (10s) - eine einzelne falsche Messung soll
// sich innerhalb von Sekunden statt Minuten selbst korrigieren.
const RECHECK_INTERVAL_MS = 120_000;
const FAST_RETRY_INTERVAL_MS = 10_000;
// Eine "offline"-Messung, die aelter als das ist (z.B. weil der Tab im
// Hintergrund war und Timer gedrosselt wurden), wird in
// isEffectivelyOffline() nicht mehr vertraut.
const STALE_OFFLINE_READING_MS = 30_000;

let scheduledCheckTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleNextCheck(delayMs: number): void {
  if (scheduledCheckTimer) {
    clearTimeout(scheduledCheckTimer);
  }
  scheduledCheckTimer = setTimeout(() => {
    checkBackendReachability();
  }, delayMs);
}

export async function checkBackendReachability(): Promise<boolean> {
  // Wenn bereits ein Check läuft, warte auf das Ergebnis
  if (isCheckingGlobal && lastCheckPromise) {
    return lastCheckPromise;
  }

  // Schnell-Check: Browser offline?
  if (!navigator.onLine) {
    useNetworkStore.getState().setOnline(false);
    useNetworkStore.getState().setLastCheck(new Date());
    scheduleNextCheck(FAST_RETRY_INTERVAL_MS);
    return false;
  }

  isCheckingGlobal = true;
  useNetworkStore.getState().setChecking(true);
  useNetworkStore.getState().incrementCheckCount();

  lastCheckPromise = (async () => {
    try {
      const controller = new AbortController();
      // 3s statt vorher 1.2s: Bei gleichzeitig laufenden schweren Anfragen
      // (z.B. Artikelliste mit bis zu 200.000 Eintraegen) kann der schmale
      // Health-Check durch Ressourcen-Konkurrenz laenger brauchen, obwohl der
      // Server erreichbar ist. Ein zu kurzes Timeout fuehrte zu falschen
      // "offline"-Meldungen, die dann GLOBAL (fuer die ganze App) bis zu 2
      // Minuten haengen blieben.
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch('/api/health', {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      clearTimeout(timeoutId);
      const isOnline = response.ok;

      useNetworkStore.getState().setOnline(isOnline);
      useNetworkStore.getState().setLastCheck(new Date());
      useNetworkStore.getState().setChecking(false);

      isCheckingGlobal = false;
      lastCheckPromise = null;

      if (isOnline) {
        scheduleNextCheck(RECHECK_INTERVAL_MS);
      } else {
        // Schnell selbst korrigieren statt bis zu 2 Minuten falsch "offline"
        // zu bleiben, falls es nur ein einmaliger Ausreisser war.
        scheduleNextCheck(FAST_RETRY_INTERVAL_MS);
      }

      return isOnline;
    } catch (error) {
      useNetworkStore.getState().setOnline(false);
      useNetworkStore.getState().setLastCheck(new Date());
      useNetworkStore.getState().setChecking(false);

      isCheckingGlobal = false;
      lastCheckPromise = null;

      scheduleNextCheck(FAST_RETRY_INTERVAL_MS);

      return false;
    }
  })();

  return lastCheckPromise;
}

/**
 * Zuverlaessige Offline-Erkennung fuer Techniker im Aussendienst.
 *
 * navigator.onLine allein reicht NICHT: es zeigt nur, ob das Geraet
 * ueberhaupt eine Netzwerkschnittstelle hat (WLAN/Mobilfunk) - nicht, ob
 * der (von aussen grundsaetzlich nicht erreichbare) Server tatsaechlich
 * antwortet. Ein Techniker mit Mobilfunkdaten gilt fuer den Browser als
 * "online", obwohl der Server nie erreichbar sein wird. Ohne diesen
 * zusaetzlichen Check versuchen Seiten trotzdem Live-Daten zu laden und
 * warten den vollen Netzwerk-Timeout (mehrere Sekunden) ab, bevor sie
 * aufgeben - das fuehlt sich wie Haengenbleiben/Ruckeln an.
 *
 * Kombiniert beide Signale: navigator.onLine (schneller Sofort-Check) UND
 * das Ergebnis des echten /api/health-Erreichbarkeits-Checks (backendOnline).
 * Der Backend-Check zaehlt nur, wenn er schon mindestens einmal gelaufen
 * ist (lastCheck gesetzt) - sonst waere direkt nach dem App-Start faelschlich
 * "offline" der Default. Eine veraltete "offline"-Messung (aelter als
 * STALE_OFFLINE_READING_MS, z.B. weil der Tab im Hintergrund war und Timer
 * gedrosselt wurden) wird NICHT mehr vertraut - im Zweifel lieber online
 * annehmen und die echte Anfrage selbst entscheiden lassen, als eine
 * einzelne falsche Messung dauerhaft die ganze App offline schalten zu
 * lassen (siehe Vorfall: Artikelliste mit 200k Eintraegen liess den
 * Health-Check kurzzeitig ins Timeout laufen -> globaler Fehlalarm).
 */
export function isEffectivelyOffline(): boolean {
  const browserOffline = typeof navigator !== "undefined" ? !navigator.onLine : false;
  if (browserOffline) return true;

  const { isOnline, lastCheck } = useNetworkStore.getState();

  // Noch KEIN abgeschlossener Backend-Reachability-Check (z.B. direkt nach
  // App-Start/Reload, bevor checkBackendReachability() zum ersten Mal
  // durchgelaufen ist). navigator.onLine ist hier NICHT genug - Techniker
  // haben fast immer Mobilfunk/WLAN, obwohl der private Server nie
  // erreichbar sein wird. Bisher wurde dieser Zustand faelschlich als
  // "online" behandelt, wodurch beim App-Start/Reload ALLE gleichzeitig
  // gemounteten Seiten (Dashboard, Artikel, Mein Fahrzeug via
  // KeepAliveOutlet) gleichzeitig live Anfragen feuerten, die dann JEDE
  // EINZELN auf ihren eigenen Timeout warten mussten - das erzeugte genau
  // das "haengt beim Start/Tab-Wechsel"-Symptom. Bis das echte
  // Check-Ergebnis vorliegt (max. 3s, siehe checkBackendReachability),
  // lieber vom Server-Default ausgehen: offline.
  if (!lastCheck) return true;

  if (isOnline) return false;

  // isOnline===false: nur eine kuerzlich negative Messung vertrauen, eine
  // veraltete (>STALE_OFFLINE_READING_MS, z.B. Tab war im Hintergrund und
  // Timer wurden gedrosselt) nicht mehr - im Zweifel dann doch online
  // annehmen und die eigentliche Anfrage selbst entscheiden lassen.
  const ageMs = Date.now() - lastCheck.getTime();
  return ageMs <= STALE_OFFLINE_READING_MS;
}

// Initiale Prüfung beim App-Start (nur EINMAL)
let initialCheckDone = false;

export function initializeNetworkStatus() {
  if (initialCheckDone) {
    return;
  }
  
  initialCheckDone = true;
  // Non-blocking initial check mit Timeout
  const quickTimeout = setTimeout(() => {
    if (useNetworkStore.getState().isChecking) {
      useNetworkStore.getState().setOnline(navigator.onLine);
      useNetworkStore.getState().setChecking(false);
    }
  }, 500); // 500ms max wait

  checkBackendReachability().finally(() => {
    clearTimeout(quickTimeout);
  });

  // Browser Events (für echtes Offline/Online)
  window.addEventListener('online', () => {
    checkBackendReachability();
  });

  window.addEventListener('offline', () => {
    useNetworkStore.getState().setOnline(false);
    useNetworkStore.getState().setLastCheck(new Date());
    // Schnell selbst korrigieren statt starr 2 Minuten zu warten, falls die
    // Verbindung inzwischen schon wieder da ist.
    scheduleNextCheck(FAST_RETRY_INTERVAL_MS);
  });

  // Weitere Pruefungen laufen selbstheilend ueber scheduleNextCheck() nach
  // jedem Check (siehe checkBackendReachability): schnell (10s) solange
  // offline/unsicher, selten (2 Min.) sobald bestaetigt online.
}
