// Regras da rotina, em funções puras (sem DOM e sem API).
//
// Com a API nova (HabitoController):
// - um HÁBITO é a regra: dias da semana, início e fim (ou sem horário = lembrete), prazo;
// - a API gera a Tarefa de cada dia quando o dia chega (POST /Habito/gerar);
// - os dias que ainda não chegaram aparecem como PREVISTOS, calculados aqui, sem ir ao banco.
// Com a API antiga (só Tarefas), um hábito é a série de tarefas do mesmo perfil, título e área,
// criadas semanas à frente (veja datasDaSerie). As duas formas convivem: o histórico antigo
// de um hábito com o mesmo nome e área entra na série do hábito novo.
// Em todas as telas: tarefa.dataLimite = quando o item está na pauta (início); tarefa.fim = término.
import { normalizar, inicioDoDia, somarDias, diferencaDias, diaMes, diaSemanaCurto } from '../core/format.js';
import { STATUS, estaAberta, estaFeita, foiPulada } from './enums.js';

const p2 = (n) => String(n).padStart(2, '0'); // taste-skill-ignore: dígitos de data e hora

// ------------------------------------------------------------------ datas

/** Date -> '2026-10-21' (chave de dia, no horário local). */
export const chaveDia = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
/** '2026-10-21' -> Date (meia-noite local). */
export function diaDaChave(chave) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(chave ?? ''));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return Number.isNaN(d.getTime()) ? null : d;
}
export const minutosDoDia = (d) => d.getHours() * 60 + d.getMinutes();
export const horaTexto = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const textoDeMinutos = (m) => `${p2(Math.floor(m / 60) % 24)}:${p2(m % 60)}`;
export function minutosDeTexto(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return +m[1] * 60 + +m[2];
}

/** Segunda-feira da semana de `d` (a semana da rotina começa na segunda). */
export function inicioDaSemana(d) {
  const dia = inicioDoDia(d);
  const desloc = (dia.getDay() + 6) % 7; // seg=0 … dom=6
  return somarDias(dia, -desloc);
}
export const diasDaSemana = (d) => Array.from({ length: 7 }, (_, i) => somarDias(inicioDaSemana(d), i));

// getDay(): 0 = domingo … 6 = sábado
export const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const CURTOS_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // como a semana aparece na tela
export const TODOS_OS_DIAS = [0, 1, 2, 3, 4, 5, 6];
export const DIAS_UTEIS = [1, 2, 3, 4, 5];
export const FIM_DE_SEMANA = [0, 6];

// ------------------------------------------------------------------ início, fim e lembretes

/** Quando o item termina: o fim, se tiver, ou o próprio horário (itens avulsos). */
export const fimDe = (t) => t.fim ?? t.dataLimite;
/** Item de um hábito sem horário: vale o dia todo (00:00 às 23:59) e nunca fica atrasado. */
export const ehLembrete = (t) => Boolean(t.fim) && minutosDoDia(t.dataLimite) === 0 && minutosDoDia(t.fim) === 23 * 60 + 59;
/** Passou do horário: terminou e não foi marcado. Lembrete só "passa" quando o dia acaba. */
export const passouDoHorario = (t, agora = new Date()) => fimDe(t) < agora;

