using projeto.Enums;

namespace projeto.Models
{
    public class TarefaModel
    {
        public int Id { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public string Descricao { get; set; } = string.Empty;
        public DateTime DataCriacao { get; set; } = DateTime.Now;
        public DateTime DataLimite { get; set; }
        public StatusTarefa Status { get; set; } = StatusTarefa.AFazer;
        public PrioriedadeTarefa Prioridade { get; set; } = PrioriedadeTarefa.Media;

        // Chave estrangeira - Usuario
        public int UsuarioId { get; set; }
        public UsuarioModel? Usuario { get; set; }

        // Chave estrangeira - Categoria
        public int CategoriaId { get; set; }
        public CategoriaModel? Categoria { get; set; }
    }
}
