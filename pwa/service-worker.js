self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  // Add caching logic here if needed
});

self.addEventListener('fetch', (event) => {
  console.log('Fetching:', event.request.url);
  // Add fetch handling logic here if needed
  event.respondWith(fetch(event.request));
});
