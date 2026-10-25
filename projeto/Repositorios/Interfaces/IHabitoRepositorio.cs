using projeto.Models;

namespace projeto.Repositorios.Interfaces
{
    public interface IHabitoRepositorio
    {
        Task<List<HabitoModel>> BuscarTodos(int? usuarioId);
        Task<HabitoModel?> BuscarPorId(int id);
        Task<HabitoModel> Adicionar(HabitoModel habito);
        Task<HabitoModel> Atualizar(HabitoModel habito, int id);
        Task<bool> Apagar(int id);

        /// <summary>
        /// Cria as tarefas dos hábitos do usuário para cada dia de "de" até "ate" (as que faltarem)
        /// e devolve todas as tarefas de hábito desse período.
        /// </summary>
        Task<List<TarefaModel>> GerarTarefas(int usuarioId, DateTime de, DateTime ate);
    }
}
