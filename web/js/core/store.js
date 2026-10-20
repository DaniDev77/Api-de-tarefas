// Store reativo mínimo (padrão observer). Um único estado global, imutável por convenção:
// toda mudança passa por set(), que notifica quem se inscreveu.

export function criarStore(estadoInicial) {
  let estado = estadoInicial;
  const ouvintes = new Set();
  let agendado = false;

  const notificar = () => {
    agendado = false;
    ouvintes.forEach((fn) => fn(estado));
  };

  return {
    get: () => estado,
    /** Aceita um objeto parcial ou uma função (estadoAtual) => parcial */
    set(parcial) {
      const mudanca = typeof parcial === 'function' ? parcial(estado) : parcial;
      if (!mudanca) return;
      estado = { ...estado, ...mudanca };
      // agrupa várias mudanças no mesmo tick em uma única renderização
      if (!agendado) {
        agendado = true;
        queueMicrotask(notificar);
      }
    },
    subscribe(fn) {
      ouvintes.add(fn);
      return () => ouvintes.delete(fn);
    },
  };
}
