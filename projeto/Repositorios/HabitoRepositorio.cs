using Microsoft.EntityFrameworkCore;
using projeto.Data;
using projeto.Enums;
using projeto.Models;
using projeto.Repositorios.Interfaces;

namespace projeto.Repositorios
{
    public class HabitoRepositorio : IHabitoRepositorio
    {
        private readonly SistemaTarefasDbContext _dbContext;

        public HabitoRepositorio(SistemaTarefasDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<List<HabitoModel>> BuscarTodos(int? usuarioId)
        {
            IQueryable<HabitoModel> consulta = _dbContext.Habitos;
            if (usuarioId != null) consulta = consulta.Where(x => x.UsuarioId == usuarioId);
            return await consulta.OrderBy(x => x.Id).ToListAsync();
        }

        public async Task<HabitoModel?> BuscarPorId(int id)
        {
            return await _dbContext.Habitos.FirstOrDefaultAsync(x => x.Id == id);
        }

        public async Task<HabitoModel> Adicionar(HabitoModel habito)
        {
            habito.Id = 0;
            habito.DataCriacao = DateTime.Now;
            habito.DataInicio = habito.DataInicio.Date;
            habito.DataFim = habito.DataFim?.Date;
            await _dbContext.Habitos.AddAsync(habito);
            await _dbContext.SaveChangesAsync();
            return habito;
        }

        public async Task<HabitoModel> Atualizar(HabitoModel habito, int id)
        {
            HabitoModel habitoPorId = await BuscarPorId(id)
                ?? throw new Exception($"Habito para o ID: {id} nao foi encontrado no banco de dados.");

            habitoPorId.Titulo = habito.Titulo;
            habitoPorId.Descricao = habito.Descricao;
            habitoPorId.DiasSemana = habito.DiasSemana;
            habitoPorId.HoraInicio = habito.HoraInicio;
            habitoPorId.HoraFim = habito.HoraFim;
            habitoPorId.LembrarACadaMinutos = habito.LembrarACadaMinutos;
            habitoPorId.DataInicio = habito.DataInicio.Date;
            habitoPorId.DataFim = habito.DataFim?.Date;
            habitoPorId.Ativo = habito.Ativo;
            habitoPorId.CategoriaId = habito.CategoriaId;

            // As tarefas daqui para frente que ainda estão "A fazer" seguem a regra nova.
            // As já feitas, puladas ou em andamento ficam como estão: são o histórico.
            DateTime agora = DateTime.Now;
            DateTime hoje = DateTime.Today;
            List<TarefaModel> abertas = await _dbContext.Tarefas
                .Where(t => t.HabitoId == id && t.Status == StatusTarefa.AFazer && t.DataInicio >= hoje)
                .ToListAsync();

            foreach (TarefaModel tarefa in abertas)
            {
                DateTime dia = tarefa.DataInicio!.Value.Date;

                // encerrado: sai o que ainda não começou
                if (!habitoPorId.Ativo)
                {
                    if (tarefa.DataInicio >= agora) _dbContext.Tarefas.Remove(tarefa);
                    continue;
                }
                // o dia saiu da regra (mudou os dias da semana ou o prazo)
                if (!habitoPorId.OcorreEm(dia))
                {
                    _dbContext.Tarefas.Remove(tarefa);
                    continue;
                }
                (DateTime inicio, DateTime fim) = habitoPorId.HorarioEm(dia);
                tarefa.Titulo = habitoPorId.Titulo;
                tarefa.Descricao = habitoPorId.Descricao;
                tarefa.CategoriaId = habitoPorId.CategoriaId;
                tarefa.DataInicio = inicio;
                tarefa.DataLimite = fim;
            }

            await _dbContext.SaveChangesAsync();
            return habitoPorId;
        }

        public async Task<bool> Apagar(int id)
        {
            HabitoModel habitoPorId = await BuscarPorId(id)
                ?? throw new Exception($"Habito para o ID: {id} nao foi encontrado no banco de dados.");

            // as tarefas já feitas continuam (histórico); só deixam de apontar para o hábito
            await _dbContext.Tarefas
                .Where(t => t.HabitoId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.HabitoId, (int?)null));

            _dbContext.Habitos.Remove(habitoPorId);
            await _dbContext.SaveChangesAsync();
            return true;
        }

        public async Task<List<TarefaModel>> GerarTarefas(int usuarioId, DateTime de, DateTime ate)
        {
            de = de.Date;
            ate = ate.Date;
            DateTime depoisDoFim = ate.AddDays(1);

            List<HabitoModel> habitos = await _dbContext.Habitos
                .Where(h => h.UsuarioId == usuarioId && h.Ativo)
                .ToListAsync();

            // o que já existe no período: (hábito, dia)
            var existentes = (await _dbContext.Tarefas
                    .Where(t => t.UsuarioId == usuarioId && t.HabitoId != null && t.DataInicio >= de && t.DataInicio < depoisDoFim)
                    .Select(t => new { t.HabitoId, t.DataInicio })
                    .ToListAsync())
                .Select(t => (t.HabitoId!.Value, t.DataInicio!.Value.Date))
                .ToHashSet();

            List<TarefaModel> novas = new();
            for (DateTime dia = de; dia <= ate; dia = dia.AddDays(1))
            {
                foreach (HabitoModel habito in habitos)
                {
                    if (!habito.OcorreEm(dia) || existentes.Contains((habito.Id, dia))) continue;

                    (DateTime inicio, DateTime fim) = habito.HorarioEm(dia);
                    // não cria o que já tinha terminado quando o hábito foi criado
                    // (criou "Acordar 06:30" às 21h: hoje não entra, amanhã sim)
                    if (fim < habito.DataCriacao) continue;

                    novas.Add(new TarefaModel
                    {
                        Titulo = habito.Titulo,
                        Descricao = habito.Descricao,
                        DataCriacao = DateTime.Now,
                        DataInicio = inicio,
                        DataLimite = fim,
                        Status = StatusTarefa.AFazer,
                        Prioridade = PrioriedadeTarefa.Media,
                        UsuarioId = usuarioId,
                        CategoriaId = habito.CategoriaId,
                        HabitoId = habito.Id,
                    });
                }
            }

            if (novas.Count > 0)
            {
                await _dbContext.Tarefas.AddRangeAsync(novas);
                await _dbContext.SaveChangesAsync();
            }

            return await _dbContext.Tarefas
                .AsNoTracking()
                .Where(t => t.UsuarioId == usuarioId && t.HabitoId != null && t.DataInicio >= de && t.DataInicio < depoisDoFim)
                .OrderBy(t => t.DataInicio)
                .ToListAsync();
        }
    }
}
