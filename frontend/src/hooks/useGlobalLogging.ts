import { useEffect } from 'react';
import useFrontendLogStore from '../store/useFrontendLogStore';

/**
 * Hook für globales Fehler- und Navigations-Logging.
 * Loggt: JS-Fehler, unhandled Promise Rejections, Seitenwechsel.
 * Kein Click-Tracking – das erzeugt nur Rauschen ohne Mehrwert.
 */
export const useGlobalLogging = () => {
  const addLog = useFrontendLogStore((state) => state.addLog);
  const syncToBackend = useFrontendLogStore((state) => state.syncToBackend);

  useEffect(() => {
    const syncInterval = setInterval(() => {
      syncToBackend().catch(() => {});
    }, 60000);

    // Navigation (Seitenwechsel im SPA)
    let lastPathname = window.location.pathname;
    const handleNavigation = () => {
      const currentPathname = window.location.pathname;
      if (currentPathname !== lastPathname) {
        addLog('info', 'navigation', `Navigation zu ${currentPathname}`, {
          from: lastPathname,
          to: currentPathname,
        });
        lastPathname = currentPathname;
      }
    };

    // JavaScript-Fehler
    const handleError = (event: ErrorEvent) => {
      addLog('error', 'error', `JavaScript-Fehler: ${event.message}`, {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack || event.error?.toString(),
      });
    };

    // Unhandled Promise Rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      addLog('error', 'error', `Unhandled Promise Rejection: ${event.reason}`, {
        reason: event.reason?.toString(),
        stack: event.reason?.stack,
      });
    };

    const origPushState = window.history.pushState.bind(window.history);
    const origReplaceState = window.history.replaceState.bind(window.history);
    window.history.pushState = function (...args) {
      origPushState(...args);
      window.dispatchEvent(new Event('locationchange'));
    };
    window.history.replaceState = function (...args) {
      origReplaceState(...args);
      window.dispatchEvent(new Event('locationchange'));
    };

    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('locationchange', handleNavigation);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('locationchange', handleNavigation);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.history.pushState = origPushState;
      window.history.replaceState = origReplaceState;
      clearInterval(syncInterval);
    };
  }, [addLog, syncToBackend]);
};

/**
 * Hook zum Logging von API-Calls
 * Wird in api.ts verwendet
 */
export const logApiCall = async (
  method: string,
  url: string,
  status: number,
  duration: number,
  error?: any
) => {
  const addLog = useFrontendLogStore.getState().addLog;
  
  if (url.includes('/logs/frontend')) {
    return;
  }

  // DSGVO: URL-Pfad ohne Query-Parameter loggen (Query-Parameter können IDs/Suchbegriffe enthalten)
  const urlPath = url.split('?')[0];

  if (error) {
    await addLog('error', 'api-error', `API-Fehler: ${method} ${urlPath}`, {
      method,
      path: urlPath,
      status,
      duration,
      // Nur den Fehlertyp, keine Response-Daten (könnten sensible Fehlermeldungen enthalten)
      error: error?.message || String(status),
    });
  } else {
    await addLog('debug', 'api-call', `API-Call: ${method} ${urlPath}`, {
      method,
      path: urlPath,
      status,
      duration,
    });
  }
};
