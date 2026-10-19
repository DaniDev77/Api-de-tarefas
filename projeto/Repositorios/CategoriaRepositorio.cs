using projeto.Data;
using projeto.Models;
using projeto.Repositorios.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace projeto.Repositorios
{
    public class CategoriaRepositorio : ICategoriaRepositorio
    {
        private readonly SistemaTarefasDbContext _dbContext;

        public CategoriaRepositorio(SistemaTarefasDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<List<CategoriaModel>> BuscarTodasCategorias()
        {
            return await _dbContext.Categorias.ToListAsync();
        }

        public async Task<CategoriaModel?> BuscarPorId(int id)
        {
            return await _dbContext.Categorias.FirstOrDefaultAsync(x => x.Id == id);
        }

        public async Task<CategoriaModel> Adicionar(CategoriaModel categoria)
        {
            await _dbContext.Categorias.AddAsync(categoria);
            await _dbContext.SaveChangesAsync();
            return categoria;
        }

        public async Task<CategoriaModel> Atualizar(CategoriaModel categoria, int id)
        {
            CategoriaModel categoriaPorId = await BuscarPorId(id)
                ?? throw new Exception($"Categoria para o ID: {id} nao foi encontrada no banco de dados.");

            categoriaPorId.Nome = categoria.Nome;
            categoriaPorId.Descricao = categoria.Descricao;

            _dbContext.Categorias.Update(categoriaPorId);
            await _dbContext.SaveChangesAsync();
            return categoriaPorId;
        }

        public async Task<bool> Apagar(int id)
        {
            CategoriaModel categoriaPorId = await BuscarPorId(id)
                ?? throw new Exception($"Categoria para o ID: {id} nao foi encontrada no banco de dados.");

            _dbContext.Categorias.Remove(categoriaPorId);
            await _dbContext.SaveChangesAsync();
            return true;
        }
    }
}
