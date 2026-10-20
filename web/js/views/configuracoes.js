// Configurações: fonte de dados (API ou demonstração), endereço da API, tema e atalhos.
import { html, raw, render } from '../core/html.js';
import { dataHora } from '../core/format.js';
import { icone } from '../ui/icons.js';
import { confirmar } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { definirFonte, definirApiUrl, definirTema, definirEquipe, testarConexao, reiniciarDemonstracao, carregarTudo } from '../state.js';
import { tituloTela } from '../ui/pecas.js';
import { API_PADRAO, APP } from '../config.js';

export const urlSwagger = (apiUrl) => apiUrl.replace(/\/api\/?$/i, '') + '/swagger';

const ATALHOS = [
  ['Ctrl K', 'Buscar e executar comandos'],
  ['N', 'Nova tarefa'],
  ['/', 'Buscar no quadro ou na lista'],
  ['G P', 'Ir para o painel'],
  ['G Q', 'Ir para o quadro'],
  ['G L', 'Ir para a lista'],
  ['G E', 'Ir para a equipe'],
  ['G C', 'Ir para categorias'],
  ['Alt ← →', 'Mover o cartão focado entre colunas'],
  ['Ctrl Enter', 'Salvar o formulário aberto'],
  ['?', 'Mostrar os atalhos'],
];

export function listaAtalhos() {
  return html`<dl class="atalhos">
    ${ATALHOS.map(([teclas, acao]) => html`<div><dt>${teclas.split(' ').map((t) => html`<kbd>${t}</kbd>`)}</dt><dd>${acao}</dd></div>`)}
  </dl>`;
}

