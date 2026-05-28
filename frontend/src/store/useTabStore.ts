import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AppTab {
  path: string;
  label: string;
}

interface TabStore {
  tabs: AppTab[];
  openTab: (tab: AppTab) => void;
  closeTab: (path: string) => void;
  clearTabs: () => void;
}

const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: [],

      openTab: (tab) => {
        const normalizedPath = tab.path === '/' ? '/dashboard' : tab.path;
        const { tabs } = get();
        if (!tabs.find((t) => t.path === normalizedPath)) {
          set({ tabs: [...tabs, { ...tab, path: normalizedPath }] });
        }
      },

      closeTab: (path) => {
        set((state) => ({ tabs: state.tabs.filter((t) => t.path !== path) }));
      },

      clearTabs: () => set({ tabs: [] }),
    }),
    {
      name: 'app-tabs',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

export default useTabStore;
