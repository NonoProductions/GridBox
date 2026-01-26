'use client';

import { useEffect, useState } from 'react';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
} from '@/lib/notifications';

export default function NotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    // Prüfe Support
    const supported = isNotificationSupported();
    setIsSupported(supported);

    if (!supported) {
      console.log('Push-Benachrichtigungen werden nicht unterstützt');
      return;
    }

    // Prüfe aktuelle Berechtigung
    getNotificationPermission().then((perm) => {
      setPermission(perm);
    });

    // Registriere Service Worker
    registerServiceWorker()
      .then((registration) => {
        if (registration) {
          setIsRegistered(true);
          console.log('Service Worker erfolgreich registriert');

          // Prüfe auf Updates
          registration.addEventListener('updatefound', () => {
            console.log('Service Worker Update gefunden');
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('Neue Service Worker Version verfügbar');
                  // Optional: Benutzer über Update informieren
                }
              });
            }
          });
        }
      })
      .catch((error) => {
        console.error('Fehler bei Service Worker Registrierung:', error);
      });

    // Service Worker Controller Changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service Worker Controller geändert - Seite neu laden empfohlen');
      // Optional: Automatisch neu laden
      // window.location.reload();
    });
  }, []);

  // Automatisch Berechtigung anfordern wenn noch nicht erteilt
  useEffect(() => {
    if (isSupported && permission === 'default' && isRegistered) {
      // Warte kurz bevor Berechtigung angefordert wird
      const timer = setTimeout(() => {
        requestNotificationPermission().then((perm) => {
          setPermission(perm);
        });
      }, 2000); // 2 Sekunden Verzögerung für bessere UX

      return () => clearTimeout(timer);
    }
  }, [isSupported, permission, isRegistered]);

  // Diese Komponente rendert nichts, sie verwaltet nur den Service Worker
  return null;
}
