import { create } from "zustand";
import { offlineStorage } from "./useOfflineStorage";

interface OfflineState {
  isOnline: boolean;
  hasOfflineData: boolean;
  lastSync: number | null;
  syncInProgress: boolean;
  
  // Actions
  setOnlineStatus: (online: boolean) => void;
  checkOfflineData: () => Promise<void>;
  startSync: () => void;
  completeSync: () => void;
  
  // Helpers
  shouldUseCache: (maxAge?: number) => boolean;
}

const useOfflineStore = create<OfflineState>()((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  hasOfflineData: false,
  lastSync: null,
  syncInProgress: false,
  
  setOnlineStatus: (online: boolean) => {
    set({ isOnline: online });
    
    if (online) {
      // Auto-sync wenn wieder online
      const { syncInProgress } = get();
      if (!syncInProgress) {
        setTimeout(() => {
          // Trigger sync für andere Stores
          window.dispatchEvent(new CustomEvent('app:online'));
        }, 500);
      }
    }
  },
  
  checkOfflineData: async () => {
    try {
      const items = await offlineStorage.getItems();
      const vehicles = await offlineStorage.getVehicles();
      
      const hasData = items.length > 0 || vehicles.length > 0;
      set({ hasOfflineData: hasData });
      
    } catch (err) {
      set({ hasOfflineData: false });
    }
  },
  
  startSync: () => {
    set({ syncInProgress: true });
  },
  
  completeSync: () => {
    set({ 
      syncInProgress: false, 
      lastSync: Date.now() 
    });
  },
  
  shouldUseCache: (maxAge = 5 * 60 * 1000) => {
    const { isOnline, lastSync } = get();
    
    if (!isOnline) return true;
    
    if (!lastSync) return false;
    
    return (Date.now() - lastSync) < maxAge;
  },
}));

// Online/Offline Event Listeners
if (typeof window !== 'undefined') {
  const updateOnlineStatus = () => {
    useOfflineStore.getState().setOnlineStatus(navigator.onLine);
  };
  
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Initial check
  updateOnlineStatus();
  
  // Check offline data on startup
  useOfflineStore.getState().checkOfflineData();
}

export default useOfflineStore;
