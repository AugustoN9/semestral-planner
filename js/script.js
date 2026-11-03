// ==========================================================================
// 1. Configuração e Conexão ao Supabase (PostgreSQL)
// ==========================================================================
const SUPABASE_URL = "https://ocmjbfwvfznmyadfputs.supabase.co";
// Publishable key do projeto Auguston9's Project
const SUPABASE_ANON_KEY = "sb_publishable_OaH32KQANvAqMKR0ygVvUA_gYK0ZCI2";

const supabaseClient =
  typeof supabase !== "undefined"
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// ==========================================================================
// 2. Configurações Globais, Categorias, Cores e Ícones
// ==========================================================================
let configSemestre = JSON.parse(localStorage.getItem("config_semestre")) || {
  anoInicio: 2026,
  mesInicio: 10, // Novembro (0-indexado)
};

let MESES = [];
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
const NOMES_MESES_COMPLETOS = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

function gerarConfiguracaoSemestre(anoInicio, mesInicio, totalMeses = 6) {
  const meses = [];
  for (let i = 0; i < totalMeses; i++) {
    const dataRef = new Date(anoInicio, mesInicio + i, 1);
    const ano = dataRef.getFullYear();
    const mes = dataRef.getMonth();

    meses.push({
      ano: ano,
      mes: mes,
      nome: `${NOMES_MESES_COMPLETOS[mes]} ${ano}`,
    });
  }
  return meses;
}

const CORES_CATEGORIAS = {
  ferias: "#9ce69e",
  recesso: "#ffcf29",
  dissidio: "#ffaf24",
  saude: "#d7f3e8",
  viagem: "#bae6fd",
  passeio: "#e9d5ff",
  aniversario: "#fbcfe8",
  festa: "#fef08a",
  academia: "#fed7aa",
  geral: "#cbd5e1",
};

const ICONES_CATEGORIAS = {
  ferias: "bi-sun-fill text-success",
  recesso: "bi-tree-fill text-warning", // Fim de ano / Recesso
  dissidio: "bi-cash-coin text-warning",
  saude: "bi-heart-pulse-fill text-info",
  viagem: "bi-airplane-fill text-primary",
  passeio: "bi-bicycle text-purple", // Pessoa andando de bicicleta
  aniversario: "bi-cake2-fill text-danger", // Bolo de aniversário
  festa: "bi-cup-straw text-warning", // Garrafa/Brinde/Festa
  academia: "bi-person-walking text-danger", // Pessoa correndo/atividade
  geral: "bi-calendar-event text-secondary",
};

let agendamentos = [];
let feriadosNacionais = {};
let modalEventoInstance = null;
let modalConfigInstance = null;
let cardsColapsados = true;

// ==========================================================================
// 3. Inicialização Assíncrona da Aplicação
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  modalEventoInstance = new bootstrap.Modal(
    document.getElementById("modalEvento"),
  );
  modalConfigInstance = new bootstrap.Modal(
    document.getElementById("modalConfiguracoes"),
  );

  atualizarConfiguracaoSemestre(
    configSemestre.anoInicio,
    configSemestre.mesInicio,
    false,
  );

  try {
    await carregarConfiguracaoSupabase();
    await Promise.all([
      carregarAgendamentosSupabase(),
      carregarFeriadosDosAnosDoSemestre(),
    ]);
  } catch (err) {
    console.error("Falha ao inicializar dados assíncronos:", err);
  } finally {
    renderizarMeses();
    renderizarAgendamentos();
  }

  // Eventos de formulários e botões
  document
    .getElementById("formAgendamento")
    .addEventListener("submit", salvarAgendamento);
  document
    .getElementById("formConfiguracoes")
    .addEventListener("submit", aplicarNovasConfiguracoes);
  document
    .getElementById("filtroOrdenacao")
    .addEventListener("change", renderizarAgendamentos);
  document
    .getElementById("btnNovoAgendamento")
    .addEventListener("click", () => limparFormulario());
  document
    .getElementById("btnAlternarTodosCards")
    .addEventListener("click", alternarTodosCards);
  document
    .getElementById("btnExportarPDF")
    .addEventListener("click", exportarPDF);
});