/** 90 -> "1 h 30 min", 120 -> "2 h", 45 -> "45 min" */
export function textoIntervalo(min) {
  if (min < 60) return `${min} min`;
  return min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`;
}

/** Hábito sem horário = lembrete. */
export const habitoLembrete = (h) => !h.horaInicio;

/** "18:30 às 19:30", "sem horário", "sem horário, aviso a cada 2 h" */
export function textoFaixa(h) {
  if (habitoLembrete(h)) return h.lembrarACadaMinutos ? `sem horário, aviso a cada ${textoIntervalo(h.lembrarACadaMinutos)}` : 'sem horário';
  return `${h.horaInicio} às ${h.horaFim}`;
}

/** O hábito acontece nesse dia? (a mesma regra do HabitoModel.OcorreEm da API) */
export function ocorreEm(h, dia) {
  const d = inicioDoDia(dia);
  if (!h.ativo) return false;
  if (h.dataInicio && d < h.dataInicio) return false;
  if (h.dataFim && d > h.dataFim) return false;
  return h.dias.includes(d.getDay());
}

/** Início e fim do item desse dia (a mesma regra do HabitoModel.HorarioEm da API). */
export function horarioEm(h, dia) {
  const d = inicioDoDia(dia);
  const em = (m) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60);
  if (habitoLembrete(h)) return { inicio: d, fim: em(23 * 60 + 59) };
  const inicio = em(minutosDeTexto(h.horaInicio));
  let fim = em(minutosDeTexto(h.horaFim));
  if (fim <= inicio) fim = somarDias(fim, 1); // atravessa a meia-noite
  return { inicio, fim };
}

// ------------------------------------------------------------------ períodos do dia

export const PERIODOS = [
  { id: 'manha', rotulo: 'Manhã', de: 0, ate: 12 * 60 },
  { id: 'tarde', rotulo: 'Tarde', de: 12 * 60, ate: 18 * 60 },
  { id: 'noite', rotulo: 'Noite', de: 18 * 60, ate: 24 * 60 },
];
export const periodoDe = (data) => {
  const m = minutosDoDia(data);
  return PERIODOS.find((p) => m >= p.de && m < p.ate) ?? PERIODOS[0];
};

// ------------------------------------------------------------------ hábitos (séries)

/** Chave da série no modo antigo (sem hábito na API): perfil + título + área. */
export const chaveSerie = (t) => `${t.usuarioId}|${normalizar(t.titulo)}|${t.categoriaId}`;

/** Resumo legível dos dias: "Todo dia", "Dias úteis", "Seg, qua e sex". */
export function textoDias(dias) {
  const set = new Set(dias);
  if (set.size === 7) return 'Todo dia';
  if (set.size === 5 && DIAS_UTEIS.every((d) => set.has(d))) return 'Dias úteis';
  if (set.size === 2 && set.has(0) && set.has(6)) return 'Fim de semana';
  const nomes = ORDEM_SEMANA.filter((d) => set.has(d)).map((d) => CURTOS_DIA[d].toLowerCase());
  if (!nomes.length) return 'Sem dias';
  const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}` : nomes[0];
  return lista[0].toUpperCase() + lista.slice(1);
}

/** "06:30", "09:00 e 18:00", "4× ao dia, 09:00 a 18:00" */
export function textoHorarios(horarios) {
  const h = [...horarios].sort();
  if (!h.length) return '';
  if (h.length <= 2) return h.join(' e ');
  return `${h.length}× ao dia, ${h[0]} a ${h.at(-1)}`;
}

/**
 * Como foi um hábito num dia.
 * feito: tudo o que não foi pulado foi feito · parcial/perdido: passou do dia sem fazer tudo
 * pulado: tudo pulado (neutro) · hoje: ainda dá tempo · futuro
 */
export function estadoDoDia(itens, chave, chaveHoje) {
  let feitos = 0;
  let pulados = 0;
  let abertos = 0;
  for (const t of itens) {
    if (estaFeita(t)) feitos++;
    else if (foiPulada(t)) pulados++;
    else abertos++;
  }
  if (chave > chaveHoje) return 'futuro';
  if (abertos === 0) return feitos > 0 ? 'feito' : 'pulado';
  if (chave === chaveHoje) return 'hoje';
  return feitos > 0 ? 'parcial' : 'perdido';
}

/**
 * Sequência atual e melhor sequência de um hábito, contadas nos dias em que ele estava na pauta.
 * Dia pulado não quebra nem soma. Hoje, enquanto não termina, não quebra.
 */
export function sequencias(serie, chaveHoje) {
  const chaves = [...serie.dias.keys()].filter((k) => k <= chaveHoje).sort();
  let melhor = 0;
  let corrente = 0;
  for (const k of chaves) {
    const e = estadoDoDia(serie.dias.get(k), k, chaveHoje);
    if (e === 'feito') {
      corrente++;
      melhor = Math.max(melhor, corrente);
    } else if (e === 'parcial' || e === 'perdido') corrente = 0;
  }
  // a atual é a corrente no fim (o "hoje" pendente não zera)
  return { atual: corrente, melhor };
}

