// Fonte de dados de demonstração: mesma interface da API, guardada no navegador (localStorage).
// Funciona como a API com hábitos: cada hábito é uma regra, e as tarefas existem só até hoje
// (a de cada dia nasce em habitos.gerar, como no POST /api/Habito/gerar).
// Traz 17 semanas de histórico para o Progresso já abrir com dados de verdade. O sorteio é fixo
// (mesma semente), então a demonstração é igual em todo computador.
import { ler, gravar, remover } from '../core/storage.js';
import { paraApi, lerData, inicioDoDia, somarDias } from '../core/format.js';
import { normalizarUsuario, normalizarCategoria, normalizarTarefa, normalizarHabito } from './api.js';
import { ApiError } from './http.js';
import { minutosDeTexto, DIAS_UTEIS, TODOS_OS_DIAS, ocorreEm, horarioEm } from '../domain/rotina.js';

const CHAVE = 'demo:rotina:v3';
const espera = () => new Promise((r) => setTimeout(r, 90 + Math.random() * 120));

/** Gerador pseudoaleatório com semente (mulberry32): o mesmo número sempre gera a mesma sequência. */
function sorteio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// [título, área, dias da semana, início, fim (null = lembrete), chance de cumprir, aviso (min), termina em N dias]
const HABITOS = [
  ['Acordar', 2, DIAS_UTEIS, '06:30', '06:45', 0.86],
  ['Arrumar a cama', 5, TODOS_OS_DIAS, '06:45', '07:00', 0.9],
  ['Tomar vitamina', 1, TODOS_OS_DIAS, '07:00', '07:15', 0.88],
  ['Beber água', 1, TODOS_OS_DIAS, null, null, 0.84, 120],
  ['Academia', 3, [1, 3, 5], '18:30', '19:30', 0.78],
  ['Caminhar 30 min', 3, [6], '08:00', '08:30', 0.72],
  ['Estudar 1 h', 4, DIAS_UTEIS, '20:00', '21:00', 0.72],
  ['Ler 20 min', 4, TODOS_OS_DIAS, '22:30', '22:50', 0.56, null, 5], // acaba em breve: a Rotina pede para estender
  ['Planejar a semana', 5, [0], '19:00', '19:30', 0.82],
];

// itens avulsos: [título, área, dias a partir de hoje, horário, descrição]
const AVULSOS = [
  ['Consulta no dentista', 1, 1, '14:00', 'Levar a carteirinha do plano.'],
  ['Entregar trabalho da faculdade', 4, 2, '19:00', ''],
  ['Pagar a conta de luz', 5, 4, '10:00', 'Vence no dia 25.'],
  ['Comprar tênis de corrida', 3, -9, '17:00', ''],
  ['Renovar a matrícula da academia', 3, -16, '12:00', ''],
];

const HISTORICO_DIAS = 119; // 17 semanas: o mapa de constância do Progresso abre cheio

/** Tarefa de um hábito num dia (o mesmo que a API grava no POST /Habito/gerar). */
function tarefaDoHabito(h, dia, id) {
  const { inicio, fim } = horarioEm(normalizarHabito(h), dia);
  return {
    id,
    titulo: h.titulo,
    descricao: h.descricao,
    dataCriacao: paraApi(new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, 1)),
    dataInicio: paraApi(inicio),
    dataLimite: paraApi(fim),
    status: 1,
    prioridade: 2,
    usuarioId: h.usuarioId,
    categoriaId: h.categoriaId,
    habitoId: h.id,
  };
}

