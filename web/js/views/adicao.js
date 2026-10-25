// Adição rápida: escreva como fala ("academia 18h seg qua sex") e o app separa o que é título,
// horário, dias e área. Enquanto digita, a leitura aparece embaixo para conferir antes de salvar.
// Com dias da semana vira um hábito; sem, é um item do dia escolhido.
// Hábito com um horário: começa nele e termina pela duração do título ("Ler 20 min") ou em 30 min.
// Hábito sem horário, ou com vários ("água 4x ao dia"): lembrete do dia todo, com aviso no intervalo.
import { html, render } from '../core/html.js';
import { inicioDoDia, dataCompleta, diaMes, diferencaDias, capitalizar, somarDias } from '../core/format.js';
import { ler } from '../core/storage.js';
import { lerFrase } from '../domain/frase.js';
import { textoDias, textoFaixa, minutosDeTexto, textoDeMinutos, chaveDia, fimSugerido, intervaloEntre } from '../domain/rotina.js';
import { tomArea } from '../domain/enums.js';
import { store, criarItem, criarHabito, garantirArea } from '../state.js';
import { icone } from '../ui/icons.js';

const EXEMPLOS = ['beber água 4x ao dia', 'acordar 6h30 dias úteis', 'academia 18h seg qua sex', 'dentista amanhã 14h'];

/** Horário quando a frase não diz: a próxima hora cheia (hoje) ou 9h (outro dia). */
function horarioPadrao(dia, agora = new Date()) {
  if (chaveDia(dia) !== chaveDia(agora)) return '09:00';
  const m = Math.min(23 * 60 + 30, (agora.getHours() + 1) * 60);
  return textoDeMinutos(m);
}

const quandoTexto = (d, agora = new Date()) => {
  const dias = diferencaDias(d, agora);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias === -1) return 'ontem';
  return dataCompleta(d);
};

