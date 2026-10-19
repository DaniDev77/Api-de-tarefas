using Microsoft.AspNetCore.Mvc;
using projeto.Models;
using projeto.Repositorios.Interfaces;

namespace projeto.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CategoriaController : ControllerBase
    {
        private readonly ICategoriaRepositorio _categoriaRepositorio;

        public CategoriaController(ICategoriaRepositorio categoriaRepositorio)
        {
            _categoriaRepositorio = categoriaRepositorio;
        }

        [HttpGet]
        public async Task<ActionResult<List<CategoriaModel>>> BuscarTodasCategorias()
        {
            List<CategoriaModel> categorias = await _categoriaRepositorio.BuscarTodasCategorias();
            return Ok(categorias);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<CategoriaModel>> BuscarPorId(int id)
        {
            CategoriaModel? categoria = await _categoriaRepositorio.BuscarPorId(id);
            if (categoria == null) return NotFound("Categoria nao encontrada.");
            return Ok(categoria);
        }

        [HttpPost]
        public async Task<ActionResult<CategoriaModel>> Cadastrar([FromBody] CategoriaModel categoriaModel)
        {
            CategoriaModel categoria = await _categoriaRepositorio.Adicionar(categoriaModel);
            return Ok(categoria);
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<CategoriaModel>> Atualizar([FromBody] CategoriaModel categoriaModel, int id)
        {
            CategoriaModel categoria = await _categoriaRepositorio.Atualizar(categoriaModel, id);
            return Ok(categoria);
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<bool>> Apagar(int id)
        {
            bool apagado = await _categoriaRepositorio.Apagar(id);
            return Ok(apagado);
        }
    }
}
