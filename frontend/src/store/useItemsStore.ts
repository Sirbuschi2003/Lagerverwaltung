import { create } from 'zustand';
import {
  CreateItemRequest,
  ItemDto,
  UpdateItemRequest,
  createItem as apiCreateItem,
  createItemsBulk as apiCreateItemsBulk,
  deleteItem as apiDeleteItem,
  fetchItems,
  updateItem as apiUpdateItem,
} from "../utils/api";

import { useNetworkStore } from "./useNetworkStore";

export type Item = ItemDto;
// Zusätzliche State-Eigenschaften
interface ItemsStoreState {
  items: Item[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  lastLoaded: number | null;
  cacheTimeout: number;
  // Actions
  loadItems: (params?: { page?: number; limit?: number; search?: string; manufacturer?: string; productGroup?: string; force?: boolean }) => Promise<void>;
  forceLoadItems: (params?: { page?: number; limit?: number; search?: string; manufacturer?: string; productGroup?: string }) => Promise<void>;
  addItem: (payload: CreateItemRequest) => Promise<Item>;
  addItemsBulk: (payload: CreateItemRequest[], options?: { skipReload?: boolean }) => Promise<any>;
  updateItem: (id: any, payload: any) => Promise<Item>;
  deleteItem: (id: any) => Promise<void>;
}
const isOfflineMode = (): boolean => {
  const browserOffline = typeof navigator !== "undefined" ? !navigator.onLine : false;
  try {
    const { isOnline, lastCheck } = useNetworkStore.getState();
    const backendOffline = Boolean(lastCheck) && !isOnline;
    return browserOffline || backendOffline;
  } catch {
    return browserOffline;
  }
};
const useItemsStore = create<ItemsStoreState>((set: any, get: any) => ({
  items: [],
  total: 0,
  page: 1,
  limit: 200000,
  isLoading: false,
  lastLoaded: null,
  cacheTimeout: 2 * 60 * 60 * 1000, // 2 Stunden Cache (war 5 min, zu kurz!)
  loadItems: async (params?: { page?: number; limit?: number; search?: string; manufacturer?: string; productGroup?: string; force?: boolean }) => {
    const { lastLoaded, cacheTimeout, page, limit, items } = get();
    const now = Date.now();
    const offlineMode = isOfflineMode();
    // Cache-Check: Nicht laden wenn Cache noch gültig (außer force oder wenn mehr Items/Filter gewünscht)
    const cacheValid = lastLoaded && (now - lastLoaded) < cacheTimeout;
    const wantsMore = params?.limit && params.limit > items.length;
    const hasFilters = params?.search || params?.manufacturer || params?.productGroup;
    if (cacheValid && !params?.force && !wantsMore && !hasFilters) {
      console.log('[ItemsStore] Cache noch gültig, überspringe Load');
      return;
    }
    set({ isLoading: true });
    // IMMER zuerst aus Cache versuchen fÃ¼r bessere Performance
    console.log('[ItemsStore] Loading items, trying cache first...');
    try {
      const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
      const storage = useOfflineStorage();
      const cachedItems = await storage.getItems();
      if (cachedItems.length > 0) {
        console.log('[ItemsStore] Cache hit: Loaded', cachedItems.length, 'items from cache');
        set({
          items: cachedItems,
          total: cachedItems.length,
          page,
          limit: params?.limit ?? limit,
          isLoading: false,
          lastLoaded: now
        });
        // Im Hintergrund von API nachladen falls online (non-blocking!)
        if (!offlineMode) {
          console.log('[ItemsStore] Starte Background-Refresh von API...');
          fetchItems({
            page,
            limit: params?.limit ?? limit,
            search: params?.search,
            manufacturer: params?.manufacturer,
            productGroup: params?.productGroup,
          })
            .then(data => {
              console.log('[ItemsStore] Background-Refresh erfolgreich');
              const state = get();
              const incomingLimit = params?.limit ?? limit;
              // Verhindere, dass kleinere Abfragen den großen Offline-Cache überschreiben
              const shouldKeepExisting = state.items.length > data.items.length && incomingLimit < state.items.length;
              if (shouldKeepExisting) {
                set({ lastLoaded: Date.now(), isLoading: false });
                return;
              }
              set({
                items: data.items,
                total: data.total,
                page: data.page,
                limit: data.limit,
                lastLoaded: Date.now()
              });
              // Cache aktualisieren
              storage.setItems(data.items).catch(err =>
                console.error('[ItemsStore] Cache-Update fehlgeschlagen:', err)
              );
            })
            .catch(err => {
              console.warn('[ItemsStore] Background-Refresh fehlgeschlagen:', err?.message);
              // Nicht kritisch, Cache bleibt gÃ¼ltig
            });
        }
        return; // Beende hier, API lÃ¤dt im Hintergrund
      }
    } catch (err) {
      console.error('[ItemsStore] Cache error:', err);
    }
    // Nur wenn Cache leer ist UND online: Von API laden
    if (offlineMode) {
      console.log('[ItemsStore] Offline and no cache - set empty items');
      set({ items: [], isLoading: false });
      return;
    }
    // Online: Versuche API zu laden (nur wenn kein Cache!)
    console.log('[ItemsStore] Kein Cache - lade von API...');
    try {
      const data = await fetchItems({
        page: params?.page || page,
        limit: params?.limit || limit,
        search: params?.search,
        manufacturer: params?.manufacturer,
        productGroup: params?.productGroup,
      });
      // Speichere in lokalem Storage fÃ¼r Offline-Nutzung
      try {
        const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
        const storage = useOfflineStorage();
        await storage.setItems(data.items);
      } catch (storageErr) {
        console.warn('[ItemsStore] Fehler beim Speichern in Cache:', storageErr);
      }
      set({
        items: data.items,
        total: data.total,
        page: data.page,
        limit: data.limit,
        isLoading: false,
        lastLoaded: now
      });
    } catch (error) {
      console.warn("[ItemsStore] API-Fehler, lade aus lokalem Cache", error);
      // Fallback: Versuche aus lokalem Storage zu laden
      try {
        const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
        const storage = useOfflineStorage();
        const cachedItems = await storage.getItems();
        if (cachedItems.length > 0) {
          console.log('[ItemsStore] Fallback: Artikel aus lokalem Cache geladen');
          set({
            items: cachedItems,
            total: cachedItems.length,
            page,
            limit,
            isLoading: false,
            lastLoaded: now
          });
        } else {
          set({ isLoading: false });
        }
      } catch (cacheError) {
        console.error('[ItemsStore] Kein Cache verfÃ¼gbar:', cacheError);
        set({ isLoading: false });
      }
    }
  },
  forceLoadItems: async (params?: { page?: number; limit?: number; search?: string; manufacturer?: string; productGroup?: string }) => {
    set({ isLoading: true });
    if (isOfflineMode()) {
      try {
        const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
        const storage = useOfflineStorage();
        const cachedItems = await storage.getItems();
        set({
          items: cachedItems,
          total: cachedItems.length,
          page: 1,
          limit: params?.limit || 200000,
          isLoading: false,
          lastLoaded: Date.now()
        });
        return;
      } catch (error) {
        console.warn("[ItemsStore] Offline: Cache konnte nicht geladen werden", error);
        set({ isLoading: false });
        return;
      }
    }
    try {
      const limit = params?.limit || 200000;
      let page = params?.page || 1;
      const search = params?.search;
      const manufacturer = params?.manufacturer;
      const productGroup = params?.productGroup;

      let allItems: Item[] = [];
      let total = 0;
      while (true) {
        const data = await fetchItems({ page, limit, search, manufacturer, productGroup });
        total = data.total;
        allItems = allItems.concat(data.items);
        if (allItems.length >= total || data.items.length < limit) {
          break;
        }
        page += 1;
      }

      set({
        items: allItems,
        total: total || allItems.length,
        page: 1,
        limit,
        isLoading: false,
        lastLoaded: Date.now()
      });
      try {
        const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
        const storage = useOfflineStorage();
        await storage.setItems(allItems);
      } catch (err) {
        console.warn('[ItemsStore] Fehler beim Speichern in Cache (forceLoad):', err);
      }
    } catch (error) {
      console.warn("Offline: Artikel werden lokal angezeigt", error);
      set({ isLoading: false });
    }
  },
  addItem: async (payload: CreateItemRequest) => {
    const queueOfflineCreation = async () => {
      console.log('[ItemsStore] Offline: Artikel wird in Queue gespeichert');
      const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
      const storage = useOfflineStorage();
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const tempItem = {
        id: tempId,
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await storage.addItemToQueue('CREATE', payload, tempId);
      set((state: any) => ({ items: [...state.items, tempItem] }));
      await storage.updateLocalItem(tempItem);
      return tempItem as any;
    };
    if (isOfflineMode()) {
      return queueOfflineCreation();
    }
    try {
      const created = await apiCreateItem(payload);
      set((state: any) => ({ items: [...state.items, created] }));
      try {
        const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
        const storage = useOfflineStorage();
        await storage.updateLocalItem(created);
      } catch (err) {
        console.warn('[ItemsStore] Cache-Update fehlgeschlagen:', err);
      }
      return created;
    } catch (error: any) {
      const isNetworkError = !error?.response || error.code === 'ERR_NETWORK';
      if (isNetworkError) {
        console.warn('[ItemsStore] Netzwerkfehler - speichere Artikel lokal', error);
        return queueOfflineCreation();
      }
      throw error;
    }
  },
  addItemsBulk: async (payload: CreateItemRequest[], options?: { skipReload?: boolean }) => {
    const result = await apiCreateItemsBulk(payload);
    if (!options?.skipReload) {
      const { loadItems } = get();
      await loadItems();
    }
    return result;
  },
  updateItem: async (id: any, payload: any) => {
    const queueOfflineUpdate = async () => {
      console.log('[ItemsStore] Offline: Artikel-Update wird in Queue gespeichert');
      const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
      const storage = useOfflineStorage();
      await storage.addItemToQueue('UPDATE', { id, ...payload }, id);
      const { items } = get();
      const existingItem = items.find((item: any) => item.id === id) || {};
      const updatedItem = {
        ...existingItem,
        ...payload,
        updatedAt: new Date().toISOString(),
      };
      set((state: any) => ({
        items: state.items.map((item: any) => (item.id === id ? updatedItem : item)),
      }));
      await storage.updateLocalItem(updatedItem);
      return updatedItem;
    };
    if (isOfflineMode()) {
      return queueOfflineUpdate();
    }
    try {
      const updated = await apiUpdateItem(id, payload);
      set((state: any) => ({
        items: state.items.map((item: any) => (item.id === id ? updated : item)),
      }));
      try {
        const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
        const storage = useOfflineStorage();
        await storage.updateLocalItem(updated);
      } catch (err) {
        console.warn('[ItemsStore] Cache-Update fehlgeschlagen:', err);
      }
      return updated;
    } catch (error: any) {
      const isNetworkError = !error?.response || error.code === 'ERR_NETWORK';
      if (isNetworkError) {
        console.warn('[ItemsStore] Netzwerkfehler - speichere Update offline', error);
        return queueOfflineUpdate();
      }
      throw error;
    }
  },
  deleteItem: async (id: any) => {
    const queueOfflineDelete = async () => {
      console.log('[ItemsStore] Offline: Artikel-Loeschung wird in Queue gespeichert');
      const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
      const storage = useOfflineStorage();
      await storage.addItemToQueue('DELETE', { id }, id);
      set((state: any) => ({ items: state.items.filter((item: any) => item.id !== id) }));
      await storage.removeLocalItem(id);
    };
    if (isOfflineMode()) {
      return queueOfflineDelete();
    }
    try {
      await apiDeleteItem(id);
      set((state: any) => ({ items: state.items.filter((item: any) => item.id !== id) }));
      try {
        const { useOfflineStorage } = await import('../hooks/useOfflineStorage');
        const storage = useOfflineStorage();
        await storage.removeLocalItem(id);
      } catch (err) {
        console.warn('[ItemsStore] Cache-Update fehlgeschlagen:', err);
      }
    } catch (error: any) {
      const isNetworkError = !error?.response || error.code === 'ERR_NETWORK';
      if (isNetworkError) {
        console.warn('[ItemsStore] Netzwerkfehler - speichere Loeschung offline', error);
        return queueOfflineDelete();
      }
      throw error;
    }
  },
}));
export default useItemsStore;


