// Fundo vivo: cria a camada de manchas atrás do app e liga o que a faz reagir.
// O desenho e o movimento estão em css/fundo.css; aqui ficam só os gatilhos:
// - o período do dia escolhe as cores (manhã, tarde, noite);
// - o ponteiro desloca a camada bem de leve;
// - progressoDoDia(0..1) dá mais cor conforme o dia é cumprido;
// - pulsarFundo(elemento) solta uma onda na cor da área a partir do botão marcado;
// - festejarFundo() sobe as cores por alguns segundos (dia completo).
import { periodoDe } from '../domain/rotina.js';

let fundo = null;
let camada = null;

const calmo = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const modo = () => document.documentElement.dataset.fundo || 'vivo';

function atualizarPeriodo() {
  if (fundo) fundo.dataset.periodo = periodoDe(new Date()).id;
}

export function iniciarFundo() {
  if (fundo) return;
  fundo = document.createElement('div');
  fundo.className = 'fundo';
  fundo.setAttribute('aria-hidden', 'true');
  fundo.innerHTML = `<div class="fundo__camada">
    <span class="fundo__mancha fundo__mancha--1"></span>
    <span class="fundo__mancha fundo__mancha--2"></span>
    <span class="fundo__mancha fundo__mancha--3"></span>
    <span class="fundo__mancha fundo__mancha--4"></span>
  </div>`;
  camada = fundo.firstElementChild;
  document.body.prepend(fundo);

  atualizarPeriodo();
  setInterval(atualizarPeriodo, 5 * 60_000);

  // profundidade: a camada segue o ponteiro (só com mouse; um quadro por vez)
  if (window.matchMedia('(pointer: fine)').matches) {
    let pedido = 0;
    let x = 0;
    let y = 0;
    window.addEventListener(
      'pointermove',
      (e) => {
        x = (e.clientX / window.innerWidth) * 2 - 1;
        y = (e.clientY / window.innerHeight) * 2 - 1;
        if (pedido || modo() !== 'vivo' || calmo()) return;
        pedido = requestAnimationFrame(() => {
          pedido = 0;
          fundo.style.setProperty('--px', (-x).toFixed(3));
          fundo.style.setProperty('--py', (-y).toFixed(3));
        });
      },
      { passive: true }
    );
  }
}

/** Quanto do dia já foi cumprido (0 a 1): o fundo ganha cor junto. */
export function progressoDoDia(fracao) {
  fundo?.style.setProperty('--dia', String(Math.max(0, Math.min(1, fracao || 0))));
}

/**
 * Uma onda que nasce no elemento (o botão marcado) e atravessa o fundo, na cor da área do item.
 * @param {Element} [origem] sem origem, nasce no centro da tela
 */
export function pulsarFundo(origem) {
  if (!fundo || modo() !== 'vivo' || calmo()) return;
  const r = origem?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
  const y = r ? r.top + r.height / 2 : window.innerHeight / 2;
  const cor = origem ? getComputedStyle(origem).getPropertyValue('--t').trim() : '';
  const onda = document.createElement('span');
  onda.className = 'fundo__onda';
  onda.style.left = `${x}px`;
  onda.style.top = `${y}px`;
  if (cor) onda.style.setProperty('--c', cor);
  fundo.append(onda);
  onda.addEventListener('animationend', () => onda.remove(), { once: true });
  setTimeout(() => onda.remove(), 2200);
}

let fimDaFesta = 0;
/** Dia completo: as cores sobem e três ondas saem do centro. */
export function festejarFundo() {
  if (!fundo || modo() === 'desligado') return;
  fundo.classList.add('fundo--festa');
  clearTimeout(fimDaFesta);
  fimDaFesta = setTimeout(() => fundo.classList.remove('fundo--festa'), 3200);
  [0, 260, 520].forEach((atraso) => setTimeout(() => pulsarFundo(), atraso));
}
