// Service worker : permet d'ouvrir l'application sans Internet.
// À chaque mise à jour de l'application, augmentez VERSION (v2, v3…).
const VERSION = 'v5';
const SHELL = `whsc-shell-${VERSION}`, LIBS = `whsc-libs-${VERSION}`;
const SHELL_FILES = ['./', 'index.html', 'manifest.webmanifest', 'config.js', 'js/app.js', 'js/store.js', 'js/common.js', 'js/fiche.js', 'js/ocr.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/logo-provisoire.svg',
  'fonts/figtree-latin-400-normal.woff2', 'fonts/figtree-latin-400-italic.woff2', 'fonts/figtree-latin-600-normal.woff2', 'fonts/figtree-latin-700-normal.woff2', 'fonts/figtree-latin-800-normal.woff2'];
const LIB_FILES = ['vendor/jspdf.umd.min.js', 'vendor/docx.umd.js', 'vendor/firebase.js', 'vendor/tesseract/tesseract.min.js', 'vendor/tesseract/worker.min.js',
  'vendor/tesseract/lang/fra.traineddata.gz', 'vendor/tesseract/lang/eng.traineddata.gz'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await (await caches.open(SHELL)).addAll(SHELL_FILES.map(u => new Request(u, { cache: 'reload' })));
    const libs = await caches.open(LIBS);
    await Promise.all(LIB_FILES.map(u => libs.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('whsc-') && k !== SHELL && k !== LIBS) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // Firebase et autres : réseau direct
  const path = url.pathname;
  if (path.includes('/vendor/')) { // bibliothèques : cache d'abord (le moteur de lecture se met en cache au premier usage)
    e.respondWith(caches.open(LIBS).then(async c => (await c.match(req)) || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; })));
    return;
  }
  // application : réponse immédiate depuis le cache, mise à jour en arrière-plan
  e.respondWith(caches.open(SHELL).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('index.html') : null);
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    if (path.endsWith('/config.js')) return (await net) || hit || Response.error();
    return hit || (await net) || Response.error();
  }));
});
