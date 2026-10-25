using Microsoft.AspNetCore.Mvc;
using projeto.Models;
using projeto.Repositorios.Interfaces;

namespace projeto.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class HabitoController : ControllerBase
    {
        private readonly IHabitoRepositorio _habitoRepositorio;

        public HabitoController(IHabitoRepositorio habitoRepositorio)
        {
            _habitoRepositorio = habitoRepositorio;
        }

        // GET api/Habito            -> todos
        // GET api/Habito?usuarioId=1 -> só os do usuário 1
        [HttpGet]
        public async Task<ActionResult<List<HabitoModel>>> BuscarTodos([FromQuery] int? usuarioId)
        {
            List<HabitoModel> habitos = await _habitoRepositorio.BuscarTodos(usuarioId);
            return Ok(habitos);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<HabitoModel>> BuscarPorId(int id)
        {
            HabitoModel? habito = await _habitoRepositorio.BuscarPorId(id);
            if (habito == null) return NotFound("Hábito não encontrado.");
            return Ok(habito);
        }

        [HttpPost]
        public async Task<ActionResult<HabitoModel>> Cadastrar([FromBody] HabitoModel habitoModel)
        {
            Validar(habitoModel);
            if (!ModelState.IsValid) return ValidationProblem(ModelState);

            HabitoModel habito = await _habitoRepositorio.Adicionar(habitoModel);
            return Ok(habito);
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<HabitoModel>> Atualizar([FromBody] HabitoModel habitoModel, int id)
        {
            Validar(habitoModel);
            if (!ModelState.IsValid) return ValidationProblem(ModelState);

            HabitoModel habito = await _habitoRepositorio.Atualizar(habitoModel, id);
            return Ok(habito);
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<bool>> Apagar(int id)
        {
            bool apagado = await _habitoRepositorio.Apagar(id);
            return Ok(apagado);
        }

        // POST api/Habito/gerar?usuarioId=1&de=2026-10-12&ate=2026-10-25
        // Cria as tarefas que faltam dos hábitos nesses dias e devolve as tarefas de hábito do período.
        // Sem "ate", gera só o dia "de". Sem "de", gera só hoje.
        [HttpPost("gerar")]
        public async Task<ActionResult<List<TarefaModel>>> Gerar([FromQuery] int usuarioId, [FromQuery] DateTime? de, [FromQuery] DateTime? ate)
        {
            DateTime inicio = (de ?? DateTime.Today).Date;
            DateTime fim = (ate ?? inicio).Date;

            if (usuarioId <= 0) ModelState.AddModelError("usuarioId", "Informe o usuário.");
            if (fim < inicio) ModelState.AddModelError("ate", "A data final vem antes da inicial.");
            if ((fim - inicio).TotalDays > 92) ModelState.AddModelError("ate", "Gere no máximo 93 dias por vez.");
            if (!ModelState.IsValid) return ValidationProblem(ModelState);

            List<TarefaModel> tarefas = await _habitoRepositorio.GerarTarefas(usuarioId, inicio, fim);
            return Ok(tarefas);
        }

        // As regras de negócio do hábito. Cada erro vai para o campo certo,
        // e o site mostra a mensagem embaixo do campo.
        private void Validar(HabitoModel h)
        {
            if (string.IsNullOrWhiteSpace(h.Titulo))
                ModelState.AddModelError(nameof(h.Titulo), "Dê um nome ao hábito.");

            if (h.Dias().Count == 0)
                ModelState.AddModelError(nameof(h.DiasSemana), "Escolha pelo menos um dia da semana (0 = domingo ... 6 = sábado).");

            // os dois horários ou nenhum (nenhum = lembrete)
            if ((h.HoraInicio == null) != (h.HoraFim == null))
                ModelState.AddModelError(nameof(h.HoraFim), "Preencha o início e o fim, ou deixe os dois vazios para um lembrete.");
            else if (h.HoraInicio != null && h.HoraInicio == h.HoraFim)
                ModelState.AddModelError(nameof(h.HoraFim), "O fim precisa ser diferente do início.");

            if (h.LembrarACadaMinutos != null)
            {
                if (!h.EhLembrete())
                    ModelState.AddModelError(nameof(h.LembrarACadaMinutos), "O aviso repetido é só para hábitos sem horário.");
                else if (h.LembrarACadaMinutos < 15 || h.LembrarACadaMinutos > 720)
                    ModelState.AddModelError(nameof(h.LembrarACadaMinutos), "Use de 15 a 720 minutos.");
            }

            if (h.DataFim != null && h.DataFim.Value.Date < h.DataInicio.Date)
                ModelState.AddModelError(nameof(h.DataFim), "O fim vem antes do início.");

            if (h.UsuarioId <= 0)
                ModelState.AddModelError(nameof(h.UsuarioId), "Informe o usuário.");
            if (h.CategoriaId <= 0)
                ModelState.AddModelError(nameof(h.CategoriaId), "Escolha uma área.");
        }
    }
}
