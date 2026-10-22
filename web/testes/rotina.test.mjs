// Testes das regras da rotina (sem navegador). Rode na pasta web: node testes/rotina.test.mjs
import { lerFrase, espalharHorarios } from '../js/domain/frase.js';
import * as R from '../js/domain/rotina.js';
let falhas = 0;
const ok = (nome, cond, info = '') => { if (!cond) falhas++; console.log(`${cond ? 'PASSOU' : 'FALHOU'}  ${nome}${info ? '  ' + info : ''}`); };
const agora = new Date(2026, 9, 21, 14, 30); // qua 21/10/2026 14:30
const cats = [{ id: 1, nome: 'Saúde' }, { id: 2, nome: 'Treino' }, { id: 3, nome: 'Estudos' }, { id: 4, nome: 'Sono' }, { id: 5, nome: 'Casa' }];
const f = (t) => lerFrase(t, { categorias: cats, agora });
let r = f('Academia 18h30 seg qua sex');
ok('academia', r.titulo === 'Academia' && r.horarios.join() === '18:30' && r.dias.join() === '1,3,5' && r.categoriaId === 2, JSON.stringify(r));
r = f('Beber água 4x ao dia');
ok('água 4x', r.titulo === 'Beber água' && r.horarios.join() === '09:00,12:00,15:00,18:00' && r.dias.length === 7 && r.categoriaId === 1, JSON.stringify(r));
r = f('Ler 20 min às 22h todo dia');
ok('ler', r.titulo === 'Ler 20 min' && r.horarios.join() === '22:00' && r.dias.length === 7 && r.categoriaId === 3, JSON.stringify(r));
r = f('Estudar 1h dias úteis 20:00');
ok('estudar 1h fica no título', r.titulo === 'Estudar 1h' && r.horarios.join() === '20:00' && r.dias.join() === '1,2,3,4,5', JSON.stringify(r));
r = f('Dentista amanhã 14h #saúde');
ok('dentista amanhã', r.titulo === 'Dentista' && r.data.getDate() === 22 && r.horarios.join() === '14:00' && r.categoriaId === 1 && r.areaExplicita, JSON.stringify(r));
r = f('Acordar 6h');
ok('acordar 6h', r.titulo === 'Acordar' && r.horarios.join() === '06:00' && r.dias === null && r.data === null && r.categoriaId === 4, JSON.stringify(r));
r = f('Caminhada no sábado às 8');
ok('sábado', r.titulo === 'Caminhada' && r.data.getDay() === 6 && r.horarios.join() === '08:00', JSON.stringify(r));
r = f('Lavar roupa toda terça e quinta às 19h por 2 semanas');
ok('terça e quinta', r.titulo === 'Lavar roupa' && r.dias.join() === '2,4' && r.horarios.join() === '19:00' && r.semanas === 2 && r.categoriaId === 5, JSON.stringify(r));
r = f('Pagar a conta de luz 25/10');
ok('data 25/10', r.titulo === 'Pagar a conta de luz' && r.data.getDate() === 25 && r.data.getMonth() === 9, JSON.stringify(r));
ok('espalhar 8', espalharHorarios(8).join() === '08:00,09:30,11:30,13:00,15:00,16:30,18:30,20:00', espalharHorarios(8).join());

// séries e sequências
const T = (id, titulo, cat, d, h, status) => ({ id, titulo, categoriaId: cat, usuarioId: 1, dataLimite: new Date(2026, 9, d, h, 0), status, prioridade: 2, descricao: '' });
const tarefas = [
  T(1, 'Academia', 2, 12, 18, 3), T(2, 'Academia', 2, 14, 18, 3), T(3, 'Academia', 2, 16, 18, 1), // sex 16 perdido
  T(4, 'Academia', 2, 19, 18, 3), T(5, 'academia', 2, 21, 18, 1), T(6, 'Academia', 2, 23, 18, 1),
  T(7, 'Beber água', 1, 20, 9, 3), T(8, 'Beber água', 1, 20, 12, 3), T(9, 'Beber água', 1, 21, 9, 3), T(10, 'Beber água', 1, 21, 12, 1),
  T(11, 'Dentista', 1, 22, 14, 1),
];
const idx = R.indiceRotina(tarefas, 1);
const ac = idx.series.get('1|academia|2');
ok('série junta caixa diferente', ac && ac.itens.length === 6 && ac.recorrente);
ok('padrão seg/qua/sex', ac.padrao.dias.join() === '1,3,5' && ac.padrao.horarios.join() === '18:00', JSON.stringify(ac.padrao));
const seq = R.sequencias(ac, '2026-10-21');
ok('sequência: perdido na sexta zera, segunda conta, hoje pendente não zera', seq.atual === 1 && seq.melhor === 2, JSON.stringify(seq));
ok('dentista avulso', !idx.series.get('1|dentista|1').recorrente);
const dia = R.resumoDia(R.itensDoDia(idx, agora), agora);
ok('resumo do dia', dia.total === 3 && dia.feitos === 1 && dia.atrasados.length === 1 && dia.proximo.titulo === 'academia', JSON.stringify({ ...dia, atrasados: dia.atrasados.length, proximo: dia.proximo?.titulo }));
ok('posição 2 de 2', JSON.stringify(R.posicaoNoDia(idx, tarefas[9])) === JSON.stringify({ n: 2, de: 2, feitos: 1 }));
const datas = R.datasDaSerie({ dias: [1, 3, 5], horarios: ['18:30'], inicio: agora, semanas: 2, agora });
ok('datas em série (2 semanas, seg/qua/sex, a partir de hoje 14:30)', datas.length === 6 && datas[0].getDate() === 21, datas.map((d) => d.getDate()).join());
const datas2 = R.datasDaSerie({ dias: [3], horarios: ['09:00'], inicio: agora, semanas: 1, agora });
ok('horário que já passou hoje fica de fora', datas2.length === 0);
const ext = R.datasParaEstender(ac, 1, agora);
ok('estender continua depois do último', ext.length === 3 && ext[0].getDate() === 26, ext.map((d) => d.getDate()).join());
ok('textos', R.textoDias([1,2,3,4,5]) === 'Dias úteis' && R.textoDias([1,3,5]) === 'Seg, qua e sex' && R.textoHorarios(['09:00','12:00','15:00','18:00']) === '4× ao dia, 09:00 a 18:00');
ok('duração do título', R.duracaoDoTitulo('Ler 20 min') === 20 && R.duracaoDoTitulo('Estudar 1 h') === 60 && R.duracaoDoTitulo('Estudar 1h30') === 90 && R.duracaoDoTitulo('Academia') === null);
const est = R.estatisticas(idx, { agora });
ok('constância conta feitos e perdidos', est.geral.feitos === 6 && est.geral.perdidos === 1, JSON.stringify(est.geral));
ok('mapa tem semanas completas', est.mapa.length === 17 * 7 && est.mapa.at(-1).data.getDay() === 0);
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo');
