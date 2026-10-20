// Categorias (CategoriaModel): organização das tarefas por área de trabalho.
import { html, raw, render, morph } from '../core/html.js';
import { plural, porcentagem } from '../core/format.js';
import { corCategoria } from '../domain/enums.js';
import { estatisticasPor } from '../domain/selectors.js';
import { icone } from '../ui/icons.js';
import { vazio, tituloTela } from '../ui/pecas.js';
import { abrirMenu } from '../ui/menu.js';
import { confirmar } from '../ui/modal.js';
import { categorias as acoesCategorias } from '../state.js';
import { abrirFormCategoria } from '../forms/categoria-form.js';

function linha(c, tarefas) {
  const e = estatisticasPor('categoriaId', c.id, tarefas);
  const validas = e.total - e.canceladas;
  return html`<li class="registro registro--categoria" data-id="${c.id}" data-key="c${c.id}" style="--cor:${corCategoria(c)}">
    <span class="registro__cor" aria-hidden="true"></span>
    <div class="registro__principal">
      <h2 class="registro__titulo">${c.nome}</h2>
      <p class="registro__descricao">${c.descricao || 'Sem descrição.'}</p>
    </div>
    <dl class="registro__numeros">
      <div><dt>Abertas</dt><dd>${e.abertas}</dd></div>
      <div class="${e.atrasadas ? 'alerta' : ''}"><dt>Atrasadas</dt><dd>${e.atrasadas}</dd></div>
      <div><dt>Concluídas</dt><dd>${e.concluidas}</dd></div>
    </dl>
    <div class="registro__progresso" data-dica="${e.concluidas} de ${validas} concluídas">
      <span class="medidor__trilho"><span class="medidor__barra" style="--v:${validas ? e.concluidas / validas : 0}"></span></span>
      <span class="registro__pct">${porcentagem(e.concluidas, validas)}%</span>
    </div>
    <div class="registro__acoes">
      <a class="botao botao--fantasma botao--p" href="#/quadro?categoria=${c.id}">Ver tarefas</a>
      <button type="button" class="botao-icone" data-menu="${c.id}" aria-label="Ações da categoria ${c.nome}" aria-haspopup="menu">${raw(icone('ellipsis', { tamanho: 18 }))}</button>
    </div>
  </li>`;
}

export default {
  titulo: 'Categorias',
  montar(raiz, { estado }) {
    let ultimo = estado;
    render(
      raiz,
      html`<div class="tela tela--registros coluna-central">
        ${tituloTela({ titulo: 'Categorias', acoes: html`<button type="button" class="botao botao--primario" data-nova>${icone('folder-plus', { tamanho: 16 })}Nova categoria</button>` })}
        <div data-lista></div>
      </div>`
    );
    const lista = raiz.querySelector('[data-lista]');

    const desenhar = (s = ultimo) => {
      ultimo = s;
      raiz.querySelector('[data-titulo-sub]').textContent = s.categorias.length
        ? `${plural(s.categorias.length, 'categoria', 'categorias')} separando ${plural(s.tarefas.length, 'tarefa', 'tarefas')}.`
        : '';
      if (!s.categorias.length) {
        morph(
          lista,
          vazio({
            titulo: 'Nenhuma categoria criada',
            texto: 'Categorias separam o trabalho por área, como Financeiro, Design ou Estudos.',
            acao: html`<button type="button" class="botao botao--primario" data-nova>${raw(icone('folder-plus', { tamanho: 16 }))}Criar categoria</button>`,
          })
        );
        return;
      }
      const ordenadas = [...s.categorias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      morph(
        lista,
        html`<ul class="registros">${ordenadas.map((c) => linha(c, s.tarefas))}</ul>`
      );
    };

    raiz.addEventListener('click', (e) => {
      if (e.target.closest('[data-nova]')) {
        abrirFormCategoria();
        return;
      }
      const menu = e.target.closest('[data-menu]');
      if (!menu) return;
      const c = ultimo.categorias.find((x) => x.id === Number(menu.dataset.menu));
      abrirMenu(menu, [
        { rotulo: 'Editar', icone: 'pencil', acao: () => abrirFormCategoria({ categoria: c }) },
        { separador: true },
        {
          rotulo: 'Excluir',
          icone: 'trash-2',
          perigo: true,
          acao: async () => {
            const qtd = ultimo.tarefas.filter((t) => t.categoriaId === c.id).length;
            const ok = await confirmar({
              titulo: `Excluir a categoria ${c.nome}?`,
              mensagem: qtd
                ? html`<p>${plural(qtd, 'tarefa dessa categoria', 'tarefas dessa categoria')} também ${qtd === 1 ? 'será excluída' : 'serão excluídas'}. Para manter, mude a categoria delas antes.</p>`
                : html`<p>Essa categoria não tem tarefas. A exclusão não pode ser desfeita.</p>`,
              confirmar: qtd ? `Excluir categoria e ${plural(qtd, 'tarefa', 'tarefas')}` : 'Excluir categoria',
              perigo: true,
            });
            if (ok) acoesCategorias.excluir(c.id).catch(() => {});
          },
        },
      ]);
    });

    desenhar(estado);
    return { atualizar: desenhar };
  },
};
