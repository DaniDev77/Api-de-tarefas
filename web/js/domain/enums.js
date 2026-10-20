// Espelho dos enums da API (projeto/Enums). Os números precisam ser idênticos aos do C#.

export const STATUS = Object.freeze({
  A_FAZER: 1,
  EM_ANDAMENTO: 2,
  CONCLUIDA: 3,
  CANCELADA: 4,
});

export const PRIORIDADE = Object.freeze({
  BAIXA: 1,
  MEDIA: 2,
  ALTA: 3,
  URGENTE: 4,
});

export const STATUS_INFO = {
  1: { valor: 1, rotulo: 'A fazer', curto: 'A fazer' },
  2: { valor: 2, rotulo: 'Em andamento', curto: 'Andamento' },
  3: { valor: 3, rotulo: 'Concluída', curto: 'Concluída' },
  4: { valor: 4, rotulo: 'Cancelada', curto: 'Cancelada' },
};

export const PRIORIDADE_INFO = {
  1: { valor: 1, rotulo: 'Baixa' },
  2: { valor: 2, rotulo: 'Média' },
  3: { valor: 3, rotulo: 'Alta' },
  4: { valor: 4, rotulo: 'Urgente' },
};

export const LISTA_STATUS = [1, 2, 3, 4].map((v) => STATUS_INFO[v]);
export const LISTA_PRIORIDADE = [4, 3, 2, 1].map((v) => PRIORIDADE_INFO[v]);

/** Tarefa "aberta" = ainda exige ação. */
export const estaAberta = (t) => t.status === STATUS.A_FAZER || t.status === STATUS.EM_ANDAMENTO;

/**
 * Paleta categórica (8 cores validadas para daltonismo, nos temas claro e escuro).
 * A cor segue a categoria pelo ID: nunca muda quando um filtro esconde outras categorias.
 */
export const TOTAL_CORES_CATEGORIA = 8;
export const corCategoria = (categoria) => `var(--cat-${((Number(categoria?.id) || 1) - 1) % TOTAL_CORES_CATEGORIA})`;

/** Cor estável do avatar a partir do ID. */
export const tomAvatar = (usuario) => ((Number(usuario?.id) || 0) * 7) % 6;
