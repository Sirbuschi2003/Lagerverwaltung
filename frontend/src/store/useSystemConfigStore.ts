import { create } from "zustand";

import {
  CompanyConfigDto,
  UpdateCompanyConfigRequest,
  fetchPublicCompanyConfig,
  updateCompanyConfig,
} from "../utils/api";

interface SystemConfigState {
  companyName: string | null;
  companyLogo: string | null;
  companyAddressLine1: string | null;
  companyAddressLine2: string | null;
  companyPostalCode: string | null;
  companyCity: string | null;
  companyCountry: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  isLoading: boolean;
  hasLoaded: boolean;
  loadCompany: () => Promise<void>;
  saveCompany: (payload: UpdateCompanyConfigRequest) => Promise<CompanyConfigDto | null>;
}

const useSystemConfigStore = create<SystemConfigState>((set, get) => ({
  companyName: null,
  companyLogo: null,
  companyAddressLine1: null,
  companyAddressLine2: null,
  companyPostalCode: null,
  companyCity: null,
  companyCountry: null,
  companyPhone: null,
  companyEmail: null,
  isLoading: false,
  hasLoaded: false,

  loadCompany: async () => {
    if (get().hasLoaded) {
      return;
    }
    set({ isLoading: true });
    try {
      const config = await fetchPublicCompanyConfig();
      set({
        companyName: config.name ?? null,
        companyLogo: config.logoDataUrl ?? null,
        companyAddressLine1: config.addressLine1 ?? null,
        companyAddressLine2: config.addressLine2 ?? null,
        companyPostalCode: config.postalCode ?? null,
        companyCity: config.city ?? null,
        companyCountry: config.country ?? null,
        companyPhone: config.phone ?? null,
        companyEmail: config.email ?? null,
        hasLoaded: true,
      });
    } catch (error) {
      console.warn("[SystemConfigStore] Laden der Firmendaten fehlgeschlagen:", error);
      set({ companyName: null, companyLogo: null, hasLoaded: true });
    } finally {
      set({ isLoading: false });
    }
  },

  saveCompany: async (payload: UpdateCompanyConfigRequest) => {
    set({ isLoading: true });
    try {
      const config = await updateCompanyConfig(payload);
      set({
        companyName: config.name ?? null,
        companyLogo: config.logoDataUrl ?? null,
        companyAddressLine1: config.addressLine1 ?? null,
        companyAddressLine2: config.addressLine2 ?? null,
        companyPostalCode: config.postalCode ?? null,
        companyCity: config.city ?? null,
        companyCountry: config.country ?? null,
        companyPhone: config.phone ?? null,
        companyEmail: config.email ?? null,
        hasLoaded: true,
      });
      return config;
    } catch (error) {
      console.error("[SystemConfigStore] Speichern der Firmendaten fehlgeschlagen:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
}));

export default useSystemConfigStore;
