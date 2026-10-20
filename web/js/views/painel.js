// Painel: a casa da equipe. Pergunta da tela: "o que vence e o que já venceu?"
// Grade de 12 colunas (77px + calhas de 16px = 1100px). Linhas: 12 · 3/3/3/3 · 9/3 · 6/6,
// e toda borda interna encontra uma borda da linha de cima.
import { html, morph } from '../core/html.js';
import { dataCompleta, saudacao, capitalizar, diaSemanaCurto, plural, hora, diaMes, mesCurto, diferencaDias, porcentagem } from '../core/format.js';
import { STATUS, PRIORIDADE_INFO, corCategoria, estaAberta } from '../domain/enums.js';
import { resumo, agendaDosProximosDias, porId, estaAtrasada, ordenarPorUrgencia } from '../domain/selectors.js';
import { icone, iconeStatus } from '../ui/icons.js';
import { avatar, seloCategoria, vazio, tituloTela, botaoNovaTarefa } from '../ui/pecas.js';
import { alterarStatus, nomeEquipe } from '../state.js';
import { abrirFormTarefa } from '../forms/tarefa-form.js';

const DIAS_REGUA = 14;
const PONTOS_VISIVEIS = 6;
const ITENS_POR_RAIA = 2;
const LINHAS_POR_LISTA = 5;

/** O fato do dia, que vai no título (h1). A maior figura da tela responde a ele. */
function fatoDoDia(r) {
  if (!r.total) return { texto: 'Comece criando a primeira tarefa.', destaque: null };
  if (r.atrasadas) return { texto: `${plural(r.atrasadas, 'tarefa está atrasada', 'tarefas estão atrasadas')}.`, destaque: 'atrasadas' };
  if (r.hoje) return { texto: `${plural(r.hoje, 'tarefa vence', 'tarefas vencem')} hoje.`, destaque: 'hoje' };
  if (r.abertas) return { texto: 'Nada vence hoje.', destaque: 'semana' };
  return { texto: 'Tudo em dia.', destaque: 'concluidas' };
}

function fraseApoio(r, agora) {
  const partes = [`${capitalizar(dataCompleta(agora))}.`];
  const resto = [];
  if (r.atrasadas && r.hoje) resto.push(`${plural(r.hoje, 'vence', 'vencem')} hoje`);
  if (r.amanha) resto.push(`${r.amanha} amanhã`);
  if (resto.length) partes.push(`${capitalizar(resto.join(' e '))}.`);
  return partes.join(' ');
}

// ------------------------------------------------------------------ régua (o gráfico principal)

function pontos(tarefas, pessoas) {
  const visiveis = tarefas.slice(0, PONTOS_VISIVEIS);
  const resto = tarefas.length - visiveis.length;
  return html`${visiveis.map((t) => {
    const p = pessoas.get(t.usuarioId);
    const forte = t.prioridade >= 3;
    return html`<button type="button" class="ponto${forte ? ' forte' : ''}" data-key="p${t.id}" data-abrir="${t.id}" data-dica="${t.titulo} (${p?.nome ?? 'sem responsável'}, ${hora(t.dataLimite)})" aria-label="${t.titulo}, prioridade ${PRIORIDADE_INFO[t.prioridade].rotulo.toLowerCase()}"></button>`;
  })}${resto > 0 ? html`<span class="ponto-mais" data-dica="${plural(resto, 'outra tarefa', 'outras tarefas')}">+${resto}</span>` : ''}`;
}

