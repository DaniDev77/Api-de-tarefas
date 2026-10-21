// Ponto de entrada: monta a moldura (lateral, topo e abas), liga rotas, atalhos e a sincronização.
import { html, raw, render, morph } from './core/html.js';
import { iniciarRoteador, navegar, lerRota } from './core/router.js';
import { hora } from './core/format.js';
import { APP, SINCRONIZAR_APOS_MS } from './config.js';
import { store, carregarTudo, definirTema, efetivarExclusoesPendentes, perfilAtual, restanteFoco } from './state.js';
import { indiceRotina, diasAteAcabar } from './domain/rotina.js';
import { icone, marca } from './ui/icons.js';
import { inicial } from './ui/pecas.js';
import { iniciarDicas } from './ui/tooltip.js';
import { abrirModal } from './ui/modal.js';
import { fecharMenu } from './ui/menu.js';
import { abrirComandos } from './ui/comandos.js';
import { menuPerfis } from './forms/perfil-form.js';
import { desenharConexao } from './views/conexao.js';
import { relogio } from './views/foco.js';
import hoje from './views/hoje.js';
import progresso from './views/progresso.js';
import rotina from './views/rotina.js';
import ajustes, { listaAtalhos } from './views/ajustes.js';
import foco from './views/foco.js';

const ROTAS = { hoje, progresso, rotina, ajustes, foco };
const NAV = [
  { rota: 'hoje', rotulo: 'Hoje', icone: 'calendar-check', tecla: 'H' },
  { rota: 'progresso', rotulo: 'Progresso', icone: 'chart-column', tecla: 'P' },
  { rota: 'rotina', rotulo: 'Rotina', icone: 'repeat-2', tecla: 'R' },
  { rota: 'ajustes', rotulo: 'Ajustes', icone: 'settings', tecla: 'A' },
];

const $ = (sel) => document.querySelector(sel);
const conteudo = $('[data-conteudo]');

// ------------------------------------------------------------------ tema

const midiaEscura = matchMedia('(prefers-color-scheme: dark)');
function aplicarTema(tema) {
  const raizHtml = document.documentElement;
  if (tema === 'claro' || tema === 'escuro') raizHtml.dataset.tema = tema;
  else delete raizHtml.dataset.tema;
  const escuro = tema === 'escuro' || (tema === 'sistema' && midiaEscura.matches);
  $('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#141413' : '#f0f0ed');
}

// ------------------------------------------------------------------ moldura

/** Hábitos que acabam nos próximos 7 dias: a única contagem da navegação (pede uma ação). */
function habitosAcabando(s) {
  const p = perfilAtual(s);
  if (!p || s.fase !== 'pronto') return 0;
  const indice = indiceRotina(s.tarefas, p.id);
  let n = 0;
  indice.series.forEach((serie) => {
    if (serie.recorrente && diasAteAcabar(serie) >= 0 && diasAteAcabar(serie) <= 7) n++;
  });
  return n;
}

function estadoDados(s) {
  if (s.fonte === 'demo') return { classe: 'demo', texto: 'Modo demonstração' };
  if (s.fase === 'erro') return { classe: 'offline', texto: 'API sem resposta' };
  if (s.fase === 'carregando') return { classe: 'carregando', texto: 'Conectando à API' };
  return { classe: 'online', texto: s.sincronizadoEm ? `API · atualizado ${hora(s.sincronizadoEm)}` : 'API conectada' };
}

function pilulaFoco(s) {
  const f = s.foco;
  if (!f || rota.nome === 'foco') return '';
  const t = s.tarefas.find((x) => x.id === f.tarefaId);
  return html`<a class="foco-pilula" href="#/foco?tarefa=${f.tarefaId}" aria-label="Foco em andamento: ${t?.titulo ?? 'item'}">
    <span class="foco-pilula__tempo">${icone(f.pausado ? 'pause' : 'timer', { tamanho: 14 })}<span data-relogio-foco>${relogio(restanteFoco(f))}</span>${f.pausado ? ' · pausado' : ''}</span>
    <span class="foco-pilula__titulo">${t?.titulo ?? 'Foco'}</span>
  </a>`;
}

