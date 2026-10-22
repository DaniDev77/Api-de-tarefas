// Lê a frase da adição rápida e separa o que é título do que é agenda.
//   "Academia 18h30 seg qua sex"      -> Academia · 18:30 · seg, qua e sex
//   "Beber água 4x ao dia"             -> Beber água · 09:00, 12:00, 15:00, 18:00 · todo dia
//   "Ler 20 min às 22h todo dia"       -> Ler 20 min · 22:00 · todo dia
//   "Dentista amanhã 14h #saúde"       -> Dentista · amanhã 14:00 · área Saúde
// Tudo é feito sobre uma cópia sem acentos; os trechos reconhecidos são recortados do texto original.
import { normalizar, somarDias, inicioDoDia } from '../core/format.js';
import { TODOS_OS_DIAS, DIAS_UTEIS, FIM_DE_SEMANA, textoDeMinutos, adivinharArea } from './rotina.js';

const DIA_POR_NOME = {
  dom: 0, domingo: 0,
  seg: 1, segunda: 1,
  ter: 2, terca: 2,
  qua: 3, quarta: 3,
  qui: 4, quinta: 4,
  sex: 5, sexta: 5,
  sab: 6, sabado: 6,
};
const NOMES = Object.keys(DIA_POR_NOME).sort((a, b) => b.length - a.length).join('|');

/** Espalha N horários num intervalo do dia, em meias horas: 4x -> 09:00, 12:00, 15:00, 18:00. */
export function espalharHorarios(n) {
  const qtd = Math.max(1, Math.min(12, n));
  if (qtd === 1) return ['09:00'];
  const [ini, fim] = qtd <= 4 ? [9 * 60, 18 * 60] : [8 * 60, 20 * 60];
  const passo = (fim - ini) / (qtd - 1);
  return Array.from({ length: qtd }, (_, i) => textoDeMinutos(Math.round((ini + passo * i) / 30) * 30));
}

/**
 * @param {string} texto
 * @param {{ categorias?: Array<{id:number,nome:string}>, agora?: Date }} [ctx]
 * @returns {{ titulo: string, horarios: string[], dias: number[]|null, data: Date|null, semanas: number|null, categoriaId: number|null, areaExplicita: boolean, reconhecidos: Array<{tipo:string, texto:string}> }}
 */
