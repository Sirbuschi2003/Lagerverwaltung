
import { useEffect, useRef } from "react";
import { fetchFleetStock, FleetVehicleStockDto } from "../utils/api";

export function useLiveFleetStock({
  vehicleId,
  search,
  onUpdate,
  interval = 15000,
}: {
  vehicleId?: string;
  search?: string;
  onUpdate: (data: FleetVehicleStockDto[]) => void;
  interval?: number;
}) {
  // Aktuelle Werte per Ref speichern
  const vehicleIdRef = useRef(vehicleId);
  const searchRef = useRef(search);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    vehicleIdRef.current = vehicleId;
    searchRef.current = search;
    onUpdateRef.current = onUpdate;
  }, [vehicleId, search, onUpdate]);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    async function loadData() {
      try {
        const result = await fetchFleetStock({ vehicleId: vehicleIdRef.current, search: searchRef.current });
        if (active) onUpdateRef.current(result);
      } catch (error) {
        console.error("[useLiveFleetStock] Fehler beim Laden:", error);
        // Bei Fehlern nicht das UI zerstören
      }
    }
    
    // Initiales Laden nur wenn interval > 0
    if (interval > 0) {
      loadData();
      timer = window.setInterval(loadData, interval);
    }

    return () => {
      active = false;
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [interval]); // Nur bei Intervall-Änderung neu starten
}
