// Service worker: deixa o Pauta abrir sem internet (a moldura do app fica guardada no aparelho).
// Estratégia "rede primeiro": com internet, sempre a versão mais nova dos arquivos; sem, a guardada.
// As chamadas à API (outro endereço) nunca passam pelo cache: os dados vêm sempre do banco.
const VERSAO = 'pauta-rotina-v1';
const ARQUIVOS = [
  './',
  'assets/favicon.svg',
  'assets/fonts/instrument-sans.woff2',
  'assets/fonts/instrument-serif.woff2',
  'assets/icone-192.png',
  'assets/icone-512.png',
  'assets/icone-maskable-512.png',
  'css/app.css',
  'css/base.css',
  'css/componentes.css',
  'css/layout.css',
  'css/telas.css',
  'css/tokens.css',
  'index.html',
  'js/app.js',
  'js/config.js',
  'js/core/animar.js',
  'js/core/format.js',
  'js/core/html.js',
  'js/core/router.js',
  'js/core/storage.js',
  'js/core/store.js',
  'js/data/api.js',
  'js/data/demo.js',
  'js/data/http.js',
  'js/domain/enums.js',
  'js/domain/frase.js',
  'js/domain/rotina.js',
  'js/forms/area-form.js',
  'js/forms/campos.js',
  'js/forms/habito-form.js',
  'js/forms/item-form.js',
  'js/forms/perfil-form.js',
  'js/state.js',
  'js/ui/comandos.js',
  'js/ui/icons.js',
  'js/ui/menu.js',
  'js/ui/modal.js',
  'js/ui/pecas.js',
  'js/ui/segurar.js',
  'js/ui/toast.js',
  'js/ui/tooltip.js',
  'js/vendor/charts.js',
  'js/views/adicao.js',
  'js/views/ajustes.js',
  'js/views/boas-vindas.js',
  'js/views/conexao.js',
  'js/views/foco.js',
  'js/views/hoje.js',
  'js/views/progresso.js',
  'js/views/rotina.js',
  'manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const pedido = e.request;
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(pedido)
      .then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(VERSAO).then((c) => c.put(pedido, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(pedido).then((r) => r || (pedido.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
