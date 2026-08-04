self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};

  const badgeSupported = 'setAppBadge' in self.navigator;
  const title = (data.title || 'AraratSpa') + (badgeSupported ? '' : ' [SIN BADGE API]');

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/notification-icon-96.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);

      if (badgeSupported) {
        try {
          if (data.badgeCount && data.badgeCount > 0) {
            await self.navigator.setAppBadge(data.badgeCount);
          } else {
            await self.navigator.clearAppBadge();
          }
        } catch (err) {
          console.error('Error actualizando el badge:', err);
        }
      }
    })()
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});