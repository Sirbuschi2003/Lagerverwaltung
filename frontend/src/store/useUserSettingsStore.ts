import { create } from "zustand";
import { fetchUserSettings, saveUserSettings } from "../utils/api";

const PRIVACY_LS_KEY = "privacyAcceptedVersion";
const SETTINGS_LS_KEY = "kfz-user-settings";

export type DashboardWidgetId = "kpi" | "quick-actions" | "restock" | "recent-movements";

export interface QuickAction {
  id: string;
  label: string;
  icon: string;   // Name des MUI-Icons als String
  route: string;  // z.B. '/scanner', '/quick-booking'
  color: string;  // 'primary' | 'secondary' | 'success' | 'warning' | 'info'
}

export interface UserSettings {
  dashboard: {
    visibleWidgets: DashboardWidgetId[];
    widgetOrder: DashboardWidgetId[];
  };
  quickActions: QuickAction[];
  privacyAcceptedVersion?: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  dashboard: {
    visibleWidgets: ["kpi", "quick-actions", "restock", "recent-movements"],
    widgetOrder: ["kpi", "quick-actions", "restock", "recent-movements"],
  },
  quickActions: [
    { id: "default-myvehicle", label: "Mein Fahrzeug", icon: "DirectionsCar", route: "/my-vehicle", color: "primary" },
  ],
};

function mergeWithDefaults(raw: Record<string, unknown>): UserSettings {
  const dashboard = (raw.dashboard as any) ?? {};
  // Migration: alte "default-booking" → "Mein Fahrzeug"
  const rawActions = Array.isArray(raw.quickActions) ? (raw.quickActions as QuickAction[]) : DEFAULT_SETTINGS.quickActions;
  const quickActions = rawActions.map((qa) =>
    qa.id === "default-booking" && qa.route === "/quick-booking"
      ? { ...qa, id: "default-myvehicle", label: "Mein Fahrzeug", icon: "DirectionsCar", route: "/my-vehicle" }
      : qa,
  );

  return {
    dashboard: {
      visibleWidgets: Array.isArray(dashboard.visibleWidgets)
        ? dashboard.visibleWidgets
        : DEFAULT_SETTINGS.dashboard.visibleWidgets,
      widgetOrder: Array.isArray(dashboard.widgetOrder)
        ? dashboard.widgetOrder
        : DEFAULT_SETTINGS.dashboard.widgetOrder,
    },
    quickActions,
    privacyAcceptedVersion: typeof raw.privacyAcceptedVersion === "string" ? raw.privacyAcceptedVersion : undefined,
  };
}

interface UserSettingsState {
  settings: UserSettings;
  loaded: boolean;
  saving: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: UserSettings) => Promise<void>;
  updateDashboardWidgets: (visibleWidgets: DashboardWidgetId[], widgetOrder: DashboardWidgetId[]) => Promise<void>;
  updateQuickActions: (quickActions: QuickAction[]) => Promise<void>;
  acceptPrivacy: (version: string) => Promise<void>;
  reset: () => void;
}

export const useUserSettingsStore = create<UserSettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  saving: false,

  loadSettings: async () => {
    try {
      const raw = await fetchUserSettings();
      const settings = mergeWithDefaults(raw);
      if (settings.privacyAcceptedVersion) {
        localStorage.setItem(PRIVACY_LS_KEY, settings.privacyAcceptedVersion);
      }
      localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(settings));
      set({ settings, loaded: true });
    } catch {
      // Offline-Fallback: vollständige Settings aus localStorage
      try {
        const raw = localStorage.getItem(SETTINGS_LS_KEY);
        if (raw) {
          const cached = mergeWithDefaults(JSON.parse(raw) as Record<string, unknown>);
          set({ settings: cached, loaded: true });
          return;
        }
      } catch {
        // ignore
      }
      const cachedVersion = localStorage.getItem(PRIVACY_LS_KEY) ?? undefined;
      set({ settings: { ...DEFAULT_SETTINGS, privacyAcceptedVersion: cachedVersion }, loaded: true });
    }
  },

  saveSettings: async (settings: UserSettings) => {
    set({ saving: true });
    try {
      await saveUserSettings(settings as unknown as Record<string, unknown>);
      localStorage.setItem(SETTINGS_LS_KEY, JSON.stringify(settings));
      set({ settings });
    } finally {
      set({ saving: false });
    }
  },

  updateDashboardWidgets: async (visibleWidgets, widgetOrder) => {
    const current = get().settings;
    const updated: UserSettings = {
      ...current,
      dashboard: { visibleWidgets, widgetOrder },
    };
    await get().saveSettings(updated);
  },

  updateQuickActions: async (quickActions) => {
    const current = get().settings;
    const updated: UserSettings = { ...current, quickActions };
    await get().saveSettings(updated);
  },

  acceptPrivacy: async (version: string) => {
    const current = get().settings;
    const updated: UserSettings = { ...current, privacyAcceptedVersion: version };
    // Sofort lokal setzen (Dialog schließt auch offline)
    set({ settings: updated });
    // Offline-Cache aktualisieren
    localStorage.setItem(PRIVACY_LS_KEY, version);
    // Best-effort Server-Sync (klappt nicht offline, aber beim nächsten loadSettings)
    try {
      set({ saving: true });
      await saveUserSettings(updated as unknown as Record<string, unknown>);
    } catch {
      // Offline – wird beim nächsten Online-Login nachgeholt
    } finally {
      set({ saving: false });
    }
  },

  reset: () => {
    set({ settings: DEFAULT_SETTINGS, loaded: false, saving: false });
  },
}));
