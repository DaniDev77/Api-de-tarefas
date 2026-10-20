// Peças pequenas reutilizadas em todas as telas (avatar, selos de status/prioridade, prazo).
// Regra: a cor nunca carrega significado sozinha — sempre vem com ícone e/ou texto.
import { html, raw } from '../core/html.js';
import { iniciais, prazoRelativo, diaMes } from '../core/format.js';
import { STATUS_INFO, PRIORIDADE_INFO, corCategoria, tomAvatar, estaAberta } from '../domain/enums.js';
import { iconeStatus, iconePrioridade, icone } from './icons.js';

export function avatar(usuario, { tamanho = 'm', dica = true } = {}) {
  if (!usuario) return html`<span class="avatar avatar--${tamanho} avatar--vazio" aria-hidden="true">?</span>`;
  return html`<span class="avatar avatar--${tamanho} tom-${tomAvatar(usuario)}" ${dica ? html`data-dica="${usuario.nome}"` : ''} aria-label="${usuario.nome}" role="img">${iniciais(usuario.nome)}</span>`;
}

export function seloStatus(status, { curto = false } = {}) {
  const info = STATUS_INFO[status] ?? STATUS_INFO[1];
  return html`<span class="selo-status s${info.valor}">${raw(iconeStatus(info.valor, 14))}<span>${curto ? info.curto : info.rotulo}</span></span>`;
}

export function seloPrioridade(prioridade, { soIcone = false } = {}) {
  const info = PRIORIDADE_INFO[prioridade] ?? PRIORIDADE_INFO[2];
  if (soIcone) {
    return html`<span class="selo-prio p${info.valor}" data-dica="Prioridade ${info.rotulo.toLowerCase()}" aria-label="Prioridade ${info.rotulo.toLowerCase()}" role="img">${raw(iconePrioridade(info.valor, 16))}</span>`;
  }
  return html`<span class="selo-prio p${info.valor}">${raw(iconePrioridade(info.valor, 14))}<span>${info.rotulo}</span></span>`;
}

export function seloCategoria(categoria) {
  if (!categoria) return html`<span class="selo-cat selo-cat--vazia">Sem categoria</span>`;
  return html`<span class="selo-cat" style="--cor:${corCategoria(categoria)}"><span class="selo-cat__ponto" aria-hidden="true"></span>${categoria.nome}</span>`;
}

export function prazo(tarefa, { comIcone = true } = {}) {
  const aberta = estaAberta(tarefa);
  // tarefa concluída ou cancelada: o prazo vira só uma data, sem "atrasada"
  const p = aberta ? prazoRelativo(tarefa.dataLimite) : { texto: tarefa.dataLimite ? diaMes(tarefa.dataLimite) : 'Sem prazo', tom: 'normal' };
  const icn = p.tom === 'atrasada' ? 'triangle-alert' : 'calendar';
  return html`<span class="prazo prazo--${p.tom}">${comIcone ? raw(icone(icn, { tamanho: 14 })) : ''}<span>${p.texto}</span></span>`;
}

/** Estado vazio com direção clara (o que fazer a seguir). */
export function vazio({ titulo, texto, acao }) {
  return html`<div class="vazio">
    <svg class="vazio__ilustracao" viewBox="0 0 120 80" aria-hidden="true">
      <rect x="10" y="6" width="100" height="68" rx="8" fill="var(--folha)" stroke="var(--pauta-forte)" stroke-width="1.5"/>
      <path d="M28 6v68" stroke="var(--margem)" stroke-width="1.5" opacity=".7"/>
      <path d="M36 26h56M36 40h56M36 54h34" stroke="var(--pauta-forte)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <h3 class="vazio__titulo">${titulo}</h3>
    ${texto ? html`<p class="vazio__texto">${texto}</p>` : ''}
    ${acao ?? ''}
  </div>`;
}

/**
 * Linha de título de cada tela: o nome (h1), uma frase sobre os dados e a ação principal.
 * @param {{ titulo: any, sub?: any, acoes?: any, saudacao?: boolean }} opcoes
 */
export function tituloTela({ titulo, sub = '', acoes = '', saudacao = false }) {
  return html`<header class="titulo-tela${saudacao ? ' titulo-tela--saudacao' : ''}">
    <div class="titulo-tela__texto">
      <h1 class="titulo-tela__h1">${titulo}</h1>
      <p class="titulo-tela__sub" data-titulo-sub>${sub}</p>
    </div>
    ${acoes ? html`<div class="titulo-tela__acoes">${acoes}</div>` : ''}
  </header>`;
}

export const botaoNovaTarefa = () =>
  html`<button type="button" class="botao botao--primario" data-nova-tarefa>${icone('plus', { tamanho: 16 })}Nova tarefa</button>`;
