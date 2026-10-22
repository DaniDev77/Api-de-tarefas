// Hoje: a pauta do dia. Pergunta da tela: "o que falta hoje, e o que vem agora?"
// - a saudação diz o fato do dia;
// - a semana mostra, em anéis, quanto de cada dia foi feito (e troca o dia);
// - o Ritmo do dia põe cada item no seu horário, com a linha do agora;
// - a lista, por manhã, tarde e noite, é onde se marca (segurando o botão);
// - ao lado: o que fazer agora, os compromissos avulsos e as sequências.
import { html, raw, morph } from '../core/html.js';
import { navegar, montarHash } from '../core/router.js';
import { saudacao, dataCompleta, capitalizar, hora, somarDias, inicioDoDia, diaMes, diaSemanaCurto, plural, diferencaDias } from '../core/format.js';
import { ler } from '../core/storage.js';
import { STATUS, estaAberta, estaFeita, foiPulada, tomArea } from '../domain/enums.js';
import * as R from '../domain/rotina.js';
import { store, perfilAtual, mudarStatus, adiarItem, excluirTarefa, encerrarFoco, restanteFoco } from '../state.js';
import { icone } from '../ui/icons.js';
import { anel, ponto, contagem, textoSequencia } from '../ui/pecas.js';
import { abrirMenu } from '../ui/menu.js';
import { ligarSegurar } from '../ui/segurar.js';
import { toast } from '../ui/toast.js';
import { abrirDetalhesItem } from '../forms/item-form.js';
import { relogio } from './foco.js';
import { adicaoRapida } from './adicao.js';
import { boasVindas, precisaBoasVindas } from './boas-vindas.js';

/** Lê ?dia=2026-10-21; sem ele (ou inválido), hoje. */
const diaDaQuery = (q) => R.diaDaChave(q?.dia) ?? inicioDoDia(new Date());

// ------------------------------------------------------------------ peças da tela

function cabecalho(perfil, dia, r, ehHoje, agora) {
  const primeiroNome = perfil.nome.trim().split(/\s+/)[0];
  const quando = capitalizar(dataCompleta(dia));
  let titulo;
  let sub;
  if (ehHoje) {
    const fato = r.total === 0 ? 'Dia livre na pauta.' : r.abertos === 0 ? 'Dia completo.' : r.abertos === 1 ? 'Falta 1 item hoje.' : `Faltam ${r.abertos} itens hoje.`;
    titulo = `${saudacao(agora)}, ${primeiroNome}. ${fato}`;
    const partes = [quando];
    if (r.total) partes.push(`${r.feitos} de ${r.total} feitos`);
    if (r.andamento) partes.push(`fazendo agora: ${r.andamento.titulo}`);
    else if (r.proximo) partes.push(`próximo: ${r.proximo.titulo} às ${hora(r.proximo.dataLimite)}`);
    sub = partes.join(' · ');
  } else {
    titulo = quando;
    const futuro = dia > agora;
    sub = r.total === 0 ? 'Nada na pauta deste dia.' : futuro ? `${plural(r.total, 'item', 'itens')} na pauta` : `${r.feitos} de ${r.total} feitos${r.abertos ? ` · ${r.abertos} sem marcar` : ''}`;
  }
  return html`<header class="saudacao" data-key="saudacao">
    <h1 class="saudacao__h1">${titulo}</h1>
    <p class="saudacao__sub">${sub}${ehHoje ? '' : html` · <a class="botao-texto" href="#/hoje">Voltar para hoje</a>`}</p>
  </header>`;
}

