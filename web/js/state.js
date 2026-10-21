// Estado global + ações. As telas só leem o estado e chamam ações; nunca falam direto com a API.
// Atualizações otimistas: a tela muda na hora e, se a API recusar, volta ao estado anterior.
// Ações em lote (criar um hábito para 4 semanas, encerrar um hábito) mandam vários pedidos com
// concorrência limitada e mostram o progresso numa notificação.
import { criarStore } from './core/store.js';
import { ler, gravar, remover } from './core/storage.js';
import { normalizar, diaMes, plural } from './core/format.js';
import { criarFonteApi } from './data/api.js';
import { criarFonteDemo, restaurarDemonstracao } from './data/demo.js';
import { API_PADRAO, TEMPO_DESFAZER_MS } from './config.js';
import { STATUS, estaAberta } from './domain/enums.js';
import { datasDaSerie, datasParaEstender, proximosAbertos, minutosDeTexto } from './domain/rotina.js';
import { toast } from './ui/toast.js';

// index.html?demo abre direto no modo demonstração (link para apresentar o sistema)
const linkDemo = new URLSearchParams(location.search).has('demo');

const preferencias = {
  apiUrl: ler('apiUrl', API_PADRAO),
  fonte: linkDemo ? 'demo' : ler('fonte', 'api'),
  tema: ler('tema', 'sistema'),
};

export const store = criarStore({
  fase: 'carregando', // carregando | pronto | erro
  erro: null,
  fonte: preferencias.fonte, // api | demo
  apiUrl: preferencias.apiUrl,
  tema: preferencias.tema, // sistema | claro | escuro
  perfilId: ler(`perfil:${preferencias.fonte}`, null), // o Usuario da API que está usando o app
  usuarios: [],
  categorias: [],
  tarefas: [],
  foco: ler('foco', null), // { tarefaId, duracaoMs, fimEm, restanteMs, pausado }
  sincronizadoEm: null,
  sincronizando: false,
});

let fonte = criarFonte(preferencias.fonte, preferencias.apiUrl);

function criarFonte(tipo, url) {
  return tipo === 'demo' ? criarFonteDemo() : criarFonteApi(url);
}

export const fonteAtual = () => fonte;

/** O perfil em uso: o escolhido ou, se houver um só, ele. */
export function perfilAtual(s = store.get()) {
  return s.usuarios.find((u) => u.id === s.perfilId) ?? (s.usuarios.length === 1 ? s.usuarios[0] : null);
}

// ---------------------------------------------------------------- carga

let cargaAtual = 0;

/**
 * Busca perfis, áreas e tarefas em paralelo.
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
    const s = store.get();
    if (!s.usuarios.some((u) => u.id === s.perfilId) && s.usuarios.length === 1) definirPerfil(s.usuarios[0].id);
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
  store.set({ fonte: tipo, perfilId: ler(`perfil:${tipo}`, null), fase: 'carregando', usuarios: [], categorias: [], tarefas: [] });
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

export function definirTema(tema) {
  gravar('tema', tema);
  store.set({ tema });
}

export function definirPerfil(id) {
  gravar(`perfil:${store.get().fonte}`, id);
  store.set({ perfilId: id });
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

/** Executa `fn` para cada item, no máximo `concorrencia` pedidos ao mesmo tempo. */
async function emLote(lista, fn, { concorrencia = 4, aoAvancar } = {}) {
  const resultados = [];
  const falhas = [];
  let proximo = 0;
  let feitos = 0;
  const trabalhador = async () => {
    while (proximo < lista.length) {
      const i = proximo++;
      try {
        resultados[i] = await fn(lista[i], i);
      } catch (erro) {
        falhas.push({ item: lista[i], erro });
      }
      feitos++;
      aoAvancar?.(feitos, lista.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concorrencia, lista.length) }, trabalhador));
  return { resultados: resultados.filter(Boolean), falhas };
}

