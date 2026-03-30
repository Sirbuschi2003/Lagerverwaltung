import { useState, useCallback } from "react";
import { fetchVehicleStock, type StockLevelDto } from "../utils/api";
import { offlineStorage } from "../store/useOfflineStorage";

interface UseVehicleStockOptions {
  vehicleId: string;
}

interface UseVehicleStockReturn {
  stock: StockLevelDto[];
  isLoading: boolean;
  error: string | null;
  loadStock: () => Promise<void>;
  refreshStock: () => Promise<void>;
}

export const useVehicleStock = ({ vehicleId }: UseVehicleStockOptions): UseVehicleStockReturn => {
  const [stock, setStock] = useState<StockLevelDto[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStock = useCallback(async () => {
    if (!vehicleId) return;
    
    setLoading(true);
    setError(null);
    
    // Offline: Lade aus Cache
    if (!navigator.onLine) {
      try {
        console.log('[useVehicleStock] Offline: Lade Bestände aus Cache');
        const cachedStock = await offlineStorage.getVehicleStock(vehicleId);
        if (cachedStock) {
          setStock(cachedStock);
          setLoading(false);
          return;
        } else {
          console.log('[useVehicleStock] Kein Cache für Fahrzeug verfügbar');
          setError("Offline: Keine Bestandsdaten verfügbar. Verbinde dich mit dem Internet für aktuelle Daten.");
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('[useVehicleStock] Cache-Fehler:', err);
        setError("Fehler beim Laden der Offline-Daten.");
        setLoading(false);
        return;
      }
    }

    // Online: API-Aufruf
    try {
      console.log('[useVehicleStock] Online: Lade Bestände von API');
      const levels = await fetchVehicleStock(vehicleId);
      
      // Speichere in Cache für Offline-Nutzung
      await offlineStorage.setVehicleStock(vehicleId, levels);
      
      setStock(levels);
      setError(null);
    } catch (err) {
      console.error('[useVehicleStock] API-Fehler:', err);
      
      // Fallback: Versuche Cache
      try {
        const cachedStock = await offlineStorage.getVehicleStock(vehicleId);
        if (cachedStock) {
          console.log('[useVehicleStock] Fallback: Verwende Cache-Daten');
          setStock(cachedStock);
          setError("Netzwerkfehler: Zeige letzte bekannte Bestände an.");
        } else {
          setError("Bestandsdaten konnten nicht geladen werden.");
        }
      } catch (cacheError) {
        console.error('[useVehicleStock] Cache-Fallback fehlgeschlagen:', cacheError);
        setError("Bestandsdaten konnten nicht geladen werden.");
      }
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  const refreshStock = useCallback(async () => {
    // Force reload - immer von API laden wenn online
    if (!vehicleId) return;
    
    setLoading(true);
    setError(null);
    
    if (!navigator.onLine) {
      setError("Offline: Aktualisierung nicht möglich.");
      setLoading(false);
      return;
    }

    try {
      const levels = await fetchVehicleStock(vehicleId);
      await offlineStorage.setVehicleStock(vehicleId, levels);
      setStock(levels);
      setError(null);
    } catch (err) {
      console.error('[useVehicleStock] Refresh-Fehler:', err);
      setError("Aktualisierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  return {
    stock,
    isLoading,
    error,
    loadStock,
    refreshStock,
  };
};