function desenharLateral(s) {
  const perfil = perfilAtual(s);
  const acabando = habitosAcabando(s);
  const est = estadoDados(s);
  morph(
    $('[data-lateral]'),
    html`<div class="marca-bloco">
        <a class="marca-link" href="#/hoje" aria-label="${APP.nome}: ir para Hoje">${marca(28)}<span>${APP.nome}</span></a>
        ${perfil
          ? html`<button type="button" class="perfil-troca" data-trocar-perfil aria-haspopup="menu" aria-expanded="false">
              ${inicial(perfil.nome)}
              <span class="perfil-troca__texto"><span class="perfil-troca__nome">${perfil.nome}</span><span class="perfil-troca__escopo">Rotina pessoal</span></span>
              ${icone('chevron-down', { tamanho: 16 })}
            </button>`
          : ''}
      </div>
      <nav class="nav" aria-label="Principal">
        <ul>
          ${NAV.filter((n) => n.rota !== 'ajustes').map(
            (n) => html`<li>
              <a class="nav__item${rota.nome === n.rota ? ' ativo' : ''}" href="#/${n.rota}" ${rota.nome === n.rota ? html`aria-current="page"` : ''}>
                ${icone(n.icone, { tamanho: 16 })}<span>${n.rotulo}</span>
                ${n.rota === 'rotina' && acabando ? html`<span class="conta conta--acao" aria-label="${acabando} acabando esta semana">${acabando}</span>` : ''}
              </a>
            </li>`
          )}
        </ul>
      </nav>
      ${pilulaFoco(s)}
      <div class="lateral__rodape">
        <a class="nav__item${rota.nome === 'ajustes' ? ' ativo' : ''}" href="#/ajustes" ${rota.nome === 'ajustes' ? html`aria-current="page"` : ''}>${icone('settings', { tamanho: 16 })}<span>Ajustes</span></a>
        <div class="estado-dados ${est.classe}" role="status">
          <span class="estado-dados__ponto" aria-hidden="true"></span>
          <span>${est.texto}</span>
          <button type="button" class="botao-icone botao-icone--p${s.sincronizando ? ' girando' : ''}" data-sincronizar aria-label="Sincronizar agora" data-dica="Sincronizar">${icone('refresh-cw', { tamanho: 15 })}</button>
        </div>
      </div>`
  );
}

function desenharTopo(s) {
  morph(
    $('[data-topo]'),
    html`<a class="marca-link" href="#/hoje" aria-label="${APP.nome}: ir para Hoje">${marca(26)}<span>${APP.nome}</span></a>
      <div class="topo__fim">
        ${pilulaFoco(s)}
        <button type="button" class="botao-icone${s.sincronizando ? ' girando' : ''}" data-sincronizar aria-label="Sincronizar agora">${icone('refresh-cw', { tamanho: 18 })}</button>
        ${rota.nome === 'hoje' && perfilAtual(s) ? html`<button type="button" class="botao-icone" data-focar-adicao aria-label="Adicionar à pauta">${icone('plus', { tamanho: 20 })}</button>` : ''}
      </div>`
  );
}

function desenharAbas(s) {
  const acabando = habitosAcabando(s);
  morph(
    $('[data-abas]'),
    html`${NAV.map(
      (n) => html`<a class="aba${rota.nome === n.rota ? ' ativo' : ''}" href="#/${n.rota}" ${rota.nome === n.rota ? html`aria-current="page"` : ''}>
        <span class="aba__icone">${icone(n.icone, { tamanho: 20 })}${n.rota === 'rotina' && acabando ? html`<span class="conta conta--acao" aria-hidden="true">${acabando}</span>` : ''}</span>
        <span>${n.rotulo}</span>
      </a>`
    )}`
  );
}

function desenharFaixa(s) {
  const faixa = $('[data-faixa]');
  if (s.fonte !== 'demo') {
    if (faixa.childElementCount) faixa.replaceChildren();
    return;
  }
  if (faixa.childElementCount) return;
  render(
    faixa,
    html`<aside class="aviso" aria-label="Aviso do modo demonstração">
      <p>Modo demonstração: a rotina de exemplo fica só neste navegador.</p>
      <a class="botao-texto" href="#/ajustes">Conectar à API</a>
    </aside>`
  );
}

function esqueleto() {
  // carregando: a disposição do Hoje, com blocos cinza no lugar dos dados (sem brilho animado)
  return html`<div class="tela esqueleto" aria-busy="true" aria-label="Carregando a rotina">
    <div class="esq" style="height:48px;max-width:560px"></div>
    <div class="esq" style="height:20px;max-width:380px;margin-top:12px"></div>
    <div class="esq" style="height:64px;margin-top:40px;border-radius:22px"></div>
    <div class="esq" style="height:112px;margin-top:16px;border-radius:22px"></div>
    <div class="esq" style="height:360px;margin-top:16px;border-radius:22px"></div>
  </div>`;
}

// ------------------------------------------------------------------ rotas e telas

let rota = { nome: 'hoje', query: {} };
let tela = null; // { nome, instancia }

function desmontarTela() {
  tela?.instancia?.destruir?.();
  tela = null;
}

function renderizar(s, { trocouRota = false } = {}) {
  const def = ROTAS[rota.nome];
  document.title = `${def.titulo} | ${APP.nome}`;
  desenharLateral(s);
  desenharTopo(s);
  desenharAbas(s);
  desenharFaixa(s);

  const precisaDados = rota.nome !== 'ajustes';
  if (precisaDados && s.fase === 'carregando') {
    if (tela?.nome !== '__esqueleto') {
      desmontarTela();
      render(conteudo, esqueleto());
      tela = { nome: '__esqueleto' };
    }
    return;
  }
  if (precisaDados && s.fase === 'erro') {
    if (tela?.nome !== '__erro' || trocouRota) {
      desmontarTela();
      desenharConexao(conteudo, s);
      tela = { nome: '__erro' };
    }
    return;
  }
  if (!tela || tela.nome !== rota.nome || trocouRota) {
    const montar = () => {
      desmontarTela();
      conteudo.replaceChildren();
      const raiz = document.createElement('div');
      raiz.className = 'tela-raiz';
      conteudo.append(raiz);
      tela = { nome: rota.nome, instancia: def.montar(raiz, { query: rota.query, estado: store.get() }) };
    };
    montar();
    return;
  }
  tela.instancia?.atualizar?.(s, rota.query);
}

