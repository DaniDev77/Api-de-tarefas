// Animações de layout (técnica FLIP: First, Last, Invert, Play).
// Mede onde cada item estava, deixa o DOM mudar e anima do lugar antigo até o novo.
// Mostra para onde a coisa foi, em vez de ela "teleportar". Respeita "reduzir movimento".

const CURVA = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

export const movimentoReduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Guarda a posição atual de cada item (chave: data-id) e o seletorGrupo onde ele estava. */
export function medir(raiz, seletor, seletorGrupo = null) {
  const mapa = new Map();
  raiz.querySelectorAll(seletor).forEach((el) => {
    mapa.set(el.dataset.id, { rect: el.getBoundingClientRect(), grupo: seletorGrupo ? el.closest(seletorGrupo) : null });
  });
  return mapa;
}

/**
 * Anima os itens que mudaram de lugar.
 * - Mesmo seletorGrupo: desliza o próprio elemento (transform).
 * - Outro seletorGrupo (ex.: outra coluna com rolagem própria): um clone voa por cima de tudo,
 *   porque o elemento real seria cortado pelo overflow da coluna no caminho.
 */
export function animarMudancas(raiz, seletor, antes, { seletorGrupo = null, duracao = 300 } = {}) {
  if (movimentoReduzido() || !antes.size) return;
  raiz.querySelectorAll(seletor).forEach((el) => {
    const a = antes.get(el.dataset.id);
    if (!a) return;
    const b = el.getBoundingClientRect();
    const dx = a.rect.left - b.left;
    const dy = a.rect.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    const trocouDeGrupo = seletorGrupo && a.grupo && el.closest(seletorGrupo) !== a.grupo;
    if (!trocouDeGrupo) {
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: duracao, easing: CURVA });
      return;
    }
    const clone = el.cloneNode(true);
    clone.removeAttribute('id');
    clone.setAttribute('aria-hidden', 'true');
    clone.classList.add('voando');
    Object.assign(clone.style, {
      position: 'fixed',
      left: `${b.left}px`,
      top: `${b.top}px`,
      width: `${b.width}px`,
      height: `${b.height}px`,
      margin: '0',
      zIndex: '90',
      pointerEvents: 'none',
    });
    document.body.append(clone);
    // o original fica invisível durante o voo, mas continua focável (opacity, não visibility);
    // e como é uma animação, um redesenho no meio do caminho não a desfaz
    el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: duracao + 80 });
    const anim = clone.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) rotate(1.5deg)` },
        { transform: 'none' },
      ],
      { duration: duracao + 80, easing: CURVA }
    );
    const fim = () => clone.remove();
    anim.onfinish = fim;
    anim.oncancel = fim;
  });
}
