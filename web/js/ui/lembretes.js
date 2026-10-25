// Avisos dos hábitos sem horário ("Beber água, a cada 2 h"), enquanto o app está aberto.
// Das 8h às 22h, a cada intervalo, se o item de hoje ainda não foi marcado: uma notificação
// dentro do app (com "Fiz") e, se a aba estiver em segundo plano e houver permissão, uma do sistema.
// O navegador não avisa com o app fechado; para isso seria preciso um servidor de push.
// O mesmo relógio de 1 minuto pede à API a pauta do dia quando o dia vira com o app aberto.
import { store, perfilAtual, mudarStatus, garantirPautaDeHoje } from '../state.js';
import { STATUS } from '../domain/enums.js';
import { chaveDia } from '../domain/rotina.js';
import { toast } from './toast.js';

const DAS = 8 * 60;
const ATE = 22 * 60;
const ultimoAviso = new Map(); // "habito|dia" -> número do intervalo já avisado

/** Pede permissão para notificações do sistema (só quando a pessoa escolhe um aviso). */
export function pedirPermissaoAvisos() {
  try {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  } catch {
    /* navegador sem suporte */
  }
}

function avisar(h, tarefa) {
  toast(`Lembrete: ${h.titulo}`, {
    duracao: 12000,
    acao: { rotulo: 'Fiz', fn: () => mudarStatus(tarefa.id, STATUS.CONCLUIDA).catch(() => {}) },
  });
  try {
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(h.titulo, { body: 'Lembrete da sua rotina.', icon: 'assets/icone-192.png', tag: `pauta-lembrete-${h.id}` });
    }
  } catch {
    /* sem notificação do sistema: a do app basta */
  }
}

function verificar(primeira = false) {
  garantirPautaDeHoje();
  const s = store.get();
  const perfil = perfilAtual(s);
  if (s.fase !== 'pronto' || !perfil || !s.suportaHabitos) return;
  const agora = new Date();
  const minuto = agora.getHours() * 60 + agora.getMinutes();
  if (minuto < DAS || minuto > ATE) return;
  const hoje = chaveDia(agora);
  for (const h of s.habitos) {
    if (h.usuarioId !== perfil.id || !h.ativo || h.horaInicio || !h.lembrarACadaMinutos) continue;
    const tarefa = s.tarefas.find((t) => t.habitoId === h.id && chaveDia(t.dataLimite) === hoje);
    if (!tarefa || tarefa.status !== STATUS.A_FAZER) continue;
    const chave = `${h.id}|${hoje}`;
    const intervalo = Math.floor((minuto - DAS) / h.lembrarACadaMinutos);
    // ao abrir o app não avisa na hora: começa a contar do intervalo atual
    if (primeira || !ultimoAviso.has(chave)) {
      ultimoAviso.set(chave, intervalo);
      continue;
    }
    if (intervalo > ultimoAviso.get(chave)) {
      ultimoAviso.set(chave, intervalo);
      avisar(h, tarefa);
    }
  }
}

export function iniciarLembretes() {
  verificar(true);
  const timer = setInterval(() => verificar(), 60_000);
  return () => clearInterval(timer);
}
