# Pauta: sua rotina, um dia de cada vez

Frontend de rotina pessoal para a API ASP.NET Core do projeto (`Usuario`, `Categoria` e `Tarefa`):
beber água, academia, estudos, acordar, dormir, o que fizer parte do dia.
Feito só com HTML, CSS e JavaScript (módulos ES), **sem build e sem dependências**: abre no VS Code e roda.
A API **não foi alterada**: a rotina é montada em cima das Tarefas que já existem.

- **Hoje**: a pauta do dia por manhã, tarde e noite; segure o botão para marcar; o Ritmo do dia mostra cada item no seu horário
- **Progresso**: constância de 30 dias, mapa de 17 semanas, sequências, períodos do dia, dias da semana e áreas
- **Rotina**: os hábitos por área, até quando estão na pauta, estender, editar e encerrar
- **Foco**: cronômetro para estudar, ler ou treinar, ligado ao status "Em andamento" da API
- **Ajustes**: perfil, endereço da API, tema, instalar no celular e modo demonstração

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

Use o **modo demonstração** (na tela de erro de conexão ou em Ajustes). Ele carrega a rotina de uma pessoa de exemplo,
com 17 semanas de histórico, e guarda tudo no navegador. Bom para apresentar o sistema.

Para mostrar a um cliente, abra direto `http://127.0.0.1:5500/index.html?demo`: o `?demo` liga a demonstração sem mexer nas suas configurações.

---

## Como a rotina usa a API (sem mudar nada nela)

| Na rotina | Na API | Como |
|---|---|---|
| Perfil (quem usa) | `Usuario` | Cada perfil tem a sua rotina. E-mail e telefone são opcionais. |
| Área (Saúde, Treino…) | `Categoria` | O tom de cada área vem do ID e não muda. |
| Item da pauta de um dia | `Tarefa` | `DataLimite` = dia + horário. |
| Hábito | várias `Tarefa` | Mesmo perfil, mesmo título e mesma área. Ao criar "Academia, seg/qua/sex, 18:30", o app cria as tarefas das próximas 4 semanas. |
| Água 4x ao dia | 4 `Tarefa` por dia | Uma por horário; a tela mostra "2 de 4". |
| Feito / Pulado | `Status` 3 / 4 | Pulado (Cancelada) não conta como falha nem como feito. |
| Foco rodando | `Status` 2 | O item fica "Em andamento" enquanto o cronômetro roda. |

- **Estender**: cria mais 4 semanas no mesmo padrão de dias e horários (a tela Rotina avisa quando um hábito está acabando).
- **Editar os próximos**: muda nome, área e nota dos itens futuros em aberto; mudar os dias refaz os próximos itens. O histórico nunca é alterado.
- **Encerrar**: apaga os itens futuros em aberto e mantém o histórico no Progresso.
- **Sequência**: dias (ou vezes, para hábitos que não são diários) seguidos com tudo feito. Dia pulado não quebra a sequência.
- **Constância**: feitos ÷ (feitos + não marcados), sem contar os pulados.

## Escreva como fala

O campo "Adicionar à pauta" entende frases e mostra a leitura antes de salvar:

| Frase | Vira |
|---|---|
| `academia 18h30 seg qua sex` | hábito: seg, qua e sex às 18:30, por 4 semanas |
| `beber água 4x ao dia` | hábito: todo dia às 09:00, 12:00, 15:00 e 18:00 |
| `acordar 6h30 dias úteis` | hábito: dias úteis às 06:30 |
| `lavar roupa toda terça e quinta às 19h por 2 semanas` | hábito por 2 semanas |
| `dentista amanhã 14h #saúde` | item avulso amanhã às 14:00, na área Saúde |
| `pagar a conta de luz 25/10` | item avulso no dia 25 |

A área é adivinhada pelo título (água → Saúde, academia → Treino, estudar → Estudos…) e pode ser trocada na leitura.

## Interações