function semana(indice, dia, chaveHoje, agora) {
  const dias = R.diasDaSemana(dia);
  const chaveSel = R.chaveDia(dia);
  return html`<nav class="semana" aria-label="Dias da semana" data-key="semana">
    <a class="semana__seta botao-icone" href="${montarHash('hoje', { dia: R.chaveDia(somarDias(dia, -7)) })}" aria-label="Semana anterior">${icone('chevron-left', { tamanho: 18 })}</a>
    <ol class="semana__dias">
      ${dias.map((d) => {
        const k = R.chaveDia(d);
        const itens = indice.porDia.get(k) ?? [];
        const t = R.taxaDoDia(itens, k, chaveHoje, agora);
        const ehHoje = k === chaveHoje;
        const texto = !t ? 'nada na pauta' : t.futuro ? plural(t.total, 'item', 'itens') : t.taxa === null ? 'tudo pulado' : `${t.feitos} de ${t.total} feitos`;
        return html`<li data-key="d${k}">
          <a class="dia${ehHoje ? ' dia--hoje' : ''}${k === chaveSel ? ' ativo' : ''}${k > chaveHoje ? ' dia--futuro' : ''}" href="${ehHoje ? '#/hoje' : montarHash('hoje', { dia: k })}" ${k === chaveSel ? html`aria-current="date"` : ''} aria-label="${capitalizar(dataCompleta(d))}: ${texto}">
            <span class="dia__nome">${R.CURTOS_DIA[d.getDay()]}</span>
            <span class="dia__num">${d.getDate()}</span>
            ${anel(t?.taxa ?? null, { tamanho: 26, espessura: 3 })}
          </a>
        </li>`;
      })}
    </ol>
    <a class="semana__seta botao-icone" href="${montarHash('hoje', { dia: R.chaveDia(somarDias(dia, 7)) })}" aria-label="Próxima semana">${icone('chevron-right', { tamanho: 18 })}</a>
  </nav>`;
}

/** O Ritmo do dia: cada item no seu horário, numa régua de 6h a meia-noite, com a linha do agora. */
function ritmo(itens, r, ehHoje, agora) {
  const minutos = itens.map((t) => R.minutosDoDia(t.dataLimite));
  const ini = Math.min(360, Math.floor(Math.min(...minutos, 360) / 60) * 60);
  const fim = 1440;
  const pos = (m) => ((m - ini) / (fim - ini)) * 100;
  const marcas = [];
  for (let h = Math.ceil(ini / 180) * 180; h <= fim; h += 180) marcas.push(h);

  // itens muito próximos vão para linhas diferentes, para não se cobrirem
  const faixas = [];
  const pontos = itens.map((t) => {
    const p = pos(R.minutosDoDia(t.dataLimite));
    let faixa = faixas.findIndex((ultimo) => p - ultimo >= 2.4);
    if (faixa === -1) faixa = faixas.length < 3 ? faixas.length : faixas.length - 1;
    faixas[faixa] = p;
    return { t, p, faixa };
  });
  const minAgora = R.minutosDoDia(agora);
  const mostrarAgora = ehHoje && minAgora >= ini && minAgora <= fim;
  const resumoA11y = `${r.feitos} de ${r.total} feitos${mostrarAgora ? `; agora são ${hora(agora)}` : ''}`;

  return html`<section class="painel ritmo" aria-labelledby="ritmo-t" data-key="ritmo">
    <div class="painel__topo">
      <h2 id="ritmo-t" class="painel__titulo">Ritmo do dia</h2>
      <span class="ritmo__legenda" aria-hidden="true">
        <span><i class="ritmo__mini ritmo__mini--feito"></i>Feito</span>
        <span><i class="ritmo__mini"></i>A fazer</span>
        <span><i class="ritmo__mini ritmo__mini--pulado"></i>Pulado</span>
      </span>
      <span class="painel__fim ritmo__conta">${r.total ? `${r.feitos} de ${r.total}` : 'Sem itens'}</span>
    </div>
    <div class="ritmo__regua" role="img" aria-label="Ritmo do dia: ${resumoA11y}" style="--faixas:${Math.max(1, faixas.length)}">
      <div class="ritmo__trilho">
        ${marcas.map((m) => html`<span class="ritmo__hora" style="left:${pos(m)}%" data-key="h${m}">${m === 1440 ? '24h' : `${m / 60}h`}</span>`)}
        ${pontos.map(({ t, p, faixa }) => {
          const estado = estaFeita(t) ? 'feito' : foiPulada(t) ? 'pulado' : ehHoje && t.dataLimite < agora ? 'atrasado' : 'aberto';
          return html`<span class="ritmo__ponto tom-${tomArea(t.categoriaId)} ritmo__ponto--${estado}" style="left:${p}%;--faixa:${faixa}" data-ir="${t.id}" data-key="r${t.id}" data-dica="${R.horaTexto(t.dataLimite)} · ${t.titulo}"></span>`;
        })}
        ${mostrarAgora ? html`<span class="ritmo__agora" style="left:${pos(minAgora)}%" data-key="agora"><span class="ritmo__agora-rotulo">${hora(agora)}</span></span>` : ''}
      </div>
    </div>
  </section>`;
}

