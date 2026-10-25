// Detalhes de um item da pauta (uma Tarefa), num painel lateral: título, status, dia, horário, área e nota.
// Mudanças aqui valem só para este dia; o hábito inteiro se muda na tela Rotina.
import { html } from '../core/html.js';
import { dataHora } from '../core/format.js';
import { STATUS } from '../domain/enums.js';
import * as R from '../domain/rotina.js';
import { store, perfilAtual, atualizarTarefa, excluirTarefa } from '../state.js';
import { abrirModal } from '../ui/modal.js';
import { icone } from '../ui/icons.js';
import { ponto } from '../ui/pecas.js';
import { navegar } from '../core/router.js';
import { mostrarErros, limparErros, ligarContadores, ligarAtalhoEnvio, estadoEnviando } from './campos.js';

const STATUS_EDITAVEIS = [
  { valor: STATUS.A_FAZER, rotulo: 'A fazer' },
  { valor: STATUS.CONCLUIDA, rotulo: 'Feito' },
  { valor: STATUS.CANCELADA, rotulo: 'Pulado' },
];

/** Linha de propriedade: rótulo à esquerda, valor à direita. */
export const prop = ({ nome, rotulo, controle, grupo = false }) => html`<div class="prop" data-campo="${nome}">
  ${grupo ? html`<span class="prop__rotulo" id="rot-${nome}">${rotulo}</span>` : html`<label class="prop__rotulo" for="f-${nome}">${rotulo}</label>`}
  <div class="prop__valor">${controle}<p class="campo__erro" id="erro-${nome}" hidden></p></div>
</div>`;

export function ligarTituloEditavel(form) {
  const crescer = (el) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  form.querySelectorAll('textarea').forEach((el) => {
    el.addEventListener('input', () => crescer(el));
    requestAnimationFrame(() => crescer(el));
  });
  const titulo = form.querySelector('.titulo-editavel');
  titulo?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      form.querySelector('textarea:not(.titulo-editavel), input, select')?.focus();
    }
  });
  titulo?.addEventListener('input', () => {
    if (titulo.value.includes('\n')) titulo.value = titulo.value.replace(/\s*\n\s*/g, ' ');
  });
}

