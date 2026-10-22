// Rotina: os hábitos, agrupados por área. Pergunta da tela: "o que está rodando, e até quando?"
// Um hábito vive na pauta por algumas semanas; quando está para acabar, a tela pede para estender.
import { html, morph } from '../core/html.js';
import { diaMes, plural, normalizar, diaSemanaCurto } from '../core/format.js';
import { tomArea } from '../domain/enums.js';
import * as R from '../domain/rotina.js';
import { store, perfilAtual, estenderHabito, encerrarHabito } from '../state.js';
import { tituloTela, ponto, textoSequencia } from '../ui/pecas.js';
import { icone } from '../ui/icons.js';
import { abrirMenu } from '../ui/menu.js';
import { confirmar } from '../ui/modal.js';
import { substituirQuery } from '../core/router.js';
import { abrirFormHabito } from '../forms/habito-form.js';
import { abrirFormArea, confirmarExclusaoArea } from '../forms/area-form.js';
import { SEMANAS_PADRAO } from '../config.js';

function situacao(serie, agora) {
  const dias = R.diasAteAcabar(serie, agora);
  if (dias < 0) return { tipo: 'encerrado', texto: `encerrado em ${diaMes(serie.ultimo)}` };
  if (dias <= 7) return { tipo: 'acabando', texto: dias === 0 ? 'acaba hoje' : dias === 1 ? 'acaba amanhã' : `acaba ${diaSemanaCurto(serie.ultimo)}, ${diaMes(serie.ultimo)}` };
  return { tipo: 'ativo', texto: `até ${diaMes(serie.ultimo)}` };
}

function linhaHabito(serie, chaveHoje, agora, destacado) {
  const seq = R.sequencias(serie, chaveHoje);
  const sit = situacao(serie, agora);
  return html`<li class="habito tom-${tomArea(serie.categoriaId)} habito--${sit.tipo}${destacado ? ' destaque' : ''}" data-key="${serie.chave}" data-chave="${serie.chave}">
    <button type="button" class="habito__corpo" data-editar="${serie.chave}">
      <span class="habito__nome">${serie.titulo}</span>
      <span class="habito__quando">${R.textoDias(serie.padrao.dias)} · ${R.textoHorarios(serie.padrao.horarios)}</span>
    </button>
    <span class="habito__seq">${seq.atual ? textoSequencia(seq.atual, serie.unidade) : html`<span class="cinza">—</span>`}</span>
    <span class="habito__ate habito__ate--${sit.tipo}">${sit.texto}</span>
    ${sit.tipo === 'ativo'
      ? html`<span class="habito__acao"></span>`
      : html`<button type="button" class="botao botao--secundario botao--p habito__acao" data-estender="${serie.chave}">${sit.tipo === 'encerrado' ? 'Retomar' : `Estender ${SEMANAS_PADRAO} sem.`}</button>`}
    <button type="button" class="botao-icone habito__mais" data-mais-habito="${serie.chave}" aria-label="Mais ações: ${serie.titulo}" aria-haspopup="menu" aria-expanded="false">${icone('ellipsis', { tamanho: 18 })}</button>
  </li>`;
}

function avulsos(indice, agora) {
  const lista = indice.itens.filter((t) => t.dataLimite >= agora && !R.serieDe(indice, t)?.recorrente).slice(0, 6);
  return html`<section class="painel span-6" aria-labelledby="avul-t" data-key="avulsos">
    <div class="painel__topo"><h2 id="avul-t" class="painel__titulo">Itens avulsos</h2><span class="conta">${lista.length}</span><span class="painel__fim">próximos</span></div>
    ${lista.length
      ? html`<ul class="lista-curta">${lista.map(
          (t) => html`<li data-key="v${t.id}"><a class="lista-curta__linha" href="#/hoje?dia=${R.chaveDia(t.dataLimite)}">${ponto(t.categoriaId)}<span class="lista-curta__nome">${t.titulo}</span><span class="lista-curta__valor">${diaSemanaCurto(t.dataLimite)}, ${diaMes(t.dataLimite)}, ${R.horaTexto(t.dataLimite)}</span></a></li>`
        )}</ul>`
      : html`<p class="painel__vazio">Itens de um dia só, como "dentista amanhã 14h", aparecem aqui.</p>`}
  </section>`;
}