function regua(tarefas, pessoas) {
  const { atrasadas, colunas, depois } = agendaDosProximosDias(tarefas, DIAS_REGUA);
  const hoje = new Date();
  const ultima = colunas[colunas.length - 1].data;
  return html`<section class="bloco span-12 regua" aria-labelledby="regua-titulo">
    <header class="bloco__topo">
      <h2 id="regua-titulo" class="bloco__titulo">Prazos dos próximos ${DIAS_REGUA} dias</h2>
      <ul class="legenda" aria-label="Legenda">
        <li><span class="legenda__ponto forte"></span>Alta ou urgente</li>
        <li><span class="legenda__ponto"></span>Média ou baixa</li>
        <li><span class="legenda__ponto venceu"></span>Venceu</li>
      </ul>
    </header>
    <div class="regua__cartao">
      <div class="regua__trilho" role="list">
        <div class="regua__col regua__col--atrasadas" role="listitem" aria-label="${plural(atrasadas.length, 'tarefa atrasada', 'tarefas atrasadas')}">
          <div class="regua__cabeca">
            <span class="regua__semana">Venceram</span>
            <span class="regua__dia">${atrasadas.length}</span>
          </div>
          <div class="regua__pontos">${pontos(atrasadas, pessoas)}</div>
        </div>
        ${colunas.map((c) => {
          const ehHoje = diferencaDias(c.data, hoje) === 0;
          const fimDeSemana = c.data.getDay() === 0 || c.data.getDay() === 6;
          const virouMes = c.data.getDate() === 1;
          return html`<div class="regua__col${ehHoje ? ' hoje' : ''}${fimDeSemana ? ' fds' : ''}" data-key="d${c.data.getMonth()}-${c.data.getDate()}" role="listitem" aria-label="${capitalizar(dataCompleta(c.data))}: ${plural(c.tarefas.length, 'tarefa', 'tarefas')}">
            <div class="regua__cabeca">
              <span class="regua__semana">${ehHoje ? 'Hoje' : virouMes ? capitalizar(mesCurto(c.data)) : capitalizar(diaSemanaCurto(c.data))}</span>
              <span class="regua__dia">${c.data.getDate()}</span>
            </div>
            <div class="regua__pontos">${pontos(c.tarefas, pessoas)}</div>
          </div>`;
        })}
      </div>
    </div>
    ${depois ? html`<p class="bloco__rodape"><a class="botao-texto" href="#/lista">${plural(depois, 'tarefa vence', 'tarefas vencem')} depois de ${diaMes(ultima)}</a></p>` : ''}
  </section>`;
}

// ------------------------------------------------------------------ números (3/3/3/3)

function numeros(r, destaque) {
  const celulas = [
    { chave: 'atrasadas', rotulo: 'Atrasadas', valor: r.atrasadas, nota: r.atrasadas ? 'Precisam de um novo prazo ou de ajuda' : 'Nenhuma passou do prazo', href: '#/quadro?atrasadas=1', ruim: r.atrasadas > 0 },
    { chave: 'hoje', rotulo: 'Vencem hoje', valor: r.hoje, nota: r.hoje ? 'Ainda dentro do horário' : 'Nada para hoje', href: '#/lista' },
    { chave: 'semana', rotulo: 'Nos próximos 7 dias', valor: r.semana, nota: `Contando hoje, de ${plural(r.abertas, 'aberta', 'abertas')}`, href: '#/lista' },
    { chave: 'concluidas', rotulo: 'Concluídas', valor: r.concluidas, nota: `${r.taxaConclusao}% das tarefas, sem as canceladas`, href: '#/lista?status=3' },
  ];
  return celulas.map(
    (c) => html`<a class="bloco span-3 numero${c.chave === destaque ? ' numero--lider' : ''}${c.ruim ? ' numero--ruim' : ''}" href="${c.href}">
      <span class="numero__rotulo">${c.ruim ? icone('triangle-alert', { tamanho: 14 }) : ''}${c.rotulo}</span>
      <span class="numero__valor">${c.valor}</span>
      <span class="numero__nota">${c.nota}</span>
    </a>`
  );
}

// ------------------------------------------------------------------ pauta do dia (9) em três raias

