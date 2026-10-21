// Foco: um cronômetro para um item da pauta (estudar, ler, treinar).
// Enquanto roda, o item fica "Fazendo agora" (EmAndamento) na API; ao terminar, um toque marca como feito.
// O cronômetro guarda a hora de término, não um contador: fechar a aba ou recarregar não perde o tempo.
import { html, morph } from '../core/html.js';
import { hora } from '../core/format.js';
import { STATUS, estaAberta, estaFeita, tomArea } from '../domain/enums.js';
import * as R from '../domain/rotina.js';
import { store, perfilAtual, iniciarFoco, pausarFoco, retomarFoco, encerrarFoco, restanteFoco, mudarStatus } from '../state.js';
import { icone } from '../ui/icons.js';
import { tituloTela, ponto } from '../ui/pecas.js';
import { navegar } from '../core/router.js';
import { abrirDetalhesItem } from '../forms/item-form.js';

const PADROES = [15, 25, 45, 60];

/** 1534000 ms -> "25:34"; acima de uma hora, "1:05:00". */
export function relogio(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, '0'); // taste-skill-ignore: dígitos do relógio
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

let bloqueioTela = null;
async function manterTelaAcesa(ligar) {
  try {
    if (ligar && !bloqueioTela && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      bloqueioTela = await navigator.wakeLock.request('screen');
      bloqueioTela.addEventListener('release', () => (bloqueioTela = null));
    } else if (!ligar && bloqueioTela) {
      await bloqueioTela.release();
      bloqueioTela = null;
    }
  } catch {
    /* o navegador recusou (economia de bateria): o foco funciona igual */
  }
}

function avisarFim(titulo) {
  navigator.vibrate?.([120, 80, 120]);
  if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('Foco concluído', { body: `${titulo}: tempo encerrado. Marque como feito no Pauta.`, icon: 'assets/icone-192.png' });
    } catch {
      /* alguns navegadores só notificam pelo service worker */
    }
  }
}

