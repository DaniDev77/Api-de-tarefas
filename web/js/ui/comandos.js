// Paleta de comandos (Ctrl+K): busca hábitos e itens de hoje e executa ações sem tirar a mão do teclado.
import { html, render } from '../core/html.js';
import { normalizar } from '../core/format.js';
import { navegar } from '../core/router.js';
import { estaAberta, STATUS } from '../domain/enums.js';
import * as R from '../domain/rotina.js';
import { icone } from './icons.js';
import { ponto } from './pecas.js';
import { store, carregarTudo, definirTema, perfilAtual, mudarStatus } from '../state.js';
import { abrirFormHabito } from '../forms/habito-form.js';
import { abrirFormArea } from '../forms/area-form.js';
import { abrirFormPerfil } from '../forms/perfil-form.js';
import { abrirDetalhesItem } from '../forms/item-form.js';

let aberta = null;

function focarAdicao() {
  const focar = () => document.querySelector('[data-adicao] input')?.focus();
  if (location.hash.startsWith('#/hoje') || location.hash === '' || location.hash === '#/') focar();
  else {
    navegar('hoje');
    requestAnimationFrame(focar);
  }
}

function acoesFixas() {
  const tema = store.get().tema;
  const proximoTema = tema === 'escuro' ? 'claro' : 'escuro';
  return [
    { grupo: 'Ações', rotulo: 'Escrever um item novo', icone: 'plus', atalho: 'N', fn: focarAdicao },
    { grupo: 'Ações', rotulo: 'Novo hábito', icone: 'repeat-2', fn: () => abrirFormHabito() },
    { grupo: 'Ações', rotulo: 'Nova área', icone: 'plus', fn: () => abrirFormArea() },
    { grupo: 'Ações', rotulo: 'Novo perfil', icone: 'user-plus', fn: () => abrirFormPerfil() },
    { grupo: 'Ações', rotulo: 'Sincronizar dados', icone: 'refresh-cw', fn: () => carregarTudo() },
    { grupo: 'Ações', rotulo: `Usar tema ${proximoTema}`, icone: proximoTema === 'escuro' ? 'moon' : 'sun', fn: () => definirTema(proximoTema) },
    { grupo: 'Ir para', rotulo: 'Hoje', icone: 'calendar-check', atalho: 'G H', fn: () => navegar('hoje') },
    { grupo: 'Ir para', rotulo: 'Progresso', icone: 'chart-column', atalho: 'G P', fn: () => navegar('progresso') },
    { grupo: 'Ir para', rotulo: 'Rotina', icone: 'repeat-2', atalho: 'G R', fn: () => navegar('rotina') },
    { grupo: 'Ir para', rotulo: 'Foco', icone: 'timer', atalho: 'G F', fn: () => navegar('foco') },
    { grupo: 'Ir para', rotulo: 'Ajustes', icone: 'settings', fn: () => navegar('ajustes') },
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
  const s = store.get();
  const perfil = perfilAtual(s);
  const itens = [];
  acoesFixas().forEach((a) => {
    const p = pontuar(a.rotulo, termo);
    if (p) itens.push({ ...a, p });
  });
  if (termo && perfil) {
    const indice = R.indiceRotina(s.tarefas, perfil.id, s.habitos);
    // itens de hoje: marcar direto daqui
    R.itensDoDia(indice, new Date())
      .filter((t) => estaAberta(t))
      .forEach((t) => {
        const p = pontuar(t.titulo, termo);
        if (p)
          itens.push({
            grupo: 'Marcar como feito hoje',
            rotulo: t.titulo,
            iconeHtml: ponto(t.categoriaId),
            detalhe: R.horaTexto(t.dataLimite),
            p: p + 1,
            fn: () => mudarStatus(t.id, STATUS.CONCLUIDA).catch(() => {}),
          });
      });
    [...indice.series.values()]
      .filter((sr) => sr.recorrente)
      .forEach((sr) => {
        const p = pontuar(sr.titulo, termo);
        if (p) itens.push({ grupo: 'Hábitos', rotulo: sr.titulo, iconeHtml: ponto(sr.categoriaId), detalhe: R.textoPadrao(sr), p, fn: () => abrirFormHabito({ serie: sr }) });
      });
    indice.itens
      .filter((t) => !R.serieDe(indice, t)?.recorrente && t.dataLimite >= new Date())
      .forEach((t) => {
        const p = pontuar(t.titulo, termo);
        if (p) itens.push({ grupo: 'Itens avulsos', rotulo: t.titulo, iconeHtml: ponto(t.categoriaId), detalhe: R.chaveDia(t.dataLimite) === R.chaveDia(new Date()) ? `hoje, ${R.horaTexto(t.dataLimite)}` : `${t.dataLimite.toLocaleDateString('pt-BR')} ${R.horaTexto(t.dataLimite)}`, p, fn: () => abrirDetalhesItem(t) });
      });
  }
  const ordemGrupos = termo ? ['Marcar como feito hoje', 'Hábitos', 'Itens avulsos', 'Ações', 'Ir para'] : ['Ações', 'Ir para'];
  return itens.sort((a, b) => ordemGrupos.indexOf(a.grupo) - ordemGrupos.indexOf(b.grupo) || b.p - a.p).slice(0, 14);
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
        ${icone('search', { tamanho: 18 })}
        <input type="text" class="paleta__entrada" placeholder="Buscar hábitos, itens ou ações" aria-label="Buscar" role="combobox" aria-expanded="true" aria-controls="paleta-lista" aria-autocomplete="list" autocomplete="off" spellcheck="false">
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
              <span class="paleta__icone">${it.iconeHtml ?? icone(it.icone, { tamanho: 16 })}</span>
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
