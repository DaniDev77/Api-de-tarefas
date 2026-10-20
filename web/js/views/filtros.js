// Barra de filtros compartilhada por Quadro e Lista. Os valores vivem na URL (?q=&pessoa=&...).
import { html, raw } from '../core/html.js';
import { debounce } from '../core/format.js';
import { substituirQuery } from '../core/router.js';
import { LISTA_PRIORIDADE, LISTA_STATUS } from '../domain/enums.js';
import { icone } from '../ui/icons.js';

const CHAVES = ['q', 'pessoa', 'categoria', 'prioridade', 'status', 'atrasadas'];

export function lerFiltrosDaQuery(query) {
  const f = {};
  CHAVES.forEach((k) => {
    if (query[k]) f[k] = query[k];
  });
  return f;
}

export const quantidadeAtivos = (f) => CHAVES.filter((k) => k !== 'q' && f[k]).length + (f.q ? 1 : 0);

function seletor(nome, rotulo, opcoes, valor) {
  return html`<label class="filtro-select${valor ? ' ativo' : ''}">
    <span class="sr-only">${rotulo}</span>
    <select name="${nome}" data-filtro>
      <option value="">${rotulo}</option>
      ${opcoes.map((o) => html`<option value="${o.valor}" ${String(o.valor) === String(valor) ? 'selected' : ''}>${o.rotulo}</option>`)}
    </select>
    ${raw(icone('chevron-down', { tamanho: 14 }))}
  </label>`;
}

export function barraFiltros({ filtros, usuarios, categorias, comStatus = false }) {
  const ordenar = (l) => [...l].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return html`<form class="barra-filtros" role="search" aria-label="Filtrar tarefas" data-barra-filtros>
    <label class="filtro-busca">
      ${raw(icone('search', { tamanho: 16 }))}
      <span class="sr-only">Buscar tarefas</span>
      <input type="search" name="q" value="${filtros.q ?? ''}" placeholder="Buscar por título, pessoa ou categoria" autocomplete="off" data-filtro>
    </label>
    <div class="barra-filtros__grupo">
      ${seletor('pessoa', 'Pessoa', ordenar(usuarios).map((u) => ({ valor: u.id, rotulo: u.nome })), filtros.pessoa)}
      ${seletor('categoria', 'Categoria', ordenar(categorias).map((c) => ({ valor: c.id, rotulo: c.nome })), filtros.categoria)}
      ${seletor('prioridade', 'Prioridade', LISTA_PRIORIDADE, filtros.prioridade)}
      ${comStatus ? seletor('status', 'Status', LISTA_STATUS, filtros.status) : ''}
      <button type="button" class="pilula pilula--alternar" aria-pressed="${Boolean(filtros.atrasadas)}" data-alternar-atrasadas>
        ${raw(icone('triangle-alert', { tamanho: 14 }))}Só atrasadas
      </button>
      <button type="button" class="botao-texto" data-limpar-filtros ${quantidadeAtivos(filtros) ? '' : 'hidden'}>Limpar filtros</button>
    </div>
  </form>`;
}

/**
 * Liga os eventos da barra. Chama aoMudar(filtros) e atualiza a URL sem recarregar a tela.
 */
export function ligarFiltros(raiz, filtrosIniciais, aoMudar) {
  const form = raiz.querySelector('[data-barra-filtros]');
  let filtros = { ...filtrosIniciais };

  const aplicar = () => {
    substituirQuery(filtros);
    form.querySelector('[data-limpar-filtros]').hidden = !quantidadeAtivos(filtros);
    form.querySelectorAll('select[data-filtro]').forEach((s) => s.closest('.filtro-select').classList.toggle('ativo', Boolean(s.value)));
    aoMudar({ ...filtros });
  };
  const aplicarBusca = debounce(aplicar, 160);

  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', (e) => {
    const alvo = e.target;
    if (!alvo.matches('[data-filtro]')) return;
    if (alvo.value) filtros[alvo.name] = alvo.value;
    else delete filtros[alvo.name];
    if (alvo.name === 'q') aplicarBusca();
    else aplicar();
  });
  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-alternar-atrasadas]')) {
      const b = e.target.closest('[data-alternar-atrasadas]');
      const ligado = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(ligado));
      if (ligado) filtros.atrasadas = '1';
      else delete filtros.atrasadas;
      aplicar();
    }
    if (e.target.closest('[data-limpar-filtros]')) {
      filtros = {};
      form.reset();
      form.querySelectorAll('[data-filtro]').forEach((el) => {
        el.value = '';
      });
      form.querySelector('[data-alternar-atrasadas]').setAttribute('aria-pressed', 'false');
      aplicar();
      form.querySelector('input[name="q"]').focus();
    }
  });

  return {
    /** Atualiza as opções de pessoa/categoria quando os dados mudam (sem perder o foco da busca). */
    atualizarOpcoes(usuarios, categorias) {
      const sincronizar = (nome, lista) => {
        const select = form.querySelector(`select[name="${nome}"]`);
        if (!select) return;
        const assinatura = lista.map((x) => `${x.id}:${x.nome}`).join('|');
        if (select.dataset.assinatura === assinatura) return;
        select.dataset.assinatura = assinatura;
        const atual = select.value;
        const rotulo = select.options[0].textContent;
        const ordenada = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        select.innerHTML = '';
        select.add(new Option(rotulo, ''));
        ordenada.forEach((x) => select.add(new Option(x.nome, x.id, false, String(x.id) === atual)));
      };
      sincronizar('pessoa', usuarios);
      sincronizar('categoria', categorias);
    },
    focarBusca: () => form.querySelector('input[name="q"]').focus(),
  };
}
