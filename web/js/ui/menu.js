// Menu suspenso ancorado em um botão: setas navegam, Enter escolhe, Esc fecha, clique fora fecha.
import { html, render } from '../core/html.js';
import { icone } from './icons.js';

let menuAberto = null;

export function fecharMenu() {
  if (!menuAberto) return;
  const { el, ancora, limpar } = menuAberto;
  menuAberto = null;
  limpar();
  el.remove();
  ancora?.setAttribute('aria-expanded', 'false');
}

/**
 * @param {HTMLElement} ancora
 * @param {Array<{ rotulo?: string, icone?: string, iconeHtml?: any, acao?: () => void, perigo?: boolean, atual?: boolean, separador?: boolean, titulo?: string }>} itens
 */
export function abrirMenu(ancora, itens, { alinhar = 'fim' } = {}) {
  const reabrindo = menuAberto?.ancora === ancora;
  fecharMenu();
  if (reabrindo) return;

  const el = document.createElement('div');
  el.className = 'menu';
  el.setAttribute('role', 'menu');
  render(
    el,
    itens.map((item, i) => {
      if (item.separador) return html`<div class="menu__separador" role="separator"></div>`;
      if (item.titulo) return html`<div class="menu__titulo" role="presentation">${item.titulo}</div>`;
      return html`<button type="button" role="menuitem" class="menu__item${item.perigo ? ' menu__item--perigo' : ''}${item.atual ? ' menu__item--atual' : ''}" data-i="${i}" ${item.atual ? html`aria-current="true"` : ''}>
        <span class="menu__icone">${item.iconeHtml ?? (item.icone ? icone(item.icone, { tamanho: 16 }) : '')}</span>
        <span>${item.rotulo}</span>
        ${item.atual ? html`<span class="menu__check">${icone('check', { tamanho: 14 })}</span>` : ''}
      </button>`;
    })
  );
  // dentro do <main>: o menu pertence a uma região da página (leitores de tela e axe)
  (document.querySelector('main') ?? document.body).append(el);

  // posicionamento: abaixo da âncora; se não couber, acima
  const r = ancora.getBoundingClientRect();
  const m = el.getBoundingClientRect();
  let top = r.bottom + 6;
  if (top + m.height > innerHeight - 8) top = Math.max(8, r.top - m.height - 6);
  let left = alinhar === 'fim' ? r.right - m.width : r.left;
  left = Math.min(Math.max(8, left), innerWidth - m.width - 8);
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;

  const botoes = () => [...el.querySelectorAll('.menu__item')];
  const aoClicar = (e) => {
    const b = e.target.closest('.menu__item');
    if (!b) return;
    const item = itens[Number(b.dataset.i)];
    fecharMenu();
    ancora.focus({ preventScroll: true });
    item.acao?.();
  };
  const aoTeclar = (e) => {
    const lista = botoes();
    const i = lista.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      lista[(i + 1) % lista.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      lista[(i - 1 + lista.length) % lista.length]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      fecharMenu();
      ancora.focus({ preventScroll: true });
    } else if (e.key === 'Tab') {
      fecharMenu();
    }
  };
  const aoClicarFora = (e) => {
    if (!el.contains(e.target) && !ancora.contains(e.target)) fecharMenu();
  };
  const aoRolar = (e) => {
    if (!el.contains(e.target)) fecharMenu();
  };

  el.addEventListener('click', aoClicar);
  el.addEventListener('keydown', aoTeclar);
  document.addEventListener('pointerdown', aoClicarFora, true);
  window.addEventListener('scroll', aoRolar, true);
  window.addEventListener('resize', fecharMenu);

  ancora.setAttribute('aria-expanded', 'true');
  menuAberto = {
    el,
    ancora,
    limpar: () => {
      document.removeEventListener('pointerdown', aoClicarFora, true);
      window.removeEventListener('scroll', aoRolar, true);
      window.removeEventListener('resize', fecharMenu);
    },
  };
  (el.querySelector('.menu__item--atual') || botoes()[0])?.focus({ preventScroll: true });
}
