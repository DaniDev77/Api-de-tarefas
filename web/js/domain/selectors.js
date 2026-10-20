// Dados derivados do estado (contagens, filtros, ordenação). Funções puras: fáceis de testar.
import { STATUS, estaAberta } from './enums.js';
import { normalizar, inicioDoDia, diferencaDias } from '../core/format.js';

export const porId = (lista) => new Map(lista.map((x) => [x.id, x]));

export function estaAtrasada(tarefa, agora = new Date()) {
  return estaAberta(tarefa) && tarefa.dataLimite && tarefa.dataLimite < agora;
}

export function venceHoje(tarefa, agora = new Date()) {
  return estaAberta(tarefa) && tarefa.dataLimite && diferencaDias(tarefa.dataLimite, agora) === 0 && tarefa.dataLimite >= agora;
}

/** Filtros compartilhados por Quadro e Lista (vêm da URL). */
export function filtrarTarefas(tarefas, filtros, { usuarios, categorias } = {}) {
  const termo = normalizar(filtros.q);
  const usuariosMap = usuarios ? porId(usuarios) : null;
  const categoriasMap = categorias ? porId(categorias) : null;
  const agora = new Date();
  return tarefas.filter((t) => {
    if (filtros.pessoa && t.usuarioId !== Number(filtros.pessoa)) return false;
    if (filtros.categoria && t.categoriaId !== Number(filtros.categoria)) return false;
    if (filtros.prioridade && t.prioridade !== Number(filtros.prioridade)) return false;
    if (filtros.status && t.status !== Number(filtros.status)) return false;
    if (filtros.atrasadas && !estaAtrasada(t, agora)) return false;
    if (termo) {
      const alvo = normalizar(
        [t.titulo, t.descricao, usuariosMap?.get(t.usuarioId)?.nome, categoriasMap?.get(t.categoriaId)?.nome].join(' ')
      );
      if (!termo.split(/\s+/).every((p) => alvo.includes(p))) return false;
    }
    return true;
  });
}

/** Ordem natural dentro de uma coluna: atrasadas e urgentes primeiro, depois o prazo mais próximo. */
export function ordenarPorUrgencia(a, b) {
  const agora = new Date();
  const atrasoA = estaAtrasada(a, agora) ? 1 : 0;
  const atrasoB = estaAtrasada(b, agora) ? 1 : 0;
  if (atrasoA !== atrasoB) return atrasoB - atrasoA;
  if (a.prioridade !== b.prioridade) return b.prioridade - a.prioridade;
  return (a.dataLimite?.getTime() ?? Infinity) - (b.dataLimite?.getTime() ?? Infinity);
}

export function contarPorStatus(tarefas) {
  const c = { 1: 0, 2: 0, 3: 0, 4: 0 };
  tarefas.forEach((t) => {
    c[t.status] = (c[t.status] || 0) + 1;
  });
  return c;
}

export function resumo(tarefas, agora = new Date()) {
  const porStatus = contarPorStatus(tarefas);
  const validas = tarefas.length - porStatus[STATUS.CANCELADA];
  return {
    total: tarefas.length,
    abertas: porStatus[1] + porStatus[2],
    aFazer: porStatus[1],
    emAndamento: porStatus[2],
    concluidas: porStatus[3],
    canceladas: porStatus[4],
    atrasadas: tarefas.filter((t) => estaAtrasada(t, agora)).length,
    hoje: tarefas.filter((t) => venceHoje(t, agora)).length,
    amanha: tarefas.filter((t) => estaAberta(t) && t.dataLimite && diferencaDias(t.dataLimite, agora) === 1).length,
    // abertas que vencem de agora até daqui a 7 dias (inclui hoje)
    semana: tarefas.filter((t) => estaAberta(t) && t.dataLimite && t.dataLimite >= agora && diferencaDias(t.dataLimite, agora) < 7).length,
    taxaConclusao: validas ? Math.round((porStatus[3] / validas) * 100) : 0,
  };
}

/** Estatísticas por pessoa ou categoria. */
export function estatisticasPor(chave, id, tarefas, agora = new Date()) {
  const lista = tarefas.filter((t) => t[chave] === id);
  return { ...resumo(lista, agora), tarefas: lista };
}

/** Agenda para a régua: tarefas abertas agrupadas por dia (0..dias-1) + atrasadas. */
export function agendaDosProximosDias(tarefas, dias = 14, agora = new Date()) {
  const hoje = inicioDoDia(agora);
  const colunas = Array.from({ length: dias }, (_, i) => ({
    data: new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i),
    tarefas: [],
  }));
  const atrasadas = [];
  let depois = 0;
  tarefas.filter(estaAberta).forEach((t) => {
    if (!t.dataLimite) return;
    if (t.dataLimite < agora) {
      atrasadas.push(t);
      return;
    }
    const i = diferencaDias(t.dataLimite, hoje);
    if (i >= 0 && i < dias) colunas[i].tarefas.push(t);
    else if (i >= dias) depois += 1;
  });
  colunas.forEach((c) => c.tarefas.sort(ordenarPorUrgencia));
  atrasadas.sort(ordenarPorUrgencia);
  return { atrasadas, colunas, depois };
}