function inferirPadrao(itens, ultimo) {
  // olha as últimas 4 semanas do hábito: dias da semana e horários que aparecem nelas
  const limite = somarDias(inicioDoDia(ultimo), -27);
  const recentes = itens.filter((t) => t.dataLimite >= limite);
  const dias = new Set(recentes.map((t) => t.dataLimite.getDay()));
  const horarios = [...new Set(recentes.map((t) => horaTexto(t.dataLimite)))].sort();
  return { dias: [...dias].sort(), horarios };
}

/** Por quantos dias à frente os itens previstos dos hábitos aparecem (semanas e anéis). */
export const DIAS_PREVISTOS = 42;

function serieDeHabito(h) {
  return {
    chave: `h${h.id}`,
    habito: h,
    titulo: h.titulo,
    categoriaId: h.categoriaId,
    usuarioId: h.usuarioId,
    itens: [],
    dias: new Map(),
    recorrente: true,
    lembrete: habitoLembrete(h),
    padrao: { dias: [...h.dias].sort(), horarios: h.horaInicio ? [h.horaInicio] : [] },
    unidade: h.dias.length === 7 ? ['dia', 'dias'] : ['vez', 'vezes'],
    primeiro: h.dataInicio,
    ultimo: h.dataFim,
  };
}

/**
 * Índice da rotina de um perfil: itens por dia e hábitos (séries).
 * É memorizado: recalcula só quando as tarefas, os hábitos, o perfil ou o dia mudam.
 * @param {Array} tarefas
 * @param {number} usuarioId
 * @param {Array} [habitos] hábitos da API nova (vazio no modo antigo)
 */
let memo = { tarefas: null, perfil: null, habitos: null, dia: null, indice: null };
export function indiceRotina(tarefas, usuarioId, habitos = [], agora = new Date()) {
  const diaHoje = chaveDia(agora);
  if (memo.tarefas === tarefas && memo.perfil === usuarioId && memo.habitos === habitos && memo.dia === diaHoje) return memo.indice;
  const doPerfil = tarefas.filter((t) => t.usuarioId === usuarioId && t.dataLimite);
  doPerfil.sort((a, b) => a.dataLimite - b.dataLimite || a.id - b.id);

  const porDia = new Map();
  const series = new Map();
  const serieDoId = new Map();
  const noDia = (k) => {
    if (!porDia.has(k)) porDia.set(k, []);
    return porDia.get(k);
  };

  // 1. os hábitos da API; o histórico antigo com o mesmo nome e área entra neles
  const legado = new Map();
  for (const h of habitos.filter((x) => x.usuarioId === usuarioId).sort((a, b) => a.id - b.id)) {
    const s = serieDeHabito(h);
    series.set(s.chave, s);
    const kl = chaveSerie(h);
    if (!legado.has(kl) || h.ativo || !legado.get(kl).habito.ativo) legado.set(kl, s);
  }

  // 2. as tarefas
  for (const t of doPerfil) {
    const k = chaveDia(t.dataLimite);
    noDia(k).push(t);
    const kl = chaveSerie(t);
    let s = (t.habitoId && series.get(`h${t.habitoId}`)) || (!t.habitoId && legado.get(kl)) || series.get(kl);
    if (!s) {
      s = { chave: kl, titulo: t.titulo, categoriaId: t.categoriaId, usuarioId: t.usuarioId, itens: [], dias: new Map() };
      series.set(kl, s);
    }
    s.itens.push(t);
    if (!s.habito) s.titulo = t.titulo; // o título mais recente vale (caixa e acentos)
    if (!s.dias.has(k)) s.dias.set(k, []);
    s.dias.get(k).push(t);
    serieDoId.set(t.id, s);
  }

  // 3. fecha as séries
  for (const s of series.values()) {
    if (s.habito) {
      const h = s.habito;
      if (s.itens.length && (!s.primeiro || s.itens[0].dataLimite < s.primeiro)) s.primeiro = s.itens[0].dataLimite;
      if (!h.ativo) s.ultimo = h.dataFim ?? s.itens.at(-1)?.dataLimite ?? h.dataInicio;
      continue;
    }
    s.primeiro = s.itens[0].dataLimite;
    s.ultimo = s.itens.at(-1).dataLimite;
    s.recorrente = s.dias.size >= 2;
    s.padrao = inferirPadrao(s.itens, s.ultimo);
    // um hábito "todo dia" conta dias; os outros contam vezes
    s.unidade = s.padrao.dias.length === 7 ? ['dia', 'dias'] : ['vez', 'vezes'];
  }

  // 4. os dias que ainda não chegaram: itens previstos (não estão no banco; a API cria no dia)
  const hoje = inicioDoDia(agora);
  for (const s of series.values()) {
    const h = s.habito;
    if (!h?.ativo) continue;
    for (let i = 1; i <= DIAS_PREVISTOS; i++) {
      const d = somarDias(hoje, i);
      const k = chaveDia(d);
      if (!ocorreEm(h, d) || s.dias.has(k)) continue;
      const { inicio, fim } = horarioEm(h, d);
      const previsto = {
        id: `p${h.id}-${k}`,
        previsto: true,
        titulo: h.titulo,
        descricao: h.descricao,
        dataCriacao: null,
        dataLimite: inicio,
        fim,
        status: STATUS.A_FAZER,
        prioridade: 2,
        usuarioId: h.usuarioId,
        categoriaId: h.categoriaId,
        habitoId: h.id,
      };
      noDia(k).push(previsto);
      s.dias.set(k, [previsto]);
      serieDoId.set(previsto.id, s);
    }
  }
  for (const lista of porDia.values()) lista.sort((a, b) => a.dataLimite - b.dataLimite || String(a.id).localeCompare(String(b.id)));

  const indice = { perfil: usuarioId, itens: doPerfil, porDia, series, serieDoId };
  memo = { tarefas, perfil: usuarioId, habitos, dia: diaHoje, indice };
  return indice;
}

