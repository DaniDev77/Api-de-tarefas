// Primeira vez: quem está usando (um Usuario da API) e por quais hábitos começar.
// Os hábitos escolhidos viram tarefas nas próximas semanas; as áreas que faltarem são criadas.
import { html, morph } from '../core/html.js';
import { ler, gravar } from '../core/storage.js';
import { normalizar, plural } from '../core/format.js';
import { SUGESTOES, AREAS_SUGERIDAS, textoDias, textoHorarios, datasDaSerie } from '../domain/rotina.js';
import { tomArea } from '../domain/enums.js';
import { store, perfis, definirPerfil, criarHabito, garantirArea } from '../state.js';
import { inicial } from '../ui/pecas.js';
import { icone } from '../ui/icons.js';
import { mostrarErros, limparErros, emailValido, estadoEnviando } from '../forms/campos.js';
import { SEMANAS_PADRAO } from '../config.js';

const chaveZero = (s, perfil) => `comecarDoZero:${s.fonte}:${perfil.id}`;

// estado local da tela (sobrevive aos redesenhos)
const escolhidas = new Set([0, 1, 4, 6]);
let montando = false;

/**
 * Mostra as boas-vindas se não há perfil, ou se o perfil ainda não tem nada na pauta.
 * Enquanto a pauta está sendo montada, continua nelas (os hábitos chegam um por um).
 */
export function precisaBoasVindas(s, perfil, indice) {
  if (!perfil) return true;
  if (montando) return true;
  return indice.itens.length === 0 && !ler(chaveZero(s, perfil));
}
let raizAtual = null;

function tomSugerido(s, nomeArea) {
  const existente = s.categorias.find((c) => normalizar(c.nome) === normalizar(nomeArea));
  if (existente) return tomArea(existente.id);
  return Object.keys(AREAS_SUGERIDAS).indexOf(nomeArea) % 8;
}

function etapaPerfil(s) {
  return html`<div class="tela tela--boas-vindas" data-key="bv-perfil">
    <header class="saudacao">
      <h1 class="saudacao__h1">Vamos montar a sua pauta.</h1>
      <p class="saudacao__sub">Água, treino, estudos, sono: cada hábito no seu horário, com o histórico salvo na sua API.</p>
    </header>
    <div class="bv__grade">
      ${s.usuarios.length
        ? html`<section class="painel" aria-labelledby="bv-quem">
            <div class="painel__topo"><h2 id="bv-quem" class="painel__titulo">Quem está usando?</h2><span class="painel__fim">${plural(s.usuarios.length, 'perfil', 'perfis')} na API</span></div>
            <ul class="bv__perfis">
              ${s.usuarios.map(
                (u) => html`<li data-key="u${u.id}"><button type="button" class="bv__perfil" data-escolher-perfil="${u.id}">${inicial(u.nome)}<span class="bv__perfil-texto"><span>${u.nome}</span><small>${u.email || 'sem e-mail'}</small></span>${icone('chevron-right', { tamanho: 16 })}</button></li>`
              )}
            </ul>
          </section>`
        : ''}
      <section class="painel" aria-labelledby="bv-novo">
        <div class="painel__topo"><h2 id="bv-novo" class="painel__titulo">${s.usuarios.length ? 'Ou crie o seu perfil' : 'Como você se chama?'}</h2></div>
        <form class="form" data-form-perfil novalidate>
          <div class="campo" data-campo="nome">
            <label class="campo__rotulo" for="bv-nome">Nome</label>
            <input id="bv-nome" name="nome" class="entrada" maxlength="100" autocomplete="name" required>
            <p class="campo__erro" id="erro-nome" hidden></p>
          </div>
          <div class="campo" data-campo="email">
            <label class="campo__rotulo" for="bv-email">E-mail <span class="campo__opcional">(opcional)</span></label>
            <input id="bv-email" name="email" class="entrada" type="email" maxlength="150" autocomplete="email" inputmode="email">
            <p class="campo__erro" id="erro-email" hidden></p>
          </div>
          <div class="acoes-form"><button type="submit" class="botao botao--primario">Continuar</button></div>
        </form>
      </section>
    </div>
  </div>`;
}

