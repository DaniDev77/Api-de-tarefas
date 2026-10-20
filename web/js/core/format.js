// Datas, textos e números no padrão brasileiro.
// A API devolve DateTime sem fuso ("2026-10-25T18:00:00"); tratamos sempre como horário local.

const LOCALE = 'pt-BR';
const DIA_MS = 86_400_000;

/** Converte o DateTime do .NET (até 7 casas decimais, sem fuso) em Date local. */
export function lerData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  const m = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?)?/);
  if (!m) return null;
  const [, a, me, d, h = '0', mi = '0', s = '0', frac = '0'] = m;
  const data = new Date(+a, +me - 1, +d, +h, +mi, +s, +frac.padEnd(3, '0').slice(0, 3));
  return Number.isNaN(data.getTime()) ? null : data;
}

/** Date -> "2026-10-25T18:00:00" (formato que o ASP.NET entende sem conversão de fuso). */
export function paraApi(data) {
  if (!data) return null;
  const p = (n) => String(n).padStart(2, '0'); // taste-skill-ignore: dígitos de data e hora
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}T${p(data.getHours())}:${p(data.getMinutes())}:00`;
}

/** Date -> valor de <input type="datetime-local"> */
export function paraInput(data) {
  if (!data) return '';
  return paraApi(data).slice(0, 16);
}

export const inicioDoDia = (data) => new Date(data.getFullYear(), data.getMonth(), data.getDate());
export const somarDias = (data, dias) => new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias, data.getHours(), data.getMinutes());
export const diferencaDias = (a, b) => Math.round((inicioDoDia(a) - inicioDoDia(b)) / DIA_MS);
export const mesmoDia = (a, b) => diferencaDias(a, b) === 0;

const fmtDiaMes = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const fmtDataCompleta = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtHora = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
const fmtDiaSemana = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const fmtMes = new Intl.DateTimeFormat(LOCALE, { month: 'short' });
const fmtDataHora = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const diaMes = (d) => fmtDiaMes.format(d).replace('.', '');
export const dataCompleta = (d) => fmtDataCompleta.format(d);
export const hora = (d) => fmtHora.format(d);
export const diaSemanaCurto = (d) => fmtDiaSemana.format(d).replace('.', '');
export const dataHora = (d) => fmtDataHora.format(d).replace('.', '');
export const mesCurto = (d) => fmtMes.format(d).replace('.', '');

/**
 * Prazo em linguagem natural, relativo a hoje.
 * @returns {{ texto: string, tom: 'atrasada'|'hoje'|'breve'|'normal', dias: number }}
 */
export function prazoRelativo(data, agora = new Date()) {
  if (!data) return { texto: 'Sem prazo', tom: 'normal', dias: Infinity };
  const dias = diferencaDias(data, agora);
  const temHora = data.getHours() !== 0 || data.getMinutes() !== 0;
  const h = temHora ? `, ${hora(data)}` : '';
  if (dias < 0 || (dias === 0 && data < agora)) {
    if (dias === 0) return { texto: `Venceu às ${hora(data)}`, tom: 'atrasada', dias };
    if (dias === -1) return { texto: 'Venceu ontem', tom: 'atrasada', dias };
    return { texto: `Atrasada ${-dias} dias`, tom: 'atrasada', dias };
  }
  if (dias === 0) return { texto: `Hoje${h}`, tom: 'hoje', dias };
  if (dias === 1) return { texto: `Amanhã${h}`, tom: 'breve', dias };
  if (dias < 7) return { texto: `${capitalizar(diaSemanaCurto(data))}, ${diaMes(data)}`, tom: 'breve', dias };
  return { texto: diaMes(data), tom: 'normal', dias };
}

export const capitalizar = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function saudacao(agora = new Date()) {
  const h = agora.getHours();
  if (h < 5) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export const numero = (n) => new Intl.NumberFormat(LOCALE).format(n);
export const porcentagem = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

/** Remove acentos e caixa para buscas ("Reunião" encontra "reuniao"). */
export const normalizar = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Iniciais para avatar: "Ana Beatriz Souza" -> "AS" */
export function iniciais(nome) {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

/** Máscara de telefone brasileiro enquanto digita: (14) 99999-9999 / (14) 3333-4444 */
export function mascaraTelefone(valor) {
  const d = String(valor ?? '').replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const somenteDigitos = (v) => String(v ?? '').replace(/\D/g, '');

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
