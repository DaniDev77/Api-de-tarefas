# Pauta — frontend da API de Tarefas

Interface web para a API ASP.NET Core do projeto (`Usuario`, `Categoria` e `Tarefa`).
Feita só com HTML, CSS e JavaScript (módulos ES), **sem build e sem dependências**: abre no VS Code e roda.

- **Painel**: régua dos próximos 14 dias, resumo, pauta do dia e indicadores
- **Quadro**: Kanban com arrastar e soltar (mouse e toque) e atalhos de teclado
- **Lista**: tabela com ordenação, filtros e troca rápida de status
- **Equipe** e **Categorias**: cadastro completo, carga de trabalho e exclusão segura
- **Configurações**: endereço da API, teste de conexão, tema claro/escuro e modo demonstração

---

## Como rodar

### 1. Prepare a API (uma vez só)

O `Program.cs` precisa liberar o **CORS**, senão o navegador bloqueia as chamadas do frontend.
Também é preciso aceitar descrição e telefone vazios. O trecho já foi aplicado neste repositório:

```csharp
// antes do builder.Build()
var origensFrontend = builder.Configuration.GetSection("Frontend:Origens").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        if (builder.Environment.IsDevelopment())
            policy.AllowAnyOrigin();
        else
            policy.WithOrigins(origensFrontend);

        policy.AllowAnyHeader().AllowAnyMethod();
    });
});

builder.Services.AddControllers(options =>
    {
        options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
    })
    .AddJsonOptions(/* ... como já estava ... */);

// depois do app.UseHttpsRedirection()
app.UseCors("Frontend");
```

E no `appsettings.json` (usado fora do modo Development):

```json
"Frontend": {
  "Origens": [ "http://127.0.0.1:5500", "http://localhost:5500" ]
}
```

### 2. Rode a API

No Visual Studio, abra `projeto.slnx`, escolha o perfil **https** e aperte **F5**.
O Swagger abre em `https://localhost:7187/swagger`. Deixe a API rodando.

> Na primeira vez, abra esse endereço no **mesmo navegador** que vai usar o frontend e aceite o aviso de certificado, se aparecer.
> Se preferir confiar no certificado de vez: `dotnet dev-certs https --trust`.

### 3. Abra o frontend no VS Code

1. `Arquivo > Abrir Pasta…` e escolha a pasta **web**
2. O VS Code sugere a extensão **Live Server** (recomendada em `.vscode/extensions.json`). Instale.
3. Clique em **Go Live** na barra inferior (ou botão direito em `index.html` > **Open with Live Server**)
4. O navegador abre em `http://127.0.0.1:5500`

> Abrir o `index.html` com dois cliques não funciona: navegadores não carregam módulos JavaScript a partir de `file://`. A página avisa isso se acontecer.

### Sem a API ligada?

Use o **modo demonstração** (na tela de erro de conexão ou em Configurações). Ele carrega uma equipe de exemplo,
com tarefas espalhadas pelos próximos dias, e guarda tudo no navegador. Bom para apresentar o sistema.

Para mostrar a um cliente, abra direto `http://127.0.0.1:5500/index.html?demo`: o `?demo` liga a demonstração sem mexer nas suas configurações.

---

## Estrutura

