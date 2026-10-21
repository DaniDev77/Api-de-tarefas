// Fonte de dados real: a API ASP.NET Core (Controllers Usuario, Categoria e Tarefa).
// Na rotina: Usuario = perfil, Categoria = área, Tarefa = um item da pauta de um dia.
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

export const normalizarTarefa = (t) => ({
  id: Number(t.id),
  titulo: t.titulo ?? '',
  descricao: t.descricao ?? '',
  dataCriacao: lerData(t.dataCriacao),
  dataLimite: lerData(t.dataLimite),
  status: Number(t.status) || 1,
  prioridade: Number(t.prioridade) || 2,
  usuarioId: Number(t.usuarioId),
  categoriaId: Number(t.categoriaId),
});

// Corpo enviado nos POST/PUT: exatamente as propriedades dos Models em C#.
const corpoUsuario = (d, id = 0) => ({ id, nome: d.nome.trim(), email: (d.email ?? '').trim(), telefone: (d.telefone ?? '').trim() });
const corpoCategoria = (d, id = 0) => ({ id, nome: d.nome.trim(), descricao: (d.descricao ?? '').trim() });
const corpoTarefa = (d, id = 0) => ({
  id,
  titulo: d.titulo.trim(),
  descricao: (d.descricao ?? '').trim(),
  dataLimite: paraApi(d.dataLimite),
  status: Number(d.status),
  prioridade: Number(d.prioridade),
  usuarioId: Number(d.usuarioId),
  categoriaId: Number(d.categoriaId),
});

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
  return {
    tipo: 'api',
    baseUrl,
    /** Testa a conexão com uma chamada leve. */
    testar: () => requisicao(baseUrl, '/Categoria', { timeout: 6000 }),
    usuarios: recurso(baseUrl, 'Usuario', normalizarUsuario, corpoUsuario),
    categorias: recurso(baseUrl, 'Categoria', normalizarCategoria, corpoCategoria),
    tarefas: recurso(baseUrl, 'Tarefa', normalizarTarefa, corpoTarefa),
  };
}