export const serieDe = (indice, tarefa) => indice.serieDoId.get(tarefa.id) ?? null;
export const itensDoDia = (indice, dia) => indice.porDia.get(chaveDia(dia)) ?? [];

/** Posição de um item entre os do mesmo hábito naquele dia: { n: 2, de: 4 } (água 2 de 4). */
export function posicaoNoDia(indice, tarefa) {
  const s = serieDe(indice, tarefa);
  const doDia = s?.dias.get(chaveDia(tarefa.dataLimite)) ?? [tarefa];
  return { n: doDia.indexOf(tarefa) + 1, de: doDia.length, feitos: doDia.filter(estaFeita).length };
}

/** "Seg, qua e sex · 18:30 às 19:30" para uma série, um hábito ou uma sugestão. */
export function textoPadrao(x) {
  const h = x.habito ?? ('horaInicio' in x ? x : null);
  if (h) return `${textoDias(h.dias)} · ${textoFaixa(h)}`;
  return `${textoDias(x.padrao.dias)} · ${textoHorarios(x.padrao.horarios)}`;
}

/**
 * Situação de um hábito na Rotina: ativo, acabando (até 7 dias) ou encerrado.
 * @returns {{ tipo: 'ativo'|'acabando'|'encerrado', texto: string }}
 */
export function situacaoSerie(serie, agora = new Date()) {
  const h = serie.habito;
  if (h) {
    if (!h.ativo) return { tipo: 'encerrado', texto: h.dataFim ? `encerrado em ${diaMes(h.dataFim)}` : 'encerrado' };
    if (h.dataInicio && h.dataInicio > inicioDoDia(agora)) return { tipo: 'ativo', texto: `começa ${diaMes(h.dataInicio)}` };
    if (!h.dataFim) return { tipo: 'ativo', texto: 'sem prazo' };
  }
  const fim = h ? h.dataFim : serie.ultimo;
  const dias = diferencaDias(fim, agora);
  if (dias < 0) return { tipo: 'encerrado', texto: `encerrado em ${diaMes(fim)}` };
  if (dias <= 7) return { tipo: 'acabando', texto: dias === 0 ? 'acaba hoje' : dias === 1 ? 'acaba amanhã' : `acaba ${diaSemanaCurto(fim)}, ${diaMes(fim)}` };
  return { tipo: 'ativo', texto: `até ${diaMes(fim)}` };
}

