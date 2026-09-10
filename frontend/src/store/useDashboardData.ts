import { create } from "zustand";
import api from "../utils/api";
import { isEffectivelyOffline } from "./useNetworkStore";

interface DashboardSummary {
  totalItems: number;
  openInventorySessions: number;
}

interface DashboardState {
  summary: DashboardSummary;
  loadSummary: () => Promise<void>;
}

const CACHE_KEY = "lv-dashboard-summary";

const defaultSummary: DashboardSummary = {
  totalItems: 0,
  openInventorySessions: 0,
};

const loadCached = (): DashboardSummary => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as DashboardSummary;
  } catch {
    // ignore
  }
  return defaultSummary;
};

const useDashboardData = create<DashboardState>(() => ({
  summary: loadCached(),
  loadSummary: async () => {
    if (isEffectivelyOffline()) {
      return;
    }
    try {
      const response = await api.get<DashboardSummary>("/stock/dashboard");
      localStorage.setItem(CACHE_KEY, JSON.stringify(response.data));
      useDashboardData.setState({ summary: response.data });
    } catch (error) {
    }
  },
}));

export default useDashboardData;