export default {
  titulo: 'Configurações',
  montar(raiz, { estado }) {
    const desenhar = (s) => {
      render(
        raiz,
        html`<div class="tela tela--config coluna-central">
          ${tituloTela({ titulo: 'Configurações', sub: s.fonte === 'demo' ? 'Usando os dados de demonstração deste navegador.' : `Conectado a ${s.apiUrl}.` })}
          <section class="config-secao" aria-labelledby="cfg-equipe">
            <div class="config-secao__texto">
              <h2 id="cfg-equipe" class="secao-titulo">Nome da equipe</h2>
              <p>Aparece na lateral e na saudação do painel. Use o nome da empresa, do setor ou do grupo.</p>
            </div>
            <form class="config-secao__controles" data-form-equipe novalidate>
              <div class="campo">
                <label class="campo__rotulo" for="cfg-nome-equipe">Nome</label>
                <div class="entrada-com-botao">
                  <input id="cfg-nome-equipe" name="equipe" class="entrada" maxlength="60" autocomplete="organization" value="${s.equipe}" placeholder="Ex.: Equipe de Projetos">
                  <button type="submit" class="botao botao--secundario">Salvar nome</button>
                </div>
              </div>
            </form>
          </section>

          <section class="config-secao" aria-labelledby="cfg-fonte">
            <div class="config-secao__texto">
              <h2 id="cfg-fonte" class="secao-titulo">De onde vêm os dados</h2>
              <p>Use a API para trabalhar com o banco SQL Server de verdade. O modo demonstração guarda dados de exemplo só neste navegador.</p>
            </div>
            <div class="config-secao__controles">
              <div class="opcoes-cartao" role="radiogroup" aria-labelledby="cfg-fonte">
                <label class="opcao-cartao">
                  <input type="radio" name="fonte" value="api" ${s.fonte === 'api' ? 'checked' : ''}>
                  <span class="opcao-cartao__icone">${raw(icone('server', { tamanho: 20 }))}</span>
                  <span><strong>API ASP.NET</strong><small>Dados salvos no SQL Server</small></span>
                </label>
                <label class="opcao-cartao">
                  <input type="radio" name="fonte" value="demo" ${s.fonte === 'demo' ? 'checked' : ''}>
                  <span class="opcao-cartao__icone">${raw(icone('database', { tamanho: 20 }))}</span>
                  <span><strong>Demonstração</strong><small>Dados de exemplo neste navegador</small></span>
                </label>
              </div>
            </div>
          </section>

          <section class="config-secao" aria-labelledby="cfg-api">
            <div class="config-secao__texto">
              <h2 id="cfg-api" class="secao-titulo">Endereço da API</h2>
              <p>Copie do <code>launchSettings.json</code> (perfil https) e acrescente <code>/api</code>.</p>
            </div>
            <form class="config-secao__controles" data-form-api novalidate>
              <div class="campo">
                <label class="campo__rotulo" for="cfg-url">URL base</label>
                <div class="entrada-com-botao">
                  <input id="cfg-url" name="url" class="entrada" value="${s.apiUrl}" spellcheck="false" autocomplete="off" inputmode="url" placeholder="${API_PADRAO}">
                  <button type="button" class="botao botao--fantasma" data-testar>${raw(icone('plug', { tamanho: 16 }))}Testar</button>
                </div>
                <p class="resultado-teste" data-resultado aria-live="polite"></p>
              </div>
              <div class="acoes-linha">
                <button type="submit" class="botao botao--secundario">Salvar endereço</button>
                <a class="botao-texto" href="${urlSwagger(s.apiUrl)}" target="_blank" rel="noopener">Abrir Swagger${raw(icone('external-link', { tamanho: 14 }))}</a>
                <button type="button" class="botao-texto" data-padrao>Usar o padrão</button>
              </div>
            </form>
          </section>

          <section class="config-secao" aria-labelledby="cfg-tema">
            <div class="config-secao__texto">
              <h2 id="cfg-tema" class="secao-titulo">Aparência</h2>
              <p>O tema do sistema acompanha o modo claro ou escuro do seu computador.</p>
            </div>
            <div class="config-secao__controles">
              <div class="segmentos segmentos--compacto" role="radiogroup" aria-labelledby="cfg-tema">
                ${[
                  ['sistema', 'Sistema', 'monitor'],
                  ['claro', 'Claro', 'sun'],
                  ['escuro', 'Escuro', 'moon'],
                ].map(
                  ([v, r, i]) => html`<label class="segmento"><input type="radio" name="tema" value="${v}" ${s.tema === v ? 'checked' : ''}><span>${raw(icone(i, { tamanho: 15 }))}${r}</span></label>`
                )}
              </div>
            </div>
          </section>

          <section class="config-secao" aria-labelledby="cfg-dados">
            <div class="config-secao__texto">
              <h2 id="cfg-dados" class="secao-titulo">Dados</h2>
              <p>${s.sincronizadoEm ? `Última sincronização: ${dataHora(s.sincronizadoEm)}.` : 'Ainda não sincronizado.'}</p>
            </div>
            <div class="config-secao__controles acoes-linha">
              <button type="button" class="botao botao--fantasma" data-sincronizar>${raw(icone('refresh-cw', { tamanho: 16 }))}Sincronizar agora</button>
              <button type="button" class="botao botao--fantasma" data-restaurar>${raw(icone('undo-2', { tamanho: 16 }))}Restaurar dados de exemplo</button>
            </div>
          </section>

          <section class="config-secao" aria-labelledby="cfg-atalhos">
            <div class="config-secao__texto">
              <h2 id="cfg-atalhos" class="secao-titulo">Atalhos de teclado</h2>
              <p>No Mac, use Cmd no lugar de Ctrl.</p>
            </div>
            <div class="config-secao__controles">${listaAtalhos()}</div>
          </section>

          <p class="rodape-versao">${APP.nome} 1.0</p>
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
      if (e.target.matches('[data-form-equipe]')) {
        e.preventDefault();
        definirEquipe(e.target.equipe.value);
        toast('Nome da equipe salvo', { tipo: 'sucesso' });
        return;
      }
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
      if (e.target.closest('[data-testar]')) {
        const saida = raiz.querySelector('[data-resultado]');
        const url = raiz.querySelector('#cfg-url').value;
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
      if (e.target.closest('[data-padrao]')) {
        raiz.querySelector('#cfg-url').value = API_PADRAO;
      }
      if (e.target.closest('[data-sincronizar]')) {
        await carregarTudo();
        toast('Dados sincronizados', { tipo: 'sucesso' });
      }
      if (e.target.closest('[data-restaurar]')) {
        const ok = await confirmar({
          titulo: 'Restaurar os dados de exemplo?',
          mensagem: html`<p>Tudo o que você criou no modo demonstração será trocado pelos exemplos originais. Os dados da API não são afetados.</p>`,
          confirmar: 'Restaurar exemplos',
          perigo: true,
        });
        if (ok) {
          await reiniciarDemonstracao();
          toast('Dados de exemplo restaurados', { tipo: 'sucesso' });
        }
      }
    });

    desenhar(estado);
    let assinatura = `${estado.fonte}|${estado.apiUrl}|${estado.tema}|${estado.equipe}`;
    return {
      atualizar(s) {
        // só redesenha se algo desta tela mudou (não apaga o que a pessoa está digitando)
        const nova = `${s.fonte}|${s.apiUrl}|${s.tema}|${s.equipe}`;
        if (nova !== assinatura) {
          assinatura = nova;
          desenhar(s);
        }
      },
    };
  },
};