function itemPauta(t, pessoas, cats, agora) {
  const atrasada = estaAtrasada(t, agora);
  const quando = atrasada && diferencaDias(t.dataLimite, agora) < 0 ? diaMes(t.dataLimite) : hora(t.dataLimite);
  return html`<li class="pauta__item" data-key="t${t.id}">
    <button type="button" class="concluir" data-concluir="${t.id}" aria-label="Concluir ${t.titulo}" data-dica="Marcar como concluída">${iconeStatus(t.status, 18)}</button>
    <div class="pauta__corpo">
      <button type="button" class="pauta__titulo" data-abrir="${t.id}">${t.titulo}</button>
      <span class="pauta__meta">
        <span class="pauta__hora${atrasada ? ' atrasada' : ''}">${quando}</span>
        ${seloCategoria(cats.get(t.categoriaId))}
        ${avatar(pessoas.get(t.usuarioId), { tamanho: 'p' })}
      </span>
    </div>
  </li>`;
}

function pautaDoDia(tarefas, pessoas, cats) {
  const agora = new Date();
  const abertas = tarefas.filter(estaAberta).sort(ordenarPorUrgencia);
  const raias = [
    { titulo: 'Atrasadas', alerta: true, itens: abertas.filter((t) => estaAtrasada(t, agora)), vazio: 'Nenhuma tarefa passou do prazo.', link: '#/quadro?atrasadas=1' },
    { titulo: 'Hoje', itens: abertas.filter((t) => !estaAtrasada(t, agora) && diferencaDias(t.dataLimite, agora) === 0), vazio: 'Nada vence hoje.', link: '#/lista' },
    { titulo: 'Amanhã', itens: abertas.filter((t) => diferencaDias(t.dataLimite, agora) === 1), vazio: 'Nada vence amanhã.', link: '#/lista' },
  ];
  return html`<section class="bloco span-9 pauta" aria-labelledby="pauta-titulo">
    <header class="bloco__topo">
      <h2 id="pauta-titulo" class="bloco__titulo">Pauta do dia</h2>
      <a class="botao-texto" href="#/quadro">Abrir o quadro</a>
    </header>
    <div class="pauta__raias">
      ${raias.map((r) => {
        const visiveis = r.itens.slice(0, ITENS_POR_RAIA);
        const resto = r.itens.length - visiveis.length;
        return html`<div class="pauta__raia">
          <h3 class="pauta__raia-titulo${r.alerta && r.itens.length ? ' alerta' : ''}">${r.titulo}</h3>
          ${visiveis.length
            ? html`<ul class="pauta__lista">${visiveis.map((t) => itemPauta(t, pessoas, cats, agora))}</ul>`
            : html`<p class="pauta__vazia">${r.vazio}</p>`}
          ${resto > 0 ? html`<a class="botao-texto pauta__mais" href="${r.link}">Mais ${resto}</a>` : ''}
        </div>`;
      })}
    </div>
  </section>`;
}

// ------------------------------------------------------------------ andamento (3)

function andamento(r) {
  const partes = [
    { status: STATUS.A_FAZER, rotulo: 'A fazer', valor: r.aFazer },
    { status: STATUS.EM_ANDAMENTO, rotulo: 'Em andamento', valor: r.emAndamento },
    { status: STATUS.CONCLUIDA, rotulo: 'Concluídas', valor: r.concluidas },
  ];
  const total = partes.reduce((s, p) => s + p.valor, 0);
  return html`<section class="bloco span-3 andamento" aria-labelledby="andamento-titulo">
    <header class="bloco__topo">
      <h2 id="andamento-titulo" class="bloco__titulo">Andamento</h2>
    </header>
    <p class="andamento__figura"><span class="andamento__valor">${r.abertas}</span> abertas</p>
    ${total
      ? html`<div class="barra-empilhada" role="img" aria-label="${partes.map((p) => `${p.rotulo}: ${p.valor}`).join(', ')}">
          ${partes.filter((p) => p.valor).map((p) => html`<span class="barra-empilhada__seg s${p.status}" style="flex-grow:${p.valor}" data-dica="${p.rotulo}: ${p.valor} (${porcentagem(p.valor, total)}%)"></span>`)}
        </div>`
      : ''}
    <dl class="tabela-legenda">
      ${partes.map(
        (p) => html`<div><dt><span class="legenda__marca s${p.status}">${iconeStatus(p.status, 13)}</span>${p.rotulo}</dt><dd class="num">${p.valor}</dd></div>`
      )}
      <div class="tabela-legenda__fraca"><dt><span class="legenda__marca s4">${iconeStatus(4, 13)}</span>Canceladas</dt><dd class="num">${r.canceladas}</dd></div>
    </dl>
  </section>`;
}

