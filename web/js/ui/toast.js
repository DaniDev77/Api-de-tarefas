// Notificações curtas (região aria-live: leitores de tela anunciam sem roubar o foco).
import { html, render } from '../core/html.js';
import { icone } from './icons.js';

let regiao;

function garantirRegiao() {
  if (regiao) return regiao;
  regiao = document.createElement('section');
  regiao.className = 'toasts';
  regiao.setAttribute('aria-live', 'polite');
  regiao.setAttribute('aria-label', 'Notificações');
  document.body.append(regiao);
  return regiao;
}

const ICONES = { sucesso: 'check', erro: 'triangle-alert', info: 'circle-help' };

/**
 * @param {string} mensagem
 * @param {{ tipo?: 'sucesso'|'erro'|'info', duracao?: number, acao?: { rotulo: string, fn: () => void }, detalhe?: string }} [opcoes]
 */
export function toast(mensagem, { tipo = 'info', duracao, acao, detalhe } = {}) {
  const alvo = garantirRegiao();
  const tempo = duracao ?? (tipo === 'erro' ? 7000 : acao ? 6000 : 3200);
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  el.style.setProperty('--duracao', `${tempo}ms`);
  render(
    el,
    html`<span class="toast__icone">${icone(ICONES[tipo], { tamanho: 16 })}</span>
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
  const fechar = () => {
    clearTimeout(timer);
    el.classList.add('saindo');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400); // garantia se animações estiverem desligadas
  };
  const agendar = () => {
    inicio = Date.now();
    timer = setTimeout(fechar, restante);
  };
  // pausa enquanto o mouse ou o foco estiverem na notificação
  const pausar = () => {
    clearTimeout(timer);
    restante -= Date.now() - inicio;
    el.classList.add('pausado');
  };
  const retomar = () => {
    el.classList.remove('pausado');
    agendar();
  };
  el.addEventListener('mouseenter', pausar);
  el.addEventListener('mouseleave', retomar);
  el.addEventListener('focusin', pausar);
  el.addEventListener('focusout', retomar);
  el.querySelector('.toast__fechar').addEventListener('click', fechar);
  el.querySelector('.toast__acao')?.addEventListener('click', () => {
    acao.fn();
    fechar();
  });

  alvo.append(el);
  // no máximo 4 na tela
  while (alvo.children.length > 4) alvo.firstElementChild.remove();
  agendar();
  return fechar;
}
