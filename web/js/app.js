// Ponto de entrada: monta a estrutura da página, liga rotas, atalhos e o ciclo de sincronização.
import { html, raw, render, morph } from './core/html.js';
import { iniciarRoteador, navegar } from './core/router.js';
import { plural } from './core/format.js';
import { APP, SINCRONIZAR_APOS_MS } from './config.js';
import { store, carregarTudo, definirTema, definirFonte, efetivarExclusoesPendentes, nomeEquipe } from './state.js';
import { resumo } from './domain/selectors.js';
import { icone, marca } from './ui/icons.js';
import { iniciarDicas } from './ui/tooltip.js';
import { abrirModal } from './ui/modal.js';
import { fecharMenu } from './ui/menu.js';
import { abrirComandos } from './ui/comandos.js';
import { abrirFormTarefa } from './forms/tarefa-form.js';
import { desenharConexao } from './views/conexao.js';
import painel from './views/painel.js';
import quadro from './views/quadro.js';
import lista from './views/lista.js';
import equipe from './views/equipe.js';
import categorias from './views/categorias.js';
import configuracoes, { listaAtalhos } from './views/configuracoes.js';

const ROTAS = { painel, quadro, lista, equipe, categorias, configuracoes };
const NAV = [
  { rota: 'painel', rotulo: 'Painel', icone: 'layout-dashboard' },
  { rota: 'quadro', rotulo: 'Quadro', icone: 'square-kanban' },
  { rota: 'lista', rotulo: 'Lista', icone: 'list' },
  { rota: 'equipe', rotulo: 'Equipe', icone: 'users' },
  { rota: 'categorias', rotulo: 'Categorias', icone: 'tag' },
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
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#0E1122' : '#F4F6FB');
}

// ------------------------------------------------------------------ estrutura (lateral + topo)

function desenharLateral(s, rotaAtiva) {
  const r = resumo(s.tarefas);
  const equipe = nomeEquipe(s);
  const status =
    s.fonte === 'demo'
      ? { classe: 'demo', texto: 'Modo demonstração' }
      : s.fase === 'erro'
        ? { classe: 'offline', texto: 'API sem resposta' }
        : s.fase === 'carregando'
          ? { classe: 'carregando', texto: 'Conectando à API' }
          : { classe: 'online', texto: 'API conectada' };

  // morph: só o que mudou é alterado, então foco e hover continuam onde estavam
  const lateral = $('[data-lateral]');
  morph(
    lateral,
    html`<a class="marca-link" href="#/painel" aria-label="${APP.nome}${equipe ? `, ${equipe}` : ''}: ir para o painel">${marca(30)}<span class="marca-nome">${APP.nome}</span><span class="marca-escopo">${equipe || 'Tarefas da equipe'}</span></a>
      <nav class="nav" aria-label="Principal">
        <ul>
          ${NAV.map(
            (n) => html`<li>
              <a class="nav__item${rotaAtiva === n.rota ? ' ativo' : ''}" href="#/${n.rota}" ${rotaAtiva === n.rota ? html`aria-current="page"` : ''}>
                ${icone(n.icone, { tamanho: 16 })}<span>${n.rotulo}</span>
              </a>
            </li>`
          )}
        </ul>
        ${s.fase === 'pronto' && r.atrasadas
          ? html`<a class="nav__alerta" href="#/quadro?atrasadas=1">${raw(icone('triangle-alert', { tamanho: 15 }))}${plural(r.atrasadas, 'tarefa atrasada', 'tarefas atrasadas')}</a>`
          : ''}
      </nav>
      <div class="lateral__rodape">
        <a class="nav__item${rotaAtiva === 'configuracoes' ? ' ativo' : ''}" href="#/configuracoes" ${rotaAtiva === 'configuracoes' ? html`aria-current="page"` : ''}>
          ${icone('settings', { tamanho: 16 })}<span>Configurações</span>
        </a>
        <div class="conexao-status ${status.classe}" role="status">
          <span class="conexao-status__ponto" aria-hidden="true"></span>
          <span>${status.texto}</span>
        </div>
      </div>`
  );
}

function desenharTopo(s, titulo) {
  document.title = `${titulo} | ${APP.nome}`;
  const marcaTopo = $('[data-topo-marca]');
  if (!marcaTopo.childElementCount) render(marcaTopo, html`${marca(26)}<span class="marca-nome">${APP.nome}</span>`);
  const sinc = $('[data-sincronizar]');
  sinc.classList.toggle('girando', s.sincronizando);
  sinc.disabled = s.sincronizando;
  const faixa = $('[data-faixa-demo]');
  faixa.hidden = s.fonte !== 'demo';
}