function linhaItem(t, indice, ehHoje, agora, s) {
  const serie = R.serieDe(indice, t);
  const pos = R.posicaoNoDia(indice, t);
  const categoria = s.categorias.find((c) => c.id === t.categoriaId);
  const feito = estaFeita(t);
  const pulado = foiPulada(t);
  const andamento = t.status === STATUS.EM_ANDAMENTO;
  const atrasado = estaAberta(t) && t.dataLimite < agora;
  const estado = feito ? 'feito' : pulado ? 'pulado' : andamento ? 'andamento' : atrasado ? (ehHoje ? 'atrasado' : 'perdido') : 'aberto';

  const meta = [];
  meta.push(html`<span class="area-nome">${ponto(t.categoriaId)}${categoria?.nome ?? 'Sem área'}</span>`);
  if (pos.de > 1) meta.push(html`<span>${pos.n} de ${pos.de}</span>`);
  if (estado === 'andamento') meta.push(html`<span class="item__estado">fazendo agora</span>`);
  else if (estado === 'atrasado') meta.push(html`<span class="item__estado item__estado--aviso">passou do horário</span>`);
  else if (estado === 'perdido') meta.push(html`<span class="item__estado">não marcado</span>`);
  else if (estado === 'pulado') meta.push(html`<span class="item__estado">pulado</span>`);
  else if (serie?.recorrente) {
    const { atual } = R.sequencias(serie, R.chaveDia(agora));
    if (atual >= 2) meta.push(html`<span>${textoSequencia(atual, serie.unidade)}</span>`);
  }

  const acao = feito ? `Desmarcar ${t.titulo}` : `Marcar ${t.titulo} das ${R.horaTexto(t.dataLimite)} como feito`;
  return html`<li class="item tom-${tomArea(t.categoriaId)} item--${estado}" data-key="t${t.id}" data-id="${t.id}">
    <span class="item__hora">${R.horaTexto(t.dataLimite)}</span>
    <button type="button" class="item__corpo" data-abrir="${t.id}">
      <span class="item__titulo">${t.titulo}</span>
      <span class="item__meta">${meta.map((m, i) => html`${i ? html`<span class="item__sep" aria-hidden="true">·</span>` : ''}${m}`)}</span>
    </button>
    <button type="button" class="botao-icone item__mais" data-mais="${t.id}" aria-label="Mais ações: ${t.titulo}" aria-haspopup="menu" aria-expanded="false">${icone('ellipsis', { tamanho: 18 })}</button>
    <button type="button" class="marcar" data-marcar="${t.id}" aria-pressed="${feito}" aria-label="${acao}">
      <svg class="marcar__svg" viewBox="0 0 40 40" aria-hidden="true">
        <circle class="marcar__fundo" cx="20" cy="20" r="17"/>
        <circle class="marcar__carga" cx="20" cy="20" r="17" transform="rotate(-90 20 20)"/>
        ${pulado ? raw('<path class="marcar__pulo" d="M14 20h12"/>') : raw('<path class="marcar__check" d="M13.5 20.5l4.3 4.3 8.7-9"/>')}
      </svg>
    </button>
  </li>`;
}

