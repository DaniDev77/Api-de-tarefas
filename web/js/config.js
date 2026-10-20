// Configurações do produto. Para revender com outra marca, troque o nome aqui.
export const APP = {
  nome: 'Pauta',
  descricao: 'Tarefas da equipe, com prazo à vista',
};

// Nome da equipe mostrado na lateral e na saudação (editável em Configurações).
export const EQUIPE_DEMO = 'Estúdio Tramela';

// Endereço da API (perfil "https" do launchSettings.json). Pode ser alterado em Configurações.
export const API_PADRAO = 'https://localhost:7187/api';

// Tempo para desfazer uma exclusão de tarefa antes de ela ser apagada na API.
export const TEMPO_DESFAZER_MS = 6000;

// Ao voltar para a aba, sincroniza de novo se os dados tiverem mais que isso.
export const SINCRONIZAR_APOS_MS = 45_000;
