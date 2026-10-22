// Regras da rotina, em funções puras (sem DOM e sem API).
//
// A API só conhece Tarefas. A rotina nasce delas:
// - cada Tarefa é um item da pauta de um dia (DataLimite = dia + horário);
// - um HÁBITO é a série de tarefas do mesmo perfil, com o mesmo título e a mesma área;
// - a repetição é feita criando as tarefas das próximas semanas (veja datasDaSerie);
// - sequências e constância são calculadas a partir dos status.
import { normalizar, inicioDoDia, somarDias, diferencaDias } from '../core/format.js';
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

/**
 * Índice da rotina de um perfil: itens por dia e hábitos (séries).
 * É memorizado: recalcula só quando a lista de tarefas ou o perfil mudam.
 */
let memo = { tarefas: null, perfil: null, indice: null };
export function indiceRotina(tarefas, usuarioId) {
  if (memo.tarefas === tarefas && memo.perfil === usuarioId) return memo.indice;
  const doPerfil = tarefas.filter((t) => t.usuarioId === usuarioId && t.dataLimite);
  doPerfil.sort((a, b) => a.dataLimite - b.dataLimite || a.id - b.id);

  const porDia = new Map();
  const series = new Map();
  for (const t of doPerfil) {
    const k = chaveDia(t.dataLimite);
    if (!porDia.has(k)) porDia.set(k, []);
    porDia.get(k).push(t);

    const ks = chaveSerie(t);
    let s = series.get(ks);
    if (!s) {
      s = { chave: ks, titulo: t.titulo, categoriaId: t.categoriaId, usuarioId: t.usuarioId, itens: [], dias: new Map() };
      series.set(ks, s);
    }
    s.itens.push(t);
    s.titulo = t.titulo; // o título mais recente vale (caixa e acentos)
    if (!s.dias.has(k)) s.dias.set(k, []);
    s.dias.get(k).push(t);
  }
  for (const s of series.values()) {
    s.primeiro = s.itens[0].dataLimite;
    s.ultimo = s.itens.at(-1).dataLimite;
    s.recorrente = s.dias.size >= 2;
    s.padrao = inferirPadrao(s.itens, s.ultimo);
    // um hábito "todo dia" conta dias; os outros contam vezes
    s.unidade = s.padrao.dias.length === 7 ? ['dia', 'dias'] : ['vez', 'vezes'];
  }
  const indice = { perfil: usuarioId, itens: doPerfil, porDia, series };
  memo = { tarefas, perfil: usuarioId, indice };
  return indice;
}

export const serieDe = (indice, tarefa) => indice.series.get(chaveSerie(tarefa));
export const itensDoDia = (indice, dia) => indice.porDia.get(chaveDia(dia)) ?? [];

/** Posição de um item entre os do mesmo hábito naquele dia: { n: 2, de: 4 } (água 2 de 4). */
export function posicaoNoDia(indice, tarefa) {
  const s = serieDe(indice, tarefa);
  const doDia = s?.dias.get(chaveDia(tarefa.dataLimite)) ?? [tarefa];
  return { n: doDia.indexOf(tarefa) + 1, de: doDia.length, feitos: doDia.filter(estaFeita).length };
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
  const atrasados = abertos.filter((t) => t.dataLimite < agora);
  const andamento = abertos.find((t) => t.status === STATUS.EM_ANDAMENTO) ?? null;
  const proximo = abertos.find((t) => t.dataLimite >= agora) ?? null;
  return { total: validos.length, feitos: feitos.length, abertos: abertos.length, atrasados, andamento, proximo, pulados: itens.length - validos.length };
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

  const porPeriodo = PERIODOS.map((p) => ({ ...p, ...contar(naJanela.filter((t) => periodoDe(t.dataLimite).id === p.id), hoje) }));
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

/** Quantos dias faltam para o hábito acabar (último item na pauta). */
export const diasAteAcabar = (serie, agora = new Date()) => diferencaDias(serie.ultimo, agora);

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

export const SUGESTOES = [
  { titulo: 'Beber água', area: 'Saúde', dias: TODOS_OS_DIAS, horarios: ['09:00', '12:00', '15:00', '18:00'] },
  { titulo: 'Acordar', area: 'Sono', dias: DIAS_UTEIS, horarios: ['06:30'] },
  { titulo: 'Arrumar a cama', area: 'Casa', dias: TODOS_OS_DIAS, horarios: ['06:45'] },
  { titulo: 'Tomar vitamina', area: 'Saúde', dias: TODOS_OS_DIAS, horarios: ['07:00'] },
  { titulo: 'Academia', area: 'Treino', dias: [1, 3, 5], horarios: ['18:30'] },
  { titulo: 'Estudar 1 h', area: 'Estudos', dias: DIAS_UTEIS, horarios: ['20:00'] },
  { titulo: 'Ler 20 min', area: 'Estudos', dias: TODOS_OS_DIAS, horarios: ['22:30'] },
  { titulo: 'Dormir', area: 'Sono', dias: TODOS_OS_DIAS, horarios: ['23:00'] },
  { titulo: 'Caminhar 30 min', area: 'Treino', dias: FIM_DE_SEMANA, horarios: ['08:00'] },
  { titulo: 'Planejar a semana', area: 'Casa', dias: [0], horarios: ['19:00'] },
];
