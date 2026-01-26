/* PWA Service Worker with Cross-Origin Isolation (COI) Support */

const CACHE_NAME = 'web-local-llm-v3';
const ASSETS_TO_CACHE = [
    './index.html',
    './manifest.json',
    './icon.png',
    './vite.svg'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Use individual additions to prevent one failure from blocking all
            return Promise.allSettled(ASSETS_TO_CACHE.map(url => cache.add(url)));
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== 'wllama') {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    // 1. COI Headers Logic
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If the response is not valid, try cache fallback
                if (!response || response.status === 0) {
                    return caches.match(event.request).then(cached => cached || response);
                }

                // Add isolation headers to every response to ensure SharedArrayBuffer works
                const newHeaders = new Headers(response.headers);
                newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
                newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });
            })
            .catch(() => {
                // Network failure - try cache
                return caches.match(event.request).then(response => {
                    return response || new Response("Not Found", { status: 404, statusText: "Not Found" });
                });
            })
    );
});
