// Emoji das notificações: combina com o hábito (água, treino, leitura…) e muda a cada aviso,
// para a notificação não ficar sempre igual. O emoji é enfeite: o texto continua dizendo tudo.
import { normalizar } from '../core/format.js';

// a ordem importa: o primeiro grupo cujas palavras aparecem no título vence
const GRUPOS = [
  { palavras: ['agua', 'hidrat', 'beber'], emojis: ['💧', '🥤', '🚰', '🧊'] },
  { palavras: ['remedio', 'medicamento', 'vitamina', 'suplemento'], emojis: ['💊', '🍊', '🩺'] },
  { palavras: ['academia', 'treino', 'treinar', 'musculacao', 'crossfit', 'flexoes'], emojis: ['🏋️', '💪', '🔥', '🏅'] },
  { palavras: ['correr', 'corrida', 'caminhar', 'caminhada', 'pedalar', 'bike'], emojis: ['🏃', '👟', '🚴', '🌳'] },
  { palavras: ['yoga', 'alongar', 'alongamento', 'pilates'], emojis: ['🧘', '🤸', '🌿'] },
  { palavras: ['meditar', 'meditacao', 'respirar'], emojis: ['🧘', '🌿', '🕊️'] },
  { palavras: ['futebol', 'nadar', 'natacao', 'esporte'], emojis: ['⚽', '🏊', '🏅'] },
  { palavras: ['ler', 'leitura', 'livro'], emojis: ['📖', '📚', '🔖'] },
  { palavras: ['estudar', 'estudo', 'aula', 'curso', 'revisar', 'prova', 'faculdade', 'tcc', 'exercicios', 'ingles', 'idioma'], emojis: ['📚', '✏️', '🧠', '🎓'] },
  { palavras: ['acordar', 'despertar'], emojis: ['⏰', '🌅', '☀️'] },
  { palavras: ['dormir', 'sono', 'deitar', 'cochilo', 'soneca'], emojis: ['😴', '🌙', '🛏️'] },
  { palavras: ['cama'], emojis: ['🛏️', '✨'] },
  { palavras: ['comer', 'almoco', 'jantar', 'cafe', 'fruta', 'cozinhar'], emojis: ['🍎', '🥗', '🍳', '☕'] },
  { palavras: ['limpar', 'faxina', 'arrumar', 'organizar', 'lixo'], emojis: ['🧹', '🧽', '🏠'] },
  { palavras: ['lavar', 'roupa', 'louca'], emojis: ['🧺', '🫧', '🧼'] },
  { palavras: ['mercado', 'compras', 'comprar'], emojis: ['🛒', '🛍️'] },
  { palavras: ['regar', 'plantas'], emojis: ['🪴', '🌱'] },
  { palavras: ['escovar', 'fio dental', 'dentista'], emojis: ['🦷', '🪥'] },
  { palavras: ['skincare', 'protetor', 'banho'], emojis: ['🧴', '🚿', '✨'] },
  { palavras: ['planejar', 'agenda', 'semana'], emojis: ['🗓️', '📝', '🧭'] },
  { palavras: ['trabalho', 'reuniao', 'email', 'relatorio', 'projeto', 'cliente'], emojis: ['💼', '💻', '📈'] },
  { palavras: ['pagar', 'conta', 'boleto'], emojis: ['💳', '🧾'] },
];
const QUALQUER = ['✨', '⭐', '👉', '🔔', '📌'];
const FEITO = ['✅', '👏', '🙌', '💯', '⭐', '🎯'];
const DIA_COMPLETO = ['🎉', '🏆', '🥳', '🌟', '🙌'];

const ultimo = new Map(); // lista -> último emoji usado (para não repetir seguido)

/** Sorteia um emoji da lista, nunca o mesmo da vez anterior. */
function sortear(lista) {
  const antes = ultimo.get(lista);
  const opcoes = lista.length > 1 ? lista.filter((e) => e !== antes) : lista;
  const escolhido = opcoes[Math.floor(Math.random() * opcoes.length)];
  ultimo.set(lista, escolhido);
  return escolhido;
}

function grupoDe(titulo = '') {
  const t = ` ${normalizar(titulo)} `;
  return GRUPOS.find((g) => g.palavras.some((p) => new RegExp(`(^|\\s)${p}`).test(t)));
}

/** Emoji que combina com o hábito ou item ("Beber água" -> 💧, 🥤…). */
export const emojiDe = (titulo) => sortear(grupoDe(titulo)?.emojis ?? QUALQUER);

/** Emoji de comemoração ao marcar como feito: o do hábito ou um de "feito". */
export const emojiFeito = (titulo) => (grupoDe(titulo) && Math.random() < 0.5 ? emojiDe(titulo) : sortear(FEITO));

export const emojiDiaCompleto = () => sortear(DIA_COMPLETO);

// frases variadas para o aviso de um lembrete
const CHAMADAS = ['Que tal agora?', 'Só um minutinho para isso.', 'Lembrete da sua rotina.', 'Bora manter a sequência?', 'Hora de uma pausa para isso.'];
export const chamadaLembrete = () => sortear(CHAMADAS);
