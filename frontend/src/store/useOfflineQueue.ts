import { openDB, IDBPDatabase } from "idb";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { syncOfflineMovements } from "../utils/api";

export interface OfflineMovement {
  itemId: string;
  code: string;
  type: "CHECKIN" | "CHECKOUT" | "ADJUSTMENT";
  quantity: number;
  timestamp: string;
  source: string;
  vehicleId?: string;
  locationId?: string;
  userId?: string;
}

interface OfflineQueueState {
  movements: OfflineMovement[];
  isSyncing: boolean;
  requiresReauth: boolean;
  lastError: string | null;
  hasServiceWorkerSync: boolean;
  enqueueMovement: (movement: OfflineMovement) => Promise<void>;
  syncNow: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  checkServiceWorkerSync: () => void;
}

interface NavigatorWithConnection extends Navigator {
  connection?: {
    type?: string;
    effectiveType?: string;
    addEventListener?: (type: "change", listener: () => void) => void;
    removeEventListener?: (type: "change", listener: () => void) => void;
  };
}

const DB_NAME = "lagerverwaltung-offline";
const STORE_NAME = "movements";

const getDb = async (): Promise<IDBPDatabase> => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "timestamp" });
      }
    },
  });
};

const shouldAutoSync = () => {
  if (typeof navigator === "undefined") {
    return false;
  }
  if (!navigator.onLine) {
    return false;
  }
  const connection = (navigator as NavigatorWithConnection).connection;
  if (!connection) {
    return true;
  }
  if (connection.type) {
    return connection.type.toLowerCase() === "wifi";
  }
  if (connection.effectiveType) {
    const value = connection.effectiveType.toLowerCase();
    return value === "wifi" || value === "4g";
  }
  return true;
};

let isAutoSyncSetup = false;

const setupAutoSync = (syncFn: () => Promise<void>) => {
  if (isAutoSyncSetup || typeof window === "undefined") {
    return;
  }
  isAutoSyncSetup = true;

  const handleOnline = async () => {
    try {
      await syncFn();
    } catch (err) {
      // Error silently ignored
    }
  };

  const nav = navigator as NavigatorWithConnection;
  const handleConnectionChange = async () => {
    if (navigator.onLine && nav.connection?.effectiveType !== 'slow-2g') {
      try {
        await syncFn();
      } catch (err) {
        // Error silently ignored
      }
    }
  };

  window.addEventListener('online', handleOnline);
  
  if (nav.connection?.addEventListener) {
    nav.connection.addEventListener('change', handleConnectionChange);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    if (nav.connection?.removeEventListener) {
      nav.connection.removeEventListener('change', handleConnectionChange);
    }
  };
};