export default {
  titulo: 'Foco',
  montar(raiz, { query, estado }) {
    let minutosEscolhidos = null;
    let terminouAvisado = false;

    // sem item na URL: o foco em andamento, ou o item de hoje que faz mais sentido agora
    const tarefaAlvo = (s) => {
      const id = Number(query?.tarefa) || s.foco?.tarefaId || null;
      if (id) return s.tarefas.find((t) => t.id === id) ?? null;
      const perfil = perfilAtual(s);
      if (!perfil) return null;
      const doDia = R.itensDoDia(R.indiceRotina(s.tarefas, perfil.id), new Date());
      const r = R.resumoDia(doDia);
      return r.andamento ?? r.proximo ?? r.atrasados[0] ?? null;
    };

    const desenhar = (s) => {
      const perfil = perfilAtual(s);
      const t = tarefaAlvo(s);
      if (!perfil || !t) {
        // sem item escolhido: os itens em aberto de hoje
        const indice = perfil ? R.indiceRotina(s.tarefas, perfil.id) : null;
        const abertos = indice ? R.itensDoDia(indice, new Date()).filter(estaAberta) : [];
        morph(
          raiz,
          html`<div class="tela tela--foco" data-key="foco-escolha">
            ${tituloTela({ titulo: 'Foco', sub: abertos.length ? 'Escolha um item de hoje para focar.' : 'Nada em aberto hoje. Quando houver, o foco começa pelo próximo item da pauta.' })}
            <ul class="lista-curta foco__escolha">
              ${abertos.map((x) => html`<li data-key="e${x.id}"><a class="lista-curta__linha" href="#/foco?tarefa=${x.id}">${ponto(x.categoriaId)}<span class="lista-curta__nome">${x.titulo}</span><span class="lista-curta__valor">${R.horaTexto(x.dataLimite)}</span></a></li>`)}
            </ul>
          </div>`
        );
        return;
      }
      const f = s.foco?.tarefaId === t.id ? s.foco : null;
      const outroFoco = s.foco && s.foco.tarefaId !== t.id ? s.tarefas.find((x) => x.id === s.foco.tarefaId) : null;
      const doTitulo = R.duracaoDoTitulo(t.titulo);
      const opcoes = [...new Set([...(doTitulo ? [doTitulo] : []), ...PADROES])].sort((a, b) => a - b);
      minutosEscolhidos ??= doTitulo ?? 25;
      const restante = f ? restanteFoco(f) : minutosEscolhidos * 60_000;
      const total = f ? f.duracaoMs : minutosEscolhidos * 60_000;
      const fracao = total ? 1 - restante / total : 0;
      const fase = !f ? 'pronto' : restante <= 0 ? 'terminou' : f.pausado ? 'pausado' : 'rodando';
      const categoria = s.categorias.find((c) => c.id === t.categoriaId);
      const r = 132;
      const c = 2 * Math.PI * r;

      const textoFase = {
        pronto: estaFeita(t) ? 'Este item já está feito.' : 'Pronto para começar.',
        rodando: `Termina às ${hora(new Date(Date.now() + restante))}.`,
        pausado: 'Pausado.',
        terminou: 'Tempo encerrado. Bom trabalho.',
      }[fase];

      // ao lado: a nota do item e o que vem depois dele hoje
      const indice = R.indiceRotina(s.tarefas, perfil.id);
      const depois = R.itensDoDia(indice, new Date()).filter((x) => estaAberta(x) && x.id !== t.id && x.dataLimite >= t.dataLimite).slice(0, 4);
      const lado = html`<aside class="foco__lado" aria-label="Sobre este item">
        <section class="painel" aria-labelledby="foco-nota">
          <div class="painel__topo"><h2 id="foco-nota" class="painel__titulo">Nota</h2><span class="painel__fim"><button type="button" class="botao-texto" data-detalhes>Editar</button></span></div>
          <p class="foco__texto-nota${t.descricao ? '' : ' cinza'}">${t.descricao || 'Sem nota. Use para lembrar o que fazer neste foco: o capítulo, a lista de exercícios, o treino do dia.'}</p>
        </section>
        <section class="painel" aria-labelledby="foco-depois">
          <div class="painel__topo"><h2 id="foco-depois" class="painel__titulo">Depois deste, hoje</h2><span class="conta">${depois.length}</span></div>
          ${depois.length
            ? html`<ul class="lista-curta">${depois.map((x) => html`<li data-key="d${x.id}"><a class="lista-curta__linha" href="#/foco?tarefa=${x.id}">${ponto(x.categoriaId)}<span class="lista-curta__nome">${x.titulo}</span><span class="lista-curta__valor">${R.horaTexto(x.dataLimite)}</span></a></li>`)}</ul>`
            : html`<p class="painel__vazio">Nada mais em aberto hoje depois deste.</p>`}
        </section>
      </aside>`;

      morph(
        raiz,
        html`<div class="tela tela--foco" data-key="foco">
          <a class="botao-texto foco__voltar" href="#/hoje">${icone('chevron-left', { tamanho: 16 })}Hoje</a>
          <div class="foco__grade">
          <div class="foco tom-${tomArea(t.categoriaId)} foco--${fase}">
            <p class="foco__area"><span class="area-nome">${ponto(t.categoriaId)}${categoria?.nome ?? 'Sem área'}</span> · na pauta às ${R.horaTexto(t.dataLimite)}</p>
            <h1 class="foco__titulo">${t.titulo}</h1>
            ${outroFoco ? html`<p class="aviso">Há outro foco em andamento: ${outroFoco.titulo}. Começar este encerra aquele.</p>` : ''}
            <div class="foco__relogio" role="timer" aria-label="Tempo restante">
              <svg class="foco__anel" viewBox="0 0 280 280" aria-hidden="true">
                <circle class="foco__trilho" cx="140" cy="140" r="${r}"/>
                <circle class="foco__progresso" cx="140" cy="140" r="${r}" transform="rotate(-90 140 140)" style="stroke-dasharray:${(c * Math.min(1, Math.max(0, fracao))).toFixed(1)} ${c.toFixed(1)}${fracao <= 0 ? ';opacity:0' : ''}"/>
              </svg>
              <span class="foco__tempo"${f ? html` data-relogio-foco` : ''}>${relogio(restante)}</span>
              <span class="foco__fase" aria-live="polite">${textoFase}</span>
            </div>

            ${fase === 'pronto'
              ? html`<div class="segmentos foco__duracoes" role="radiogroup" aria-label="Duração do foco">
                  ${opcoes.map((m) => html`<label class="segmento"><input type="radio" name="minutos" value="${m}" ${m === minutosEscolhidos ? 'checked' : ''}><span>${m} min</span></label>`)}
                </div>`
              : ''}

            <div class="foco__acoes">
              ${fase === 'pronto'
                ? html`<button type="button" class="botao botao--primario foco__principal" data-comecar ${estaFeita(t) ? 'disabled' : ''}>${icone('play', { tamanho: 16 })}Começar</button>`
                : ''}
              ${fase === 'rodando' ? html`<button type="button" class="botao botao--secundario" data-pausar>${icone('pause', { tamanho: 16 })}Pausar</button>` : ''}
              ${fase === 'pausado' ? html`<button type="button" class="botao botao--primario" data-retomar>${icone('play', { tamanho: 16 })}Retomar</button>` : ''}
              ${fase === 'terminou' ? html`<button type="button" class="botao botao--primario foco__principal" data-concluir>${icone('check', { tamanho: 16 })}Marcar como feito</button>
                <button type="button" class="botao botao--secundario" data-mais-cinco>Mais 5 min</button>` : ''}
              ${fase === 'rodando' || fase === 'pausado' ? html`<button type="button" class="botao botao--fantasma" data-concluir>${icone('check', { tamanho: 16 })}Terminei antes</button>` : ''}
              ${f ? html`<button type="button" class="botao botao--fantasma" data-parar>Parar sem marcar</button>` : ''}
            </div>
            <p class="foco__nota">Enquanto o foco roda, o item aparece como "Fazendo agora" em todos os aparelhos ligados à API.${'Notification' in window && Notification.permission === 'default' ? html` <button type="button" class="botao-texto" data-avisar>Avisar quando terminar</button>` : ''}</p>
          </div>
          ${lado}
          </div>
        </div>`
      );

      if (fase === 'terminou' && !terminouAvisado) {
        terminouAvisado = true;
        avisarFim(t.titulo);
      }
      manterTelaAcesa(fase === 'rodando');
    };

    // o anel e o texto andam a cada segundo (sem passar pelo estado global)
    const tique = setInterval(() => {
      const s = store.get();
      if (s.foco && !s.foco.pausado) desenhar(s);
    }, 1000);

    raiz.addEventListener('change', (e) => {
      if (e.target.name === 'minutos') {
        minutosEscolhidos = Number(e.target.value);
        desenhar(store.get());
      }
    });
    raiz.addEventListener('click', async (e) => {
      const s = store.get();
      const t = tarefaAlvo(s);
      if (!t) return;
      if (e.target.closest('[data-comecar]')) {
        if (s.foco && s.foco.tarefaId !== t.id) await encerrarFoco({ concluir: false });
        terminouAvisado = false;
        await iniciarFoco(t.id, minutosEscolhidos ?? 25);
      }
      if (e.target.closest('[data-pausar]')) pausarFoco();
      if (e.target.closest('[data-retomar]')) retomarFoco();
      if (e.target.closest('[data-mais-cinco]')) {
        terminouAvisado = false;
        await iniciarFoco(t.id, 5);
      }
      if (e.target.closest('[data-concluir]')) {
        if (s.foco?.tarefaId === t.id) await encerrarFoco({ concluir: true });
        else await mudarStatus(t.id, STATUS.CONCLUIDA).catch(() => {});
        navegar('hoje');
      }
      if (e.target.closest('[data-parar]')) await encerrarFoco({ concluir: false });
      if (e.target.closest('[data-detalhes]')) abrirDetalhesItem(t);
      if (e.target.closest('[data-avisar]')) {
        await Notification.requestPermission().catch(() => {});
        desenhar(store.get());
      }
    });
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') desenhar(store.get());
    };
    document.addEventListener('visibilitychange', aoVoltar);

    desenhar(estado);
    return {
      atualizar: desenhar,
      destruir() {
        clearInterval(tique);
        document.removeEventListener('visibilitychange', aoVoltar);
        manterTelaAcesa(false);
      },
    };
  },
};
