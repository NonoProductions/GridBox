// Service Worker für GridBox PWA mit Push-Benachrichtigungen
const CACHE_NAME = 'gridbox-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// Install Event - Cache statische Assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting(); // Sofort aktiv werden
    })
  );
});

// Activate Event - Alte Caches löschen
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      return self.clients.claim(); // Sofort Kontrolle übernehmen
    })
  );
});

// Push Event - Push-Benachrichtigungen empfangen
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  
  let notificationData = {
    title: 'GridBox',
    body: 'Sie haben eine neue Benachrichtigung',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'gridbox-notification',
    requireInteraction: false,
    data: {}
  };

  // Wenn Daten im Push-Event vorhanden sind, verwende diese
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        data: data.data || {}
      };
    } catch (e) {
      // Falls kein JSON, verwende als Text
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      vibrate: [200, 100, 200],
      actions: notificationData.actions || []
    })
  );
});

// Notification Click Event - Bei Klick auf Benachrichtigung
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  const notificationData = event.notification.data || {};
  const urlToOpen = notificationData.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Prüfe ob bereits ein Fenster/Tab offen ist
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Öffne neues Fenster/Tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Fetch Event - Network First Strategy für bessere Performance
self.addEventListener('fetch', (event) => {
  // Nur GET-Requests cachen
  if (event.request.method !== 'GET') {
    return;
  }

  // API-Requests nicht cachen
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Nur erfolgreiche Responses cachen
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback zu Cache wenn Netzwerk fehlschlägt
        return caches.match(event.request);
      })
  );
});

// Message Event - Kommunikation mit Client
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLIENTS_CLAIM') {
    self.clients.claim();
  }
  
  // Benachrichtigung über PostMessage anzeigen
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const notification = event.data.notification;
    event.waitUntil(
      self.registration.showNotification(notification.title, {
        body: notification.body,
        icon: notification.icon || '/icon-192x192.png',
        badge: notification.badge || '/icon-192x192.png',
        tag: notification.tag || 'gridbox-notification',
        requireInteraction: notification.requireInteraction || false,
        data: notification.data || {},
        vibrate: [200, 100, 200],
        actions: notification.actions || []
      })
    );
  }
});
