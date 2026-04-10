import { create } from "zustand";

export type NotificationType = "RESTOCK_APPROVED" | "STOCK_LOW" | "ORDER_RECEIVED" | "INFO";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string; // ISO
  read: boolean;
  link?: string;
}

interface NotificationStore {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "read" | "timestamp">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const STORAGE_KEY = "app-notifications";
const MAX_NOTIFICATIONS = 50;

function loadFromStorage(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as AppNotification[];
  } catch {
    // ignore
  }
  return [];
}

function saveToStorage(notifications: AppNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    // ignore
  }
}

const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: loadFromStorage(),
  unreadCount: loadFromStorage().filter((n) => !n.read).length,

  addNotification: (n) => {
    const next: AppNotification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      read: false,
      timestamp: new Date().toISOString(),
    };
    const updated = [next, ...get().notifications].slice(0, MAX_NOTIFICATIONS);
    saveToStorage(updated);
    set({ notifications: updated, unreadCount: updated.filter((x) => !x.read).length });
  },

  markRead: (id) => {
    const updated = get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    saveToStorage(updated);
    set({ notifications: updated, unreadCount: updated.filter((x) => !x.read).length });
  },

  markAllRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }));
    saveToStorage(updated);
    set({ notifications: updated, unreadCount: 0 });
  },

  clearAll: () => {
    saveToStorage([]);
    set({ notifications: [], unreadCount: 0 });
  },
}));

export default useNotificationStore;
