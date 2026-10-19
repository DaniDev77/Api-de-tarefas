namespace projeto.Models
{
    public class CategoriaModel
    {
        public int Id { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Descricao { get; set; } = string.Empty;

        // Relacionamento 1:N - Uma categoria pode ter varias tarefas
        public List<TarefaModel>? Tarefas { get; set; }
    }
}
