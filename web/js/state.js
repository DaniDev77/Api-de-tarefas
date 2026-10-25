// Estado global + ações. As telas só leem o estado e chamam ações; nunca falam direto com a API.
// Atualizações otimistas: a tela muda na hora e, se a API recusar, volta ao estado anterior.
// Hábitos: com a API nova, criar um hábito é UM pedido (POST /Habito) e a API gera a tarefa de cada
// dia quando ele chega (POST /Habito/gerar, chamado ao carregar e na virada do dia).
// Com a API antiga (sem HabitoController), o app volta ao modo anterior: cria as tarefas das próximas
// semanas em lote, com concorrência limitada e o progresso numa notificação.
import { criarStore } from './core/store.js';
import { ler, gravar, remover } from './core/storage.js';
import { normalizar, diaMes, plural, inicioDoDia, somarDias, diferencaDias } from './core/format.js';
import { criarFonteApi } from './data/api.js';
import { criarFonteDemo, restaurarDemonstracao } from './data/demo.js';
import { API_PADRAO, TEMPO_DESFAZER_MS, SEMANAS_PADRAO } from './config.js';
import { STATUS, estaAberta } from './domain/enums.js';
import { datasDaSerie, datasParaEstender, proximosAbertos, minutosDeTexto, chaveDia, fimSugerido, intervaloEntre, indiceRotina } from './domain/rotina.js';
import { espalharHorarios } from './domain/frase.js';
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
  habitos: [],
  suportaHabitos: false, // a API tem o HabitoController?
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

// histórico carregado: o Progresso usa até 17 semanas + a janela de comparação
const DIAS_HISTORICO = 200;
// a API gera os dias que faltarem nesse intervalo (dias sem abrir o app ficam como "não marcado")
const DIAS_PARA_TRAS = 13;
let diaGerado = null; // "perfil|2026-10-25": o último dia já pedido à API

/** Junta tarefas novas às atuais (as novas ganham). */
function mesclar(atuais, novas) {
  if (!novas.length) return atuais;
  const porId = new Map(atuais.map((t) => [t.id, t]));
  novas.forEach((t) => porId.set(t.id, t));
  return [...porId.values()];
}

/** Pede à API as tarefas dos hábitos de hoje (e dos dias recentes que faltarem). */
async function gerarPauta(perfilId, { de } = {}) {
  const hoje = inicioDoDia(new Date());
  const tarefas = await fonte.habitos.gerar(perfilId, de ?? somarDias(hoje, -DIAS_PARA_TRAS), hoje);
  diaGerado = `${perfilId}|${chaveDia(hoje)}`;
  return tarefas.filter((t) => !exclusoesPendentes.has(t.id));
}

/**
 * Busca perfis, áreas, tarefas e hábitos em paralelo; depois a API gera a pauta de hoje.
 * Se a tela já tem dados, mantém o que está visível (sem "piscar" esqueleto) e só avisa em caso de erro.
 */
