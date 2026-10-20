// Estado global + ações. As telas só leem o estado e chamam ações; nunca falam direto com a API.
// Atualizações otimistas: a tela muda na hora e, se a API recusar, volta ao estado anterior.
import { criarStore } from './core/store.js';
import { ler, gravar } from './core/storage.js';
import { criarFonteApi } from './data/api.js';
import { criarFonteDemo, restaurarDemonstracao } from './data/demo.js';
import { API_PADRAO, TEMPO_DESFAZER_MS, EQUIPE_DEMO } from './config.js';
import { STATUS_INFO } from './domain/enums.js';
import { toast } from './ui/toast.js';

// index.html?demo abre direto no modo demonstração (link para apresentar o sistema a um cliente)
const linkDemo = new URLSearchParams(location.search).has('demo');

const preferencias = {
  apiUrl: ler('apiUrl', API_PADRAO),
  fonte: linkDemo ? 'demo' : ler('fonte', 'api'),
  tema: ler('tema', 'sistema'),
  equipe: ler('equipe', ''),
};

export const store = criarStore({
  fase: 'carregando', // carregando | pronto | erro
  erro: null,
  fonte: preferencias.fonte, // api | demo
  apiUrl: preferencias.apiUrl,
  tema: preferencias.tema, // sistema | claro | escuro
  equipe: preferencias.equipe, // nome da equipe ('' = não definido)
  usuarios: [],
  categorias: [],
  tarefas: [],
  sincronizadoEm: null,
  sincronizando: false,
});

let fonte = criarFonte(preferencias.fonte, preferencias.apiUrl);

function criarFonte(tipo, url) {
  return tipo === 'demo' ? criarFonteDemo() : criarFonteApi(url);
}

export const fonteAtual = () => fonte;

// ---------------------------------------------------------------- carga

let cargaAtual = 0;

/**
 * Busca pessoas, categorias e tarefas em paralelo.
 * Se a tela já tem dados, mantém o que está visível (sem "piscar" esqueleto) e só avisa em caso de erro.
 */
export async function carregarTudo() {
  const id = ++cargaAtual;
  const jaPronto = store.get().fase === 'pronto';
  store.set(jaPronto ? { sincronizando: true } : { fase: 'carregando', erro: null, sincronizando: true });
  try {
    const [usuarios, categorias, tarefas] = await Promise.all([fonte.usuarios.listar(), fonte.categorias.listar(), fonte.tarefas.listar()]);
    if (id !== cargaAtual) return; // uma carga mais nova já está em andamento
    // tarefas com exclusão pendente (aguardando "Desfazer") continuam escondidas
    const visiveis = tarefas.filter((t) => !exclusoesPendentes.has(t.id));
    store.set({ fase: 'pronto', erro: null, usuarios, categorias, tarefas: visiveis, sincronizadoEm: new Date(), sincronizando: false });
  } catch (erro) {
    if (id !== cargaAtual) return;
    if (jaPronto) {
      store.set({ sincronizando: false });
      toast(erro.message, { tipo: 'erro' });
      return;
    }
    store.set({ fase: 'erro', erro, sincronizando: false });
  }
}

// ---------------------------------------------------------------- preferências

export function definirFonte(tipo) {
  gravar('fonte', tipo);
  fonte = criarFonte(tipo, store.get().apiUrl);
  store.set({ fonte: tipo, fase: 'carregando', usuarios: [], categorias: [], tarefas: [] });
  return carregarTudo();
}

export function definirApiUrl(url) {
  const limpa = url.trim().replace(/\/+$/, '');
  gravar('apiUrl', limpa);
  store.set({ apiUrl: limpa });
  if (store.get().fonte === 'api') {
    fonte = criarFonte('api', limpa);
    store.set({ fase: 'carregando' });
    return carregarTudo();
  }
  return Promise.resolve();
}

export async function testarConexao(url) {
  await criarFonteApi(url.trim().replace(/\/+$/, '')).testar();
  return true;
}

export function definirEquipe(nome) {
  const limpo = nome.trim().slice(0, 60);
  gravar('equipe', limpo);
  store.set({ equipe: limpo });
}

/** Nome da equipe para mostrar: o definido, o da demonstração ou vazio. */
export const nomeEquipe = (s) => s.equipe || (s.fonte === 'demo' ? EQUIPE_DEMO : '');

export function definirTema(tema) {
  gravar('tema', tema);
  store.set({ tema });
}

export async function reiniciarDemonstracao() {
  restaurarDemonstracao();
  if (store.get().fonte === 'demo') await carregarTudo();
}

// ---------------------------------------------------------------- utilidades internas

const substituir = (lista, item) => lista.map((x) => (x.id === item.id ? item : x));

function falhou(erro, acao) {
  // com um formulário aberto, o erro aparece dentro dele; a notificação seria repetida
  if (!document.querySelector('dialog.modal[open] form')) {
    toast(erro?.message || `Não foi possível ${acao}.`, { tipo: 'erro', detalhe: erro?.detalhe });
  }
  throw erro;
}

// ---------------------------------------------------------------- tarefas

/**
 * @param {object} dados
 * @param {{ acao?: (nova: object) => { rotulo: string, fn: () => void } }} [opcoes] botão extra na notificação
 */