// ------------------------------------------------------------------ atalhos de teclado

function mostrarAtalhos() {
  abrirModal({ titulo: 'Atalhos de teclado', largura: 'p', conteudo: listaAtalhos() });
}

let prefixoG = 0;
function aoTeclar(e) {
  const digitando = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
  const modalAberto = document.querySelector('dialog[open]');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (!modalAberto) abrirComandos();
    return;
  }
  if (digitando || modalAberto || e.ctrlKey || e.metaKey || e.altKey) return;

  const tecla = e.key.toLowerCase();
  if (Date.now() - prefixoG < 900) {
    prefixoG = 0;
    const destino = { h: 'hoje', p: 'progresso', r: 'rotina', a: 'ajustes', f: 'foco' }[tecla];
    if (destino) {
      e.preventDefault();
      navegar(destino);
    }
    return;
  }
  if (tecla === 'g') {
    prefixoG = Date.now();
    return;
  }
  if (e.key === '?') {
    e.preventDefault();
    mostrarAtalhos();
    return;
  }
  // o resto é da tela aberta (N, setas, T…)
  tela?.instancia?.teclar?.(e);
}

// ------------------------------------------------------------------ foco: o relógio da pílula anda sozinho

setInterval(() => {
  const f = store.get().foco;
  if (!f || f.pausado) return;
  const r = relogio(restanteFoco(f));
  document.querySelectorAll('[data-relogio-foco]').forEach((el) => {
    if (el.textContent !== r) el.textContent = r;
  });
}, 1000);

// ------------------------------------------------------------------ app instalável (PWA)

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js').catch(() => {
    /* sem service worker o app funciona igual, só não abre sem internet */
  });
}
window.addEventListener('beforeinstallprompt', (e) => {
  // guarda o pedido de instalação para o botão "Instalar" em Ajustes
  e.preventDefault();
  window.__pedidoInstalar = e;
  document.dispatchEvent(new CustomEvent('pauta:instalavel'));
});

// ------------------------------------------------------------------ início

function iniciar() {
  iniciarDicas();
  aplicarTema(store.get().tema);
  midiaEscura.addEventListener('change', () => aplicarTema(store.get().tema));

  let temaAtual = store.get().tema;
  store.subscribe((s) => {
    if (s.tema !== temaAtual) {
      temaAtual = s.tema;
      aplicarTema(s.tema);
    }
    renderizar(s);
  });

  iniciarRoteador((nova) => {
    const nome = ROTAS[nova.nome] ? nova.nome : 'hoje';
    if (!ROTAS[nova.nome]) history.replaceState(null, '', '#/hoje');
    const mesmaTela = tela?.nome === nome && tela?.instancia?.aceitaQuery;
    rota = { nome, query: nova.query };
    fecharMenu();
    if (mesmaTela) {
      // trocar o dia no Hoje não remonta a tela: ela só redesenha (e anima)
      renderizar(store.get());
      return;
    }
    renderizar(store.get(), { trocouRota: true });
    window.scrollTo({ top: 0 });
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-sincronizar]')) carregarTudo();
    if (e.target.closest('[data-abrir-busca]')) abrirComandos();
    const troca = e.target.closest('[data-trocar-perfil]');
    if (troca) menuPerfis(troca);
    if (e.target.closest('[data-focar-adicao]')) {
      if (lerRota().nome !== 'hoje') navegar('hoje');
      requestAnimationFrame(() => tela?.instancia?.focarAdicao?.());
    }
    if (e.target.closest('[data-alternar-tema]')) {
      const escuroAgora = document.documentElement.dataset.tema === 'escuro' || (!document.documentElement.dataset.tema && midiaEscura.matches);
      definirTema(escuroAgora ? 'claro' : 'escuro');
    }
  });
  document.addEventListener('keydown', aoTeclar);

  // a barra do topo ganha uma linha quando a página rola (só no celular)
  const topo = $('[data-topo]');
  window.addEventListener('scroll', () => topo.classList.toggle('rolou', window.scrollY > 4), { passive: true });

  // volta para a aba: sincroniza se os dados estiverem velhos e redesenha (o "agora" andou)
  document.addEventListener('visibilitychange', () => {
    const s = store.get();
    if (document.visibilityState !== 'visible' || s.fase !== 'pronto' || document.querySelector('dialog[open]')) return;
    if (!s.sincronizadoEm || Date.now() - s.sincronizadoEm.getTime() > SINCRONIZAR_APOS_MS) carregarTudo();
    else tela?.instancia?.atualizar?.(s, rota.query);
  });
  window.addEventListener('pagehide', efetivarExclusoesPendentes);

  registrarServiceWorker();
  carregarTudo();
}

iniciar();
