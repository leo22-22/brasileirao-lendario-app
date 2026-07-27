// Service worker do Brasileirão Lendário — cache "network-first" pra deixar
// o jogo funcionando offline depois da primeira visita (rotas de API nunca
// são cacheadas, já que placar/sala/conta sempre precisam de dado fresco).
const CACHE_NAME = 'brl-cache-v2';
const PRECACHE_URLS = ['/', '/manifest.json', '/favicon.ico', '/icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Chamadas de API (placar em tempo real, sala de multiplayer, conta) nunca
  // passam pelo cache — offline elas simplesmente falham, o que é o correto.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        // 'basic' = mesma origem (bundle, imagens locais); 'cors' = cross-origin
        // com header liberado (fontes do Google). 'opaque' fica de fora — não dá
        // pra saber se a resposta é válida, cachear cegamente esconderia erros.
        if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(cached => {
          if (cached) return cached;
          // Navegação sem cache específico (ex.: refresh direto numa rota) cai
          // no app shell — o React Router/estado do jogo assume dali pra frente.
          if (request.mode === 'navigate') return caches.match('/');
          return undefined;
        })
      )
  );
});
