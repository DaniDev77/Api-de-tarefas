using Microsoft.EntityFrameworkCore;
using projeto.Data;
using projeto.Repositorios;
using projeto.Repositorios.Interfaces;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// CORS: autoriza o frontend (pasta web, aberta pelo Live Server) a chamar esta API pelo navegador.
// Em desenvolvimento libera qualquer origem; em producao, so as origens listadas em appsettings.json.
var origensFrontend = builder.Configuration.GetSection("Frontend:Origens").Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        if (builder.Environment.IsDevelopment())
            policy.AllowAnyOrigin();
        else
            policy.WithOrigins(origensFrontend);

        policy.AllowAnyHeader().AllowAnyMethod();
    });
});

// Add services to the container.
builder.Services.AddControllers(options =>
    {
        // Permite Descricao e Telefone vazios (""). Sem isso o [ApiController] trata
        // toda string nao-anulavel como [Required] e devolve 400 para campos opcionais.
        options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Entity Framework - SQL Server
builder.Services.AddDbContext<SistemaTarefasDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DataBase"))
);

// Injecao de Dependencia
builder.Services.AddScoped<IUsuarioRepositorio, UsuarioRepositorio>();
builder.Services.AddScoped<ITarefaRepositorio, TarefaRepositorio>();
builder.Services.AddScoped<ICategoriaRepositorio, CategoriaRepositorio>();
builder.Services.AddScoped<IHabitoRepositorio, HabitoRepositorio>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("Frontend");

app.UseAuthorization();

app.MapControllers();

app.Run();
