// Lista: todas as tarefas em tabela, com ordenação por coluna e troca rápida de status.
import { html, raw, render, morph } from '../core/html.js';
import { medir, animarMudancas } from '../core/animar.js';
import { ler, gravar } from '../core/storage.js';
import { plural, diaMes } from '../core/format.js';
import { LISTA_STATUS, STATUS_INFO } from '../domain/enums.js';
import { filtrarTarefas, porId, estaAtrasada } from '../domain/selectors.js';
import { icone, iconeStatus } from '../ui/icons.js';
import { avatar, seloStatus, seloPrioridade, seloCategoria, prazo, vazio, tituloTela, botaoNovaTarefa } from '../ui/pecas.js';
import { resumo } from '../domain/selectors.js';
import { abrirMenu } from '../ui/menu.js';
import { alterarStatus } from '../state.js';
import { abrirFormTarefa } from '../forms/tarefa-form.js';
import { barraFiltros, ligarFiltros, lerFiltrosDaQuery } from './filtros.js';
import { menuTarefa } from './quadro.js';

const COLUNAS = [
  { chave: 'titulo', rotulo: 'Tarefa' },
  { chave: 'status', rotulo: 'Status' },
  { chave: 'prioridade', rotulo: 'Prioridade' },
  { chave: 'dataLimite', rotulo: 'Prazo' },
  { chave: 'pessoa', rotulo: 'Responsável' },
  { chave: 'categoria', rotulo: 'Categoria' },
  { chave: 'dataCriacao', rotulo: 'Criada' },
];

function comparador(chave, direcao, pessoas, cats) {
  const fator = direcao === 'desc' ? -1 : 1;
  const valor = (t) => {
    switch (chave) {
      case 'titulo':
        return t.titulo.toLocaleLowerCase('pt-BR');
      case 'pessoa':
        return pessoas.get(t.usuarioId)?.nome ?? '';
      case 'categoria':
        return cats.get(t.categoriaId)?.nome ?? '';
      case 'dataLimite':
      case 'dataCriacao':
        return t[chave]?.getTime() ?? 0;
      default:
        return t[chave];
    }
  };
  return (a, b) => {
    const va = valor(a);
    const vb = valor(b);
    const r = typeof va === 'string' ? va.localeCompare(vb, 'pt-BR') : va - vb;
    return r * fator || a.id - b.id;
  };
}

