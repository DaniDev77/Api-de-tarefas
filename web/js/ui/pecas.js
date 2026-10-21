// Peças pequenas reutilizadas em todas as telas.
// Regra: a cor nunca carrega significado sozinha; sempre vem com texto ao lado.
import { html, raw } from '../core/html.js';
import { iniciais } from '../core/format.js';
import { tomArea } from '../domain/enums.js';

/** Ponto colorido da área (o tom é a identidade da área). */
export const ponto = (categoriaId) => html`<span class="ponto tom-${tomArea(categoriaId)}" aria-hidden="true"></span>`;

/** Ponto + nome da área. */
export function areaNome(categoria) {
  if (!categoria) return html`<span class="area-nome">Sem área</span>`;
  return html`<span class="area-nome">${ponto(categoria.id)}${categoria.nome}</span>`;
}

export const inicial = (nome) => html`<span class="inicial" aria-hidden="true">${iniciais(nome)}</span>`;

/**
 * Anel de progresso (fração de 0 a 1). null = nada na pauta (só o trilho).
 * O traço começa às 12h e corre no sentido do relógio.
 */
export function anel(fracao, { tamanho = 28, espessura = 3, rotulo = '' } = {}) {
  const r = (tamanho - espessura) / 2;
  const c = 2 * Math.PI * r;
  const cheio = fracao === null || fracao === undefined ? 0 : Math.max(0, Math.min(1, fracao));
  const a11y = rotulo ? `role="img" aria-label="${rotulo}"` : 'aria-hidden="true"';
  return raw(`<svg class="anel${cheio === 1 ? ' anel--cheio' : ''}" width="${tamanho}" height="${tamanho}" viewBox="0 0 ${tamanho} ${tamanho}" ${a11y}>
    <circle class="anel__trilho" cx="${tamanho / 2}" cy="${tamanho / 2}" r="${r}" fill="none" stroke-width="${espessura}"/>
    <circle class="anel__feito" cx="${tamanho / 2}" cy="${tamanho / 2}" r="${r}" fill="none" stroke-width="${espessura}" stroke-linecap="round" style="stroke-dasharray:${(c * cheio).toFixed(2)} ${c.toFixed(2)}${cheio === 0 ? ';opacity:0' : ''}" transform="rotate(-90 ${tamanho / 2} ${tamanho / 2})"/>
  </svg>`);
}

/**
 * Linha de título das telas (exceto Hoje, que abre com a saudação): o nome (h1), uma frase
 * sobre os dados e as ações reais da tela.
 */
export function tituloTela({ titulo, sub = '', acoes = '' }) {
  return html`<header class="titulo-tela">
    <div class="titulo-tela__texto">
      <h1 class="titulo-tela__h1">${titulo}</h1>
      ${sub ? html`<p class="titulo-tela__sub">${sub}</p>` : ''}
    </div>
    ${acoes ? html`<div class="titulo-tela__acoes">${acoes}</div>` : ''}
  </header>`;
}

/** "1 dia", "12 dias", "3 vezes" */
export const contagem = (n, [um, varios]) => `${n} ${n === 1 ? um : varios}`;

/** Sequência de um hábito: "—", "1 dia", "12 dias seguidos", "5 vezes seguidas". */
export function textoSequencia(n, unidade) {
  if (!n) return '—';
  if (n === 1) return `1 ${unidade[0]}`;
  return `${n} ${unidade[1]} ${unidade[0] === 'dia' ? 'seguidos' : 'seguidas'}`;
}
