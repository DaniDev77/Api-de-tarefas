// Ajustes: perfil, de onde vêm os dados (API ou demonstração), endereço da API, aparência,
// instalar no celular e atalhos. Cada seção salva sozinha.
import { html, render } from '../core/html.js';
import { dataHora, plural } from '../core/format.js';
import { icone } from '../ui/icons.js';
import { confirmar } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { inicial, tituloTela } from '../ui/pecas.js';
import { store, perfilAtual, definirPerfil, definirFonte, definirApiUrl, definirTema, testarConexao, reiniciarDemonstracao, carregarTudo } from '../state.js';
import { abrirFormPerfil } from '../forms/perfil-form.js';
import { API_PADRAO, APP } from '../config.js';

export const urlSwagger = (apiUrl) => apiUrl.replace(/\/api\/?$/i, '') + '/swagger';

const ATALHOS = [
  ['Ctrl K', 'Buscar e executar comandos'],
  ['N', 'Escrever um item novo (no Hoje)'],
  ['← →', 'Dia anterior e próximo (no Hoje)'],
  ['T', 'Voltar para hoje'],
  ['G H', 'Ir para Hoje'],
  ['G P', 'Ir para Progresso'],
  ['G R', 'Ir para Rotina'],
  ['G F', 'Ir para Foco'],
  ['Enter', 'Marcar o item focado (no botão redondo)'],
  ['Ctrl Enter', 'Salvar o formulário aberto'],
  ['?', 'Mostrar os atalhos'],
];

export function listaAtalhos() {
  return html`<dl class="atalhos">
    ${ATALHOS.map(([teclas, acao]) => html`<div><dt>${teclas.split(' ').map((t) => html`<kbd>${t}</kbd>`)}</dt><dd>${acao}</dd></div>`)}
  </dl>`;
}

const ehIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalado = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function secao({ id, titulo, texto, corpo }) {
  return html`<section class="ajuste" aria-labelledby="${id}">
    <div class="ajuste__texto">
      <h2 id="${id}" class="ajuste__titulo">${titulo}</h2>
      <p>${texto}</p>
    </div>
    <div class="ajuste__painel">${corpo}</div>
  </section>`;
}