export default {
  titulo: 'Lista',
  montar(raiz, { query, estado }) {
    let filtros = lerFiltrosDaQuery(query);
    let ordem = ler('lista:ordem', { chave: 'dataLimite', direcao: 'asc' });
    let ultimoEstado = estado;
    let animarOrdem = false;

    render(
      raiz,
      html`<div class="tela tela--lista">
        ${tituloTela({ titulo: 'Lista', acoes: botaoNovaTarefa() })}
        ${barraFiltros({ filtros, usuarios: estado.usuarios, categorias: estado.categorias, comStatus: true })}
        <div class="tabela-moldura" data-tabela></div>
      </div>`
    );
    const alvo = raiz.querySelector('[data-tabela]');

    const desenhar = (s = ultimoEstado) => {
      ultimoEstado = s;
      const pessoas = porId(s.usuarios);
      const cats = porId(s.categorias);
      const linhas = filtrarTarefas(s.tarefas, filtros, s).sort(comparador(ordem.chave, ordem.direcao, pessoas, cats));
      const r = resumo(s.tarefas);
      raiz.querySelector('[data-titulo-sub]').textContent = s.tarefas.length
        ? `${plural(s.tarefas.length, 'tarefa', 'tarefas')} no total, ${r.concluidas} concluída${r.concluidas === 1 ? '' : 's'}${r.atrasadas ? ` e ${r.atrasadas} atrasada${r.atrasadas > 1 ? 's' : ''}` : ''}.`
        : '';

      if (!s.tarefas.length) {
        morph(
          alvo,
          vazio({
            titulo: 'A lista está vazia',
            texto: 'As tarefas criadas aparecem aqui, com prazo, responsável e categoria.',
            acao: html`<button type="button" class="botao botao--primario" data-nova>${raw(icone('plus', { tamanho: 16 }))}Nova tarefa</button>`,
          })
        );
        return;
      }

      // FLIP só quando a ordenação muda (as linhas deslizam até a nova posição)
      const antes = animarOrdem ? medir(alvo, 'tbody tr[data-id]') : new Map();
      animarOrdem = false;
      morph(
        alvo,
        html`<table class="tabela">
          <caption class="sr-only">Tarefas, ordenadas por ${COLUNAS.find((c) => c.chave === ordem.chave)?.rotulo}</caption>
          <thead>
            <tr>
              ${COLUNAS.map((c) => {
                const ativa = ordem.chave === c.chave;
                const sort = ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none';
                return html`<th scope="col" aria-sort="${sort}" class="col-${c.chave}">
                  <button type="button" class="tabela__ordenar${ativa ? ' ativa' : ''}" data-ordenar="${c.chave}">
                    ${c.rotulo}${raw(icone(ativa ? (ordem.direcao === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down', { tamanho: 13 }))}
                  </button>
                </th>`;
              })}
              <th scope="col" class="col-acoes"><span class="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            ${linhas.length
              ? linhas.map((t) => {
                  const pessoa = pessoas.get(t.usuarioId);
                  return html`<tr data-id="${t.id}" data-key="t${t.id}" class="${estaAtrasada(t) ? 'atrasada' : ''}${t.status >= 3 ? ' fechada' : ''}">
                    <td class="col-titulo">
                      <button type="button" class="tabela__titulo" data-abrir="${t.id}">${t.titulo}</button>
                      ${t.descricao ? html`<span class="tabela__descricao">${t.descricao}</span>` : ''}
                    </td>
                    <td class="col-status" data-rotulo="Status"><button type="button" class="botao-selo" data-status-tarefa="${t.id}" aria-haspopup="menu" aria-label="Status: ${STATUS_INFO[t.status].rotulo}. Alterar">${seloStatus(t.status)}</button></td>
                    <td class="col-prioridade" data-rotulo="Prioridade">${seloPrioridade(t.prioridade)}</td>
                    <td class="col-dataLimite" data-rotulo="Prazo">${prazo(t)}</td>
                    <td class="col-pessoa" data-rotulo="Responsável"><span class="pessoa-linha">${avatar(pessoa, { tamanho: 'p', dica: false })}<span>${pessoa?.nome ?? '—'}</span></span></td>
                    <td class="col-categoria" data-rotulo="Categoria">${seloCategoria(cats.get(t.categoriaId))}</td>
                    <td class="col-dataCriacao num" data-rotulo="Criada">${t.dataCriacao ? diaMes(t.dataCriacao) : ''}</td>
                    <td class="col-acoes"><button type="button" class="botao-icone botao-icone--p" data-menu-tarefa="${t.id}" aria-label="Ações da tarefa ${t.titulo}" aria-haspopup="menu">${raw(icone('ellipsis', { tamanho: 16 }))}</button></td>
                  </tr>`;
                })
              : html`<tr><td colspan="${COLUNAS.length + 1}" class="tabela__nada">Nenhuma tarefa com esses filtros.</td></tr>`}
          </tbody>
        </table>
        <p class="tabela__rodape">${plural(linhas.length, 'tarefa', 'tarefas')}${linhas.length !== s.tarefas.length ? ` de ${s.tarefas.length}` : ''}</p>`
      );
      animarMudancas(alvo, 'tbody tr[data-id]', antes, { duracao: 260 });
    };

    const controleFiltros = ligarFiltros(raiz, filtros, (f) => {
      filtros = f;
      desenhar();
    });

    alvo.addEventListener('click', (e) => {
      const ordenar = e.target.closest('[data-ordenar]');
      if (ordenar) {
        const chave = ordenar.dataset.ordenar;
        ordem = { chave, direcao: ordem.chave === chave && ordem.direcao === 'asc' ? 'desc' : 'asc' };
        gravar('lista:ordem', ordem);
        animarOrdem = true;
        desenhar();
        alvo.querySelector(`[data-ordenar="${chave}"]`)?.focus();
        return;
      }
      const statusBtn = e.target.closest('[data-status-tarefa]');
      if (statusBtn) {
        const t = ultimoEstado.tarefas.find((x) => x.id === Number(statusBtn.dataset.statusTarefa));
        abrirMenu(
          statusBtn,
          LISTA_STATUS.map((st) => ({
            rotulo: st.rotulo,
            iconeHtml: iconeStatus(st.valor, 16),
            atual: st.valor === t.status,
            acao: () => alterarStatus(t.id, st.valor).catch(() => {}),
          })),
          { alinhar: 'inicio' }
        );
        return;
      }
      const menuBtn = e.target.closest('[data-menu-tarefa]');
      if (menuBtn) {
        const t = ultimoEstado.tarefas.find((x) => x.id === Number(menuBtn.dataset.menuTarefa));
        if (t) menuTarefa(menuBtn, t);
        return;
      }
      if (e.target.closest('[data-nova]')) {
        abrirFormTarefa();
        return;
      }
      const linha = e.target.closest('tr[data-id]');
      if (linha && !e.target.closest('button, a')) {
        abrirFormTarefa({ tarefa: ultimoEstado.tarefas.find((x) => x.id === Number(linha.dataset.id)) });
        return;
      }
      const abrir = e.target.closest('[data-abrir]');
      if (abrir) abrirFormTarefa({ tarefa: ultimoEstado.tarefas.find((x) => x.id === Number(abrir.dataset.abrir)) });
    });

    desenhar(estado);
    return {
      atualizar(s) {
        controleFiltros.atualizarOpcoes(s.usuarios, s.categorias);
        desenhar(s);
      },
      focarBusca: () => controleFiltros.focarBusca(),
    };
  },
};