function semente() {
  const agora = new Date();
  const hoje = inicioDoDia(agora);
  const usuarios = [{ id: 1, nome: 'Marina Couto', email: 'marina.couto@exemplo.com', telefone: '(14) 99812-3344' }];
  const categorias = [
    { id: 1, nome: 'Saúde', descricao: 'Água, vitaminas e cuidados com o corpo.' },
    { id: 2, nome: 'Sono', descricao: 'Hora de acordar e de dormir.' },
    { id: 3, nome: 'Treino', descricao: 'Academia, caminhadas e esportes.' },
    { id: 4, nome: 'Estudos', descricao: 'Estudo, leitura e cursos.' },
    { id: 5, nome: 'Casa', descricao: 'Tarefas de casa e organização.' },
  ];
  const inicioHistorico = somarDias(hoje, -HISTORICO_DIAS);
  const habitos = HABITOS.map(([titulo, area, dias, ini, fim, , aviso = null, terminaEm = null], i) => ({
    id: i + 1,
    titulo,
    descricao: '',
    diasSemana: dias.join(','),
    horaInicio: ini ? `${ini}:00` : null,
    horaFim: fim ? `${fim}:00` : null,
    lembrarACadaMinutos: ini ? null : aviso,
    dataInicio: paraApi(inicioHistorico),
    dataFim: terminaEm === null ? null : paraApi(somarDias(hoje, terminaEm)),
    ativo: true,
    dataCriacao: paraApi(somarDias(inicioHistorico, -1)),
    usuarioId: 1,
    categoriaId: area,
  }));

  const tarefas = [];
  let id = 0;
  const minutoAgora = agora.getHours() * 60 + agora.getMinutes();
  // do começo do histórico até hoje (os dias seguintes a API ainda não gerou)
  for (let dia = -HISTORICO_DIAS; dia <= 0; dia++) {
    const d = somarDias(hoje, dia);
    habitos.forEach((h, i) => {
      if (!ocorreEm(normalizarHabito(h), d)) return;
      const t = tarefaDoHabito(h, d, ++id);
      const rnd = sorteio((dia + 1000) * 131 + i * 17);
      const chanceBase = HABITOS[i][5];
      if (dia < 0) {
        // fim de semana um pouco mais solto; as duas últimas semanas melhores (a rotina pegando)
        let chance = chanceBase;
        if (d.getDay() === 0 || d.getDay() === 6) chance -= 0.08;
        if (dia >= -14) chance += 0.06;
        const x = rnd();
        t.status = x < 0.035 ? 4 : x < chance ? 3 : 1;
      } else if (h.horaInicio && minutosDeTexto(h.horaInicio.slice(0, 5)) < minutoAgora) {
        // hoje: o que já passou está quase todo feito
        t.status = rnd() < 0.92 ? 3 : 1;
      }
      tarefas.push(t);
    });
  }
  AVULSOS.forEach(([titulo, area, dia, hh, descricao]) => {
    const d = somarDias(hoje, dia);
    const m = minutosDeTexto(hh);
    tarefas.push({
      id: ++id,
      titulo,
      descricao,
      dataCriacao: paraApi(somarDias(hoje, Math.min(dia, 0) - 3)),
      dataInicio: null,
      dataLimite: paraApi(new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60)),
      status: dia < 0 ? 3 : 1,
      prioridade: 3,
      usuarioId: 1,
      categoriaId: area,
      habitoId: null,
    });
  });
  return { usuarios, categorias, habitos, tarefas, seq: { usuarios: 1, categorias: categorias.length, habitos: habitos.length, tarefas: id } };
}

function carregar() {
  const salvo = ler(CHAVE);
  if (salvo?.usuarios && salvo?.tarefas && salvo?.habitos) return salvo;
  const novo = semente();
  gravar(CHAVE, novo);
  return novo;
}

export function restaurarDemonstracao() {
  remover(CHAVE);
}

const erroValidacao = (campos) => new ApiError('A API recusou os dados. Confira os campos destacados.', { status: 400, tipo: 'validacao', campos });

/** As mesmas regras do HabitoController.Validar da API. */
function validarHabito(h) {
  const campos = {};
  if (!h.titulo.trim()) campos.titulo = 'Dê um nome ao hábito.';
  if (!h.diasSemana) campos.diasSemana = 'Escolha pelo menos um dia da semana.';
  if (!h.horaInicio !== !h.horaFim) campos.horaFim = 'Preencha o início e o fim, ou deixe os dois vazios para um lembrete.';
  else if (h.horaInicio && h.horaInicio === h.horaFim) campos.horaFim = 'O fim precisa ser diferente do início.';
  if (h.dataFim && h.dataFim < h.dataInicio) campos.dataFim = 'O fim vem antes do início.';
  if (!h.categoriaId) campos.categoriaId = 'Escolha uma área.';
  if (Object.keys(campos).length) throw erroValidacao(campos);
}

function recurso(nome, normalizar, limpar, { validar, aoAtualizar } = {}) {
  return {
    listar: async () => {
      await espera();
      return carregar()[nome].map(normalizar);
    },
    criar: async (dados) => {
      await espera();
      const db = carregar();
      const limpo = limpar(dados);
      validar?.(limpo);
      db.seq[nome] += 1;
      const item = { id: db.seq[nome], ...limpo };
      if (nome === 'tarefas' || nome === 'habitos') item.dataCriacao = paraApi(new Date());
      db[nome].push(item);
      gravar(CHAVE, db);
      return normalizar(item);
    },
    atualizar: async (id, dados) => {
      await espera();
      const db = carregar();
      const item = db[nome].find((x) => x.id === id);
      if (!item) throw new ApiError('Esse registro já foi excluído. Atualize os dados.', { status: 500, tipo: 'servidor' });
      const limpo = limpar(dados);
      validar?.(limpo);
      Object.assign(item, limpo);
      aoAtualizar?.(db, item);
      gravar(CHAVE, db);
      return normalizar(item);
    },
    excluir: async (id) => {
      await espera();
      const db = carregar();
      db[nome] = db[nome].filter((x) => x.id !== id);
      // mesmo comportamento do banco: excluir pessoa/área apaga as tarefas e os hábitos ligados (cascade)
      if (nome === 'usuarios') {
        db.tarefas = db.tarefas.filter((t) => t.usuarioId !== id);
        db.habitos = db.habitos.filter((h) => h.usuarioId !== id);
      }
      if (nome === 'categorias') {
        db.tarefas = db.tarefas.filter((t) => t.categoriaId !== id);
        db.habitos = db.habitos.filter((h) => h.categoriaId !== id);
      }
      if (nome === 'habitos') db.tarefas.forEach((t) => t.habitoId === id && (t.habitoId = null));
      gravar(CHAVE, db);
      return true;
    },
  };
}

