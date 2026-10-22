using System.Text.Json.Serialization;

namespace projeto.Models
{
    public class UsuarioModel
    {
        public int Id { get; set; }
        public string Nome { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Telefone { get; set; } = string.Empty;

        // Relacionamento 1:N - Um usuario pode ter varias tarefas
        // [JsonIgnore]: a lista fica fora do JSON. Sem isso, cada tarefa devolvida em GET /api/Tarefa
        // traria o usuario com TODAS as tarefas dele, e cada uma delas de novo... o JSON cresce
        // sem parar (com ~170 tarefas passa de 40 milhões de objetos) e a API cai no meio da resposta.
        [JsonIgnore]
        public List<TarefaModel>? Tarefas { get; set; }
    }
}
