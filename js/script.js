// Configuração dos 6 meses do plano semestral
const MESES = [
  { ano: 2026, mes: 10, nome: "NOVEMBRO 2026" },
  { ano: 2026, mes: 11, nome: "DEZEMBRO 2026" },
  { ano: 2027, mes: 0, nome: "JANEIRO 2027" },
  { ano: 2027, mes: 1, nome: "FEVEREIRO 2027" },
  { ano: 2027, mes: 2, nome: "MARÇO 2027" },
  { ano: 2027, mes: 3, nome: "ABRIL 2027" },
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const NOMES_MESES_ABREV = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

// Estado da Aplicação e Carregamento do LocalStorage
let agendamentos = JSON.parse(
  localStorage.getItem("planejamento_2026_2027"),
) || [
  {
    id: "ex-1",
    titulo: "RECESSO",
    dataInicio: "2026-12-21",
    dataFim: "2026-12-22",
    horario: "",
    prioridade: "baixa",
    detalhes: "Período reservado para recesso de final de ano.",
  },
  {
    id: "ex-2",
    titulo: "DISSIDIO",
    dataInicio: "2026-11-26",
    dataFim: "2026-11-27",
    horario: "14:00",
    prioridade: "alta",
    detalhes: "Reunião de alinhamento sobre dissídio coletivo.",
  },
];

let modalInstance = null;

// Inicialização dos eventos do ciclo de vida da página
document.addEventListener("DOMContentLoaded", () => {
  modalInstance = new bootstrap.Modal(document.getElementById("modalEvento"));
  renderizarMeses();
  renderizarAgendamentos();

  // Submissão do formulário
  document
    .getElementById("formAgendamento")
    .addEventListener("submit", salvarAgendamento);

  // Ordenação de agendamentos
  document
    .getElementById("filtroOrdenacao")
    .addEventListener("change", renderizarAgendamentos);

  // Abertura limpa do modal
  document
    .getElementById("btnNovoAgendamento")
    .addEventListener("click", () => limparFormulario());

  // Exportação (PDF + JSON)
  document
    .getElementById("btnExportarPDF")
    .addEventListener("click", exportarPDF);

  // Importação do backup JSON
  const btnImportar = document.getElementById("btnImportarJSON");
  const inputImportar = document.getElementById("inputImportarJSON");

  if (btnImportar && inputImportar) {
    btnImportar.addEventListener("click", () => inputImportar.click());
    inputImportar.addEventListener("change", importarBackupJSON);
  }
});

// Renderização dos 6 Blocos de Calendário
function renderizarMeses() {
  const container = document.getElementById("calendariosContainer");
  container.innerHTML = "";

  MESES.forEach((config) => {
    const col = document.createElement("div");
    col.className = "col";

    const card = document.createElement("div");
    card.className = "month-card";

    const titulo = document.createElement("div");
    titulo.className = "month-header-title";
    titulo.textContent = config.nome;
    card.appendChild(titulo);

    const grid = document.createElement("div");
    grid.className = "calendar-grid";

    // Cabeçalho dos dias da semana
    DIAS_SEMANA.forEach((dia) => {
      const headerCell = document.createElement("div");
      headerCell.className = "cal-header";
      headerCell.textContent = dia;
      grid.appendChild(headerCell);
    });

    // Cálculos de datas do mês
    const primeiroDiaSemana = new Date(config.ano, config.mes, 1).getDay();
    const totalDiasMes = new Date(config.ano, config.mes + 1, 0).getDate();

    // Células vazias iniciais
    for (let i = 0; i < primeiroDiaSemana; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "cal-day empty";
      grid.appendChild(emptyCell);
    }

    // Dias do mês
    for (let dia = 1; dia <= totalDiasMes; dia++) {
      const dataIso = `${config.ano}-${String(config.mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      const dayCell = document.createElement("div");
      dayCell.className = "cal-day";
      dayCell.textContent = String(dia).padStart(2, "0");
      dayCell.dataset.date = dataIso;

      // Destaca dia se pertencer a algum período agendado
      if (diaPossuiEvento(dataIso)) {
        dayCell.classList.add("has-event");
      }

      // Atalho: clicar no dia abre o modal pré-definido com essa data
      dayCell.addEventListener("click", () => abrirModalParaData(dataIso));

      grid.appendChild(dayCell);
    }

    card.appendChild(grid);
    col.appendChild(card);
    container.appendChild(col);
  });
}

// Validação se uma data arbitrária faz parte de um agendamento
function diaPossuiEvento(dataIso) {
  return agendamentos.some((item) => {
    const inicio = item.dataInicio;
    const fim = item.dataFim || item.dataInicio;
    return dataIso >= inicio && dataIso <= fim;
  });
}

// Renderização do Painel de Agendamentos (Lado Direito)
function renderizarAgendamentos() {
  const container = document.getElementById("listaAgendamentos");
  container.innerHTML = "";

  const ordenacao = document.getElementById("filtroOrdenacao").value;
  const itensOrdenados = [...agendamentos].sort((a, b) => {
    if (ordenacao === "data-asc")
      return a.dataInicio.localeCompare(b.dataInicio);
    if (ordenacao === "data-desc")
      return b.dataInicio.localeCompare(a.dataInicio);
    if (ordenacao === "prioridade") {
      const peso = { alta: 3, media: 2, baixa: 1, none: 0 };
      return (peso[b.prioridade] || 0) - (peso[a.prioridade] || 0);
    }
    return 0;
  });

  if (itensOrdenados.length === 0) {
    container.innerHTML = `<div class="text-center text-muted py-4 small">Nenhum agendamento cadastrado.</div>`;
    return;
  }

  itensOrdenados.forEach((item) => {
    const card = document.createElement("div");
    card.className = "appointment-card";
    card.id = `card-${item.id}`;

    const dataPartes = item.dataInicio.split("-");
    const diaInicio = dataPartes[2];
    const mesInicioNum = parseInt(dataPartes[1], 10) - 1;
    const mesInicioStr = NOMES_MESES_ABREV[mesInicioNum];
    const horaFormatada = item.horario ? item.horario : "--";

    card.innerHTML = `
      <div class="appointment-summary" onclick="alternarDetalhes('${item.id}')">
        <span class="tag-badge">${diaInicio}</span>
        <span class="tag-badge">${mesInicioStr}</span>
        <span class="tag-badge">${horaFormatada}</span>
        <span class="appointment-title" title="${item.titulo}">${item.titulo}</span>
        <span class="priority-badge priority-${item.prioridade}">${item.prioridade}</span>
      </div>
      <div class="appointment-details collapse" id="collapse-${item.id}">
        <div class="details-label">DESCRIÇÃO</div>
        <div class="details-text mb-2">${item.detalhes ? item.detalhes : '<em class="text-muted">Sem detalhes adicionais.</em>'}</div>
        <div class="small text-secondary mb-2">
          <strong>Período:</strong> ${formatarDataBr(item.dataInicio)} ${item.dataFim ? " até " + formatarDataBr(item.dataFim) : ""}
          ${item.horario ? " às " + item.horario : ""}
        </div>
        <div class="d-flex justify-content-end gap-1" data-html2canvas-ignore="true">
          <button class="btn btn-sm btn-outline-dark py-0 px-2" onclick="editarAgendamento('${item.id}')" title="Editar">
            <i class="bi bi-pencil-fill"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirAgendamento('${item.id}')" title="Excluir">
            <i class="bi bi-trash-fill"></i>
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// Expansão / Maximização dos Detalhes
window.alternarDetalhes = function (id) {
  const el = document.getElementById(`collapse-${id}`);
  const bsCollapse = bootstrap.Collapse.getOrCreateInstance(el);
  bsCollapse.toggle();
};

// Funções de Gestão e Persistência do Formulário
function abrirModalParaData(dataIso) {
  limparFormulario();
  document.getElementById("dataInicio").value = dataIso;
  modalInstance.show();
}

function limparFormulario() {
  document.getElementById("formAgendamento").reset();
  document.getElementById("agendamentoId").value = "";
  document.getElementById("modalEventoLabel").textContent =
    "Cadastrar Agendamento";
}

function salvarAgendamento(e) {
  e.preventDefault();

  const id =
    document.getElementById("agendamentoId").value || "ev-" + Date.now();
  const titulo = document.getElementById("titulo").value.trim();
  const dataInicio = document.getElementById("dataInicio").value;
  const dataFim = document.getElementById("dataFim").value;
  const horario = document.getElementById("horario").value;
  const prioridade = document.getElementById("prioridade").value;
  const detalhes = document.getElementById("detalhes").value.trim();

  if (dataFim && dataFim < dataInicio) {
    alert("A data final não pode ser anterior à data inicial.");
    return;
  }

  const index = agendamentos.findIndex((ev) => ev.id === id);
  const payload = {
    id,
    titulo,
    dataInicio,
    dataFim,
    horario,
    prioridade,
    detalhes,
  };

  if (index >= 0) {
    agendamentos[index] = payload;
  } else {
    agendamentos.push(payload);
  }

  localStorage.setItem("planejamento_2026_2027", JSON.stringify(agendamentos));
  modalInstance.hide();

  renderizarMeses();
  renderizarAgendamentos();
}

window.editarAgendamento = function (id) {
  const item = agendamentos.find((ev) => ev.id === id);
  if (!item) return;

  document.getElementById("agendamentoId").value = item.id;
  document.getElementById("titulo").value = item.titulo;
  document.getElementById("dataInicio").value = item.dataInicio;
  document.getElementById("dataFim").value = item.dataFim || "";
  document.getElementById("horario").value = item.horario || "";
  document.getElementById("prioridade").value = item.prioridade || "none";
  document.getElementById("detalhes").value = item.detalhes || "";

  document.getElementById("modalEventoLabel").textContent =
    "Editar Agendamento";
  modalInstance.show();
};

window.excluirAgendamento = function (id) {
  if (!confirm("Deseja realmente remover este agendamento?")) return;

  agendamentos = agendamentos.filter((ev) => ev.id !== id);
  localStorage.setItem("planejamento_2026_2027", JSON.stringify(agendamentos));

  renderizarMeses();
  renderizarAgendamentos();
};

// Funções Utilitárias
function formatarDataBr(dataIso) {
  if (!dataIso) return "";
  const [a, m, d] = dataIso.split("-");
  return `${d}/${m}/${a}`;
}

// Download do arquivo de dados JSON
function baixarArquivoJSON() {
  const dados = {
    versao: "1.0",
    exportadoEm: new Date().toISOString(),
    totalAgendamentos: agendamentos.length,
    agendamentos: agendamentos,
  };

  const jsonString = JSON.stringify(dados, null, 2);
  const blob = new Blob([jsonString], {
    type: "application/json;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `backup_planejamento_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Rotina Unificada: Descarrega o JSON e Gera o PDF em Folha A4 Paisagem
function exportarPDF() {
  // 1. Gera e descarrega o ficheiro JSON
  baixarArquivoJSON();

  // 2. Expande todas as descrições para saírem completas no PDF
  const collapses = document.querySelectorAll(".appointment-details");
  collapses.forEach((el) => el.classList.add("show"));

  const elemento = document.getElementById("exportArea");
  const opcoes = {
    margin: [8, 8, 8, 8],
    filename: `Planejamento_Semestral_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
  };

  html2pdf()
    .set(opcoes)
    .from(elemento)
    .save()
    .then(() => {
      // Recolhe novamente as descrições após renderizar o PDF
      collapses.forEach((el) => el.classList.remove("show"));
    });
}

// Importação e Restauração de Dados a Partir de um Ficheiro JSON
function importarBackupJSON(event) {
  const arquivo = event.target.files[0];
  if (!arquivo) return;

  const leitor = new FileReader();
  leitor.onload = function (e) {
    try {
      const conteudo = JSON.parse(e.target.result);
      const listaImportada = Array.isArray(conteudo)
        ? conteudo
        : conteudo.agendamentos;

      if (!Array.isArray(listaImportada)) {
        throw new Error("Estrutura do ficheiro JSON inválida.");
      }

      if (
        confirm(
          `Deseja importar ${listaImportada.length} agendamentos? Isso substituirá a lista atual.`,
        )
      ) {
        agendamentos = listaImportada;
        localStorage.setItem(
          "planejamento_2026_2027",
          JSON.stringify(agendamentos),
        );
        renderizarMeses();
        renderizarAgendamentos();
        alert("Agendamentos importados com sucesso!");
      }
    } catch (erro) {
      alert(
        "Falha ao ler o ficheiro JSON. Certifique-se de que é um backup válido gerado pela aplicação.",
      );
      console.error(erro);
    } finally {
      event.target.value = "";
    }
  };
  leitor.readAsText(arquivo);
}
