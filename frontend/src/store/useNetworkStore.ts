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

export async function checkBackendReachability(): Promise<boolean> {
  // Wenn bereits ein Check läuft, warte auf das Ergebnis
  if (isCheckingGlobal && lastCheckPromise) {
    return lastCheckPromise;
  }

  // Schnell-Check: Browser offline?
  if (!navigator.onLine) {
    useNetworkStore.getState().setOnline(false);
    useNetworkStore.getState().setLastCheck(new Date());
    return false;
  }

  isCheckingGlobal = true;
  useNetworkStore.getState().setChecking(true);
  useNetworkStore.getState().incrementCheckCount();

  lastCheckPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200); // 1.2s timeout

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
      
      return isOnline;
    } catch (error) {
      useNetworkStore.getState().setOnline(false);
      useNetworkStore.getState().setLastCheck(new Date());
      useNetworkStore.getState().setChecking(false);
      
      isCheckingGlobal = false;
      lastCheckPromise = null;
      
      return false;
    }
  })();

  return lastCheckPromise;
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
  });

  // Periodische Prüfung alle 2 Minuten (nur Fallback)
  setInterval(() => {
    checkBackendReachability();
  }, 120000);
}