// ------------------------------------------------------------------ pessoas (6) e categorias (6)

function abertasPorPessoa(tarefas, usuarios) {
  const linhas = usuarios
    .map((u) => {
      const minhas = tarefas.filter((t) => t.usuarioId === u.id);
      return { u, abertas: minhas.filter(estaAberta).length, atrasadas: minhas.filter((t) => estaAtrasada(t)).length };
    })
    .sort((a, b) => b.abertas - a.abertas || a.u.nome.localeCompare(b.u.nome, 'pt-BR'));
  const max = Math.max(1, ...linhas.map((l) => l.abertas));
  const visiveis = linhas.slice(0, LINHAS_POR_LISTA);
  return html`<section class="bloco span-6" aria-labelledby="pessoas-titulo">
    <header class="bloco__topo">
      <h2 id="pessoas-titulo" class="bloco__titulo">Tarefas abertas por pessoa</h2>
      ${linhas.length > LINHAS_POR_LISTA ? html`<a class="botao-texto" href="#/equipe">Ver as ${linhas.length}</a>` : html`<a class="botao-texto" href="#/equipe">Equipe</a>`}
    </header>
    ${visiveis.length
      ? html`<ul class="barras">
          ${visiveis.map(
            (l) => html`<li class="barras__linha" data-key="u${l.u.id}">
              <a class="barras__nome" href="#/quadro?pessoa=${l.u.id}">${avatar(l.u, { tamanho: 'p', dica: false })}<span>${l.u.nome}</span></a>
              <span class="barras__trilho"><span class="barras__barra" style="--v:${l.abertas / max}" data-dica="${l.u.nome}: ${plural(l.abertas, 'aberta', 'abertas')}"></span><span class="barras__valor num">${l.abertas}</span></span>
              <span class="barras__alerta num">${l.atrasadas ? html`${icone('triangle-alert', { tamanho: 13 })}${l.atrasadas} atrasada${l.atrasadas > 1 ? 's' : ''}` : '—'}</span>
            </li>`
          )}
        </ul>`
      : html`<p class="bloco__vazio">Ninguém na equipe ainda. <a href="#/equipe">Adicionar pessoas</a></p>`}
  </section>`;
}

function conclusaoPorCategoria(tarefas, categorias) {
  const linhas = categorias
    .map((c) => {
      const lista = tarefas.filter((t) => t.categoriaId === c.id && t.status !== STATUS.CANCELADA);
      return { c, total: lista.length, feitas: lista.filter((t) => t.status === STATUS.CONCLUIDA).length };
    })
    .sort((a, b) => b.total - a.total || a.c.nome.localeCompare(b.c.nome, 'pt-BR'));
  const visiveis = linhas.slice(0, LINHAS_POR_LISTA);
  return html`<section class="bloco span-6" aria-labelledby="cat-titulo">
    <header class="bloco__topo">
      <h2 id="cat-titulo" class="bloco__titulo">Concluídas por categoria</h2>
      ${linhas.length > LINHAS_POR_LISTA ? html`<a class="botao-texto" href="#/categorias">Ver as ${linhas.length}</a>` : html`<a class="botao-texto" href="#/categorias">Categorias</a>`}
    </header>
    ${visiveis.length
      ? html`<ul class="medidores">
          ${visiveis.map(
            (l) => html`<li class="medidor" data-key="c${l.c.id}">
              <a class="medidor__nome" href="#/quadro?categoria=${l.c.id}"><span class="ponto-cat" style="--cor:${corCategoria(l.c)}"></span>${l.c.nome}</a>
              <span class="medidor__trilho" data-dica="${l.c.nome}: ${l.feitas} de ${l.total} concluídas"><span class="medidor__barra" style="--v:${l.total ? l.feitas / l.total : 0}"></span></span>
              <span class="medidor__valor num">${l.total ? `${l.feitas} de ${l.total}` : '—'}</span>
            </li>`
          )}
        </ul>`
      : html`<p class="bloco__vazio">Nenhuma categoria ainda. <a href="#/categorias">Criar categorias</a></p>`}
  </section>`;
}

