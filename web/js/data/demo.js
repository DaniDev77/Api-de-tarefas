// Fonte de dados de demonstração: mesma interface da API, guardada no navegador (localStorage).
// Serve para apresentar o sistema sem a API ligada e para não travar quem ainda está configurando.
import { ler, gravar, remover } from '../core/storage.js';
import { paraApi } from '../core/format.js';
import { normalizarUsuario, normalizarCategoria, normalizarTarefa } from './api.js';
import { ApiError } from './http.js';

const CHAVE = 'demo:v2';
const espera = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 140));

function dataRelativa(dias, h = 18, m = 0) {
  const d = new Date();
  return paraApi(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias, h, m));
}

function semente() {
  const usuarios = [
    { id: 1, nome: 'Ana Beatriz Rocha', email: 'ana.rocha@tramela.com.br', telefone: '(14) 99812-3344' },
    { id: 2, nome: 'Bruno Tavares', email: 'bruno.tavares@tramela.com.br', telefone: '(14) 99603-1188' },
    { id: 3, nome: 'Camila Nogueira', email: 'camila.nogueira@tramela.com.br', telefone: '(11) 98455-2010' },
    { id: 4, nome: 'Diego Martins', email: 'diego.martins@tramela.com.br', telefone: '(14) 3224-5070' },
    { id: 5, nome: 'Fernanda Alves', email: 'fernanda.alves@tramela.com.br', telefone: '' },
  ];
  const categorias = [
    { id: 1, nome: 'Desenvolvimento', descricao: 'Código, correções e publicações do app.' },
    { id: 2, nome: 'Design', descricao: 'Interface, protótipos e identidade visual.' },
    { id: 3, nome: 'Atendimento', descricao: 'Chamados, reuniões e relacionamento com clientes.' },
    { id: 4, nome: 'Financeiro', descricao: 'Notas, orçamentos e contratos.' },
    { id: 5, nome: 'Marketing', descricao: 'Campanhas, conteúdo e pesquisas.' },
    { id: 6, nome: 'Estudos', descricao: 'Cursos e capacitação da equipe.' },
  ];
  // [titulo, descricao, categoria, pessoa, prioridade, status, prazo (dias), hora, criada há (dias)]
  const base = [
    ['Corrigir cálculo de frete no checkout', 'Pedidos acima de 5 kg estão saindo com frete zerado.', 1, 2, 4, 2, 0, 17, 2],
    ['Publicar versão 2.3 do app', 'Gerar build, revisar notas da versão e enviar para as lojas.', 1, 4, 3, 1, 2, 12, 6],
    ['Revisar protótipo da tela de pedidos', '', 2, 3, 3, 2, 1, 16, 4],
    ['Responder chamados pendentes da semana', 'Prioridade para os clientes do plano anual.', 3, 5, 2, 1, -1, 18, 5],
    ['Conciliar notas fiscais de setembro', '', 4, 1, 3, 1, -3, 18, 12],
    ['Planejar campanha de fim de ano', 'Definir canais, orçamento e calendário de posts.', 5, 3, 2, 1, 6, 18, 3],
    ['Escrever testes do módulo de estoque', '', 1, 2, 2, 1, 4, 18, 2],
    ['Atualizar política de privacidade', 'Incluir o novo uso de cookies de análise.', 3, 1, 1, 1, 9, 18, 7],
    ['Migrar banco de homologação', '', 1, 4, 3, 3, -2, 18, 9],
    ['Criar ícones do novo menu', '', 2, 3, 1, 3, -4, 18, 10],
    ['Gravar vídeo tutorial de cadastro', 'Até 3 minutos, com legenda.', 5, 5, 2, 2, 3, 18, 4],
    ['Estudar migrations do Entity Framework', 'Add-Migration, Update-Database e rollback.', 6, 4, 2, 1, 5, 20, 1],
    ['Reunião de alinhamento com o cliente', 'Levar o cronograma atualizado.', 3, 1, 3, 1, 0, 23, 3],
    ['Ajustar contraste do tema escuro', '', 2, 3, 2, 3, -1, 18, 6],
    ['Renegociar plano do servidor', 'O fornecedor manteve o preço; seguimos no plano atual.', 4, 1, 2, 4, -5, 18, 15],
    ['Documentar endpoints da API no Swagger', '', 1, 2, 1, 1, 11, 18, 2],
    ['Pesquisa de satisfação com clientes', '', 5, 5, 1, 1, 13, 18, 1],
    ['Enviar proposta comercial revisada', 'Aplicar o desconto de 8% aprovado na reunião.', 4, 1, 4, 1, 1, 10, 1],
    ['Configurar backup automático', '', 1, 4, 3, 3, -6, 18, 14],
    ['Revisar textos do onboarding', '', 2, 5, 2, 1, 7, 18, 3],
    ['Curso de acessibilidade web', 'Módulos 3 a 5.', 6, 3, 1, 2, 12, 18, 8],
    ['Fechar orçamento do trimestre', '', 4, 1, 3, 1, 8, 18, 4],
    ['Corrigir layout do e-mail de boas-vindas', '', 1, 2, 2, 3, -3, 18, 7],
    ['Organizar base de conhecimento', '', 3, 5, 1, 4, 2, 18, 11],
    ['Treinamento da equipe de suporte', 'Novo fluxo de chamados.', 3, 5, 2, 1, 16, 9, 2],
    ['Revisar acessibilidade do formulário de contato', '', 2, 3, 2, 1, 3, 18, 1],
  ];
  const tarefas = base.map(([titulo, descricao, categoriaId, usuarioId, prioridade, status, prazo, h, criada], i) => ({
    id: i + 1,
    titulo,
    descricao,
    dataCriacao: dataRelativa(-criada, 9 + (i % 8), (i * 7) % 60),
    dataLimite: dataRelativa(prazo, h, 0),
    status,
    prioridade,
    usuarioId,
    categoriaId,
  }));
  return { usuarios, categorias, tarefas, seq: { usuarios: 5, categorias: 6, tarefas: tarefas.length } };
}

