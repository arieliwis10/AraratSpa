self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};

  const title = data.title || 'AraratSpa';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' }, // para saber a dónde navegar al hacer click
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);

      if ('setAppBadge' in self.navigator) {
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