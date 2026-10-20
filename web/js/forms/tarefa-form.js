// Formulário de tarefa (criar e editar) em um modal.
import { html, raw } from '../core/html.js';
import { paraInput, lerData, somarDias, dataHora } from '../core/format.js';
import { ler } from '../core/storage.js';
import { LISTA_STATUS, LISTA_PRIORIDADE, STATUS } from '../domain/enums.js';
import { iconeStatus, iconePrioridade, icone } from '../ui/icons.js';
import { abrirModal } from '../ui/modal.js';
import { store, criarTarefa, atualizarTarefa, excluirTarefa } from '../state.js';
import { campo, mostrarErros, limparErros, ligarContadores, ligarAtalhoEnvio, estadoEnviando } from './campos.js';
import { abrirFormPessoa } from './pessoa-form.js';
import { abrirFormCategoria } from './categoria-form.js';

function atalhosDePrazo() {
  const hoje = new Date();
  const as18 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0);
  const diasAteSexta = ((5 - hoje.getDay() + 7) % 7) || 7;
  return [
    { rotulo: 'Hoje', data: as18(hoje) },
    { rotulo: 'Amanhã', data: as18(somarDias(hoje, 1)) },
    { rotulo: 'Sexta', data: as18(somarDias(hoje, diasAteSexta)) },
    { rotulo: 'Em 1 semana', data: as18(somarDias(hoje, 7)) },
  ];
}

function validar(d) {
  const erros = {};
  if (!d.titulo.trim()) erros.titulo = 'Dê um título para a tarefa.';
  else if (d.titulo.trim().length > 100) erros.titulo = 'Use no máximo 100 caracteres.';
  if (d.descricao.length > 500) erros.descricao = 'Use no máximo 500 caracteres.';
  if (!d.dataLimite) erros.dataLimite = 'Escolha o prazo da tarefa.';
  if (!d.usuarioId) erros.usuarioId = 'Escolha quem vai fazer.';
  if (!d.categoriaId) erros.categoriaId = 'Escolha uma categoria.';
  return erros;
}

/** Quando ainda não há pessoas ou categorias, explica o que falta em vez de abrir um formulário inútil. */
function abrirPreRequisitos(semPessoas, semCategorias) {
  const faltam = [semPessoas && 'uma pessoa', semCategorias && 'uma categoria'].filter(Boolean).join(' e ');
  return abrirModal({
    titulo: 'Falta pouco para a primeira tarefa',
    largura: 'p',
    conteudo: html`<div class="confirmacao">
      <p class="confirmacao__texto">Toda tarefa tem um responsável e uma categoria. Cadastre ${faltam} e volte aqui.</p>
      <div class="acoes-form">
        ${semCategorias ? html`<button type="button" class="botao ${semPessoas ? 'botao--fantasma' : 'botao--primario'}" data-ir="categoria">${raw(icone('folder-plus', { tamanho: 16 }))}Nova categoria</button>` : ''}
        ${semPessoas ? html`<button type="button" class="botao botao--primario" data-ir="pessoa">${raw(icone('user-plus', { tamanho: 16 }))}Nova pessoa</button>` : ''}
      </div>
    </div>`,
    aoMontar(dialogo, fechar) {
      dialogo.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ir]');
        if (b) fechar(b.dataset.ir);
      });
    },
  }).then((destino) => {
    if (destino === 'pessoa') return abrirFormPessoa();
    if (destino === 'categoria') return abrirFormCategoria();
    return null;
  });
}

/**
 * @param {{ tarefa?: object, padrao?: Partial<{ status: number, usuarioId: number, categoriaId: number, prioridade: number, dataLimite: Date }> }} [opcoes]
 */
