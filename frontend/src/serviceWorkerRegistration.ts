// Extend ServiceWorkerRegistration interface for background sync
declare global {
  interface ServiceWorkerRegistration {
    sync?: {
      register: (tag: string) => Promise<void>;
    };
  }
}

let pendingReload = false;

export function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none"
        });

        console.log("Service Worker registriert:", registration.scope);

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed") {
                if (navigator.serviceWorker.controller) {
                  // Reload nur nach explizitem SKIP_WAITING (nicht bei jedem controllerchange)
                  pendingReload = true;
                  newWorker.postMessage({ type: "SKIP_WAITING" });
                } else {
                  console.log("Service Worker erfolgreich installiert - PWA bereit!");
                }
              }
            });
          }
        });

        console.log("Service Worker registriert");
      } catch (error) {
        console.error("Service Worker Registrierung fehlgeschlagen:", error);
      }
    });

    // Reload nur wenn wir selbst ein Update angestoßen haben
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (pendingReload) {
        pendingReload = false;
        window.location.reload();
      }
    });
  }
}

export async function requestSync() {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration?.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.sync) {
        await registration.sync.register('offline-sync');
        console.log('Background sync angefordert');
      }
    } catch (error) {
      console.error('Background sync Anfrage fehlgeschlagen:', error);
    }
  }
}