function ideias(indice) {
  const existentes = new Set([...indice.series.values()].map((sr) => normalizar(sr.titulo)));
  const lista = R.SUGESTOES.map((sg, i) => ({ sg, i })).filter(({ sg }) => !existentes.has(normalizar(sg.titulo))).slice(0, 6);
  return html`<section class="painel span-6" aria-labelledby="ideias-t" data-key="ideias">
    <div class="painel__topo"><h2 id="ideias-t" class="painel__titulo">Ideias de hábitos</h2><span class="painel__fim">um clique preenche o formulário</span></div>
    ${lista.length
      ? html`<ul class="lista-curta">${lista.map(
          ({ sg, i }) => html`<li data-key="i${i}"><button type="button" class="lista-curta__linha" data-sugestao="${i}"><span class="lista-curta__nome">${sg.titulo}</span><span class="lista-curta__valor">${R.textoDias(sg.dias)} · ${R.textoHorarios(sg.horarios)}</span>${icone('plus', { tamanho: 16 })}</button></li>`
        )}</ul>`
      : html`<p class="painel__vazio">Você já tem todas as sugestões na rotina.</p>`}
  </section>`;
}

export default {
  titulo: 'Rotina',
  montar(raiz, { query, estado }) {
    let destacar = query?.habito ?? null;
    let abriuDaUrl = false;

    const desenhar = (s) => {
      const perfil = perfilAtual(s);
      if (!perfil) {
        morph(raiz, html`<div class="tela" data-key="sem-perfil">${tituloTela({ titulo: 'Rotina', sub: 'Escolha quem está usando o app na tela Hoje.' })}</div>`);
        return;
      }
      const agora = new Date();
      const chaveHoje = R.chaveDia(agora);
      const indice = R.indiceRotina(s.tarefas, perfil.id);
      const series = [...indice.series.values()].filter((sr) => sr.recorrente);
      const acabando = series.filter((sr) => situacao(sr, agora).tipo === 'acabando');
      const ativos = series.filter((sr) => situacao(sr, agora).tipo !== 'encerrado');
      const porArea = s.categorias
        .map((c) => ({ area: c, series: series.filter((sr) => sr.categoriaId === c.id).sort((a, b) => (situacao(a, agora).tipo === 'encerrado') - (situacao(b, agora).tipo === 'encerrado') || a.padrao.horarios[0]?.localeCompare(b.padrao.horarios[0] ?? '') || 0) }))
        .sort((a, b) => b.series.length - a.series.length || a.area.nome.localeCompare(b.area.nome, 'pt-BR'));

      const sub = series.length
        ? `${plural(ativos.length, 'hábito ativo', 'hábitos ativos')} em ${plural(new Set(ativos.map((x) => x.categoriaId)).size, 'área', 'áreas')}${acabando.length ? ` · ${plural(acabando.length, 'acaba', 'acabam')} nos próximos 7 dias` : ''}.`
        : 'Nenhum hábito ainda. Comece por uma ideia abaixo ou crie o seu.';

      morph(
        raiz,
        html`<div class="tela tela--rotina" data-key="rotina">
          ${tituloTela({
            titulo: 'Rotina',
            sub,
            acoes: html`<button type="button" class="botao botao--secundario" data-nova-area>${icone('plus', { tamanho: 16 })}Nova área</button>
              <button type="button" class="botao botao--primario" data-novo-habito>${icone('plus', { tamanho: 16 })}Novo hábito</button>`,
          })}
          <div class="grade">
            ${acabando.length
              ? html`<div class="aviso span-12" role="status" data-key="acabando">
                  <p><strong>${plural(acabando.length, 'hábito sai', 'hábitos saem')} da pauta nos próximos 7 dias:</strong> ${acabando.map((sr) => `${sr.titulo} (${situacao(sr, agora).texto.replace('acaba ', '')})`).join(', ')}.</p>
                  <button type="button" class="botao-texto" data-estender-todos>Estender ${acabando.length === 1 ? '' : 'todos '}por ${SEMANAS_PADRAO} semanas</button>
                </div>`
              : ''}
            ${porArea.map(
              ({ area, series: lista }) => html`<section class="painel area span-12 tom-${tomArea(area.id)}" aria-labelledby="area-${area.id}" data-key="a${area.id}">
                <div class="painel__topo">
                  <span class="ponto" aria-hidden="true"></span>
                  <h2 id="area-${area.id}" class="painel__titulo">${area.nome}</h2>
                  <span class="conta">${lista.length}</span>
                  ${area.descricao ? html`<span class="area__descricao">${area.descricao}</span>` : ''}
                  <span class="painel__fim">
                    <button type="button" class="botao-texto" data-novo-na-area="${area.id}">Novo hábito aqui</button>
                    <button type="button" class="botao-icone botao-icone--p" data-mais-area="${area.id}" aria-label="Mais ações: área ${area.nome}" aria-haspopup="menu" aria-expanded="false">${icone('ellipsis', { tamanho: 18 })}</button>
                  </span>
                </div>
                ${lista.length
                  ? html`<div class="habitos-cab" aria-hidden="true"><span>Hábito</span><span>Sequência</span><span>Na pauta</span></div>
                      <ul class="habitos">${lista.map((sr) => linhaHabito(sr, chaveHoje, agora, destacar === sr.chave))}</ul>`
                  : html`<p class="painel__vazio">Nenhum hábito nesta área.</p>`}
              </section>`
            )}
            ${avulsos(indice, agora)}
            ${ideias(indice)}
          </div>
        </div>`
      );

      // veio de "Editar o hábito" nos detalhes de um item: abre o formulário dele
      if (destacar && !abriuDaUrl) {
        abriuDaUrl = true;
        const serie = indice.series.get(destacar);
        if (serie) {
          raiz.querySelector(`[data-chave="${CSS.escape(destacar)}"]`)?.scrollIntoView({ block: 'center' });
          abrirFormHabito({ serie });
        }
        substituirQuery({});
      }
    };

    const serieDaChave = (chave) => {
      const s = store.get();
      const perfil = perfilAtual(s);
      return perfil ? R.indiceRotina(s.tarefas, perfil.id).series.get(chave) : null;
    };

    raiz.addEventListener('click', async (e) => {
      const s = store.get();
      if (e.target.closest('[data-novo-habito]')) return abrirFormHabito();
      if (e.target.closest('[data-nova-area]')) return abrirFormArea();
      const naArea = e.target.closest('[data-novo-na-area]');
      if (naArea) {
        const area = s.categorias.find((c) => c.id === Number(naArea.dataset.novoNaArea));
        return abrirFormHabito({ sugestao: { titulo: '', area: area?.nome, dias: R.DIAS_UTEIS, horarios: ['08:00'] } });
      }
      const sug = e.target.closest('[data-sugestao]');
      if (sug) return abrirFormHabito({ sugestao: R.SUGESTOES[Number(sug.dataset.sugestao)] });
      const editar = e.target.closest('[data-editar]');
      if (editar) {
        const serie = serieDaChave(editar.dataset.editar);
        if (serie) abrirFormHabito({ serie });
        return;
      }
      const estender = e.target.closest('[data-estender]');
      if (estender) {
        const serie = serieDaChave(estender.dataset.estender);
        if (serie) {
          estender.disabled = true;
          await estenderHabito(serie, SEMANAS_PADRAO).catch(() => {});
        }
        return;
      }
      if (e.target.closest('[data-estender-todos]')) {
        const perfil = perfilAtual(s);
        const agora = new Date();
        const lista = [...R.indiceRotina(s.tarefas, perfil.id).series.values()].filter((sr) => sr.recorrente && situacao(sr, agora).tipo === 'acabando');
        for (const serie of lista) await estenderHabito(serie, SEMANAS_PADRAO).catch(() => {});
        return;
      }
      const mais = e.target.closest('[data-mais-habito]');
      if (mais) {
        const serie = serieDaChave(mais.dataset.maisHabito);
        if (!serie) return;
        const abertos = R.proximosAbertos(serie).length;
        abrirMenu(mais, [
          { rotulo: 'Editar hábito', icone: 'pencil', acao: () => abrirFormHabito({ serie }) },
          { rotulo: `Estender ${SEMANAS_PADRAO} semanas`, icone: 'calendar-plus', acao: () => estenderHabito(serie, SEMANAS_PADRAO).catch(() => {}) },
          ...(abertos
            ? [
                { separador: true },
                {
                  rotulo: 'Encerrar hábito',
                  icone: 'square',
                  perigo: true,
                  acao: async () => {
                    const ok = await confirmar({
                      titulo: `Encerrar ${serie.titulo}?`,
                      mensagem: html`<p>Os <strong>${plural(abertos, 'próximo item', 'próximos itens')}</strong> saem da pauta. O que você já fez continua no Progresso.</p>`,
                      confirmar: 'Encerrar hábito',
                      perigo: true,
                    });
                    if (ok) encerrarHabito(serie).catch(() => {});
                  },
                },
              ]
            : []),
        ]);
        return;
      }
      const maisArea = e.target.closest('[data-mais-area]');
      if (maisArea) {
        const area = s.categorias.find((c) => c.id === Number(maisArea.dataset.maisArea));
        if (!area) return;
        abrirMenu(maisArea, [
          { rotulo: 'Editar área', icone: 'pencil', acao: () => abrirFormArea({ area }) },
          { separador: true },
          { rotulo: 'Excluir área', icone: 'trash-2', perigo: true, acao: () => confirmarExclusaoArea(area) },
        ]);
      }
    });

    desenhar(estado);
    return {
      atualizar(s, q) {
        if (q?.habito && q.habito !== destacar) {
          destacar = q.habito;
          abriuDaUrl = false;
        }
        desenhar(s);
      },
    };
  },
};
