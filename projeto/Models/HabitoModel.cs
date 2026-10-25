using System.Text.Json.Serialization;

namespace projeto.Models
{
    // Um hábito é a regra ("academia seg, qua e sex, das 18:30 às 19:30").
    // As tarefas de cada dia nascem dele em POST /api/Habito/gerar, só quando o dia chega.
    // Assim o banco não recebe semanas de tarefas de uma vez.
    public class HabitoModel
    {
        public int Id { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public string Descricao { get; set; } = string.Empty;

        // Dias da semana em que o hábito acontece, separados por vírgula.
        // 0 = domingo, 1 = segunda ... 6 = sábado. Ex.: "1,3,5"
        public string DiasSemana { get; set; } = string.Empty;

        // Com horário (estudo, academia): preencha os dois.
        // Sem horário (beber água): deixe os dois nulos. Aí ele vira um LEMBRETE:
        // a tarefa vale o dia todo (00:00 às 23:59) e nunca fica "atrasada".
        // Se o fim for menor que o início (dormir 23:00 às 07:00), termina no dia seguinte.
        public TimeOnly? HoraInicio { get; set; }
        public TimeOnly? HoraFim { get; set; }

        // Só para lembretes: de quanto em quanto tempo avisar. Ex.: 120 = a cada 2 horas.
        public int? LembrarACadaMinutos { get; set; }

        // Quando o hábito começa e, se quiser, quando acaba (nulo = sem prazo)
        public DateTime DataInicio { get; set; } = DateTime.Today;
        public DateTime? DataFim { get; set; }

        // Encerrar um hábito = Ativo false. O histórico (tarefas já feitas) continua no banco.
        public bool Ativo { get; set; } = true;
        public DateTime DataCriacao { get; set; } = DateTime.Now;

        // Chave estrangeira - Usuario
        public int UsuarioId { get; set; }
        public UsuarioModel? Usuario { get; set; }

        // Chave estrangeira - Categoria
        public int CategoriaId { get; set; }
        public CategoriaModel? Categoria { get; set; }

        // Relacionamento 1:N - as tarefas geradas por este hábito.
        // [JsonIgnore] pelo mesmo motivo do Usuario e da Categoria: evita o JSON crescer sem parar.
        [JsonIgnore]
        public List<TarefaModel>? Tarefas { get; set; }

        // ------------------------------------------------------------ regras
        // Métodos não viram colunas no banco nem campos no JSON.

        /// <summary>"1,3,5" -> [Monday, Wednesday, Friday]. Ignora o que não for 0 a 6.</summary>
        public List<DayOfWeek> Dias()
        {
            return DiasSemana
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(d => int.TryParse(d, out int n) ? n : -1)
                .Where(n => n >= 0 && n <= 6)
                .Distinct()
                .Select(n => (DayOfWeek)n)
                .ToList();
        }

        /// <summary>Sem horário = lembrete.</summary>
        public bool EhLembrete() => HoraInicio == null && HoraFim == null;

        /// <summary>O hábito acontece nesse dia?</summary>
        public bool OcorreEm(DateTime dia)
        {
            dia = dia.Date;
            if (!Ativo) return false;
            if (dia < DataInicio.Date) return false;
            if (DataFim != null && dia > DataFim.Value.Date) return false;
            return Dias().Contains(dia.DayOfWeek);
        }

        /// <summary>Início e fim da tarefa desse dia.</summary>
        public (DateTime inicio, DateTime fim) HorarioEm(DateTime dia)
        {
            dia = dia.Date;
            if (HoraInicio == null || HoraFim == null)
                return (dia, dia.AddDays(1).AddMinutes(-1)); // lembrete: 00:00 às 23:59

            DateTime inicio = dia.Add(HoraInicio.Value.ToTimeSpan());
            DateTime fim = dia.Add(HoraFim.Value.ToTimeSpan());
            if (fim <= inicio) fim = fim.AddDays(1); // atravessa a meia-noite
            return (inicio, fim);
        }
    }
}