export function abrirDetalhesItem(tarefa) {
  const s = store.get();
  const perfil = perfilAtual(s);
  const indice = perfil ? R.indiceRotina(s.tarefas, perfil.id, s.habitos) : null;
  const serie = indice ? R.serieDe(indice, tarefa) : null;
  const ordenadas = [...s.categorias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const lembrete = R.ehLembrete(tarefa);
  const statusLista = tarefa.status === STATUS.EM_ANDAMENTO ? [{ valor: STATUS.EM_ANDAMENTO, rotulo: 'Fazendo agora' }, ...STATUS_EDITAVEIS] : STATUS_EDITAVEIS;

  const conteudo = html`<form class="form-lateral" novalidate>
    <div class="form-lateral__corpo">
      <div class="campo campo--titulo" data-campo="titulo">
        <label class="sr-only" for="f-titulo">Título</label>
        <textarea id="f-titulo" name="titulo" class="titulo-editavel" rows="1" maxlength="100" autocomplete="off" placeholder="O que fazer">${tarefa.titulo}</textarea>
        <div class="campo__rotulo-linha">
          <p class="campo__erro" id="erro-titulo" hidden></p>
          <span class="campo__contador" data-contador="titulo" aria-hidden="true">0/100</span>
        </div>
      </div>

      ${serie?.recorrente
        ? html`<p class="nota-habito">${ponto(serie.categoriaId)}<span>Faz parte do hábito <strong>${serie.titulo}</strong>: ${R.textoPadrao(serie).toLowerCase()}, ${R.situacaoSerie(serie).texto}. As mudanças aqui valem só para este dia.</span>
            <button type="button" class="botao-texto" data-ir-habito>Editar o hábito</button></p>`
        : ''}

      <div class="propriedades">
        ${prop({
          nome: 'status',
          rotulo: 'Situação',
          grupo: true,
          controle: html`<div class="segmentos" role="radiogroup" aria-labelledby="rot-status">
            ${statusLista.map(
              (st) => html`<label class="segmento"><input type="radio" name="status" value="${st.valor}" ${st.valor === tarefa.status ? 'checked' : ''}><span>${st.rotulo}</span></label>`
            )}
          </div>`,
        })}
        ${prop({
          nome: 'dia',
          rotulo: 'Dia',
          controle: html`<input id="f-dia" name="dia" type="date" class="entrada entrada--compacta" value="${R.chaveDia(tarefa.dataLimite)}" required>`,
        })}
        ${lembrete
          ? prop({ nome: 'horario', rotulo: 'Horário', grupo: true, controle: html`<span class="prop__texto">Sem horário (vale o dia todo)</span>` })
          : prop({
              nome: 'horario',
              rotulo: tarefa.fim ? 'Começa' : 'Horário',
              controle: html`<input id="f-horario" name="horario" type="time" class="entrada entrada--compacta" value="${R.horaTexto(tarefa.dataLimite)}" required>`,
            })}
        ${prop({
          nome: 'categoriaId',
          rotulo: 'Área',
          controle: html`<select id="f-categoriaId" name="categoriaId" class="entrada entrada--compacta">
            ${ordenadas.map((c) => html`<option value="${c.id}" ${c.id === tarefa.categoriaId ? 'selected' : ''}>${c.nome}</option>`)}
          </select>`,
        })}
      </div>

      <div class="campo" data-campo="descricao">
        <div class="campo__rotulo-linha">
          <label class="campo__rotulo" for="f-descricao">Nota <span class="campo__opcional">(opcional)</span></label>
          <span class="campo__contador" data-contador="descricao" aria-hidden="true">0/500</span>
        </div>
        <textarea id="f-descricao" name="descricao" class="entrada" maxlength="500" rows="4" placeholder="Ex.: treino de pernas, capítulo 4, levar a carteirinha">${tarefa.descricao}</textarea>
        <p class="campo__erro" id="erro-descricao" hidden></p>
      </div>
    </div>

    <footer class="form-lateral__rodape">
      ${tarefa.habitoId
        ? html`<span class="acoes-form__esquerda"></span>`
        : html`<button type="button" class="botao botao--fantasma acoes-form__esquerda botao-texto--perigo" data-remover>${icone('trash-2', { tamanho: 16 })}Remover deste dia</button>`}
      <button type="button" class="botao botao--fantasma" data-fechar>Cancelar</button>
      <button type="submit" class="botao botao--primario">Salvar</button>
    </footer>
  </form>`;

  return abrirModal({
    titulo: 'Detalhes',
    subtitulo: tarefa.dataCriacao ? `Na pauta desde ${dataHora(tarefa.dataCriacao)}` : '',
    lateral: true,
    conteudo,
    aoMontar(dialogo, fechar) {
      const form = dialogo.querySelector('form');
      ligarContadores(form);
      ligarAtalhoEnvio(form);
      ligarTituloEditavel(form);

      form.addEventListener('click', (e) => {
        if (e.target.closest('[data-remover]')) {
          fechar('removido');
          excluirTarefa(tarefa.id);
        }
        if (e.target.closest('[data-ir-habito]')) {
          fechar();
          navegar('rotina', { habito: serie.chave });
        }
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const titulo = String(fd.get('titulo') ?? '').trim();
        const dia = R.diaDaChave(String(fd.get('dia') ?? ''));
        const minutos = lembrete ? 0 : R.minutosDeTexto(String(fd.get('horario') ?? ''));
        const erros = {};
        if (!titulo) erros.titulo = 'Escreva o que fazer.';
        if (!dia) erros.dia = 'Escolha um dia.';
        if (minutos === null) erros.horario = 'Escolha um horário.';
        if (Object.keys(erros).length) return mostrarErros(form, erros);
        limparErros(form);
        estadoEnviando(form, true);
        try {
          const salva = await atualizarTarefa(tarefa.id, {
            titulo,
            descricao: String(fd.get('descricao') ?? ''),
            status: Number(fd.get('status')),
            categoriaId: Number(fd.get('categoriaId')),
            dataLimite: new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), Math.floor(minutos / 60), minutos % 60),
          });
          fechar(salva);
        } catch (erro) {
          estadoEnviando(form, false);
          mostrarErros(form, erro.campos ?? {}, erro.message);
        }
      });
    },
  });
}
