import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "lagerverwaltung-cache";
const DB_VERSION = 1;

interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt?: number;
}

class OfflineStorage {
  private db: IDBPDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Cache Store für allgemeine Daten
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
        
        // Items Store für Artikeldaten
        if (!db.objectStoreNames.contains('items')) {
          db.createObjectStore('items', { keyPath: 'id' });
        }
        
        // Stock Store für Bestandsdaten
        if (!db.objectStoreNames.contains('stock')) {
          db.createObjectStore('stock', { keyPath: 'key' });
        }
        
        // Vehicles Store für Fahrzeugdaten
        if (!db.objectStoreNames.contains('vehicles')) {
          db.createObjectStore('vehicles', { keyPath: 'id' });
        }
      },
    });
  }

  async setCache<T>(key: string, data: T, ttlMs?: number): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    };

    await this.db.put('cache', entry);
  }

  async getCache<T>(key: string): Promise<T | null> {
    await this.init();
    if (!this.db) return null;

    const entry: CacheEntry<T> | undefined = await this.db.get('cache', key);
    if (!entry) return null;

    // Prüfe Ablaufzeit
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      await this.db.delete('cache', key);
      return null;
    }

    return entry.data;
  }

  async setItems(items: any[]): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('items', 'readwrite');
    await tx.objectStore('items').clear();
    
    for (const item of items) {
      await tx.objectStore('items').put(item);
    }
    
    await tx.done;
    
    // Cache-Eintrag für Items setzen
    await this.setCache('items_timestamp', Date.now());
  }

  async getItems(): Promise<any[]> {
    await this.init();
    if (!this.db) return [];

    return await this.db.getAll('items');
  }

  async setVehicleStock(vehicleId: string, stock: any[]): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const key = `stock-${vehicleId}`;
    await this.db.put('stock', { key, data: stock, timestamp: Date.now() });
  }

  async getVehicleStock(vehicleId: string): Promise<any[] | null> {
    await this.init();
    if (!this.db) return null;

    const key = `stock-${vehicleId}`;
    const entry = await this.db.get('stock', key);
    if (entry?.data) {
      return entry.data;
    }

    // Legacy fallback (older cache format in "cache" store).
    const legacy = await this.getCache<any[]>(`stock_${vehicleId}`);
    if (legacy) {
      await this.db.put('stock', { key, data: legacy, timestamp: Date.now() });
      return legacy;
    }

    return null;
  }

  async setVehicles(vehicles: any[]): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('vehicles', 'readwrite');
    await tx.objectStore('vehicles').clear();
    
    for (const vehicle of vehicles) {
      await tx.objectStore('vehicles').put(vehicle);
    }
    
    await tx.done;
    await this.setCache('vehicles_timestamp', Date.now());
  }

  async getVehicles(): Promise<any[]> {
    await this.init();
    if (!this.db) return [];

    return await this.db.getAll('vehicles');
  }

  async updateItem(item: any): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    await this.db.put('items', item);
  }

  async removeItem(itemId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    await this.db.delete('items', itemId);
  }

  async setVehicleData(vehicleId: string, vehicleData: any): Promise<void> {
    await this.setCache(`vehicle-${vehicleId}`, vehicleData);
  }

  async getVehicleData(vehicleId: string): Promise<any | null> {
    return await this.getCache(`vehicle-${vehicleId}`);
  }

  async deleteCache(key: string): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.delete('cache', key);
  }

  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) return;
    await this.db.clear('cache');
    await this.db.clear('items');
    await this.db.clear('stock');
    await this.db.clear('vehicles');
  }

  async isOnline(): Promise<boolean> {
    return navigator.onLine;
  }

  async shouldUseCache(cacheKey: string, maxAgeMs: number = 5 * 60 * 1000): Promise<boolean> {
    if (!navigator.onLine) return true;
    
    const timestamp = await this.getCache<number>(`${cacheKey}_timestamp`);
    if (!timestamp) return false;
    
    return (Date.now() - timestamp) < maxAgeMs;
  }

  // Cleanup alte Einträge
  async cleanup(): Promise<void> {
    await this.init();
    if (!this.db) return;

    const tx = this.db.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    const entries = await store.getAll();
    
    const now = Date.now();
    for (const entry of entries) {
      if (entry.expiresAt && now > entry.expiresAt) {
        await store.delete(entry.key);
      }
    }
    
    await tx.done;
  }
}

export const offlineStorage = new OfflineStorage();

// Cleanup alle 30 Minuten
setInterval(() => {
  offlineStorage.cleanup().catch(() => { /* Cleanup-Fehler ignorieren */ });
}, 30 * 60 * 1000);
