import { useEffect } from 'react';
import useFrontendLogStore from '../store/useFrontendLogStore';

/**
 * Hook zum automatischen Logging aller User-Interaktionen
 * - Klicks auf interaktive Elemente (Buttons, Links, etc.)
 * - Navigation zwischen Seiten
 * - Fehler (JavaScript Errors)
 * - Automatisches Sync zum Backend alle 60 Sekunden
 * 
 * Sollte in App.tsx eingebunden werden
 */
export const useGlobalLogging = () => {
  const addLog = useFrontendLogStore((state) => state.addLog);
  const syncToBackend = useFrontendLogStore((state) => state.syncToBackend);

  useEffect(() => {
    console.log('[GlobalLogging] Initialisiere globales Logging...');

    // Auto-Sync alle 60 Sekunden
    const syncInterval = setInterval(() => {
      syncToBackend().catch(err => {
        console.warn('[GlobalLogging] Auto-Sync fehlgeschlagen:', err);
      });
    }, 60000); // 60 Sekunden

    // 1. Klick-Listener für alle interaktiven Elemente
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Bestimme Element-Typ und relevante Infos
      let elementType = target.tagName.toLowerCase();
      let elementInfo: any = {
        tag: elementType,
        className: target.className,
        id: target.id,
      };
      
      // Spezielle Behandlung für verschiedene Element-Typen
      if (elementType === 'button') {
        elementInfo.text = target.textContent?.trim().substring(0, 50);
        elementInfo.type = (target as HTMLButtonElement).type;
      } else if (elementType === 'a') {
        elementInfo.href = (target as HTMLAnchorElement).href;
        elementInfo.text = target.textContent?.trim().substring(0, 50);
      } else if (elementType === 'input') {
        const inputElement = target as HTMLInputElement;
        elementInfo.type = inputElement.type;
        elementInfo.name = inputElement.name;
        // DSGVO: Keine Eingabewerte loggen (könnten personenbezogene Daten enthalten)
      } else if (target.closest('button, a, [role="button"]')) {
        // Klick auf Kind-Element eines interaktiven Elements
        const parent = target.closest('button, a, [role="button"]') as HTMLElement;
        elementType = parent.tagName.toLowerCase();
        elementInfo = {
          tag: elementType,
          className: parent.className,
          id: parent.id,
          text: parent.textContent?.trim().substring(0, 50),
        };
      }
      
      // Log nur für relevante interaktive Elemente
      if (['button', 'a', 'input'].includes(elementType) || target.getAttribute('role') === 'button') {
        addLog('info', 'click', `Klick auf ${elementType}`, elementInfo);
      }
    };
    
    // 2. Navigation-Listener (URL-Änderungen)
    // DSGVO: Nur Pfad loggen, keine Query-Parameter (könnten Artikel-IDs, Suchbegriffe enthalten)
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
    
    // 3. Error-Listener für JavaScript-Fehler
    const handleError = (event: ErrorEvent) => {
      addLog('error', 'error', `JavaScript-Fehler: ${event.message}`, {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack || event.error?.toString(),
      });
    };
    
    // 4. Unhandled Promise Rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      addLog('error', 'error', `Unhandled Promise Rejection: ${event.reason}`, {
        reason: event.reason?.toString(),
        stack: event.reason?.stack,
      });
    };
    
    // history.pushState / replaceState patchen für SPA-Navigation (React Router)
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

    // Event-Listener registrieren
    document.addEventListener('click', handleClick, true); // Capture-Phase für alle Klicks
    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('locationchange', handleNavigation);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Initial navigation log (DSGVO: kein href mit Query-Parametern)
    addLog('info', 'navigation', `App gestartet auf ${window.location.pathname}`, {
      pathname: window.location.pathname,
    });

    // Cleanup
    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('locationchange', handleNavigation);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      // pushState/replaceState zurücksetzen
      window.history.pushState = origPushState;
      window.history.replaceState = origReplaceState;
      clearInterval(syncInterval);
      console.log('[GlobalLogging] Globales Logging deaktiviert');
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
