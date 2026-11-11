/* Service Worker — deixa o app abrir e funcionar sem internet.
   Ao alterar qualquer arquivo do app, aumente a VERSAO para os celulares baixarem a nova versão. */
const VERSAO = 'portaria-v1.3.1';

const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/config.js',
  './js/util.js',
  './js/dados.js',
  './js/whatsapp.js',
  './js/scanner.js',
  './js/importar.js',
  './js/pdf.js',
  './js/excel.js',
  './js/usuarios.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/logo-etec.png',
  './icons/logo-cps.png'
];

const BIBLIOTECAS = [
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSAO);
    await cache.addAll(ARQUIVOS);
    // bibliotecas externas: uma falha não impede a instalação
    await Promise.all(BIBLIOTECAS.map((url) => cache.add(new Request(url, { mode: 'cors' })).catch(() => null)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                               // POST para o Apps Script vai direto à rede
  const url = new URL(req.url);
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;

  // Páginas: rede primeiro (pega atualização), cache se offline
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => {
      const copia = r.clone(); caches.open(VERSAO).then((c) => c.put('./index.html', copia));
      return r;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  // Demais arquivos: cache primeiro, atualiza em segundo plano
  e.respondWith(caches.match(req).then((cacheado) => {
    const rede = fetch(req).then((r) => {
      if (r && (r.ok || r.type === 'opaque')) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
      return r;
    }).catch(() => cacheado);
    return cacheado || rede;
  }));
});
