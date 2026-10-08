/* Only the public application shell belongs in CacheStorage. Customer records,
   photos and receipts stay in IndexedDB; unknown URLs are never cached here. */
const CACHE = 'werkpilot-app-v5.0.0';
const ASSETS = [
  './index.html', './app.js', './core.js', './speech.js', './platform.js',
  './native.js', './backup.js', './quotes.js', './professional.js', './knowledge.js', './trades.js', './planner.js', './photos.js', './vision.js', './workflow.js', './style.css', './icon.svg',
  './icon-192.png', './icon-512.png', './maskable-512.png',
  './apple-touch-icon.png', './manifest.webmanifest'
];
const BASE = new URL('./', self.location.href);
const ASSET_URLS = new Set(ASSETS.map(path => new URL(path, BASE).href));
const INDEX = new URL('./index.html', BASE).href;
const NAVIGATIONS = new Set([BASE.href, INDEX]);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    [...ASSET_URLS].map(url => new Request(url, { cache: 'reload' }))
  )));
  // Activate after the previous app windows close, keeping all modules on one
  // version. A half-updated app must not run a new data migration prematurely.
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(
    names.filter(name => name !== CACHE && /^werkpilot-(?:app-)?v/.test(name))
      .map(name => caches.delete(name))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('authorization')) return;
  const url = new URL(request.url);
  if (url.origin !== BASE.origin) return;
  url.search = '';
  url.hash = '';
  if (request.mode === 'navigate' && NAVIGATIONS.has(url.href)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(INDEX))
      .then(response => response || fetch(request)));
    return;
  }
  if (!ASSET_URLS.has(url.href)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(url.href))
    .then(response => response || fetch(request)));
});
