import { useEffect, useRef, useCallback, useState } from 'react';
import { useGlobalRefreshSettings } from './useGlobalRefreshSettings';
import { useNetworkStatus } from './useNetworkStatus';

interface UseLiveDataOptions<T> {
  fetcher: () => Promise<T>;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
  immediate?: boolean;
}

interface UseLiveDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: any;
  refresh: () => Promise<void>;
  lastUpdated: Date | null;
}

/**
 * Universal Hook für Live-Daten mit globalen Refresh-Einstellungen
 */
export function useLiveData<T>({
  fetcher,
  enabled = true,
  onSuccess,
  onError,
  immediate = true,
}: UseLiveDataOptions<T>): UseLiveDataReturn<T> {
  const { settings } = useGlobalRefreshSettings();
  const { isOnline } = useNetworkStatus();
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const intervalRef = useRef<number | null>(null);
  const fetcherRef = useRef(fetcher);
  
  // Fetcher-Referenz aktuell halten
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);
  
  const refresh = useCallback(async () => {
    if (!enabled || loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetcherRef.current();
      setData(result);
      setLastUpdated(new Date());
      onSuccess?.(result);
    } catch (err) {
      console.error('[useLiveData] Fetch error:', err);
      setError(err);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }, [enabled, loading, onSuccess, onError]);
  
  // Initial load
  useEffect(() => {
    if (immediate && enabled) {
      refresh();
    }
  }, [immediate, enabled]); // refresh nicht als Dependency um Loops zu vermeiden
  
  // Timer Management
  useEffect(() => {
    // Clear existing timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Setup new timer if enabled
    if (
      enabled && 
      settings.enabled && 
      settings.interval > 0 && 
      isOnline
    ) {
      intervalRef.current = setInterval(() => {
        refresh();
      }, settings.interval) as unknown as number;
      
      console.log(`[useLiveData] Timer started with ${settings.interval}ms interval`);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, settings.enabled, settings.interval, isOnline]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  return {
    data,
    loading,
    error,
    refresh,
    lastUpdated,
  };
}