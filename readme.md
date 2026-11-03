# 📅 Planejamento Semestral (Semestral Planner)

Aplicação web responsiva e modular para gestão visual e planejamento de compromissos semestrais (férias, recessos, viagens, passeios, aniversários, festas, academia/treinos e consultas de saúde). O sistema conta com persistência em nuvem via **Supabase PostgreSQL**, sincronização em tempo real entre dispositivos, suporte offline resiliente e exportação em PDF otimizada para folha única A4 paisagem.

---

## 🚀 Funcionalidades

- **Visão Semestral Dinâmica**: Grade interativa de 6 meses personalizável (mês e ano inicial configuráveis via modal).
- **Feriados Nacionais Automatizados**: Integração com a API pública da **BrasilAPI** para renderização e destaque de feriados nacionais na grade e rodapé de cada mês.
- **Categorização Visual Completa com Ícones**:
  - 🌴 **Férias** (`bi-sun-fill` / Verde)
  - 🎄 **Recesso / Fim de Ano** (`bi-tree-fill` / Amarelo)
  - 💼 **Dissídio** (`bi-cash-coin` / Laranja)
  - 🩺 **Saúde / Consulta** (`bi-heart-pulse-fill` / Ciano Suave)
  - ✈️ **Viagem** (`bi-airplane-fill` / Azul Suave)
  - 🚲 **Passeio** (`bi-bicycle` / Lavanda)
  - 🎂 **Aniversário** (`bi-cake2-fill` / Rosa Suave)
  - 🥂 **Festa** (`bi-cup-straw` / Dourado)
  - 🏃 **Academia / Treino** (`bi-person-walking` / Coral)
  - 📌 **Geral / Outros** (`bi-calendar-event` / Cinza)
- **Modo To-Do List (Conclusão de Tarefas)**: Checkbox interativo no próprio card para marcar compromissos concluídos (efeito tachado e opacidade) com persistência imediata no banco de dados.
- **Horário Inicial e Término**: Suporte a períodos de horários pontuais ou intervalos completos de duração de evento.
- **Ordenação Inteligente**: Filtros por data (crescente/decrescente), prioridade, categoria e pendentes primeiro.
- **Exportação em PDF Otimizada**: Geração de documento em folha única A4 paisagem via `html2pdf.js`.
- **Persistência Remota e Fallback**: Conexão com Supabase PostgreSQL com cache de contingência em `localStorage`.
- **Prevenção de Inatividade (Keep-Alive)**: Workflow automatizado via GitHub Actions (Cron) a cada 3 dias para evitar suspensão da instância gratuita no Supabase.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5 semântico, CSS3 moderno (Custom Properties e CSS Grid), Vanilla JavaScript (ES6+ assíncrono).
- **Framework UI & Ícones**: [Bootstrap 5.3](https://getbootstrap.com/) & [Bootstrap Icons](https://icons.getbootstrap.com/).
- **Alertas e Modais**: [SweetAlert2](https://sweetalert2.github.io/).
- **Exportação de Documentos**: [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/).
- **Banco de Dados & Backend**: [Supabase](https://supabase.com/) (PostgreSQL + REST API com Row Level Security).
- **Feriados**: [BrasilAPI](https://brasilapi.com.br/).
- **CI/CD & Automação**: GitHub Pages para hospedagem estática e GitHub Actions para keep-alive programado.

---

## 🗄️ Estrutura do Banco de Dados (Supabase)

### Tabela `agendamentos`
```sql
CREATE TABLE IF NOT EXISTS agendamentos (
  id VARCHAR(50) PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  categoria VARCHAR(50) NOT NULL,
  prioridade VARCHAR(20) DEFAULT 'none',
  data_inicio DATE NOT NULL,
  data_fim DATE,
  horario VARCHAR(10),
  horario_fim VARCHAR(10),
  detalhes TEXT,
  concluido BOOLEAN DEFAULT false
);

-- Políticas de RLS para acesso anônimo com publishable key:
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura pública" ON agendamentos FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública" ON agendamentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização pública" ON agendamentos FOR UPDATE USING (true);
CREATE POLICY "Permitir exclusão pública" ON agendamentos FOR DELETE USING (true);
```

### Tabela `configuracao_semestre`
```sql
CREATE TABLE IF NOT EXISTS configuracao_semestre (
  id INT PRIMARY KEY,
  ano_inicio INT NOT NULL,
  mes_inicio INT NOT NULL
);

ALTER TABLE configuracao_semestre ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura e escrita de configuração" ON configuracao_semestre FOR ALL USING (true);
```

---

## 📂 Estrutura de Pastas do Projeto

```text
semestral-planner/
├── .github/
│   └── workflows/
│       └── keep-alive.yml      # Automação cron contra hibernação do Supabase
├── css/
│   └── style.css               # Estilos da aplicação, temas e modo impressão A4
├── js/
│   └── script.js               # Integração REST com Supabase, render e UI
├── index.html                  # Interface principal da aplicação
└── README.md                   # Documentação do repositório
```

---

## ⚙️ Configuração e Instalação

1. **Clonar o Repositório**:
   ```bash
   git clone https://github.com/Auguston9/semestral-planner.git
   cd semestral-planner
   ```

2. **Configurar as Chaves do Supabase**:
   No topo do arquivo `js/script.js`, verifique se o endpoint e a publishable key estão definidos:
   ```javascript
   const SUPABASE_URL = "https://ocmjbfwvfznmyadfputs.supabase.co";
   const SUPABASE_ANON_KEY = "sb_publishable_...";
   ```

3. **Configurar o GitHub Secret (para o Keep-Alive)**:
   - No repositório no GitHub, vá em **Settings > Secrets and variables > Actions**.
   - Crie um Repository Secret chamado `SUPABASE_ANON_KEY` contendo o valor da publishable key.

4. **Execução Local**:
   - Abra o `index.html` em qualquer navegador moderno ou via extensão **Live Server** no VS Code.

---

## 📄 Licença

Este projeto é desenvolvido para planejamento pessoal e organização de rotina sob a licença MIT.