function pauta(itens, indice, ehHoje, agora, s, dia) {
  const grupos = R.PERIODOS.map((p) => ({ ...p, itens: itens.filter((t) => R.periodoDe(t.dataLimite).id === p.id) })).filter((g) => g.itens.length);
  return html`<section class="pauta" aria-labelledby="pauta-t" data-key="pauta">
    <h2 id="pauta-t" class="sr-only">Pauta de ${dataCompleta(dia)}</h2>
    ${grupos.length
      ? grupos.map((g) => {
          const validos = g.itens.filter((t) => !foiPulada(t));
          return html`<section class="periodo" aria-labelledby="per-${g.id}" data-key="p${g.id}">
            <header class="periodo__topo">
              <h3 id="per-${g.id}" class="periodo__titulo">${g.rotulo}</h3>
              <span class="periodo__conta">${validos.filter(estaFeita).length} de ${validos.length}</span>
            </header>
            <ul class="itens">
              ${g.itens.map((t) => linhaItem(t, indice, ehHoje, agora, s))}
            </ul>
          </section>`;
        })
      : html`<p class="pauta__vazia" data-key="vazia">${ehHoje ? 'Nada na pauta hoje. Escreva abaixo o que quer fazer e quando.' : 'Nada na pauta deste dia.'}</p>`}
  </section>`;
}

function painelAgora(r, itens, ehHoje, agora, s, dia) {
  let corpo;
  const f = s.foco;
  if (!ehHoje) {
    const pulados = itens.filter(foiPulada).length;
    return html`<section class="painel agora" aria-labelledby="agora-t" data-key="agora">
      <div class="painel__topo"><h2 id="agora-t" class="painel__titulo">Resumo do dia</h2></div>
      <dl class="resumo-dia">
        <div><dt>Feitos</dt><dd>${r.feitos}</dd></div>
        <div><dt>${dia > agora ? 'A fazer' : 'Sem marcar'}</dt><dd>${r.abertos}</dd></div>
        <div><dt>Pulados</dt><dd>${pulados}</dd></div>
      </dl>
    </section>`;
  }
  if (r.andamento) {
    const t = r.andamento;
    const comFoco = f?.tarefaId === t.id;
    corpo = html`<p class="agora__rotulo">Fazendo agora</p>
      <p class="agora__titulo">${t.titulo}</p>
      <p class="agora__meta">${comFoco ? html`Foco: <span data-relogio-foco>${relogio(restanteFoco(f))}</span> restantes${f.pausado ? ' (pausado)' : ''}` : `Desde as ${R.horaTexto(t.dataLimite)}`}</p>
      <div class="agora__acoes">
        <a class="botao botao--primario botao--p" href="#/foco?tarefa=${t.id}">${icone('timer', { tamanho: 16 })}${comFoco ? 'Abrir o foco' : 'Começar foco'}</a>
        <button type="button" class="botao botao--secundario botao--p" data-feito="${t.id}">Marcar como feito</button>
      </div>`;
  } else if (r.atrasados.length) {
    const t = r.atrasados[0];
    corpo = html`<p class="agora__rotulo">Ficou para trás</p>
      <p class="agora__titulo">${t.titulo}</p>
      <p class="agora__meta">Era às ${R.horaTexto(t.dataLimite)}${r.atrasados.length > 1 ? ` · e mais ${r.atrasados.length - 1}` : ''}</p>
      <div class="agora__acoes">
        <button type="button" class="botao botao--primario botao--p" data-feito="${t.id}">${icone('check', { tamanho: 16 })}Fiz</button>
        <button type="button" class="botao botao--secundario botao--p" data-pular="${t.id}">Pular hoje</button>
        <button type="button" class="botao botao--fantasma botao--p" data-adiar="${t.id}">Adiar 1 h</button>
      </div>`;
  } else if (r.proximo) {
    const t = r.proximo;
    const falta = Math.round((t.dataLimite - agora) / 60000);
    const emQuanto = falta < 1 ? 'agora' : falta < 60 ? `em ${falta} min` : `em ${Math.floor(falta / 60)} h${falta % 60 ? ` ${falta % 60} min` : ''}`;
    corpo = html`<p class="agora__rotulo">Próximo</p>
      <p class="agora__titulo">${t.titulo}</p>
      <p class="agora__meta">${R.horaTexto(t.dataLimite)} · ${emQuanto}</p>
      <div class="agora__acoes">
        <a class="botao botao--primario botao--p" href="#/foco?tarefa=${t.id}">${icone('timer', { tamanho: 16 })}Começar foco</a>
        <button type="button" class="botao botao--secundario botao--p" data-feito="${t.id}">Já fiz</button>
      </div>`;
  } else if (r.total) {
    corpo = html`<p class="agora__titulo">Dia completo.</p><p class="agora__meta">${r.feitos} de ${r.total} feitos. Amanhã a pauta continua.</p>`;
  } else {
    corpo = html`<p class="agora__titulo">Nada na pauta hoje.</p>
      <div class="agora__acoes"><button type="button" class="botao botao--secundario botao--p" data-focar-adicao>${icone('plus', { tamanho: 16 })}Adicionar</button></div>`;
  }
  return html`<section class="painel agora" aria-labelledby="agora-t" data-key="agora">
    <div class="painel__topo"><h2 id="agora-t" class="painel__titulo">Agora</h2><span class="painel__fim">${hora(agora)}</span></div>
    ${corpo}
  </section>`;
}

