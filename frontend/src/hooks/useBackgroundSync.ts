import { useState, useEffect, useCallback } from 'react';
import { useNetworkStatus } from './useNetworkStatus';

interface QueueItem {
  id: string;
  url: string;
  method: string;
  timestamp: number;
  retryCount: number;
}

interface QueueStatus {
  count: number;
  items: QueueItem[];
}

interface BackgroundSyncResult {
  item: QueueItem;
  success: boolean;
}

export const useBackgroundSync = () => {
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({ count: 0, items: [] });
  // Nutze echten Backend-Check statt navigator.onLine
  const { isOnline } = useNetworkStatus();
  const [lastSyncResult, setLastSyncResult] = useState<BackgroundSyncResult | null>(null);

  // Listen for service worker messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BACKGROUND_SYNC_RESULT') {
        setLastSyncResult({
          item: event.data.item,
          success: event.data.success
        });
        
        // Refresh queue status after sync
        refreshQueueStatus();
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  const sendMessageToSW = useCallback((message: any): Promise<any> => {
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      navigator.serviceWorker?.controller?.postMessage(message, [messageChannel.port2]);
    });
  }, []);

  const refreshQueueStatus = useCallback(async () => {
    if (navigator.serviceWorker?.controller) {
      try {
        const response = await sendMessageToSW({ type: 'GET_QUEUE_STATUS' });
        if (response?.type === 'QUEUE_STATUS') {
          setQueueStatus(response.status);
        }
      } catch (error) {
        console.error('Failed to get queue status:', error);
      }
    }
  }, [sendMessageToSW]);

  const processQueue = useCallback(async () => {
    if (navigator.serviceWorker?.controller) {
      try {
        await sendMessageToSW({ type: 'PROCESS_QUEUE' });
        await refreshQueueStatus();
        return true;
      } catch (error) {
        console.error('Failed to process queue:', error);
        return false;
      }
    }
    return false;
  }, [sendMessageToSW, refreshQueueStatus]);

  const clearQueue = useCallback(async () => {
    if (navigator.serviceWorker?.controller) {
      try {
        await sendMessageToSW({ type: 'CLEAR_QUEUE' });
        await refreshQueueStatus();
        return true;
      } catch (error) {
        console.error('Failed to clear queue:', error);
        return false;
      }
    }
    return false;
  }, [sendMessageToSW, refreshQueueStatus]);

  // Auto-refresh queue status when component mounts
  useEffect(() => {
    refreshQueueStatus();
  }, [refreshQueueStatus]);


  // Automatisch synchronisieren, sobald online
  useEffect(() => {
    if (isOnline) {
      console.log('[BackgroundSync] Online-Status erkannt - starte Auto-Sync');
      // Kurzes Delay, damit Queue nach Online-Wechsel wirklich gefüllt ist
      const timeoutId = setTimeout(() => {
        processQueue().then(() => {
          console.log('[BackgroundSync] Auto-Sync abgeschlossen');
          setTimeout(refreshQueueStatus, 1000);
        }).catch(err => {
          console.error('[BackgroundSync] Auto-Sync fehlgeschlagen:', err);
        });
      }, 1500); // 1,5s Delay für stabilere Verbindung
      
      return () => clearTimeout(timeoutId);
    }
  }, [isOnline, processQueue, refreshQueueStatus]);

  return {
    queueStatus,
    isOnline,
    lastSyncResult,
    refreshQueueStatus,
    processQueue,
    clearQueue,
    hasQueuedItems: queueStatus.count > 0
  };
};