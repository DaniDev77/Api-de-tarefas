// Quadro Kanban: uma coluna por status. Arraste os cartões (ou use Alt + setas) para mudar o status.
// Redesenho com morph (só o que mudou) e animação FLIP: o cartão voa até a coluna nova.
import { html, morph, render } from '../core/html.js';
import { ler, gravar } from '../core/storage.js';
import { plural, somarDias, hora, normalizar } from '../core/format.js';
import { medir, animarMudancas } from '../core/animar.js';
import { LISTA_STATUS, STATUS, STATUS_INFO } from '../domain/enums.js';
import { filtrarTarefas, ordenarPorUrgencia, porId, estaAtrasada, resumo } from '../domain/selectors.js';
import { icone, iconeStatus } from '../ui/icons.js';
import { avatar, seloPrioridade, seloCategoria, prazo, vazio, tituloTela, botaoNovaTarefa } from '../ui/pecas.js';
import { abrirMenu } from '../ui/menu.js';
import { ativarArrastar } from '../ui/arrastar.js';
import { alterarStatus, excluirTarefa, criarTarefa } from '../state.js';
import { abrirFormTarefa } from '../forms/tarefa-form.js';
import { barraFiltros, ligarFiltros, lerFiltrosDaQuery } from './filtros.js';

const SELETOR_CARTAO = '.cartao[data-id]';

function cartao(t, { pessoa, categoria, destaque }) {
  const atrasada = estaAtrasada(t);
  // a animação de "chegada" continua de onde parou mesmo se o cartão for redesenhado
  const decorrido = destaque && destaque.id === t.id ? Date.now() - destaque.em : Infinity;
  const chegou = decorrido < 900;
  return html`<article class="cartao${atrasada ? ' cartao--atrasada' : ''}${chegou ? ' cartao--chegou' : ''}${t.status >= 3 ? ' cartao--fechada' : ''}"
      ${chegou ? html`style="animation-delay:-${decorrido}ms"` : ''}
      data-id="${t.id}" tabindex="0" aria-roledescription="cartão arrastável"
      aria-label="${t.titulo}. ${STATUS_INFO[t.status].rotulo}. Alt mais seta para mover.">
    <div class="cartao__topo">
      ${seloPrioridade(t.prioridade, { soIcone: true })}
      <h3 class="cartao__titulo">${t.titulo}</h3>
      <button type="button" class="botao-icone botao-icone--p cartao__menu" data-menu-tarefa="${t.id}" aria-label="Ações da tarefa ${t.titulo}" aria-haspopup="menu">${icone('ellipsis', { tamanho: 16 })}</button>
    </div>
    ${t.descricao ? html`<p class="cartao__descricao">${t.descricao}</p>` : ''}
    <div class="cartao__rodape">
      ${seloCategoria(categoria)}
      <span class="cartao__fim">${prazo(t)}${avatar(pessoa, { tamanho: 'p' })}</span>
    </div>
  </article>`;
}

export function menuTarefa(ancora, tarefa) {
  abrirMenu(ancora, [
    { rotulo: 'Abrir detalhes', icone: 'pencil', acao: () => abrirFormTarefa({ tarefa }) },
    { separador: true },
    { titulo: 'Mover para' },
    ...LISTA_STATUS.map((s) => ({
      rotulo: s.rotulo,
      iconeHtml: iconeStatus(s.valor, 16),
      atual: s.valor === tarefa.status,
      acao: () => alterarStatus(tarefa.id, s.valor).catch(() => {}),
    })),
    { separador: true },
    { rotulo: 'Excluir', icone: 'trash-2', perigo: true, acao: () => excluirTarefa(tarefa.id) },
  ]);
}

/** Pessoa e categoria usadas na última tarefa criada: o padrão mais provável para a próxima. */
const ultimosUsados = () => ler('ultimos', {});

