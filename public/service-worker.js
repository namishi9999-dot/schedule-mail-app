/**
 * Service Worker（PWA）
 * 静的ファイルをキャッシュ・APIはネットワーク優先
 */
const CACHE_NAME = 'schedule-app-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/completed.html',
  '/recurring.html',
  '/settings.html',
  '/css/style.css',
  '/js/app.js',
  '/js/calendar.js',
  '/js/tasks.js',
  '/js/recurring.js',
  '/js/settings.js',
  '/js/notify.js',
  '/manifest.json',
];

// インストール：静的アセットをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// アクティベート：古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// フェッチ：API → ネットワーク優先、静的 → キャッシュ優先
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // APIリクエストはネットワーク優先
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'オフライン中です' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // 静的ファイルはキャッシュ優先
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
