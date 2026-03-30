import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { openDB, IDBPDatabase } from 'idb';
import useAuthStore from './useAuthStore';
import { useNetworkStore } from './useNetworkStore';

export type FrontendLogLevel = 'debug' | 'info' | 'warn' | 'error';
export type FrontendLogCategory =
  | 'click'
  | 'navigation'
  | 'api-call'
  | 'api-error'
  | 'user-action'
  | 'system'
  | 'offline'
  | 'error';

export interface FrontendLogEntry {
  id: string;
  timestamp: string;
  level: FrontendLogLevel;
  category: FrontendLogCategory;
  message: string;
  details?: any;
  userId?: string;
  userName?: string;
  url?: string;
  userAgent?: string;
}

interface FrontendLogState {
  logs: FrontendLogEntry[];
  maxLogs: number;
  isEnabled: boolean;
  lastSyncTimestamp: string | null;
  addLog: (
    level: FrontendLogLevel,
    category: FrontendLogCategory,
    message: string,
    details?: any
  ) => Promise<void>;
  getLogs: (
    startDate?: Date,
    endDate?: Date,
    level?: FrontendLogLevel,
    category?: FrontendLogCategory
  ) => Promise<FrontendLogEntry[]>;
  clearLogs: () => Promise<void>;
  exportCsv: () => string;
  exportJson: () => string;
  exportLogs: (format: 'csv' | 'json') => Promise<string>;
  setEnabled: (enabled: boolean) => void;
  syncToBackend: () => Promise<void>;
}

const DB_NAME = 'frontend-logs-db';
const STORE_NAME = 'logs';

const getDb = async (): Promise<IDBPDatabase> => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
};

const useFrontendLogStore = create<FrontendLogState>()(
  devtools((set, get) => ({
    logs: [],
    maxLogs: 1000,
    isEnabled: true,
    lastSyncTimestamp: null,

    addLog: async (level, category, message, details) => {
      if (!get().isEnabled) return;

      const logEntry: FrontendLogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        level,
        category,
        message,
        details,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      };

      try {
        const db = await getDb();
        await db.add(STORE_NAME, logEntry);

        set((state) => {
          const newLogs = [...state.logs, logEntry].slice(-state.maxLogs);
          return { logs: newLogs };
        });
      } catch (error) {
        // Logging-Fehler nicht weiterwerfen
      }
    },

    getLogs: async (startDate, endDate, level, category) => {
      try {
        const db = await getDb();
        const allLogs: FrontendLogEntry[] = await db.getAll(STORE_NAME);

        return allLogs.filter((log) => {
          const logDate = new Date(log.timestamp);
          if (startDate && logDate < startDate) return false;
          if (endDate && logDate > endDate) return false;
          if (level && log.level !== level) return false;
          if (category && log.category !== category) return false;
          return true;
        });
      } catch (error) {
        return [];
      }
    },

    clearLogs: async () => {
      try {
        const db = await getDb();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        await tx.objectStore(STORE_NAME).clear();
        await tx.done;
        set({ logs: [] });
      } catch (error) {
        // Error ignored
      }
    },

    exportCsv: () => {
      const { logs } = get();
      const headers = ['Timestamp', 'Level', 'Category', 'Message', 'User', 'URL', 'Details'];
      const rows = logs.map(log => [
        log.timestamp,
        log.level,
        log.category,
        log.message,
        log.userName || log.userId || 'N/A',
        log.url || 'N/A',
        log.details ? JSON.stringify(log.details) : 'N/A'
      ]);
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      return csvContent;
    },

    exportJson: () => {
      const { logs } = get();
      return JSON.stringify(logs, null, 2);
    },

    exportLogs: async (format: 'csv' | 'json') => {
      return format === 'csv' ? get().exportCsv() : get().exportJson();
    },

    setEnabled: (enabled) => {
      set({ isEnabled: enabled });
    },

    syncToBackend: async () => {
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          return;
        }
        try {
          const { isOnline } = useNetworkStore.getState();
          if (!isOnline) {
            return;
          }
        } catch (err) {
          // Ignore network store errors
        }
        try {
          const { token } = useAuthStore.getState();
          if (!token) {
            return;
          }
        } catch (err) {
          // Ignore auth store errors
        }

        const { lastSyncTimestamp } = get();
        const db = await getDb();
        const allLogs = await db.getAll(STORE_NAME);

        const logsToSync = lastSyncTimestamp
          ? allLogs.filter(log => new Date(log.timestamp) > new Date(lastSyncTimestamp))
          : allLogs;
        
        if (logsToSync.length === 0) {
          return;
        }

        const batchSize = 100;
        for (let i = 0; i < logsToSync.length; i += batchSize) {
          const batch = logsToSync.slice(i, i + batchSize);
          const { default: api } = await import('../utils/api');
          await api.post('/logs/frontend', batch.map(log => ({
            timestamp: log.timestamp,
            level: log.level,
            category: log.category,
            message: log.message,
            url: log.url,
            details: log.details,
          })));
        }

        const now = new Date().toISOString();
        set({ lastSyncTimestamp: now });
      } catch (err) {
        // Error ignored - not critical
      }
    },
  })),
);

export default useFrontendLogStore;
