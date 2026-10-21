// Hábito: nome, área, dias da semana e horários. Criar põe os itens nas próximas semanas;
// editar muda os próximos itens em aberto (o histórico continua como está).
import { html, render } from '../core/html.js';
import { diaMes, plural, normalizar } from '../core/format.js';
import { ler } from '../core/storage.js';
import * as R from '../domain/rotina.js';
import { store, criarHabito, editarProximos, encerrarHabito, estenderHabito } from '../state.js';
import { abrirModal, confirmar } from '../ui/modal.js';
import { icone } from '../ui/icons.js';
import { abrirFormArea } from './area-form.js';
import { campo, mostrarErros, limparErros, ligarAtalhoEnvio, estadoEnviando } from './campos.js';
import { SEMANAS_PADRAO } from '../config.js';

const SEMANAS = [1, 2, 4, 8];

function linhaHorario(valor, i, podeRemover) {
  return html`<li class="horarios__linha">
    <label class="sr-only" for="f-h${i}">Horário ${i + 1}</label>
    <input id="f-h${i}" type="time" class="entrada entrada--compacta" name="horario" value="${valor}" required>
    ${podeRemover ? html`<button type="button" class="botao-icone botao-icone--p" data-remover-horario="${i}" aria-label="Remover horário ${valor}">${icone('x', { tamanho: 16 })}</button>` : ''}
  </li>`;
}

/**
 * @param {{ serie?: object, sugestao?: { titulo: string, area?: string, dias: number[], horarios: string[] } }} [opcoes]
 */