function esqueleto() {
  // carregando: a mesma disposição do painel, com blocos cinza no lugar dos dados (sem brilho animado)
  return html`<div class="tela coluna-central esqueleto" aria-busy="true" aria-label="Carregando dados">
    <div class="esq esq--titulo"></div>
    <div class="grade">
      <div class="esq esq--regua span-12"></div>
      <div class="esq esq--numero span-3"></div>
      <div class="esq esq--numero span-3"></div>
      <div class="esq esq--numero span-3"></div>
      <div class="esq esq--numero span-3"></div>
      <div class="esq esq--bloco span-9"></div>
      <div class="esq esq--bloco span-3"></div>
    </div>
  </div>`;
}

// ------------------------------------------------------------------ rotas e telas

let rota = { nome: 'painel', query: {} };
let tela = null; // { nome, instancia }
let montagemPendente = null;

function desmontarTela() {
  tela?.instancia?.destruir?.();
  tela = null;
}

function comTransicao(fn) {
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.startViewTransition && !reduzido && tela) document.startViewTransition(fn);
  else fn();
}

function renderizar(s, { trocouRota = false } = {}) {
  const def = ROTAS[rota.nome];
  desenharLateral(s, rota.nome);
  desenharTopo(s, def.titulo);
  document.body.classList.toggle('sincronizando', s.sincronizando && s.fase === 'pronto');

  const precisaDados = rota.nome !== 'configuracoes';
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
    // a transição de página roda de forma assíncrona: evita montar a mesma tela duas vezes
    if (montagemPendente === rota.nome && !trocouRota) return;
    montagemPendente = rota.nome;
    const montar = () => {
      montagemPendente = null;
      desmontarTela();
      conteudo.replaceChildren();
      const raiz = document.createElement('div');
      raiz.className = 'tela-raiz';
      conteudo.append(raiz);
      tela = { nome: rota.nome, instancia: def.montar(raiz, { query: rota.query, estado: store.get() }) };
    };
    comTransicao(montar);
    return;
  }
  tela.instancia?.atualizar?.(s);
}

// ------------------------------------------------------------------ menu lateral no celular

function alternarLateral(abrir) {
  const app = $('[data-app]');
  const aberto = abrir ?? !app.classList.contains('lateral-aberta');
  app.classList.toggle('lateral-aberta', aberto);
  $('[data-abrir-lateral]').setAttribute('aria-expanded', String(aberto));
  if (aberto) $('[data-lateral] .nav__item')?.focus();
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
  if (e.key === 'Escape' && $('[data-app]').classList.contains('lateral-aberta')) {
    alternarLateral(false);
    return;
  }
  if (digitando || modalAberto || e.ctrlKey || e.metaKey || e.altKey) return;

  const tecla = e.key.toLowerCase();
  if (Date.now() - prefixoG < 900) {
    prefixoG = 0;
    const destino = { p: 'painel', q: 'quadro', l: 'lista', e: 'equipe', c: 'categorias' }[tecla];
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
  if (tecla === 'n' && store.get().fase === 'pronto') {
    e.preventDefault();
    abrirFormTarefa();
  } else if (e.key === '/') {
    if (tela?.instancia?.focarBusca) {
      e.preventDefault();
      tela.instancia.focarBusca();
    }
  } else if (e.key === '?') {
    e.preventDefault();
    mostrarAtalhos();
  }
}

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
    const nome = ROTAS[nova.nome] ? nova.nome : 'painel';
    if (!ROTAS[nova.nome]) history.replaceState(null, '', '#/painel');
    rota = { nome, query: nova.query };
    fecharMenu();
    alternarLateral(false);
    renderizar(store.get(), { trocouRota: true });
    conteudo.scrollTop = 0;
    window.scrollTo({ top: 0 });
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-nova-tarefa]')) abrirFormTarefa();
    if (e.target.closest('[data-abrir-busca]')) abrirComandos();
    if (e.target.closest('[data-sincronizar]')) carregarTudo();
    if (e.target.closest('[data-abrir-lateral]')) alternarLateral();
    if (e.target.closest('[data-fechar-lateral]')) alternarLateral(false);
    if (e.target.closest('[data-sair-demo]')) definirFonte('api');
    if (e.target.closest('[data-alternar-tema]')) {
      const escuroAgora = document.documentElement.dataset.tema === 'escuro' || (!document.documentElement.dataset.tema && midiaEscura.matches);
      definirTema(escuroAgora ? 'claro' : 'escuro');
    }
  });
  document.addEventListener('keydown', aoTeclar);

  // volta para a aba: sincroniza se os dados estiverem velhos
  document.addEventListener('visibilitychange', () => {
    const s = store.get();
    if (document.visibilityState === 'visible' && s.fase === 'pronto' && !document.querySelector('dialog[open]')) {
      if (!s.sincronizadoEm || Date.now() - s.sincronizadoEm.getTime() > SINCRONIZAR_APOS_MS) carregarTudo();
    }
  });
  window.addEventListener('pagehide', efetivarExclusoesPendentes);

  carregarTudo();
}

iniciar();
