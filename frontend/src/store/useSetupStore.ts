import { create } from "zustand";
import { checkSetupStatus, completeInitialSetup } from "../utils/api";

interface SetupState {
  needsSetup: boolean | null;
  isLoading: boolean;
  checkStatus: () => Promise<void>;
  completeSetup: (params: { username: string; displayName: string; password: string }) => Promise<void>;
}

const useSetupStore = create<SetupState>((set) => ({
  needsSetup: null,
  isLoading: false,
  checkStatus: async () => {
    set({ isLoading: true });
    try {
      const status = await checkSetupStatus();
      set({ needsSetup: status.needsSetup, isLoading: false });
    } catch (error) {
      console.error("Setup status check failed", error);
      set({ needsSetup: false, isLoading: false });
    }
  },
  completeSetup: async ({ username, displayName, password }) => {
    await completeInitialSetup({ username, displayName, password });
    set({ needsSetup: false });
  },
}));

export default useSetupStore;

