// Paleta de comandos (Ctrl+K): busca tarefas, pessoas e categorias e executa ações sem tirar a mão do teclado.
import { html, raw, render } from '../core/html.js';
import { normalizar } from '../core/format.js';
import { navegar } from '../core/router.js';
import { STATUS_INFO } from '../domain/enums.js';
import { porId } from '../domain/selectors.js';
import { icone, iconeStatus } from './icons.js';
import { avatar } from './pecas.js';
import { store, carregarTudo, definirTema } from '../state.js';
import { abrirFormTarefa } from '../forms/tarefa-form.js';
import { abrirFormPessoa } from '../forms/pessoa-form.js';
import { abrirFormCategoria } from '../forms/categoria-form.js';

let aberta = null;

function acoesFixas() {
  const tema = store.get().tema;
  const proximoTema = tema === 'escuro' ? 'claro' : 'escuro';
  return [
    { grupo: 'Ações', rotulo: 'Nova tarefa', icone: 'plus', atalho: 'N', fn: () => abrirFormTarefa() },
    { grupo: 'Ações', rotulo: 'Nova pessoa', icone: 'user-plus', fn: () => abrirFormPessoa() },
    { grupo: 'Ações', rotulo: 'Nova categoria', icone: 'folder-plus', fn: () => abrirFormCategoria() },
    { grupo: 'Ações', rotulo: 'Sincronizar dados', icone: 'refresh-cw', fn: () => carregarTudo() },
    { grupo: 'Ações', rotulo: `Usar tema ${proximoTema}`, icone: proximoTema === 'escuro' ? 'moon' : 'sun', fn: () => definirTema(proximoTema) },
    { grupo: 'Ir para', rotulo: 'Painel', icone: 'layout-dashboard', atalho: 'G P', fn: () => navegar('painel') },
    { grupo: 'Ir para', rotulo: 'Quadro', icone: 'square-kanban', atalho: 'G Q', fn: () => navegar('quadro') },
    { grupo: 'Ir para', rotulo: 'Lista', icone: 'list', atalho: 'G L', fn: () => navegar('lista') },
    { grupo: 'Ir para', rotulo: 'Equipe', icone: 'users', atalho: 'G E', fn: () => navegar('equipe') },
    { grupo: 'Ir para', rotulo: 'Categorias', icone: 'tag', atalho: 'G C', fn: () => navegar('categorias') },
    { grupo: 'Ir para', rotulo: 'Configurações', icone: 'settings', fn: () => navegar('configuracoes') },
  ];
}

function pontuar(texto, termo) {
  const alvo = normalizar(texto);
  if (!termo) return 1;
  if (alvo.startsWith(termo)) return 3;
  if (alvo.split(/\s+/).some((p) => p.startsWith(termo))) return 2;
  return termo.split(/\s+/).every((p) => alvo.includes(p)) ? 1 : 0;
}

function resultados(termoBruto) {
  const termo = normalizar(termoBruto);
  const { tarefas, usuarios, categorias } = store.get();
  const pessoasPorId = porId(usuarios);
  const itens = [];

  acoesFixas().forEach((a) => {
    const p = pontuar(a.rotulo, termo);
    if (p) itens.push({ ...a, p });
  });
  if (termo) {
    tarefas
      .map((t) => ({ t, p: pontuar(`${t.titulo} ${t.descricao}`, termo) }))
      .filter((x) => x.p)
      .sort((a, b) => b.p - a.p)
      .slice(0, 8)
      .forEach(({ t, p }) =>
        itens.push({
          grupo: 'Tarefas',
          rotulo: t.titulo,
          iconeHtml: raw(iconeStatus(t.status, 16)),
          detalhe: `${STATUS_INFO[t.status].rotulo}, com ${pessoasPorId.get(t.usuarioId)?.nome ?? 'ninguém'}`,
          p: p + 1,
          fn: () => abrirFormTarefa({ tarefa: store.get().tarefas.find((x) => x.id === t.id) }),
        })
      );
    usuarios.forEach((u) => {
      const p = pontuar(`${u.nome} ${u.email}`, termo);
      if (p)
        itens.push({ grupo: 'Equipe', rotulo: u.nome, iconeHtml: avatar(u, { tamanho: 'p', dica: false }), detalhe: 'Ver tarefas no quadro', p, fn: () => navegar('quadro', { pessoa: u.id }) });
    });
    categorias.forEach((c) => {
      const p = pontuar(c.nome, termo);
      if (p) itens.push({ grupo: 'Categorias', rotulo: c.nome, icone: 'tag', detalhe: 'Ver tarefas no quadro', p, fn: () => navegar('quadro', { categoria: c.id }) });
    });
  }
  const ordemGrupos = termo ? ['Tarefas', 'Equipe', 'Categorias', 'Ações', 'Ir para'] : ['Ações', 'Ir para'];
  return itens.sort((a, b) => ordemGrupos.indexOf(a.grupo) - ordemGrupos.indexOf(b.grupo) || b.p - a.p);
}

