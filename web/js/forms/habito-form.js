// Hábito: nome, área, dias da semana, horário (início e fim, ou sem horário = lembrete) e prazo.
// Criar grava só a regra; cada dia entra na pauta quando chega (a API gera o item do dia).
// Editar muda os próximos itens em aberto; o histórico continua como está.
import { html } from '../core/html.js';
import { diaMes, plural, normalizar, somarDias, inicioDoDia } from '../core/format.js';
import { ler } from '../core/storage.js';
import * as R from '../domain/rotina.js';
import { store, criarHabito, editarHabito, encerrarHabito, estenderHabito } from '../state.js';
import { abrirModal, confirmar } from '../ui/modal.js';
import { abrirFormArea } from './area-form.js';
import { campo, mostrarErros, limparErros, ligarAtalhoEnvio, estadoEnviando } from './campos.js';
import { SEMANAS_PADRAO } from '../config.js';
import { pedirPermissaoAvisos } from '../ui/lembretes.js';

// prazo ao criar: 0 = sem prazo
const PRAZOS = [0, 2, 4, 8];
const AVISOS = [
  { valor: '', rotulo: 'Não avisar' },
  { valor: '30', rotulo: 'A cada 30 min' },
  { valor: '60', rotulo: 'A cada 1 h' },
  { valor: '120', rotulo: 'A cada 2 h' },
  { valor: '180', rotulo: 'A cada 3 h' },
  { valor: '240', rotulo: 'A cada 4 h' },
];

/** Os valores iniciais do formulário, venham de um hábito, de uma série antiga ou de uma sugestão. */
function valoresIniciais(serie, sugestao, s) {
  const ultima = ler('ultimaArea');
  const areaSugerida = sugestao?.area ? s.categorias.find((c) => normalizar(c.nome) === normalizar(sugestao.area)) : null;
  const categoriaId = serie?.categoriaId ?? areaSugerida?.id ?? (s.categorias.some((c) => c.id === ultima) ? ultima : s.categorias[0]?.id ?? '');
  const h = serie?.habito;
  if (h) {
    return { titulo: h.titulo, categoriaId, dias: h.dias, semHorario: !h.horaInicio, horaInicio: h.horaInicio ?? '08:00', horaFim: h.horaFim ?? '08:30', aviso: h.lembrarACadaMinutos ?? '', descricao: h.descricao, dataFim: h.dataFim };
  }
  if (serie) {
    // série do modo antigo: um horário vira início (com fim sugerido); vários viram lembrete
    const hs = serie.padrao.horarios;
    const varios = hs.length > 1;
    const ini = hs[0] ?? '08:00';
    return { titulo: serie.titulo, categoriaId, dias: serie.padrao.dias, semHorario: varios, horaInicio: ini, horaFim: R.fimSugerido(ini, serie.titulo), aviso: varios ? R.intervaloEntre(hs) ?? '' : '', descricao: serie.itens.at(-1)?.descricao ?? '', dataFim: null };
  }
  const ini = sugestao?.horaInicio ?? '08:00';
  return {
    titulo: sugestao?.titulo ?? '',
    categoriaId,
    dias: sugestao?.dias ?? R.DIAS_UTEIS,
    semHorario: sugestao ? !sugestao.horaInicio && 'horaInicio' in sugestao : false,
    horaInicio: ini,
    horaFim: sugestao?.horaFim ?? R.fimSugerido(ini, sugestao?.titulo ?? ''),
    aviso: sugestao?.lembrarACadaMinutos ?? '',
    descricao: '',
    dataFim: null,
  };
}

/**
 * @param {{ serie?: object, sugestao?: object }} [opcoes]
 *   sugestao: { titulo, area?, dias, horaInicio?, horaFim?, lembrarACadaMinutos? } (sem horaInicio = lembrete)
 */