// ==========================================================================
// 4. Operações Remotas no Supabase (Leitura e Fallback)
// ==========================================================================

async function carregarConfiguracaoSupabase() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient
      .from("configuracao_semestre")
      .select("ano_inicio, mes_inicio")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      atualizarConfiguracaoSemestre(data.ano_inicio, data.mes_inicio, true);
    }
  } catch (err) {
    console.warn("Aviso ao carregar configuração do Supabase:", err);
  }
}

async function carregarAgendamentosSupabase() {
  if (!supabaseClient) {
    carregarAgendamentosLocaisFallback();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("agendamentos")
      .select("*")
      .order("data_inicio", { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      agendamentos = data.map((item) => ({
        id: item.id,
        titulo: item.titulo,
        categoria: item.categoria || "geral",
        prioridade: item.prioridade || "none",
        dataInicio: item.data_inicio,
        dataFim: item.data_fim || "",
        horario: item.horario || "",
        horarioFim: item.horario_fim || "",
        detalhes: item.detalhes || "",
        concluido: Boolean(item.concluido),
      }));
      localStorage.setItem(
        "planejamento_2026_2027",
        JSON.stringify(agendamentos),
      );
      return;
    }

    carregarAgendamentosLocaisFallback();
  } catch (err) {
    console.warn("Supabase inacessível, utilizando cache local:", err);
    carregarAgendamentosLocaisFallback();
  }
}

function carregarAgendamentosLocaisFallback() {
  const dadosLocais = localStorage.getItem("planejamento_2026_2027");
  if (dadosLocais) {
    try {
      const parsed = JSON.parse(dadosLocais);
      agendamentos = Array.isArray(parsed) ? parsed : parsed.agendamentos || [];
      if (Array.isArray(agendamentos) && agendamentos.length > 0) return;
    } catch (e) {
      console.warn("Aviso ao ler localStorage:", e);
    }
  }

  agendamentos = [];
}

// ==========================================================================
// 5. Configuração de Semestre e Feriados Dinâmicos
// ==========================================================================

function atualizarConfiguracaoSemestre(anoInicio, mesInicio, persistir = true) {
  configSemestre = {
    anoInicio: parseInt(anoInicio, 10),
    mesInicio: parseInt(mesInicio, 10),
  };
  if (persistir) {
    localStorage.setItem("config_semestre", JSON.stringify(configSemestre));
  }

  MESES = gerarConfiguracaoSemestre(
    configSemestre.anoInicio,
    configSemestre.mesInicio,
    6,
  );

  const primeiroMesAno = MESES[0];
  const ultimoMesAno = MESES[MESES.length - 1];
  const textoAnos =
    primeiroMesAno.ano === ultimoMesAno.ano
      ? `${primeiroMesAno.ano}`
      : `${primeiroMesAno.ano}-${ultimoMesAno.ano}`;

  const elTitulo = document.getElementById("tituloApp");
  if (elTitulo) {
    elTitulo.textContent = `PLANEJAMENTO SEMESTRAL ${textoAnos}`;
  }

  const elMes = document.getElementById("configMesInicio");
  const elAno = document.getElementById("configAnoInicio");
  if (elMes) elMes.value = configSemestre.mesInicio;
  if (elAno) elAno.value = configSemestre.anoInicio;
}

async function aplicarNovasConfiguracoes(e) {
  e.preventDefault();
  const novoMes = parseInt(
    document.getElementById("configMesInicio").value,
    10,
  );
  const novoAno = parseInt(
    document.getElementById("configAnoInicio").value,
    10,
  );

  atualizarConfiguracaoSemestre(novoAno, novoMes, true);

  if (supabaseClient) {
    try {
      await supabaseClient
        .from("configuracao_semestre")
        .upsert({ id: 1, ano_inicio: novoAno, mes_inicio: novoMes });
    } catch (err) {
      console.warn("Erro ao persistir configuração no Supabase:", err);
    }
  }

  await carregarFeriadosDosAnosDoSemestre();
  renderizarMeses();
  renderizarAgendamentos();
  modalConfigInstance.hide();

  Swal.fire({
    icon: "success",
    title: "Semestre Atualizado",
    text: "A nova sequência de meses foi recalculada com sucesso!",
    timer: 1600,
    showConfirmButton: false,
  });
}

async function carregarFeriadosDosAnosDoSemestre() {
  const anosDoSemestre = [...new Set(MESES.map((m) => m.ano))];
  const chaveCache = `feriados_${anosDoSemestre.join("_")}`;
  const cache = localStorage.getItem(chaveCache);

  if (cache) {
    try {
      feriadosNacionais = JSON.parse(cache);
      return;
    } catch (e) {
      console.warn("Erro ao ler cache de feriados:", e);
    }
  }

  try {
    const requisicoes = anosDoSemestre.map((ano) =>
      fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`).then((res) =>
        res.json(),
      ),
    );
    const resultados = await Promise.all(requisicoes);

    const mapa = {};
    resultados.flat().forEach((item) => {
      if (item && item.date && item.name) {
        mapa[item.date] = item.name;
      }
    });

    feriadosNacionais = mapa;
    localStorage.setItem(chaveCache, JSON.stringify(mapa));
  } catch (erro) {
    console.warn("Falha na BrasilAPI, mantendo feriados padrão:", erro);
    feriadosNacionais = {
      "2026-11-02": "Finados",
      "2026-11-15": "Proclamação da República",
      "2026-11-20": "Dia da Consciência Negra",
      "2026-12-25": "Natal",
      "2027-01-01": "Confraternização Universal",
      "2027-02-08": "Carnaval",
      "2027-02-09": "Carnaval",
      "2027-03-26": "Sexta-feira Santa",
      "2027-03-28": "Páscoa",
      "2027-04-21": "Tiradentes",
    };
  }
}

// ==========================================================================
// 6. Renderização dos Meses com Feriados no Rodapé
// ==========================================================================
function renderizarMeses() {
  const container = document.getElementById("calendariosContainer");
  if (!container) return;
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

    DIAS_SEMANA.forEach((dia) => {
      const headerCell = document.createElement("div");
      headerCell.className = "cal-header";
      headerCell.textContent = dia;
      grid.appendChild(headerCell);
    });

    const primeiroDiaSemana = new Date(config.ano, config.mes, 1).getDay();
    const totalDiasMes = new Date(config.ano, config.mes + 1, 0).getDate();

    for (let i = 0; i < primeiroDiaSemana; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.className = "cal-day empty";
      grid.appendChild(emptyCell);
    }

    const feriadosDesteMes = [];

    for (let dia = 1; dia <= totalDiasMes; dia++) {
      const dataIso = `${config.ano}-${String(config.mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      const dayCell = document.createElement("div");
      dayCell.className = "cal-day";
      dayCell.textContent = String(dia).padStart(2, "0");
      dayCell.dataset.date = dataIso;

      const eventosNoDia = obterEventosDoDia(dataIso);
      const nomeFeriado = feriadosNacionais[dataIso];

      if (nomeFeriado) {
        dayCell.classList.add("is-holiday");
        dayCell.title = `Feriado: ${nomeFeriado}`;
        feriadosDesteMes.push({
          diaFormatado: `${String(dia).padStart(2, "0")}/${String(config.mes + 1).padStart(2, "0")}`,
          nome: nomeFeriado,
        });
      }

      if (eventosNoDia.length === 1) {
        const cat = eventosNoDia[0].categoria || "geral";
        dayCell.style.backgroundColor = CORES_CATEGORIAS[cat];
        dayCell.style.color = "#000000";
        dayCell.style.fontWeight = "700";
        dayCell.title =
          (nomeFeriado ? `[${nomeFeriado}] ` : "") + eventosNoDia[0].titulo;
      } else if (eventosNoDia.length > 1) {
        dayCell.classList.add("multiple-events");
        const coresUnicas = [
          ...new Set(
            eventosNoDia.map((e) => CORES_CATEGORIAS[e.categoria || "geral"]),
          ),
        ];

        if (coresUnicas.length === 1) {
          dayCell.style.backgroundColor = coresUnicas[0];
        } else {
          const step = 100 / coresUnicas.length;
          let gradientStops = [];
          coresUnicas.forEach((cor, idx) => {
            gradientStops.push(`${cor} ${idx * step}%`);
            gradientStops.push(`${cor} ${(idx + 1) * step}%`);
          });
          dayCell.style.background = `linear-gradient(135deg, ${gradientStops.join(", ")})`;
        }

        dayCell.style.color = "#000000";
        dayCell.style.fontWeight = "700";
        dayCell.title =
          (nomeFeriado ? `[${nomeFeriado}] ` : "") +
          `${eventosNoDia.length} eventos: ` +
          eventosNoDia.map((e) => e.titulo).join(", ");
      }

      dayCell.addEventListener("click", () => tratarCliqueNoDia(dataIso));
      grid.appendChild(dayCell);
    }

    card.appendChild(grid);

    // Rodapé de Feriados Logo Abaixo do Mês
    const rodapeFeriados = document.createElement("div");
    rodapeFeriados.className = "month-holidays-list";

    if (feriadosDesteMes.length > 0) {
      rodapeFeriados.innerHTML = feriadosDesteMes
        .map(
          (f, i) => `
        <span class="holiday-item">
          <span class="holiday-item-date">${f.diaFormatado}</span>
          <span class="holiday-item-name">${f.nome}</span>
          ${i < feriadosDesteMes.length - 1 ? '<span class="text-muted ms-1 me-1">•</span>' : ""}
        </span>
      `,
        )
        .join("");
    } else {
      rodapeFeriados.innerHTML = `<span class="text-muted fst-italic">Sem feriados nacionais</span>`;
    }

    card.appendChild(rodapeFeriados);
    col.appendChild(card);
    container.appendChild(col);
  });
}

function tratarCliqueNoDia(dataIso) {
  const eventosNoDia = obterEventosDoDia(dataIso);

  if (eventosNoDia.length > 0) {
    eventosNoDia.forEach((evento, index) => {
      const cardEl = document.getElementById(`card-${evento.id}`);
      if (cardEl) {
        const collapseEl = document.getElementById(`collapse-${evento.id}`);
        if (collapseEl) {
          bootstrap.Collapse.getOrCreateInstance(collapseEl).show();
        }

        if (index === 0) {
          cardEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        cardEl.classList.add("highlight-selected");
        setTimeout(() => {
          cardEl.classList.remove("highlight-selected");
        }, 2000);
      }
    });
  } else {
    abrirModalParaData(dataIso);
  }
}

function obterEventosDoDia(dataIso) {
  if (!Array.isArray(agendamentos)) return [];
  return agendamentos.filter((item) => {
    const inicio = item.dataInicio;
    const fim = item.dataFim || item.dataInicio;
    return dataIso >= inicio && dataIso <= fim;
  });
}

function alternarTodosCards() {
  const collapses = document.querySelectorAll(
    "#listaAgendamentos .appointment-details",
  );
  const icone = document.getElementById("iconeAlternarCards");

  if (cardsColapsados) {
    collapses.forEach((el) =>
      bootstrap.Collapse.getOrCreateInstance(el).show(),
    );
    if (icone) icone.className = "bi bi-arrows-expand";
    cardsColapsados = false;
  } else {
    collapses.forEach((el) =>
      bootstrap.Collapse.getOrCreateInstance(el).hide(),
    );
    if (icone) icone.className = "bi bi-arrows-collapse";
    cardsColapsados = true;
  }
}

// ==========================================================================
// 7. Renderização dos Agendamentos no Painel Lateral (To-Do & Ícones)
// ==========================================================================
function renderizarAgendamentos() {
  const container = document.getElementById("listaAgendamentos");
  if (!container) return;
  container.innerHTML = "";

  const listaCompleta = Array.isArray(agendamentos) ? [...agendamentos] : [];

  const ordenacao =
    document.getElementById("filtroOrdenacao")?.value || "data-asc";
  const itensOrdenados = listaCompleta.sort((a, b) => {
    if (ordenacao === "pendentes") {
      if (a.concluido !== b.concluido) return a.concluido ? 1 : -1;
      return (a.dataInicio || "").localeCompare(b.dataInicio || "");
    }
    if (ordenacao === "data-asc")
      return (a.dataInicio || "").localeCompare(b.dataInicio || "");
    if (ordenacao === "data-desc")
      return (b.dataInicio || "").localeCompare(a.dataInicio || "");
    if (ordenacao === "categoria")
      return (a.categoria || "").localeCompare(b.categoria || "");
    if (ordenacao === "prioridade") {
      const peso = { alta: 3, media: 2, baixa: 1, none: 0 };
      return (peso[b.prioridade] || 0) - (peso[a.prioridade] || 0);
    }
    return 0;
  });

  if (itensOrdenados.length === 0) {
    container.innerHTML = `<div class="text-center text-muted py-3 small">Nenhum agendamento cadastrado.</div>`;
    return;
  }

  itensOrdenados.forEach((item) => {
    const card = document.createElement("div");
    card.className = `appointment-card cat-theme-${item.categoria || "geral"} ${item.concluido ? "is-completed" : ""}`;
    card.id = `card-${item.id}`;

    const temDetalhes = Boolean(
      item.detalhes && item.detalhes.trim().length > 0,
    );
    if (temDetalhes) {
      card.classList.add("has-custom-details");
    }

    const pInicio = (item.dataInicio || "").split("-");
    const diaIni = pInicio[2] || "--";
    const mesIni = pInicio[1]
      ? NOMES_MESES_ABREV[parseInt(pInicio[1], 10) - 1]
      : "--";

    let blocosDataHtml = "";

    if (item.dataFim && item.dataFim !== item.dataInicio) {
      const pFim = item.dataFim.split("-");
      const diaFim = pFim[2] || "--";
      const mesFim = pFim[1]
        ? NOMES_MESES_ABREV[parseInt(pFim[1], 10) - 1]
        : "--";
      const diferencaDias = calcularDiferencaDias(
        item.dataInicio,
        item.dataFim,
      );

      blocosDataHtml = `
        <span class="tag-badge">${diaIni}</span>
        <span class="tag-badge">${mesIni}</span>
        <span class="fw-bold small text-secondary">-</span>
        <span class="tag-badge">${diaFim}</span>
        <span class="tag-badge">${mesFim}</span>
        <span class="tag-badge">${diferencaDias} ${diferencaDias === 1 ? "dia" : "dias"}</span>
      `;
    } else {
      let horarioFormatado = "--";
      if (item.horario && item.horarioFim) {
        horarioFormatado = `${item.horario} - ${item.horarioFim}`;
      } else if (item.horario) {
        horarioFormatado = item.horario;
      }

      blocosDataHtml = `
        <span class="tag-badge">${diaIni}</span>
        <span class="tag-badge">${mesIni}</span>
        <span class="tag-badge">${horarioFormatado}</span>
      `;
    }

    const labelStatus =
      item.prioridade && item.prioridade !== "none"
        ? item.prioridade.toUpperCase()
        : item.categoria
          ? item.categoria.toUpperCase()
          : "GERAL";

    const iconeNota = temDetalhes
      ? `<i class="bi bi-card-text text-secondary ms-1 small" title="Possui detalhamento"></i>`
      : "";

    const classeIconeCat =
      ICONES_CATEGORIAS[item.categoria] || "bi-calendar-event text-secondary";

    const botoesAcaoHtml = `
      <button class="btn btn-sm btn-outline-dark py-0 px-2" onclick="editarAgendamento('${item.id}')" title="Editar">
        <i class="bi bi-pencil-fill"></i>
      </button>
      <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirAgendamento('${item.id}')" title="Excluir">
        <i class="bi bi-trash-fill"></i>
      </button>
    `;

    card.innerHTML = `
      <div class="appointment-summary d-flex align-items-center gap-2">
        <input 
          type="checkbox" 
          class="form-check-input check-concluido ms-1" 
          title="Marcar como concluído"
          ${item.concluido ? "checked" : ""} 
          onclick="event.stopPropagation(); alternarStatusConcluido('${item.id}')"
        />
        <div class="d-flex align-items-center flex-grow-1" onclick="alternarDetalhes('${item.id}')" style="cursor: pointer;">
          ${blocosDataHtml}
          <span class="appointment-title ms-2" title="${item.titulo}">
            <i class="bi ${classeIconeCat} category-icon"></i>${item.titulo} ${iconeNota}
          </span>
          <span class="status-badge ms-auto">${labelStatus}</span>
        </div>
      </div>
      <div class="appointment-details collapse" id="collapse-${item.id}">
        ${temDetalhes ? `<div class="details-label">DESCRIÇÃO</div><div class="details-text mb-2">${item.detalhes}</div>` : ""}
        <div class="small text-secondary mb-2">
          <strong>Período:</strong> ${formatarDataBr(item.dataInicio)} ${item.dataFim ? " até " + formatarDataBr(item.dataFim) : ""}
          ${item.horario ? " às " + item.horario : ""} ${item.horarioFim ? " até " + item.horarioFim : ""}
        </div>
        <div class="d-flex justify-content-end gap-1" data-html2canvas-ignore="true">
          ${botoesAcaoHtml}
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

function calcularDiferencaDias(dataIni, dataFim) {
  if (!dataIni || !dataFim) return 1;
  const [ano1, mes1, dia1] = dataIni.split("-").map(Number);
  const [ano2, mes2, dia2] = dataFim.split("-").map(Number);
  const d1 = new Date(ano1, mes1 - 1, dia1);
  const d2 = new Date(ano2, mes2 - 1, dia2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

window.alternarDetalhes = function (id) {
  const el = document.getElementById(`collapse-${id}`);
  if (el) {
    bootstrap.Collapse.getOrCreateInstance(el).toggle();
  }
};

window.alternarStatusConcluido = async function (id) {
  const item = agendamentos.find((ev) => ev.id === id);
  if (!item) return;

  item.concluido = !item.concluido;
  localStorage.setItem("planejamento_2026_2027", JSON.stringify(agendamentos));
  renderizarAgendamentos();

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from("agendamentos")
        .update({ concluido: item.concluido })
        .eq("id", id);

      if (error) throw error;
    } catch (err) {
      console.error("Erro ao sincronizar status concluído no Supabase:", err);
    }
  }
};

function abrirModalParaData(dataIso) {
  limparFormulario();
  document.getElementById("dataInicio").value = dataIso;
  modalEventoInstance.show();
}

function limparFormulario() {
  document.getElementById("formAgendamento").reset();
  document.getElementById("agendamentoId").value = "";
  document.getElementById("categoria").value = "ferias";
  document.getElementById("prioridade").value = "none";
  document.getElementById("horarioFim").value = "";
  document.getElementById("modalEventoLabel").textContent =
    "Cadastrar Agendamento";
}

// ==========================================================================
// 8. Gravação, Edição e Eliminação no Supabase
// ==========================================================================
async function salvarAgendamento(e) {
  e.preventDefault();

  const id =
    document.getElementById("agendamentoId").value || "ag-" + Date.now();
  const titulo = document.getElementById("titulo").value.trim();
  const categoria = document.getElementById("categoria").value;
  const dataInicio = document.getElementById("dataInicio").value;
  const dataFim = document.getElementById("dataFim").value;
  const horario = document.getElementById("horario").value;
  const horarioFim = document.getElementById("horarioFim").value;
  const prioridade = document.getElementById("prioridade").value;
  const detalhes = document.getElementById("detalhes").value.trim();

  if (dataFim && dataFim < dataInicio) {
    Swal.fire({
      icon: "error",
      title: "Data Inválida",
      text: "A data final não pode ser anterior à data inicial!",
    });
    return;
  }

  const index = agendamentos.findIndex((ev) => ev.id === id);
  const statusAtualConcluido =
    index >= 0 ? agendamentos[index].concluido : false;

  const payloadObjeto = {
    id,
    titulo,
    categoria,
    dataInicio,
    dataFim,
    horario,
    horarioFim,
    prioridade,
    detalhes,
    concluido: statusAtualConcluido,
  };

  if (index >= 0) {
    agendamentos[index] = payloadObjeto;
  } else {
    agendamentos.push(payloadObjeto);
  }

  localStorage.setItem("planejamento_2026_2027", JSON.stringify(agendamentos));
  modalEventoInstance.hide();

  renderizarMeses();
  renderizarAgendamentos();

  // Envia para o Supabase
  if (supabaseClient) {
    try {
      const payloadSupabase = {
        id: id,
        titulo: titulo,
        categoria: categoria,
        prioridade: prioridade,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
        horario: horario || null,
        horario_fim: horarioFim || null,
        detalhes: detalhes || null,
        concluido: statusAtualConcluido,
      };

      const { error } = await supabaseClient
        .from("agendamentos")
        .upsert(payloadSupabase);

      if (error) throw error;
    } catch (err) {
      console.error("Falha ao salvar no Supabase:", err);
      Swal.fire({
        icon: "warning",
        title: "Salvo Localmente",
        text: "O agendamento foi guardado no browser, mas ocorreu uma falha de rede com o Supabase.",
        timer: 2000,
        showConfirmButton: false,
      });
      return;
    }
  }

  Swal.fire({
    icon: "success",
    title: "Sucesso",
    text: "Agendamento gravado e sincronizado no Supabase!",
    timer: 1400,
    showConfirmButton: false,
  });
}

window.editarAgendamento = function (id) {
  const item = agendamentos.find((ev) => ev.id === id);
  if (!item) return;

  document.getElementById("agendamentoId").value = item.id;
  document.getElementById("titulo").value = item.titulo;
  document.getElementById("categoria").value = item.categoria || "geral";
  document.getElementById("dataInicio").value = item.dataInicio;
  document.getElementById("dataFim").value = item.dataFim || "";
  document.getElementById("horario").value = item.horario || "";
  document.getElementById("horarioFim").value = item.horarioFim || "";
  document.getElementById("prioridade").value = item.prioridade || "none";
  document.getElementById("detalhes").value = item.detalhes || "";

  document.getElementById("modalEventoLabel").textContent =
    "Editar Agendamento";
  modalEventoInstance.show();
};

window.excluirAgendamento = function (id) {
  Swal.fire({
    title: "Excluir Agendamento?",
    text: "Esta ação removerá o agendamento da base de dados.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#6c757d",
    confirmButtonText: "Sim, excluir",
    cancelButtonText: "Cancelar",
  }).then(async (result) => {
    if (result.isConfirmed) {
      if (supabaseClient) {
        try {
          const { error } = await supabaseClient
            .from("agendamentos")
            .delete()
            .eq("id", id);

          if (error) throw error;
        } catch (err) {
          console.error("Erro ao eliminar no Supabase:", err);
        }
      }

      agendamentos = agendamentos.filter((ev) => ev.id !== id);
      localStorage.setItem(
        "planejamento_2026_2027",
        JSON.stringify(agendamentos),
      );

      renderizarMeses();
      renderizarAgendamentos();

      Swal.fire({
        icon: "success",
        title: "Excluído!",
        text: "O agendamento foi removido da nuvem.",
        timer: 1300,
        showConfirmButton: false,
      });
    }
  });
};

function formatarDataBr(dataIso) {
  if (!dataIso) return "";
  const [a, m, d] = dataIso.split("-");
  return `${d}/${m}/${a}`;
}

// ==========================================================================
// 9. Exportação Exclusiva em PDF (Folha Única A4 Paisagem)
// ==========================================================================
function exportarPDF() {
  const elemento = document.getElementById("exportArea");
  elemento.classList.add("pdf-single-page");

  const opcoes = {
    margin: [2, 2, 2, 2],
    filename: `Planejamento_Semestral_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollY: 0,
      scrollX: 0,
    },
    jsPDF: {
      unit: "mm",
      format: "a4",
      orientation: "landscape",
    },
    pagebreak: { mode: "avoid-all" },
  };

  setTimeout(() => {
    html2pdf()
      .set(opcoes)
      .from(elemento)
      .save()
      .then(() => {
        elemento.classList.remove("pdf-single-page");
      })
      .catch((err) => {
        console.error("Erro na geração do PDF:", err);
        elemento.classList.remove("pdf-single-page");
      });
  }, 120);
}
