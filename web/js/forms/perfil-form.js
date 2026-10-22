// Perfis (Usuario na API): quem está usando o app. Cada perfil tem a sua rotina.
import { html } from '../core/html.js';
import { mascaraTelefone, plural } from '../core/format.js';
import { store, perfilAtual, perfis, definirPerfil } from '../state.js';
import { abrirModal, confirmar } from '../ui/modal.js';
import { abrirMenu } from '../ui/menu.js';
import { inicial } from '../ui/pecas.js';
import { navegar } from '../core/router.js';
import { campo, mostrarErros, limparErros, ligarAtalhoEnvio, estadoEnviando, emailValido } from './campos.js';

/** Menu da lateral: trocar de perfil, criar um novo ou editar o atual. */
export function menuPerfis(ancora) {
  const s = store.get();
  const atual = perfilAtual(s);
  abrirMenu(
    ancora,
    [
      { titulo: 'Trocar de perfil' },
      ...s.usuarios.map((u) => ({ rotulo: u.nome, iconeHtml: inicial(u.nome), atual: u.id === atual?.id, acao: () => definirPerfil(u.id) })),
      { separador: true },
      { rotulo: 'Novo perfil', icone: 'user-plus', acao: () => abrirFormPerfil() },
      ...(atual ? [{ rotulo: 'Editar meu perfil', icone: 'pencil', acao: () => abrirFormPerfil({ perfil: atual }) }] : []),
    ],
    { alinhar: 'inicio' }
  );
}

export function abrirFormPerfil({ perfil = null } = {}) {
  const editando = Boolean(perfil);
  const conteudo = html`<form class="form" novalidate>
    ${campo({ nome: 'nome', rotulo: 'Nome', obrigatorio: true, controle: html`<input id="f-nome" name="nome" class="entrada" maxlength="100" autocomplete="name" value="${perfil?.nome ?? ''}" autofocus>` })}
    ${campo({ nome: 'email', rotulo: 'E-mail', controle: html`<input id="f-email" name="email" type="email" class="entrada" maxlength="150" autocomplete="email" inputmode="email" value="${perfil?.email ?? ''}">` })}
    ${campo({ nome: 'telefone', rotulo: 'Telefone', controle: html`<input id="f-telefone" name="telefone" class="entrada" maxlength="20" autocomplete="tel" inputmode="tel" value="${perfil?.telefone ?? ''}" placeholder="(14) 99999-9999">` })}
    <div class="acoes-form">
      ${editando ? html`<button type="button" class="botao botao--fantasma botao-texto--perigo acoes-form__esquerda" data-excluir>Excluir perfil</button>` : ''}
      <button type="button" class="botao botao--fantasma" data-fechar>Cancelar</button>
      <button type="submit" class="botao botao--primario">${editando ? 'Salvar' : 'Criar perfil'}</button>
    </div>
  </form>`;

  return abrirModal({
    titulo: editando ? 'Editar perfil' : 'Novo perfil',
    subtitulo: editando ? '' : 'Cada perfil tem a sua própria rotina.',
    largura: 'p',
    conteudo,
    aoMontar(dialogo, fechar) {
      const form = dialogo.querySelector('form');
      ligarAtalhoEnvio(form);
      form.telefone.addEventListener('input', () => {
        form.telefone.value = mascaraTelefone(form.telefone.value);
      });
      form.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-excluir]')) return;
        const qtd = store.get().tarefas.filter((t) => t.usuarioId === perfil.id).length;
        const ok = await confirmar({
          titulo: `Excluir o perfil de ${perfil.nome}?`,
          mensagem: html`<p>O banco apaga junto ${qtd ? html`<strong>${plural(qtd, 'item da rotina', 'itens da rotina')}</strong>` : 'a rotina'} deste perfil. Não dá para desfazer.</p>`,
          confirmar: 'Excluir perfil',
          perigo: true,
        });
        if (!ok) return;
        fechar();
        await perfis.excluir(perfil.id).catch(() => {});
        navegar('hoje');
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = { nome: form.nome.value.trim(), email: form.email.value.trim(), telefone: form.telefone.value.trim() };
        const erros = {};
        if (!dados.nome) erros.nome = 'Escreva o nome.';
        if (dados.email && !emailValido(dados.email)) erros.email = 'Esse e-mail parece incompleto.';
        if (Object.keys(erros).length) return mostrarErros(form, erros);
        limparErros(form);
        estadoEnviando(form, true);
        try {
          const salvo = editando ? await perfis.atualizar(perfil.id, dados) : await perfis.criar(dados);
          if (!editando) definirPerfil(salvo.id);
          fechar(salvo);
        } catch (erro) {
          estadoEnviando(form, false);
          mostrarErros(form, erro.campos ?? {}, erro.message);
        }
      });
    },
  });
}
