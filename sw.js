const CACHE_NAME = 'qgo-cargo-cache-v2'; // Incremented cache version
const urlsToCache = [
  '/',
  'index.html', // Explicitly cache index.html
  'style.css',
  'script.js',
  'manifest.webmanifest', // Added manifest to cache
  'https://qgocargo.com/logo.png', // Using the logo from settings
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/lucide-static@latest/font/lucide.css',
  "https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore-compat.js",
  "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage-compat.js"
];

self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Use addAll to fetch and cache all the resources.
        // It's atomic: if one file fails, the whole operation fails.
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Failed to cache during install:', error);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // IMPORTANT: Clone the request. A request is a stream and
        // can only be consumed once. Since we are consuming this
        // once by cache and once by the browser for fetch, we need
        // to clone the response.
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200) {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Only cache GET requests.
                if (event.request.method === 'GET') {
                    cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        ).catch(err => {
            // Network request failed, try to serve a fallback page from cache.
            // For navigation requests, fallback to index.html
            if (event.request.mode === 'navigate') {
                return caches.match('index.html');
            }
            // For other requests, just fail.
            return;
        })
      })
    );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
