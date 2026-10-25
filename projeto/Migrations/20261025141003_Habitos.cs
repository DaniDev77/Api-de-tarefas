using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace projeto.Migrations
{
    /// <inheritdoc />
    public partial class Habitos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tarefas_UsuarioId",
                table: "Tarefas");

            migrationBuilder.AddColumn<DateTime>(
                name: "DataInicio",
                table: "Tarefas",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HabitoId",
                table: "Tarefas",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Habitos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Titulo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Descricao = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    DiasSemana = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    HoraInicio = table.Column<TimeOnly>(type: "time", nullable: true),
                    HoraFim = table.Column<TimeOnly>(type: "time", nullable: true),
                    LembrarACadaMinutos = table.Column<int>(type: "int", nullable: true),
                    DataInicio = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DataFim = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Ativo = table.Column<bool>(type: "bit", nullable: false),
                    DataCriacao = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UsuarioId = table.Column<int>(type: "int", nullable: false),
                    CategoriaId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Habitos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Habitos_Categorias_CategoriaId",
                        column: x => x.CategoriaId,
                        principalTable: "Categorias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Habitos_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Tarefas_HabitoId_DataInicio",
                table: "Tarefas",
                columns: new[] { "HabitoId", "DataInicio" });

            migrationBuilder.CreateIndex(
                name: "IX_Tarefas_UsuarioId_DataLimite",
                table: "Tarefas",
                columns: new[] { "UsuarioId", "DataLimite" });

            migrationBuilder.CreateIndex(
                name: "IX_Habitos_CategoriaId",
                table: "Habitos",
                column: "CategoriaId");

            migrationBuilder.CreateIndex(
                name: "IX_Habitos_UsuarioId",
                table: "Habitos",
                column: "UsuarioId");

            migrationBuilder.AddForeignKey(
                name: "FK_Tarefas_Habitos_HabitoId",
                table: "Tarefas",
                column: "HabitoId",
                principalTable: "Habitos",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tarefas_Habitos_HabitoId",
                table: "Tarefas");

            migrationBuilder.DropTable(
                name: "Habitos");

            migrationBuilder.DropIndex(
                name: "IX_Tarefas_HabitoId_DataInicio",
                table: "Tarefas");

            migrationBuilder.DropIndex(
                name: "IX_Tarefas_UsuarioId_DataLimite",
                table: "Tarefas");

            migrationBuilder.DropColumn(
                name: "DataInicio",
                table: "Tarefas");

            migrationBuilder.DropColumn(
                name: "HabitoId",
                table: "Tarefas");

            migrationBuilder.CreateIndex(
                name: "IX_Tarefas_UsuarioId",
                table: "Tarefas",
                column: "UsuarioId");
        }
    }
}
