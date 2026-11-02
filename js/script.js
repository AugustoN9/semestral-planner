// 1. Configuração Dinâmica do Semestre
let configSemestre = JSON.parse(localStorage.getItem("config_semestre")) || {
  anoInicio: 2026,
  mesInicio: 10 // Novembro (0-indexado)
};

let MESES = [];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const NOMES_MESES_ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const NOMES_MESES_COMPLETOS = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
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
      nome: `${NOMES_MESES_COMPLETOS[mes]} ${ano}`
    });
  }
  return meses;
}

const CORES_CATEGORIAS = {
  ferias: "#9ce69e",
  recesso: "#ffcf29",
  dissidio: "#ffaf24",
  saude: "#d7f3e8",
  feriado: "#ffd8d8",
  geral: "#cbd5e1"
};

let agendamentos = [];
let feriadosNacionais = {};
let modalEventoInstance = null;
let modalConfigInstance = null;
let cardsColapsados = true;

// Inicialização Assíncrona
document.addEventListener("DOMContentLoaded", async () => {
  modalEventoInstance = new bootstrap.Modal(document.getElementById("modalEvento"));
  modalConfigInstance = new bootstrap.Modal(document.getElementById("modalConfiguracoes"));

  atualizarConfiguracaoSemestre(configSemestre.anoInicio, configSemestre.mesInicio, false);

  await Promise.all([
    carregarAgendamentosIniciais(),
    carregarFeriadosDosAnosDoSemestre()
  ]);

  renderizarMeses();
  renderizarAgendamentos();

  // Eventos de formulários e botões
  document.getElementById("formAgendamento").addEventListener("submit", salvarAgendamento);
  document.getElementById("formConfiguracoes").addEventListener("submit", aplicarNovasConfiguracoes);
  document.getElementById("filtroOrdenacao").addEventListener("change", renderizarAgendamentos);
  document.getElementById("checkExibirFeriados").addEventListener("change", renderizarAgendamentos);
  document.getElementById("btnNovoAgendamento").addEventListener("click", () => limparFormulario());
  document.getElementById("btnAlternarTodosCards").addEventListener("click", alternarTodosCards);
  document.getElementById("btnExportarPDF").addEventListener("click", exportarPDF);

  const btnImportar = document.getElementById("btnImportarJSON");
  const inputImportar = document.getElementById("inputImportarJSON");
  if (btnImportar && inputImportar) {
    btnImportar.addEventListener("click", () => inputImportar.click());
    inputImportar.addEventListener("change", importarBackupJSON);
  }
});

// Atualiza o semestre na memória e no cabeçalho
function atualizarConfiguracaoSemestre(anoInicio, mesInicio, persistir = true) {
  configSemestre = { anoInicio: parseInt(anoInicio, 10), mesInicio: parseInt(mesInicio, 10) };
  if (persistir) {
    localStorage.setItem("config_semestre", JSON.stringify(configSemestre));
  }

  MESES = gerarConfiguracaoSemestre(configSemestre.anoInicio, configSemestre.mesInicio, 6);

  // Atualiza título da aplicação com o intervalo
  const primeiroMesAno = MESES[0];
  const ultimoMesAno = MESES[MESES.length - 1];
  const anoFinal = ultimoMesAno.ano;
  const textoAnos = primeiroMesAno.ano === anoFinal ? `${primeiroMesAno.ano}` : `${primeiroMesAno.ano}-${anoFinal}`;
  
  const elTitulo = document.getElementById("tituloApp");
  if (elTitulo) {
    elTitulo.textContent = `PLANEJAMENTO SEMESTRAL ${textoAnos}`;
  }

  // Sincroniza campos do modal de configurações
  document.getElementById("configMesInicio").value = configSemestre.mesInicio;
  document.getElementById("configAnoInicio").value = configSemestre.anoInicio;
}

// Salva e aplica novas configurações de início de semestre
async function aplicarNovasConfiguracoes(e) {
  e.preventDefault();
  const novoMes = parseInt(document.getElementById("configMesInicio").value, 10);
  const novoAno = parseInt(document.getElementById("configAnoInicio").value, 10);

  atualizarConfiguracaoSemestre(novoAno, novoMes, true);
  await carregarFeriadosDosAnosDoSemestre();

  renderizarMeses();
  renderizarAgendamentos();
  modalConfigInstance.hide();
}

// 2. Carregamento dos Agendamentos: LocalStorage ou dados/agendamentos.json
async function carregarAgendamentosIniciais() {
  const dadosLocais = localStorage.getItem("planejamento_2026_2027");
  if (dadosLocais) {
    agendamentos = JSON.parse(dadosLocais);
    return;
  }

  try {
    const resposta = await fetch("dados/agendamentos.json");
    if (!resposta.ok) throw new Error("Não foi possível carregar dados/agendamentos.json");
    agendamentos = await resposta.json();
    localStorage.setItem("planejamento_2026_2027", JSON.stringify(agendamentos));
  } catch (erro) {
    console.warn("Utilizando lista vazia após tentativa de fetch:", erro);
    agendamentos = [];
  }
}