// ------------------------------------------------------------------ o dia

/**
 * Resumo de um dia para a tela Hoje.
 * total não inclui os pulados; atrasados = abertos cujo horário já passou.
 */
export function resumoDia(itens, agora = new Date()) {
  const validos = itens.filter((t) => !foiPulada(t));
  const feitos = validos.filter(estaFeita);
  const abertos = validos.filter(estaAberta);
  const atrasados = abertos.filter((t) => passouDoHorario(t, agora));
  const andamento = abertos.find((t) => t.status === STATUS.EM_ANDAMENTO) ?? null;
  const comHorario = abertos.filter((t) => !ehLembrete(t));
  // na hora: já começou e ainda não terminou (hábito com início e fim)
  const naHora = comHorario.find((t) => t.fim && t.dataLimite <= agora && agora < t.fim) ?? null;
  const proximo = comHorario.find((t) => t.dataLimite >= agora) ?? null;
  const lembretes = abertos.filter(ehLembrete);
  return { total: validos.length, feitos: feitos.length, abertos: abertos.length, atrasados, andamento, naHora, proximo, lembretes, pulados: itens.length - validos.length };
}

/** Fração feita de cada dia (para os anéis da semana e o mapa de calor). null = nada na pauta. */
export function taxaDoDia(itens, chave, chaveHoje, agora = new Date()) {
  if (!itens?.length) return null;
  if (chave > chaveHoje) return { taxa: null, total: itens.filter((t) => !foiPulada(t)).length, feitos: 0, futuro: true };
  const validos = itens.filter((t) => !foiPulada(t));
  if (!validos.length) return { taxa: null, total: 0, feitos: 0, pulado: true };
  const feitos = validos.filter(estaFeita).length;
  return { taxa: feitos / validos.length, total: validos.length, feitos };
}

// ------------------------------------------------------------------ progresso

/** Conta feitos e perdidos numa lista (pulados ficam fora; o que ainda está em aberto hoje também). */
function contar(itens, inicioHoje) {
  let feitos = 0;
  let perdidos = 0;
  for (const t of itens) {
    if (estaFeita(t)) feitos++;
    else if (estaAberta(t) && t.dataLimite < inicioHoje) perdidos++;
  }
  const base = feitos + perdidos;
  return { feitos, perdidos, base, taxa: base ? feitos / base : null };
}

/**
 * Estatísticas de constância para a tela Progresso.
 * @param {object} indice resultado de indiceRotina
 * @param {{ agora?: Date, janela?: number, semanasMapa?: number }} opcoes
 */
