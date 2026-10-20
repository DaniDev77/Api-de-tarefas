// Template seguro: tudo que é interpolado é escapado, exceto o que vier de html`` ou raw().
// Isso impede que um título de tarefa com "<script>" vire código na página (XSS).

const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapar = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => MAPA[c]);

class HtmlSeguro {
  constructor(valor) {
    this.valor = valor;
  }
  toString() {
    return this.valor;
  }
}

/** Marca uma string como HTML confiável (use só com conteúdo gerado pelo próprio app, ex.: ícones). */
export const raw = (valor) => new HtmlSeguro(String(valor ?? ''));

function serializar(valor) {
  if (valor === null || valor === undefined || valor === false) return '';
  if (valor instanceof HtmlSeguro) return valor.valor;
  if (Array.isArray(valor)) return valor.map(serializar).join('');
  return escapar(valor);
}

export function html(partes, ...valores) {
  let saida = '';
  partes.forEach((parte, i) => {
    saida += parte;
    if (i < valores.length) saida += serializar(valores[i]);
  });
  return new HtmlSeguro(saida);
}

/** Substitui o conteúdo de um elemento. */
export function render(elemento, conteudo) {
  if (!elemento) return;
  elemento.innerHTML = serializar(conteudo);
}

// ------------------------------------------------------------------ morph
// Atualiza o DOM que já está na tela para ficar igual ao HTML novo, mexendo só no que mudou.
// Por que: recriar tudo com innerHTML perde foco, hover, rolagem e estado de campos, e impede
// transições. Filhos com data-key são casados pela chave (mudam de ordem sem serem recriados).
// Um elemento com data-morph-manter tem os filhos preservados (ex.: um formulário sendo digitado).

const chaveDe = (n) => (n.nodeType === 1 ? n.getAttribute('data-key') : null);

function mesmoTipo(a, b) {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  return a.tagName === b.tagName && chaveDe(a) === chaveDe(b);
}

function sincronizarAtributos(atual, novo) {
  for (const { name } of [...atual.attributes]) {
    if (!novo.hasAttribute(name)) atual.removeAttribute(name);
  }
  for (const { name, value } of [...novo.attributes]) {
    if (atual.getAttribute(name) !== value) atual.setAttribute(name, value);
  }
}

/** Campos de formulário guardam o valor numa propriedade, não no atributo. Não mexe no campo em foco. */
function sincronizarControle(atual, novo) {
  if (document.activeElement === atual) return;
  if (atual instanceof HTMLInputElement) {
    if (atual.type === 'checkbox' || atual.type === 'radio') atual.checked = novo.hasAttribute('checked');
    else {
      const v = novo.getAttribute('value') ?? '';
      if (atual.value !== v) atual.value = v;
    }
  } else if (atual instanceof HTMLTextAreaElement) {
    if (atual.value !== novo.textContent) atual.value = novo.textContent;
  } else if (atual instanceof HTMLSelectElement) {
    const escolhida = novo.querySelector('option[selected]');
    atual.value = escolhida ? escolhida.getAttribute('value') ?? escolhida.textContent : atual.options[0]?.value ?? '';
  }
}

function morphNo(atual, novo) {
  if (atual.nodeType !== 1) {
    if (atual.nodeValue !== novo.nodeValue) atual.nodeValue = novo.nodeValue;
    return;
  }
  const manter = atual.hasAttribute('data-morph-manter') && novo.hasAttribute('data-morph-manter');
  sincronizarAtributos(atual, novo);
  if (!manter) morphFilhos(atual, novo);
  sincronizarControle(atual, novo);
}

function morphFilhos(pai, novoPai) {
  const novos = Array.from(novoPai.childNodes);
  const chavesNovas = new Set(novos.map(chaveDe).filter((k) => k !== null));
  const porChave = new Map();
  for (let n = pai.firstChild; n; n = n.nextSibling) {
    const k = chaveDe(n);
    if (k !== null) porChave.set(k, n);
  }
  // remove antes quem saiu: assim os que ficam não precisam ser movidos
  // (mover um nó no DOM custa caro e tira o foco dele)
  const saiu = (n) => n && chaveDe(n) !== null && !chavesNovas.has(chaveDe(n));
  const pularSaidos = (n) => {
    while (saiu(n)) {
      const proximo = n.nextSibling;
      pai.removeChild(n);
      n = proximo;
    }
    return n;
  };
  // "cursor" anda pelos filhos atuais; tudo que sobrar depois dele não existe mais no HTML novo
  let cursor = pularSaidos(pai.firstChild);
  for (const novo of novos) {
    const k = chaveDe(novo);
    let alvo = null;
    if (k !== null) {
      const candidato = porChave.get(k);
      if (candidato && candidato.tagName === novo.tagName) {
        alvo = candidato;
        porChave.delete(k);
      }
    } else if (cursor && chaveDe(cursor) === null && mesmoTipo(cursor, novo)) {
      alvo = cursor;
    }
    if (alvo) {
      if (alvo === cursor) cursor = pularSaidos(cursor.nextSibling);
      else pai.insertBefore(alvo, cursor);
      morphNo(alvo, novo);
    } else {
      pai.insertBefore(novo, cursor);
    }
  }
  while (cursor) {
    const proximo = cursor.nextSibling;
    pai.removeChild(cursor);
    cursor = proximo;
  }
}

/** Atualiza o conteúdo de um elemento só onde mudou (use no lugar de render() em telas que redesenham). */
export function morph(elemento, conteudo) {
  if (!elemento) return;
  const t = document.createElement('template');
  t.innerHTML = serializar(conteudo);
  morphFilhos(elemento, t.content);
}

/** Converte uma string de HTML em um nó (primeiro elemento). */
export function criarElemento(conteudo) {
  const t = document.createElement('template');
  t.innerHTML = serializar(conteudo).trim();
  return t.content.firstElementChild;
}

/** Classes condicionais: cx('a', cond && 'b') */
export const cx = (...classes) => classes.filter(Boolean).join(' ');
