using projeto.Data;
using projeto.Models;
using projeto.Repositorios.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace projeto.Repositorios
{
    public class TarefaRepositorio : ITarefaRepositorio
    {
        private readonly SistemaTarefasDbContext _dbContext;

        public TarefaRepositorio(SistemaTarefasDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        // Filtros opcionais: só de um usuário e/ou só num período (pelo DataLimite).
        // Sem filtro nenhum, devolve tudo, como antes.
        public async Task<List<TarefaModel>> BuscarTodasTarefas(int? usuarioId = null, DateTime? de = null, DateTime? ate = null)
        {
            IQueryable<TarefaModel> consulta = _dbContext.Tarefas
                .Include(x => x.Usuario)
                .Include(x => x.Categoria);

            if (usuarioId != null) consulta = consulta.Where(x => x.UsuarioId == usuarioId);
            if (de != null) consulta = consulta.Where(x => x.DataLimite >= de.Value.Date);
            if (ate != null)
            {
                DateTime depoisDoFim = ate.Value.Date.AddDays(1);
                consulta = consulta.Where(x => x.DataLimite < depoisDoFim);
            }

            return await consulta.OrderBy(x => x.DataLimite).ToListAsync();
        }

        public async Task<TarefaModel?> BuscarPorId(int id)
        {
            return await _dbContext.Tarefas
                .Include(x => x.Usuario)
                .Include(x => x.Categoria)
                .FirstOrDefaultAsync(x => x.Id == id);
        }

        public async Task<TarefaModel> Adicionar(TarefaModel tarefa)
        {
            await _dbContext.Tarefas.AddAsync(tarefa);
            await _dbContext.SaveChangesAsync();
            return tarefa;
        }

        public async Task<TarefaModel> Atualizar(TarefaModel tarefa, int id)
        {
            TarefaModel tarefaPorId = await BuscarPorId(id)
                ?? throw new Exception($"Tarefa para o ID: {id} nao foi encontrada no banco de dados.");

            tarefaPorId.Titulo = tarefa.Titulo;
            tarefaPorId.Descricao = tarefa.Descricao;
            tarefaPorId.DataInicio = tarefa.DataInicio;
            tarefaPorId.DataLimite = tarefa.DataLimite;
            tarefaPorId.Status = tarefa.Status;
            tarefaPorId.Prioridade = tarefa.Prioridade;
            tarefaPorId.UsuarioId = tarefa.UsuarioId;
            tarefaPorId.CategoriaId = tarefa.CategoriaId;
            tarefaPorId.HabitoId = tarefa.HabitoId;

            _dbContext.Tarefas.Update(tarefaPorId);
            await _dbContext.SaveChangesAsync();
            return tarefaPorId;
        }

        public async Task<bool> Apagar(int id)
        {
            TarefaModel tarefaPorId = await BuscarPorId(id)
                ?? throw new Exception($"Tarefa para o ID: {id} nao foi encontrada no banco de dados.");

            _dbContext.Tarefas.Remove(tarefaPorId);
            await _dbContext.SaveChangesAsync();
            return true;
        }
    }
}