export function abrirFormHabito({ serie = null, sugestao = null } = {}) {
  const editando = Boolean(serie);
  const s = store.get();
  const ultima = ler('ultimaArea');
  const areaSugerida = sugestao?.area ? s.categorias.find((c) => normalizar(c.nome) === normalizar(sugestao.area)) : null;
  const v = {
    titulo: serie?.titulo ?? sugestao?.titulo ?? '',
    categoriaId: serie?.categoriaId ?? areaSugerida?.id ?? (s.categorias.some((c) => c.id === ultima) ? ultima : s.categorias[0]?.id ?? ''),
    dias: serie?.padrao.dias ?? sugestao?.dias ?? R.DIAS_UTEIS,
    horarios: serie?.padrao.horarios ?? sugestao?.horarios ?? ['08:00'],
    descricao: serie?.itens.at(-1)?.descricao ?? '',
  };
  let horarios = [...v.horarios];
  const abertos = serie ? R.proximosAbertos(serie) : [];

  const conteudo = html`<form class="form form-habito" novalidate>
    ${campo({ nome: 'titulo', rotulo: 'Nome do hábito', obrigatorio: true, controle: html`<input id="f-titulo" name="titulo" class="entrada" maxlength="100" value="${v.titulo}" placeholder="Ex.: Beber água, Academia, Ler 20 min" autofocus>` })}

    ${campo({
      nome: 'categoriaId',
      rotulo: 'Área',
      obrigatorio: true,
      controle: html`<select id="f-categoriaId" name="categoriaId" class="entrada">
        ${!s.categorias.length ? html`<option value="">Crie uma área primeiro</option>` : ''}
        ${[...s.categorias].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((c) => html`<option value="${c.id}" ${c.id === v.categoriaId ? 'selected' : ''}>${c.nome}</option>`)}
        <option value="nova">Nova área…</option>
      </select>`,
    })}

    <fieldset class="campo campo--grupo" data-campo="dias">
      <legend class="campo__rotulo">Dias da semana</legend>
      <div class="chips" role="group" aria-label="Dias da semana">
        ${R.ORDEM_SEMANA.map((d) => html`<label class="chip"><input type="checkbox" name="dias" value="${d}" ${v.dias.includes(d) ? 'checked' : ''}><span>${R.CURTOS_DIA[d]}</span></label>`)}
      </div>
      <div class="atalhos-dias">
        <button type="button" class="botao-texto" data-dias="0,1,2,3,4,5,6">Todo dia</button>
        <button type="button" class="botao-texto" data-dias="1,2,3,4,5">Dias úteis</button>
        <button type="button" class="botao-texto" data-dias="0,6">Fim de semana</button>
      </div>
      <p class="campo__erro" id="erro-dias" hidden></p>
    </fieldset>

    <fieldset class="campo campo--grupo" data-campo="horarios">
      <legend class="campo__rotulo">Horários <span class="campo__opcional">(um item por horário)</span></legend>
      <ul class="horarios" data-horarios></ul>
      <button type="button" class="botao-texto" data-mais-horario>${icone('plus', { tamanho: 14 })}Outro horário no mesmo dia</button>
      <p class="campo__erro" id="erro-horarios" hidden></p>
    </fieldset>

    ${editando
      ? ''
      : html`<div class="form__linha">
          ${campo({ nome: 'inicio', rotulo: 'Começa em', obrigatorio: true, controle: html`<input id="f-inicio" name="inicio" type="date" class="entrada" value="${R.chaveDia(new Date())}" min="${R.chaveDia(new Date())}">` })}
          <fieldset class="campo campo--grupo">
            <legend class="campo__rotulo">Por quantas semanas</legend>
            <div class="segmentos" role="radiogroup" aria-label="Por quantas semanas">
              ${SEMANAS.map((n) => html`<label class="segmento"><input type="radio" name="semanas" value="${n}" ${n === SEMANAS_PADRAO ? 'checked' : ''}><span>${n} sem.</span></label>`)}
            </div>
          </fieldset>
        </div>`}

    ${campo({ nome: 'descricao', rotulo: 'Nota', controle: html`<textarea id="f-descricao" name="descricao" class="entrada" maxlength="500" rows="2" placeholder="Aparece nos detalhes de cada item">${v.descricao}</textarea>` })}

    <p class="previa" data-previa aria-live="polite"></p>

    <div class="acoes-form">
      ${editando
        ? html`<button type="button" class="botao botao--perigo acoes-form__esquerda" data-encerrar ${abertos.length ? '' : 'disabled'}>Encerrar hábito</button>
            <button type="button" class="botao botao--secundario" data-estender>Estender ${SEMANAS_PADRAO} semanas</button>`
        : ''}
      <button type="button" class="botao botao--fantasma" data-fechar>Cancelar</button>
      <button type="submit" class="botao botao--primario">${editando ? 'Salvar mudanças' : 'Criar hábito'}</button>
    </div>
  </form>`;

  return abrirModal({
    titulo: editando ? 'Editar hábito' : 'Novo hábito',
    subtitulo: editando ? `${R.textoDias(serie.padrao.dias)} · ${R.textoHorarios(serie.padrao.horarios)} · na pauta até ${diaMes(serie.ultimo)}` : 'Os itens entram na pauta das próximas semanas.',
    largura: 'm',
    conteudo,
    aoMontar(dialogo, fechar) {
      const form = dialogo.querySelector('form');
      ligarAtalhoEnvio(form);

      const lerHorarios = () => [...form.querySelectorAll('[name="horario"]')].map((i) => i.value).filter(Boolean);
      const desenharHorarios = () => {
        render(form.querySelector('[data-horarios]'), horarios.map((h, i) => linhaHorario(h, i, horarios.length > 1)));
      };
      const diasMarcados = () => [...form.querySelectorAll('[name="dias"]:checked')].map((i) => Number(i.value));

      const previa = () => {
        const dias = diasMarcados();
        const hs = [...new Set(lerHorarios())].sort();
        const saida = form.querySelector('[data-previa]');
        if (!dias.length || !hs.length) {
          saida.textContent = 'Escolha pelo menos um dia e um horário.';
          return;
        }
        if (editando) {
          const mudouPadrao = R.textoDias(dias) !== R.textoDias(serie.padrao.dias) || hs.join() !== serie.padrao.horarios.join();
          saida.textContent = mudouPadrao
            ? `Os ${plural(abertos.length, 'próximo item', 'próximos itens')} em aberto serão refeitos: ${R.textoDias(dias).toLowerCase()}, ${R.textoHorarios(hs)}, até ${diaMes(serie.ultimo)}. O histórico fica como está.`
            : abertos.length
              ? `Nome, área e nota mudam nos ${plural(abertos.length, 'próximo item', 'próximos itens')} em aberto. O histórico fica como está.`
              : 'Não há itens futuros em aberto. Use Estender para pôr o hábito de volta na pauta.';
          return;
        }
        const inicio = R.diaDaChave(form.inicio.value) ?? new Date();
        const semanas = Number(form.querySelector('[name="semanas"]:checked')?.value ?? SEMANAS_PADRAO);
        const datas = R.datasDaSerie({ dias, horarios: hs, inicio, semanas });
        saida.textContent = datas.length
          ? `Cria ${plural(datas.length, 'item', 'itens')}: ${R.textoDias(dias).toLowerCase()}, ${R.textoHorarios(hs)}, de ${diaMes(datas[0])} a ${diaMes(datas.at(-1))}.`
          : 'Nenhum dia e horário cai nesse período.';
      };

      desenharHorarios();
      previa();

      form.addEventListener('input', () => {
        horarios = lerHorarios().length ? lerHorarios() : horarios;
        previa();
      });
      form.addEventListener('change', async (e) => {
        if (e.target.name === 'categoriaId' && e.target.value === 'nova') {
          e.target.value = String(v.categoriaId);
          const nova = await abrirFormArea();
          if (nova) {
            const opt = document.createElement('option');
            opt.value = String(nova.id);
            opt.textContent = nova.nome;
            e.target.insertBefore(opt, e.target.lastElementChild);
            e.target.value = String(nova.id);
          }
        }
        previa();
      });
      form.addEventListener('click', async (e) => {
        const atalho = e.target.closest('[data-dias]');
        if (atalho) {
          const alvo = atalho.dataset.dias.split(',').map(Number);
          form.querySelectorAll('[name="dias"]').forEach((i) => (i.checked = alvo.includes(Number(i.value))));
          previa();
        }
        if (e.target.closest('[data-mais-horario]')) {
          horarios = lerHorarios();
          const ultimo = R.minutosDeTexto(horarios.at(-1) ?? '08:00') ?? 480;
          horarios.push(R.textoDeMinutos(Math.min(23 * 60, ultimo + 180)));
          desenharHorarios();
          form.querySelectorAll('[name="horario"]').item(horarios.length - 1)?.focus();
          previa();
        }
        const remover = e.target.closest('[data-remover-horario]');
        if (remover) {
          horarios = lerHorarios();
          horarios.splice(Number(remover.dataset.removerHorario), 1);
          desenharHorarios();
          previa();
        }
        if (e.target.closest('[data-estender]')) {
          fechar();
          estenderHabito(serie, SEMANAS_PADRAO);
        }
        if (e.target.closest('[data-encerrar]')) {
          const ok = await confirmar({
            titulo: `Encerrar ${serie.titulo}?`,
            mensagem: html`<p>Os <strong>${plural(abertos.length, 'próximo item', 'próximos itens')}</strong> saem da pauta. O que você já fez continua no Progresso.</p>`,
            confirmar: 'Encerrar hábito',
            perigo: true,
          });
          if (ok) {
            fechar();
            encerrarHabito(serie);
          }
        }
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titulo = form.titulo.value.trim();
        const categoriaId = Number(form.categoriaId.value) || 0;
        const dias = diasMarcados();
        const hs = [...new Set(lerHorarios())].sort();
        const erros = {};
        if (!titulo) erros.titulo = 'Dê um nome ao hábito.';
        if (!categoriaId) erros.categoriaId = 'Escolha ou crie uma área.';
        if (!dias.length) erros.dias = 'Escolha pelo menos um dia.';
        if (!hs.length) erros.horarios = 'Escolha pelo menos um horário.';
        if (Object.keys(erros).length) return mostrarErros(form, erros);
        limparErros(form);
        const descricao = form.descricao.value.trim();
        estadoEnviando(form, true);
        fechar();
        if (!editando) {
          const inicio = R.diaDaChave(form.inicio.value) ?? new Date();
          const semanas = Number(form.querySelector('[name="semanas"]:checked')?.value ?? SEMANAS_PADRAO);
          await criarHabito({ titulo, categoriaId, descricao, dias, horarios: hs, semanas, inicio: inicio < new Date() ? new Date() : inicio }).catch(() => {});
          return;
        }
        const mudouPadrao = R.textoDias(dias) !== R.textoDias(serie.padrao.dias) || hs.join() !== serie.padrao.horarios.join();
        if (mudouPadrao) {
          // refaz os próximos itens no novo padrão, até a mesma data em que o hábito acabaria
          const semanas = Math.max(1, Math.ceil((R.diasAteAcabar(serie) + 1) / 7));
          await encerrarHabito(serie).catch(() => {});
          await criarHabito({ titulo, categoriaId, descricao, dias, horarios: hs, semanas, inicio: new Date() }).catch(() => {});
        } else {
          await editarProximos(serie, { titulo, categoriaId, descricao }).catch(() => {});
        }
      });
    },
  });
}
