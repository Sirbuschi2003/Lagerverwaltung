import { create } from "zustand";
import {
  CreateVehicleRequest,
  UpdateVehicleRequest,
  VehicleDto,
  createVehicle as apiCreateVehicle,
  deleteVehicle as apiDeleteVehicle,
  fetchVehicles,
  updateVehicle as apiUpdateVehicle,
} from "../utils/api";

export type Vehicle = VehicleDto;

interface VehiclesState {
  vehicles: Vehicle[];
  isLoading: boolean;
  loadVehicles: () => Promise<void>;
  addVehicle: (payload: CreateVehicleRequest) => Promise<Vehicle>;
  updateVehicle: (id: string, payload: UpdateVehicleRequest) => Promise<Vehicle>;
  deleteVehicle: (id: string) => Promise<void>;
}

const useVehiclesStore = create<VehiclesState>((set, get) => ({
  vehicles: [],
  isLoading: false,
  loadVehicles: async () => {
    set({ isLoading: true });
    try {
      const data = await fetchVehicles();
      set({ vehicles: data, isLoading: false });
    } catch (error) {
      console.warn("Offline: Fahrzeuge werden lokal angezeigt", error);
      set({ isLoading: false });
    }
  },
  addVehicle: async (payload: CreateVehicleRequest) => {
    const created = await apiCreateVehicle(payload);
    set((state) => ({ vehicles: [...state.vehicles, created] }));
    return created;
  },
  updateVehicle: async (id, payload) => {
    const updated = await apiUpdateVehicle(id, payload);
    set((state) => ({
      vehicles: state.vehicles.map((vehicle) =>
        vehicle.id === id ? updated : vehicle,
      ),
    }));
    return updated;
  },
  deleteVehicle: async (id) => {
    await apiDeleteVehicle(id);
    set((state) => ({
      vehicles: state.vehicles.filter((vehicle) => vehicle.id !== id),
    }));
  },
}));

export default useVehiclesStore;
