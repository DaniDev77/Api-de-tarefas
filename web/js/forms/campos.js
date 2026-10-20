// Utilitários de formulário: erros acessíveis, contadores de caracteres e envio com Ctrl+Enter.
import { html } from '../core/html.js';

/** Bloco de campo padrão: rótulo, controle, ajuda e espaço para erro. */
export function campo({ nome, rotulo, controle, ajuda = '', obrigatorio = false, contador = 0, classe = '' }) {
  return html`<div class="campo ${classe}" data-campo="${nome}">
    <div class="campo__rotulo-linha">
      <label class="campo__rotulo" for="f-${nome}">${rotulo}${obrigatorio ? '' : html` <span class="campo__opcional">(opcional)</span>`}</label>
      ${contador ? html`<span class="campo__contador" data-contador="${nome}" aria-hidden="true">0/${contador}</span>` : ''}
    </div>
    ${controle}
    ${ajuda ? html`<p class="campo__ajuda" id="ajuda-${nome}">${ajuda}</p>` : ''}
    <p class="campo__erro" id="erro-${nome}" hidden></p>
  </div>`;
}

export function limparErros(form) {
  form.querySelectorAll('.campo__erro').forEach((p) => {
    p.hidden = true;
    p.textContent = '';
  });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  form.querySelector('.form-alerta')?.remove();
}

/** Mostra erros por campo e foca o primeiro. Campos desconhecidos viram um alerta geral. */
export function mostrarErros(form, erros, mensagemGeral = '') {
  limparErros(form);
  let primeiro = null;
  const soltos = [];
  Object.entries(erros).forEach(([nome, msg]) => {
    const bloco = form.querySelector(`[data-campo="${nome}"]`);
    if (!bloco) {
      soltos.push(msg);
      return;
    }
    const p = bloco.querySelector('.campo__erro');
    p.textContent = msg;
    p.hidden = false;
    const controle = bloco.querySelector('input, textarea, select');
    if (controle) {
      controle.setAttribute('aria-invalid', 'true');
      controle.setAttribute('aria-describedby', `erro-${nome}`);
      primeiro ??= controle;
      // o erro some assim que a pessoa corrige o campo
      const limpar = () => {
        p.hidden = true;
        p.textContent = '';
        controle.removeAttribute('aria-invalid');
      };
      controle.addEventListener('input', limpar, { once: true });
      controle.addEventListener('change', limpar, { once: true });
    }
  });
  const geral = [mensagemGeral, ...soltos].filter(Boolean).join(' ');
  if (geral) {
    const alerta = document.createElement('p');
    alerta.className = 'form-alerta';
    alerta.setAttribute('role', 'alert');
    alerta.textContent = geral;
    form.prepend(alerta);
  }
  primeiro?.focus();
}

export function ligarContadores(form) {
  form.querySelectorAll('[data-contador]').forEach((rotulo) => {
    const nome = rotulo.dataset.contador;
    const controle = form.querySelector(`[name="${nome}"]`);
    const max = Number(controle.getAttribute('maxlength'));
    const atualizar = () => {
      const n = controle.value.length;
      rotulo.textContent = `${n}/${max}`;
      rotulo.classList.toggle('perto', n > max * 0.9);
    };
    controle.addEventListener('input', atualizar);
    atualizar();
  });
}

/** Ctrl/Cmd + Enter envia o formulário de qualquer campo (inclusive textarea). */
export function ligarAtalhoEnvio(form) {
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
}

export function estadoEnviando(form, enviando, rotulo = 'Salvando…') {
  const botao = form.querySelector('[type="submit"]');
  if (!botao) return;
  if (enviando) {
    botao.dataset.rotulo = botao.textContent;
    botao.textContent = rotulo;
    botao.disabled = true;
    botao.setAttribute('aria-busy', 'true');
  } else {
    botao.textContent = botao.dataset.rotulo || botao.textContent;
    botao.disabled = false;
    botao.removeAttribute('aria-busy');
  }
}

export const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