export default {
  titulo: 'Quadro',
  montar(raiz, { query, estado }) {
    let filtros = lerFiltrosDaQuery(query);
    let mostrarCanceladas = ler('quadro:canceladas', false);
    let destaque = null; // { id, em } cartão recém-criado
    let voo = null; // { id, rect } onde o cartão foi solto
    let ultimoEstado = estado;

    render(
      raiz,
      html`<div class="tela tela--quadro">
        ${tituloTela({ titulo: 'Quadro', acoes: botaoNovaTarefa() })}
        ${barraFiltros({ filtros, usuarios: estado.usuarios, categorias: estado.categorias })}
        <p class="resumo-filtro" data-resumo aria-live="polite"></p>
        <div class="quadro" data-quadro></div>
      </div>`
    );
    const quadro = raiz.querySelector('[data-quadro]');
    const resumoEl = raiz.querySelector('[data-resumo]');

    const desenhar = (s = ultimoEstado) => {
      ultimoEstado = s;
      const pessoas = porId(s.usuarios);
      const cats = porId(s.categorias);
      const visiveis = filtrarTarefas(s.tarefas, filtros, s);
      const algumFiltro = Object.keys(filtros).length > 0;
      const r = resumo(s.tarefas);
      raiz.querySelector('[data-titulo-sub]').textContent = s.tarefas.length
        ? `${plural(r.abertas, 'tarefa aberta', 'tarefas abertas')}${r.atrasadas ? `, ${r.atrasadas} atrasada${r.atrasadas > 1 ? 's' : ''}` : ''}.`
        : '';
      resumoEl.textContent = algumFiltro ? `${plural(visiveis.length, 'tarefa encontrada', 'tarefas encontradas')} com os filtros atuais.` : '';
      resumoEl.hidden = !algumFiltro;

      if (!s.tarefas.length) {
        morph(
          quadro,
          html`<div class="quadro__vazio" data-key="vazio">${vazio({
            titulo: 'Nenhuma tarefa por aqui ainda',
            texto: 'Crie a primeira tarefa e ela aparece na coluna A fazer.',
            acao: html`<button type="button" class="botao botao--primario" data-nova="1">${icone('plus', { tamanho: 16 })}Nova tarefa</button>`,
          })}</div>`
        );
        return;
      }

      // FLIP, passo 1: onde cada cartão está agora (o solto conta a partir de onde foi largado)
      const antes = medir(quadro, SELETOR_CARTAO, '.coluna');
      if (voo && antes.has(String(voo.id))) antes.get(String(voo.id)).rect = voo.rect;
      voo = null;

      morph(
        quadro,
        LISTA_STATUS.map((st) => {
          const lista = visiveis.filter((t) => t.status === st.valor).sort(ordenarPorUrgencia);
          const recolhida = st.valor === STATUS.CANCELADA && !mostrarCanceladas;
          if (recolhida) {
            return html`<section class="coluna coluna--recolhida s${st.valor}" data-key="col${st.valor}-r" aria-label="${st.rotulo}, ${plural(lista.length, 'tarefa', 'tarefas')}" data-soltar="${st.valor}">
              <button type="button" class="coluna__expandir" data-expandir aria-expanded="false">
                ${iconeStatus(st.valor, 16)}<span>${st.rotulo}</span><span class="contagem">${lista.length}</span>
              </button>
            </section>`;
          }
          return html`<section class="coluna s${st.valor}" data-key="col${st.valor}" aria-labelledby="col-${st.valor}">
            <header class="coluna__topo">
              <h2 class="coluna__titulo" id="col-${st.valor}">${iconeStatus(st.valor, 16)}${st.rotulo}<span class="contagem" aria-label="${plural(lista.length, 'tarefa', 'tarefas')}">${lista.length}</span></h2>
              <div class="coluna__acoes">
                ${st.valor === STATUS.CANCELADA
                  ? html`<button type="button" class="botao-icone botao-icone--p" data-recolher aria-label="Recolher coluna Cancelada" data-dica="Recolher">${icone('chevron-right', { tamanho: 16 })}</button>`
                  : html`<button type="button" class="botao-icone botao-icone--p" data-adicionar="${st.valor}" aria-label="Adicionar tarefa em ${st.rotulo}" data-dica="Adicionar aqui">${icone('plus', { tamanho: 16 })}</button>`}
              </div>
            </header>
            ${st.valor !== STATUS.CANCELADA ? html`<div class="coluna__adicao" data-key="adicao${st.valor}" data-morph-manter></div>` : ''}
            <div class="coluna__cartoes" data-soltar="${st.valor}" role="list" aria-label="Tarefas em ${st.rotulo}">
              ${lista.length
                ? lista.map((t) => html`<div role="listitem" data-key="t${t.id}">${cartao(t, { pessoa: pessoas.get(t.usuarioId), categoria: cats.get(t.categoriaId), destaque })}</div>`)
                : html`<p class="coluna__vazia" data-key="vazia">${algumFiltro ? 'Nada com esses filtros' : 'Solte uma tarefa aqui'}</p>`}
            </div>
          </section>`;
        })
      );

      // FLIP, passos 2-4: anima cada cartão da posição antiga até a nova
      animarMudancas(quadro, SELETOR_CARTAO, antes, { seletorGrupo: '.coluna' });
    };

    const controleFiltros = ligarFiltros(raiz, filtros, (f) => {
      filtros = f;
      desenhar();
    });

    const mover = (id, status, rectSolto = null) => {
      if (rectSolto) voo = { id, rect: rectSolto };
      alterarStatus(id, status).catch(() => {});
      // devolve o foco ao cartão na nova coluna (teclado)
      requestAnimationFrame(() => quadro.querySelector(`.cartao[data-id="${id}"]`)?.focus({ preventScroll: true }));
    };

    const pararArraste = ativarArrastar(quadro, {
      rolavel: quadro,
      aoSoltar: (id, destino, rect) => mover(id, Number(destino), rect),
    });

    // ------------------------------------------------------------------ adição rápida
    // Título + Enter cria a tarefa com padrões: pessoa e categoria do filtro ou da última tarefa, prazo amanhã 18h.
    const padroes = () => {
      const s = ultimoEstado;
      const ult = ultimosUsados();
      const ordenar = (l) => [...l].sort((a, b) => normalizar(a.nome).localeCompare(normalizar(b.nome)));
      const pessoa =
        s.usuarios.find((u) => u.id === Number(filtros.pessoa)) || s.usuarios.find((u) => u.id === ult.usuarioId) || ordenar(s.usuarios)[0];
      const categoria =
        s.categorias.find((c) => c.id === Number(filtros.categoria)) || s.categorias.find((c) => c.id === ult.categoriaId) || ordenar(s.categorias)[0];
      const amanha = somarDias(new Date(), 1);
      return { pessoa, categoria, prazo: new Date(amanha.getFullYear(), amanha.getMonth(), amanha.getDate(), 18, 0) };
    };

    const fecharAdicao = (caixa) => {
      caixa.replaceChildren();
    };

    const abrirAdicao = (status) => {
      const caixa = quadro.querySelector(`[data-key="adicao${status}"]`);
      if (!caixa) return;
      if (caixa.firstElementChild) {
        caixa.querySelector('textarea')?.focus();
        return;
      }
      const p = padroes();
      if (!p.pessoa || !p.categoria) {
        abrirFormTarefa({ padrao: { status } }); // explica o que falta cadastrar
        return;
      }
      render(
        caixa,
        html`<form class="adicao-rapida" data-status="${status}" novalidate>
          <label class="sr-only" for="adicao-${status}">Título da nova tarefa em ${STATUS_INFO[status].rotulo}</label>
          <textarea id="adicao-${status}" class="adicao-rapida__titulo" rows="2" maxlength="100" placeholder="O que precisa ser feito?" autocomplete="off"></textarea>
          <div class="adicao-rapida__rodape">
            <span class="adicao-rapida__padroes" data-dica="Pessoa, categoria e prazo usados. Ajuste depois nos detalhes.">
              ${avatar(p.pessoa, { tamanho: 'p', dica: false })}${seloCategoria(p.categoria)}<span class="prazo">${icone('calendar', { tamanho: 13 })}Amanhã, ${hora(p.prazo)}</span>
            </span>
            <span class="meta"><kbd>Enter</kbd> cria</span>
          </div>
        </form>`
      );
      const form = caixa.querySelector('form');
      const campo = form.querySelector('textarea');
      campo.focus();

      const enviar = async () => {
        const titulo = campo.value.replace(/\s+/g, ' ').trim();
        if (!titulo) return;
        const atuais = padroes();
        campo.disabled = true;
        try {
          const nova = await criarTarefa(
            {
              titulo,
              descricao: '',
              status,
              prioridade: 2,
              dataLimite: atuais.prazo,
              usuarioId: atuais.pessoa.id,
              categoriaId: atuais.categoria.id,
            },
            { acao: (t) => ({ rotulo: 'Detalhes', fn: () => abrirFormTarefa({ tarefa: t }) }) }
          );
          destaque = { id: nova.id, em: Date.now() };
          desenhar();
          campo.value = '';
        } catch {
          /* o erro já foi mostrado; o texto continua no campo para tentar de novo */
        } finally {
          campo.disabled = false;
          campo.focus();
        }
      };
      campo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          enviar();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          fecharAdicao(caixa);
          quadro.querySelector(`[data-adicionar="${status}"]`)?.focus();
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        enviar();
      });
      // sai do campo sem ter escrito nada: fecha
      form.addEventListener('focusout', () => {
        setTimeout(() => {
          if (!form.contains(document.activeElement) && !campo.value.trim() && !campo.disabled) fecharAdicao(caixa);
        }, 120);
      });
    };

    // ------------------------------------------------------------------ eventos

    const aoClicar = (e) => {
      const menuBtn = e.target.closest('[data-menu-tarefa]');
      if (menuBtn) {
        const t = ultimoEstado.tarefas.find((x) => x.id === Number(menuBtn.dataset.menuTarefa));
        if (t) menuTarefa(menuBtn, t);
        return;
      }
      const adicionar = e.target.closest('[data-adicionar]');
      if (adicionar) {
        abrirAdicao(Number(adicionar.dataset.adicionar));
        return;
      }
      const nova = e.target.closest('[data-nova]');
      if (nova) {
        abrirFormTarefa({ padrao: { status: Number(nova.dataset.nova) } });
        return;
      }
      if (e.target.closest('[data-expandir]') || e.target.closest('[data-recolher]')) {
        mostrarCanceladas = !mostrarCanceladas;
        gravar('quadro:canceladas', mostrarCanceladas);
        desenhar();
        return;
      }
      if (e.target.closest('.adicao-rapida')) return;
      const c = e.target.closest(SELETOR_CARTAO);
      if (c) {
        const t = ultimoEstado.tarefas.find((x) => x.id === Number(c.dataset.id));
        if (t) abrirFormTarefa({ tarefa: t });
      }
    };

    const aoTeclar = (e) => {
      const c = e.target.closest?.(SELETOR_CARTAO);
      if (!c || e.target !== c) return;
      const t = ultimoEstado.tarefas.find((x) => x.id === Number(c.dataset.id));
      if (!t) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirFormTarefa({ tarefa: t });
      } else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        const limite = mostrarCanceladas ? 4 : 3;
        const novo = Math.min(limite, Math.max(1, t.status + (e.key === 'ArrowRight' ? 1 : -1)));
        if (novo !== t.status) mover(t.id, novo);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const coluna = [...c.closest('[data-soltar]').querySelectorAll(SELETOR_CARTAO)];
        const i = coluna.indexOf(c) + (e.key === 'ArrowDown' ? 1 : -1);
        coluna[i]?.focus();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        excluirTarefa(t.id);
      }
    };

    quadro.addEventListener('click', aoClicar);
    quadro.addEventListener('keydown', aoTeclar);
    desenhar(estado);

    return {
      atualizar(s) {
        controleFiltros.atualizarOpcoes(s.usuarios, s.categorias);
        const focado = document.activeElement?.closest?.(SELETOR_CARTAO)?.dataset.id;
        desenhar(s);
        // o cartão que mudou de coluna é um elemento novo: devolve o foco a ele
        if (focado && !document.activeElement?.closest?.(SELETOR_CARTAO)) {
          quadro.querySelector(`.cartao[data-id="${focado}"]`)?.focus({ preventScroll: true });
        }
      },
      focarBusca: () => controleFiltros.focarBusca(),
      destruir() {
        pararArraste();
      },
    };
  },
};
