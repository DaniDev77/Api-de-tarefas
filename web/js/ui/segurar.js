// "Segure para marcar": o anel enche enquanto o dedo (ou o mouse) fica no botão e, cheio, marca o item.
// Por quê: na rotina a pessoa marca muitos itens por dia, muitas vezes rolando a tela no celular;
// um toque sem querer marcaria o item errado. Segurar meio segundo é rápido e não acontece por acaso.
// No teclado, Enter ou Espaço marcam na hora (apertar uma tecla já é intencional).
import { movimentoReduzido } from '../core/animar.js';

const DURACAO_MS = 480;
let dicaMostrada = 0;

function mostrarDica(botao) {
  // depois de três toques curtos a pessoa já entendeu; não insiste
  if (dicaMostrada >= 3) return;
  dicaMostrada++;
  const bolha = document.createElement('span');
  bolha.className = 'segure-dica';
  bolha.textContent = 'Segure para marcar';
  bolha.setAttribute('role', 'status');
  document.body.append(bolha);
  const r = botao.getBoundingClientRect();
  const b = bolha.getBoundingClientRect();
  bolha.style.left = `${Math.min(innerWidth - b.width - 8, Math.max(8, r.left + r.width / 2 - b.width / 2))}px`;
  bolha.style.top = `${r.top - b.height - 8}px`;
  setTimeout(() => bolha.remove(), 1400);
}

/**
 * Liga o gesto num contêiner (delegação): vale para todo botão [data-marcar] dentro dele.
 * @param {HTMLElement} raiz
 * @param {(id: number, botao: HTMLElement) => void} aoMarcar
 */
export function ligarSegurar(raiz, aoMarcar) {
  let atual = null; // { botao, timer, inicio, id }

  const cancelar = (mostrar = false) => {
    if (!atual) return;
    clearTimeout(atual.timer);
    atual.botao.classList.remove('segurando');
    if (mostrar && Date.now() - atual.inicio < 220) mostrarDica(atual.botao);
    atual = null;
  };

  const disparar = () => {
    const { botao, id } = atual;
    atual = null;
    botao.classList.remove('segurando');
    botao.classList.add('marcou');
    setTimeout(() => botao.classList.remove('marcou'), 520);
    navigator.vibrate?.(12);
    aoMarcar(id, botao);
  };

  raiz.addEventListener('pointerdown', (e) => {
    const botao = e.target.closest('[data-marcar]');
    if (!botao || e.button !== 0 || botao.disabled) return;
    e.preventDefault(); // sem seleção de texto nem menu de toque longo
    cancelar();
    atual = { botao, id: Number(botao.dataset.marcar), inicio: Date.now(), timer: 0 };
    botao.classList.add('segurando');
    atual.timer = setTimeout(disparar, movimentoReduzido() ? 300 : DURACAO_MS);
  });
  // soltar antes da hora, sair do botão ou a página rolar: cancela
  const aoSoltar = () => cancelar(true);
  const aoCancelar = () => cancelar();
  window.addEventListener('pointerup', aoSoltar);
  window.addEventListener('pointercancel', aoCancelar);
  // saiu de cima do botão (o alvo pode ser o desenho dentro dele)
  raiz.addEventListener('pointerout', (e) => {
    if (atual && atual.botao.contains(e.target) && !atual.botao.contains(e.relatedTarget)) cancelar();
  });
  raiz.addEventListener('contextmenu', (e) => {
    if (e.target.closest('[data-marcar]')) e.preventDefault();
  });

  // teclado (click com detail 0): marca na hora
  raiz.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-marcar]');
    if (!botao || e.detail !== 0) return;
    botao.classList.add('marcou');
    setTimeout(() => botao.classList.remove('marcou'), 520);
    aoMarcar(Number(botao.dataset.marcar), botao);
  });

  return () => {
    cancelar();
    window.removeEventListener('pointerup', aoSoltar);
    window.removeEventListener('pointercancel', aoCancelar);
  };
}