// 3. Feriados Nacionais dinâmicos para os anos presentes no semestre ativo
async function carregarFeriadosDosAnosDoSemestre() {
  const anosDoSemestre = [...new Set(MESES.map(m => m.ano))];
  const chaveCache = `feriados_${anosDoSemestre.join("_")}`;
  const cache = localStorage.getItem(chaveCache);

  if (cache) {
    feriadosNacionais = JSON.parse(cache);
    return;
  }

  try {
    const requisicoes = anosDoSemestre.map(ano =>
      fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`).then(res => res.json())
    );
    const resultados = await Promise.all(requisicoes);

    const mapa = {};
    resultados.flat().forEach(item => {
      if (item.date && item.name) {
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
      "2027-02-09": "Carnaval",
      "2027-03-26": "Sexta-feira Santa",
      "2027-04-21": "Tiradentes"
    };
  }
}

// Renderização dos Meses
function renderizarMeses() {
  const container = document.getElementById("calendariosContainer");
  container.innerHTML = "";

  MESES.forEach(config => {
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

    DIAS_SEMANA.forEach(dia => {
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

    for (let dia = 1; dia <= totalDiasMes; dia++) {
      const dataIso = `${config.ano}-${String(config.mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const dayCell = document.createElement("div");
      dayCell.className = "cal-day";
      dayCell.textContent = String(dia).padStart(2, '0');
      dayCell.dataset.date = dataIso;

      const eventosNoDia = obterEventosDoDia(dataIso);
      const nomeFeriado = feriadosNacionais[dataIso];

      if (nomeFeriado) {
        dayCell.classList.add("is-holiday");
        dayCell.title = `Feriado: ${nomeFeriado}`;
      }

      if (eventosNoDia.length === 1) {
        const cat = eventosNoDia[0].categoria || "geral";
        dayCell.style.backgroundColor = CORES_CATEGORIAS[cat];
        dayCell.style.color = "#000000";
        dayCell.style.fontWeight = "700";
        dayCell.title = (nomeFeriado ? `[${nomeFeriado}] ` : "") + eventosNoDia[0].titulo;
      } else if (eventosNoDia.length > 1) {
        dayCell.classList.add("multiple-events");
        const coresUnicas = [...new Set(eventosNoDia.map(e => CORES_CATEGORIAS[e.categoria || "geral"]))];

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
        dayCell.title = (nomeFeriado ? `[${nomeFeriado}] ` : "") + `${eventosNoDia.length} eventos: ` + eventosNoDia.map(e => e.titulo).join(", ");
      }

      dayCell.addEventListener("click", () => tratarCliqueNoDia(dataIso));
      grid.appendChild(dayCell);
    }

    card.appendChild(grid);
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
          const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseEl);
          bsCollapse.show();
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
  return agendamentos.filter(item => {
    const inicio = item.dataInicio;
    const fim = item.dataFim || item.dataInicio;
    return dataIso >= inicio && dataIso <= fim;
  });
}

// 4. Alterna Colapsar / Expandir Todos os Cards
function alternarTodosCards() {
  const collapses = document.querySelectorAll("#listaAgendamentos .appointment-details");
  const icone = document.getElementById("iconeAlternarCards");

  if (cardsColapsados) {
    // Abre todos
    collapses.forEach(el => bootstrap.Collapse.getOrCreateInstance(el).show());
    icone.className = "bi bi-arrows-expand";
    cardsColapsados = false;
  } else {
    // Fecha todos
    collapses.forEach(el => bootstrap.Collapse.getOrCreateInstance(el).hide());
    icone.className = "bi bi-arrows-collapse";
    cardsColapsados = true;
  }
}

// Renderização dos Agendamentos
function renderizarAgendamentos() {
  const container = document.getElementById("listaAgendamentos");
  container.innerHTML = "";

  const exibirFeriados = document.getElementById("checkExibirFeriados")?.checked ?? true;
  let listaCompleta = [...agendamentos];

  // Limites dinâmicos do semestre atual para filtro de feriados
  const primeiroMes = MESES[0];
  const ultimoMes = MESES[MESES.length - 1];
  const dataLimiteInicio = `${primeiroMes.ano}-${String(primeiroMes.mes + 1).padStart(2, '0')}-01`;
  const ultimoDiaNum = new Date(ultimoMes.ano, ultimoMes.mes + 1, 0).getDate();
  const dataLimiteFim = `${ultimoMes.ano}-${String(ultimoMes.mes + 1).padStart(2, '0')}-${String(ultimoDiaNum).padStart(2, '0')}`;

  if (exibirFeriados && feriadosNacionais) {
    const feriadosDoSemestre = Object.entries(feriadosNacionais)
      .filter(([data]) => data >= dataLimiteInicio && data <= dataLimiteFim)
      .map(([data, nome]) => ({
        id: `feriado-${data}`,
        titulo: nome,
        categoria: "feriado",
        dataInicio: data,
        dataFim: "",
        horario: "",
        prioridade: "none",
        detalhes: "Feriado Nacional Oficial do Brasil.",
        isFeriado: true
      }));

    listaCompleta = listaCompleta.concat(feriadosDoSemestre);
  }

  const ordenacao = document.getElementById("filtroOrdenacao").value;
  const itensOrdenados = listaCompleta.sort((a, b) => {
    if (ordenacao === "data-asc") return a.dataInicio.localeCompare(b.dataInicio);
    if (ordenacao === "data-desc") return b.dataInicio.localeCompare(a.dataInicio);
    if (ordenacao === "categoria") return (a.categoria || "").localeCompare(b.categoria || "");
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

  itensOrdenados.forEach(item => {
    const card = document.createElement("div");
    card.className = `appointment-card cat-theme-${item.categoria || 'geral'}`;
    card.id = `card-${item.id}`;

    const pInicio = item.dataInicio.split("-");
    const diaIni = pInicio[2];
    const mesIni = NOMES_MESES_ABREV[parseInt(pInicio[1], 10) - 1];

    let blocosDataHtml = "";

    if (item.dataFim && item.dataFim !== item.dataInicio) {
      const pFim = item.dataFim.split("-");
      const diaFim = pFim[2];
      const mesFim = NOMES_MESES_ABREV[parseInt(pFim[1], 10) - 1];
      const diferencaDias = calcularDiferencaDias(item.dataInicio, item.dataFim);

      blocosDataHtml = `
        <span class="tag-badge">${diaIni}</span>
        <span class="tag-badge">${mesIni}</span>
        <span class="fw-bold small text-secondary">-</span>
        <span class="tag-badge">${diaFim}</span>
        <span class="tag-badge">${mesFim}</span>
        <span class="tag-badge">${diferencaDias} ${diferencaDias === 1 ? 'dia' : 'dias'}</span>
      `;
    } else {
      const horaStr = item.horario ? item.horario : "--";
      blocosDataHtml = `
        <span class="tag-badge">${diaIni}</span>
        <span class="tag-badge">${mesIni}</span>
        <span class="tag-badge">${horaStr}</span>
      `;
    }

    const labelStatus = item.isFeriado 
      ? 'FERIADO' 
      : ((item.prioridade && item.prioridade !== 'none') ? item.prioridade.toUpperCase() : (item.categoria ? item.categoria.toUpperCase() : 'GERAL'));

    const botoesAcaoHtml = item.isFeriado
      ? `<span class="badge bg-danger-subtle text-danger border">Feriado Oficial</span>`
      : `
        <button class="btn btn-sm btn-outline-dark py-0 px-2" onclick="editarAgendamento('${item.id}')" title="Editar">
          <i class="bi bi-pencil-fill"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="excluirAgendamento('${item.id}')" title="Excluir">
          <i class="bi bi-trash-fill"></i>
        </button>
      `;

    card.innerHTML = `
      <div class="appointment-summary" onclick="alternarDetalhes('${item.id}')">
        ${blocosDataHtml}
        <span class="appointment-title" title="${item.titulo}">${item.titulo}</span>
        <span class="status-badge">${labelStatus}</span>
      </div>
      <div class="appointment-details collapse" id="collapse-${item.id}">
        <div class="details-label">DESCRIÇÃO</div>
        <div class="details-text mb-2">${item.detalhes ? item.detalhes : '<em class="text-muted">Sem detalhes adicionais.</em>'}</div>
        <div class="small text-secondary mb-2">
          <strong>Período:</strong> ${formatarDataBr(item.dataInicio)} ${item.dataFim ? ' até ' + formatarDataBr(item.dataFim) : ''}
          ${item.horario ? ' às ' + item.horario : ''}
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
  const [ano1, mes1, dia1] = dataIni.split("-").map(Number);
  const [ano2, mes2, dia2] = dataFim.split("-").map(Number);
  const d1 = new Date(ano1, mes1 - 1, dia1);
  const d2 = new Date(ano2, mes2 - 1, dia2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

window.alternarDetalhes = function(id) {
  const el = document.getElementById(`collapse-${id}`);
  const bsCollapse = bootstrap.Collapse.getOrCreateInstance(el);
  bsCollapse.toggle();
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
  document.getElementById("modalEventoLabel").textContent = "Cadastrar Agendamento";
}

function salvarAgendamento(e) {
  e.preventDefault();

  const id = document.getElementById("agendamentoId").value || "ag-" + Date.now();
  const titulo = document.getElementById("titulo").value.trim();
  const categoria = document.getElementById("categoria").value;
  const dataInicio = document.getElementById("dataInicio").value;
  const dataFim = document.getElementById("dataFim").value;
  const horario = document.getElementById("horario").value;
  const prioridade = document.getElementById("prioridade").value;
  const detalhes = document.getElementById("detalhes").value.trim();

  if (dataFim && dataFim < dataInicio) {
    alert("A data final não pode ser anterior à data inicial.");
    return;
  }

  const index = agendamentos.findIndex(ev => ev.id === id);
  const payload = { id, titulo, categoria, dataInicio, dataFim, horario, prioridade, detalhes };

  if (index >= 0) {
    agendamentos[index] = payload;
  } else {
    agendamentos.push(payload);
  }

  localStorage.setItem("planejamento_2026_2027", JSON.stringify(agendamentos));
  modalEventoInstance.hide();

  renderizarMeses();
  renderizarAgendamentos();
}

window.editarAgendamento = function(id) {
  const item = agendamentos.find(ev => ev.id === id);
  if (!item) return;

  document.getElementById("agendamentoId").value = item.id;
  document.getElementById("titulo").value = item.titulo;
  document.getElementById("categoria").value = item.categoria || "geral";
  document.getElementById("dataInicio").value = item.dataInicio;
  document.getElementById("dataFim").value = item.dataFim || "";
  document.getElementById("horario").value = item.horario || "";
  document.getElementById("prioridade").value = item.prioridade || "none";
  document.getElementById("detalhes").value = item.detalhes || "";

  document.getElementById("modalEventoLabel").textContent = "Editar Agendamento";
  modalEventoInstance.show();
};

window.excluirAgendamento = function(id) {
  if (!confirm("Deseja realmente remover este agendamento?")) return;

  agendamentos = agendamentos.filter(ev => ev.id !== id);
  localStorage.setItem("planejamento_2026_2027", JSON.stringify(agendamentos));

  renderizarMeses();
  renderizarAgendamentos();
};

function formatarDataBr(dataIso) {
  if (!dataIso) return "";
  const [a, m, d] = dataIso.split("-");
  return `${d}/${m}/${a}`;
}

function baixarArquivoJSON() {
  const dados = {
    versao: "2.4",
    exportadoEm: new Date().toISOString(),
    configSemestre: configSemestre,
    totalAgendamentos: agendamentos.length,
    agendamentos: agendamentos
  };

  const jsonString = JSON.stringify(dados, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `backup_planejamento_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Geração de PDF em Folha Única A4 Paisagem (60% / 40%)
function exportarPDF() {
  baixarArquivoJSON();

  const elemento = document.getElementById("exportArea");
  elemento.classList.add("pdf-single-page");

  const opcoes = {
    margin: [4, 4, 4, 4],
    filename: `Planejamento_Semestral_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollY: 0,
      scrollX: 0
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'landscape'
    },
    pagebreak: { mode: 'avoid-all' }
  };

  html2pdf().set(opcoes).from(elemento).save().then(() => {
    elemento.classList.remove("pdf-single-page");
  }).catch((err) => {
    console.error("Erro na geração do PDF:", err);
    elemento.classList.remove("pdf-single-page");
  });
}

function importarBackupJSON(event) {
  const arquivo = event.target.files[0];
  if (!arquivo) return;

  const leitor = new FileReader();
  leitor.onload = function(e) {
    try {
      const conteudo = JSON.parse(e.target.result);
      const listaImportada = Array.isArray(conteudo) ? conteudo : conteudo.agendamentos;

      if (!Array.isArray(listaImportada)) {
        throw new Error("Estrutura do ficheiro JSON inválida.");
      }

      if (confirm(`Deseja importar ${listaImportada.length} agendamentos? Isso substituirá a lista atual.`)) {
        agendamentos = listaImportada;
        if (conteudo.configSemestre) {
          atualizarConfiguracaoSemestre(conteudo.configSemestre.anoInicio, conteudo.configSemestre.mesInicio, true);
        }
        localStorage.setItem("planejamento_2026_2027", JSON.stringify(agendamentos));
        renderizarMeses();
        renderizarAgendamentos();
        alert("Agendamentos importados com sucesso!");
      }
    } catch (erro) {
      alert("Falha ao ler o ficheiro JSON. Certifique-se de que é um backup válido.");
      console.error(erro);
    } finally {
      event.target.value = "";
    }
  };
  leitor.readAsText(arquivo);
}