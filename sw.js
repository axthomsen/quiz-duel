// Network first, cache as a fallback: updates show up on the next launch,
// and the app still opens when the phone is offline.
// Bump CACHE whenever this list changes. Must match the categories in questions.js
// (dev/check.html verifies this).
const CACHE = 'quizduel-v4';
const CATEGORY_FILES = [
  'geo', 'hist', 'sci', 'nature', 'sport', 'film', 'music', 'food', 'arts', 'tech', 'space', 'body',
  'myth', 'words', 'games', 'math', 'landmarks', 'capitals', 'heroes', 'earth', 'invent',
  'dino', 'ocean', 'board', 'transport', 'money',
].map(id => `questions/${id}.js`);
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'logic.js', 'store.js', 'questions.js', ...CATEGORY_FILES,
  'firebase-config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    // 'no-cache' revalidates with the server instead of trusting the browser's HTTP cache
    // (GitHub Pages sends max-age=600), so right after a deploy a phone never mixes old and
    // new question files.
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
