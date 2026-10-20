// Roteador por hash (#/quadro?pessoa=2). Funciona em qualquer servidor estático, sem configuração.
// Os filtros ficam na URL: dá para favoritar ou compartilhar uma visão filtrada.

export function lerRota() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [caminho = '', busca = ''] = hash.split('?');
  const query = Object.fromEntries(new URLSearchParams(busca));
  return { nome: caminho.split('/')[0] || '', query };
}

export function montarHash(nome, query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) params.set(k, String(v));
  });
  const busca = params.toString();
  return `#/${nome}${busca ? `?${busca}` : ''}`;
}

export function navegar(nome, query = {}) {
  const destino = montarHash(nome, query);
  if (location.hash === destino) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = destino;
}

/** Atualiza a query da rota atual sem recarregar a tela (para filtros). */
export function substituirQuery(query) {
  const { nome } = lerRota();
  history.replaceState(history.state, '', montarHash(nome, query));
}

export function iniciarRoteador(aoMudar) {
  const executar = () => aoMudar(lerRota());
  window.addEventListener('hashchange', executar);
  executar();
  return () => window.removeEventListener('hashchange', executar);
}
