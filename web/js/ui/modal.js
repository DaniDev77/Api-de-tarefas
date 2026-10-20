// Janelas modais com o elemento nativo <dialog>: foco preso, Esc para fechar e fundo inerte de graça.
import { html, render } from '../core/html.js';
import { icone } from './icons.js';

/**
 * Abre um modal.
 * @param {{ titulo: string, subtitulo?: string, conteudo: any, largura?: 'p'|'m'|'g', aoMontar?: (dialogo: HTMLDialogElement, fechar: (valor?: any) => void) => void, lateral?: boolean }} opcoes
 * @returns {Promise<any>} resolve com o valor passado para fechar()
 */
export function abrirModal({ titulo, subtitulo = '', conteudo, largura = 'm', aoMontar, lateral = false }) {
  return new Promise((resolver) => {
    const dialogo = document.createElement('dialog');
    dialogo.className = `modal modal--${largura}${lateral ? ' modal--lateral' : ''}`;
    dialogo.setAttribute('aria-labelledby', 'modal-titulo');
    const focoAnterior = document.activeElement;

    render(
      dialogo,
      html`<div class="modal__caixa">
        <header class="modal__topo">
          <div>
            <h2 id="modal-titulo" class="modal__titulo">${titulo}</h2>
            ${subtitulo ? html`<p class="modal__subtitulo">${subtitulo}</p>` : ''}
          </div>
          <button type="button" class="botao-icone" data-fechar aria-label="Fechar">${icone('x')}</button>
        </header>
        <div class="modal__corpo">${conteudo}</div>
      </div>`
    );

    let valorFinal;
    let fechando = false;
    const fechar = (valor) => {
      if (fechando) return;
      fechando = true;
      valorFinal = valor;
      dialogo.classList.add('fechando');
      const terminar = () => {
        if (dialogo.open) dialogo.close();
        dialogo.remove();
        if (focoAnterior && document.contains(focoAnterior)) focoAnterior.focus?.({ preventScroll: true });
        resolver(valorFinal);
      };
      const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduzido) terminar();
      else setTimeout(terminar, 160);
    };

    dialogo.addEventListener('cancel', (e) => {
      e.preventDefault();
      fechar(undefined);
    });
    // clique no fundo (fora da caixa) fecha
    dialogo.addEventListener('mousedown', (e) => {
      if (e.target === dialogo) dialogo.dataset.cliqueFora = '1';
    });
    dialogo.addEventListener('click', (e) => {
      if (e.target === dialogo && dialogo.dataset.cliqueFora === '1') fechar(undefined);
      delete dialogo.dataset.cliqueFora;
      if (e.target.closest('[data-fechar]')) fechar(undefined);
    });

    document.body.append(dialogo);
    dialogo.showModal();
    aoMontar?.(dialogo, fechar);
    const primeiro = dialogo.querySelector('[autofocus]') || dialogo.querySelector('input, textarea, select, button:not([data-fechar])');
    primeiro?.focus();
  });
}

/** Pergunta de confirmação. Resolve true/false. */
export function confirmar({ titulo, mensagem, confirmar = 'Confirmar', cancelar = 'Cancelar', perigo = false }) {
  return abrirModal({
    titulo,
    largura: 'p',
    conteudo: html`<div class="confirmacao">
      <div class="confirmacao__texto">${mensagem}</div>
      <div class="acoes-form">
        ${perigo
          ? html`<button type="button" class="botao botao--fantasma" data-resposta="nao" autofocus>${cancelar}</button>
              <button type="button" class="botao botao--perigo" data-resposta="sim">${confirmar}</button>`
          : html`<button type="button" class="botao botao--fantasma" data-resposta="nao">${cancelar}</button>
              <button type="button" class="botao botao--primario" data-resposta="sim" autofocus>${confirmar}</button>`}
      </div>
    </div>`,
    aoMontar(dialogo, fechar) {
      dialogo.addEventListener('click', (e) => {
        const r = e.target.closest('[data-resposta]');
        if (r) fechar(r.dataset.resposta === 'sim');
      });
    },
  }).then(Boolean);
}