export function abrirComandos() {
  if (aberta) return;
  const dialogo = document.createElement('dialog');
  dialogo.className = 'paleta';
  dialogo.setAttribute('aria-label', 'Buscar e executar comandos');
  render(
    dialogo,
    html`<div class="paleta__caixa">
      <div class="paleta__busca">
        ${raw(icone('search', { tamanho: 18 }))}
        <input type="text" class="paleta__entrada" placeholder="Buscar tarefas, pessoas ou ações" aria-label="Buscar" role="combobox" aria-expanded="true" aria-controls="paleta-lista" aria-autocomplete="list" autocomplete="off" spellcheck="false">
        <kbd>Esc</kbd>
      </div>
      <ul class="paleta__lista" id="paleta-lista" role="listbox"></ul>
    </div>`
  );
  document.body.append(dialogo);
  aberta = dialogo;

  const entrada = dialogo.querySelector('input');
  const lista = dialogo.querySelector('ul');
  let itens = [];
  let ativo = 0;

  const desenhar = () => {
    itens = resultados(entrada.value);
    ativo = Math.min(ativo, Math.max(0, itens.length - 1));
    let grupoAnterior = '';
    render(
      lista,
      itens.length
        ? itens.map((it, i) => {
            const cabecalho = it.grupo !== grupoAnterior ? html`<li class="paleta__grupo" role="presentation">${it.grupo}</li>` : '';
            grupoAnterior = it.grupo;
            return html`${cabecalho}<li id="opc-${i}" class="paleta__item${i === ativo ? ' ativo' : ''}" role="option" aria-selected="${i === ativo}" data-i="${i}">
              <span class="paleta__icone">${it.iconeHtml ?? raw(icone(it.icone, { tamanho: 16 }))}</span>
              <span class="paleta__texto"><span>${it.rotulo}</span>${it.detalhe ? html`<small>${it.detalhe}</small>` : ''}</span>
              ${it.atalho ? html`<kbd>${it.atalho}</kbd>` : ''}
            </li>`;
          })
        : html`<li class="paleta__nada">Nada encontrado para “${entrada.value}”.</li>`
    );
    entrada.setAttribute('aria-activedescendant', itens.length ? `opc-${ativo}` : '');
    lista.querySelector('.ativo')?.scrollIntoView({ block: 'nearest' });
  };

  const fechar = () => {
    if (!aberta) return;
    aberta = null;
    if (dialogo.open) dialogo.close();
    dialogo.remove();
  };
  const executar = (i) => {
    const it = itens[i];
    if (!it) return;
    fechar();
    it.fn();
  };

  entrada.addEventListener('input', () => {
    ativo = 0;
    desenhar();
  });
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      ativo = (ativo + 1) % Math.max(1, itens.length);
      desenhar();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      ativo = (ativo - 1 + itens.length) % Math.max(1, itens.length);
      desenhar();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executar(ativo);
    }
  });
  lista.addEventListener('mousemove', (e) => {
    const li = e.target.closest('[data-i]');
    if (li && Number(li.dataset.i) !== ativo) {
      ativo = Number(li.dataset.i);
      lista.querySelectorAll('.paleta__item').forEach((x) => {
        x.classList.toggle('ativo', Number(x.dataset.i) === ativo);
        x.setAttribute('aria-selected', String(Number(x.dataset.i) === ativo));
      });
    }
  });
  lista.addEventListener('click', (e) => {
    const li = e.target.closest('[data-i]');
    if (li) executar(Number(li.dataset.i));
  });
  dialogo.addEventListener('cancel', (e) => {
    e.preventDefault();
    fechar();
  });
  dialogo.addEventListener('click', (e) => {
    if (e.target === dialogo) fechar();
  });

  dialogo.showModal();
  desenhar();
  entrada.focus();
}
