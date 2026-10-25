using projeto.Enums;
using System.Text.Json.Serialization;

namespace projeto.Models
{
    public class TarefaModel
    {
        public int Id { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public string Descricao { get; set; } = string.Empty;
        public DateTime DataCriacao { get; set; } = DateTime.Now;

        // Quando a tarefa começa. Nulo nas tarefas avulsas (só têm o prazo).
        public DateTime? DataInicio { get; set; }

        // Quando a tarefa termina (prazo). Num lembrete é 23:59 do dia.
        public DateTime DataLimite { get; set; }

        public StatusTarefa Status { get; set; } = StatusTarefa.AFazer;
        public PrioriedadeTarefa Prioridade { get; set; } = PrioriedadeTarefa.Media;

        // Chave estrangeira - Usuario
        public int UsuarioId { get; set; }
        public UsuarioModel? Usuario { get; set; }

        // Chave estrangeira - Categoria
        public int CategoriaId { get; set; }
        public CategoriaModel? Categoria { get; set; }

        // Chave estrangeira OPCIONAL - Habito (nula nas tarefas avulsas)
        public int? HabitoId { get; set; }
        [JsonIgnore]
        public HabitoModel? Habito { get; set; }
    }
}
