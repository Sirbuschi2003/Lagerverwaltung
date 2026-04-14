import { offlineStorage } from "../store/useOfflineStorage";

const STORAGE_PREFIX = "lv-offline-";
const MIGRATION_FLAG = `${STORAGE_PREFIX}migrated-idb-v1`;

const getStorageKey = (key: string) => `${STORAGE_PREFIX}${key}`;

const hasLocalStorage = () => typeof window !== "undefined" && typeof localStorage !== "undefined";

const setLocalStorage = (key: string, value: any) => {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(getStorageKey(key), JSON.stringify(value));
  } catch (err) {
    console.warn(`[OfflineStorage] localStorage write error for ${key}:`, err);
  }
};

const getLocalStorage = (key: string): any => {
  if (!hasLocalStorage()) return null;
  try {
    const stored = localStorage.getItem(getStorageKey(key));
    return stored ? JSON.parse(stored) : null;
  } catch (err) {
    console.warn(`[OfflineStorage] localStorage read error for ${key}:`, err);
    return null;
  }
};

const requestPersistentStorage = async (): Promise<void> => {
  if (typeof navigator === "undefined" || !("storage" in navigator)) return;
  try {
    const storage = navigator.storage as StorageManager;
    if (storage.persisted) {
      const already = await storage.persisted();
      if (already) return;
    }
    if (storage.persist) {
      const granted = await storage.persist();
      console.info(`[OfflineStorage] Persistent storage ${granted ? "granted" : "denied"}`);
    }
  } catch (err) {
    console.warn("[OfflineStorage] Failed to request persistent storage:", err);
  }
};

let initPromise: Promise<void> | null = null;

const ensureInit = async (): Promise<void> => {
  if (!initPromise) {
    initPromise = (async () => {
      await requestPersistentStorage();
      await migrateFromLocalStorage();
    })();
  }
  return initPromise;
};

const readLegacyValue = (key: string) => {
  if (!hasLocalStorage()) return null;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (err) {
    console.warn(`[OfflineStorage] Legacy read error for ${key}:`, err);
    return null;
  }
};

const extractLegacyData = (raw: any) => {
  if (raw && typeof raw === "object" && "data" in raw) {
    return raw.data;
  }
  return raw;
};

const migrateFromLocalStorage = async (): Promise<void> => {
  if (!hasLocalStorage()) return;
  if (localStorage.getItem(MIGRATION_FLAG) === "1") return;

  const keys = Object.keys(localStorage);
  const keysToRemove: string[] = [];
  let hadData = false;
  let hadErrors = false;

  for (const key of keys) {
    if (!key.startsWith(STORAGE_PREFIX)) continue;
    if (key === `${STORAGE_PREFIX}credentials`) continue;
    if (key === `${STORAGE_PREFIX}token`) continue;
    if (key.startsWith(`${STORAGE_PREFIX}vehicleId`)) continue;
    if (key === MIGRATION_FLAG) continue;

    const suffix = key.slice(STORAGE_PREFIX.length);
    const raw = readLegacyValue(key);

    if (suffix === "items") {
      const data = extractLegacyData(raw);
      if (Array.isArray(data) && data.length > 0) {
        hadData = true;
        try {
          await offlineStorage.setItems(data);
          keysToRemove.push(key);
        } catch (err) {
          hadErrors = true;
          console.warn("[OfflineStorage] Failed to migrate items cache:", err);
        }
      }
      continue;
    }

    if (suffix.startsWith("stock-")) {
      const data = extractLegacyData(raw);
      const vehicleId = raw?.vehicleId || suffix.replace("stock-", "");
      if (vehicleId && Array.isArray(data) && data.length > 0) {
        hadData = true;
        try {
          await offlineStorage.setVehicleStock(vehicleId, data);
          keysToRemove.push(key);
        } catch (err) {
          hadErrors = true;
          console.warn("[OfflineStorage] Failed to migrate stock cache:", err);
        }
      }
      continue;
    }

    if (suffix.startsWith("vehicle-")) {
      const vehicleId = raw?.vehicleId || suffix.replace("vehicle-", "");
      const data = raw?.data ?? raw;
      if (vehicleId && data) {
        hadData = true;
        try {
          await offlineStorage.setVehicleData(vehicleId, data);
          keysToRemove.push(key);
        } catch (err) {
          hadErrors = true;
          console.warn("[OfflineStorage] Failed to migrate vehicle cache:", err);
        }
      }
      continue;
    }

    if (suffix === "queue") {
      const data = extractLegacyData(raw);
      if (Array.isArray(data) && data.length > 0) {
        hadData = true;
        try {
          await offlineStorage.setCache("queue", data);
          keysToRemove.push(key);
        } catch (err) {
          hadErrors = true;
          console.warn("[OfflineStorage] Failed to migrate queue cache:", err);
        }
      }
      continue;
    }

    if (suffix === "item-queue") {
      const data = extractLegacyData(raw);
      if (Array.isArray(data) && data.length > 0) {
        hadData = true;
        try {
          await offlineStorage.setCache("item-queue", data);
          keysToRemove.push(key);
        } catch (err) {
          hadErrors = true;
          console.warn("[OfflineStorage] Failed to migrate item queue:", err);
        }
      }
      continue;
    }

    if (suffix.startsWith("targets-")) {
      const vehicleId = suffix.replace("targets-", "");
      const data = raw?.targets ?? raw?.data ?? raw;
      if (vehicleId && data && Object.keys(data).length > 0) {
        hadData = true;
        try {
          await offlineStorage.setCache(`targets-${vehicleId}`, data);
          keysToRemove.push(key);
        } catch (err) {
          hadErrors = true;
          console.warn("[OfflineStorage] Failed to migrate targets cache:", err);
        }
      }
    }
  }

  if (!hadData) {
    localStorage.setItem(MIGRATION_FLAG, "1");
    return;
  }

  if (hadErrors) {
    console.warn("[OfflineStorage] Migration incomplete. Keeping legacy cache for safety.");
    return;
  }

  for (const key of keysToRemove) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`[OfflineStorage] Failed to remove legacy key ${key}:`, err);
    }
  }

  localStorage.setItem(MIGRATION_FLAG, "1");
};