export async function carregarTudo() {
  const id = ++cargaAtual;
  const jaPronto = store.get().fase === 'pronto';
  store.set(jaPronto ? { sincronizando: true } : { fase: 'carregando', erro: null, sincronizando: true });
  try {
    const de = somarDias(inicioDoDia(new Date()), -DIAS_HISTORICO);
    const [usuarios, categorias, tarefas, habitos] = await Promise.all([
      fonte.usuarios.listar(),
      fonte.categorias.listar(),
      fonte.tarefas.listar({ de }),
      fonte.habitos ? fonte.habitos.listar() : null,
    ]);
    if (id !== cargaAtual) return; // uma carga mais nova já está em andamento
    const suportaHabitos = habitos !== null;
    // tarefas com exclusão pendente (aguardando "Desfazer") continuam escondidas
    let visiveis = tarefas.filter((t) => !exclusoesPendentes.has(t.id));
    const atual = store.get();
    const perfilId = usuarios.some((u) => u.id === atual.perfilId) ? atual.perfilId : usuarios.length === 1 ? usuarios[0].id : null;
    if (suportaHabitos && perfilId) {
      try {
        visiveis = mesclar(visiveis, await gerarPauta(perfilId));
      } catch (e) {
        toast(`Não foi possível montar a pauta de hoje. ${e?.message ?? ''}`.trim(), { tipo: 'erro' });
      }
      if (id !== cargaAtual) return;
    }
    store.set({ fase: 'pronto', erro: null, usuarios, categorias, tarefas: visiveis, habitos: habitos ?? [], suportaHabitos, sincronizadoEm: new Date(), sincronizando: false });
    const s = store.get();
    if (!s.usuarios.some((u) => u.id === s.perfilId) && s.usuarios.length === 1) definirPerfil(s.usuarios[0].id);
  } catch (erro) {
    if (id !== cargaAtual) return;
    if (jaPronto) {
      store.set({ sincronizando: false });
      // uma sincronização em segundo plano que falha não mostra mensagem crua do navegador
      toast(erro?.name === 'ApiError' ? erro.message : 'Não foi possível sincronizar com a API agora. Os dados na tela continuam valendo.', { tipo: 'erro' });
      return;
    }
    store.set({ fase: 'erro', erro, sincronizando: false });
  }
}

