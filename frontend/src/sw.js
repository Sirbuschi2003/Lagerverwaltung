import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Alle Build-Artefakte (JS-Chunks, CSS, Assets) werden von Workbox automatisch
// versioniert und precached. self.__WB_MANIFEST wird vom vite-plugin-pwa injiziert.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const CACHE_VERSION = 'v7-workbox';
const API_CACHE = `kfz-api-${CACHE_VERSION}`;
const OFFLINE_DATA_CACHE = `kfz-offline-data-${CACHE_VERSION}`;
const IMAGE_CACHE = 'kfz-item-images-v1';
const DEFAULT_FETCH_TIMEOUT = 2500;

const CACHEABLE_APIS = [
  '/api/items',
  '/api/auth/profile',
  '/api/vehicles',
  '/api/stock/vehicle/',
  '/api/stock/',
  '/api/inventory/sessions',
];

self.addEventListener('install', () => {
  // Workbox precaching übernimmt das App-Shell-Caching (App-Chunks, CSS, Icons).
  // skipWaiting sorgt dafür, dass neue SW-Version sofort aktiv wird sobald der
  // Nutzer eine Aktualisierung bestätigt (via SKIP_WAITING Nachricht).
  // NICHT automatisch skipWaiting hier, damit kein unkontrollierter Reload stattfindet.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter(
            (name) =>
              name !== API_CACHE &&
              name !== OFFLINE_DATA_CACHE &&
              name !== IMAGE_CACHE &&
              !name.startsWith('workbox-')
          )
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', async (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === 'PRECACHE_IMAGES') {
    event.waitUntil(precacheImages(event.data.itemIds ?? []));
    return;
  }

  if (event.data?.type === 'PROCESS_QUEUE') {
    try {
      const db = await openMovementDb();
      try {
        const tx = db.transaction('movements', 'readwrite');
        const store = tx.objectStore('movements');
        const movements = await getAllFromStore(store);

        for (const movement of movements) {
          try {
            const response = await fetchWithTimeout('/api/stock/movement', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(movement),
              timeout: 4000,
            });
            if (!response.ok) {
              break;
            }
            store.delete(movement.id);
          } catch {
            break;
          }
        }

        await waitForTransaction(tx);
        event.ports?.[0]?.postMessage({ type: 'QUEUE_PROCESSED' });
      } finally {
        db.close();
      }
    } catch (err) {
      event.ports?.[0]?.postMessage({ type: 'QUEUE_PROCESS_ERROR', error: String(err) });
    }
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.pathname.startsWith('/api')) {
    // Artikel-Bilder: network-first, offline-Fallback aus IMAGE_CACHE
    if (/^\/api\/items\/[^/]+\/image$/.test(url.pathname)) {
      event.respondWith(
        fetchWithTimeout(request, { timeout: 4000 })
          .then((response) => {
            if (response.ok) {
              const cacheCopy = response.clone();
              caches.open(IMAGE_CACHE).then((cache) => cache.put(request, cacheCopy));
            }
            return response;
          })
          .catch(() =>
            caches.open(IMAGE_CACHE).then((cache) => cache.match(request)).then((cached) => {
              if (cached) return cached;
              return new Response('', { status: 503 });
            })
          )
      );
      return;
    }

    if (url.pathname === '/api/auth/login') {
      event.respondWith(
        fetchWithTimeout(request, { timeout: 4000 })
          .then((response) => ensureUtf8Headers(response))
          .catch(
            () =>
              new Response(JSON.stringify({ error: 'OFFLINE_LOGIN_REQUIRED' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
              })
          )
      );
      return;
    }

    const shouldCache = CACHEABLE_APIS.some((apiPath) => url.pathname.startsWith(apiPath));
    if (shouldCache) {
      event.respondWith(
        fetchWithTimeout(request, { timeout: 3000 })
          .then((response) => {
            if (response.ok) {
              const responseWithUtf8 = ensureUtf8Headers(response);
              const cacheCopy = responseWithUtf8.clone();
              caches.open(OFFLINE_DATA_CACHE).then((cache) => cache.put(request, cacheCopy));
              return responseWithUtf8;
            }
            return ensureUtf8Headers(response);
          })
          .catch(() =>
            caches.match(request).then((cached) => {
              if (cached) return ensureUtf8Headers(cached);
              if (url.pathname.includes('/auth/profile')) {
                return new Response(JSON.stringify({ error: 'OFFLINE_MODE' }), {
                  status: 503,
                  headers: { 'Content-Type': 'application/json; charset=utf-8' },
                });
              }
              return new Response(JSON.stringify({ error: 'NETWORK_ERROR' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
              });
            })
          )
      );
    }
    return;
  }

  // Navigation (Pull-to-Refresh, Direkt-URL): immer index.html aus Cache liefern
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((cached) => cached || caches.match('/'))
      )
    );
    return;
  }
});

// --- Push-Benachrichtigungen ---

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Benachrichtigung', body: event.data.text() };
  }

  const title = payload.title || 'Benachrichtigung';
  const options = {
    body: payload.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url: payload.url || '/' },
    tag: payload.tag || 'default',
    renotify: payload.renotify || false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});

// --- Hilfsfunktionen ---

function ensureUtf8Headers(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('charset=utf-8')) return response;

  const headers = new Headers(response.headers);
  if (contentType.includes('application/json')) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
  } else if (contentType.includes('text/html')) {
    headers.set('Content-Type', 'text/html; charset=utf-8');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function fetchWithTimeout(request, options = {}) {
  const { timeout = DEFAULT_FETCH_TIMEOUT, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(request, { ...rest, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function openMovementDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('kfz-teilelager', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('movements')) {
        db.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function waitForTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

async function precacheImages(itemIds) {
  if (!itemIds?.length) return;
  const cache = await caches.open(IMAGE_CACHE);
  for (const id of itemIds) {
    const url = `/api/items/${id}/image`;
    try {
      const existing = await cache.match(url);
      if (existing) continue;
      const response = await fetchWithTimeout(url, { timeout: 6000 });
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch {
      // Netzwerkfehler – dieses Bild beim nächsten Mal cachen
    }
  }
}