export default {
  titulo: 'Painel',
  montar(raiz, { estado }) {
    let ultimo = estado;
    const desenhar = (s) => {
      ultimo = s;
      const r = resumo(s.tarefas);
      const pessoas = porId(s.usuarios);
      const cats = porId(s.categorias);
      const agora = new Date();
      const equipe = nomeEquipe(s);
      const ola = `${saudacao(agora)}${equipe ? `, ${equipe}` : ''}.`;

      if (!s.tarefas.length && !s.usuarios.length && !s.categorias.length) {
        morph(
          raiz,
          html`<div class="tela tela--painel coluna-central">
            ${tituloTela({ titulo: `${ola} Vamos montar a pauta.`, sub: `${capitalizar(dataCompleta(agora))}.`, saudacao: true })}
            ${vazio({
              titulo: 'Primeiro, quem faz e que tipo de trabalho',
              texto: 'Toda tarefa tem uma pessoa responsável e uma categoria. Cadastre as duas e as tarefas aparecem aqui, na régua de prazos.',
              acao: html`<div class="vazio__acoes">
                <a class="botao botao--fantasma" href="#/categorias">${icone('tag', { tamanho: 16 })}Criar categorias</a>
                <a class="botao botao--primario" href="#/equipe">${icone('user-plus', { tamanho: 16 })}Adicionar pessoas</a>
              </div>`,
            })}
          </div>`
        );
        return;
      }

      const fato = fatoDoDia(r);
      morph(
        raiz,
        html`<div class="tela tela--painel coluna-central">
          ${tituloTela({ titulo: `${ola} ${fato.texto}`, sub: fraseApoio(r, agora), acoes: botaoNovaTarefa(), saudacao: true })}
          <div class="grade">
            ${regua(s.tarefas, pessoas)}
            ${numeros(r, fato.destaque)}
            ${pautaDoDia(s.tarefas, pessoas, cats)}
            ${andamento(r)}
            ${abertasPorPessoa(s.tarefas, s.usuarios)}
            ${conclusaoPorCategoria(s.tarefas, s.categorias)}
          </div>
        </div>`
      );
    };

    raiz.addEventListener('click', (e) => {
      const abrir = e.target.closest('[data-abrir]');
      if (abrir) {
        const t = ultimo.tarefas.find((x) => x.id === Number(abrir.dataset.abrir));
        if (t) abrirFormTarefa({ tarefa: t });
        return;
      }
      const concluir = e.target.closest('[data-concluir]');
      if (concluir && !concluir.disabled) {
        // mostra a conclusão (risca e esmaece) antes de o item sair da pauta
        concluir.disabled = true;
        concluir.classList.add('concluindo');
        concluir.closest('.pauta__item')?.classList.add('concluindo');
        const espera = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380;
        setTimeout(() => alterarStatus(Number(concluir.dataset.concluir), STATUS.CONCLUIDA).catch(() => {}), espera);
      }
    });

    desenhar(estado);
    // a régua depende da hora atual: redesenha a cada minuto
    const relogio = setInterval(() => desenhar(ultimo), 60_000);
    return {
      atualizar: desenhar,
      destruir: () => clearInterval(relogio),
    };
  },
};