/** Virou o dia com o app aberto (ou trocou o perfil): pede à API a pauta do dia. */
export async function garantirPautaDeHoje() {
  const s = store.get();
  const perfil = perfilAtual(s);
  if (!s.suportaHabitos || !perfil || s.fase !== 'pronto') return;
  if (diaGerado === `${perfil.id}|${chaveDia(new Date())}`) return;
  try {
    const novas = await gerarPauta(perfil.id);
    store.set((st) => ({ tarefas: mesclar(st.tarefas, novas) }));
  } catch {
    /* tenta de novo no próximo minuto */
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
  garantirPautaDeHoje();
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
 * Cria um hábito.
 * Com a API nova: um POST /Habito e, se ele já vale hoje, a API gera o item de hoje.
 * Com a API antiga: as tarefas das próximas semanas, uma por dia (o modo de antes).
 * @param {{ titulo: string, descricao?: string, categoriaId: number, dias: number[],
 *   horaInicio?: string|null, horaFim?: string|null, lembrarACadaMinutos?: number|null,
 *   dataInicio?: Date, dataFim?: Date|null }} h  sem horaInicio = lembrete (sem horário)
 */
export async function criarHabito(h, { mensagem } = {}) {
  const perfil = exigirPerfil();
  const dados = { descricao: '', horaInicio: null, horaFim: null, lembrarACadaMinutos: null, dataFim: null, ...h, dataInicio: inicioDoDia(h.dataInicio ?? new Date()) };
  gravar('ultimaArea', dados.categoriaId);
  if (!store.get().suportaHabitos) return criarHabitoEmTarefas(dados, perfil);
  try {
    const novo = await fonte.habitos.criar({ ...dados, ativo: true, usuarioId: perfil.id });
    store.set((s) => ({ habitos: [...s.habitos, novo] }));
    if (diferencaDias(novo.dataInicio, new Date()) <= 0) {
      const hoje = inicioDoDia(new Date());
      const geradas = await fonte.habitos.gerar(perfil.id, hoje, hoje).catch(() => []);
      store.set((s) => ({ tarefas: mesclar(s.tarefas, geradas) }));
    }
    if (mensagem !== null) {
      const quando = diferencaDias(novo.dataInicio, new Date()) > 0 ? ` a partir de ${diaMes(novo.dataInicio)}` : '';
      toast(mensagem ?? `${novo.titulo} entrou na rotina${quando}`, { tipo: 'sucesso' });
    }
    return novo;
  } catch (e) {
    return falhou(e, 'criar o hábito');
  }
}

/** Modo antigo (API sem hábitos): uma tarefa por dia e horário, pelas semanas do prazo. */
async function criarHabitoEmTarefas({ titulo, descricao, categoriaId, dias, horaInicio, lembrarACadaMinutos, dataInicio, dataFim }, perfil) {
  // um lembrete vira itens espalhados pelo dia (4 se pediu aviso, senão um às 9h)
  const horarios = horaInicio ? [horaInicio] : lembrarACadaMinutos ? espalharHorarios(4) : ['09:00'];
  const semanas = dataFim ? Math.max(1, Math.ceil((diferencaDias(dataFim, dataInicio) + 1) / 7)) : SEMANAS_PADRAO;
  const inicio = dataInicio < new Date() ? new Date() : dataInicio;
  const datas = datasDaSerie({ dias, horarios, inicio, semanas }).filter((d) => !dataFim || d < somarDias(dataFim, 1));
  if (!datas.length) {
    toast('Nenhum dia e horário cai nesse período. Confira os dias da semana e os horários.', { tipo: 'erro' });
    return null;
  }
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
    barra.terminar(datas.length === 1 ? `${titulo} adicionado à pauta` : `${titulo}: ${plural(datas.length, 'item', 'itens')} na pauta até ${diaMes(datas.at(-1))}`);
  }
  return null;
}

/** Salva mudanças num hábito da API. A API refaz os próximos itens em aberto; o resto vem na sincronização. */
async function salvarHabito(serie, mudancas, mensagem) {
  const h = serie.habito;
  try {
    const salvo = await fonte.habitos.atualizar(h.id, { ...h, ...mudancas });
    store.set((s) => ({ habitos: s.habitos.map((x) => (x.id === salvo.id ? salvo : x)) }));
    diaGerado = null;
    await carregarTudo();
    if (mensagem) toast(typeof mensagem === 'function' ? mensagem(salvo) : mensagem, { tipo: 'sucesso' });
    return salvo;
  } catch (e) {
    return falhou(e, 'salvar o hábito');
  }
}

/**
 * Um hábito do modo antigo (só tarefas) vira um hábito da API, com o mesmo nome e área:
 * o histórico continua junto. Os próximos itens antigos em aberto saem; o hábito novo
 * começa no dia seguinte ao último item antigo (ou hoje, se não houver item hoje).
 */
async function converterSerie(serie, dados = {}, { semanas = null } = {}) {
  const hoje = inicioDoDia(new Date());
  const abertos = proximosAbertos(serie);
  if (abertos.length) await apagarItens(abertos);
  const restante = indiceDoPerfil()?.series.get(serie.chave);
  const temHoje = restante?.dias.has(chaveDia(hoje));
  const ultimo = restante?.ultimo ? somarDias(inicioDoDia(restante.ultimo), 1) : hoje;
  let dataInicio = ultimo > hoje ? ultimo : temHoje ? somarDias(hoje, 1) : hoje;
  const varios = serie.padrao.horarios.length > 1;
  const horaInicio = varios ? null : serie.padrao.horarios[0] ?? null;
  const base = {
    titulo: serie.titulo,
    descricao: serie.itens.at(-1)?.descricao ?? '',
    categoriaId: serie.categoriaId,
    dias: serie.padrao.dias,
    horaInicio,
    horaFim: horaInicio ? fimSugerido(horaInicio, serie.titulo) : null,
    lembrarACadaMinutos: varios ? intervaloEntre(serie.padrao.horarios) : null,
    dataFim: null,
  };
  const final = { ...base, ...dados };
  if (final.dataFim && final.dataFim < dataInicio) final.dataFim = dataInicio;
  if (dados.dataInicio && dados.dataInicio > dataInicio) dataInicio = dados.dataInicio;
  if (semanas) final.dataFim = somarDias(dataInicio, semanas * 7 - 1);
  return criarHabito({ ...final, dataInicio }, { mensagem: `${serie.titulo} agora é um hábito${final.dataFim ? ` até ${diaMes(final.dataFim)}` : ' sem prazo'}. O histórico continua junto.` });
}

function indiceDoPerfil() {
  const s = store.get();
  const p = perfilAtual(s);
  return p ? indiceRotina(s.tarefas, p.id, s.habitos) : null;
}

async function apagarItens(alvos) {
  const { resultados } = await emLote(alvos, (t) => fonte.tarefas.excluir(t.id).then(() => t.id));
  const apagados = new Set(resultados);
  store.set((s) => ({ tarefas: s.tarefas.filter((t) => !apagados.has(t.id)) }));
}

/** Mais N semanas de um hábito (ou "Retomar", se estava encerrado). */
export async function estenderHabito(serie, semanas = SEMANAS_PADRAO) {
  if (serie.habito) {
    const h = serie.habito;
    const hoje = inicioDoDia(new Date());
    const encerrado = !h.ativo || (h.dataFim && h.dataFim < hoje);
    if (encerrado) {
      // volta a partir de hoje (sem cobrar os dias em que esteve parado), sem prazo
      return salvarHabito(serie, { ativo: true, dataInicio: hoje, dataFim: null }, `${h.titulo} voltou para a rotina, sem prazo`);
    }
    const base = h.dataFim && h.dataFim > hoje ? h.dataFim : hoje;
    return salvarHabito(serie, { dataFim: somarDias(base, semanas * 7) }, (salvo) => `${salvo.titulo} segue até ${diaMes(salvo.dataFim)}`);
  }
  if (store.get().suportaHabitos) return converterSerie(serie, {}, { semanas });
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

/** Tira o prazo de um hábito da API: ele segue até ser encerrado. */
export function tirarPrazo(serie) {
  return salvarHabito(serie, { dataFim: null }, `${serie.titulo} agora não tem prazo`);
}

/**
 * Salva o formulário de um hábito que já existe.
 * Hábito da API: um PUT; a API ajusta os próximos itens em aberto.
 * Hábito do modo antigo com a API nova: vira um hábito da API (converterSerie).
 * Modo antigo puro: refaz os próximos itens (como antes).
 */
export async function editarHabito(serie, dados) {
  if (serie.habito) return salvarHabito(serie, dados, `${dados.titulo ?? serie.titulo} salvo. Os próximos itens seguem a regra nova.`);
  if (store.get().suportaHabitos) return converterSerie(serie, dados);
  const horarios = dados.horaInicio ? [dados.horaInicio] : serie.padrao.horarios;
  const mudouPadrao = dados.dias.join() !== serie.padrao.dias.join() || horarios.join() !== serie.padrao.horarios.join();
  if (!mudouPadrao) return editarProximos(serie, { titulo: dados.titulo, categoriaId: dados.categoriaId, descricao: dados.descricao });
  // refaz os próximos itens no novo padrão, até a mesma data em que o hábito acabaria
  const semanas = Math.max(1, Math.ceil((Math.max(0, diferencaDias(serie.ultimo, new Date())) + 1) / 7));
  await encerrarHabito(serie).catch(() => {});
  return criarHabito({ ...dados, dataInicio: new Date(), dataFim: somarDias(inicioDoDia(new Date()), semanas * 7 - 1) });
}

/**
 * Muda os próximos itens em aberto de um hábito do modo antigo (os já feitos ficam como estão, para o histórico).
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

/** Encerra um hábito: os itens que ainda não começaram saem e o histórico fica. */
export async function encerrarHabito(serie) {
  if (serie.habito) {
    const h = serie.habito;
    const hoje = inicioDoDia(new Date());
    return salvarHabito(serie, { ativo: false, dataFim: h.dataInicio > hoje ? h.dataInicio : hoje }, `${h.titulo} encerrado. O histórico continua no Progresso.`);
  }
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
  // mudou o início de um item com fim: o fim anda junto (a duração fica igual)
  if (dados.dataLimite && anterior.fim && !('fim' in dados)) otimista.fim = new Date(anterior.fim.getTime() + (dados.dataLimite - anterior.dataLimite));
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
        // o banco apaga as tarefas e os hábitos ligados (ON DELETE CASCADE); refletimos isso na tela
        store.set((s) => ({ [chave]: s[chave].filter((x) => x.id !== id), tarefas: s.tarefas.filter((t) => t[campo] !== id), habitos: s.habitos.filter((h) => h[campo] !== id) }));
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
