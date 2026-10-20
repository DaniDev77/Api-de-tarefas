// Dica flutuante única para qualquer elemento com data-dica="texto" (mouse e foco do teclado).
// A dica só complementa: a informação também está visível na tela ou na Lista.

let dica;
let alvoAtual = null;

function posicionar(alvo) {
  const r = alvo.getBoundingClientRect();
  const d = dica.getBoundingClientRect();
  let top = r.top - d.height - 8;
  if (top < 8) top = r.bottom + 8;
  let left = r.left + r.width / 2 - d.width / 2;
  left = Math.min(Math.max(8, left), innerWidth - d.width - 8);
  dica.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

function mostrar(alvo) {
  const texto = alvo.getAttribute('data-dica');
  if (!texto) return;
  alvoAtual = alvo;
  dica.textContent = texto;
  dica.hidden = false;
  posicionar(alvo);
}

function esconder() {
  alvoAtual = null;
  if (dica) dica.hidden = true;
}

export function iniciarDicas() {
  dica = document.createElement('div');
  dica.className = 'dica';
  dica.setAttribute('role', 'tooltip');
  dica.hidden = true;
  document.body.append(dica);

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const alvo = e.target.closest?.('[data-dica]');
    if (alvo && alvo !== alvoAtual) mostrar(alvo);
    else if (!alvo && alvoAtual) esconder();
  });
  document.addEventListener('focusin', (e) => {
    const alvo = e.target.closest?.('[data-dica]');
    if (alvo && alvo.matches(':focus-visible')) mostrar(alvo);
  });
  document.addEventListener('focusout', esconder);
  document.addEventListener('pointerdown', esconder);
  window.addEventListener('scroll', esconder, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') esconder();
  });
}