export function lerFrase(texto, { categorias = [], agora = new Date() } = {}) {
  const original = String(texto ?? '').normalize('NFC');
  let plano = original.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // sem o mesmo comprimento não dá para recortar com segurança: usa a versão sem acentos
  const base = plano.length === original.length ? original : plano;

  const cortes = []; // [inicio, fim) a remover do texto
  const reconhecidos = [];
  const usar = (re, fn) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(plano))) {
      const ok = fn(m);
      if (ok !== false) {
        cortes.push([m.index, m.index + m[0].length]);
        // apaga o trecho na cópia para os próximos padrões não o lerem de novo
        plano = plano.slice(0, m.index) + ' '.repeat(m[0].length) + plano.slice(m.index + m[0].length);
      }
      if (!re.global) break;
    }
  };

  let dias = null;
  let data = null;
  let semanas = null;
  let vezes = null;
  const horarios = [];
  let categoriaId = null;

  // área explícita: "#estudos"
  usar(/#([\p{L}\d-]+)/gu, (m) => {
    const alvo = normalizar(m[1]);
    const c = categorias.find((x) => normalizar(x.nome).startsWith(alvo)) ?? categorias.find((x) => normalizar(x.nome).includes(alvo));
    if (!c) return false;
    categoriaId = c.id;
    reconhecidos.push({ tipo: 'area', texto: c.nome });
  });

  // por quantas semanas
  usar(/\bpor\s+(\d{1,2}|uma|duas|tres|quatro)\s+(semanas?|mes(?:es)?)\b/g, (m) => {
    const n = { uma: 1, duas: 2, tres: 3, quatro: 4 }[m[1]] ?? Number(m[1]);
    semanas = Math.max(1, Math.min(12, m[2].startsWith('mes') ? n * 4 : n));
    reconhecidos.push({ tipo: 'semanas', texto: `por ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}` });
  });
  usar(/\bpor\s+um\s+mes\b/g, () => {
    semanas = 4;
    reconhecidos.push({ tipo: 'semanas', texto: 'por 4 semanas' });
  });

  // vezes ao dia
  usar(/\b(\d{1,2})\s?(?:x|vezes)\s+(?:ao|por)\s+dia\b/g, (m) => {
    vezes = Number(m[1]);
  });

  // repetição
  usar(/\b(todo dia|todos os dias|diariamente|toda manha|toda noite)\b/g, () => {
    dias = [...TODOS_OS_DIAS];
  });
  usar(/\b(dias uteis|de segunda a sexta|seg(?:unda)? a sex(?:ta)?)\b/g, () => {
    dias = [...DIAS_UTEIS];
  });
  usar(/\b(fins? de semana|finais de semana)\b/g, () => {
    dias = [...FIM_DE_SEMANA];
  });

  // dias da semana: "toda segunda", "seg qua sex", "terças e quintas"
  const achados = [];
  let toda = false;
  usar(new RegExp(`\\b(?:(toda|todo|todas as|todos os)\\s+)?(${NOMES})(?:-feira)?s?\\b`, 'g'), (m) => {
    if (m[1]) toda = true;
    achados.push(DIA_POR_NOME[m[2]]);
  });
  if (achados.length) {
    if (achados.length > 1 || toda || dias) {
      dias = [...new Set([...(dias ?? []), ...achados])].sort();
    } else {
      // um dia só, sem "toda": a próxima ocorrência desse dia (hoje conta)
      const alvo = achados[0];
      const hoje = inicioDoDia(agora);
      data = somarDias(hoje, (alvo - hoje.getDay() + 7) % 7);
    }
  }

  // um dia específico
  usar(/\b(hoje|depois de amanha|amanha)\b/g, (m) => {
    const hoje = inicioDoDia(agora);
    data = m[1] === 'hoje' ? hoje : somarDias(hoje, m[1] === 'amanha' ? 1 : 2);
  });
  usar(/\b(?:dia\s+)?(\d{1,2})\/(\d{1,2})\b/g, (m) => {
    const d = new Date(agora.getFullYear(), Number(m[2]) - 1, Number(m[1]));
    if (Number.isNaN(d.getTime()) || d.getDate() !== Number(m[1])) return false;
    if (d < inicioDoDia(agora)) d.setFullYear(d.getFullYear() + 1);
    data = d;
  });

  // horários: "18h", "18h30", "18:30", "às 7", "7 horas", "meio-dia"
  const pushHora = (h, mi = 0) => {
    if (h > 23 || mi > 59) return false;
    horarios.push(textoDeMinutos(h * 60 + mi));
  };
  usar(/\bmeio[- ]dia\b/g, () => pushHora(12));
  usar(/\b(?:as\s+)?(\d{1,2}):(\d{2})\b/g, (m) => pushHora(Number(m[1]), Number(m[2])));
  usar(/\bas\s+(\d{1,2})(?:h(\d{2})?|\s?horas?)?\b/g, (m) => pushHora(Number(m[1]), Number(m[2] ?? 0)));
  // "6h", "18h30", "7 horas": números até 4 sem "às" são lidos como duração ("Estudar 1h"), não horário
  usar(/\b(\d{1,2})(?:h(\d{2})?|\s?horas?)\b/g, (m) => {
    const h = Number(m[1]);
    if (h <= 4) return false;
    return pushHora(h, Number(m[2] ?? 0));
  });

  if (vezes && !horarios.length) {
    horarios.push(...espalharHorarios(vezes));
    reconhecidos.push({ tipo: 'vezes', texto: `${vezes}× ao dia` });
  }
  if (vezes && !dias && !data) dias = [...TODOS_OS_DIAS];

  // o que sobrou é o título (sem conectores soltos nas pontas)
  const ordenados = cortes.sort((a, b) => a[0] - b[0]);
  let titulo = '';
  let pos = 0;
  for (const [i, f] of ordenados) {
    if (i < pos) continue;
    titulo += base.slice(pos, i) + ' ';
    pos = f;
  }
  titulo += base.slice(pos);
  const CONECTORES = /^(?:e|as|às|a|de|do|da|no|na|em|para|pra|por|toda|todo|,|-|·)$/i;
  let palavras = titulo.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  while (palavras.length && CONECTORES.test(palavras.at(-1))) palavras.pop();
  while (palavras.length && CONECTORES.test(palavras[0])) palavras.shift();
  titulo = palavras.join(' ').replace(/\s+([,.;])/g, '$1').replace(/[,;·-]+$/, '').trim();
  if (titulo) titulo = titulo[0].toUpperCase() + titulo.slice(1);

  let areaExplicita = categoriaId !== null;
  if (!areaExplicita && titulo) categoriaId = adivinharArea(titulo, categorias);

  return {
    titulo,
    horarios: [...new Set(horarios)].sort(),
    dias,
    data,
    semanas,
    categoriaId,
    areaExplicita,
    reconhecidos,
  };
}