function painelCompromissos(indice, agora) {
  // itens avulsos (que não fazem parte de um hábito) dos próximos 7 dias
  const limite = somarDias(inicioDoDia(agora), 8);
  const lista = indice.itens.filter((t) => estaAberta(t) && t.dataLimite >= inicioDoDia(agora) && t.dataLimite < limite && !R.serieDe(indice, t)?.recorrente).slice(0, 4);
  const quando = (d) => {
    const dias = diferencaDias(d, agora);
    const h = R.horaTexto(d);
    if (dias === 0) return `hoje, ${h}`;
    if (dias === 1) return `amanhã, ${h}`;
    return `${diaSemanaCurto(d)}, ${diaMes(d)}, ${h}`;
  };
  return html`<section class="painel compromissos" aria-labelledby="comp-t" data-key="comp">
    <div class="painel__topo"><h2 id="comp-t" class="painel__titulo">Compromissos</h2><span class="painel__fim">próximos 7 dias</span></div>
    ${lista.length
      ? html`<ul class="lista-curta">
          ${lista.map(
            (t) => html`<li data-key="c${t.id}"><button type="button" class="lista-curta__linha" data-abrir="${t.id}">${ponto(t.categoriaId)}<span class="lista-curta__nome">${t.titulo}</span><span class="lista-curta__valor">${quando(t.dataLimite)}</span></button></li>`
          )}
        </ul>`
      : html`<p class="painel__vazio">Nenhum compromisso avulso. Escreva "dentista amanhã 14h" para marcar um.</p>`}
  </section>`;
}