/** Igual ao HabitoRepositorio.Atualizar: as tarefas em aberto daqui para frente seguem a regra nova. */
function refazerAbertas(db, h) {
  const agora = new Date();
  const hoje = inicioDoDia(agora);
  const regra = normalizarHabito(h);
  db.tarefas = db.tarefas.filter((t) => {
    if (t.habitoId !== h.id || t.status !== 1 || !t.dataInicio) return true;
    const inicio = lerData(t.dataInicio);
    if (inicio < hoje) return true;
    if (!regra.ativo) return inicio < agora;
    const dia = inicioDoDia(inicio);
    if (!ocorreEm(regra, dia)) return false;
    const novo = horarioEm(regra, dia);
    Object.assign(t, { titulo: h.titulo, descricao: h.descricao, categoriaId: h.categoriaId, dataInicio: paraApi(novo.inicio), dataLimite: paraApi(novo.fim) });
    return true;
  });
}

/** Igual ao HabitoRepositorio.GerarTarefas: cria o que faltar entre "de" e "ate". */
async function gerar(usuarioId, de, ate = de) {
  await espera();
  const db = carregar();
  const inicio = inicioDoDia(de);
  const depois = somarDias(inicioDoDia(ate), 1);
  const ativos = db.habitos.filter((h) => h.usuarioId === usuarioId && h.ativo);
  const existe = new Set(db.tarefas.filter((t) => t.habitoId && t.dataInicio).map((t) => `${t.habitoId}|${t.dataInicio.slice(0, 10)}`));
  for (let d = inicio; d < depois; d = somarDias(d, 1)) {
    for (const h of ativos) {
      const regra = normalizarHabito(h);
      if (!ocorreEm(regra, d) || existe.has(`${h.id}|${paraApi(d).slice(0, 10)}`)) continue;
      const { fim } = horarioEm(regra, d);
      if (fim < lerData(h.dataCriacao)) continue; // já tinha terminado quando o hábito foi criado
      db.seq.tarefas += 1;
      const t = tarefaDoHabito(h, d, db.seq.tarefas);
      t.dataCriacao = paraApi(new Date());
      db.tarefas.push(t);
    }
  }
  gravar(CHAVE, db);
  return db.tarefas
    .filter((t) => t.usuarioId === usuarioId && t.habitoId && t.dataInicio && lerData(t.dataInicio) >= inicio && lerData(t.dataInicio) < depois)
    .map(normalizarTarefa);
}

export function criarFonteDemo() {
  return {
    tipo: 'demo',
    testar: async () => true,
    usuarios: recurso('usuarios', normalizarUsuario, (d) => ({ nome: d.nome.trim(), email: (d.email ?? '').trim(), telefone: (d.telefone ?? '').trim() })),
    categorias: recurso('categorias', normalizarCategoria, (d) => ({ nome: d.nome.trim(), descricao: (d.descricao ?? '').trim() })),
    tarefas: recurso('tarefas', normalizarTarefa, (d) => ({
      titulo: d.titulo.trim(),
      descricao: (d.descricao ?? '').trim(),
      dataInicio: d.fim ? paraApi(d.dataLimite) : null,
      dataLimite: paraApi(d.fim ?? d.dataLimite),
      status: Number(d.status),
      prioridade: Number(d.prioridade),
      usuarioId: Number(d.usuarioId),
      categoriaId: Number(d.categoriaId),
      habitoId: d.habitoId ?? null,
    })),
    habitos: {
      ...recurso(
        'habitos',
        normalizarHabito,
        (d) => ({
          titulo: d.titulo.trim(),
          descricao: (d.descricao ?? '').trim(),
          diasSemana: [...new Set(d.dias)].sort().join(','),
          horaInicio: d.horaInicio ? `${d.horaInicio}:00` : null,
          horaFim: d.horaFim ? `${d.horaFim}:00` : null,
          lembrarACadaMinutos: !d.horaInicio && d.lembrarACadaMinutos ? Number(d.lembrarACadaMinutos) : null,
          dataInicio: paraApi(inicioDoDia(d.dataInicio ?? new Date())),
          dataFim: d.dataFim ? paraApi(inicioDoDia(d.dataFim)) : null,
          ativo: d.ativo !== false,
          usuarioId: Number(d.usuarioId),
          categoriaId: Number(d.categoriaId),
        }),
        { validar: validarHabito, aoAtualizar: refazerAbertas }
      ),
      gerar,
    },
  };
}
