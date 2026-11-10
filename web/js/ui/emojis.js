// Figura das notificações: combina com o hábito e muda a cada aviso.
// Academia/treino, água, estudo/leitura e conclusão usam as ilustrações do Pauta
// (assets/notificacao/*.png); os outros hábitos usam emoji. É enfeite: o texto continua dizendo tudo.
import { normalizar } from '../core/format.js';

// Dois conjuntos de ilustrações: 'aquarela' (padrão) e 'traco' (assets/notificacao/traco/).
// Para trocar o estilo de todas as notificações, mude só esta linha.
const ESTILO = 'aquarela';
const FIGURA = (nome) => (ESTILO === 'traco' ? `assets/notificacao/traco/${nome}.png` : `assets/notificacao/${nome}.png`);
/** A figura é uma ilustração (caminho de imagem) ou um emoji? */
export const ehImagem = (figura) => typeof figura === 'string' && figura.startsWith('assets/');

// a ordem importa: o primeiro grupo cujas palavras aparecem no título vence
const GRUPOS = [
  { palavras: ['agua', 'hidrat', 'beber'], emojis: [FIGURA('agua')] },
  { palavras: ['remedio', 'medicamento', 'vitamina', 'suplemento'], emojis: ['💊', '🍊', '🩺'] },
  { palavras: ['academia', 'treino', 'treinar', 'musculacao', 'crossfit', 'flexoes'], emojis: [FIGURA('academia')] },
  { palavras: ['correr', 'corrida', 'caminhar', 'caminhada', 'pedalar', 'bike'], emojis: [FIGURA('academia'), '🏃', '👟'] },
  { palavras: ['yoga', 'alongar', 'alongamento', 'pilates'], emojis: ['🧘', '🤸', '🌿'] },
  { palavras: ['meditar', 'meditacao', 'respirar'], emojis: ['🧘', '🌿', '🕊️'] },
  { palavras: ['futebol', 'nadar', 'natacao', 'esporte'], emojis: ['⚽', '🏊', '🏅'] },
  { palavras: ['ler', 'leitura', 'livro'], emojis: [FIGURA('estudo')] },
  { palavras: ['estudar', 'estudo', 'aula', 'curso', 'revisar', 'prova', 'faculdade', 'tcc', 'exercicios', 'ingles', 'idioma'], emojis: [FIGURA('estudo')] },
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
const FEITO = [FIGURA('conclusao')];
const DIA_COMPLETO = [FIGURA('conclusao')];

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

/** Figura ao marcar como feito: a ilustração de conclusão. */
export const emojiFeito = () => sortear(FEITO);

export const emojiDiaCompleto = () => sortear(DIA_COMPLETO);

// frases variadas para o aviso de um lembrete
const CHAMADAS = ['Que tal agora?', 'Só um minutinho para isso.', 'Lembrete da sua rotina.', 'Bora manter a sequência?', 'Hora de uma pausa para isso.'];
export const chamadaLembrete = () => sortear(CHAMADAS);
