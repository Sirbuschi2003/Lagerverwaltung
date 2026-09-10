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

// Jede offene "Tab" bleibt dauerhaft im DOM gemountet (siehe KeepAliveOutlet),
// inklusive aller laufenden Timer/Hintergrund-Abfragen. Ohne Obergrenze
// sammeln sich ueber eine Schicht immer mehr aktive Seiten an - auf
// leistungsschwaecheren Geraeten (Handys) fuehrt das zu spuerbarem Ruckeln
// bei der Navigation. Deshalb: nur die zuletzt genutzten MAX_TABS Seiten
// bleiben aktiv, aeltere werden automatisch geschlossen (LRU).
const MAX_TABS = 6;

const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: [],

      openTab: (tab) => {
        const normalizedPath = tab.path === '/' ? '/dashboard' : tab.path;
        const { tabs } = get();
        const existingIndex = tabs.findIndex((t) => t.path === normalizedPath);

        if (existingIndex !== -1) {
          // Bereits offen: an Ende verschieben (= zuletzt genutzt), damit sie
          // beim LRU-Aufraeumen nicht faelschlich als "alt" gilt.
          if (existingIndex === tabs.length - 1) return;
          const next = [...tabs];
          const [existing] = next.splice(existingIndex, 1);
          next.push(existing);
          set({ tabs: next });
          return;
        }

        const next = [...tabs, { ...tab, path: normalizedPath }];
        // Aelteste (am wenigsten kuerzlich genutzte) Tabs entfernen, wenn das
        // Limit ueberschritten wird.
        while (next.length > MAX_TABS) {
          next.shift();
        }
        set({ tabs: next });
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
