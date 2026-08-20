import { openDB, IDBPDatabase } from "idb";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { syncOfflineMovements } from "../utils/api";

export interface OfflineMovement {
  id?: number; // IDB autoIncrement key — set after enqueue, undefined before first persist
  itemId: string;
  code: string;
  type: "CHECKIN" | "CHECKOUT" | "ADJUSTMENT";
  quantity: number;
  timestamp: string;
  source: string;
  vehicleId?: string;
  locationId?: string;
  userId?: string;
  retryCount?: number;
}

interface OfflineQueueState {
  movements: OfflineMovement[];
  itemQueue: any[]; // Persistente Item-Queue mit in-memory retryCount-Tracking
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
const MAX_RETRIES = 5;

const getDb = async (): Promise<IDBPDatabase> => {
  return openDB(DB_NAME, 2, {
    upgrade(db, oldVersion) {
      // v1 used keyPath:"timestamp" which silently overwrote concurrent entries.
      // v2 uses autoIncrement so every entry gets a unique numeric id.
      if (oldVersion < 2) {
        if (db.objectStoreNames.contains(STORE_NAME)) {
          // Drop old store — any pending movements from v1 are lost on first upgrade.
          // This is acceptable: the timestamp-keyPath bug may have already silently lost them.
          db.deleteObjectStore(STORE_NAME);
        }
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
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
    itemQueue: [],
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

      try {
        const db = await getDb();
        // add() (not put!) generates the autoIncrement id and returns it
        const generatedId = await db.add(STORE_NAME, movement);
        const stored: OfflineMovement = { ...movement, id: generatedId as number };
        set((state) => ({ movements: [...state.movements, stored] }));
      } catch (err) {
        set({ lastError: 'Offline-Speicher nicht verfügbar: ' + String(err) });
        throw err; // Aufrufer soll den Fehler anzeigen
      }
    },
    
    syncNow: async () => {
      // Guard: verhindert parallele Syncs (Race Condition → Doppelbuchungen)
      if (get().isSyncing) return;
      set({ isSyncing: true });

      const { movements, hasServiceWorkerSync } = get();

      if (hasServiceWorkerSync && navigator.serviceWorker?.controller) {
        try {
          await new Promise<void>((resolve) => {
            const messageChannel = new MessageChannel();
            // Resolve on SW acknowledgement or after 10s timeout
            const timeout = setTimeout(resolve, 10_000);
            messageChannel.port1.onmessage = () => {
              clearTimeout(timeout);
              resolve();
            };
            navigator.serviceWorker.controller!.postMessage(
              { type: 'PROCESS_QUEUE' },
              [messageChannel.port2],
            );
          });
        } catch {
          // Fall through to manual sync
        } finally {
          set({ isSyncing: false });
        }
        return;
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
        const storageQueue = await offlineStorage.getItemQueue();
        const storeQueue = get().itemQueue;
        // In-memory retryCount aus dem Store zurück in die frisch geladene Queue mergen,
        // da retryCount nicht in den Storage geschrieben wird.
        itemQueue = storageQueue.map((item: any) => {
          const tracked = storeQueue.find((i: any) => i.id === item.id);
          return tracked?.retryCount ? { ...item, retryCount: tracked.retryCount } : item;
        });
        set({ itemQueue });
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
              const msg = err instanceof Error ? err.message : 'Sync-Fehler';
              set({ lastError: `Item-Sync fehlgeschlagen: ${msg}` });
              // Item bleibt in der Queue – nicht zu successfulSyncs hinzufügen
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
            // Nur erfolgreiche entfernen — identifiziert per timestamp, gelöscht per autoIncrement-id
            const successfulMovements = movements.filter((m) => !conflictTimestamps.has(m.timestamp));
            const tx = db.transaction(STORE_NAME, "readwrite");
            for (const m of successfulMovements) {
              if (m.id != null) await tx.objectStore(STORE_NAME).delete(m.id);
            }
            await tx.done;

            // retryCount für Konflikt-Bewegungen inkrementieren; Überschreiter verwerfen
            const conflictMovements = movements.filter((m) => conflictTimestamps.has(m.timestamp));
            const retainedAfterConflict: OfflineMovement[] = [];
            let discardedConflictCount = 0;
            for (const movement of conflictMovements) {
              const updated: OfflineMovement = { ...movement, retryCount: (movement.retryCount ?? 0) + 1 };
              if ((updated.retryCount ?? 0) >= MAX_RETRIES) {
                if (movement.id != null) await db.delete(STORE_NAME, movement.id);
                discardedConflictCount++;
              } else {
                await db.put(STORE_NAME, updated);
                retainedAfterConflict.push(updated);
              }
            }

            const discardMsg = discardedConflictCount > 0
              ? ` ${discardedConflictCount} Buchung(en) nach ${MAX_RETRIES} Fehlversuchen verworfen.`
              : '';
            set({
              movements: retainedAfterConflict,
              lastError: `${conflictTimestamps.size} Buchung(en) konnten nicht synchronisiert werden: ${conflictReasons.join("; ")}${discardMsg}`,
            });
          }
        }
        
        let offlineTargetError: string | null = null;

        if (hasOfflineTargets && vehicleId) {
          const { updateVehicleTarget } = await import('../utils/api');
          const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
          const offlineStorage = useOfflineStorage();

          const failedTargets: string[] = [];

          for (const [itemId, targetQuantity] of Object.entries(offlineTargets)) {
            try {
              await updateVehicleTarget(vehicleId, { itemId, targetQuantity });
            } catch (err) {
              failedTargets.push(itemId);
            }
          }

          if (failedTargets.length === 0) {
            // Alle erfolgreich — Queue leeren
            await offlineStorage.clearOfflineTargets(vehicleId);
          } else {
            // Fehlgeschlagene Einträge verbleiben für den nächsten Sync-Versuch
            offlineTargetError = `${failedTargets.length} Fahrzeugziel(e) konnten nicht synchronisiert werden und werden erneut versucht.`;
          }
        }

        set({ isSyncing: false, requiresReauth: false, lastError: offlineTargetError });
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

        const errorMsg = (error?.response?.data?.message as string) || error?.message || "Synchronisation fehlgeschlagen";

        // Bei nicht-auth Fehlern: retryCount aller Bewegungen inkrementieren; Überschreiter verwerfen
        try {
          const currentMovements = get().movements;
          if (currentMovements.length > 0) {
            const db = await getDb();
            const retainedMovements: OfflineMovement[] = [];
            let discardedCount = 0;
            for (const movement of currentMovements) {
              const updated: OfflineMovement = { ...movement, retryCount: (movement.retryCount ?? 0) + 1 };
              if ((updated.retryCount ?? 0) >= MAX_RETRIES) {
                if (movement.id != null) await db.delete(STORE_NAME, movement.id);
                discardedCount++;
              } else {
                await db.put(STORE_NAME, updated);
                retainedMovements.push(updated);
              }
            }
            const discardMsg = discardedCount > 0
              ? ` ${discardedCount} Buchung(en) nach ${MAX_RETRIES} Fehlversuchen verworfen.`
              : '';
            set({
              isSyncing: false,
              movements: retainedMovements,
              lastError: errorMsg + discardMsg,
            });
            return;
          }
        } catch {
          // Fehler beim DB-Zugriff im Catch-Handler ignorieren
        }

        set({
          isSyncing: false,
          lastError: errorMsg,
        });
      }
    },
    
    loadFromStorage: async () => {
      const { syncNow } = get();

      try {
        const db = await getDb();
        const all = await db.getAll(STORE_NAME);
        set({ movements: all as OfflineMovement[] });

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
      } catch (err) {
        console.error('[OfflineQueue] loadFromStorage fehlgeschlagen:', err);
        set({ movements: [], lastError: String(err) });
        initializeAutoSyncOnce(syncNow); // trotzdem starten
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
