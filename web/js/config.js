// Configurações do produto. Para revender com outra marca, troque o nome aqui.
export const APP = {
  nome: 'Pauta',
  descricao: 'Sua rotina, um dia de cada vez',
};

// Endereço da API (perfil "https" do launchSettings.json). Pode ser alterado em Ajustes.
export const API_PADRAO = 'https://localhost:7187/api';

// Tempo para desfazer uma exclusão antes de ela ser apagada na API.
export const TEMPO_DESFAZER_MS = 6000;

// Ao voltar para a aba, sincroniza de novo se os dados tiverem mais que isso.
export const SINCRONIZAR_APOS_MS = 45_000;

// Por quantas semanas um hábito novo é colocado na pauta (dá para estender depois).
export const SEMANAS_PADRAO = 4;
