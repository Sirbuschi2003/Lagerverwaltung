import { create } from "zustand";
import {
  RestockRequestDto,
  RestockRequestStatus,
  UpdateRestockStatusRequest,
  fetchRestockOverview,
  fetchVehicleShortages,
  updateRestockStatus as apiUpdateRestockStatus,
} from "../utils/api";

interface RestockState {
  myRequests: RestockRequestDto[];
  fleetRequests: RestockRequestDto[];
  isLoadingMy: boolean;
  isLoadingFleet: boolean;
  loadForVehicle: (vehicleId: string) => Promise<void>;
  loadFleet: (status?: RestockRequestStatus | "OPEN") => Promise<void>;
  updateStatus: (id: string, payload: UpdateRestockStatusRequest) => Promise<RestockRequestDto>;
}

const useRestockStore = create<RestockState>((set) => ({
  myRequests: [],
  fleetRequests: [],
  isLoadingMy: false,
  isLoadingFleet: false,
  loadForVehicle: async (vehicleId) => {
    // Online-Status prÃ¼fen
    const isOnline = navigator.onLine;
    if (!isOnline) {
      console.log('[RestockStore] Offline - Ã¼berspringe loadForVehicle');
      set({ myRequests: [], isLoadingMy: false });
      return;
    }
    
    set({ isLoadingMy: true });
    try {
      const data = await fetchVehicleShortages(vehicleId);
      console.log("Shortages fÃ¼r Fahrzeug", vehicleId, data);
      set({ myRequests: data, isLoadingMy: false });
    } catch (error) {
      console.warn("Konnte Fahrzeug-Bedarfe nicht laden", error);
      set({ isLoadingMy: false });
    }
  },
  loadFleet: async (status) => {
    set({ isLoadingFleet: true });
    try {
      const data = await fetchRestockOverview(status ? { status } : undefined);
      console.log("[Lager-View] RestockOverview geladen:", data);
      set({ fleetRequests: data, isLoadingFleet: false });
    } catch (error) {
      console.warn("Konnte Restock-Übersicht nicht laden", error);
      set({ isLoadingFleet: false });
    }
  },
  updateStatus: async (id, payload) => {
    const updated = await apiUpdateRestockStatus(id, payload);
    const applyUpdate = (list: RestockRequestDto[]) => {
      const index = list.findIndex((request) => request.id === id);
      if (index === -1) {
        return payload.status === "FULFILLED" ? list : [...list, updated];
      }
      if (updated.status === "FULFILLED") {
        const next = [...list];
        next.splice(index, 1);
        return next;
      }
      const next = [...list];
      next[index] = updated;
      return next;
    };
    set((state) => ({
      myRequests: applyUpdate(state.myRequests),
      fleetRequests: applyUpdate(state.fleetRequests),
    }));

    // Keine sofortige Neusynchronisation um Race Conditions zu vermeiden
    // Die Daten werden durch den regulÃ¤ren Refresh-Zyklus aktualisiert
    return updated;
  },
}));

export default useRestockStore;





