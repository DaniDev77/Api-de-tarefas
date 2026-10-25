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

// ------------------------------------------------ hábitos da API (HabitoController)
const H = (id, extra) => ({ id, titulo: 'Academia', descricao: '', dias: [1, 3, 5], horaInicio: '18:30', horaFim: '19:30', lembrarACadaMinutos: null, dataInicio: new Date(2026, 9, 12), dataFim: null, ativo: true, usuarioId: 1, categoriaId: 2, ...extra });
const hab = H(1);
ok('ocorre seg/qua/sex dentro do prazo', R.ocorreEm(hab, new Date(2026, 9, 21)) && !R.ocorreEm(hab, new Date(2026, 9, 20)) && !R.ocorreEm(hab, new Date(2026, 9, 9)));
ok('não ocorre depois do fim nem encerrado', !R.ocorreEm(H(1, { dataFim: new Date(2026, 9, 20) }), new Date(2026, 9, 21)) && !R.ocorreEm(H(1, { ativo: false }), new Date(2026, 9, 21)));
let hr = R.horarioEm(hab, new Date(2026, 9, 21));
ok('horário 18:30 às 19:30', R.horaTexto(hr.inicio) === '18:30' && R.horaTexto(hr.fim) === '19:30' && hr.fim.getDate() === 21);
hr = R.horarioEm(H(2, { horaInicio: '23:00', horaFim: '07:00' }), new Date(2026, 9, 21));
ok('atravessa a meia-noite', hr.fim.getDate() === 22 && R.horaTexto(hr.fim) === '07:00');
const agua = H(3, { titulo: 'Beber água', categoriaId: 1, dias: R.TODOS_OS_DIAS, horaInicio: null, horaFim: null, lembrarACadaMinutos: 120 });
hr = R.horarioEm(agua, new Date(2026, 9, 21));
ok('lembrete vale o dia todo', R.horaTexto(hr.inicio) === '00:00' && R.horaTexto(hr.fim) === '23:59');
ok('texto da faixa', R.textoFaixa(hab) === '18:30 às 19:30' && R.textoFaixa(agua) === 'sem horário, aviso a cada 2 h' && R.textoPadrao(hab) === 'Seg, qua e sex · 18:30 às 19:30');

// tarefas geradas pela API: dataLimite = início, fim = término, habitoId
const G = (id, h, d, status) => { const x = R.horarioEm(h, new Date(2026, 9, d)); return { id, titulo: h.titulo, categoriaId: h.categoriaId, usuarioId: 1, dataLimite: x.inicio, fim: x.fim, habitoId: h.id, status, prioridade: 2, descricao: '' }; };
const antigas = [T(101, 'Academia', 2, 5, 18, 3), T(102, 'Academia', 2, 7, 18, 3)]; // histórico do modo antigo
const geradas = [G(201, hab, 12, 3), G(202, hab, 14, 3), G(203, hab, 16, 1), G(204, hab, 19, 3), G(205, hab, 21, 1), G(301, agua, 21, 1)];
const idx2 = R.indiceRotina([...antigas, ...geradas], 1, [hab, agua], agora);
const sh = idx2.series.get('h1');
ok('série do hábito junta o histórico antigo', sh && sh.itens.length === 7 && !idx2.series.has('1|academia|2'), sh?.itens.length);
ok('previstos nos próximos dias, sem ir ao banco', (idx2.porDia.get('2026-10-23') ?? []).some((t) => t.previsto && t.habitoId === 1) && !(idx2.porDia.get('2026-10-22') ?? []).some((t) => t.habitoId === 1));
ok('previsto não entra nos itens nem na sequência', !idx2.itens.some((t) => t.previsto) && R.sequencias(sh, '2026-10-21').atual === 1);
ok('série do previsto', R.serieDe(idx2, idx2.porDia.get('2026-10-23').find((t) => t.previsto && t.habitoId === 1))?.chave === 'h1');
ok('situação: sem prazo / acabando / encerrado', R.situacaoSerie(sh, agora).texto === 'sem prazo'
  && R.situacaoSerie({ habito: H(1, { dataFim: new Date(2026, 9, 24) }) }, agora).tipo === 'acabando'
  && R.situacaoSerie({ habito: H(1, { ativo: false }) }, agora).tipo === 'encerrado');
const tAgua = geradas.at(-1);
ok('lembrete nunca passa do horário no dia', R.ehLembrete(tAgua) && !R.passouDoHorario(tAgua, agora) && !R.ehLembrete(geradas[4]));
const dia21 = R.itensDoDia(idx2, agora);
let rd = R.resumoDia(dia21, agora);
ok('resumo: lembrete separado, próximo é a academia', rd.lembretes.length === 1 && rd.proximo?.id === 205 && rd.atrasados.length === 0, JSON.stringify({ l: rd.lembretes.length, p: rd.proximo?.id }));
rd = R.resumoDia(dia21, new Date(2026, 9, 21, 19, 0));
ok('resumo: na hora entre início e fim', rd.naHora?.id === 205 && rd.atrasados.length === 0);
rd = R.resumoDia(dia21, new Date(2026, 9, 21, 19, 45));
ok('resumo: depois do fim, passou do horário', rd.atrasados.length === 1 && rd.atrasados[0].id === 205);
ok('fim sugerido e intervalo', R.fimSugerido('22:30', 'Ler 20 min') === '22:50' && R.fimSugerido('18:00', 'Academia') === '18:30' && R.intervaloEntre(['09:00', '12:00', '15:00', '18:00']) === 180);
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo');
