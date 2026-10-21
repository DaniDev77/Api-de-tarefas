// Tela mostrada quando a API não responde: explica o que conferir, na ordem, e oferece saídas.
import { html, render } from '../core/html.js';
import { icone } from '../ui/icons.js';
import { carregarTudo, definirFonte } from '../state.js';
import { navegar } from '../core/router.js';
import { urlSwagger } from './ajustes.js';

export function desenharConexao(raiz, estado) {
  const { erro, apiUrl } = estado;
  const swagger = urlSwagger(apiUrl);
  render(
    raiz,
    html`<div class="tela tela--conexao">
      <div class="conexao">
        <span class="conexao__icone">${icone('wifi-off', { tamanho: 28 })}</span>
        <h1 class="conexao__titulo">A API não respondeu</h1>
        <p class="conexao__texto">${erro?.message ?? 'Não foi possível conectar à API.'} O endereço configurado é <code>${apiUrl}</code>.</p>

        <ol class="conexao__passos">
          <li>
            <strong>Inicie a API.</strong>
            <span>No Visual Studio, abra a solução <code>projeto.slnx</code> e aperte F5. Espere o Swagger abrir.</span>
          </li>
          <li>
            <strong>Aceite o certificado HTTPS.</strong>
            <span>Abra <a href="${swagger}" target="_blank" rel="noopener">${swagger}</a> neste navegador. Se aparecer um aviso de segurança, aceite e volte aqui.</span>
          </li>
          <li>
            <strong>Libere o CORS no Program.cs.</strong>
            <span>Sem ele o navegador bloqueia as chamadas. O trecho está no README do projeto web.</span>
          </li>
          <li>
            <strong>Confira a porta.</strong>
            <span>Ela precisa ser a mesma do <code>launchSettings.json</code>. Você pode mudar em Ajustes.</span>
          </li>
        </ol>

        <div class="conexao__acoes">
          <button type="button" class="botao botao--primario" data-tentar>${icone('refresh-cw', { tamanho: 16 })}Tentar de novo</button>
          <button type="button" class="botao botao--fantasma" data-demo>${icone('database', { tamanho: 16 })}Usar dados de demonstração</button>
          <button type="button" class="botao-texto" data-config>Alterar endereço</button>
        </div>
      </div>
    </div>`
  );

  raiz.querySelector('[data-tentar]').addEventListener('click', () => carregarTudo());
  raiz.querySelector('[data-demo]').addEventListener('click', () => definirFonte('demo'));
  raiz.querySelector('[data-config]').addEventListener('click', () => {
    navegar('ajustes');
  });
}