/** Notificação que acompanha um lote: "Criando 12 de 28…" e, no fim, o resultado. */
function progresso(texto, total) {
  if (total <= 3) return { avancar() {}, terminar: (msg, tipo = 'sucesso', opcoes = {}) => toast(msg, { tipo, ...opcoes }) };
  const t = toast(texto(0, total), { tipo: 'progresso', duracao: Infinity });
  return {
    avancar: (n) => t.atualizar(texto(n, total)),
    terminar(msg, tipo = 'sucesso', opcoes = {}) {
      t();
      toast(msg, { tipo, ...opcoes });
    },
  };
}

function exigirPerfil() {
  const p = perfilAtual();
  if (!p) throw new Error('Escolha um perfil antes de montar a rotina.');
  return p;
}

// ---------------------------------------------------------------- itens da pauta (Tarefas)

/** Um item avulso (uma tarefa num dia e horário). */
export async function criarItem(dados, { mensagem } = {}) {
  try {
    const perfil = exigirPerfil();
    const nova = await fonte.tarefas.criar({ status: STATUS.A_FAZER, prioridade: 2, descricao: '', usuarioId: perfil.id, ...dados });
    store.set((s) => ({ tarefas: [...s.tarefas, nova] }));
    gravar('ultimaArea', nova.categoriaId);
    if (mensagem !== null) toast(mensagem ?? 'Adicionado à pauta', { tipo: 'sucesso' });
    return nova;
  } catch (e) {
    return falhou(e, 'adicionar o item');
  }
}

/**
 * Cria um hábito: uma tarefa para cada dia e horário escolhidos, pelas próximas N semanas.
 * @param {{ titulo: string, descricao?: string, categoriaId: number, dias: number[], horarios: string[], semanas?: number, inicio?: Date }} h
 */
export async function criarHabito({ titulo, descricao = '', categoriaId, dias, horarios, semanas = 4, inicio = new Date() }) {
  const perfil = exigirPerfil();
  const datas = datasDaSerie({ dias, horarios, inicio, semanas });
  if (!datas.length) {
    toast('Nenhum dia e horário cai nesse período. Confira os dias da semana e os horários.', { tipo: 'erro' });
    return { criadas: [], falhas: [] };
  }
  gravar('ultimaArea', categoriaId);
  const barra = progresso((n, total) => `Criando ${titulo}: ${n} de ${total}…`, datas.length);
  const { resultados, falhas } = await emLote(
    datas,
    (dataLimite) => fonte.tarefas.criar({ titulo, descricao, dataLimite, status: STATUS.A_FAZER, prioridade: 2, usuarioId: perfil.id, categoriaId }),
    { aoAvancar: barra.avancar }
  );
  store.set((s) => ({ tarefas: [...s.tarefas, ...resultados] }));
  if (falhas.length) {
    barra.terminar(`${titulo}: ${resultados.length} de ${datas.length} criados. ${falhas[0].erro.message}`, 'erro');
  } else {
    const ultima = datas.at(-1);
    barra.terminar(datas.length === 1 ? `${titulo} adicionado à pauta` : `${titulo}: ${plural(datas.length, 'item', 'itens')} na pauta até ${diaMes(ultima)}`);
  }
  return { criadas: resultados, falhas };
}

/** Mais N semanas de um hábito, no mesmo padrão de dias e horários. */
export async function estenderHabito(serie, semanas = 4) {
  const perfil = exigirPerfil();
  const datas = datasParaEstender(serie, semanas);
  if (!datas.length) {
    toast('Não há dias para estender nesse padrão.', { tipo: 'erro' });
    return;
  }
  const modelo = serie.itens.at(-1);
  const barra = progresso((n, total) => `Estendendo ${serie.titulo}: ${n} de ${total}…`, datas.length);
  const { resultados, falhas } = await emLote(
    datas,
    (dataLimite) => fonte.tarefas.criar({ titulo: serie.titulo, descricao: modelo.descricao, dataLimite, status: STATUS.A_FAZER, prioridade: modelo.prioridade, usuarioId: perfil.id, categoriaId: serie.categoriaId }),
    { aoAvancar: barra.avancar }
  );
  store.set((s) => ({ tarefas: [...s.tarefas, ...resultados] }));
  if (falhas.length) barra.terminar(`${serie.titulo}: ${resultados.length} de ${datas.length} criados. ${falhas[0].erro.message}`, 'erro');
  else barra.terminar(`${serie.titulo} segue na pauta até ${diaMes(datas.at(-1))}`);
}

