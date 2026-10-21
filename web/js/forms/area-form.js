// Áreas (Categoria na API): Saúde, Treino, Estudos… Cada área tem um tom que marca os seus hábitos.
import { html } from '../core/html.js';
import { plural } from '../core/format.js';
import { tomArea } from '../domain/enums.js';
import { store, areas } from '../state.js';
import { abrirModal, confirmar } from '../ui/modal.js';
import { campo, mostrarErros, limparErros, ligarAtalhoEnvio, ligarContadores, estadoEnviando } from './campos.js';

export async function confirmarExclusaoArea(area) {
  const qtd = store.get().tarefas.filter((t) => t.categoriaId === area.id).length;
  const ok = await confirmar({
    titulo: `Excluir a área ${area.nome}?`,
    mensagem: html`<p>${qtd ? html`O banco apaga junto <strong>${plural(qtd, 'item', 'itens')}</strong> desta área, inclusive o histórico.` : 'Não há itens nesta área.'} Não dá para desfazer.</p>`,
    confirmar: 'Excluir área',
    perigo: true,
  });
  if (ok) await areas.excluir(area.id).catch(() => {});
  return ok;
}

export function abrirFormArea({ area = null } = {}) {
  const editando = Boolean(area);
  const conteudo = html`<form class="form" novalidate>
    ${campo({
      nome: 'nome',
      rotulo: 'Nome',
      obrigatorio: true,
      contador: 100,
      controle: html`<input id="f-nome" name="nome" class="entrada" maxlength="100" value="${area?.nome ?? ''}" placeholder="Ex.: Saúde, Treino, Estudos" autofocus>`,
    })}
    ${campo({
      nome: 'descricao',
      rotulo: 'Descrição',
      contador: 500,
      controle: html`<textarea id="f-descricao" name="descricao" class="entrada" maxlength="500" rows="3" placeholder="O que entra nesta área">${area?.descricao ?? ''}</textarea>`,
    })}
    ${editando ? html`<p class="campo__ajuda"><span class="area-nome"><span class="ponto tom-${tomArea(area.id)}"></span>O tom da área acompanha o número dela no banco e não muda.</span></p>` : ''}
    <div class="acoes-form">
      ${editando ? html`<button type="button" class="botao botao--fantasma botao-texto--perigo acoes-form__esquerda" data-excluir>Excluir área</button>` : ''}
      <button type="button" class="botao botao--fantasma" data-fechar>Cancelar</button>
      <button type="submit" class="botao botao--primario">${editando ? 'Salvar' : 'Criar área'}</button>
    </div>
  </form>`;

  return abrirModal({
    titulo: editando ? 'Editar área' : 'Nova área',
    largura: 'p',
    conteudo,
    aoMontar(dialogo, fechar) {
      const form = dialogo.querySelector('form');
      ligarAtalhoEnvio(form);
      ligarContadores(form);
      form.addEventListener('click', async (e) => {
        if (!e.target.closest('[data-excluir]')) return;
        fechar();
        await confirmarExclusaoArea(area);
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = { nome: form.nome.value.trim(), descricao: form.descricao.value.trim() };
        if (!dados.nome) return mostrarErros(form, { nome: 'Dê um nome à área.' });
        limparErros(form);
        estadoEnviando(form, true);
        try {
          const salva = editando ? await areas.atualizar(area.id, dados) : await areas.criar(dados);
          fechar(salva);
        } catch (erro) {
          estadoEnviando(form, false);
          mostrarErros(form, erro.campos ?? {}, erro.message);
        }
      });
    },
  });
}
