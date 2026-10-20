// Arrastar e soltar com Pointer Events: o mesmo código serve para mouse, caneta e toque.
// No toque, o arraste começa com um toque longo, para não atrapalhar a rolagem da página.

const LIMIAR_MOUSE = 5;
const TOQUE_LONGO_MS = 280;

/**
 * @param {HTMLElement} raiz contêiner com os cartões (.cartao[data-id]) e as áreas de soltar ([data-soltar])
 * @param {{ aoSoltar: (id: number, destino: string) => void, rolavel?: HTMLElement }} opcoes
 */
export function ativarArrastar(raiz, { aoSoltar, rolavel }) {
  let s = null; // sessão de arraste

  const alvoSob = (x, y) => document.elementFromPoint(x, y)?.closest('[data-soltar]');

  function iniciar() {
    const r = s.cartao.getBoundingClientRect();
    const fantasma = s.cartao.cloneNode(true);
    fantasma.classList.add('cartao--fantasma');
    fantasma.removeAttribute('id');
    fantasma.setAttribute('aria-hidden', 'true');
    fantasma.style.width = `${r.width}px`;
    document.body.append(fantasma);
    s.fantasma = fantasma;
    s.dx = s.x0 - r.left;
    s.dy = s.y0 - r.top;
    s.ativo = true;
    s.cartao.classList.add('cartao--origem');
    document.documentElement.classList.add('arrastando');
    navigator.vibrate?.(8);
    posicionar(s.x, s.y);
  }

  function posicionar(x, y) {
    s.fantasma.style.transform = `translate(${x - s.dx}px, ${y - s.dy}px) rotate(1.5deg)`;
    const alvo = alvoSob(x, y);
    if (alvo !== s.alvo) {
      s.alvo?.classList.remove('soltar--ativo');
      alvo?.classList.add('soltar--ativo');
      s.alvo = alvo;
    }
    // rolagem automática do quadro perto das bordas
    if (rolavel) {
      const b = rolavel.getBoundingClientRect();
      const margem = 60;
      cancelAnimationFrame(s.raf);
      const passo = x < b.left + margem ? -14 : x > b.right - margem ? 14 : 0;
      if (passo) {
        const rolar = () => {
          rolavel.scrollLeft += passo;
          s.raf = requestAnimationFrame(rolar);
        };
        s.raf = requestAnimationFrame(rolar);
      }
    }
  }

  function limpar() {
    if (!s) return;
    clearTimeout(s.timer);
    cancelAnimationFrame(s.raf);
    s.fantasma?.remove();
    s.alvo?.classList.remove('soltar--ativo');
    s.cartao.classList.remove('cartao--origem', 'cartao--segurando');
    document.documentElement.classList.remove('arrastando');
    document.removeEventListener('pointermove', mover);
    document.removeEventListener('pointerup', soltar);
    document.removeEventListener('pointercancel', cancelar);
    document.removeEventListener('touchmove', bloquearRolagem);
    s = null;
  }

  function mover(e) {
    if (!s || e.pointerId !== s.pointerId) return;
    s.x = e.clientX;
    s.y = e.clientY;
    const distancia = Math.hypot(e.clientX - s.x0, e.clientY - s.y0);
    if (!s.ativo) {
      if (s.tipo === 'touch') {
        if (distancia > 10) limpar(); // a pessoa está rolando, não arrastando
        return;
      }
      if (distancia < LIMIAR_MOUSE) return;
      iniciar();
    }
    e.preventDefault();
    posicionar(e.clientX, e.clientY);
  }

  function soltar(e) {
    if (!s || e.pointerId !== s.pointerId) return;
    if (!s.ativo) return limpar();
    const { id, alvo, cartao } = s;
    const origem = cartao.closest('[data-soltar]')?.dataset.soltar;
    const rectSolto = s.fantasma?.getBoundingClientRect() ?? null;
    // impede o "clique" que o navegador dispara logo após soltar (abriria o modal)
    const engolirClique = (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    window.addEventListener('click', engolirClique, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', engolirClique, { capture: true }), 50);
    limpar();
    if (alvo && alvo.dataset.soltar !== origem) aoSoltar(id, alvo.dataset.soltar, rectSolto);
  }

  function cancelar() {
    limpar();
  }

  function bloquearRolagem(e) {
    if (s?.ativo) e.preventDefault();
  }

  function aoPressionar(e) {
    if (e.button !== 0 || s) return;
    const cartao = e.target.closest('.cartao[data-id]');
    if (!cartao || e.target.closest('button, a, input, select, textarea')) return;
    s = {
      cartao,
      id: Number(cartao.dataset.id),
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
      tipo: e.pointerType,
      ativo: false,
    };
    document.addEventListener('pointermove', mover, { passive: false });
    document.addEventListener('pointerup', soltar);
    document.addEventListener('pointercancel', cancelar);
    if (e.pointerType === 'touch') {
      document.addEventListener('touchmove', bloquearRolagem, { passive: false });
      cartao.classList.add('cartao--segurando');
      s.timer = setTimeout(() => s && iniciar(), TOQUE_LONGO_MS);
    }
  }

  const semMenu = (e) => {
    if (e.target.closest('.cartao[data-id]') && (s || e.pointerType === 'touch')) e.preventDefault();
  };
  const esc = (e) => {
    if (e.key === 'Escape' && s?.ativo) limpar();
  };

  raiz.addEventListener('pointerdown', aoPressionar);
  raiz.addEventListener('contextmenu', semMenu);
  document.addEventListener('keydown', esc);

  return () => {
    limpar();
    raiz.removeEventListener('pointerdown', aoPressionar);
    raiz.removeEventListener('contextmenu', semMenu);
    document.removeEventListener('keydown', esc);
  };
}