export function estatisticas(indice, { agora = new Date(), janela = 30, semanasMapa = 17 } = {}) {
  const hoje = inicioDoDia(agora);
  const chaveHoje = chaveDia(hoje);
  const inicioJanela = somarDias(hoje, -(janela - 1));
  const naJanela = indice.itens.filter((t) => t.dataLimite >= inicioJanela && t.dataLimite < somarDias(hoje, 1));
  const geral = contar(naJanela, hoje);

  // a janela anterior, do mesmo tamanho, para comparar
  const inicioAnterior = somarDias(inicioJanela, -janela);
  const anterior = contar(
    indice.itens.filter((t) => t.dataLimite >= inicioAnterior && t.dataLimite < inicioJanela),
    hoje
  );

  // dias completos na janela (hoje só conta se já fechou)
  let diasCompletos = 0;
  let diasComPauta = 0;
  for (let i = 0; i < janela; i++) {
    const d = somarDias(inicioJanela, i);
    const k = chaveDia(d);
    const itens = indice.porDia.get(k);
    if (!itens?.length) continue;
    const t = taxaDoDia(itens, k, chaveHoje, agora);
    if (!t || t.taxa === null) continue;
    if (k === chaveHoje && itens.some(estaAberta)) continue;
    diasComPauta++;
    if (t.taxa === 1) diasCompletos++;
  }

  // lembretes não têm horário: ficam fora da comparação manhã, tarde e noite
  const comHorario = naJanela.filter((t) => !ehLembrete(t));
  const porPeriodo = PERIODOS.map((p) => ({ ...p, ...contar(comHorario.filter((t) => periodoDe(t.dataLimite).id === p.id), hoje) }));
  const porDiaSemana = ORDEM_SEMANA.map((d) => ({ dia: d, rotulo: CURTOS_DIA[d], ...contar(naJanela.filter((t) => t.dataLimite.getDay() === d), hoje) }));

  const areas = new Map();
  for (const t of naJanela) {
    if (!areas.has(t.categoriaId)) areas.set(t.categoriaId, []);
    areas.get(t.categoriaId).push(t);
  }
  const porArea = [...areas.entries()].map(([categoriaId, itens]) => ({ categoriaId, ...contar(itens, hoje) })).filter((a) => a.base > 0);

  // mapa de calor: semanas completas (segunda a domingo) terminando nesta semana
  const fimMapa = somarDias(inicioDaSemana(hoje), 6);
  const inicioMapa = somarDias(inicioDaSemana(hoje), -(semanasMapa - 1) * 7);
  const mapa = [];
  for (let d = inicioMapa; d <= fimMapa; d = somarDias(d, 1)) {
    const k = chaveDia(d);
    const itens = indice.porDia.get(k) ?? [];
    const t = taxaDoDia(itens, k, chaveHoje, agora);
    mapa.push({ chave: k, data: d, hoje: k === chaveHoje, futuro: k > chaveHoje, total: t?.total ?? 0, feitos: t?.feitos ?? 0, taxa: t?.taxa ?? null });
  }

  // hábitos: só os recorrentes, com histórico na janela
  const habitos = [...indice.series.values()]
    .filter((s) => s.recorrente && s.primeiro < somarDias(hoje, 1))
    .map((s) => {
      const seq = sequencias(s, chaveHoje);
      const c = contar(s.itens.filter((t) => t.dataLimite >= inicioJanela && t.dataLimite < somarDias(hoje, 1)), hoje);
      const ultimos = [];
      for (let i = 13; i >= 0; i--) {
        const d = somarDias(hoje, -i);
        const k = chaveDia(d);
        const doDia = s.dias.get(k);
        ultimos.push({ chave: k, data: d, estado: doDia ? estadoDoDia(doDia, k, chaveHoje) : 'livre' });
      }
      return { serie: s, ...seq, ...c, ultimos };
    })
    .filter((h) => h.base > 0 || h.atual > 0)
    .sort((a, b) => (b.taxa ?? -1) - (a.taxa ?? -1) || b.atual - a.atual);

  return { janela, geral, anterior, diasCompletos, diasComPauta, porPeriodo, porDiaSemana, porArea, mapa, habitos, chaveHoje };
}

/**
 * A frase que abre a tela Progresso: o fato mais útil dos dados, com a base de cada número.
 */
export function achado(est) {
  const partes = [];
  const { geral, anterior } = est;
  if (geral.taxa === null) return 'Ainda não há dias passados para medir. Volte amanhã.';
  const pct = Math.round(geral.taxa * 100);
  let frase = `Você cumpriu ${pct}% da rotina nos últimos ${est.janela} dias`;
  if (anterior.taxa !== null && anterior.base >= 10) {
    const dif = pct - Math.round(anterior.taxa * 100);
    if (dif !== 0) frase += `, ${Math.abs(dif)} ${Math.abs(dif) === 1 ? 'ponto' : 'pontos'} ${dif > 0 ? 'acima' : 'abaixo'} dos ${est.janela} dias anteriores`;
  }
  partes.push(frase + '.');
  const periodos = est.porPeriodo.filter((p) => p.base >= 8);
  if (periodos.length >= 2) {
    const ordenados = [...periodos].sort((a, b) => a.taxa - b.taxa);
    const pior = ordenados[0];
    const melhor = ordenados.at(-1);
    if (melhor.taxa - pior.taxa >= 0.08) {
      partes.push(`${melhor.rotulo === 'Manhã' ? 'De manhã' : melhor.rotulo === 'Tarde' ? 'À tarde' : 'À noite'} você cumpre ${Math.round(melhor.taxa * 100)}%; ${pior.rotulo === 'Manhã' ? 'de manhã' : pior.rotulo === 'Tarde' ? 'à tarde' : 'à noite'}, ${Math.round(pior.taxa * 100)}%.`);
    }
  }
  return partes.join(' ');
}

