// Progresso. Pergunta da tela: "estou sendo constante?"
// Constância = feitos ÷ (feitos + não marcados); o que foi pulado fica de fora (é uma escolha, não uma falha).
// A frase do título diz o achado com a base de cada número ("nos últimos 30 dias", "dos 30 anteriores").
import { html, morph } from '../core/html.js';
import { diaMes, mesCurto, capitalizar, dataCompleta } from '../core/format.js';
import { tomArea } from '../domain/enums.js';
import * as R from '../domain/rotina.js';
import { store, perfilAtual } from '../state.js';
import { tituloTela, ponto, contagem } from '../ui/pecas.js';

const pct = (x) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`);

function numeros(est) {
  const melhor = [...est.habitos].sort((a, b) => b.atual - a.atual)[0];
  return html`<section class="numeros span-12" aria-label="Resumo dos últimos ${est.janela} dias" data-key="numeros">
    <div class="numero">
      <span class="numero__rotulo">Constância</span>
      <span class="numero__valor">${est.geral.taxa === null ? '—' : Math.round(est.geral.taxa * 100)}<span class="numero__unidade">%</span></span>
      <span class="numero__nota">últimos ${est.janela} dias</span>
    </div>
    <div class="numero">
      <span class="numero__rotulo">Itens feitos</span>
      <span class="numero__valor">${est.geral.feitos}<span class="numero__unidade">de ${est.geral.base}</span></span>
      <span class="numero__nota">pulados ficam de fora</span>
    </div>
    <div class="numero">
      <span class="numero__rotulo">Dias completos</span>
      <span class="numero__valor">${est.diasCompletos}<span class="numero__unidade">de ${est.diasComPauta}</span></span>
      <span class="numero__nota">dias com tudo feito</span>
    </div>
    <div class="numero">
      <span class="numero__rotulo">Maior sequência ativa</span>
      <span class="numero__valor">${melhor?.atual ?? 0}<span class="numero__unidade">${melhor ? melhor.serie.unidade[melhor.atual === 1 ? 0 : 1] : 'dias'}</span></span>
      <span class="numero__nota">${melhor?.atual ? melhor.serie.titulo : 'nenhuma ainda'}</span>
    </div>
  </section>`;
}

/** Mapa de constância: uma célula por dia, semanas em colunas (segunda em cima). */
function mapa(est) {
  const semanas = [];
  for (let i = 0; i < est.mapa.length; i += 7) semanas.push(est.mapa.slice(i, i + 7));
  const nivel = (d) => {
    if (d.futuro) return 'futuro';
    if (d.taxa === null) return d.total ? 'pulado' : 'vazio';
    if (d.taxa >= 1) return 'n4';
    if (d.taxa >= 0.75) return 'n3';
    if (d.taxa >= 0.5) return 'n2';
    if (d.taxa > 0) return 'n1';
    return 'n0';
  };
  let mesAnterior = -1;
  return html`<section class="painel mapa span-8" aria-labelledby="mapa-t" data-key="mapa">
    <div class="painel__topo">
      <h2 id="mapa-t" class="painel__titulo">Constância dia a dia</h2>
      <span class="painel__fim mapa__legenda" aria-hidden="true">Menos ${['n0', 'n1', 'n2', 'n3', 'n4'].map((n) => html`<i class="mapa__dia mapa__dia--${n}"></i>`)} Mais</span>
    </div>
    <div class="mapa__corpo">
      <div class="mapa__semana-rotulos" aria-hidden="true"><span>Seg</span><span></span><span>Qua</span><span></span><span>Sex</span><span></span><span>Dom</span></div>
      <div class="mapa__grade" role="img" aria-label="Constância das últimas ${semanas.length} semanas. ${est.mapa.filter((d) => d.taxa === 1).length} dias completos.">
        ${semanas.map((sem, i) => {
          const m = sem[0].data.getMonth();
          const rotulo = m !== mesAnterior ? capitalizar(mesCurto(sem[0].data)) : '';
          mesAnterior = m;
          return html`<div class="mapa__coluna" data-key="w${i}">
            <span class="mapa__mes" aria-hidden="true">${rotulo}</span>
            ${sem.map(
              (d) => html`<span class="mapa__dia mapa__dia--${nivel(d)}${d.hoje ? ' mapa__dia--hoje' : ''}" data-dica="${capitalizar(dataCompleta(d.data))}: ${d.futuro ? 'ainda não chegou' : d.total ? `${d.feitos} de ${d.total} feitos` : 'nada na pauta'}"></span>`
            )}
          </div>`;
        })}
      </div>
    </div>
  </section>`;
}

function periodos(est) {
  const validos = est.porPeriodo;
  return html`<section class="painel periodos span-4" aria-labelledby="per-t" data-key="periodos">
    <div class="painel__topo"><h2 id="per-t" class="painel__titulo">Por período do dia</h2><span class="painel__fim">${est.janela} dias</span></div>
    <ul class="barras">
      ${validos.map(
        (p) => html`<li class="barra" data-key="${p.id}">
          <div class="barra__linha"><span>${p.rotulo}</span><span class="barra__valor">${pct(p.taxa)}</span></div>
          <span class="barra__trilho"><span class="barra__cheio" style="width:${Math.round((p.taxa ?? 0) * 100)}%"></span></span>
          <span class="barra__nota">${p.base ? `${p.feitos} de ${p.base} itens` : 'sem itens'}</span>
        </li>`
      )}
    </ul>
  </section>`;
}

const ESTADO_DIA = { feito: 'feito', parcial: 'em parte', perdido: 'não feito', pulado: 'pulado', hoje: 'hoje, em aberto', livre: 'fora da pauta', futuro: 'ainda não chegou' };

function tabelaHabitos(est, s) {
  return html`<section class="painel habitos span-12" aria-labelledby="hab-t" data-key="habitos">
    <div class="painel__topo"><h2 id="hab-t" class="painel__titulo">Hábitos</h2><span class="conta">${est.habitos.length}</span><span class="painel__fim">do mais ao menos constante, ${est.janela} dias</span></div>
    ${est.habitos.length
      ? html`<table class="tabela">
          <thead>
            <tr><th scope="col">Hábito</th><th scope="col" class="tabela__ultimos">Últimos 14 dias</th><th scope="col" class="num">Sequência</th><th scope="col" class="num">Constância</th></tr>
          </thead>
          <tbody>
            ${est.habitos.map((h) => {
              const area = s.categorias.find((c) => c.id === h.serie.categoriaId);
              return html`<tr data-key="${h.serie.chave}">
                <th scope="row"><span class="tabela__habito">${ponto(h.serie.categoriaId)}<span><span class="tabela__nome">${h.serie.titulo}</span><span class="tabela__sub">${area?.nome ?? ''} · ${R.textoDias(h.serie.padrao.dias)}</span></span></span></th>
                <td class="tabela__ultimos">
                  <span class="ultimos tom-${tomArea(h.serie.categoriaId)}" role="img" aria-label="${h.ultimos.filter((u) => u.estado === 'feito').length} feitos nos últimos 14 dias">
                    ${h.ultimos.map((u) => html`<i class="ultimos__dia ultimos__dia--${u.estado}" data-dica="${diaMes(u.data)}: ${ESTADO_DIA[u.estado]}"></i>`)}
                  </span>
                </td>
                <td class="num">${h.atual ? contagem(h.atual, h.serie.unidade) : '—'}<span class="tabela__sub">melhor: ${h.melhor}</span></td>
                <td class="num">${pct(h.taxa)}<span class="tabela__sub">${h.feitos} de ${h.base}</span></td>
              </tr>`;
            })}
          </tbody>
        </table>`
      : html`<p class="painel__vazio">Os hábitos aparecem aqui depois do primeiro dia na pauta.</p>`}
  </section>`;
}

function diasSemana(est) {
  const piorIdx = est.porDiaSemana.reduce((m, d, i, arr) => (d.taxa !== null && (arr[m].taxa === null || d.taxa < arr[m].taxa) ? i : m), 0);
  const pior = est.porDiaSemana[piorIdx];
  return html`<section class="painel semana-graf span-6" aria-labelledby="dsem-t" data-key="dsem">
    <div class="painel__topo"><h2 id="dsem-t" class="painel__titulo">Por dia da semana</h2><span class="painel__fim">${pior?.taxa !== null && pior ? `${R.NOMES_DIA[pior.dia]} é o mais difícil: ${pct(pior.taxa)}` : ''}</span></div>
    <div class="grafico" data-grafico-semana data-morph-manter></div>
  </section>`;
}

function areasPainel(est, s) {
  const linhas = est.porArea
    .map((a) => ({ ...a, area: s.categorias.find((c) => c.id === a.categoriaId) }))
    .filter((a) => a.area)
    .sort((a, b) => b.taxa - a.taxa);
  return html`<section class="painel areas-graf span-6" aria-labelledby="ar-t" data-key="areas">
    <div class="painel__topo"><h2 id="ar-t" class="painel__titulo">Por área</h2><span class="painel__fim">${est.janela} dias</span></div>
    <ul class="barras">
      ${linhas.map(
        (a) => html`<li class="barra tom-${tomArea(a.categoriaId)}" data-key="a${a.categoriaId}">
          <div class="barra__linha"><span class="area-nome"><span class="ponto"></span>${a.area.nome}</span><span class="barra__valor">${pct(a.taxa)}</span></div>
          <span class="barra__trilho"><span class="barra__cheio barra__cheio--tom" style="width:${Math.round(a.taxa * 100)}%"></span></span>
        </li>`
      )}
    </ul>
  </section>`;
}

function desenharGraficoSemana(raiz, est) {
  const el = raiz.querySelector('[data-grafico-semana]');
  if (!el || !window.Charts) return;
  const valores = est.porDiaSemana.map((d) => (d.taxa === null ? 0 : Math.round(d.taxa * 100)));
  const assinatura = valores.join();
  if (el.dataset.assinatura === assinatura) return;
  el.dataset.assinatura = assinatura;
  const hoje = R.ORDEM_SEMANA.indexOf(new Date().getDay());
  window.Charts.bars(el, {
    labels: est.porDiaSemana.map((d) => d.rotulo),
    values: valores,
    format: (v) => `${v}%`,
    height: 190,
    highlight: hoje,
    ariaLabel: `Constância por dia da semana: ${est.porDiaSemana.map((d) => `${d.rotulo} ${pct(d.taxa)}`).join(', ')}`,
  });
}

export default {
  titulo: 'Progresso',
  montar(raiz, { estado }) {
    const desenhar = (s) => {
      const perfil = perfilAtual(s);
      if (!perfil) {
        morph(raiz, html`<div class="tela" data-key="sem-perfil">${tituloTela({ titulo: 'Progresso', sub: 'Escolha quem está usando o app na tela Hoje.' })}</div>`);
        return;
      }
      const indice = R.indiceRotina(s.tarefas, perfil.id, s.habitos);
      const est = R.estatisticas(indice);
      morph(
        raiz,
        html`<div class="tela tela--progresso" data-key="progresso">
          ${tituloTela({ titulo: 'Progresso', sub: R.achado(est) })}
          <div class="grade">
            ${numeros(est)}
            ${mapa(est)}
            ${periodos(est)}
            ${tabelaHabitos(est, s)}
            ${diasSemana(est)}
            ${areasPainel(est, s)}
          </div>
        </div>`
      );
      if (window.Charts) desenharGraficoSemana(raiz, est);
      else window.addEventListener('load', () => desenharGraficoSemana(raiz, est), { once: true });
    };
    desenhar(estado);
    return { atualizar: desenhar };
  },
};