const isProtectedLegacyKey = (key: string) => {
  if (key === `${STORAGE_PREFIX}credentials`) return true;
  if (key === `${STORAGE_PREFIX}token`) return true;
  if (key.startsWith(`${STORAGE_PREFIX}vehicleId`)) return true;
  if (key === MIGRATION_FLAG) return true;
  return false;
};

export const useOfflineStorage = () => {
  return {
    setItems: async (items: any[]) => {
      await ensureInit();
      try {
        await offlineStorage.setItems(items);
        console.log(`[OfflineStorage] Items gespeichert: ${items.length} Artikel`);
        return;
      } catch (err) {
        console.warn("[OfflineStorage] Failed to store items in IndexedDB, falling back:", err);
      }
      setLocalStorage("items", { data: items, timestamp: Date.now() });
    },

    getItems: async (): Promise<any[]> => {
      await ensureInit();
      try {
        const items = await offlineStorage.getItems();
        if (items.length > 0) {
          console.log(`[OfflineStorage] Items aus Cache geladen: ${items.length} Artikel`);
          return items;
        }
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Laden der Items:", err);
      }

      const cached = getLocalStorage("items");
      if (cached?.data?.length) {
        try {
          await offlineStorage.setItems(cached.data);
        } catch (err) {
          console.warn("[OfflineStorage] Failed to backfill items cache:", err);
        }
        return cached.data;
      }

      console.log("[OfflineStorage] Keine gecachten Items gefunden");
      return [];
    },

    setVehicleStock: async (vehicleId: string, stock: any[]) => {
      await ensureInit();
      try {
        await offlineStorage.setVehicleStock(vehicleId, stock);
        console.log(`[OfflineStorage] Fahrzeugbestand gespeichert: ${stock.length} Artikel für ${vehicleId}`);
        return;
      } catch (err) {
        console.warn("[OfflineStorage] Failed to store stock in IndexedDB, falling back:", err);
      }
      setLocalStorage(`stock-${vehicleId}`, { vehicleId, data: stock, timestamp: Date.now() });
    },

    getVehicleStock: async (vehicleId: string): Promise<any[]> => {
      await ensureInit();
      try {
        const cached = await offlineStorage.getVehicleStock(vehicleId);
        if (cached && cached.length > 0) {
          console.log(`[OfflineStorage] Fahrzeugbestand aus Cache geladen: ${cached.length} Artikel`);
          return cached;
        }
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Laden des Fahrzeugbestands:", err);
      }

      const legacy = getLocalStorage(`stock-${vehicleId}`);
      if (legacy?.data?.length) {
        try {
          await offlineStorage.setVehicleStock(vehicleId, legacy.data);
        } catch (err) {
          console.warn("[OfflineStorage] Failed to backfill stock cache:", err);
        }
        return legacy.data;
      }

      console.log(`[OfflineStorage] Keine gecachten Fahrzeugbestände für ${vehicleId}`);
      return [];
    },

    setVehicleData: async (vehicleId: string, vehicleData: any) => {
      await ensureInit();
      try {
        await offlineStorage.setVehicleData(vehicleId, vehicleData);
        console.log(`[OfflineStorage] Fahrzeugdaten gespeichert für ${vehicleId}`);
        return;
      } catch (err) {
        console.warn("[OfflineStorage] Failed to store vehicle data in IndexedDB, falling back:", err);
      }
      setLocalStorage(`vehicle-${vehicleId}`, { vehicleId, data: vehicleData, timestamp: Date.now() });
    },

    getVehicleData: async (vehicleId: string): Promise<any> => {
      await ensureInit();
      try {
        const cached = await offlineStorage.getVehicleData(vehicleId);
        if (cached) {
          console.log("[OfflineStorage] Fahrzeugdaten aus Cache geladen");
          return cached;
        }
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Laden der Fahrzeugdaten:", err);
      }

      const legacy = getLocalStorage(`vehicle-${vehicleId}`);
      if (legacy?.data) {
        try {
          await offlineStorage.setVehicleData(vehicleId, legacy.data);
        } catch (err) {
          console.warn("[OfflineStorage] Failed to backfill vehicle data cache:", err);
        }
        return legacy.data;
      }

      console.log(`[OfflineStorage] Keine gecachten Fahrzeugdaten für ${vehicleId}`);
      return null;
    },

    addToQueue: async (action: string, data: any) => {
      await ensureInit();
      try {
        const cached = await offlineStorage.getCache<any[]>("queue");
        const queue = Array.isArray(cached) ? cached : [];
        const id = Date.now();
        queue.push({ id, action, data, timestamp: Date.now() });
        await offlineStorage.setCache("queue", queue);
        console.log(`[OfflineStorage] Zur Queue hinzugefuegt: ${action}`);
        return id;
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Hinzufügen zur Queue:", err);
      }

      const cached = getLocalStorage("queue");
      const queue = (cached && cached.data) || [];
      const id = Date.now();
      queue.push({ id, action, data, timestamp: Date.now() });
      setLocalStorage("queue", { data: queue, timestamp: Date.now() });
      return id;
    },

    getQueue: async () => {
      await ensureInit();
      try {
        const cached = await offlineStorage.getCache<any[]>("queue");
        if (Array.isArray(cached)) {
          return cached;
        }
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Laden der Queue:", err);
      }

      const legacy = getLocalStorage("queue");
      return (legacy && legacy.data) || [];
    },

    removeFromQueue: async (id: number) => {
      await ensureInit();
      try {
        const cached = await offlineStorage.getCache<any[]>("queue");
        const queue = Array.isArray(cached) ? cached : [];
        const filtered = queue.filter((item: any) => item.id !== id);
        await offlineStorage.setCache("queue", filtered);
        return;
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Entfernen aus der Queue:", err);
      }

      const legacy = getLocalStorage("queue");
      const queue = (legacy && legacy.data) || [];
      const filtered = queue.filter((item: any) => item.id !== id);
      setLocalStorage("queue", { data: filtered, timestamp: Date.now() });
    },

    clearCache: async () => {
      await ensureInit();
      try {
        await offlineStorage.clearAll();
      } catch (err) {
        console.warn("[OfflineStorage] Failed to clear IndexedDB cache:", err);
      }

      if (!hasLocalStorage()) return;
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(STORAGE_PREFIX) && !isProtectedLegacyKey(key)) {
          try {
            localStorage.removeItem(key);
          } catch (err) {
            console.warn(`[OfflineStorage] Failed to remove key ${key}:`, err);
          }
        }
      }
      console.log("[OfflineStorage] Cache geleert");
    },

    setOfflineTargets: async (vehicleId: string, targets: Record<string, number>) => {
      await ensureInit();
      try {
        await offlineStorage.setCache(`targets-${vehicleId}`, targets);
        console.log("[OfflineStorage] Sollwerte gespeichert:", targets);
        return;
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Speichern der Offline-Sollwerte:", err);
      }

      setLocalStorage(`targets-${vehicleId}`, { targets, timestamp: Date.now() });
    },

    getOfflineTargets: async (vehicleId: string): Promise<Record<string, number>> => {
      await ensureInit();
      try {
        const cached = await offlineStorage.getCache<Record<string, number>>(`targets-${vehicleId}`);
        if (cached) {
          console.log("[OfflineStorage] Sollwerte geladen:", cached);
          return cached;
        }
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Laden der Offline-Sollwerte:", err);
      }

      const legacy = getLocalStorage(`targets-${vehicleId}`);
      if (legacy && legacy.targets) {
        return legacy.targets;
      }
      return {};
    },

    clearOfflineTargets: async (vehicleId: string) => {
      await ensureInit();
      try {
        await offlineStorage.deleteCache(`targets-${vehicleId}`);
        console.log("[OfflineStorage] Sollwerte gelöscht für Fahrzeug:", vehicleId);
        return;
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Löschen der Offline-Sollwerte:", err);
      }

      if (hasLocalStorage()) {
        localStorage.removeItem(getStorageKey(`targets-${vehicleId}`));
      }
    },

    addItemToQueue: async (operation: "CREATE" | "UPDATE" | "DELETE", itemData: any, tempId?: string) => {
      await ensureInit();
      const id = tempId || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      try {
        const cached = await offlineStorage.getCache<any[]>("item-queue");
        const queue = Array.isArray(cached) ? cached : [];
        queue.push({
          id,
          operation,
          itemData,
          timestamp: Date.now(),
          status: "pending",
        });
        await offlineStorage.setCache("item-queue", queue);
        console.log(`[OfflineStorage] Artikel-Operation in Queue: ${operation}`, itemData);
        return id;
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Hinzufügen zur Artikel-Queue:", err);
      }

      const legacy = getLocalStorage("item-queue");
      const queue = (legacy && legacy.data) || [];
      queue.push({
        id,
        operation,
        itemData,
        timestamp: Date.now(),
        status: "pending",
      });
      setLocalStorage("item-queue", { data: queue, timestamp: Date.now() });
      return id;
    },

    getItemQueue: async (): Promise<any[]> => {
      await ensureInit();
      try {
        const cached = await offlineStorage.getCache<any[]>("item-queue");
        if (Array.isArray(cached)) {
          return cached;
        }
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Laden der Artikel-Queue:", err);
      }

      const legacy = getLocalStorage("item-queue");
      return (legacy && legacy.data) || [];
    },

    removeItemFromQueue: async (id: string) => {
      await ensureInit();
      try {
        const cached = await offlineStorage.getCache<any[]>("item-queue");
        const queue = Array.isArray(cached) ? cached : [];
        const filtered = queue.filter((item: any) => item.id !== id);
        await offlineStorage.setCache("item-queue", filtered);
        console.log("[OfflineStorage] Artikel aus Queue entfernt:", id);
        return;
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Entfernen aus der Artikel-Queue:", err);
      }

      const legacy = getLocalStorage("item-queue");
      const queue = (legacy && legacy.data) || [];
      const filtered = queue.filter((item: any) => item.id !== id);
      setLocalStorage("item-queue", { data: filtered, timestamp: Date.now() });
    },

    clearItemQueue: async () => {
      await ensureInit();
      try {
        await offlineStorage.deleteCache("item-queue");
        console.log("[OfflineStorage] Artikel-Queue geleert");
        return;
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Leeren der Artikel-Queue:", err);
      }

      if (hasLocalStorage()) {
        localStorage.removeItem(getStorageKey("item-queue"));
      }
    },

    updateLocalItem: async (item: any) => {
      await ensureInit();
      try {
        await offlineStorage.updateItem(item);
        console.log("[OfflineStorage] Lokaler Artikel aktualisiert:", item.id);
        return;
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Aktualisieren des lokalen Artikels:", err);
      }

      const cached = getLocalStorage("items");
      const items = (cached && cached.data) || [];
      const index = items.findIndex((i: any) => i.id === item.id);
      if (index !== -1) {
        items[index] = item;
      } else {
        items.push(item);
      }
      setLocalStorage("items", { data: items, timestamp: Date.now() });
    },

    removeLocalItem: async (itemId: string) => {
      await ensureInit();
      try {
        await offlineStorage.removeItem(itemId);
        console.log("[OfflineStorage] Lokaler Artikel entfernt:", itemId);
        return;
      } catch (err) {
        console.warn("[OfflineStorage] Fehler beim Entfernen des lokalen Artikels:", err);
      }

      const cached = getLocalStorage("items");
      const items = (cached && cached.data) || [];
      const filtered = items.filter((i: any) => i.id !== itemId);
      setLocalStorage("items", { data: filtered, timestamp: Date.now() });
    },
  };
};