const useOfflineQueue = create<OfflineQueueState>()(
  devtools((set, get) => ({
    movements: [],
    isSyncing: false,
    requiresReauth: false,
    lastError: null,
    hasServiceWorkerSync: false,
    
    checkServiceWorkerSync: () => {
      const hasServiceWorker = 'serviceWorker' in navigator;
      const hasSyncManager = 'sync' in window.ServiceWorkerRegistration?.prototype || false;
      set({ hasServiceWorkerSync: hasServiceWorker && hasSyncManager });
    },
    
    enqueueMovement: async (movement: OfflineMovement) => {
      const { hasServiceWorkerSync } = get();
      
      if (hasServiceWorkerSync && navigator.serviceWorker?.controller) {
        return;
      }
      
      const db = await getDb();
      await db.put(STORE_NAME, movement);
      set((state) => ({ movements: [...state.movements, movement] }));
    },
    
    syncNow: async () => {
      // Guard: verhindert parallele Syncs (Race Condition → Doppelbuchungen)
      if (get().isSyncing) return;
      set({ isSyncing: true });

      const { movements, hasServiceWorkerSync } = get();

      if (hasServiceWorkerSync && navigator.serviceWorker?.controller) {
        try {
          const messageChannel = new MessageChannel();
          navigator.serviceWorker.controller.postMessage(
            { type: 'PROCESS_QUEUE' },
            [messageChannel.port2]
          );
          set({ isSyncing: false });
          return;
        } catch (error) {
          // Error silently ignored
        }
      }
      
      const hasMovements = movements.length > 0;
      let hasOfflineTargets = false;
      let offlineTargets: Record<string, number> = {};
      let vehicleId: string | null = null;
      let hasItemQueue = false;
      let itemQueue: any[] = [];
      
      try {
        const useAuthStoreModule = await import('./useAuthStore');
        const useAuthStore = useAuthStoreModule.default;
        const user = useAuthStore.getState().user;
        vehicleId = user?.vehicleId || null;
        
        if (vehicleId) {
          const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
          const offlineStorage = useOfflineStorage();
          offlineTargets = await offlineStorage.getOfflineTargets(vehicleId);
          hasOfflineTargets = Object.keys(offlineTargets).length > 0;
        }
      } catch (err) {
        // Error ignored
      }

      try {
        const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
        const offlineStorage = useOfflineStorage();
        itemQueue = await offlineStorage.getItemQueue();
        hasItemQueue = itemQueue.length > 0;
      } catch (err) {
        // Error ignored
      }
      
      if (!hasMovements && !hasOfflineTargets && !hasItemQueue) {
        set({ isSyncing: false });
        return;
      }

      set({ requiresReauth: false, lastError: null });
      
      const itemIdMapping: Record<string, string> = {};
      
      try {
        if (hasItemQueue) {
          const { createItem, updateItem, deleteItem } = await import('../utils/api');
          const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
          const offlineStorage = useOfflineStorage();
          
          const useItemsStoreModule = await import('./useItemsStore');
          const useItemsStore = useItemsStoreModule.default;
          
          const successfulSyncs: string[] = [];
          
          for (const queueItem of itemQueue) {
            try {
              if (queueItem.operation === 'CREATE') {
                const created = await createItem(queueItem.itemData);
                itemIdMapping[queueItem.id] = created.id;
                
                useItemsStore.setState((state: any) => ({
                  items: state.items.map((item: any) => 
                    item.id === queueItem.id ? created : item
                  )
                }));
                
                successfulSyncs.push(queueItem.id);
              } else if (queueItem.operation === 'UPDATE') {
                const { id, ...payload } = queueItem.itemData;
                await updateItem(id, payload);
                successfulSyncs.push(queueItem.id);
              } else if (queueItem.operation === 'DELETE') {
                await deleteItem(queueItem.itemData.id);
                successfulSyncs.push(queueItem.id);
              }
            } catch (err) {
              // Error on single item ignored
            }
          }
          
          for (const id of successfulSyncs) {
            await offlineStorage.removeItemFromQueue(id);
          }
          
          await useItemsStore.getState().forceLoadItems();
        }

        if (hasMovements) {
          const mappedMovements = movements.map((movement) => {
            const mappedItemId = itemIdMapping[movement.itemId] || movement.itemId;
            return {
              itemId: mappedItemId,
              itemCode: movement.code,
              vehicleId: movement.vehicleId,
              locationId: movement.locationId,
              userId: movement.userId,
              type: movement.type,
              quantity: movement.quantity,
              occurredAt: movement.timestamp,
              source: movement.source,
            };
          });

          const syncResponse = await syncOfflineMovements({ movements: mappedMovements }) as
            | { results: Array<{ status: "ok" | "conflict"; occurredAt: string; reason?: string }> }
            | undefined;

          // Nur erfolgreich gebuchte Bewegungen aus der Queue entfernen
          const conflictTimestamps = new Set<string>();
          const conflictReasons: string[] = [];
          if (syncResponse?.results) {
            for (const r of syncResponse.results) {
              if (r.status === "conflict") {
                conflictTimestamps.add(r.occurredAt);
                conflictReasons.push(r.reason ?? "Unbekannter Fehler");
              }
            }
          }

          const db = await getDb();
          if (conflictTimestamps.size === 0) {
            // Alle erfolgreich — Queue leeren
            const tx = db.transaction(STORE_NAME, "readwrite");
            await tx.objectStore(STORE_NAME).clear();
            await tx.done;
            set({ movements: [] });
          } else {
            // Nur erfolgreiche entfernen, Konflikte behalten
            const successfulTimestamps = movements
              .map((m) => m.timestamp)
              .filter((ts) => !conflictTimestamps.has(ts));
            const tx = db.transaction(STORE_NAME, "readwrite");
            for (const ts of successfulTimestamps) {
              await tx.objectStore(STORE_NAME).delete(ts);
            }
            await tx.done;
            const remainingMovements = movements.filter((m) => conflictTimestamps.has(m.timestamp));
            set({
              movements: remainingMovements,
              lastError: `${conflictTimestamps.size} Buchung(en) konnten nicht synchronisiert werden: ${conflictReasons.join("; ")}`,
            });
          }
        }
        
        if (hasOfflineTargets && vehicleId) {
          const { updateVehicleTarget } = await import('../utils/api');
          const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
          const offlineStorage = useOfflineStorage();
          
          for (const [itemId, targetQuantity] of Object.entries(offlineTargets)) {
            try {
              await updateVehicleTarget(vehicleId, { itemId, targetQuantity });
            } catch (err) {
              // Error ignored
            }
          }
          
          await offlineStorage.clearOfflineTargets(vehicleId);
        }

        set({ isSyncing: false, requiresReauth: false, lastError: null });
      } catch (error: any) {
        const status = error?.response?.status;
        if (status === 401) {
          set({
            isSyncing: false,
            requiresReauth: true,
            lastError: "Anmeldung abgelaufen (401). Bitte neu anmelden, die Offline-Bewegungen bleiben gespeichert.",
          });
          return;
        }
        set({
          isSyncing: false,
          lastError: (error?.response?.data?.message as string) || error?.message || "Synchronisation fehlgeschlagen",
        });
      }
    },
    
    loadFromStorage: async () => {
      const db = await getDb();
      const all = await db.getAll(STORE_NAME);
      set({ movements: all as OfflineMovement[] });
      
      const { syncNow } = get();
      initializeAutoSyncOnce(syncNow);
      
      // Fallback-Sync beim App-Start: nur wenn online UND noch Bewegungen vorhanden.
      // Verzögerung > Online-Event-Handler, damit kein Doppel-Sync entsteht.
      // Der isSyncing-Guard verhindert parallele Ausführung zusätzlich.
      if (all.length > 0 && navigator.onLine) {
        setTimeout(async () => {
          try {
            await syncNow();
          } catch (err) {
            // Error ignored
          }
        }, 5000);
      }
    },
  })),
);

let autoSyncInitialised = false;

const initializeAutoSyncOnce = (syncFn: () => Promise<void>) => {
  if (autoSyncInitialised || typeof window === "undefined") {
    return;
  }
  autoSyncInitialised = true;
  setupAutoSync(syncFn);
};

export default useOfflineQueue;