export async function criarTarefa(dados, { acao } = {}) {
  try {
    const nova = await fonte.tarefas.criar(dados);
    store.set((s) => ({ tarefas: [...s.tarefas, nova] }));
    // lembra pessoa e categoria: viram o padrão da próxima tarefa
    gravar('ultimos', { usuarioId: nova.usuarioId, categoriaId: nova.categoriaId });
    toast('Tarefa criada', { tipo: 'sucesso', acao: acao?.(nova) });
    return nova;
  } catch (e) {
    return falhou(e, 'criar a tarefa');
  }
}

export async function atualizarTarefa(id, dados, { mensagem = 'Tarefa salva' } = {}) {
  const anterior = store.get().tarefas.find((t) => t.id === id);
  if (!anterior) return null;
  const otimista = { ...anterior, ...dados };
  store.set((s) => ({ tarefas: substituir(s.tarefas, otimista) }));
  try {
    const salva = await fonte.tarefas.atualizar(id, otimista);
    store.set((s) => ({ tarefas: substituir(s.tarefas, salva) }));
    if (mensagem) toast(mensagem, { tipo: 'sucesso' });
    return salva;
  } catch (e) {
    store.set((s) => ({ tarefas: substituir(s.tarefas, anterior) }));
    return falhou(e, 'salvar a tarefa');
  }
}

export function alterarStatus(id, status) {
  const tarefa = store.get().tarefas.find((t) => t.id === id);
  if (!tarefa || tarefa.status === status) return Promise.resolve(tarefa);
  const anterior = tarefa.status;
  return atualizarTarefa(id, { status }, { mensagem: null }).then((salva) => {
    toast(`Movida para ${STATUS_INFO[status].rotulo}`, {
      tipo: 'sucesso',
      acao: { rotulo: 'Desfazer', fn: () => atualizarTarefa(id, { status: anterior }, { mensagem: null }).catch(() => {}) },
    });
    return salva;
  });
}

// Exclusão com "Desfazer": some da tela na hora e só é apagada na API depois do prazo.
const exclusoesPendentes = new Map();

export function excluirTarefa(id) {
  const tarefa = store.get().tarefas.find((t) => t.id === id);
  if (!tarefa) return;
  store.set((s) => ({ tarefas: s.tarefas.filter((t) => t.id !== id) }));

  const efetivar = async () => {
    exclusoesPendentes.delete(id);
    try {
      await fonte.tarefas.excluir(id);
    } catch (e) {
      store.set((s) => ({ tarefas: [...s.tarefas, tarefa] }));
      toast(`Não foi possível excluir "${tarefa.titulo}". ${e.message}`, { tipo: 'erro' });
    }
  };
  const timer = setTimeout(efetivar, TEMPO_DESFAZER_MS);
  exclusoesPendentes.set(id, { timer, efetivar });

  toast('Tarefa excluída', {
    duracao: TEMPO_DESFAZER_MS,
    acao: {
      rotulo: 'Desfazer',
      fn: () => {
        const pendente = exclusoesPendentes.get(id);
        if (!pendente) return;
        clearTimeout(pendente.timer);
        exclusoesPendentes.delete(id);
        store.set((s) => ({ tarefas: [...s.tarefas, tarefa] }));
      },
    },
  });
}

/** Se a página for fechada, as exclusões pendentes são enviadas na hora. */
export function efetivarExclusoesPendentes() {
  exclusoesPendentes.forEach((p) => {
    clearTimeout(p.timer);
    p.efetivar();
  });
}

// ---------------------------------------------------------------- pessoas e categorias

function crud(chave, nomeSingular, genero = 'a') {
  const criada = genero === 'a' ? 'criada' : 'criado';
  const salva = genero === 'a' ? 'salva' : 'salvo';
  const excluida = genero === 'a' ? 'excluída' : 'excluído';
  return {
    async criar(dados) {
      try {
        const novo = await fonte[chave].criar(dados);
        store.set((s) => ({ [chave]: [...s[chave], novo] }));
        toast(`${nomeSingular} ${criada}`, { tipo: 'sucesso' });
        return novo;
      } catch (e) {
        return falhou(e, `criar ${nomeSingular.toLowerCase()}`);
      }
    },
    async atualizar(id, dados) {
      try {
        const item = await fonte[chave].atualizar(id, dados);
        store.set((s) => ({ [chave]: substituir(s[chave], item) }));
        toast(`${nomeSingular} ${salva}`, { tipo: 'sucesso' });
        return item;
      } catch (e) {
        return falhou(e, `salvar ${nomeSingular.toLowerCase()}`);
      }
    },
    async excluir(id) {
      const campo = chave === 'usuarios' ? 'usuarioId' : 'categoriaId';
      try {
        await fonte[chave].excluir(id);
        // o banco apaga as tarefas ligadas (ON DELETE CASCADE); refletimos isso na tela
        store.set((s) => ({ [chave]: s[chave].filter((x) => x.id !== id), tarefas: s.tarefas.filter((t) => t[campo] !== id) }));
        toast(`${nomeSingular} ${excluida}`, { tipo: 'sucesso' });
        return true;
      } catch (e) {
        return falhou(e, `excluir ${nomeSingular.toLowerCase()}`);
      }
    },
  };
}

export const pessoas = crud('usuarios', 'Pessoa', 'a');
export const categorias = crud('categorias', 'Categoria', 'a');