```
web/
├── index.html              estrutura da página (lateral, topo, área de conteúdo)
├── assets/
│   ├── favicon.svg
│   └── fonts/              Bricolage Grotesque e Hanken Grotesk (embutidas, funcionam offline)
├── css/
│   ├── app.css             ponto de entrada; define a ordem das camadas (@layer)
│   ├── tokens.css          cores, tipografia, espaçamentos, temas claro e escuro
│   ├── base.css            reset e elementos básicos
│   ├── componentes.css     botões, campos, selos, modal, menu, notificações, paleta
│   ├── layout.css          lateral, topo, gaveta no celular
│   └── telas.css           estilos de cada tela
└── js/
    ├── app.js              inicialização: rotas, atalhos, tema, sincronização
    ├── config.js           nome do produto, endereço padrão da API
    ├── state.js            estado global e ações (criar, mover, excluir…)
    ├── core/               utilitários sem regra de negócio
    │   ├── html.js         template seguro (escapa tudo: protege contra XSS) + morph (atualiza só o que mudou)
    │   ├── animar.js       animação FLIP: cartões deslizam até o novo lugar
    │   ├── store.js        store reativo (padrão observer)
    │   ├── router.js       rotas por hash: #/quadro?pessoa=2
    │   ├── format.js       datas, telefone, textos em pt-BR
    │   └── storage.js      localStorage com proteção a erros
    ├── data/
    │   ├── http.js         fetch com timeout e erros traduzidos
    │   ├── api.js          fonte real: conversa com os Controllers
    │   └── demo.js         fonte de demonstração (mesma interface da API)
    ├── domain/
    │   ├── enums.js        espelho dos enums StatusTarefa e PrioriedadeTarefa
    │   └── selectors.js    filtros, ordenação, contagens (funções puras)
    ├── ui/                 componentes: ícones, modal, menu, toast, dica, paleta, arrastar
    ├── forms/              formulários de tarefa, pessoa e categoria
    └── views/              uma tela por arquivo
```

## Como funciona por dentro

- **Redesenho cirúrgico (morph)**: as telas geram o HTML inteiro, mas `morph()` compara com o que já está na tela
  e mexe só no que mudou. Cada item tem um `data-key` (ex.: `t12` para a tarefa 12), então mover um cartão
  altera **1 elemento** em vez de recriar os 24 do quadro. Foco, rolagem e texto digitado são preservados.
- **Animação FLIP**: antes de redesenhar, a posição de cada cartão é medida; depois, ele desliza do lugar antigo
  para o novo. Entre colunas, uma cópia "voa" por cima da tela. Tudo desligado com "reduzir movimento".
- **Camadas**: as telas (`views`) só leem o estado e chamam ações de `state.js`. Só a camada `data` fala com a API.
  Trocar a API pelo modo demonstração é trocar a "fonte", sem mexer em nenhuma tela.
- **Atualização otimista**: ao mover um cartão, a tela muda na hora e a API é chamada em seguida.
  Se a API recusar, o cartão volta e aparece o motivo.
- **Excluir com desfazer**: a tarefa some na hora e só é apagada na API depois de 6 segundos.
  Se a página for fechada antes, a exclusão é enviada imediatamente.
- **Exclusão em cascata**: o banco apaga as tarefas de uma pessoa ou categoria excluída (`ON DELETE CASCADE`).
  A tela avisa quantas tarefas serão perdidas antes de confirmar.
- **Erros da API traduzidos**: validação (400) aparece no campo certo do formulário; exceções (500) viram uma mensagem clara.
- **Filtros na URL**: dá para favoritar ou compartilhar `#/quadro?pessoa=2&atrasadas=1`.
- **Sincronização**: ao voltar para a aba depois de 45 segundos, os dados são recarregados sozinhos.
- **Acessibilidade**: navegação completa por teclado, foco visível, `aria-live` nas notificações, `<dialog>` nativo nos modais,
  cores validadas para daltonismo e sempre acompanhadas de ícone e texto, respeito a "reduzir movimento".
  Auditado com **axe-core (WCAG 2.2 AA)** em todas as telas e estados (modais, menus, paleta), nos dois temas: **0 violações**.
  Todo alvo de clique tem pelo menos 24 × 24px.

## Do jeito que se usa

- **Adição rápida**: o `+` no topo de cada coluna abre um campo ali mesmo. Digite o título e `Enter` cria;
  o campo continua aberto para a próxima. Pessoa e categoria vêm do filtro ativo ou da última usada; prazo amanhã às 18h.
- **Detalhes em painel lateral**: clicar num cartão abre a tarefa num painel à direita, com o quadro ainda visível.
  Título editável no topo, propriedades em linhas (status, prioridade, prazo, responsável, categoria) e descrição.
  No celular, vira uma folha que sobe de baixo.
