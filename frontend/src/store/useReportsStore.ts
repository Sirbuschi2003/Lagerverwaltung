import { formatISO, subDays } from "date-fns";
import { create } from "zustand";
import api from "../utils/api";

type ConsumptionEntry = {
  id: string;
  item: {
    code: string;
    description: string;
  };
  quantity: number;
  type: string;
  occurredAt: string;
};

interface ReportsState {
  from: string;
  to: string;
  consumption: ConsumptionEntry[];
  setRange: (range: { from: string; to: string }) => void;
  loadConsumption: () => Promise<void>;
}

const initialTo = formatISO(new Date(), { representation: "date" });
const initialFrom = formatISO(subDays(new Date(), 30), { representation: "date" });

const useReportsStore = create<ReportsState>((set, get) => ({
  from: initialFrom,
  to: initialTo,
  consumption: [],
  setRange: ({ from, to }) => set({ from, to }),
  loadConsumption: async () => {
    try {
      const { from, to } = get();
      const response = await api.get<ConsumptionEntry[]>("/reports/consumption", {
        params: { from, to },
      });
      set({ consumption: response.data });
    } catch (error) {
      console.warn("Offline: Verbrauchsdaten nicht verf?gbar", error);
    }
  },
}));

export default useReportsStore;


