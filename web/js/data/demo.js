// Fonte de dados de demonstração: mesma interface da API, guardada no navegador (localStorage).
// Gera a rotina de uma pessoa fictícia com dez semanas de histórico e quatro semanas pela frente,
// para o Progresso já abrir com dados de verdade. O sorteio é fixo (mesma semente), então a
// demonstração é igual em todo computador.
import { ler, gravar, remover } from '../core/storage.js';
import { paraApi, inicioDoDia, somarDias } from '../core/format.js';
import { normalizarUsuario, normalizarCategoria, normalizarTarefa } from './api.js';
import { ApiError } from './http.js';
import { minutosDeTexto, DIAS_UTEIS, TODOS_OS_DIAS } from '../domain/rotina.js';

const CHAVE = 'demo:rotina:v2';
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

// [título, área, dias da semana, horários, chance de cumprir em cada horário, até quantos dias à frente]
const HABITOS = [
  ['Acordar', 2, DIAS_UTEIS, ['06:30'], [0.86]],
  ['Arrumar a cama', 5, TODOS_OS_DIAS, ['06:45'], [0.9]],
  ['Tomar vitamina', 1, TODOS_OS_DIAS, ['07:00'], [0.88]],
  ['Beber água', 1, TODOS_OS_DIAS, ['09:00', '12:00', '15:00', '18:00'], [0.95, 0.9, 0.79, 0.7]],
  ['Academia', 3, [1, 3, 5], ['18:30'], [0.78]],
  ['Caminhar 30 min', 3, [6], ['08:00'], [0.72]],
  ['Estudar 1 h', 4, DIAS_UTEIS, ['20:00'], [0.72]],
  ['Ler 20 min', 4, TODOS_OS_DIAS, ['22:30'], [0.56], 5], // acaba em breve: a Rotina pede para estender
  ['Planejar a semana', 5, [0], ['19:00'], [0.82]],
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
const FUTURO_DIAS = 27;

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
  const tarefas = [];
  let id = 0;
  const minutoAgora = agora.getHours() * 60 + agora.getMinutes();

  for (let dia = -HISTORICO_DIAS; dia <= FUTURO_DIAS; dia++) {
    const d = somarDias(hoje, dia);
    // as tarefas eram criadas em blocos de 4 semanas (como no botão "Estender")
    const criadaEm = somarDias(hoje, Math.floor(dia / 28) * 28 - 1);
    HABITOS.forEach(([titulo, area, dias, horarios, chances, ate = FUTURO_DIAS], h) => {
      if (!dias.includes(d.getDay()) || dia > ate) return;
      horarios.forEach((hh, i) => {
        const m = minutosDeTexto(hh);
        const quando = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60);
        const rnd = sorteio((dia + 1000) * 131 + h * 17 + i * 3);
        let status = 1;
        if (dia < 0) {
          // fim de semana um pouco mais solto; as duas últimas semanas melhores (a rotina pegando)
          let chance = chances[i] ?? chances[0];
          if (d.getDay() === 0 || d.getDay() === 6) chance -= 0.08;
          if (dia >= -14) chance += 0.06;
          const x = rnd();
          status = x < 0.035 ? 4 : x < chance ? 3 : 1;
        } else if (dia === 0 && m < minutoAgora) {
          // hoje: o que já passou está quase todo feito; a água mais recente ficou para trás
          const ultimaAguaPassada = titulo === 'Beber água' && horarios.filter((x) => minutosDeTexto(x) < minutoAgora).at(-1) === hh;
          status = ultimaAguaPassada ? 1 : rnd() < 0.92 ? 3 : 1;
        }
        tarefas.push({
          id: ++id,
          titulo,
          descricao: '',
          dataCriacao: paraApi(new Date(criadaEm.getFullYear(), criadaEm.getMonth(), criadaEm.getDate(), 21, 10)),
          dataLimite: paraApi(quando),
          status,
          prioridade: 2,
          usuarioId: 1,
          categoriaId: area,
        });
      });
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
      dataLimite: paraApi(new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(m / 60), m % 60)),
      status: dia < 0 ? 3 : 1,
      prioridade: 3,
      usuarioId: 1,
      categoriaId: area,
    });
  });
  return { usuarios, categorias, tarefas, seq: { usuarios: 1, categorias: categorias.length, tarefas: id } };
}

function carregar() {
  const salvo = ler(CHAVE);
  if (salvo?.usuarios && salvo?.tarefas) return salvo;
  const novo = semente();
  gravar(CHAVE, novo);
  return novo;
}

export function restaurarDemonstracao() {
  remover(CHAVE);
}

function recurso(nome, normalizar, limpar) {
  return {
    listar: async () => {
      await espera();
      return carregar()[nome].map(normalizar);
    },
    criar: async (dados) => {
      await espera();
      const db = carregar();
      db.seq[nome] += 1;
      const item = { id: db.seq[nome], ...limpar(dados) };
      if (nome === 'tarefas') item.dataCriacao = paraApi(new Date());
      db[nome].push(item);
      gravar(CHAVE, db);
      return normalizar(item);
    },
    atualizar: async (id, dados) => {
      await espera();
      const db = carregar();
      const item = db[nome].find((x) => x.id === id);
      if (!item) throw new ApiError('Esse registro já foi excluído. Atualize os dados.', { status: 500, tipo: 'servidor' });
      Object.assign(item, limpar(dados));
      gravar(CHAVE, db);
      return normalizar(item);
    },
    excluir: async (id) => {
      await espera();
      const db = carregar();
      db[nome] = db[nome].filter((x) => x.id !== id);
      // mesmo comportamento do banco: excluir pessoa/área apaga as tarefas ligadas (cascade)
      if (nome === 'usuarios') db.tarefas = db.tarefas.filter((t) => t.usuarioId !== id);
      if (nome === 'categorias') db.tarefas = db.tarefas.filter((t) => t.categoriaId !== id);
      gravar(CHAVE, db);
      return true;
    },
  };
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
      dataLimite: paraApi(d.dataLimite),
      status: Number(d.status),
      prioridade: Number(d.prioridade),
      usuarioId: Number(d.usuarioId),
      categoriaId: Number(d.categoriaId),
    })),
  };
}
