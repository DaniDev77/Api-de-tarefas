using Microsoft.EntityFrameworkCore;
using projeto.Data.Map;
using projeto.Models;

namespace projeto.Data
{
    public class SistemaTarefasDbContext : DbContext
    {
        public SistemaTarefasDbContext(DbContextOptions<SistemaTarefasDbContext> options)
            : base(options)
        {
        }

        public DbSet<UsuarioModel> Usuarios { get; set; }
        public DbSet<TarefaModel> Tarefas { get; set; }
        public DbSet<CategoriaModel> Categorias { get; set; }
        public DbSet<HabitoModel> Habitos { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.ApplyConfiguration(new UsuarioMap());
            modelBuilder.ApplyConfiguration(new TarefaMap());
            modelBuilder.ApplyConfiguration(new CategoriaMap());
            modelBuilder.ApplyConfiguration(new HabitoMap());

            base.OnModelCreating(modelBuilder);
        }
    }
}
