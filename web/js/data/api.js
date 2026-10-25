// Fonte de dados real: a API ASP.NET Core (Controllers Usuario, Categoria, Tarefa e Habito).
// Na rotina: Usuario = perfil, Categoria = área, Habito = a regra que se repete,
// Tarefa = um item da pauta de um dia (gerado pelo hábito ou avulso).
// Os "normalizadores" convertem o JSON da API no formato que as telas usam
// e descartam as navegações (usuario/categoria aninhados), que já temos no estado.
import { requisicao } from './http.js';
import { lerData, paraApi } from '../core/format.js';

export const normalizarUsuario = (u) => ({
  id: Number(u.id),
  nome: u.nome ?? '',
  email: u.email ?? '',
  telefone: u.telefone ?? '',
});

export const normalizarCategoria = (c) => ({
  id: Number(c.id),
  nome: c.nome ?? '',
  descricao: c.descricao ?? '',
});

// Dentro do app, dataLimite é "quando o item está na pauta" (o início) e fim é quando termina.
// Na API: DataInicio = início (nulo nos avulsos) e DataLimite = fim (ou o próprio horário, nos avulsos).
// Assim as telas continuam ordenando e agrupando por dataLimite, com ou sem hábitos na API.
export const normalizarTarefa = (t) => {
  const inicio = lerData(t.dataInicio);
  const limite = lerData(t.dataLimite);
  return {
    id: Number(t.id),
    titulo: t.titulo ?? '',
    descricao: t.descricao ?? '',
    dataCriacao: lerData(t.dataCriacao),
    dataLimite: inicio ?? limite,
    fim: inicio ? limite : null,
    status: Number(t.status) || 1,
    prioridade: Number(t.prioridade) || 2,
    usuarioId: Number(t.usuarioId),
    categoriaId: Number(t.categoriaId),
    habitoId: t.habitoId == null ? null : Number(t.habitoId),
  };
};

/** "1,3,5" -> [1, 3, 5] */
const lerDias = (texto) =>
  [...new Set(String(texto ?? '').split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
/** "18:30:00" -> "18:30" */
const lerHora = (v) => (v ? String(v).slice(0, 5) : null);
const meiaNoite = (d) => (d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null);

export const normalizarHabito = (h) => ({
  id: Number(h.id),
  titulo: h.titulo ?? '',
  descricao: h.descricao ?? '',
  dias: lerDias(h.diasSemana),
  horaInicio: lerHora(h.horaInicio),
  horaFim: lerHora(h.horaFim),
  lembrarACadaMinutos: h.lembrarACadaMinutos == null ? null : Number(h.lembrarACadaMinutos),
  dataInicio: meiaNoite(lerData(h.dataInicio)),
  dataFim: meiaNoite(lerData(h.dataFim)),
  ativo: h.ativo !== false,
  dataCriacao: lerData(h.dataCriacao),
  usuarioId: Number(h.usuarioId),
  categoriaId: Number(h.categoriaId),
});

// Corpo enviado nos POST/PUT: exatamente as propriedades dos Models em C#.
const corpoUsuario = (d, id = 0) => ({ id, nome: d.nome.trim(), email: (d.email ?? '').trim(), telefone: (d.telefone ?? '').trim() });
const corpoCategoria = (d, id = 0) => ({ id, nome: d.nome.trim(), descricao: (d.descricao ?? '').trim() });
const corpoTarefa = (d, id = 0) => ({
  id,
  titulo: d.titulo.trim(),
  descricao: (d.descricao ?? '').trim(),
  dataInicio: d.fim ? paraApi(d.dataLimite) : null,
  dataLimite: paraApi(d.fim ?? d.dataLimite),
  status: Number(d.status),
  prioridade: Number(d.prioridade),
  usuarioId: Number(d.usuarioId),
  categoriaId: Number(d.categoriaId),
  habitoId: d.habitoId ?? null,
});
const corpoHabito = (d, id = 0) => {
  const lembrete = !d.horaInicio;
  return {
    id,
    titulo: d.titulo.trim(),
    descricao: (d.descricao ?? '').trim(),
    diasSemana: [...new Set(d.dias)].sort().join(','),
    horaInicio: lembrete ? null : `${d.horaInicio}:00`,
    horaFim: lembrete ? null : `${d.horaFim}:00`,
    lembrarACadaMinutos: lembrete && d.lembrarACadaMinutos ? Number(d.lembrarACadaMinutos) : null,
    dataInicio: paraApi(meiaNoite(d.dataInicio ?? new Date())),
    dataFim: d.dataFim ? paraApi(meiaNoite(d.dataFim)) : null,
    ativo: d.ativo !== false,
    usuarioId: Number(d.usuarioId),
    categoriaId: Number(d.categoriaId),
  };
};
const chave = (d) => paraApi(meiaNoite(d)).slice(0, 10);

function recurso(baseUrl, nome, normalizar, corpo) {
  const r = (caminho, opcoes) => requisicao(baseUrl, caminho, opcoes);
  return {
    listar: async () => (await r(`/${nome}`)).map(normalizar),
    criar: async (dados) => normalizar(await r(`/${nome}`, { metodo: 'POST', corpo: corpo(dados) })),
    atualizar: async (id, dados) => normalizar(await r(`/${nome}/${id}`, { metodo: 'PUT', corpo: corpo(dados, id) })),
    excluir: async (id) => {
      await r(`/${nome}/${id}`, { metodo: 'DELETE' });
      return true;
    },
  };
}

export function criarFonteApi(baseUrl) {
  const r = (caminho, opcoes) => requisicao(baseUrl, caminho, opcoes);
  const tarefas = recurso(baseUrl, 'Tarefa', normalizarTarefa, corpoTarefa);
  const habitos = recurso(baseUrl, 'Habito', normalizarHabito, corpoHabito);
  return {
    tipo: 'api',
    baseUrl,
    /** Testa a conexão com uma chamada leve. */
    testar: () => requisicao(baseUrl, '/Categoria', { timeout: 6000 }),
    usuarios: recurso(baseUrl, 'Usuario', normalizarUsuario, corpoUsuario),
    categorias: recurso(baseUrl, 'Categoria', normalizarCategoria, corpoCategoria),
    tarefas: {
      ...tarefas,
      // ?de= limita o histórico carregado (uma API antiga ignora o filtro e devolve tudo)
      listar: async ({ de } = {}) => (await r(`/Tarefa${de ? `?de=${chave(de)}` : ''}`)).map(normalizarTarefa),
    },
    habitos: {
      ...habitos,
      /** null = a API ainda não tem o HabitoController (o app usa o modo antigo, só com tarefas). */
      listar: async () => {
        try {
          return (await r('/Habito')).map(normalizarHabito);
        } catch (e) {
          if (e?.status === 404 || e?.status === 405) return null;
          throw e;
        }
      },
      /** Cria as tarefas que faltam dos hábitos nesses dias e devolve as tarefas de hábito do período. */
      gerar: async (usuarioId, de, ate = de) =>
        (await r(`/Habito/gerar?usuarioId=${usuarioId}&de=${chave(de)}&ate=${chave(ate)}`, { metodo: 'POST' })).map(normalizarTarefa),
    },
  };
}