export function adicaoRapida({ dia }) {
  let areaEscolhida = null; // a pessoa trocou a área na leitura
  let form = null;
  let enviando = false;

  /** Interpreta o texto atual e completa o que faltou. */
  function interpretar(texto) {
    const s = store.get();
    const agora = new Date();
    const p = lerFrase(texto, { categorias: s.categorias, agora });
    const diaBase = p.data ?? dia();
    const horarios = p.horarios.length ? p.horarios : [horarioPadrao(diaBase, agora)];
    const ultima = ler('ultimaArea');
    const categoriaId = areaEscolhida ?? p.categoriaId ?? (s.categorias.some((c) => c.id === ultima) ? ultima : s.categorias[0]?.id ?? null);
    let habito = null;
    if (p.dias) {
      const dataInicio = inicioDoDia(diaBase) < inicioDoDia(agora) ? inicioDoDia(agora) : inicioDoDia(diaBase);
      const umHorario = p.horarios.length === 1;
      habito = {
        dias: p.dias,
        horaInicio: umHorario ? p.horarios[0] : null,
        horaFim: umHorario ? fimSugerido(p.horarios[0], p.titulo) : null,
        lembrarACadaMinutos: p.horarios.length > 1 ? intervaloEntre(p.horarios) : null,
        dataInicio,
        dataFim: p.semanas ? somarDias(dataInicio, p.semanas * 7 - 1) : null,
      };
    }
    return { ...p, diaBase, horarios, horarioSugerido: !p.horarios.length, categoriaId, habito };
  }

  function leitura(texto) {
    if (!texto.trim()) {
      return html`<p class="adicao__exemplos">Escreva como fala, por exemplo:
        ${EXEMPLOS.map((ex, i) => html`${i ? ', ' : ' '}<button type="button" class="botao-texto" data-exemplo="${ex}">${ex}</button>`)}</p>`;
    }
    const s = store.get();
    const p = interpretar(texto);
    const pedacos = [];
    if (p.habito) {
      const h = p.habito;
      pedacos.push(html`<span class="leitura__peca">${icone('repeat-2', { tamanho: 14 })}${textoDias(h.dias)}</span>`);
      pedacos.push(html`<span class="leitura__peca">${icone(h.horaInicio ? 'clock' : 'bell', { tamanho: 14 })}${textoFaixa(h)}</span>`);
      const desde = chaveDia(h.dataInicio) === chaveDia(new Date()) ? '' : `de ${diaMes(h.dataInicio)} `;
      pedacos.push(html`<span class="leitura__peca">${icone('calendar', { tamanho: 14 })}${h.dataFim ? `${desde}até ${diaMes(h.dataFim)}` : `${desde}sem prazo`}</span>`);
    } else {
      pedacos.push(html`<span class="leitura__peca">${icone('calendar', { tamanho: 14 })}${quandoTexto(p.diaBase)}</span>`);
      pedacos.push(html`<span class="leitura__peca">${icone('clock', { tamanho: 14 })}${p.horarios.join(', ')}${p.horarioSugerido ? ' (sugerido)' : ''}</span>`);
    }
    const area = s.categorias.find((c) => c.id === p.categoriaId);
    return html`<div class="leitura">
      <span class="leitura__titulo">${p.titulo || 'Sem título'}</span>
      ${pedacos}
      <label class="leitura__peca leitura__area tom-${tomArea(area?.id)}">
        <span class="ponto" aria-hidden="true"></span>
        <span class="sr-only">Área</span>
        <select data-area-adicao aria-label="Área">
          ${s.categorias.length
            ? s.categorias.map((c) => html`<option value="${c.id}" ${c.id === p.categoriaId ? 'selected' : ''}>${c.nome}</option>`)
            : html`<option value="">Geral (nova área)</option>`}
        </select>
      </label>
    </div>`;
  }

  function atualizarLeitura() {
    if (!form) return;
    const texto = form.texto.value;
    render(form.querySelector('[data-leitura]'), leitura(texto));
    form.querySelector('[type="submit"]').disabled = !texto.trim() || enviando;
  }

  async function enviar() {
    const texto = form.texto.value;
    const p = interpretar(texto);
    if (!p.titulo) {
      form.texto.focus();
      form.classList.remove('treme');
      void form.offsetWidth;
      form.classList.add('treme');
      return;
    }
    enviando = true;
    atualizarLeitura();
    try {
      let categoriaId = p.categoriaId;
      if (!categoriaId) categoriaId = (await garantirArea('Geral', 'Itens sem uma área específica.')).id;
      if (p.habito) {
        await criarHabito({ titulo: p.titulo, categoriaId, ...p.habito });
      } else {
        for (const h of p.horarios) {
          const m = minutosDeTexto(h);
          const d = p.diaBase;
          const quando = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60);
          await criarItem(
            { titulo: p.titulo, categoriaId, dataLimite: quando },
            { mensagem: `${p.titulo} na pauta de ${quandoTexto(quando)}, ${h}` }
          );
        }
      }
      form.texto.value = '';
      areaEscolhida = null;
    } catch {
      /* o erro já apareceu numa notificação; o texto fica para tentar de novo */
    } finally {
      enviando = false;
      atualizarLeitura();
      form.texto.focus();
    }
  }

  return {
    html: () => html`<form class="adicao" data-adicao data-key="adicao" data-morph-manter novalidate autocomplete="off">
      <div class="adicao__campo">
        <span class="adicao__icone" aria-hidden="true">${icone('plus', { tamanho: 18 })}</span>
        <label class="sr-only" for="adicao-texto">Adicionar à pauta</label>
        <input id="adicao-texto" class="adicao__entrada" name="texto" maxlength="160" placeholder="Adicionar à pauta" enterkeyhint="done" spellcheck="false" />
        <button type="submit" class="botao botao--primario botao--p" disabled>Adicionar</button>
      </div>
      <div class="adicao__leitura" data-leitura aria-live="polite"></div>
    </form>`,

    /** Liga os eventos uma vez por formulário (o formulário sobrevive aos redesenhos). */
    ligar(el) {
      if (!el || el === form) {
        // mesmo formulário: só atualiza a leitura (áreas ou dia podem ter mudado)
        if (el && !enviando && document.activeElement !== el.querySelector('select')) atualizarLeitura();
        return;
      }
      form = el;
      atualizarLeitura();
      form.addEventListener('input', (e) => {
        if (e.target.name === 'texto') {
          areaEscolhida = null;
          atualizarLeitura();
        }
      });
      form.addEventListener('change', (e) => {
        if (e.target.matches('[data-area-adicao]')) {
          areaEscolhida = Number(e.target.value) || null;
          atualizarLeitura();
        }
      });
      form.addEventListener('click', (e) => {
        const ex = e.target.closest('[data-exemplo]');
        if (!ex) return;
        form.texto.value = capitalizar(ex.dataset.exemplo);
        atualizarLeitura();
        form.texto.focus();
      });
      form.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          form.texto.value = '';
          atualizarLeitura();
          form.texto.blur();
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!enviando) enviar();
      });
    },
    destruir() {
      form = null;
    },
  };
}