export function abrirFormHabito({ serie = null, sugestao = null } = {}) {
  const editando = Boolean(serie);
  const s = store.get();
  const daApi = s.suportaHabitos;
  const v = valoresIniciais(serie, sugestao, s);
  const habito = serie?.habito ?? null;
  const subtitulo = editando
    ? `${R.textoPadrao(serie)} · ${R.situacaoSerie(serie).texto}`
    : daApi
      ? 'Cada dia entra na pauta quando chega.'
      : `Os itens entram na pauta das próximas semanas.`;

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

    <fieldset class="campo campo--grupo" data-campo="diasSemana">
      <legend class="campo__rotulo">Dias da semana</legend>
      <div class="chips" role="group" aria-label="Dias da semana">
        ${R.ORDEM_SEMANA.map((d) => html`<label class="chip"><input type="checkbox" name="dias" value="${d}" ${v.dias.includes(d) ? 'checked' : ''}><span>${R.CURTOS_DIA[d]}</span></label>`)}
      </div>
      <div class="atalhos-dias">
        <button type="button" class="botao-texto" data-dias="0,1,2,3,4,5,6">Todo dia</button>
        <button type="button" class="botao-texto" data-dias="1,2,3,4,5">Dias úteis</button>
        <button type="button" class="botao-texto" data-dias="0,6">Fim de semana</button>
      </div>
      <p class="campo__erro" id="erro-diasSemana" hidden></p>
    </fieldset>

    <fieldset class="campo campo--grupo">
      <legend class="campo__rotulo">Horário</legend>
      <div class="segmentos" role="radiogroup" aria-label="Horário">
        <label class="segmento"><input type="radio" name="tipo" value="horario" ${v.semHorario ? '' : 'checked'}><span>Com horário</span></label>
        <label class="segmento"><input type="radio" name="tipo" value="lembrete" ${v.semHorario ? 'checked' : ''}><span>Sem horário</span></label>
      </div>
      <div class="form__linha form-habito__horas" data-com-horario ${v.semHorario ? 'hidden' : ''}>
        ${campo({ nome: 'horaInicio', rotulo: 'Começa', obrigatorio: true, controle: html`<input id="f-horaInicio" name="horaInicio" type="time" class="entrada entrada--compacta" value="${v.horaInicio}">` })}
        ${campo({ nome: 'horaFim', rotulo: 'Termina', obrigatorio: true, controle: html`<input id="f-horaFim" name="horaFim" type="time" class="entrada entrada--compacta" value="${v.horaFim}">` })}
      </div>
      <div class="form-habito__lembrete" data-sem-horario ${v.semHorario ? '' : 'hidden'}>
        <p class="campo__ajuda">Vale o dia todo e nunca fica atrasado. Bom para água, alongar, remédio.</p>
        ${campo({
          nome: 'lembrarACadaMinutos',
          rotulo: 'Lembrar',
          controle: html`<select id="f-lembrarACadaMinutos" name="lembrarACadaMinutos" class="entrada entrada--compacta">
            ${AVISOS.map((a) => html`<option value="${a.valor}" ${String(v.aviso) === a.valor ? 'selected' : ''}>${a.rotulo}</option>`)}
          </select>`,
        })}
      </div>
    </fieldset>

    ${editando
      ? habito
        ? campo({ nome: 'dataFim', rotulo: 'Termina em', controle: html`<input id="f-dataFim" name="dataFim" type="date" class="entrada entrada--compacta" value="${v.dataFim ? R.chaveDia(v.dataFim) : ''}" min="${R.chaveDia(new Date())}">`, ajuda: 'Vazio = sem prazo.' })
        : ''
      : html`<div class="form__linha form-habito__quando">
          ${campo({ nome: 'inicio', rotulo: 'Começa em', obrigatorio: true, controle: html`<input id="f-inicio" name="inicio" type="date" class="entrada" value="${R.chaveDia(new Date())}" min="${R.chaveDia(new Date())}">` })}
          <fieldset class="campo campo--grupo">
            <legend class="campo__rotulo">Prazo</legend>
            <div class="segmentos" role="radiogroup" aria-label="Prazo">
              ${PRAZOS.map((n) => html`<label class="segmento"><input type="radio" name="prazo" value="${n}" ${n === (daApi ? 0 : SEMANAS_PADRAO) ? 'checked' : ''}><span>${n ? `${n} sem.` : 'Sem prazo'}</span></label>`)}
            </div>
          </fieldset>
        </div>`}

    ${campo({ nome: 'descricao', rotulo: 'Nota', controle: html`<textarea id="f-descricao" name="descricao" class="entrada" maxlength="500" rows="2" placeholder="Aparece nos detalhes de cada item">${v.descricao}</textarea>` })}

    <p class="previa" data-previa aria-live="polite"></p>

    <div class="acoes-form">
      ${editando
        ? html`<button type="button" class="botao botao--perigo acoes-form__esquerda" data-encerrar ${habito ? (habito.ativo ? '' : 'disabled') : R.proximosAbertos(serie).length ? '' : 'disabled'}>Encerrar hábito</button>
            ${!habito || habito.dataFim || !habito.ativo ? html`<button type="button" class="botao botao--secundario" data-estender>${habito && !habito.ativo ? 'Retomar' : `Estender ${SEMANAS_PADRAO} semanas`}</button>` : ''}`
        : ''}
      <button type="button" class="botao botao--fantasma" data-fechar>Cancelar</button>
      <button type="submit" class="botao botao--primario">${editando ? 'Salvar mudanças' : 'Criar hábito'}</button>
    </div>
  </form>`;

  return abrirModal({
    titulo: editando ? 'Editar hábito' : 'Novo hábito',
    subtitulo,
    largura: 'm',
    conteudo,
    aoMontar(dialogo, fechar) {
      const form = dialogo.querySelector('form');
      ligarAtalhoEnvio(form);

      const diasMarcados = () => [...form.querySelectorAll('[name="dias"]:checked')].map((i) => Number(i.value)).sort();
      const semHorario = () => form.querySelector('[name="tipo"]:checked')?.value === 'lembrete';

      /** Lê o formulário no formato de hábito. */
      const ler = () => {
        const lembrete = semHorario();
        const dados = {
          titulo: form.titulo.value.trim(),
          categoriaId: Number(form.categoriaId.value) || 0,
          dias: diasMarcados(),
          horaInicio: lembrete ? null : form.horaInicio.value || null,
          horaFim: lembrete ? null : form.horaFim.value || null,
          lembrarACadaMinutos: lembrete ? Number(form.lembrarACadaMinutos.value) || null : null,
          descricao: form.descricao.value.trim(),
        };
        if (!editando) {
          const inicio = R.diaDaChave(form.inicio.value) ?? inicioDoDia(new Date());
          const semanas = Number(form.querySelector('[name="prazo"]:checked')?.value ?? 0);
          dados.dataInicio = inicio;
          dados.dataFim = semanas ? somarDias(inicio, semanas * 7 - 1) : null;
        } else if (habito) {
          dados.dataFim = R.diaDaChave(form.dataFim.value);
        }
        return dados;
      };

      const previa = () => {
        const d = ler();
        const saida = form.querySelector('[data-previa]');
        form.querySelector('[data-com-horario]').hidden = semHorario();
        form.querySelector('[data-sem-horario]').hidden = !semHorario();
        if (!d.dias.length) {
          saida.textContent = 'Escolha pelo menos um dia.';
          return;
        }
        const faixa = d.horaInicio ? `das ${d.horaInicio} às ${d.horaFim || '…'}` : 'sem horário';
        const regra = `${R.textoDias(d.dias)}, ${faixa}`;
        if (editando) {
          saida.textContent = habito || daApi
            ? `${regra}. Os próximos itens em aberto seguem a regra nova; o histórico fica como está.`
            : `${regra}. Os próximos itens em aberto serão refeitos; o histórico fica como está.`;
          return;
        }
        if (daApi) {
          const quando = R.chaveDia(d.dataInicio) === R.chaveDia(new Date()) ? 'a partir de hoje' : `a partir de ${diaMes(d.dataInicio)}`;
          saida.textContent = `${regra}, ${quando}${d.dataFim ? `, até ${diaMes(d.dataFim)}` : ', sem prazo'}. Grava só a regra: cada dia entra na pauta quando chega.`;
          return;
        }
        const horarios = d.horaInicio ? [d.horaInicio] : ['09:00'];
        const semanas = d.dataFim ? Math.ceil((R.diaDaChave(R.chaveDia(d.dataFim)) - d.dataInicio) / 864e5 / 7) || 1 : SEMANAS_PADRAO;
        const datas = R.datasDaSerie({ dias: d.dias, horarios, inicio: d.dataInicio < new Date() ? new Date() : d.dataInicio, semanas });
        saida.textContent = datas.length
          ? `${regra}. A sua API ainda não tem hábitos: cria ${plural(datas.length, 'item', 'itens')}, de ${diaMes(datas[0])} a ${diaMes(datas.at(-1))}.`
          : 'Nenhum dia e horário cai nesse período.';
      };

      previa();
      form.addEventListener('input', previa);
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
        // mudou o início: o fim acompanha, com a mesma duração
        if (e.target.name === 'horaInicio' && e.target.value) {
          const antes = R.minutosDeTexto(v.horaInicio);
          const fim = R.minutosDeTexto(form.horaFim.value);
          const dur = antes !== null && fim !== null ? (fim - antes + 1440) % 1440 || 30 : 30;
          form.horaFim.value = R.textoDeMinutos(R.minutosDeTexto(e.target.value) + dur);
          v.horaInicio = e.target.value;
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
        if (e.target.closest('[data-estender]')) {
          fechar();
          estenderHabito(serie, SEMANAS_PADRAO).catch(() => {});
        }
        if (e.target.closest('[data-encerrar]')) {
          const ok = await confirmar({
            titulo: `Encerrar ${serie.titulo}?`,
            mensagem: html`<p>Os próximos itens saem da pauta. O que você já fez continua no Progresso.</p>`,
            confirmar: 'Encerrar hábito',
            perigo: true,
          });
          if (ok) {
            fechar();
            encerrarHabito(serie).catch(() => {});
          }
        }
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = ler();
        const erros = {};
        if (!d.titulo) erros.titulo = 'Dê um nome ao hábito.';
        if (!d.categoriaId) erros.categoriaId = 'Escolha ou crie uma área.';
        if (!d.dias.length) erros.diasSemana = 'Escolha pelo menos um dia.';
        if (!semHorario()) {
          if (!d.horaInicio) erros.horaInicio = 'Escolha a hora de começar.';
          if (!d.horaFim) erros.horaFim = 'Escolha a hora de terminar.';
          else if (d.horaFim === d.horaInicio) erros.horaFim = 'O fim precisa ser diferente do início.';
        }
        if (Object.keys(erros).length) return mostrarErros(form, erros);
        limparErros(form);
        if (d.lembrarACadaMinutos) pedirPermissaoAvisos();
        estadoEnviando(form, true);
        fechar();
        if (editando) await editarHabito(serie, d).catch(() => {});
        else await criarHabito(d).catch(() => {});
      });
    },
  });
}
