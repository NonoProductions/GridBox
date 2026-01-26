// Push-Benachrichtigungen für GridBox PWA

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, any>;
  url?: string;
  actions?: NotificationAction[];
}

// Prüfe ob Browser Push-Benachrichtigungen unterstützt
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

// Prüfe ob Benachrichtigungen bereits erlaubt sind
export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'denied';
  }
  return Notification.permission;
}

// Frage Benachrichtigungs-Berechtigung an
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    console.warn('Push-Benachrichtigungen werden nicht unterstützt');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('Benachrichtigungs-Berechtigung:', permission);
    return permission;
  } catch (error) {
    console.error('Fehler beim Anfordern der Benachrichtigungs-Berechtigung:', error);
    return 'denied';
  }
}

// Registriere Service Worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker wird nicht unterstützt');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    
    console.log('Service Worker registriert:', registration);
    
    // Warte auf Aktivierung
    if (registration.installing) {
      console.log('Service Worker wird installiert...');
    } else if (registration.waiting) {
      console.log('Service Worker wartet auf Aktivierung...');
    } else if (registration.active) {
      console.log('Service Worker ist aktiv');
    }
    
    return registration;
  } catch (error) {
    console.error('Fehler bei Service Worker Registrierung:', error);
    return null;
  }
}

// Sende lokale Benachrichtigung (ohne Push-Server)
export async function showLocalNotification(options: NotificationOptions): Promise<void> {
  if (!isNotificationSupported()) {
    console.warn('Benachrichtigungen werden nicht unterstützt');
    return;
  }

  const permission = await getNotificationPermission();
  if (permission !== 'granted') {
    console.warn('Benachrichtigungs-Berechtigung nicht erteilt:', permission);
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    await registration.showNotification(options.title, {
      body: options.body,
      icon: options.icon || '/icon-192x192.png',
      badge: options.badge || '/icon-192x192.png',
      tag: options.tag || 'gridbox-notification',
      requireInteraction: options.requireInteraction || false,
      data: {
        ...options.data,
        url: options.url || '/'
      },
      vibrate: [200, 100, 200],
      actions: options.actions || []
    });
    
    console.log('Benachrichtigung angezeigt:', options.title);
  } catch (error) {
    console.error('Fehler beim Anzeigen der Benachrichtigung:', error);
  }
}

// Sende Push-Benachrichtigung über Service Worker
export async function sendPushNotification(options: NotificationOptions): Promise<void> {
  if (!isNotificationSupported()) {
    console.warn('Push-Benachrichtigungen werden nicht unterstützt');
    return;
  }

  const permission = await getNotificationPermission();
  if (permission !== 'granted') {
    console.warn('Push-Benachrichtigungs-Berechtigung nicht erteilt:', permission);
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Sende Nachricht an Service Worker, der dann die Benachrichtigung anzeigt
    await registration.active?.postMessage({
      type: 'SHOW_NOTIFICATION',
      notification: {
        title: options.title,
        body: options.body,
        icon: options.icon || '/icon-192x192.png',
        badge: options.badge || '/icon-192x192.png',
        tag: options.tag || 'gridbox-notification',
        requireInteraction: options.requireInteraction || false,
        data: {
          ...options.data,
          url: options.url || '/'
        },
        actions: options.actions || []
      }
    });
    
    // Alternativ: Direkt über Service Worker API
    await registration.showNotification(options.title, {
      body: options.body,
      icon: options.icon || '/icon-192x192.png',
      badge: options.badge || '/icon-192x192.png',
      tag: options.tag || 'gridbox-notification',
      requireInteraction: options.requireInteraction || false,
      data: {
        ...options.data,
        url: options.url || '/'
      },
      vibrate: [200, 100, 200],
      actions: options.actions || []
    });
    
    console.log('Push-Benachrichtigung gesendet:', options.title);
  } catch (error) {
    console.error('Fehler beim Senden der Push-Benachrichtigung:', error);
  }
}

// Hilfsfunktionen für spezifische Benachrichtigungen
export async function notifyRentalSuccess(stationName: string, url?: string): Promise<void> {
  await showLocalNotification({
    title: '✅ Powerbank ausgeliehen',
    body: `Powerbank erfolgreich an Station "${stationName}" ausgeliehen!`,
    tag: 'rental-success',
    url: url || '/',
    icon: '/icon-192x192.png'
  });
}

export async function notifyRentalError(message: string): Promise<void> {
  await showLocalNotification({
    title: '❌ Fehler bei Ausleihe',
    body: message,
    tag: 'rental-error',
    requireInteraction: true,
    icon: '/icon-192x192.png'
  });
}

export async function notifyReturnSuccess(stationName: string, url?: string): Promise<void> {
  await showLocalNotification({
    title: '✅ Powerbank zurückgegeben',
    body: `Powerbank erfolgreich an Station "${stationName}" zurückgegeben!`,
    tag: 'return-success',
    url: url || '/',
    icon: '/icon-192x192.png'
  });
}

export async function notifyStationUpdate(stationName: string, message: string, url?: string): Promise<void> {
  await showLocalNotification({
    title: `📡 ${stationName}`,
    body: message,
    tag: 'station-update',
    url: url || '/',
    icon: '/icon-192x192.png'
  });
}
