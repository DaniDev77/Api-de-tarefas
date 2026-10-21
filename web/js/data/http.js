// Cliente HTTP sobre fetch(): timeout, leitura segura do corpo e erros traduzidos.
// Toda falha vira um ApiError com mensagem pronta para mostrar ao usuário.

export class ApiError extends Error {
  /**
   * @param {string} mensagem
   * @param {{ status?: number, tipo?: 'rede'|'timeout'|'validacao'|'nao-encontrado'|'servidor', campos?: Record<string,string>, detalhe?: string }} info
   */
  constructor(mensagem, { status = 0, tipo = 'servidor', campos = {}, detalhe = '' } = {}) {
    super(mensagem);
    this.name = 'ApiError';
    this.status = status;
    this.tipo = tipo;
    this.campos = campos;
    this.detalhe = detalhe;
  }
}

const TRADUCOES = [
  [/field is required/i, 'Preencha este campo.'],
  [/not a valid e-?mail/i, 'Informe um e-mail válido.'],
  [/maximum length/i, 'Texto maior que o permitido.'],
  [/could not be converted/i, 'Valor em formato inválido.'],
];

function traduzir(msg) {
  const achado = TRADUCOES.find(([re]) => re.test(msg));
  return achado ? achado[1] : msg;
}

/** "Descricao" / "$.dataLimite" -> "descricao" / "dataLimite" (mesmo nome do campo no formulário) */
const nomeCampo = (chave) => {
  const limpo = chave.replace(/^\$\.?/, '').split('.').pop() || '';
  return limpo ? limpo[0].toLowerCase() + limpo.slice(1) : '';
};

function construirErro(status, corpo) {
  // 400 do [ApiController]: ValidationProblemDetails { errors: { Campo: [mensagens] } }
  if (status === 400 && corpo && typeof corpo === 'object' && corpo.errors) {
    const campos = {};
    Object.entries(corpo.errors).forEach(([chave, msgs]) => {
      const campo = nomeCampo(chave);
      if (campo) campos[campo] = traduzir([].concat(msgs)[0] || 'Valor inválido.');
    });
    // API sem o ajuste do Program.cs: campos opcionais vazios são recusados como obrigatórios
    const nomes = Object.keys(campos);
    if (nomes.length && nomes.every((n) => n === 'descricao' || n === 'telefone')) {
      return new ApiError('A API ainda trata Descrição e Telefone como obrigatórios. Preencha o campo ou aplique o ajuste do Program.cs descrito no README.', { status, tipo: 'validacao', campos });
    }
    return new ApiError('A API recusou os dados. Confira os campos destacados.', { status, tipo: 'validacao', campos });
  }
  // NotFound("Tarefa nao encontrada.") chega como texto puro
  if (status === 404) {
    const texto = typeof corpo === 'string' && corpo.trim() ? corpo.trim() : 'Registro não encontrado.';
    return new ApiError(texto, { status, tipo: 'nao-encontrado' });
  }
  // Exceptions do repositório chegam como 500 em texto ("System.Exception: ...")
  const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo ?? '');
  const primeira = texto.split('\n')[0].replace(/^[\w.]+Exception:\s*/, '').trim();
  let mensagem = 'A API encontrou um erro ao processar o pedido.';
  if (/FOREIGN KEY/i.test(texto)) mensagem = 'A pessoa ou a categoria escolhida não existe mais. Atualize a página e tente de novo.';
  else if (/truncated/i.test(texto)) mensagem = 'Um dos textos passou do tamanho máximo aceito pelo banco.';
  else if (/nao foi encontrad|não foi encontrad/i.test(primeira)) mensagem = 'Esse registro já foi excluído por outra pessoa. Atualize os dados.';
  return new ApiError(mensagem, { status, tipo: 'servidor', detalhe: primeira.slice(0, 300) });
}

/**
 * @param {string} baseUrl ex.: https://localhost:7187/api
 * @param {string} caminho ex.: /Tarefa/3
 */
export async function requisicao(baseUrl, caminho, { metodo = 'GET', corpo, timeout = 12000 } = {}) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), timeout);
  let resposta;
  try {
    resposta = await fetch(baseUrl.replace(/\/+$/, '') + caminho, {
      method: metodo,
      headers: corpo !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new ApiError('A API demorou demais para responder.', { tipo: 'timeout' });
    }
    // "Failed to fetch": API desligada, certificado HTTPS não confiável ou CORS bloqueado
    throw new ApiError('Não foi possível conectar à API.', { tipo: 'rede' });
  } finally {
    clearTimeout(timer);
  }

  // a conexão pode cair no meio da resposta (API reiniciando): vira o mesmo erro traduzido de rede
  let texto;
  try {
    texto = await resposta.text();
  } catch {
    throw new ApiError('A conexão com a API caiu no meio da resposta. Tente de novo.', { tipo: 'rede' });
  }
  const tipoConteudo = resposta.headers.get('content-type') || '';
  let dados = texto;
  if (texto && tipoConteudo.includes('json')) {
    try {
      dados = JSON.parse(texto);
    } catch {
      /* corpo não era JSON de verdade */
    }
  }
  if (!resposta.ok) throw construirErro(resposta.status, dados);
  return dados;
}
