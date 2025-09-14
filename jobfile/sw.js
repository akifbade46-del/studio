
const CACHE_NAME = 'jobfile-cache-v2'; // Incremented cache version
const urlsToCache = [
  './',
  './index.html',
  './app.html',
  './style.css',
  './script.js',
  './auth.js',
  './ui.js',
  './firestore.js',
  './gemini.js',
  './state.js',
  './utils.js',
  './manifest.json',
  'http://qgocargo.com/logo.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install a service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Add all URLs to cache, but don't fail if one of the external URLs fails
        const cachePromises = urlsToCache.map(urlToCache => {
            return cache.add(urlToCache).catch(err => {
                console.warn(`Failed to cache ${urlToCache}:`, err);
            });
        });
        return Promise.all(cachePromises);
      })
  );
});

// Use the Network First (Network Falling Back to Cache) strategy
self.addEventListener('fetch', event => {
    // We only want to cache GET requests.
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // If the fetch is successful, clone the response and cache it.
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                }
                return response;
            })
            .catch(() => {
                // If the network request fails, try to get the response from the cache.
                return caches.match(event.request);
            })
    );
});


// Activate the service worker and remove old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
