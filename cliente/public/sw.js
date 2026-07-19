// SaborExpress - Service Worker para Push Notifications
const CACHE_NAME = 'saborexpress-v1';

// Instalação: pré-cache básico
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Ativação: limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Interceptar fetch (para cache offline opcional)
// Apenas faz cache de recursos estáticos, não de API calls
self.addEventListener('fetch', (event) => {
  // Não interceptar chamadas de API
  if (event.request.url.includes('/api/') || event.request.url.includes('localhost')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Receber push notification
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options = {
      body: data.body || '',
      icon: data.icon || '/icons/icon.svg',
      badge: data.badge || '/icons/icon.svg',
      vibrate: data.vibrate || [200, 100, 200],
      data: data.data || {},
      actions: data.actions || [],
      tag: data.data?.url || 'saborexpress',
      renotify: true,
      requireInteraction: true,
      silent: false,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'SaborExpress', options)
    );
  } catch (err) {
    console.error('[SW] Erro ao processar push:', err);
  }
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const action = event.action;

  if (action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (url) client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) {
        clients.openWindow(self.location.origin + url);
      }
    })
  );
});