function etapaHabitos(s, perfil) {
  const primeiro = perfil.nome.trim().split(/\s+/)[0];
  const agora = new Date();
  const total = [...escolhidas].reduce((n, i) => n + datasDaSerie({ ...SUGESTOES[i], inicio: agora, semanas: SEMANAS_PADRAO, agora }).length, 0);
  return html`<div class="tela tela--boas-vindas" data-key="bv-habitos">
    <header class="saudacao">
      <h1 class="saudacao__h1">Por onde começar, ${primeiro}?</h1>
      <p class="saudacao__sub">Escolha alguns hábitos. Cada um entra na pauta das próximas ${SEMANAS_PADRAO} semanas, e depois dá para mudar horários e dias.</p>
    </header>
    <fieldset class="bv__sugestoes" ${montando ? 'disabled' : ''}>
      <legend class="sr-only">Hábitos sugeridos</legend>
      ${SUGESTOES.map(
        (sg, i) => html`<label class="sugestao tom-${tomSugerido(s, sg.area)}" data-key="sg${i}">
          <input type="checkbox" name="sugestao" value="${i}" ${escolhidas.has(i) ? 'checked' : ''}>
          <span class="sugestao__caixa" aria-hidden="true">${icone('check', { tamanho: 14 })}</span>
          <span class="sugestao__texto">
            <span class="sugestao__titulo">${sg.titulo}</span>
            <span class="sugestao__meta"><span class="ponto"></span>${sg.area} · ${textoDias(sg.dias)} · ${textoHorarios(sg.horarios)}</span>
          </span>
        </label>`
      )}
    </fieldset>
    <div class="bv__acoes">
      <button type="button" class="botao botao--primario" data-montar ${escolhidas.size && !montando ? '' : 'disabled'} ${montando ? 'aria-busy="true"' : ''}>${montando ? 'Montando a pauta…' : 'Montar minha pauta'}</button>
      <span class="bv__total">${escolhidas.size ? `${plural(escolhidas.size, 'hábito', 'hábitos')}, ${plural(total, 'item', 'itens')} nas próximas ${SEMANAS_PADRAO} semanas` : 'Nenhum hábito escolhido'}</span>
      <button type="button" class="botao-texto bv__zero" data-do-zero ${montando ? 'disabled' : ''}>Começar com a pauta vazia</button>
    </div>
  </div>`;
}

async function montar(perfil) {
  montando = true;
  redesenhar();
  try {
    for (const i of [...escolhidas].sort((a, b) => a - b)) {
      const sg = SUGESTOES[i];
      const area = await garantirArea(sg.area, AREAS_SUGERIDAS[sg.area] ?? '');
      await criarHabito({ titulo: sg.titulo, categoriaId: area.id, dias: sg.dias, horarios: sg.horarios, semanas: SEMANAS_PADRAO });
    }
  } catch {
    /* a notificação de erro já apareceu */
  } finally {
    montando = false;
    store.set({}); // a pauta pronta aparece no Hoje
  }
}

function redesenhar() {
  if (!raizAtual) return;
  const s = store.get();
  const perfil = s.usuarios.find((u) => u.id === s.perfilId) ?? (s.usuarios.length === 1 ? s.usuarios[0] : null);
  morph(raizAtual, perfil ? etapaHabitos(s, perfil) : etapaPerfil(s));
}

function aoClicar(e) {
  const s = store.get();
  const escolher = e.target.closest('[data-escolher-perfil]');
  if (escolher) {
    definirPerfil(Number(escolher.dataset.escolherPerfil));
    return;
  }
  const perfil = s.usuarios.find((u) => u.id === s.perfilId) ?? (s.usuarios.length === 1 ? s.usuarios[0] : null);
  if (e.target.closest('[data-montar]') && perfil && !montando) montar(perfil);
  if (e.target.closest('[data-do-zero]') && perfil) {
    gravar(chaveZero(s, perfil), true);
    store.set({}); // redesenha: a pauta vazia aparece
  }
}

function aoMudar(e) {
  if (e.target.name !== 'sugestao') return;
  const i = Number(e.target.value);
  if (e.target.checked) escolhidas.add(i);
  else escolhidas.delete(i);
  redesenhar();
}

async function aoEnviar(e) {
  if (!e.target.matches('[data-form-perfil]')) return;
  e.preventDefault();
  const form = e.target;
  limparErros(form);
  const nome = form.nome.value.trim();
  const email = form.email.value.trim();
  const erros = {};
  if (!nome) erros.nome = 'Escreva o seu nome.';
  if (email && !emailValido(email)) erros.email = 'Esse e-mail parece incompleto.';
  if (Object.keys(erros).length) {
    mostrarErros(form, erros);
    return;
  }
  estadoEnviando(form, true, 'Criando…');
  try {
    const novo = await perfis.criar({ nome, email, telefone: '' }, { silencioso: true });
    definirPerfil(novo.id);
  } catch (erro) {
    mostrarErros(form, erro.campos ?? {}, erro.message);
  } finally {
    if (form.isConnected) estadoEnviando(form, false);
  }
}

export const boasVindas = {
  desenhar(raiz, s, perfil) {
    if (raizAtual !== raiz) {
      this.sair();
      raizAtual = raiz;
      raiz.addEventListener('click', aoClicar);
      raiz.addEventListener('change', aoMudar);
      raiz.addEventListener('submit', aoEnviar);
    }
    morph(raiz, perfil ? etapaHabitos(s, perfil) : etapaPerfil(s));
  },
  sair() {
    if (!raizAtual) return;
    raizAtual.removeEventListener('click', aoClicar);
    raizAtual.removeEventListener('change', aoMudar);
    raizAtual.removeEventListener('submit', aoEnviar);
    raizAtual = null;
  },
};