export function abrirFormTarefa({ tarefa = null, padrao = {} } = {}) {
  const { usuarios, categorias } = store.get();
  if (!tarefa && (!usuarios.length || !categorias.length)) {
    return abrirPreRequisitos(!usuarios.length, !categorias.length);
  }
  const editando = Boolean(tarefa);
  const ultimos = ler('ultimos', {});
  const v = {
    titulo: tarefa?.titulo ?? '',
    descricao: tarefa?.descricao ?? '',
    status: tarefa?.status ?? padrao.status ?? STATUS.A_FAZER,
    prioridade: tarefa?.prioridade ?? padrao.prioridade ?? 2,
    dataLimite: tarefa?.dataLimite ?? padrao.dataLimite ?? atalhosDePrazo()[1].data,
    usuarioId: tarefa?.usuarioId ?? padrao.usuarioId ?? (usuarios.length === 1 ? usuarios[0].id : ultimos.usuarioId ?? ''),
    categoriaId: tarefa?.categoriaId ?? padrao.categoriaId ?? (categorias.length === 1 ? categorias[0].id : ultimos.categoriaId ?? ''),
  };
  const ordenar = (lista) => [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  // linha de propriedade: rótulo à esquerda, valor à direita (como nos detalhes de um cartão)
  const prop = ({ nome, rotulo, controle, grupo = false }) => html`<div class="prop" data-campo="${nome}">
    ${grupo ? html`<span class="prop__rotulo" id="rot-${nome}">${rotulo}</span>` : html`<label class="prop__rotulo" for="f-${nome}">${rotulo}</label>`}
    <div class="prop__valor">${controle}<p class="campo__erro" id="erro-${nome}" hidden></p></div>
  </div>`;

  const conteudo = html`<form class="form-tarefa" novalidate>
    <div class="form-tarefa__corpo">
      <div class="campo campo--titulo" data-campo="titulo">
        <label class="sr-only" for="f-titulo">Título</label>
        <textarea id="f-titulo" name="titulo" class="titulo-editavel" rows="1" maxlength="100" autocomplete="off" placeholder="Título da tarefa" autofocus>${v.titulo}</textarea>
        <div class="campo__rotulo-linha">
          <p class="campo__erro" id="erro-titulo" hidden></p>
          <span class="campo__contador" data-contador="titulo" aria-hidden="true">0/100</span>
        </div>
      </div>

      <div class="propriedades">
        ${prop({
          nome: 'status',
          rotulo: 'Status',
          grupo: true,
          controle: html`<div class="segmentos segmentos--compacto" role="radiogroup" aria-labelledby="rot-status">
            ${LISTA_STATUS.map(
              (s) => html`<label class="segmento s${s.valor}">
                <input type="radio" name="status" value="${s.valor}" ${s.valor === Number(v.status) ? 'checked' : ''}>
                <span>${iconeStatus(s.valor, 14)}${s.rotulo}</span>
              </label>`
            )}
          </div>`,
        })}
        ${prop({
          nome: 'prioridade',
          rotulo: 'Prioridade',
          grupo: true,
          controle: html`<div class="segmentos segmentos--compacto" role="radiogroup" aria-labelledby="rot-prioridade">
            ${[...LISTA_PRIORIDADE].reverse().map(
              (p) => html`<label class="segmento p${p.valor}">
                <input type="radio" name="prioridade" value="${p.valor}" ${p.valor === Number(v.prioridade) ? 'checked' : ''}>
                <span>${iconePrioridade(p.valor, 14)}${p.rotulo}</span>
              </label>`
            )}
          </div>`,
        })}
        ${prop({
          nome: 'dataLimite',
          rotulo: 'Prazo',
          controle: html`<div class="prazo-entrada">
            <input id="f-dataLimite" name="dataLimite" type="datetime-local" class="entrada entrada--compacta" value="${paraInput(v.dataLimite)}" required>
            <div class="atalhos-prazo" role="group" aria-label="Atalhos de prazo">
              ${atalhosDePrazo().map((a) => html`<button type="button" class="pilula" data-prazo="${paraInput(a.data)}">${a.rotulo}</button>`)}
            </div>
          </div>`,
        })}
        ${prop({
          nome: 'usuarioId',
          rotulo: 'Responsável',
          controle: html`<div class="seletor">
            <select id="f-usuarioId" name="usuarioId" class="entrada entrada--compacta">
              <option value="">Escolha uma pessoa</option>
              ${ordenar(usuarios).map((u) => html`<option value="${u.id}" ${u.id === Number(v.usuarioId) ? 'selected' : ''}>${u.nome}</option>`)}
            </select>${icone('chevron-down', { tamanho: 16, classe: 'seletor__seta' })}
          </div>`,
        })}
        ${prop({
          nome: 'categoriaId',
          rotulo: 'Categoria',
          controle: html`<div class="seletor">
            <select id="f-categoriaId" name="categoriaId" class="entrada entrada--compacta">
              <option value="">Escolha uma categoria</option>
              ${ordenar(categorias).map((c) => html`<option value="${c.id}" ${c.id === Number(v.categoriaId) ? 'selected' : ''}>${c.nome}</option>`)}
            </select>${icone('chevron-down', { tamanho: 16, classe: 'seletor__seta' })}
          </div>`,
        })}
      </div>

      ${campo({
        nome: 'descricao',
        rotulo: 'Descrição',
        contador: 500,
        controle: html`<textarea id="f-descricao" name="descricao" class="entrada entrada--texto" maxlength="500" rows="5" placeholder="Detalhes, links ou o que define que a tarefa está pronta">${v.descricao}</textarea>`,
      })}
    </div>

    <footer class="form-tarefa__rodape">
      <div class="acoes-form__info">
        ${editando
          ? html`<button type="button" class="botao botao--fantasma botao--perigo-texto" data-excluir>${icone('trash-2', { tamanho: 16 })}Excluir</button>`
          : html`<span class="meta"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> salva</span>`}
      </div>
      <div class="acoes-form__botoes">
        <button type="button" class="botao botao--fantasma" data-fechar>Cancelar</button>
        <button type="submit" class="botao botao--primario">${editando ? 'Salvar tarefa' : 'Criar tarefa'}</button>
      </div>
    </footer>
  </form>`;

  return abrirModal({
    titulo: editando ? 'Detalhes da tarefa' : 'Nova tarefa',
    subtitulo: editando && tarefa.dataCriacao ? `Criada em ${dataHora(tarefa.dataCriacao)}` : '',
    lateral: true,
    conteudo,
    aoMontar(dialogo, fechar) {
      const form = dialogo.querySelector('form');
      ligarContadores(form);
      ligarAtalhoEnvio(form);

      // título e descrição crescem com o texto; o título é uma linha só (Enter não quebra linha)
      const crescer = (el) => {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      };
      const titulo = form.querySelector('[name="titulo"]');
      const descricao = form.querySelector('[name="descricao"]');
      [titulo, descricao].forEach((el) => {
        el.addEventListener('input', () => crescer(el));
        requestAnimationFrame(() => crescer(el));
      });
      titulo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          descricao.focus();
        }
      });
      titulo.addEventListener('input', () => {
        if (titulo.value.includes('\n')) titulo.value = titulo.value.replace(/\s*\n\s*/g, ' ');
      });

      const entradaPrazo = form.querySelector('[name="dataLimite"]');
      const marcarAtalho = () => {
        form.querySelectorAll('[data-prazo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.prazo === entradaPrazo.value)));
      };
      entradaPrazo.addEventListener('input', marcarAtalho);
      marcarAtalho();
      form.addEventListener('click', (e) => {
        const atalho = e.target.closest('[data-prazo]');
        if (atalho) {
          entradaPrazo.value = atalho.dataset.prazo;
          marcarAtalho();
        }
        if (e.target.closest('[data-excluir]')) {
          fechar('excluida');
          excluirTarefa(tarefa.id);
        }
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const dados = {
          titulo: String(fd.get('titulo') ?? ''),
          descricao: String(fd.get('descricao') ?? ''),
          status: Number(fd.get('status')),
          prioridade: Number(fd.get('prioridade')),
          dataLimite: lerData(fd.get('dataLimite')),
          usuarioId: Number(fd.get('usuarioId')) || 0,
          categoriaId: Number(fd.get('categoriaId')) || 0,
        };
        const erros = validar(dados);
        if (Object.keys(erros).length) return mostrarErros(form, erros);
        limparErros(form);
        estadoEnviando(form, true);
        try {
          const salva = editando ? await atualizarTarefa(tarefa.id, dados) : await criarTarefa(dados);
          fechar(salva);
        } catch (erro) {
          estadoEnviando(form, false);
          mostrarErros(form, erro.campos ?? {}, erro.message);
        }
      });
    },
  });
}
