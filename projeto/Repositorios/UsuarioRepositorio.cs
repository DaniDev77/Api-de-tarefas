using projeto.Data;
using projeto.Models;
using projeto.Repositorios.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace projeto.Repositorios
{
    public class UsuarioRepositorio : IUsuarioRepositorio
    {
        private readonly SistemaTarefasDbContext _dbContext;

        public UsuarioRepositorio(SistemaTarefasDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<List<UsuarioModel>> BuscarTodosUsuarios()
        {
            return await _dbContext.Usuarios.ToListAsync();
        }

        public async Task<UsuarioModel?> BuscarPorId(int id)
        {
            return await _dbContext.Usuarios.FirstOrDefaultAsync(x => x.Id == id);
        }

        public async Task<UsuarioModel> Adicionar(UsuarioModel usuario)
        {
            await _dbContext.Usuarios.AddAsync(usuario);
            await _dbContext.SaveChangesAsync();
            return usuario;
        }

        public async Task<UsuarioModel> Atualizar(UsuarioModel usuario, int id)
        {
            UsuarioModel usuarioPorId = await BuscarPorId(id)
                ?? throw new Exception($"Usuario para o ID: {id} nao foi encontrado no banco de dados.");

            usuarioPorId.Nome = usuario.Nome;
            usuarioPorId.Email = usuario.Email;
            usuarioPorId.Telefone = usuario.Telefone;

            _dbContext.Usuarios.Update(usuarioPorId);
            await _dbContext.SaveChangesAsync();
            return usuarioPorId;
        }

        public async Task<bool> Apagar(int id)
        {
            UsuarioModel usuarioPorId = await BuscarPorId(id)
                ?? throw new Exception($"Usuario para o ID: {id} nao foi encontrado no banco de dados.");

            // os hábitos do usuário são apagados junto (cascata); antes, as tarefas
            // deixam de apontar para eles, senão o banco recusa a exclusão
            await _dbContext.Tarefas
                .Where(t => t.Habito != null && t.Habito.UsuarioId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.HabitoId, (int?)null));

            _dbContext.Usuarios.Remove(usuarioPorId);
            await _dbContext.SaveChangesAsync();
            return true;
        }
    }
}