// ------------------------------------------------------------------ criar em série

/**
 * Datas de um hábito: os dias escolhidos, em cada horário, por N semanas a partir de `inicio`.
 * Horários que já passaram (hoje) ficam de fora.
 */
export function datasDaSerie({ dias, horarios, inicio, semanas = 4, agora = new Date() }) {
  const diasSet = new Set(dias);
  const minutos = [...new Set(horarios)].map(minutosDeTexto).filter((m) => m !== null).sort((a, b) => a - b);
  const base = inicioDoDia(inicio);
  const saida = [];
  for (let i = 0; i < semanas * 7; i++) {
    const d = somarDias(base, i);
    if (!diasSet.has(d.getDay())) continue;
    for (const m of minutos) {
      const data = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60);
      if (data >= agora) saida.push(data);
    }
  }
  return saida;
}

/** Datas para estender um hábito por mais N semanas, seguindo o padrão das últimas semanas. */
export function datasParaEstender(serie, semanas = 4, agora = new Date()) {
  const depoisDoUltimo = somarDias(inicioDoDia(serie.ultimo), 1);
  const inicio = depoisDoUltimo > agora ? depoisDoUltimo : inicioDoDia(agora);
  return datasDaSerie({ dias: serie.padrao.dias, horarios: serie.padrao.horarios, inicio, semanas, agora });
}

/** Itens futuros ainda em aberto de um hábito (os que "editar próximos" e "encerrar" alteram). */
export const proximosAbertos = (serie, agora = new Date()) => serie.itens.filter((t) => t.status === STATUS.A_FAZER && t.dataLimite >= agora);

/** Quantos dias faltam para o hábito acabar (último item na pauta). Sem prazo: Infinity. */
export const diasAteAcabar = (serie, agora = new Date()) => (serie.ultimo ? diferencaDias(serie.ultimo, agora) : Infinity);

// ------------------------------------------------------------------ durações e áreas

/** Minutos citados no título: "Ler 20 min" -> 20, "Estudar 1 h" -> 60, "Estudar 1h30" -> 90. */
export function duracaoDoTitulo(titulo) {
  const t = normalizar(titulo);
  let m = /(\d{1,3})\s?(?:min|minutos?)\b/.exec(t);
  if (m) return Math.min(240, Number(m[1]));
  m = /(\d)(?:[.,](\d))?\s?h(?:oras?)?(?:\s?(\d{2}))?\b/.exec(t);
  if (m) return Math.min(240, Number(m[1]) * 60 + (m[2] ? Number(m[2]) * 6 : 0) + (m[3] ? Number(m[3]) : 0));
  return null;
}

// Pistas para adivinhar a área pelo título. Compara com o nome das áreas que a pessoa já tem.
const PISTAS = [
  { palavras: ['agua', 'hidrat'], areas: ['saude', 'hidrat', 'agua', 'corpo', 'bem-estar', 'bem estar'] },
  { palavras: ['academia', 'treino', 'treinar', 'musculacao', 'correr', 'corrida', 'caminhad', 'caminhar', 'pedalar', 'bike', 'yoga', 'alongar', 'alongamento', 'natacao', 'nadar', 'futebol', 'pilates', 'crossfit', 'flexoes'], areas: ['treino', 'exercicio', 'academia', 'esporte', 'movimento', 'corpo'] },
  { palavras: ['estudar', 'estudo', 'ler', 'leitura', 'livro', 'aula', 'curso', 'revisar', 'prova', 'ingles', 'idioma', 'faculdade', 'tcc', 'exercicios', 'flashcards'], areas: ['estudo', 'leitura', 'aprend', 'faculdade', 'curso'] },
  { palavras: ['acordar', 'dormir', 'sono', 'deitar', 'cochilo', 'soneca', 'despertar'], areas: ['sono', 'descanso', 'dormir'] },
  { palavras: ['remedio', 'vitamina', 'medicamento', 'dentista', 'medico', 'consulta', 'skincare', 'meditar', 'meditacao', 'respirar', 'terapia', 'protetor', 'fio dental', 'escovar'], areas: ['saude', 'bem-estar', 'bem estar', 'mente', 'autocuidado', 'cuidado'] },
  { palavras: ['arrumar', 'limpar', 'lavar', 'louca', 'roupa', 'cama', 'casa', 'lixo', 'mercado', 'compras', 'cozinhar', 'regar', 'plantas', 'faxina', 'planejar', 'organizar'], areas: ['casa', 'lar', 'domestic', 'organiza'] },
  { palavras: ['trabalho', 'reuniao', 'email', 'relatorio', 'cliente', 'projeto'], areas: ['trabalho', 'profiss', 'carreira'] },
];

