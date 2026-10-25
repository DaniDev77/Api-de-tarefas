using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using projeto.Models;

namespace projeto.Data.Map
{
    public class HabitoMap : IEntityTypeConfiguration<HabitoModel>
    {
        public void Configure(EntityTypeBuilder<HabitoModel> builder)
        {
            builder.HasKey(x => x.Id);

            builder.Property(x => x.Titulo)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(x => x.Descricao)
                .HasMaxLength(500);

            builder.Property(x => x.DiasSemana)
                .IsRequired()
                .HasMaxLength(20);

            // TimeOnly vira coluna "time" no SQL Server
            builder.Property(x => x.HoraInicio);
            builder.Property(x => x.HoraFim);

            builder.Property(x => x.DataInicio)
                .IsRequired();

            // sem HasDefaultValue(true): num bool, o EF trocaria um "false" do INSERT pelo padrão do banco
            builder.Property(x => x.Ativo)
                .IsRequired();

            builder.Property(x => x.DataCriacao)
                .IsRequired();

            // Relacionamento N:1 com Usuario (apagar o usuario apaga os hábitos dele)
            builder.HasOne(x => x.Usuario)
                .WithMany()
                .HasForeignKey(x => x.UsuarioId);

            // Relacionamento N:1 com Categoria
            builder.HasOne(x => x.Categoria)
                .WithMany()
                .HasForeignKey(x => x.CategoriaId);

            // Relacionamento 1:N com Tarefa. A chave é opcional e NÃO apaga em cascata:
            // apagar um hábito não apaga o histórico, só desliga as tarefas dele (o repositório faz isso).
            builder.HasMany(x => x.Tarefas)
                .WithOne(x => x.Habito)
                .HasForeignKey(x => x.HabitoId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.ClientSetNull);

            builder.HasIndex(x => x.UsuarioId);
        }
    }
}