export default {
  titulo: 'Ajustes',
  montar(raiz, { estado }) {
    const desenhar = (s) => {
      const perfil = perfilAtual(s);
      const outros = s.usuarios.filter((u) => u.id !== perfil?.id);
      render(
        raiz,
        html`<div class="tela tela--ajustes">
          ${tituloTela({ titulo: 'Ajustes', sub: s.fonte === 'demo' ? 'Usando a rotina de exemplo deste navegador.' : `Conectado a ${s.apiUrl}.` })}

          ${secao({
            id: 'aj-perfil',
            titulo: 'Perfil',
            texto: 'Cada perfil é um usuário da API, com a sua própria rotina. Troque quando outra pessoa for usar neste aparelho.',
            corpo: html`${perfil
                ? html`<div class="perfil-cartao">${inicial(perfil.nome)}<div class="perfil-cartao__texto"><strong>${perfil.nome}</strong><span>${perfil.email || 'sem e-mail'}${perfil.telefone ? ` · ${perfil.telefone}` : ''}</span></div>
                    <button type="button" class="botao botao--secundario botao--p" data-editar-perfil>Editar</button></div>`
                : html`<p>Nenhum perfil escolhido.</p>`}
              ${outros.length
                ? html`<ul class="lista-curta">${outros.map((u) => html`<li><button type="button" class="lista-curta__linha" data-usar-perfil="${u.id}">${inicial(u.nome)}<span class="lista-curta__nome">${u.nome}</span><span class="lista-curta__valor">Usar este perfil</span></button></li>`)}</ul>`
                : ''}
              <button type="button" class="botao-texto" data-novo-perfil>${icone('user-plus', { tamanho: 16 })}Novo perfil</button>`,
          })}

          ${secao({
            id: 'aj-fonte',
            titulo: 'De onde vêm os dados',
            texto: 'Com a API, a rotina fica no banco SQL Server. A demonstração usa uma rotina de exemplo guardada só neste navegador.',
            corpo: html`<div class="opcoes" role="radiogroup" aria-labelledby="aj-fonte">
              <label class="opcao"><input type="radio" name="fonte" value="api" ${s.fonte === 'api' ? 'checked' : ''}>
                <span class="opcao__icone">${icone('server', { tamanho: 20 })}</span><span><strong>API ASP.NET</strong><small>Salva no SQL Server</small></span></label>
              <label class="opcao"><input type="radio" name="fonte" value="demo" ${s.fonte === 'demo' ? 'checked' : ''}>
                <span class="opcao__icone">${icone('database', { tamanho: 20 })}</span><span><strong>Demonstração</strong><small>Rotina de exemplo</small></span></label>
            </div>`,
          })}

          ${secao({
            id: 'aj-api',
            titulo: 'Endereço da API',
            texto: html`Copie do <code>launchSettings.json</code> (perfil https) e acrescente <code>/api</code>.`,
            corpo: html`<form class="form" data-form-api novalidate>
              <div class="campo">
                <label class="campo__rotulo" for="aj-url">URL base</label>
                <div class="entrada-com-botao">
                  <input id="aj-url" name="url" class="entrada" value="${s.apiUrl}" spellcheck="false" autocomplete="off" inputmode="url" placeholder="${API_PADRAO}">
                  <button type="button" class="botao botao--secundario" data-testar>${icone('plug', { tamanho: 16 })}Testar</button>
                </div>
                <p class="resultado-teste" data-resultado aria-live="polite"></p>
              </div>
              <div class="acoes-linha">
                <button type="submit" class="botao botao--primario">Salvar endereço</button>
                <a class="botao-texto" href="${urlSwagger(s.apiUrl)}" target="_blank" rel="noopener">Abrir o Swagger${icone('external-link', { tamanho: 14 })}</a>
                <button type="button" class="botao-texto" data-padrao>Usar o padrão</button>
              </div>
            </form>`,
          })}

          ${secao({
            id: 'aj-tema',
            titulo: 'Aparência',
            texto: 'O tema do sistema acompanha o modo claro ou escuro do aparelho.',
            corpo: html`<div class="segmentos" role="radiogroup" aria-labelledby="aj-tema">
              ${[
                ['sistema', 'Sistema', 'monitor'],
                ['claro', 'Claro', 'sun'],
                ['escuro', 'Escuro', 'moon'],
              ].map(([v, r, i]) => html`<label class="segmento"><input type="radio" name="tema" value="${v}" ${s.tema === v ? 'checked' : ''}><span>${icone(i, { tamanho: 15 })}${r}</span></label>`)}
            </div>`,
          })}

          ${secao({
            id: 'aj-instalar',
            titulo: 'No celular',
            texto: 'O Pauta pode ficar na tela inicial como um app, abrindo em tela cheia e funcionando sem internet no modo demonstração.',
            corpo: instalado()
              ? html`<p class="ajuste__ok">${icone('circle-check', { tamanho: 18 })}Instalado neste aparelho.</p>`
              : window.__pedidoInstalar
                ? html`<button type="button" class="botao botao--primario" data-instalar>${icone('download', { tamanho: 16 })}Instalar o Pauta</button>`
                : html`<p>${ehIphone() ? 'No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".' : 'No Chrome do celular, abra o menu (⋮) e toque em "Instalar app" ou "Adicionar à tela inicial".'}</p>
                    <p class="campo__ajuda">Para abrir no celular, use o endereço do Live Server com o IP do computador na mesma rede Wi-Fi.</p>`,
          })}

          ${secao({
            id: 'aj-dados',
            titulo: 'Dados',
            texto: s.sincronizadoEm ? `Última sincronização: ${dataHora(s.sincronizadoEm)}. ${plural(s.tarefas.length, 'item', 'itens')} no total.` : 'Ainda não sincronizado.',
            corpo: html`<div class="acoes-linha">
              <button type="button" class="botao botao--secundario" data-sincronizar-agora>${icone('refresh-cw', { tamanho: 16 })}Sincronizar agora</button>
              ${s.fonte === 'demo' ? html`<button type="button" class="botao botao--fantasma" data-restaurar>${icone('undo-2', { tamanho: 16 })}Recomeçar a demonstração</button>` : ''}
            </div>`,
          })}

          ${secao({ id: 'aj-atalhos', titulo: 'Atalhos de teclado', texto: 'No Mac, use Cmd no lugar de Ctrl.', corpo: listaAtalhos() })}

          <p class="rodape-versao">${APP.nome} · ${APP.descricao}</p>
        </div>`
      );
    };

    raiz.addEventListener('change', (e) => {
      if (e.target.name === 'fonte') {
        definirFonte(e.target.value);
        toast(e.target.value === 'demo' ? 'Modo demonstração ligado' : 'Conectando à API', { tipo: 'info' });
      }
      if (e.target.name === 'tema') definirTema(e.target.value);
    });

    raiz.addEventListener('submit', (e) => {
      if (!e.target.matches('[data-form-api]')) return;
      e.preventDefault();
      const url = e.target.url.value.trim();
      if (!/^https?:\/\/.+/i.test(url)) {
        raiz.querySelector('[data-resultado]').textContent = 'Use um endereço completo, começando com https:// ou http://';
        return;
      }
      definirApiUrl(url);
      toast('Endereço salvo', { tipo: 'sucesso' });
    });

    raiz.addEventListener('click', async (e) => {
      if (e.target.closest('[data-editar-perfil]')) abrirFormPerfil({ perfil: perfilAtual() });
      if (e.target.closest('[data-novo-perfil]')) abrirFormPerfil();
      const usar = e.target.closest('[data-usar-perfil]');
      if (usar) {
        definirPerfil(Number(usar.dataset.usarPerfil));
        toast('Perfil trocado', { tipo: 'sucesso' });
      }
      if (e.target.closest('[data-testar]')) {
        const saida = raiz.querySelector('[data-resultado]');
        const url = raiz.querySelector('#aj-url').value;
        saida.className = 'resultado-teste';
        saida.textContent = 'Testando…';
        const inicio = performance.now();
        try {
          await testarConexao(url);
          saida.classList.add('ok');
          saida.textContent = `Conectado. A API respondeu em ${Math.round(performance.now() - inicio)} ms.`;
        } catch (erro) {
          saida.classList.add('falhou');
          saida.textContent = `${erro.message} Confira se a API está rodando e se o CORS está liberado.`;
        }
      }
      if (e.target.closest('[data-padrao]')) raiz.querySelector('#aj-url').value = API_PADRAO;
      if (e.target.closest('[data-sincronizar-agora]')) {
        await carregarTudo();
        toast('Dados sincronizados', { tipo: 'sucesso' });
      }
      if (e.target.closest('[data-instalar]') && window.__pedidoInstalar) {
        window.__pedidoInstalar.prompt();
        await window.__pedidoInstalar.userChoice.catch(() => {});
        window.__pedidoInstalar = null;
        desenhar(store.get());
      }
      if (e.target.closest('[data-restaurar]')) {
        const ok = await confirmar({
          titulo: 'Recomeçar a demonstração?',
          mensagem: html`<p>A rotina de exemplo volta ao começo. O que você mudou nela some. Os dados da API não são afetados.</p>`,
          confirmar: 'Recomeçar',
          perigo: true,
        });
        if (ok) {
          await reiniciarDemonstracao();
          toast('Demonstração reiniciada', { tipo: 'sucesso' });
        }
      }
    });
    const aoInstalavel = () => desenhar(store.get());
    document.addEventListener('pauta:instalavel', aoInstalavel);

    desenhar(estado);
    let assinatura = '';
    const assinar = (s) => `${s.fonte}|${s.apiUrl}|${s.tema}|${s.perfilId}|${s.usuarios.map((u) => u.id + u.nome + u.email + u.telefone).join()}|${s.sincronizadoEm}`;
    assinatura = assinar(estado);
    return {
      atualizar(s) {
        // só redesenha se algo desta tela mudou (não apaga o que a pessoa está digitando)
        const nova = assinar(s);
        if (nova !== assinatura) {
          assinatura = nova;
          desenhar(s);
        }
      },
      destruir() {
        document.removeEventListener('pauta:instalavel', aoInstalavel);
      },
    };
  },
};
