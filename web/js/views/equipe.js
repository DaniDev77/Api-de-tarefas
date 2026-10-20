// Equipe: as pessoas (UsuarioModel), com carga de trabalho e atalhos de contato.
import { html, raw, render, morph } from '../core/html.js';
import { normalizar, plural, somenteDigitos, porcentagem } from '../core/format.js';
import { estatisticasPor } from '../domain/selectors.js';
import { icone } from '../ui/icons.js';
import { avatar, vazio, tituloTela } from '../ui/pecas.js';
import { abrirMenu } from '../ui/menu.js';
import { confirmar } from '../ui/modal.js';
import { pessoas as acoesPessoas } from '../state.js';
import { abrirFormPessoa } from '../forms/pessoa-form.js';

function linkWhatsApp(telefone) {
  const d = somenteDigitos(telefone);
  return d.length >= 10 ? `https://wa.me/55${d}` : '';
}

function cartaoPessoa(u, tarefas) {
  const e = estatisticasPor('usuarioId', u.id, tarefas);
  const validas = e.total - e.canceladas;
  const whats = linkWhatsApp(u.telefone);
  return html`<li class="registro" data-id="${u.id}" data-key="u${u.id}">
    ${avatar(u, { tamanho: 'g', dica: false })}
    <div class="registro__principal">
      <h2 class="registro__titulo">${u.nome}</h2>
      <p class="registro__contatos">
        <a href="mailto:${u.email}">${raw(icone('mail', { tamanho: 14 }))}${u.email}</a>
        ${u.telefone ? html`<a href="tel:+55${somenteDigitos(u.telefone)}">${raw(icone('phone', { tamanho: 14 }))}${u.telefone}</a>` : ''}
        ${whats ? html`<a href="${whats}" target="_blank" rel="noopener noreferrer" aria-label="Conversar com ${u.nome} no WhatsApp">${raw(icone('message-circle', { tamanho: 14 }))}WhatsApp</a>` : ''}
      </p>
    </div>
    <dl class="registro__numeros">
      <div><dt>Abertas</dt><dd>${e.abertas}</dd></div>
      <div class="${e.atrasadas ? 'alerta' : ''}"><dt>Atrasadas</dt><dd>${e.atrasadas}</dd></div>
      <div><dt>Concluídas</dt><dd>${e.concluidas}</dd></div>
    </dl>
    <div class="registro__progresso" data-dica="${e.concluidas} de ${validas} concluídas">
      <span class="medidor__trilho"><span class="medidor__barra" style="--v:${validas ? e.concluidas / validas : 0}"></span></span>
      <span class="registro__pct">${porcentagem(e.concluidas, validas)}%</span>
    </div>
    <div class="registro__acoes">
      <a class="botao botao--fantasma botao--p" href="#/quadro?pessoa=${u.id}">Ver tarefas</a>
      <button type="button" class="botao-icone" data-menu="${u.id}" aria-label="Ações de ${u.nome}" aria-haspopup="menu">${raw(icone('ellipsis', { tamanho: 18 }))}</button>
    </div>
  </li>`;
}

export default {
  titulo: 'Equipe',
  montar(raiz, { estado }) {
    let termo = '';
    let ultimo = estado;

    render(
      raiz,
      html`<div class="tela tela--registros coluna-central">
        ${tituloTela({ titulo: 'Equipe', acoes: html`<button type="button" class="botao botao--primario" data-nova>${icone('user-plus', { tamanho: 16 })}Nova pessoa</button>` })}
        <div class="barra-filtros barra-filtros--simples">
          <label class="filtro-busca">
            ${icone('search', { tamanho: 16 })}
            <span class="sr-only">Buscar pessoas</span>
            <input type="search" placeholder="Buscar por nome ou e-mail" autocomplete="off" data-busca>
          </label>
        </div>
        <div data-lista></div>
      </div>`
    );
    const lista = raiz.querySelector('[data-lista]');

    const desenhar = (s = ultimo) => {
      ultimo = s;
      const abertas = s.tarefas.filter((t) => t.status === 1 || t.status === 2).length;
      raiz.querySelector('[data-titulo-sub]').textContent = s.usuarios.length
        ? `${plural(s.usuarios.length, 'pessoa', 'pessoas')}, com ${plural(abertas, 'tarefa aberta', 'tarefas abertas')} no total.`
        : '';
      if (!s.usuarios.length) {
        morph(
          lista,
          vazio({
            titulo: 'Ninguém na equipe ainda',
            texto: 'Adicione as pessoas que vão receber tarefas. Nome e e-mail bastam.',
            acao: html`<button type="button" class="botao botao--primario" data-nova>${raw(icone('user-plus', { tamanho: 16 }))}Adicionar pessoa</button>`,
          })
        );
        return;
      }
      const t = normalizar(termo);
      const filtradas = s.usuarios
        .filter((u) => !t || normalizar(`${u.nome} ${u.email}`).includes(t))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      morph(
        lista,
        filtradas.length
          ? html`${t ? html`<p class="contagem-registros">${plural(filtradas.length, 'pessoa encontrada', 'pessoas encontradas')}</p>` : ''}
              <ul class="registros">${filtradas.map((u) => cartaoPessoa(u, s.tarefas))}</ul>`
          : html`<p class="tabela__nada">Ninguém encontrado para “${termo}”.</p>`
      );
    };

    raiz.querySelector('[data-busca]').addEventListener('input', (e) => {
      termo = e.target.value;
      desenhar();
    });

    raiz.addEventListener('click', async (e) => {
      if (e.target.closest('[data-nova]')) {
        abrirFormPessoa();
        return;
      }
      const menu = e.target.closest('[data-menu]');
      if (!menu) return;
      const u = ultimo.usuarios.find((x) => x.id === Number(menu.dataset.menu));
      abrirMenu(menu, [
        { rotulo: 'Editar', icone: 'pencil', acao: () => abrirFormPessoa({ pessoa: u }) },
        { rotulo: 'Copiar e-mail', icone: 'copy', acao: () => navigator.clipboard?.writeText(u.email) },
        { separador: true },
        {
          rotulo: 'Excluir',
          icone: 'trash-2',
          perigo: true,
          acao: async () => {
            const qtd = ultimo.tarefas.filter((t) => t.usuarioId === u.id).length;
            const ok = await confirmar({
              titulo: `Excluir ${u.nome}?`,
              mensagem: qtd
                ? html`<p>${plural(qtd, 'tarefa atribuída', 'tarefas atribuídas')} a essa pessoa também ${qtd === 1 ? 'será excluída' : 'serão excluídas'}. Para manter, reatribua antes de excluir.</p>`
                : html`<p>Essa pessoa não tem tarefas. A exclusão não pode ser desfeita.</p>`,
              confirmar: qtd ? `Excluir pessoa e ${plural(qtd, 'tarefa', 'tarefas')}` : 'Excluir pessoa',
              perigo: true,
            });
            if (ok) acoesPessoas.excluir(u.id).catch(() => {});
          },
        },
      ]);
    });

    desenhar(estado);
    return { atualizar: desenhar };
  },
};
