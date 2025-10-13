// Emergency Service Worker - Deaktiviert sich selbst und löscht alle Caches
console.log('EMERGENCY SW: Cleaning up and self-destructing...');

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Alle Caches löschen
      caches.keys().then((names) => 
        Promise.all(names.map(name => caches.delete(name)))
      ),
      // Clients übernehmen
      self.clients.claim()
    ]).then(() => {
      console.log('EMERGENCY SW: Cleanup complete, unregistering...');
      // Selbst deregistrieren
      self.registration.unregister();
    })
  );
});

// KEIN fetch event - keine Interception