- **Concluir pelo painel**: o item é riscado antes de sair da pauta, para dar tempo de ver o que aconteceu.
- **Cabeçalho fixo na lista**: em telas grandes, os títulos das colunas acompanham a rolagem.

## Atalhos de teclado

| Tecla | Ação |
|---|---|
| `Ctrl K` | Buscar tarefas, pessoas e ações |
| `N` | Nova tarefa |
| `Enter` / `Esc` | Na adição rápida: criar / fechar |
| `/` | Focar a busca do quadro ou da lista |
| `G` depois `P` `Q` `L` `E` `C` | Ir para Painel, Quadro, Lista, Equipe, Categorias |
| `Alt ←` `Alt →` | Mover o cartão focado entre colunas |
| `Delete` | Excluir o cartão focado (com desfazer) |
| `Ctrl Enter` | Salvar o formulário aberto |
| `?` | Mostrar os atalhos |

## Design

O visual segue a skill **taste-skill** (`design-taste-frontend`), no fluxo de telas de app, com o estilo
**editorial-greeting** (seed 1078017390) e a paleta e as fontes da marca mantidas:

- **Moldura em L**: lateral e topo no mesmo papel azulado; o conteúdo numa folha branca com a linha vermelha de margem à esquerda
- **Painel em grade de 12 colunas** (12 × 77px + 11 × 16px = 1100px), linhas 12 · 3/3/3/3 · 9/3 · 6/6, todas as bordas alinhadas
- **A saudação é o título** e já diz o fato do dia ("Boa tarde, Estúdio Tramela. 3 tarefas estão atrasadas.")
- **Cor só nos dados**: o azul de caneta marca a régua de prazos e a ação principal; o vermelho só o que venceu ou exclui
- **Sem enfeites**: nada de gradientes, desfoques ou sombras em elementos parados; números em peso regular, alinhados
- Medido com o inspetor da skill: **0 falhas e 0 avisos** em todas as telas, a 1440, 768 e 390px

## Personalizar para um cliente

- **Nome da equipe**: em Configurações > Nome da equipe (aparece na lateral e na saudação)
- **Nome do produto**: `js/config.js` (`APP.nome`)
- **Cores**: `css/tokens.css`. A cor de ação é `--caneta`; a de alerta é `--margem`. O tema escuro tem os próprios valores logo abaixo.
- **Logo**: função `marca()` em `js/ui/icons.js` e o arquivo `assets/favicon.svg`
- **Endereço da API em produção**: `API_PADRAO` em `js/config.js`

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| "A API não respondeu" | API desligada | Rode a API no Visual Studio (F5) |
| Funciona no Swagger, mas não no site | Certificado HTTPS não aceito neste navegador | Abra `https://localhost:7187/swagger` e aceite o aviso |
| Erro de CORS no console (F12) | Falta `app.UseCors("Frontend")` | Veja o passo 1 |
| "A API ainda trata Descrição e Telefone como obrigatórios" | Falta o ajuste no `AddControllers` | Veja o passo 1 |
| Porta diferente de 7187 | Outro `launchSettings.json` | Ajuste em Configurações > Endereço da API |
| Tela em branco abrindo o arquivo direto | Módulos não carregam em `file://` | Use o Live Server |

## Próximos passos sugeridos

- Login com JWT (ASP.NET Core Identity) e tarefas por usuário logado
- Endpoint `PATCH /api/Tarefa/{id}/status` para mover cartões enviando só o status
- Paginação e filtros no backend quando houver milhares de tarefas
- Devolver `404` em vez de `500` quando o registro não existe (`Atualizar`/`Apagar` nos repositórios)

## Créditos

- Fontes [Bricolage Grotesque](https://github.com/ateliertriay/bricolage) e [Hanken Grotesk](https://github.com/marcologous/hanken-grotesk), licença SIL Open Font License 1.1 (arquivos em `assets/fonts`)
- Ícones [Lucide](https://lucide.dev), licença ISC