- **Segure para marcar**: o anel enche em meio segundo e o item é marcado (com vibração no celular). Um toque curto só mostra a dica, então não dá para marcar sem querer rolando a tela. No teclado, Enter marca na hora. Toda marcação tem "Desfazer".
- **Ritmo do dia**: cada item é um ponto no seu horário; a linha verde é o agora. Clique num ponto para ir ao item.
- **Agora**: o que fazer neste momento (o que ficou para trás, o próximo, ou "dia completo"), com Fiz, Pular hoje e Adiar 1 h.
- **Semana**: anéis mostram quanto de cada dia foi feito; ← → trocam o dia.
- **Foco**: guarda a hora de término, então recarregar a página não perde o tempo; mantém a tela acesa e pode avisar quando terminar.
- **Instalável**: no celular, "Adicionar à tela inicial" abre o Pauta em tela cheia (manifest + service worker).



## Estrutura

```
web/
├── index.html              estrutura da página (lateral, barra do celular, abas, conteúdo)
├── manifest.webmanifest    app instalável (nome, ícones, cores)
├── sw.js                   service worker: abre sem internet (rede primeiro; a API nunca passa pelo cache)
├── assets/                 ícones, favicon e fontes Instrument Sans e Instrument Serif (embutidas)
├── css/
│   ├── app.css             ponto de entrada; define a ordem das camadas (@layer)
│   ├── tokens.css          cores, tipografia, espaçamentos, temas claro e escuro, tons das áreas
│   ├── base.css            reset e elementos básicos
│   ├── componentes.css     botões, campos, chips, painéis, diálogos, menu, notificações, paleta
│   ├── layout.css          lateral no computador; barra e abas no celular
│   └── telas.css           Hoje, Progresso, Rotina, Foco, Ajustes, boas-vindas
└── js/
    ├── app.js              inicialização: rotas, atalhos, tema, sincronização, PWA
    ├── config.js           nome do produto, endereço da API, semanas por hábito
    ├── state.js            estado global e ações (marcar, criar hábito em série, estender, encerrar, foco)
    ├── core/               html seguro + morph, store, rotas, datas, armazenamento
    ├── data/               http (erros traduzidos), api (Controllers) e demo (mesma interface)
    ├── domain/
    │   ├── enums.js        espelho de StatusTarefa e PrioriedadeTarefa + tons das áreas
    │   ├── rotina.js       hábitos, sequências, constância, períodos, datas em série (funções puras)
    │   └── frase.js        leitura das frases da adição rápida
    ├── ui/                 ícones, diálogo, menu, notificação, dica, paleta, "segure para marcar"
    ├── forms/              detalhes do item, hábito, área e perfil
    ├── vendor/charts.js    gráficos em SVG (da taste-skill)
    └── views/              hoje, adicao, boas-vindas, progresso, rotina, foco, ajustes, conexao
```

## Como funciona por dentro

- **Camadas**: as telas só leem o estado e chamam ações de `state.js`. Só a camada `data` fala com a API.
  Trocar a API pelo modo demonstração é trocar a "fonte", sem mexer em nenhuma tela.
- **Regras puras**: hábitos, sequências, constância e a leitura de frases ficam em `domain/`, sem DOM e sem API.
  Os testes rodam no terminal, sem navegador: `node testes/rotina.test.mjs` (dentro da pasta web).
- **Redesenho cirúrgico (morph)**: as telas geram o HTML inteiro e `morph()` mexe só no que mudou (cada item tem um `data-key`).
  Foco, rolagem e texto digitado são preservados.
- **Em lote, com limite**: criar um hábito de 4 semanas manda dezenas de POST, no máximo 4 ao mesmo tempo, com o progresso numa notificação.
- **Atualização otimista**: marcar muda a tela na hora; se a API recusar, volta e aparece o motivo.
- **Remover com desfazer**: o item some na hora e só é apagado na API depois de 6 segundos.
- **Exclusão em cascata**: excluir um perfil ou uma área apaga as tarefas ligadas (`ON DELETE CASCADE`). A tela avisa quantas antes.
- **Erros da API traduzidos**: validação (400) aparece no campo certo; exceções (500) viram uma mensagem clara.
- **Sincronização**: ao voltar para a aba depois de 45 segundos, os dados são recarregados. O "agora" anda sozinho a cada minuto.
- **Acessibilidade**: navegação completa por teclado, foco visível, `aria-live` nas notificações, `<dialog>` nativo,
  a cor sempre acompanhada de texto, respeito a "reduzir movimento".
  Auditado com **axe-core (WCAG 2.2 AA)** em todas as telas e estados, nos dois temas e no celular: **0 violações**.