export function adivinharArea(titulo, categorias) {
  const t = normalizar(titulo);
  for (const pista of PISTAS) {
    if (!pista.palavras.some((p) => new RegExp(`(^|\\s)${p}`).test(t))) continue;
    const achada = categorias.find((c) => pista.areas.some((a) => normalizar(c.nome).includes(a)));
    if (achada) return achada.id;
  }
  return null;
}

// ------------------------------------------------------------------ sugestões (primeira vez e Rotina)

export const AREAS_SUGERIDAS = {
  Saúde: 'Água, vitaminas e cuidados com o corpo.',
  Sono: 'Hora de acordar e de dormir.',
  Treino: 'Academia, caminhadas e esportes.',
  Estudos: 'Estudo, leitura e cursos.',
  Casa: 'Tarefas de casa e organização.',
};

// Sugestões já no formato de hábito: com início e fim, ou sem horário (lembrete).
export const SUGESTOES = [
  { titulo: 'Beber água', area: 'Saúde', dias: TODOS_OS_DIAS, horaInicio: null, horaFim: null, lembrarACadaMinutos: 120 },
  { titulo: 'Acordar', area: 'Sono', dias: DIAS_UTEIS, horaInicio: '06:30', horaFim: '06:45' },
  { titulo: 'Arrumar a cama', area: 'Casa', dias: TODOS_OS_DIAS, horaInicio: '06:45', horaFim: '07:00' },
  { titulo: 'Tomar vitamina', area: 'Saúde', dias: TODOS_OS_DIAS, horaInicio: '07:00', horaFim: '07:15' },
  { titulo: 'Academia', area: 'Treino', dias: [1, 3, 5], horaInicio: '18:30', horaFim: '19:30' },
  { titulo: 'Estudar 1 h', area: 'Estudos', dias: DIAS_UTEIS, horaInicio: '20:00', horaFim: '21:00' },
  { titulo: 'Ler 20 min', area: 'Estudos', dias: TODOS_OS_DIAS, horaInicio: '22:30', horaFim: '22:50' },
  { titulo: 'Dormir', area: 'Sono', dias: TODOS_OS_DIAS, horaInicio: '23:00', horaFim: '23:30' },
  { titulo: 'Caminhar 30 min', area: 'Treino', dias: FIM_DE_SEMANA, horaInicio: '08:00', horaFim: '08:30' },
  { titulo: 'Planejar a semana', area: 'Casa', dias: [0], horaInicio: '19:00', horaFim: '19:30' },
];

/** Fim sugerido para um início: a duração citada no título ("Ler 20 min") ou 30 minutos. */
export const fimSugerido = (horaInicio, titulo = '') => textoDeMinutos((minutosDeTexto(horaInicio) ?? 480) + (duracaoDoTitulo(titulo) ?? 30));

/** Intervalo médio entre horários ("09:00, 12:00, 15:00" -> 180), de 15 em 15 min, entre 15 e 720. */
export function intervaloEntre(horarios) {
  const m = horarios.map(minutosDeTexto).filter((x) => x !== null).sort((a, b) => a - b);
  if (m.length < 2) return null;
  const medio = (m.at(-1) - m[0]) / (m.length - 1);
  return Math.max(15, Math.min(720, Math.round(medio / 15) * 15));
}
