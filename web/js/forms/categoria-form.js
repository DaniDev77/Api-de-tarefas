// Formulário de categoria (CategoriaModel: Nome, Descricao).
import { html } from '../core/html.js';
import { normalizar } from '../core/format.js';
import { abrirModal } from '../ui/modal.js';
import { store, categorias } from '../state.js';
import { campo, mostrarErros, limparErros, ligarContadores, ligarAtalhoEnvio, estadoEnviando } from './campos.js';

function validar(d, idAtual) {
  const erros = {};
  if (!d.nome.trim()) erros.nome = 'Dê um nome para a categoria.';
  else if (store.get().categorias.some((c) => c.id !== idAtual && normalizar(c.nome) === normalizar(d.nome))) {
    erros.nome = 'Já existe uma categoria com esse nome.';
  }
  if (d.descricao.length > 500) erros.descricao = 'Use no máximo 500 caracteres.';
  return erros;
}

export function abrirFormCategoria({ categoria = null } = {}) {
  const editando = Boolean(categoria);
  const conteudo = html`<form class="form" novalidate>
    ${campo({
      nome: 'nome',
      rotulo: 'Nome',
      obrigatorio: true,
      contador: 100,
      controle: html`<input id="f-nome" name="nome" class="entrada" maxlength="100" autocomplete="off" placeholder="Ex.: Financeiro" value="${categoria?.nome ?? ''}" autofocus>`,
    })}
    ${campo({
      nome: 'descricao',
      rotulo: 'Descrição',
      contador: 500,
      controle: html`<textarea id="f-descricao" name="descricao" class="entrada" maxlength="500" rows="3" placeholder="Que tipo de tarefa entra aqui?">${categoria?.descricao ?? ''}</textarea>`,
    })}
    <footer class="acoes-form">
      <button type="button" class="botao botao--fantasma" data-fechar>Cancelar</button>
      <button type="submit" class="botao botao--primario">${editando ? 'Salvar categoria' : 'Criar categoria'}</button>
    </footer>
  </form>`;

  return abrirModal({
    titulo: editando ? 'Editar categoria' : 'Nova categoria',
    largura: 'p',
    conteudo,
    aoMontar(dialogo, fechar) {
      const form = dialogo.querySelector('form');
      ligarContadores(form);
      ligarAtalhoEnvio(form);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const dados = { nome: String(fd.get('nome') ?? ''), descricao: String(fd.get('descricao') ?? '') };
        const erros = validar(dados, categoria?.id);
        if (Object.keys(erros).length) return mostrarErros(form, erros);
        limparErros(form);
        estadoEnviando(form, true);
        try {
          const salva = editando ? await categorias.atualizar(categoria.id, dados) : await categorias.criar(dados);
          fechar(salva);
        } catch (erro) {
          estadoEnviando(form, false);
          mostrarErros(form, erro.campos ?? {}, erro.message);
        }
      });
    },
  });
}
