namespace projeto.Models
{
    public class UsuarioModel
    {
        public int Id { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Telefone { get; set; } = string.Empty;

        // Relacionamento 1:N - Um usuario pode ter varias tarefas
        public List<TarefaModel>? Tarefas { get; set; }
    }
}