function painelSequencias(indice, chaveHoje) {
  const lista = [...indice.series.values()]
    .filter((sr) => sr.recorrente)
    .map((sr) => ({ sr, ...R.sequencias(sr, chaveHoje) }))
    .filter((x) => x.atual >= 2)
    .sort((a, b) => b.atual - a.atual)
    .slice(0, 5);
  return html`<section class="painel sequencias" aria-labelledby="seq-t" data-key="seq">
    <div class="painel__topo"><h2 id="seq-t" class="painel__titulo">Sequências</h2><a class="painel__fim botao-texto" href="#/progresso">Progresso</a></div>
    ${lista.length
      ? html`<ul class="lista-curta">
          ${lista.map(
            ({ sr, atual }) => html`<li data-key="s${sr.chave}"><span class="lista-curta__linha">${ponto(sr.categoriaId)}<span class="lista-curta__nome">${sr.titulo}</span><span class="lista-curta__valor">${contagem(atual, sr.unidade)}</span></span></li>`
          )}
        </ul>`
      : html`<p class="painel__vazio">Marque um hábito dois dias seguidos e a sequência aparece aqui.</p>`}
  </section>`;
}

// ------------------------------------------------------------------ a tela

export default {
  titulo: 'Hoje',
  montar(raiz, { query, estado }) {
    let dia = diaDaQuery(query);
    let abertosAntes = null;
    let chaveAntes = null;
    const adicao = adicaoRapida({ dia: () => dia });

    const desenhar = (s) => {
      const perfil = perfilAtual(s);
      const indice = perfil ? R.indiceRotina(s.tarefas, perfil.id) : null;
      if (precisaBoasVindas(s, perfil, indice)) {
        boasVindas.desenhar(raiz, s, perfil);
        return;
      }
      boasVindas.sair();

      const agora = new Date();
      const chaveHoje = R.chaveDia(agora);
      const chave = R.chaveDia(dia);
      const ehHoje = chave === chaveHoje;
      const itens = R.itensDoDia(indice, dia);
      const r = R.resumoDia(itens, agora);

      morph(
        raiz,
        html`<div class="tela tela--hoje" data-key="hoje">
          ${cabecalho(perfil, dia, r, ehHoje, agora)}
          ${semana(indice, dia, chaveHoje, agora)}
          <div class="hoje__grade" data-key="grade">
            <div class="hoje__principal" data-key="principal">
              ${ritmo(itens, r, ehHoje, agora)}
              ${pauta(itens, indice, ehHoje, agora, s, dia)}
              ${adicao.html(s)}
            </div>
            <aside class="hoje__lado" aria-label="Agora e próximos" data-key="lado">
              ${painelAgora(r, itens, ehHoje, agora, s, dia)}
              ${painelCompromissos(indice, agora)}
              ${painelSequencias(indice, chaveHoje)}
            </aside>
          </div>
        </div>`
      );
      adicao.ligar(raiz.querySelector('[data-adicao]'), s);

      // o momento em que o dia fecha: uma vez, só quando acontece agora (não ao abrir a tela)
      if (ehHoje && chaveAntes === chave && abertosAntes > 0 && r.abertos === 0 && r.total > 0) {
        toast(`Dia completo. ${r.feitos} de ${r.total} feitos.`, { tipo: 'sucesso' });
        raiz.querySelector('.saudacao')?.classList.add('saudacao--completa');
      }
      abertosAntes = r.abertos;
      chaveAntes = chave;
    };

    // ----- eventos (delegação: a lista é redesenhada, os ouvintes ficam na raiz)

    const desligarSegurar = ligarSegurar(raiz, (id) => {
      const s = store.get();
      const t = s.tarefas.find((x) => x.id === id);
      if (!t) return;
      if (estaFeita(t) || foiPulada(t)) mudarStatus(id, STATUS.A_FAZER).catch(() => {});
      else if (s.foco?.tarefaId === id) encerrarFoco({ concluir: true });
      else mudarStatus(id, STATUS.CONCLUIDA).catch(() => {});
    });

    const tarefaPorId = (id) => store.get().tarefas.find((t) => t.id === Number(id));

    raiz.addEventListener('click', (e) => {
      const abrir = e.target.closest('[data-abrir]');
      if (abrir) {
        const t = tarefaPorId(abrir.dataset.abrir);
        if (t) abrirDetalhesItem(t);
        return;
      }
      const mais = e.target.closest('[data-mais]');
      if (mais) {
        const t = tarefaPorId(mais.dataset.mais);
        if (t) menuItem(mais, t);
        return;
      }
      const feito = e.target.closest('[data-feito]');
      if (feito) {
        const id = Number(feito.dataset.feito);
        if (store.get().foco?.tarefaId === id) encerrarFoco({ concluir: true });
        else mudarStatus(id, STATUS.CONCLUIDA).catch(() => {});
        return;
      }
      const pular = e.target.closest('[data-pular]');
      if (pular) {
        mudarStatus(Number(pular.dataset.pular), STATUS.CANCELADA).catch(() => {});
        return;
      }
      const adiar = e.target.closest('[data-adiar]');
      if (adiar) {
        adiarItem(Number(adiar.dataset.adiar), 60).catch(() => {});
        return;
      }
      const ir = e.target.closest('[data-ir]');
      if (ir) destacar(Number(ir.dataset.ir));
    });

    function destacar(id) {
      const li = raiz.querySelector(`.item[data-id="${id}"]`);
      if (!li) return;
      li.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      li.classList.remove('destaque');
      void li.offsetWidth;
      li.classList.add('destaque');
      li.querySelector('.item__corpo')?.focus({ preventScroll: true });
    }

    function menuItem(ancora, t) {
      const aberto = estaAberta(t);
      abrirMenu(ancora, [
        ...(aberto ? [{ rotulo: 'Começar foco', icone: 'timer', acao: () => navegar('foco', { tarefa: t.id }) }] : []),
        ...(aberto
          ? [
              { rotulo: 'Adiar 30 min', icone: 'clock-plus', acao: () => adiarItem(t.id, 30).catch(() => {}) },
              { rotulo: 'Adiar 1 hora', icone: 'clock-plus', acao: () => adiarItem(t.id, 60).catch(() => {}) },
              { rotulo: 'Pular hoje', icone: 'skip-forward', acao: () => mudarStatus(t.id, STATUS.CANCELADA).catch(() => {}) },
            ]
          : [{ rotulo: 'Reabrir', icone: 'undo-2', acao: () => mudarStatus(t.id, STATUS.A_FAZER).catch(() => {}) }]),
        { separador: true },
        { rotulo: 'Detalhes e nota', icone: 'pencil', acao: () => abrirDetalhesItem(t) },
        { rotulo: 'Remover deste dia', icone: 'trash-2', perigo: true, acao: () => excluirTarefa(t.id) },
      ]);
    }

    desenhar(estado);

    // o "agora" anda: redesenha a cada minuto (a linha do Ritmo e o "passou do horário")
    const relogioMinuto = setInterval(() => desenhar(store.get()), 60_000);

    return {
      aceitaQuery: true,
      atualizar(s, q) {
        if (q) {
          const novo = diaDaQuery(q);
          if (R.chaveDia(novo) !== R.chaveDia(dia)) dia = novo;
        }
        desenhar(s);
      },
      focarAdicao() {
        const campo = raiz.querySelector('[data-adicao] input');
        campo?.scrollIntoView({ block: 'center' });
        campo?.focus();
      },
      teclar(e) {
        const k = e.key.toLowerCase();
        if (k === 'n') {
          e.preventDefault();
          this.focarAdicao();
        } else if (k === 't') {
          navegar('hoje');
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          if (e.target.closest?.('.semana, .itens')) return;
          const d = somarDias(dia, e.key === 'ArrowLeft' ? -1 : 1);
          const k2 = R.chaveDia(d);
          navegar('hoje', k2 === R.chaveDia(new Date()) ? {} : { dia: k2 });
        }
      },
      destruir() {
        clearInterval(relogioMinuto);
        desligarSegurar();
        adicao.destruir();
        boasVindas.sair();
      },
    };
  },
};
