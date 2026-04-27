import { create } from "zustand";
import { fetchUserSettings, saveUserSettings } from "../utils/api";

const PRIVACY_LS_KEY = "privacyAcceptedVersion";
const SETTINGS_LS_KEY = "lv-user-settings";

export type DashboardWidgetId = "kpi" | "quick-actions" | "restock" | "recent-movements";

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  route: string;
  color: string;
}

export interface QuickActions {
  desktop: QuickAction[];
  mobile: QuickAction[];
}

export interface UserSettings {
  dashboard: {
    visibleWidgets: DashboardWidgetId[];
    widgetOrder: DashboardWidgetId[];
  };
  quickActions: QuickActions;
  privacyAcceptedVersion?: string;
  quickBookingWorkflow: boolean;
  themeMode: string;
  themePreset: string;
}

const DEFAULT_QUICK_ACTION: QuickAction = {
  id: "default-myvehicle",
  label: "Mein Fahrzeug",
  icon: "DirectionsCar",
  route: "/my-vehicle",
  color: "primary",
};

const DEFAULT_SETTINGS: UserSettings = {
  dashboard: {
    visibleWidgets: ["kpi", "quick-actions", "restock", "recent-movements"],
    widgetOrder: ["kpi", "quick-actions", "restock", "recent-movements"],
  },
  quickActions: {
    desktop: [DEFAULT_QUICK_ACTION],
    mobile: [DEFAULT_QUICK_ACTION],
  },
  quickBookingWorkflow: true,
  themeMode: "",
  themePreset: "",
};

function migrateAction(qa: QuickAction): QuickAction {
  if (qa.id === "default-booking" && qa.route === "/quick-booking") {
    return { ...qa, id: "default-myvehicle", label: "Mein Fahrzeug", icon: "DirectionsCar", route: "/my-vehicle" };
  }
  return qa;
}

function parseActionList(raw: unknown, fallback: QuickAction[]): QuickAction[] {
  if (!Array.isArray(raw)) return fallback;
  return (raw as QuickAction[]).map(migrateAction);
}

function mergeWithDefaults(raw: Record<string, unknown>): UserSettings {
  const dashboard = (raw.dashboard as any) ?? {};

  // Migration: quickActions kann altes Array-Format oder neues {desktop, mobile}-Format sein
  let quickActions: QuickActions;
  const rawQA = raw.quickActions;
  if (Array.isArray(rawQA)) {
    // Altes Format: Array → wird zu Desktop, Mobile erhält gleiche Liste
    const migrated = (rawQA as QuickAction[]).map(migrateAction);
    quickActions = { desktop: migrated, mobile: migrated };
  } else if (rawQA && typeof rawQA === "object") {
    const qa = rawQA as Record<string, unknown>;
    quickActions = {
      desktop: parseActionList(qa.desktop, DEFAULT_SETTINGS.quickActions.desktop),
      mobile: parseActionList(qa.mobile, DEFAULT_SETTINGS.quickActions.mobile),
    };
  } else {
    quickActions = DEFAULT_SETTINGS.quickActions;
  }

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
    quickBookingWorkflow: typeof raw.quickBookingWorkflow === "boolean" ? raw.quickBookingWorkflow : DEFAULT_SETTINGS.quickBookingWorkflow,
    themeMode: typeof raw.themeMode === "string" ? raw.themeMode : "",
    themePreset: typeof raw.themePreset === "string" ? raw.themePreset : "",
  };
}

interface UserSettingsState {
  settings: UserSettings;
  loaded: boolean;
  saving: boolean;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: UserSettings) => Promise<void>;
  updateDashboardWidgets: (visibleWidgets: DashboardWidgetId[], widgetOrder: DashboardWidgetId[]) => Promise<void>;
  updateQuickActions: (quickActions: QuickActions) => Promise<void>;
  updateQuickBookingWorkflow: (value: boolean) => Promise<void>;
  updateTheme: (mode: string, preset: string) => Promise<void>;
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
    await get().saveSettings({ ...get().settings, dashboard: { visibleWidgets, widgetOrder } });
  },

  updateQuickActions: async (quickActions: QuickActions) => {
    await get().saveSettings({ ...get().settings, quickActions });
  },

  updateQuickBookingWorkflow: async (value: boolean) => {
    await get().saveSettings({ ...get().settings, quickBookingWorkflow: value });
  },

  updateTheme: async (mode: string, preset: string) => {
    await get().saveSettings({ ...get().settings, themeMode: mode, themePreset: preset });
  },

  acceptPrivacy: async (version: string) => {
    const current = get().settings;
    const updated: UserSettings = { ...current, privacyAcceptedVersion: version };
    set({ settings: updated });
    localStorage.setItem(PRIVACY_LS_KEY, version);
    try {
      set({ saving: true });
      await saveUserSettings(updated as unknown as Record<string, unknown>);
    } catch {
      // Offline – wird beim nächsten Login nachgeholt
    } finally {
      set({ saving: false });
    }
  },

  reset: () => {
    set({ settings: DEFAULT_SETTINGS, loaded: false, saving: false });
  },
}));
