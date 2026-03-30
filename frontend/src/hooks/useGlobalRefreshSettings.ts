import { useState, useEffect } from 'react';
import useAuthStore from '../store/useAuthStore';

export interface RefreshSettings {
  interval: number;
  enabled: boolean;
  lastUpdated: Date;
}

const STORAGE_KEY = 'kfz-refresh-settings';
const DEFAULT_INTERVAL = 15000; // 15 Sekunden

/**
 * Globaler Hook für Refresh-Einstellungen
 * Synchronisiert zwischen LocalStorage und Backend
 */
export function useGlobalRefreshSettings() {
  const { user, updateUserRefreshInterval } = useAuthStore();
  
  const [settings, setSettings] = useState<RefreshSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          interval: parsed.interval || DEFAULT_INTERVAL,
          enabled: parsed.enabled !== false,
          lastUpdated: new Date(parsed.lastUpdated || Date.now())
        };
      }
    } catch (error) {
      console.warn('[RefreshSettings] Failed to load from localStorage:', error);
    }
    
    return {
      interval: user?.refreshInterval || DEFAULT_INTERVAL,
      enabled: true,
      lastUpdated: new Date()
    };
  });

  // Sync mit Backend wenn User verfügbar
  useEffect(() => {
    if (user?.refreshInterval && user.refreshInterval !== settings.interval) {
      setSettings(prev => ({
        ...prev,
        interval: user.refreshInterval!,
        lastUpdated: new Date()
      }));
    }
  }, [user?.refreshInterval]);

  // LocalStorage aktualisieren bei Änderungen
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('[RefreshSettings] Failed to save to localStorage:', error);
    }
  }, [settings]);

  const updateInterval = async (newInterval: number) => {
    const newSettings = {
      ...settings,
      interval: newInterval,
      lastUpdated: new Date()
    };
    
    setSettings(newSettings);
    
    // Backend Update (optional, falls verfügbar)
    if (user?.id && updateUserRefreshInterval) {
      try {
        await updateUserRefreshInterval(user.id, newInterval);
      } catch (error) {
        console.warn('[RefreshSettings] Backend update failed:', error);
        // Lokale Einstellung bleibt trotzdem
      }
    }
  };

  const toggleEnabled = () => {
    setSettings(prev => ({
      ...prev,
      enabled: !prev.enabled,
      lastUpdated: new Date()
    }));
  };

  const getIntervalLabel = (interval: number): string => {
    if (interval === 0) return 'Deaktiviert';
    if (interval < 1000) return `${interval}ms`;
    return `${interval / 1000}s`;
  };

  return {
    settings,
    updateInterval,
    toggleEnabled,
    getIntervalLabel,
    isValid: settings.interval >= 0 && settings.interval <= 300000 // Max 5 Minuten
  };
}