## Atalhos de teclado

| Tecla | Ação |
|---|---|
| `Ctrl K` | Buscar hábitos, itens e ações (dá para marcar um item de hoje direto daqui) |
| `N` | Escrever um item novo |
| `←` `→` | Dia anterior e próximo |
| `T` | Voltar para hoje |
| `G` depois `H` `P` `R` `F` | Ir para Hoje, Progresso, Rotina, Foco |
| `Enter` | No botão redondo: marcar o item |
| `Ctrl Enter` | Salvar o formulário aberto |
| `?` | Mostrar os atalhos |

## Design

O visual segue a skill **taste-skill** (`design-taste-frontend`), fluxo de telas de app, estilo
**editorial-greeting** (seed 1875304898), no clima calmo e editorial:

- **A saudação é o título** e diz o fato do dia, em Instrument Serif ("Bom dia, Marina. Faltam 7 itens hoje.")
- **A pauta é uma folha pautada**: o horário fica na margem, cada item numa linha
- **Cor só nos hábitos**: cada área tem um tom (identidade); o verde-petróleo marca o dia (o agora, os anéis, o mapa)
- **Sem enfeites**: nada de gradientes, desfoques ou sombras em elementos parados; números em peso regular, alinhados
- **Grade de 12 colunas** (12 × 77px + 11 × 16px = 1100px)
- Medido com o inspetor da skill: 0 falhas em todas as telas, a 1440, 768 e 390px. O único aviso é a saudação de 48px, que é o movimento do próprio estilo.

## Personalizar

- **Nome do produto**: `js/config.js` (`APP.nome`)
- **Semanas por hábito novo**: `SEMANAS_PADRAO` em `js/config.js`
- **Cores**: `css/tokens.css` (`--acento` e os tons `--tom-0` a `--tom-7`; o tema escuro tem os próprios valores)
- **Sugestões de hábitos**: `SUGESTOES` em `js/domain/rotina.js`
- **Logo**: função `marca()` em `js/ui/icons.js` e `assets/favicon.svg`
- **Endereço da API em produção**: `API_PADRAO` em `js/config.js`

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| "A API não respondeu" | API desligada | Rode a API no Visual Studio (F5) |
| Funciona no Swagger, mas não no site | Certificado HTTPS não aceito neste navegador | Abra `https://localhost:7187/swagger` e aceite o aviso |
| Erro de CORS no console (F12) | Falta `app.UseCors("Frontend")` | Veja o passo 1 |
| Perfil não é criado sem e-mail | Falta o ajuste no `AddControllers` | Veja o passo 1 |
| Porta diferente de 7187 | Outro `launchSettings.json` | Ajuste em Ajustes > Endereço da API |
| Mudei um arquivo e o navegador mostra o antigo | Cache do service worker | Recarregue com Ctrl+Shift+R |
| Tela em branco abrindo o arquivo direto | Módulos não carregam em `file://` | Use o Live Server |

## Próximos passos sugeridos

- Na API: uma tabela de hábitos (com dias e horários) para a repetição não depender de criar tarefas com antecedência
- Na API: quantidade em um registro (copos, minutos) em vez de um item por horário
- `GET /api/Tarefa?usuarioId=&de=&ate=` para não baixar todas as tarefas de uma vez
- Devolver `404` em vez de `500` quando o registro não existe (`Atualizar`/`Apagar` nos repositórios)

## Créditos

- Fontes [Instrument Sans e Instrument Serif](https://github.com/Instrument), licença SIL Open Font License 1.1 (arquivos em `assets/fonts`)
- Ícones [Lucide](https://lucide.dev), licença ISC
- Gráficos: `charts.js` da skill design-taste-frontend
