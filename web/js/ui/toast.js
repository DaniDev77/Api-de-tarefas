// Notificações curtas (região aria-live: leitores de tela anunciam sem roubar o foco).
//
// Movimento (tudo desligado quando o sistema pede "reduzir movimento"):
// - entram com mola (da direita no computador, de baixo no celular) e saem deslizando;
// - quando uma entra ou sai, as outras deslizam para o novo lugar em vez de pular;
// - dá para arrastar para o lado e soltar para dispensar;
// - efeito 'faiscas' (item feito), 'festa' (dia completo: confete) e 'chamar' (lembrete: a figura balança).
import { html, render } from '../core/html.js';
import { icone } from './icons.js';
import { ehImagem } from './emojis.js';

let regiao;

const MOLA = 'cubic-bezier(0.34, 1.4, 0.64, 1)';
const SUAVE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const calmo = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const celular = () => window.matchMedia('(max-width: 1023px)').matches;

function garantirRegiao() {
  if (regiao) return regiao;
  regiao = document.createElement('section');
  regiao.className = 'toasts';
  regiao.setAttribute('aria-live', 'polite');
  regiao.setAttribute('aria-label', 'Notificações');
  document.body.append(regiao);
  return regiao;
}

const ICONES = { sucesso: 'check', erro: 'triangle-alert', info: 'circle-help', progresso: 'loader-circle' };

// ------------------------------------------------------------------ movimento

/** Onde cada notificação está agora (para deslizar até o novo lugar depois de uma mudança). */
const posicoes = (alvo) => new Map([...alvo.children].map((el) => [el, el.getBoundingClientRect().top]));

/** As notificações que mudaram de lugar deslizam do lugar antigo até o novo. */
function deslizar(alvo, antes) {
  if (calmo()) return;
  for (const el of alvo.children) {
    const de = antes.get(el);
    if (de === undefined) continue;
    const delta = de - el.getBoundingClientRect().top;
    if (Math.abs(delta) > 1) el.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration: 380, easing: MOLA });
  }
}

/** Tira uma notificação da tela e ajeita as que ficaram. */
function remover(el) {
  const alvo = el.parentElement;
  if (!alvo) return;
  const antes = posicoes(alvo);
  el.remove();
  deslizar(alvo, antes);
}

const CORES = ['var(--tom-0)', 'var(--tom-2)', 'var(--tom-3)', 'var(--tom-4)', 'var(--tom-7)', 'var(--acento)'];
const entre = (a, b) => a + Math.random() * (b - a);

/**
 * Partículas que saem de um ponto da notificação.
 * 'faiscas': pontinhos curtos em volta do ícone. 'festa': confete que sobe e cai.
 */
