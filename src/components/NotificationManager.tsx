'use client';

import { useEffect, useState } from 'react';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
} from '@/lib/notifications';
import { logger } from '@/lib/logger';

export default function NotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    // Prüfe Support (setState asynchron, um react-hooks/set-state-in-effect zu vermeiden)
    const supported = isNotificationSupported();
    queueMicrotask(() => setIsSupported(supported));

    if (!supported) {
      logger.dev('Push-Benachrichtigungen werden nicht unterstützt');
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
          logger.dev('Service Worker erfolgreich registriert');

          // Prüfe auf Updates
          registration.addEventListener('updatefound', () => {
            logger.dev('Service Worker Update gefunden');
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  logger.dev('Neue Service Worker Version verfügbar');
                  // Optional: Benutzer über Update informieren
                }
              });
            }
          });
        }
      })
      .catch((error) => {
        logger.error('Fehler bei Service Worker Registrierung:', String(error));
      });

    // Service Worker Controller Changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      logger.dev('Service Worker Controller geändert - Seite neu laden empfohlen');
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