function carregar() {
  const salvo = ler(CHAVE);
  if (salvo?.usuarios && salvo?.tarefas) return salvo;
  const novo = semente();
  gravar(CHAVE, novo);
  return novo;
}

export function restaurarDemonstracao() {
  remover(CHAVE);
}

function recurso(nome, normalizar, limpar) {
  return {
    listar: async () => {
      await espera();
      return carregar()[nome].map(normalizar);
    },
    criar: async (dados) => {
      await espera();
      const db = carregar();
      db.seq[nome] += 1;
      const item = { id: db.seq[nome], ...limpar(dados) };
      if (nome === 'tarefas') item.dataCriacao = paraApi(new Date());
      db[nome].push(item);
      gravar(CHAVE, db);
      return normalizar(item);
    },
    atualizar: async (id, dados) => {
      await espera();
      const db = carregar();
      const item = db[nome].find((x) => x.id === id);
      if (!item) throw new ApiError('Esse registro já foi excluído. Atualize os dados.', { status: 500, tipo: 'servidor' });
      Object.assign(item, limpar(dados));
      gravar(CHAVE, db);
      return normalizar(item);
    },
    excluir: async (id) => {
      await espera();
      const db = carregar();
      db[nome] = db[nome].filter((x) => x.id !== id);
      // mesmo comportamento do banco: excluir pessoa/categoria apaga as tarefas ligadas (cascade)
      if (nome === 'usuarios') db.tarefas = db.tarefas.filter((t) => t.usuarioId !== id);
      if (nome === 'categorias') db.tarefas = db.tarefas.filter((t) => t.categoriaId !== id);
      gravar(CHAVE, db);
      return true;
    },
  };
}

export function criarFonteDemo() {
  return {
    tipo: 'demo',
    testar: async () => true,
    usuarios: recurso('usuarios', normalizarUsuario, (d) => ({ nome: d.nome.trim(), email: d.email.trim(), telefone: (d.telefone ?? '').trim() })),
    categorias: recurso('categorias', normalizarCategoria, (d) => ({ nome: d.nome.trim(), descricao: (d.descricao ?? '').trim() })),
    tarefas: recurso('tarefas', normalizarTarefa, (d) => ({
      titulo: d.titulo.trim(),
      descricao: (d.descricao ?? '').trim(),
      dataLimite: paraApi(d.dataLimite),
      status: Number(d.status),
      prioridade: Number(d.prioridade),
      usuarioId: Number(d.usuarioId),
      categoriaId: Number(d.categoriaId),
    })),
  };
}