/**
 * Muda os próximos itens em aberto de um hábito (os já feitos ficam como estão, para o histórico).
 * @param {{ titulo?: string, categoriaId?: number, horario?: string, descricao?: string }} mudancas
 */
export async function editarProximos(serie, mudancas) {
  const alvos = proximosAbertos(serie);
  if (!alvos.length) return;
  const minutos = mudancas.horario ? minutosDeTexto(mudancas.horario) : null;
  const barra = progresso((n, total) => `Atualizando ${serie.titulo}: ${n} de ${total}…`, alvos.length);
  const { resultados, falhas } = await emLote(
    alvos,
    (t) => {
      const dataLimite = new Date(t.dataLimite);
      if (minutos !== null) dataLimite.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
      return fonte.tarefas.atualizar(t.id, {
        ...t,
        titulo: mudancas.titulo ?? t.titulo,
        categoriaId: mudancas.categoriaId ?? t.categoriaId,
        descricao: mudancas.descricao ?? t.descricao,
        dataLimite,
      });
    },
    { aoAvancar: barra.avancar }
  );
  store.set((s) => {
    const porId = new Map(resultados.map((r) => [r.id, r]));
    return { tarefas: s.tarefas.map((t) => porId.get(t.id) ?? t) };
  });
  if (falhas.length) barra.terminar(`${resultados.length} de ${alvos.length} atualizados. ${falhas[0].erro.message}`, 'erro');
  else barra.terminar(`${plural(alvos.length, 'próximo item atualizado', 'próximos itens atualizados')}`);
}

/** Encerra um hábito: apaga os itens futuros em aberto e mantém o histórico. */
export async function encerrarHabito(serie) {
  const alvos = proximosAbertos(serie);
  if (!alvos.length) return;
  const barra = progresso((n, total) => `Encerrando ${serie.titulo}: ${n} de ${total}…`, alvos.length);
  const { resultados, falhas } = await emLote(alvos, (t) => fonte.tarefas.excluir(t.id).then(() => t.id), { aoAvancar: barra.avancar });
  const apagados = new Set(resultados);
  store.set((s) => ({ tarefas: s.tarefas.filter((t) => !apagados.has(t.id)) }));
  if (falhas.length) barra.terminar(`${apagados.size} de ${alvos.length} removidos. ${falhas[0].erro.message}`, 'erro');
  else barra.terminar(`${serie.titulo} encerrado. O histórico continua no Progresso.`);
}

export async function atualizarTarefa(id, dados, { mensagem = 'Item salvo' } = {}) {
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
    return falhou(e, 'salvar o item');
  }
}

const MENSAGEM_STATUS = {
  [STATUS.A_FAZER]: (t) => `Reaberto: ${t.titulo}`,
  [STATUS.EM_ANDAMENTO]: (t) => `Fazendo agora: ${t.titulo}`,
  [STATUS.CONCLUIDA]: (t) => `Feito: ${t.titulo}`,
  [STATUS.CANCELADA]: (t) => `Pulado hoje: ${t.titulo}`,
};

/** Muda o status com "Desfazer" na notificação. */
export function mudarStatus(id, status, { desfazer = true } = {}) {
  const tarefa = store.get().tarefas.find((t) => t.id === id);
  if (!tarefa || tarefa.status === status) return Promise.resolve(tarefa);
  const anterior = tarefa.status;
  return atualizarTarefa(id, { status }, { mensagem: null }).then((salva) => {
    if (desfazer) {
      toast(MENSAGEM_STATUS[status](tarefa), {
        tipo: 'sucesso',
        acao: { rotulo: 'Desfazer', fn: () => atualizarTarefa(id, { status: anterior }, { mensagem: null }).catch(() => {}) },
      });
    }
    return salva;
  });
}

