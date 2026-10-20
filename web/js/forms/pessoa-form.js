// Formulário de pessoa (UsuarioModel: Nome, Email, Telefone).
import { html } from '../core/html.js';
import { mascaraTelefone, normalizar } from '../core/format.js';
import { abrirModal } from '../ui/modal.js';
import { store, pessoas } from '../state.js';
import { campo, mostrarErros, limparErros, ligarContadores, ligarAtalhoEnvio, estadoEnviando, emailValido } from './campos.js';

function validar(d, idAtual) {
  const erros = {};
  if (!d.nome.trim()) erros.nome = 'Informe o nome.';
  if (!d.email.trim()) erros.email = 'Informe o e-mail.';
  else if (!emailValido(d.email)) erros.email = 'Esse e-mail parece incompleto. Ex.: nome@empresa.com';
  else if (store.get().usuarios.some((u) => u.id !== idAtual && normalizar(u.email) === normalizar(d.email))) {
    erros.email = 'Já existe uma pessoa com esse e-mail.';
  }
  const digitos = d.telefone.replace(/\D/g, '');
  if (digitos && (digitos.length < 10 || digitos.length > 11)) erros.telefone = 'Use DDD + número. Ex.: (14) 99999-9999';
  return erros;
}

export function abrirFormPessoa({ pessoa = null } = {}) {
  const editando = Boolean(pessoa);
  const conteudo = html`<form class="form" novalidate>
    ${campo({
      nome: 'nome',
      rotulo: 'Nome',
      obrigatorio: true,
      contador: 100,
      controle: html`<input id="f-nome" name="nome" class="entrada" maxlength="100" autocomplete="name" placeholder="Ex.: Ana Beatriz Rocha" value="${pessoa?.nome ?? ''}" autofocus>`,
    })}
    ${campo({
      nome: 'email',
      rotulo: 'E-mail',
      obrigatorio: true,
      controle: html`<input id="f-email" name="email" type="email" class="entrada" maxlength="150" autocomplete="email" inputmode="email" placeholder="nome@empresa.com" value="${pessoa?.email ?? ''}">`,
    })}
    ${campo({
      nome: 'telefone',
      rotulo: 'Telefone',
      ajuda: 'Com DDD. Usado para o atalho de WhatsApp.',
      controle: html`<input id="f-telefone" name="telefone" type="tel" class="entrada" maxlength="20" autocomplete="tel" inputmode="tel" placeholder="(14) 99999-9999" value="${pessoa?.telefone ?? ''}">`,
    })}
    <footer class="acoes-form">
      <button type="button" class="botao botao--fantasma" data-fechar>Cancelar</button>
      <button type="submit" class="botao botao--primario">${editando ? 'Salvar pessoa' : 'Adicionar pessoa'}</button>
    </footer>
  </form>`;

  return abrirModal({
    titulo: editando ? 'Editar pessoa' : 'Nova pessoa',
    largura: 'p',
    conteudo,
    aoMontar(dialogo, fechar) {
      const form = dialogo.querySelector('form');
      ligarContadores(form);
      ligarAtalhoEnvio(form);
      const tel = form.querySelector('[name="telefone"]');
      tel.addEventListener('input', () => {
        const fim = tel.selectionStart === tel.value.length;
        tel.value = mascaraTelefone(tel.value);
        if (fim) tel.setSelectionRange(tel.value.length, tel.value.length);
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const dados = { nome: String(fd.get('nome') ?? ''), email: String(fd.get('email') ?? ''), telefone: String(fd.get('telefone') ?? '') };
        const erros = validar(dados, pessoa?.id);
        if (Object.keys(erros).length) return mostrarErros(form, erros);
        limparErros(form);
        estadoEnviando(form, true);
        try {
          const salva = editando ? await pessoas.atualizar(pessoa.id, dados) : await pessoas.criar(dados);
          fechar(salva);
        } catch (erro) {
          estadoEnviando(form, false);
          mostrarErros(form, erro.campos ?? {}, erro.message);
        }
      });
    },
  });
}