function explodir(origem, tipo) {
  if (calmo() || !origem) return;
  const r = origem.getBoundingClientRect();
  const caixa = document.createElement('div');
  caixa.className = 'confetes';
  caixa.setAttribute('aria-hidden', 'true');
  caixa.style.left = `${r.left + r.width / 2}px`;
  caixa.style.top = `${r.top + r.height / 2}px`;
  const festa = tipo === 'festa';
  const total = festa ? 46 : 12;
  let maior = 0;
  for (let i = 0; i < total; i++) {
    const p = document.createElement('span');
    p.className = `confete${festa && i % 3 ? ' confete--fita' : ''}`;
    p.style.background = CORES[i % CORES.length];
    caixa.append(p);
    if (festa) {
      // sobe em leque e cai girando
      const angulo = entre(-165, -15) * (Math.PI / 180);
      const forca = entre(90, 300);
      const dx = Math.cos(angulo) * forca;
      const dy = Math.sin(angulo) * forca;
      const giro = entre(-540, 540);
      const duracao = entre(1100, 1900);
      maior = Math.max(maior, duracao);
      p.animate(
        [
          { transform: 'translate(0, 0) rotate(0deg) scale(0.4)', opacity: 1, easing: 'cubic-bezier(0.12, 0.8, 0.3, 1)' },
          { transform: `translate(${dx * 0.86}px, ${dy}px) rotate(${giro * 0.5}deg) scale(1)`, opacity: 1, offset: 0.38, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' },
          { transform: `translate(${dx}px, ${dy + entre(180, 320)}px) rotate(${giro}deg) scale(0.9)`, opacity: 0 },
        ],
        { duration: duracao, delay: entre(0, 120), fill: 'both' }
      );
    } else {
      // um anel de pontinhos que se abre e some
      const angulo = (i / total) * Math.PI * 2 + entre(-0.2, 0.2);
      const raio = entre(26, 46);
      const duracao = entre(520, 720);
      maior = Math.max(maior, duracao);
      p.animate(
        [
          { transform: 'translate(0, 0) scale(0.2)', opacity: 1 },
          { transform: `translate(${Math.cos(angulo) * raio}px, ${Math.sin(angulo) * raio}px) scale(1)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${Math.cos(angulo) * raio * 1.25}px, ${Math.sin(angulo) * raio * 1.25}px) scale(0)`, opacity: 0 },
        ],
        { duration: duracao, delay: 180, easing: SUAVE, fill: 'both' }
      );
    }
  }
  document.body.append(caixa);
  setTimeout(() => caixa.remove(), maior + 400);
}

// ------------------------------------------------------------------ a notificação

/**
 * @param {string} mensagem
 * @param {{ tipo?: 'sucesso'|'erro'|'info'|'progresso', duracao?: number, acao?: { rotulo: string, fn: () => void },
 *   detalhe?: string, emoji?: string, efeito?: 'faiscas'|'festa'|'chamar' }} [opcoes]
 *   emoji: aparece no lugar do ícone (enfeite; o texto continua dizendo tudo)
 *   efeito: 'faiscas' = pontinhos em volta do ícone; 'festa' = confete; 'chamar' = a figura balança (lembrete)
 */
export function toast(mensagem, { tipo = 'info', duracao, acao, detalhe, emoji, efeito } = {}) {
  const alvo = garantirRegiao();
  const tempo = duracao ?? (tipo === 'erro' ? 7000 : acao ? 6000 : 3200);
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}${emoji ? ' toast--emoji' : ''}${efeito ? ` toast--${efeito}` : ''}`;
  el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  if (Number.isFinite(tempo)) el.style.setProperty('--duracao', `${tempo}ms`);
  else el.classList.add('toast--fixo');
  render(
    el,
    html`${emoji && ehImagem(emoji) ? html`<span class="toast__icone toast__figura" aria-hidden="true"><img src="${emoji}" alt="" width="36" height="36"></span>` : emoji ? html`<span class="toast__icone toast__emoji" aria-hidden="true">${emoji}</span>` : html`<span class="toast__icone">${icone(ICONES[tipo], { tamanho: 16 })}</span>`}
      <div class="toast__texto">
        <p>${mensagem}</p>
        ${detalhe ? html`<p class="toast__detalhe">${detalhe}</p>` : ''}
      </div>
      ${acao ? html`<button type="button" class="toast__acao">${acao.rotulo}</button>` : ''}
      <button type="button" class="toast__fechar" aria-label="Fechar notificação">${icone('x', { tamanho: 14 })}</button>
      <span class="toast__tempo" aria-hidden="true"></span>`
  );

  let restante = tempo;
  let inicio = Date.now();
  let timer;
  let fechando = false;

  /** @param {number} [lado] para que lado sai: 1 = direita, -1 = esquerda, 0 = padrão */
  const fechar = (lado = 0) => {
    if (fechando) return;
    fechando = true;
    clearTimeout(timer);
    el.classList.add('saindo');
    if (calmo() || !el.animate) return remover(el);
    const partida = el.style.transform || 'none';
    const destino = lado ? `translateX(${lado * 120}%)` : celular() ? 'translateY(18px) scale(0.96)' : 'translateX(56px) scale(0.96)';
    const saida = el.animate([{ opacity: getComputedStyle(el).opacity, transform: partida }, { opacity: 0, transform: destino }], { duration: 220, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' });
    saida.finished.then(() => remover(el)).catch(() => remover(el));
    setTimeout(() => remover(el), 500); // garantia
  };
  const agendar = () => {
    inicio = Date.now();
    clearTimeout(timer);
    // notificação de progresso (duração infinita) só fecha quando o lote termina
    if (Number.isFinite(restante)) timer = setTimeout(() => fechar(), restante);
  };
  // pausa enquanto o mouse, o foco ou o dedo estiverem na notificação
  let pausas = 0;
  const pausar = () => {
    if (pausas++ > 0) return;
    clearTimeout(timer);
    restante -= Date.now() - inicio;
    el.classList.add('pausado');
  };
  const retomar = () => {
    pausas = Math.max(0, pausas - 1);
    if (pausas || fechando) return;
    el.classList.remove('pausado');
    agendar();
  };
  el.addEventListener('mouseenter', pausar);
  el.addEventListener('mouseleave', retomar);
  el.addEventListener('focusin', pausar);
  el.addEventListener('focusout', retomar);
  el.querySelector('.toast__fechar').addEventListener('click', () => fechar());
  el.querySelector('.toast__acao')?.addEventListener('click', () => {
    acao.fn();
    fechar();
  });

  // ----- arrastar para o lado dispensa (no computador, para a direita; no celular, para os dois lados)
  let arrasto = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button') || fechando) return;
    arrasto = { x: e.clientX, dx: 0, andou: false, id: e.pointerId };
  });
  el.addEventListener('pointermove', (e) => {
    if (!arrasto || e.pointerId !== arrasto.id) return;
    let dx = e.clientX - arrasto.x;
    if (!arrasto.andou) {
      if (Math.abs(dx) < 8) return;
      arrasto.andou = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('arrastando');
      pausar();
    }
    if (dx < 0 && !celular()) dx *= 0.18; // para a esquerda só cede um pouco
    arrasto.dx = dx;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 60}deg)`;
    el.style.opacity = String(1 - Math.min(Math.abs(dx) / 260, 0.65));
  });
  const soltar = (e) => {
    if (!arrasto || e.pointerId !== arrasto.id) return;
    const { dx, andou } = arrasto;
    arrasto = null;
    if (!andou) return;
    el.classList.remove('arrastando');
    if (Math.abs(dx) > 96 && (dx > 0 || celular())) return fechar(Math.sign(dx));
    // não foi longe: volta com mola
    const de = el.style.transform;
    el.style.transform = '';
    el.style.opacity = '';
    if (!calmo()) el.animate([{ transform: de }, { transform: 'none' }], { duration: 420, easing: MOLA });
    retomar();
  };
  el.addEventListener('pointerup', soltar);
  el.addEventListener('pointercancel', soltar);

  // ----- entra: as outras abrem espaço e esta chega com mola
  const antes = posicoes(alvo);
  alvo.append(el);
  // no máximo 4 na tela
  while (alvo.children.length > 4) alvo.firstElementChild.remove();
  deslizar(alvo, antes);
  if (!calmo() && el.animate) {
    el.animate([{ opacity: 0, transform: celular() ? 'translateY(28px) scale(0.92)' : 'translateX(64px) scale(0.92)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: MOLA });
    if (tipo === 'erro') el.animate({ transform: ['none', 'translateX(-7px)', 'translateX(6px)', 'translateX(-4px)', 'translateX(3px)', 'none'] }, { duration: 420, delay: 420, easing: 'ease-out' });
    if (efeito === 'faiscas' || efeito === 'festa') setTimeout(() => el.isConnected && explodir(el.querySelector('.toast__icone'), efeito), efeito === 'festa' ? 260 : 120);
  }
  agendar();

  // a função devolvida fecha a notificação; .atualizar(texto) troca a mensagem (progresso de um lote)
  const controle = () => fechar();
  controle.atualizar = (texto) => {
    const p = el.querySelector('.toast__texto p');
    if (p) p.textContent = texto;
  };
  controle.agendar = (ms = 3200) => {
    restante = ms;
    el.classList.remove('toast--fixo');
    el.style.setProperty('--duracao', `${ms}ms`);
    agendar();
  };
  return controle;
}