/** Empurra o horário do item (adiar 30 min, 1 h…). */
export function adiarItem(id, minutos) {
  const t = store.get().tarefas.find((x) => x.id === id);
  if (!t) return Promise.resolve(null);
  const nova = new Date(t.dataLimite.getTime() + minutos * 60_000);
  return atualizarTarefa(id, { dataLimite: nova }, { mensagem: `${t.titulo} passou para ${nova.getHours()}:${String(nova.getMinutes()).padStart(2, '0')}` }); // taste-skill-ignore: hora
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

  toast(`Removido da pauta: ${tarefa.titulo}`, {
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

// ---------------------------------------------------------------- foco (cronômetro)

function gravarFoco(foco) {
  if (foco) gravar('foco', foco);
  else remover('foco');
  store.set({ foco });
}

/** Começa um foco: o item fica "Fazendo agora" (EmAndamento) na API enquanto o cronômetro roda. */
export async function iniciarFoco(tarefaId, minutos) {
  const t = store.get().tarefas.find((x) => x.id === tarefaId);
  if (!t) return;
  const duracaoMs = Math.max(1, minutos) * 60_000;
  gravarFoco({ tarefaId, duracaoMs, fimEm: Date.now() + duracaoMs, restanteMs: null, pausado: false });
  if (estaAberta(t) && t.status !== STATUS.EM_ANDAMENTO) await atualizarTarefa(tarefaId, { status: STATUS.EM_ANDAMENTO }, { mensagem: null }).catch(() => {});
}

export function pausarFoco() {
  const f = store.get().foco;
  if (!f || f.pausado) return;
  gravarFoco({ ...f, pausado: true, restanteMs: Math.max(0, f.fimEm - Date.now()) });
}

export function retomarFoco() {
  const f = store.get().foco;
  if (!f || !f.pausado) return;
  gravarFoco({ ...f, pausado: false, fimEm: Date.now() + f.restanteMs, restanteMs: null });
}

/** Termina o foco. concluir: marca o item como feito; senão ele volta para "A fazer". */
export async function encerrarFoco({ concluir = false } = {}) {
  const f = store.get().foco;
  if (!f) return;
  gravarFoco(null);
  const t = store.get().tarefas.find((x) => x.id === f.tarefaId);
  if (!t) return;
  if (concluir) await mudarStatus(t.id, STATUS.CONCLUIDA).catch(() => {});
  else if (t.status === STATUS.EM_ANDAMENTO) await atualizarTarefa(t.id, { status: STATUS.A_FAZER }, { mensagem: null }).catch(() => {});
}

export const restanteFoco = (f, agora = Date.now()) => (f ? (f.pausado ? f.restanteMs : Math.max(0, f.fimEm - agora)) : 0);

// ---------------------------------------------------------------- perfis e áreas

function crud(chave, nomeSingular, genero = 'a') {
  const criada = genero === 'a' ? 'criada' : 'criado';
  const salva = genero === 'a' ? 'salva' : 'salvo';
  const excluida = genero === 'a' ? 'excluída' : 'excluído';
  return {
    async criar(dados, { silencioso = false } = {}) {
      try {
        const novo = await fonte[chave].criar(dados);
        store.set((s) => ({ [chave]: [...s[chave], novo] }));
        if (!silencioso) toast(`${nomeSingular} ${criada}`, { tipo: 'sucesso' });
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

export const perfis = crud('usuarios', 'Perfil', 'o');
export const areas = crud('categorias', 'Área', 'a');

/** Devolve a área com esse nome (sem diferenciar acentos) ou cria uma nova. */
export async function garantirArea(nome, descricao = '') {
  const existente = store.get().categorias.find((c) => normalizar(c.nome) === normalizar(nome));
  if (existente) return existente;
  return areas.criar({ nome, descricao }, { silencioso: true });
}
