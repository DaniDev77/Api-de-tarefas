using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using projeto.Enums;
using projeto.Models;

namespace projeto.Data.Map
{
    public class TarefaMap : IEntityTypeConfiguration<TarefaModel>
    {
        public void Configure(EntityTypeBuilder<TarefaModel> builder)
        {
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Titulo)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(x => x.Descricao)
                .HasMaxLength(500);

            builder.Property(x => x.DataCriacao)
                .IsRequired();

            // Opcional: as tarefas avulsas só têm o prazo (DataLimite)
            builder.Property(x => x.DataInicio);

            builder.Property(x => x.DataLimite)
                .IsRequired();

            builder.Property(x => x.Status)
                .IsRequired()
                .HasDefaultValue(StatusTarefa.AFazer);

            builder.Property(x => x.Prioridade)
                .IsRequired();

            // Relacionamento N:1 com Usuario
            builder.HasOne(x => x.Usuario)
                .WithMany(x => x.Tarefas)
                .HasForeignKey(x => x.UsuarioId);

            // Relacionamento N:1 com Categoria
            builder.HasOne(x => x.Categoria)
                .WithMany(x => x.Tarefas)
                .HasForeignKey(x => x.CategoriaId);

            // O relacionamento com Habito (HabitoId opcional) está no HabitoMap.

            // Índices para as consultas mais comuns: tarefas de um usuário num período
            // e "já existe a tarefa deste hábito neste dia?"
            builder.HasIndex(x => new { x.UsuarioId, x.DataLimite });
            builder.HasIndex(x => new { x.HabitoId, x.DataInicio });
        }
    }
}
