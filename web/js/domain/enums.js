// Espelho dos enums da API (projeto/Enums). Os números precisam ser idênticos aos do C#.
// Os rótulos são os da rotina: a API continua com AFazer/EmAndamento/Concluida/Cancelada.

export const STATUS = Object.freeze({
  A_FAZER: 1,
  EM_ANDAMENTO: 2, // usado pelo Foco enquanto o cronômetro roda
  CONCLUIDA: 3,
  CANCELADA: 4, // "pulei hoje": não conta como falha nem como feito
});

export const PRIORIDADE = Object.freeze({
  BAIXA: 1,
  MEDIA: 2,
  ALTA: 3,
  URGENTE: 4,
});

export const STATUS_INFO = {
  1: { valor: 1, rotulo: 'A fazer' },
  2: { valor: 2, rotulo: 'Fazendo agora' },
  3: { valor: 3, rotulo: 'Feito' },
  4: { valor: 4, rotulo: 'Pulado' },
};

export const PRIORIDADE_INFO = {
  1: { valor: 1, rotulo: 'Baixa' },
  2: { valor: 2, rotulo: 'Média' },
  3: { valor: 3, rotulo: 'Alta' },
  4: { valor: 4, rotulo: 'Urgente' },
};

/** Item "aberto" = ainda espera ação. */
export const estaAberta = (t) => t.status === STATUS.A_FAZER || t.status === STATUS.EM_ANDAMENTO;
export const estaFeita = (t) => t.status === STATUS.CONCLUIDA;
export const foiPulada = (t) => t.status === STATUS.CANCELADA;

/**
 * Cada área (Categoria da API) tem um tom estável, escolhido pelo ID.
 * É identidade, como a cor de uma pessoa: aparece no ponto da área e na marca de "feito".
 */
export const TOTAL_TONS = 8;
export const tomArea = (categoriaId) => ((Number(categoriaId) || 1) - 1) % TOTAL_TONS;
