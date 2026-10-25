using Microsoft.AspNetCore.Mvc;
using projeto.Models;
using projeto.Repositorios.Interfaces;

namespace projeto.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TarefaController : ControllerBase
    {
        private readonly ITarefaRepositorio _tarefaRepositorio;

        public TarefaController(ITarefaRepositorio tarefaRepositorio)
        {
            _tarefaRepositorio = tarefaRepositorio;
        }

        // GET api/Tarefa                                   -> todas
        // GET api/Tarefa?usuarioId=1&de=2026-10-01&ate=2026-10-31 -> filtradas
        [HttpGet]
        public async Task<ActionResult<List<TarefaModel>>> BuscarTodasTarefas([FromQuery] int? usuarioId, [FromQuery] DateTime? de, [FromQuery] DateTime? ate)
        {
            List<TarefaModel> tarefas = await _tarefaRepositorio.BuscarTodasTarefas(usuarioId, de, ate);
            return Ok(tarefas);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TarefaModel>> BuscarPorId(int id)
        {
            TarefaModel? tarefa = await _tarefaRepositorio.BuscarPorId(id);
            if (tarefa == null) return NotFound("Tarefa nao encontrada.");
            return Ok(tarefa);
        }

        [HttpPost]
        public async Task<ActionResult<TarefaModel>> Cadastrar([FromBody] TarefaModel tarefaModel)
        {
            if (tarefaModel.DataInicio > tarefaModel.DataLimite)
            {
                ModelState.AddModelError(nameof(tarefaModel.DataLimite), "O fim vem antes do início.");
                return ValidationProblem(ModelState);
            }
            TarefaModel tarefa = await _tarefaRepositorio.Adicionar(tarefaModel);
            return Ok(tarefa);
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<TarefaModel>> Atualizar([FromBody] TarefaModel tarefaModel, int id)
        {
            if (tarefaModel.DataInicio > tarefaModel.DataLimite)
            {
                ModelState.AddModelError(nameof(tarefaModel.DataLimite), "O fim vem antes do início.");
                return ValidationProblem(ModelState);
            }
            TarefaModel tarefa = await _tarefaRepositorio.Atualizar(tarefaModel, id);
            return Ok(tarefa);
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<bool>> Apagar(int id)
        {
            bool apagado = await _tarefaRepositorio.Apagar(id);
            return Ok(apagado);
        }
    }
}
