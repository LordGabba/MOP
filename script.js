// ============================================================
// script.js - Sistema de Gestão Operacional
// Lógica principal de interface e operações
// ============================================================

// ============================================================
// ESTADO GLOBAL
// ============================================================
const APP = {
  pagina: 'dashboard',
  config: {},
  dados: {
    colaboradores: [],
    staff: [],
    escalas: [],
    programacoes: [],
  },
  paginacao: {
    colaboradores: { pagina: 1, porPagina: 20 },
    staff: { pagina: 1, porPagina: 20 },
    escalas: { pagina: 1, porPagina: 20 },
    programacoes: { pagina: 1, porPagina: 20 },
  },
  filtros: {
    colaboradores: {},
    staff: {},
    escalas: {},
    programacoes: {},
  },
  busca: '',
  editandoId: null,
  calendarioData: new Date(),
  tema: localStorage.getItem('tema') || 'claro',
  sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true',
};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  aplicarTema(APP.tema);
  if (APP.sidebarCollapsed) toggleSidebar(false);
  const autenticado = await Auth.inicializar();
  if (!autenticado) {
    mostrarLoader(false);
    return;
  }
  Security.inicializar();
  await inicializarApp();
});

async function inicializarApp() {
  mostrarLoader(true);
  try {
    APP.config = await DB.configuracoes.listar();
    const paginaInicial = Permissions.getDefaultPage();
    navegarPara(paginaInicial);
    configurarEventos();
    configurarRealtime();
    Security.aplicarRestricoesVisuais();
    mostrarLoader(false);
  } catch (e) {
    mostrarLoader(false);
    toast('Erro ao conectar com o banco de dados. Verifique as configurações.', 'error');
    console.error(e);
  }
}

// ============================================================
// LOADER
// ============================================================
function mostrarLoader(show) {
  const el = document.getElementById('global-loader');
  if (!el) return;
  if (show) { el.classList.remove('hidden'); }
  else { setTimeout(() => el.classList.add('hidden'), 400); }
}

// ============================================================
// TEMA
// ============================================================
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema === 'escuro' ? 'dark' : '');
  APP.tema = tema;
  localStorage.setItem('tema', tema);
  const btn = document.getElementById('btn-tema');
  if (btn) btn.textContent = tema === 'escuro' ? '☀️' : '🌙';
}

function toggleTema() {
  aplicarTema(APP.tema === 'escuro' ? 'claro' : 'escuro');
}

// ============================================================
// SIDEBAR
// ============================================================
function toggleSidebar(salvar = true) {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main-content');
  APP.sidebarCollapsed = !APP.sidebarCollapsed;
  sidebar.classList.toggle('collapsed', APP.sidebarCollapsed);
  main.classList.toggle('sidebar-collapsed', APP.sidebarCollapsed);
  if (salvar) localStorage.setItem('sidebarCollapsed', APP.sidebarCollapsed);
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('mobile-open');
  overlay.classList.toggle('visible');
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
function navegarPara(pagina) {
  if (!Security.protegerPaginaAtual(pagina)) {
    pagina = Permissions.getDefaultPage();
    if (!Security.protegerPaginaAtual(pagina)) return;
  }
  APP.pagina = pagina;
  // Atualiza nav items
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pagina);
  });
  // Atualiza páginas
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${pagina}`);
  });
  // Breadcrumb
  const labels = {
    dashboard: 'Dashboard', colaboradores: 'Colaboradores', staff: 'Staff / Liderança',
    escalas: 'Escalas', programacoes: 'Programações', ferias: 'Férias',
    relatorios: 'Relatórios', importacao: 'Importação em Massa', configuracoes: 'Configurações'
  };
  const el = document.getElementById('breadcrumb-page');
  if (el) el.textContent = labels[pagina] || pagina;
  carregarPagina(pagina);
  // Fecha sidebar mobile
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

async function carregarPagina(pagina) {
  if (!Security.protegerPaginaAtual(pagina)) return;
  switch (pagina) {
    case 'dashboard': await carregarDashboard(); break;
    case 'colaboradores': await carregarColaboradores(); break;
    case 'staff': await carregarStaff(); break;
    case 'escalas': await carregarEscalas(); break;
    case 'programacoes': await carregarProgramacoes(); break;
    case 'ferias': await carregarFerias(); break;
    case 'relatorios': await carregarRelatorios(); break;
    case 'importacao': carregarImportacao(); break;
    case 'configuracoes': await carregarConfiguracoes(); break;
  }
  Security.aplicarRestricoesVisuais();
}

// ============================================================
// EVENTOS GERAIS
// ============================================================
function configurarEventos() {
  // Busca global no topbar
  const searchInput = document.getElementById('topbar-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(e => {
      APP.busca = e.target.value;
      if (APP.pagina === 'colaboradores') renderizarTabelaColaboradores();
      if (APP.pagina === 'staff') renderizarTabelaStaff();
    }, 300));
  }
}

// ============================================================
// REALTIME
// ============================================================
function configurarRealtime() {
  DB.assinarTabela('colaboradores', async () => {
    if (APP.pagina === 'colaboradores' || APP.pagina === 'dashboard') {
      APP.dados.colaboradores = await DB.colaboradores.listar(APP.filtros.colaboradores);
      renderizarTabelaColaboradores();
      if (APP.pagina === 'dashboard') carregarDashboard();
    }
  });
  DB.assinarTabela('programacoes', async () => {
    if (APP.pagina === 'programacoes' || APP.pagina === 'dashboard') {
      await carregarPagina(APP.pagina);
    }
  });
}

// ============================================================
// DASHBOARD
// ============================================================
async function carregarDashboard() {
  const container = document.getElementById('dashboard-stats');
  if (!container) return;
  container.innerHTML = '<div class="loading-inline"><div class="spinner"></div> Carregando...</div>';
  try {
    const [total, ativos, ferias, dayoff] = await Promise.all([
      DB.colaboradores.contar(),
      DB.colaboradores.contarPorStatus('Ativo'),
      DB.colaboradores.contarPorStatus('Férias'),
      DB.colaboradores.contarPorStatus('Day Off'),
    ]);
    const programacoesPendentes = (await DB.programacoes.listar({ status: 'Pendente' })).length;
    container.innerHTML = `
      <div class="stat-card"><div class="stat-icon blue">👥</div><div class="stat-info"><div class="stat-value">${total}</div><div class="stat-label">Total Colaboradores</div></div></div>
      <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info"><div class="stat-value">${ativos}</div><div class="stat-label">Ativos</div></div></div>
      <div class="stat-card"><div class="stat-icon yellow">🏖️</div><div class="stat-info"><div class="stat-value">${ferias}</div><div class="stat-label">Em Férias</div></div></div>
      <div class="stat-card"><div class="stat-icon blue">☕</div><div class="stat-info"><div class="stat-value">${dayoff}</div><div class="stat-label">Day Off</div></div></div>
      <div class="stat-card"><div class="stat-icon red">⏳</div><div class="stat-info"><div class="stat-value">${programacoesPendentes}</div><div class="stat-label">Prog. Pendentes</div></div></div>
    `;

    // Carregar lista recente
    const recentes = await DB.colaboradores.listar({ status: 'Ativo' });
    const listEl = document.getElementById('dashboard-recentes');
    if (listEl) {
      listEl.innerHTML = recentes.slice(0, 8).map(c => `
        <tr>
          <td>${c.matricula || '-'}</td>
          <td>${c.nome}</td>
          <td>${c.celula || '-'}</td>
          <td>${c.horario || '-'}</td>
          <td>${badgeStatus(c.status)}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" class="text-muted text-center">Nenhum colaborador</td></tr>';
    }

    // Distribuição por célula
    const celulas = {};
    recentes.forEach(c => { if (c.celula) celulas[c.celula] = (celulas[c.celula] || 0) + 1; });
    renderizarGraficoCelulas(celulas);

  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro ao carregar</div><div class="empty-desc">${e.message}</div></div>`;
  }
}

function renderizarGraficoCelulas(celulas) {
  const el = document.getElementById('chart-celulas');
  if (!el) return;
  const max = Math.max(...Object.values(celulas), 1);
  el.innerHTML = Object.entries(celulas).map(([nome, qtd]) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div style="width:90px;font-size:12px;color:var(--text2);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nome}</div>
      <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
        <div style="width:${(qtd/max)*100}%;height:100%;background:var(--primary);border-radius:4px;transition:width 0.5s ease"></div>
      </div>
      <div style="width:24px;font-size:12px;font-weight:600">${qtd}</div>
    </div>
  `).join('') || '<p class="text-muted text-sm">Sem dados</p>';
}

// ============================================================
// COLABORADORES
// ============================================================
async function carregarColaboradores() {
  APP.dados.colaboradores = await carregarComLoading('tabela-colaboradores', () =>
    DB.colaboradores.listar(APP.filtros.colaboradores)
  );
  preencherFiltrosColaboradores();
  renderizarTabelaColaboradores();
}

function renderizarTabelaColaboradores() {
  const tbody = document.getElementById('tabela-colaboradores');
  if (!tbody) return;
  Security.aplicarRestricoesVisuais();

  let dados = filtrarDados(APP.dados.colaboradores, APP.filtros.colaboradores, APP.busca);
  const pag = APP.paginacao.colaboradores;
  const total = dados.length;
  const inicio = (pag.pagina - 1) * pag.porPagina;
  const slice = dados.slice(inicio, inicio + pag.porPagina);

  tbody.innerHTML = slice.length ? slice.map(c => `
    <tr>
      <td><input type="checkbox" class="row-check" data-id="${c.id}"></td>
      <td class="font-mono text-sm">${c.matricula || '-'}</td>
      <td><strong>${c.nome}</strong></td>
      <td>${c.celula || '-'}</td>
      <td>${c.grupo || '-'}</td>
      <td>${c.cargo || '-'}</td>
      <td>${c.horario || '-'}</td>
      <td>${c.escala || '-'}</td>
      <td>${c.filial || '-'}</td>
      <td>${c.supervisor || '-'}</td>
      <td>${c.admissao ? formatarData(c.admissao) : '-'}</td>
      <td>${c.tempo_meses != null ? c.tempo_meses + ' m' : '-'}</td>
      <td>${badgeStatus(c.status)}</td>
      <td>
        <div class="table-actions">
          <button class="table-action-btn edit" onclick="abrirModalColaborador(${c.id})" title="Editar">✏️</button>
          <button class="table-action-btn del" onclick="confirmarExclusao('colaboradores',${c.id},'${c.nome}')" title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="14"><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Nenhum colaborador encontrado</div></div></td></tr>`;

  renderizarPaginacao('colaboradores', total, pag);
  atualizarContadorSelecao();
  Security.aplicarRestricoesVisuais();
}

function filtrarDados(dados, filtros, busca) {
  return dados.filter(d => {
    if (busca && !JSON.stringify(d).toLowerCase().includes(busca.toLowerCase())) return false;
    for (const [k, v] of Object.entries(filtros)) {
      if (v && d[k] !== v) return false;
    }
    return true;
  });
}

function preencherFiltrosColaboradores() {
  // Status
  preencherSelectFiltro('filtro-col-status', extrairUnicos(APP.dados.colaboradores, 'status'), APP.filtros.colaboradores.status);
  preencherSelectFiltro('filtro-col-celula', extrairUnicos(APP.dados.colaboradores, 'celula'), APP.filtros.colaboradores.celula);
  preencherSelectFiltro('filtro-col-grupo', extrairUnicos(APP.dados.colaboradores, 'grupo'), APP.filtros.colaboradores.grupo);
  preencherSelectFiltro('filtro-col-filial', extrairUnicos(APP.dados.colaboradores, 'filial'), APP.filtros.colaboradores.filial);
}

function preencherSelectFiltro(id, opcoes, valorAtual) {
  const el = document.getElementById(id);
  if (!el) return;
  const val = el.value || valorAtual || '';
  el.innerHTML = '<option value="">Todos</option>' + opcoes.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('');
}

function extrairUnicos(dados, campo) {
  return [...new Set(dados.map(d => d[campo]).filter(Boolean))].sort();
}

function filtrarColaboradores() {
  APP.filtros.colaboradores = {
    status: document.getElementById('filtro-col-status')?.value || '',
    celula: document.getElementById('filtro-col-celula')?.value || '',
    grupo: document.getElementById('filtro-col-grupo')?.value || '',
    filial: document.getElementById('filtro-col-filial')?.value || '',
  };
  APP.paginacao.colaboradores.pagina = 1;
  renderizarTabelaColaboradores();
}

// ============================================================
// MODAL COLABORADOR
// ============================================================
async function abrirModalColaborador(id = null) {
  if (!Security.requirePermission(id ? 'editar_colaborador' : 'cadastrar_colaborador')) return;
  APP.editandoId = id;
  const modal = document.getElementById('modal-colaborador');
  const title = document.getElementById('modal-col-title');
  if (!modal) return;

  if (id) {
    title.textContent = 'Editar Colaborador';
    try {
      const dados = await DB.colaboradores.buscarPorId(id);
      preencherFormularioColaborador(dados);
    } catch (e) { toast('Erro ao carregar dados', 'error'); return; }
  } else {
    title.textContent = 'Novo Colaborador';
    document.getElementById('form-colaborador')?.reset();
  }
  abrirModal('modal-colaborador');
}

function preencherFormularioColaborador(dados) {
  const form = document.getElementById('form-colaborador');
  if (!form) return;
  Object.entries(dados).forEach(([k, v]) => {
    const el = form.querySelector(`[name="${k}"]`);
    if (el && v !== null && v !== undefined) el.value = v;
  });
}

async function salvarColaborador() {
  if (!Security.requirePermission(APP.editandoId ? 'editar_colaborador' : 'cadastrar_colaborador')) return;
  const form = document.getElementById('form-colaborador');
  if (!form) return;
  const dados = Object.fromEntries(new FormData(form));
  // Validações
  if (!dados.nome?.trim()) { toast('Nome é obrigatório', 'error'); return; }
  if (dados.cpf && !validarCPF(dados.cpf)) { toast('CPF inválido', 'error'); return; }

  const btn = document.getElementById('btn-salvar-colaborador');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    if (APP.editandoId) {
      await DB.colaboradores.atualizar(APP.editandoId, dados);
      toast('Colaborador atualizado com sucesso', 'success');
    } else {
      await DB.colaboradores.criar(dados);
      toast('Colaborador cadastrado com sucesso', 'success');
    }
    fecharModal('modal-colaborador');
    await carregarColaboradores();
  } catch (e) {
    toast('Erro ao salvar: ' + (e.message || e), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar';
  }
}

// ============================================================
// STAFF
// ============================================================
async function carregarStaff() {
  APP.dados.staff = await carregarComLoading('tabela-staff', () =>
    DB.staff.listar(APP.filtros.staff)
  );
  renderizarTabelaStaff();
}

function renderizarTabelaStaff() {
  const tbody = document.getElementById('tabela-staff');
  if (!tbody) return;
  let dados = filtrarDados(APP.dados.staff, APP.filtros.staff, APP.busca);
  const pag = APP.paginacao.staff;
  const total = dados.length;
  const slice = dados.slice((pag.pagina - 1) * pag.porPagina, pag.pagina * pag.porPagina);

  tbody.innerHTML = slice.length ? slice.map(s => `
    <tr>
      <td class="font-mono text-sm">${s.matricula || '-'}</td>
      <td><strong>${s.nome}</strong></td>
      <td>${s.cargo || '-'}</td>
      <td>${s.nivel_hierarquico || '-'}</td>
      <td>${s.celula || '-'}</td>
      <td>${s.equipe_responsavel || '-'}</td>
      <td>${s.quantidade_colaboradores || 0}</td>
      <td>${s.tipo_lideranca || '-'}</td>
      <td>${badgeStatus(s.status)}</td>
      <td>
        <div class="table-actions">
          <button class="table-action-btn edit" onclick="abrirModalStaff(${s.id})" title="Editar">✏️</button>
          <button class="table-action-btn del" onclick="confirmarExclusao('staff',${s.id},'${s.nome}')" title="Excluir">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">👔</div><div class="empty-title">Nenhum staff encontrado</div></div></td></tr>`;

  renderizarPaginacao('staff', total, pag);
  Security.aplicarRestricoesVisuais();
}

async function abrirModalStaff(id = null) {
  if (!Security.requirePermission(id ? 'editar_staff' : 'cadastrar_staff')) return;
  APP.editandoId = id;
  const title = document.getElementById('modal-staff-title');
  if (id) {
    title.textContent = 'Editar Staff';
    try {
      const dados = await DB.staff.buscarPorId(id);
      const form = document.getElementById('form-staff');
      Object.entries(dados).forEach(([k, v]) => {
        const el = form?.querySelector(`[name="${k}"]`);
        if (el && v !== null) el.value = v;
      });
    } catch (e) { toast('Erro ao carregar dados', 'error'); return; }
  } else {
    title.textContent = 'Novo Staff';
    document.getElementById('form-staff')?.reset();
  }
  abrirModal('modal-staff');
}

async function salvarStaff() {
  if (!Security.requirePermission(APP.editandoId ? 'editar_staff' : 'cadastrar_staff')) return;
  const form = document.getElementById('form-staff');
  if (!form) return;
  const dados = Object.fromEntries(new FormData(form));
  if (!dados.nome?.trim()) { toast('Nome é obrigatório', 'error'); return; }
  try {
    if (APP.editandoId) {
      await DB.staff.atualizar(APP.editandoId, dados);
      toast('Staff atualizado', 'success');
    } else {
      await DB.staff.criar(dados);
      toast('Staff cadastrado', 'success');
    }
    fecharModal('modal-staff');
    await carregarStaff();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

// ============================================================
// ESCALAS
// ============================================================
async function carregarEscalas() {
  const hoje = new Date();
  APP.calendarioData = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  APP.dados.colaboradores = await DB.colaboradores.listar({ status: 'Ativo' });
  if (Security.isAgente()) {
    const colaboradorId = Security.getColaboradorLogadoId();
    APP.filtros.escalas.colaborador_id = colaboradorId ? String(colaboradorId) : '';
  }
  preencherFiltrosEscalas();
  await renderizarCalendario();
}

function preencherFiltrosEscalas() {
  const colabSel = document.getElementById('filtro-escala-colaborador');
  const reporteSel = document.getElementById('filtro-escala-reporte');
  const colaboradores = APP.dados.colaboradores || [];

  if (colabSel) {
    const atual = colabSel.value;
    colabSel.innerHTML = '<option value="">Todos colaboradores</option>' +
      colaboradores.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    colabSel.value = atual || APP.filtros.escalas.colaborador_id || '';
  }

  if (reporteSel) {
    const atual = reporteSel.value;
    const reportes = [...new Set(colaboradores.map(c => c.reporte).filter(Boolean))].sort();
    reporteSel.innerHTML = '<option value="">Todos reportes</option>' +
      reportes.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
    reporteSel.value = atual || APP.filtros.escalas.reporte || '';
  }
}

function aplicarFiltroEscalas(campo, valor) {
  APP.filtros.escalas[campo] = valor;
  renderizarCalendario();
}

async function renderizarCalendario() {
  const container = document.getElementById('calendario-grid');
  if (!container) return;
  const ano = APP.calendarioData.getFullYear();
  const mes = APP.calendarioData.getMonth();
  const label = document.getElementById('calendario-mes-label');
  if (label) {
    label.textContent = new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date();

  // Buscar escalas do mês
  const dataInicio = `${ano}-${String(mes+1).padStart(2,'0')}-01`;
  const dataFim = `${ano}-${String(mes+1).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`;
  let escalas = await DB.escalas.listar({
    data_inicio: dataInicio,
    data_fim: dataFim,
    colaborador_id: APP.filtros.escalas.colaborador_id || ''
  });

  if (APP.filtros.escalas.reporte) {
    const idsReporte = (APP.dados.colaboradores || [])
      .filter(c => c.reporte === APP.filtros.escalas.reporte)
      .map(c => String(c.id));
    escalas = escalas.filter(e => idsReporte.includes(String(e.colaborador_id)));
  }

  const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let html = dias.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

  // Dias do mês anterior
  for (let i = 0; i < primeiroDia; i++) {
    html += `<div class="calendar-day other-month"></div>`;
  }
  // Dias do mês
  for (let d = 1; d <= ultimoDia; d++) {
    const dataStr = `${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isHoje = hoje.getFullYear()===ano && hoje.getMonth()===mes && hoje.getDate()===d;
    const escalasHoje = escalas.filter(e => e.data === dataStr);
    const evHtml = escalasHoje.slice(0,3).map(e => {
      const cor = e.cor || corTipoEscala(e.tipo_alteracao);
      return `<div class="calendar-event" style="background:${cor}20;color:${cor}">${e.colaborador_nome || 'Colaborador'}</div>`;
    }).join('');
    html += `
      <div class="calendar-day ${isHoje ? 'today' : ''}" onclick="abrirDiaEscala('${dataStr}')">
        <div class="calendar-date">${d}${escalasHoje.length > 3 ? `<span style="color:var(--primary);margin-left:4px">+${escalasHoje.length-3}</span>` : ''}</div>
        ${evHtml}
      </div>`;
  }
  container.innerHTML = html;
  Security.aplicarRestricoesVisuais();
}

function corTipoEscala(tipo) {
  const cores = {
    'Férias': '#f59e0b', 'Day Off': '#3b82f6', 'Folga': '#10b981',
    'Treinamento': '#6366f1', 'Home Office': '#8b5cf6', 'Licença': '#ef4444',
    'Normal': '#6b7280'
  };
  return cores[tipo] || '#6b7280';
}

async function abrirDiaEscala(data) {
  let escalas = await DB.escalas.listar({
    data_inicio: data,
    data_fim: data,
    colaborador_id: APP.filtros.escalas.colaborador_id || ''
  });
  if (APP.filtros.escalas.reporte) {
    const idsReporte = (APP.dados.colaboradores || [])
      .filter(c => c.reporte === APP.filtros.escalas.reporte)
      .map(c => String(c.id));
    escalas = escalas.filter(e => idsReporte.includes(String(e.colaborador_id)));
  }
  const modal = document.getElementById('modal-dia-escala');
  const title = document.getElementById('modal-dia-title');
  const body = document.getElementById('modal-dia-body');
  if (!modal) return;
  title.textContent = `Escalas — ${formatarData(data)}`;
  body.innerHTML = escalas.length ? `
    <div style="margin-bottom:12px;display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" onclick="abrirModalNovaEscala('${data}')">+ Nova Escala</button>
    </div>
    <div class="table-wrapper">
    <table class="table">
      <thead><tr><th>Colaborador</th><th>Entrada</th><th>Saída</th><th>Pausa 1</th><th>Pausa 2</th><th>Tipo</th><th>Obs</th><th></th></tr></thead>
      <tbody>
        ${escalas.map(e => `
          <tr>
            <td>${e.colaborador_nome || '-'}</td>
            <td>${e.entrada || e.horario || '-'}</td>
            <td>${e.saida || '-'}</td>
            <td>${e.pausa1 || '-'}</td>
            <td>${e.pausa2 || '-'}</td>
            <td>${badgeEscala(e.tipo_alteracao)}</td>
            <td class="text-sm text-muted">${e.observacao || '-'}</td>
            <td><button class="table-action-btn del" onclick="excluirEscala(${e.id})">🗑️</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  ` : `
    <div class="empty-state">
      <div class="empty-icon">📅</div>
      <div class="empty-title">Nenhuma escala neste dia</div>
    </div>
    <div style="text-align:center;margin-top:12px">
      <button class="btn btn-primary" onclick="abrirModalNovaEscala('${data}')">+ Adicionar Escala</button>
    </div>
  `;
  abrirModal('modal-dia-escala');
  Security.aplicarRestricoesVisuais();
}

async function abrirModalNovaEscala(data = '') {
  if (!Security.requirePermission('cadastrar_escala')) return;
  fecharModal('modal-dia-escala');
  document.getElementById('esc-data').value = data;
  // Carregar colaboradores no select
  const sel = document.getElementById('esc-colaborador');
  if (sel) {
    const colaboradores = await DB.colaboradores.listar({ status: 'Ativo' });
    sel.innerHTML = '<option value="">Selecione...</option>' +
      colaboradores.map(c => `<option value="${c.id}" data-nome="${c.nome}">${c.nome}</option>`).join('');
  }
  abrirModal('modal-nova-escala');
}


function minutosDoHorario(valor) {
  const match = String(valor || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const horas = Number(match[1]);
  const minutos = Number(match[2]);
  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) return null;
  return horas * 60 + minutos;
}

function obterIntervaloHorario(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return null;
  const match = texto.match(/(\d{1,2}:\d{2})\s*(?:-|às|a|ate|até)\s*(\d{1,2}:\d{2})/i);
  if (!match) return null;
  return {
    inicioTexto: match[1],
    fimTexto: match[2],
    inicio: minutosDoHorario(match[1]),
    fim: minutosDoHorario(match[2])
  };
}

function validarAlmocoPorEntrada(entrada, almoco) {
  if (!String(almoco || '').trim()) return { ok: true };
  if (!String(entrada || '').trim()) {
    return { ok: false, mensagem: 'Informe a Entrada antes de preencher o Almoço.' };
  }

  const entradaMin = minutosDoHorario(entrada);
  const intervalo = obterIntervaloHorario(almoco);

  if (entradaMin === null) {
    return { ok: false, mensagem: 'Entrada inválida. Use o formato HH:MM.' };
  }

  if (!intervalo || intervalo.inicio === null || intervalo.fim === null) {
    return { ok: false, mensagem: 'Almoço inválido. Use o formato 12:00-13:00.' };
  }

  if (intervalo.fim <= intervalo.inicio) {
    return { ok: false, mensagem: 'O horário final do Almoço deve ser maior que o inicial.' };
  }

  const limiteInicio = entradaMin + 5 * 60;
  const limiteFim = entradaMin + 6 * 60;

  if (intervalo.inicio > limiteInicio || intervalo.fim > limiteFim) {
    const hh = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return {
      ok: false,
      mensagem: `Almoço fora do limite. Para entrada ${entrada}, use no máximo ${hh(limiteInicio)}-${hh(limiteFim)}.`
    };
  }

  return { ok: true };
}

async function salvarEscala() {
  if (!Security.requirePermission('cadastrar_escala')) return;
  const form = document.getElementById('form-nova-escala');
  const dados = Object.fromEntries(new FormData(form));
  if (!dados.colaborador_id) { toast('Selecione um colaborador', 'error'); return; }
  if (!dados.data) { toast('Data inicial é obrigatória', 'error'); return; }

  const validacaoAlmoco = validarAlmocoPorEntrada(dados.entrada, dados.almoco);
  if (!validacaoAlmoco.ok) { toast(validacaoAlmoco.mensagem, 'error'); return; }

  const sel = document.getElementById('esc-colaborador');
  const opt = sel.querySelector(`option[value="${dados.colaborador_id}"]`);
  dados.colaborador_nome = opt?.dataset.nome || '';

  const dataInicio = dados.data;
  const dataFim = dados.data_fim || dados.data;
  const sabado = !!dados.folga_sabado;
  const domingo = !!dados.folga_domingo;

  delete dados.data_fim;
  delete dados.folga_sabado;
  delete dados.folga_domingo;

  dados.hora_extra = dados.hora_extra === '' ? null : Number(dados.hora_extra || 0);

  try {
    const registros = gerarRegistrosEscala(dados, dataInicio, dataFim, sabado, domingo);

    if (!registros.length) {
      toast('Nenhuma data válida no período selecionado', 'warning');
      return;
    }

    await DB.escalas.importarLote(registros);
    toast(`${registros.length} escala(s) adicionada(s)`, 'success');
    fecharModal('modal-nova-escala');
    await renderizarCalendario();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

function gerarRegistrosEscala(base, dataInicio, dataFim, somenteSabado, somenteDomingo) {
  const registros = [];
  const inicio = new Date(`${dataInicio}T00:00:00`);
  const fim = new Date(`${dataFim}T00:00:00`);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim < inicio) {
    return [];
  }

  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const diaSemana = d.getDay();
    const filtrarFimDeSemana = somenteSabado || somenteDomingo;

    if (filtrarFimDeSemana && !((somenteSabado && diaSemana === 6) || (somenteDomingo && diaSemana === 0))) {
      continue;
    }

    registros.push({
      ...base,
      data: d.toISOString().slice(0, 10),
      tipo_alteracao: filtrarFimDeSemana ? 'Folga' : (base.tipo_alteracao || 'Normal'),
      status: filtrarFimDeSemana ? 'Folga' : (base.status || 'Normal')
    });
  }

  return registros;
}

async function excluirEscala(id) {
  if (!Security.requirePermission('excluir_escala')) return;
  if (!confirm('Excluir esta escala?')) return;
  try {
    await DB.escalas.excluir(id);
    toast('Escala excluída', 'success');
    fecharModal('modal-dia-escala');
    await renderizarCalendario();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

function mesAnterior() {
  APP.calendarioData.setMonth(APP.calendarioData.getMonth() - 1);
  renderizarCalendario();
}

function selecionarArquivoEscalas() {
  if (!Security.requirePermission('importar_escala')) return;
  const input = document.getElementById('escala-file-input');
  if (input) input.click();
}

async function processarArquivoEscalas(file) {
  if (!Security.requirePermission('importar_escala')) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['csv', 'xlsx', 'xls'].includes(ext)) {
    toast('Formato inválido. Use CSV ou Excel.', 'error');
    return;
  }

  toast('Processando escalas...', 'info');
  const reader = new FileReader();

  reader.onload = async e => {
    try {
      let dados = [];
      if (ext === 'csv') {
        dados = parsearCSV(e.target.result);
      } else {
        if (typeof XLSX === 'undefined') {
          toast('Biblioteca XLSX não carregada. Exporte como CSV ou confira o index.html.', 'error');
          return;
        }
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        dados = XLSX.utils.sheet_to_json(ws, { defval: '' });
      }

      await importarEscalasEmMassa(dados);
    } catch (err) {
      toast('Erro ao importar escalas: ' + err.message, 'error');
    } finally {
      const input = document.getElementById('escala-file-input');
      if (input) input.value = '';
    }
  };

  if (ext === 'csv') reader.readAsText(file);
  else reader.readAsBinaryString(file);
}

async function importarEscalasEmMassa(dados) {
  if (!Security.requirePermission('importar_escala')) return;
  if (!dados?.length) {
    toast('Nenhuma escala encontrada no arquivo', 'warning');
    return;
  }

  const get = (obj, nomes) => {
    const normalizar = s => String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/^\ufeff/, '');

    const mapa = Object.fromEntries(
      Object.keys(obj).map(k => [normalizar(k), k])
    );

    for (const nome of nomes) {
      const chave = mapa[normalizar(nome)];
      if (chave && String(obj[chave] ?? '').trim() !== '') {
        return String(obj[chave]).trim();
      }
    }
    return '';
  };

  const colaboradores = APP.dados.colaboradores?.length
    ? APP.dados.colaboradores
    : await DB.colaboradores.listar({ status: 'Ativo' });

  const buscarColaborador = row => {
    const matricula = get(row, ['matricula', 'Matrícula', 'MATRICULA']);
    const nome = get(row, ['nome', 'colaborador', 'Colaborador']);
    return colaboradores.find(c =>
      (matricula && String(c.matricula || '').trim() === matricula) ||
      (nome && String(c.nome || '').trim().toLowerCase() === nome.toLowerCase())
    );
  };

  let registros = [];

  dados.forEach(row => {
    const colab = buscarColaborador(row);

    const dataInicio = normalizarData(get(row, ['data', 'Data', 'DATA']));
    const dataFim = normalizarData(get(row, ['data_fim', 'Data fim', 'Data Fim', 'DATA FIM'])) || dataInicio;

    const base = {
      colaborador_id: colab?.id || null,
      colaborador_nome: colab?.nome || get(row, ['nome', 'colaborador', 'Colaborador']),
      entrada: get(row, ['entrada', 'Entrada']),
      saida: get(row, ['saida', 'Saída', 'Saida']),
      almoco: get(row, ['almoco', 'Almoço', 'Almoco']),
      pausa1: get(row, ['pausa1', 'Pausa 1', 'Pausa1']),
      pausa2: get(row, ['pausa2', 'Pausa 2', 'Pausa2']),
      tipo_alteracao: get(row, ['tipo', 'Tipo', 'tipo_alteracao', 'Tipo alteração', 'Escala']) || 'Normal',
      observacao: get(row, ['observacao', 'Observação', 'Obs']),
      status: get(row, ['status', 'Status']) || 'Normal'
    };

    if (!base.colaborador_nome || !dataInicio) return;

    registros.push(...gerarRegistrosEscala(base, dataInicio, dataFim, false, false));
  });

  if (!registros.length) {
    toast('Nenhuma escala válida. Confira Colaborador, Data e Data fim.', 'error');
    return;
  }

  const almocoInvalido = registros.find(r => !validarAlmocoPorEntrada(r.entrada, r.almoco).ok);
  if (almocoInvalido) {
    const validacao = validarAlmocoPorEntrada(almocoInvalido.entrada, almocoInvalido.almoco);
    toast(`${almocoInvalido.colaborador_nome} em ${formatarData(almocoInvalido.data)}: ${validacao.mensagem}`, 'error');
    return;
  }

  await DB.escalas.importarLote(registros);
  toast(`${registros.length} escala(s) importada(s) com sucesso`, 'success');
  await renderizarCalendario();
}
function proxMes() {
  APP.calendarioData.setMonth(APP.calendarioData.getMonth() + 1);
  renderizarCalendario();
}

// ============================================================
// PROGRAMAÇÕES
// ============================================================
async function carregarProgramacoes() {
  APP.dados.programacoes = await carregarComLoading('tabela-programacoes', () =>
    DB.programacoes.listar(APP.filtros.programacoes)
  );
  renderizarTabelaProgramacoes();
}

function renderizarTabelaProgramacoes() {
  const tbody = document.getElementById('tabela-programacoes');
  if (!tbody) return;
  let dados = filtrarDados(APP.dados.programacoes, APP.filtros.programacoes, APP.busca);
  const pag = APP.paginacao.programacoes;
  const total = dados.length;
  const slice = dados.slice((pag.pagina - 1) * pag.porPagina, pag.pagina * pag.porPagina);

  tbody.innerHTML = slice.length ? slice.map(p => `
    <tr>
      <td>${p.colaborador_nome || '-'}</td>
      <td>${badgeEscala(p.tipo)}</td>
      <td>${formatarData(p.data_inicio)}</td>
      <td>${p.data_fim ? formatarData(p.data_fim) : '-'}</td>
      <td>${p.recorrente ? '🔄 Sim' : 'Não'}</td>
      <td>${p.motivo || '-'}</td>
      <td>${badgeProgramacaoStatus(p.status)}</td>
      <td>
        <div class="table-actions">
          ${p.status === 'Pendente' ? `<button class="table-action-btn" onclick="aprovarProgramacao(${p.id})" title="Aprovar" style="color:var(--success)">✅</button>` : ''}
          <button class="table-action-btn del" onclick="excluirProgramacao(${p.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">Nenhuma programação</div></div></td></tr>`;

  renderizarPaginacao('programacoes', total, pag);
  Security.aplicarRestricoesVisuais();
}

async function abrirModalProgramacao() {
  if (!Security.requirePermission('cadastrar_programacao')) return;
  document.getElementById('form-programacao')?.reset();
  APP.editandoId = null;
  const sel = document.getElementById('prog-colaborador');
  if (sel) {
    const colaboradores = await DB.colaboradores.listar({ status: 'Ativo' });
    sel.innerHTML = '<option value="">Selecione...</option>' +
      colaboradores.map(c => `<option value="${c.id}" data-nome="${c.nome}">${c.nome}</option>`).join('');
  }
  abrirModal('modal-programacao');
}

async function salvarProgramacao() {
  if (!Security.requirePermission('cadastrar_programacao')) return;
  const form = document.getElementById('form-programacao');
  const dados = Object.fromEntries(new FormData(form));
  if (!dados.colaborador_id) { toast('Selecione um colaborador', 'error'); return; }
  if (!dados.tipo) { toast('Tipo é obrigatório', 'error'); return; }
  if (!dados.data_inicio) { toast('Data início é obrigatória', 'error'); return; }
  const sel = document.getElementById('prog-colaborador');
  const opt = sel?.querySelector(`option[value="${dados.colaborador_id}"]`);
  dados.colaborador_nome = opt?.dataset.nome || '';
  dados.recorrente = dados.recorrente === 'on';
  try {
    await DB.programacoes.criar(dados);
    toast('Programação criada', 'success');
    fecharModal('modal-programacao');
    await carregarProgramacoes();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

async function aprovarProgramacao(id) {
  if (!Security.requirePermission('aprovar_programacao')) return;
  try {
    await DB.programacoes.aprovar(id, 'Admin');
    toast('Programação aprovada', 'success');
    await carregarProgramacoes();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

async function excluirProgramacao(id) {
  if (!Security.requirePermission('excluir_programacao')) return;
  if (!confirm('Excluir esta programação?')) return;
  try {
    await DB.programacoes.excluir(id);
    toast('Excluída com sucesso', 'success');
    await carregarProgramacoes();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

// ============================================================
// FÉRIAS (filtragem do Colaboradores)
// ============================================================
async function carregarFerias() {
  const container = document.getElementById('tabela-ferias');
  if (!container) return;
  container.innerHTML = '<tr><td colspan="8"><div class="loading-inline"><div class="spinner"></div> Carregando...</div></td></tr>';
  try {
    const todos = await DB.colaboradores.listar();
    const emFerias = todos.filter(c => c.status === 'Férias' || c.primeiro_dia_ferias);
    container.innerHTML = emFerias.length ? emFerias.map(c => `
      <tr>
        <td>${c.matricula || '-'}</td>
        <td><strong>${c.nome}</strong></td>
        <td>${c.celula || '-'}</td>
        <td>${c.supervisor || '-'}</td>
        <td>${c.primeiro_dia_ferias ? formatarData(c.primeiro_dia_ferias) : '-'}</td>
        <td>${c.ultimo_dia_ferias ? formatarData(c.ultimo_dia_ferias) : '-'}</td>
        <td>${diasFerias(c.primeiro_dia_ferias, c.ultimo_dia_ferias)}</td>
        <td>${badgeStatus(c.status)}</td>
      </tr>
    `).join('') : `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🏖️</div><div class="empty-title">Nenhum colaborador em férias</div></div></td></tr>`;
  } catch (e) { toast('Erro ao carregar férias', 'error'); }
}

function diasFerias(inicio, fim) {
  if (!inicio || !fim) return '-';
  const d1 = new Date(inicio), d2 = new Date(fim);
  const diff = Math.ceil((d2 - d1) / (1000*60*60*24)) + 1;
  return diff + ' dias';
}

// ============================================================
// RELATÓRIOS
// ============================================================
async function carregarRelatorios() {
  // Mostrar resumo básico
  const el = document.getElementById('relatorio-resumo');
  if (!el) return;
  try {
    const [total, ativos, ferias] = await Promise.all([
      DB.colaboradores.contar(),
      DB.colaboradores.contarPorStatus('Ativo'),
      DB.colaboradores.contarPorStatus('Férias'),
    ]);
    el.innerHTML = `
      <p>Total de colaboradores: <strong>${total}</strong></p>
      <p>Ativos: <strong>${ativos}</strong></p>
      <p>Em férias: <strong>${ferias}</strong></p>
    `;
  } catch (e) {}
}

async function gerarRelatorio(tipo) {
  if (!Security.requirePermission('exportar_relatorios')) return;
  toast('Gerando relatório...', 'info');
  try {
    let dados = [];
    let nome = tipo;
    switch (tipo) {
      case 'colaboradores': dados = await DB.colaboradores.listar(); nome = 'colaboradores'; break;
      case 'staff': dados = await DB.staff.listar(); nome = 'staff'; break;
      case 'escalas': dados = await DB.escalas.listar(); nome = 'escalas'; break;
      case 'programacoes': dados = await DB.programacoes.listar(); nome = 'programacoes'; break;
      case 'ferias':
        const todos = await DB.colaboradores.listar();
        dados = todos.filter(c => c.status === 'Férias' || c.primeiro_dia_ferias);
        nome = 'ferias';
        break;
    }
    exportarCSV(dados, nome);
    toast('Relatório exportado com sucesso!', 'success');
  } catch (e) { toast('Erro ao gerar relatório', 'error'); }
}

// ============================================================
// IMPORTAÇÃO EM MASSA
// ============================================================
function carregarImportacao() {
  configurarDropzone();
  Security.aplicarRestricoesVisuais();
}

function configurarDropzone() {
  if (!Security.verificarPermissao('importar_dados')) return;
  const dropzone = document.getElementById('dropzone-import');
  if (!dropzone) return;
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) processarArquivoImportacao(file);
  });
  const input = document.getElementById('import-file-input');
  if (input) input.addEventListener('change', e => {
    if (e.target.files[0]) processarArquivoImportacao(e.target.files[0]);
  });
}

async function processarArquivoImportacao(file) {
  if (!Security.requirePermission('importar_dados')) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['csv', 'xlsx', 'xls'].includes(ext)) {
    toast('Formato inválido. Use CSV ou Excel.', 'error');
    return;
  }
  toast('Processando arquivo...', 'info');
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      let dados = [];
      if (ext === 'csv') {
        dados = parsearCSV(e.target.result);
      } else {
        // XLSX via SheetJS se disponível
        if (typeof XLSX !== 'undefined') {
          const wb = XLSX.read(e.target.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          dados = XLSX.utils.sheet_to_json(ws);
        } else {
          toast('Para Excel, instale a lib XLSX ou exporte como CSV', 'warning');
          return;
        }
      }
      mostrarPreviewImportacao(dados);
    } catch (err) { toast('Erro ao processar: ' + err.message, 'error'); }
  };
  if (ext === 'csv') reader.readAsText(file);
  else reader.readAsBinaryString(file);
}

function parsearCSV(texto) {
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  if (!linhas.length) return [];

  const primeiraLinha = linhas[0];
  const separador = primeiraLinha.includes(';') ? ';' : ',';
  const dividir = linha => linha
    .split(separador)
    .map(v => v.trim().replace(/^"|"$/g, ''));

  const headers = dividir(primeiraLinha);
  return linhas.slice(1).map(linha => {
    const valores = dividir(linha);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = valores[i] || ''; });
    return obj;
  });
}

function normalizarData(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  // Corrige data serial do Excel, mesmo quando vem como texto: "46174"
  if (
    typeof valor === 'number' ||
    /^\d{5}$/.test(String(valor).trim())
  ) {
    const numero = Number(String(valor).trim());
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + numero);
    return excelEpoch.toISOString().slice(0, 10);
  }

  const v = String(valor).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const [, dia, mes, ano] = br;
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  return null;
}

function mostrarPreviewImportacao(dados) {
  const preview = document.getElementById('import-preview');
  if (!preview) return;
  if (!dados.length) { toast('Nenhum dado encontrado', 'warning'); return; }
  const headers = Object.keys(dados[0]);
  preview.innerHTML = `
    <div class="card mt-4">
      <div class="card-header">
        <div class="card-title">Pré-visualização (${dados.length} registros)</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" onclick="confirmarImportacao(window._dadosImport)">
            ✅ Importar ${dados.length} registros
          </button>
          <button class="btn btn-secondary" onclick="document.getElementById('import-preview').innerHTML=''">Cancelar</button>
        </div>
      </div>
      <div class="table-wrapper" style="max-height:320px;overflow:auto">
        <table class="table">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${dados.slice(0, 20).map(row => `<tr>${headers.map(h => `<td class="text-sm">${row[h] || ''}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${dados.length > 20 ? `<div style="padding:10px 16px;font-size:12px;color:var(--text2)">... e mais ${dados.length - 20} registros</div>` : ''}
    </div>
  `;
  window._dadosImport = dados;
}

async function confirmarImportacao(dados) {
  if (!Security.requirePermission('importar_dados')) return;
  if (!dados?.length) return;
  const destino = document.getElementById('import-destino')?.value || 'colaboradores';
  toast(`Importando ${dados.length} registros...`, 'info');
  try {
    // Mapear campos comuns
    const mapeados = dados.map(d => ({
      nome: d.nome || d.Colaborador || d.COLABORADOR || d.Nome || '',
      matricula: d.matricula || d.Matrícula || d.MATRICULA || '',
      email: d.email || d.Email || d.EMAIL || '',
      celula: d.celula || d.Célula || d.CELULA || '',
      status: d.status || d.Status || 'Ativo',
      cargo: d.cargo || d.Cargo || '',
      cpf: d.cpf || d.CPF || '',
      filial: d.filial || d.Filial || '',
      grupo: d.grupo || d.Grupo || '',
      horario: d.horario || d.Horário || d.Horario || '',
    })).filter(d => d.nome);

    if (destino === 'colaboradores') {
      await DB.colaboradores.importarLote(mapeados);
    } else if (destino === 'staff') {
      const { data, error } = await db.from('staff').upsert(mapeados, { onConflict: 'matricula' });
      if (error) throw error;
    }

    toast(`${mapeados.length} registros importados com sucesso!`, 'success');
    document.getElementById('import-preview').innerHTML = '';
    window._dadosImport = null;
  } catch (e) { toast('Erro na importação: ' + e.message, 'error'); }
}

// ============================================================
// CONFIGURAÇÕES
// ============================================================
async function carregarConfiguracoes() {
  try {
    APP.config = await DB.configuracoes.listar();
    const empresa = document.getElementById('cfg-empresa');
    if (empresa && APP.config.empresa) empresa.value = JSON.parse(APP.config.empresa || '""');
    if (verificarPermissao('gerenciar_usuarios')) await carregarUsuariosAutorizados();
  } catch (e) {}
}

async function salvarConfiguracoes() {
  if (!Security.requirePermission('acessar_configuracoes')) return;
  const empresa = document.getElementById('cfg-empresa')?.value;
  try {
    await DB.configuracoes.salvar('empresa', JSON.stringify(empresa));
    await DB.configuracoes.salvar('tema', JSON.stringify(APP.tema));
    toast('Configurações salvas', 'success');
  } catch (e) { toast('Erro ao salvar', 'error'); }
}

// ============================================================
// EXPORTAÇÃO
// ============================================================
async function carregarUsuariosAutorizados() {
  if (!Security.requirePermission('gerenciar_usuarios')) return;
  const tbody = document.getElementById('tabela-usuarios-autorizados');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5"><div class="loading-inline"><div class="spinner"></div> Carregando...</div></td></tr>';
  try {
    const usuarios = await DB.usuariosAutorizados.listar();
    tbody.innerHTML = usuarios.length ? usuarios.map(u => `
      <tr>
        <td>${escapeHtml(u.nome || '-')}</td>
        <td>${escapeHtml(u.email || '-')}</td>
        <td><span class="badge badge-blue">${escapeHtml(u.perfil || '-')}</span></td>
        <td>${badgeStatus(u.status)}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="preencherUsuarioAutorizado('${u.id}','${escapeHtml(u.nome || '')}','${escapeHtml(u.email || '')}','${escapeHtml(u.perfil || '')}','${escapeHtml(u.status || '')}')">Editar</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="5" class="text-muted text-center">Nenhum usuario autorizado</td></tr>';
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-title">Erro ao carregar usuarios</div><div class="empty-desc">${escapeHtml(e.message)}</div></div></td></tr>`;
  }
}

function preencherUsuarioAutorizado(id, nome, email, perfil, status) {
  if (!Security.requirePermission('gerenciar_usuarios')) return;
  document.getElementById('usr-nome').value = nome;
  document.getElementById('usr-email').value = email;
  document.getElementById('usr-email').dataset.id = id;
  document.getElementById('usr-perfil').value = perfil || 'CONSULTA';
  document.getElementById('usr-status').value = status || 'Ativo';
}

async function salvarUsuarioAutorizado() {
  if (!Security.requirePermission('gerenciar_usuarios')) return;
  const nome = document.getElementById('usr-nome')?.value || '';
  const email = document.getElementById('usr-email')?.value || '';
  const perfil = document.getElementById('usr-perfil')?.value || 'CONSULTA';
  const status = document.getElementById('usr-status')?.value || 'Ativo';

  if (!email.trim()) {
    toast('E-mail e obrigatorio', 'error');
    return;
  }

  try {
    await DB.usuariosAutorizados.salvar({ nome, email, perfil, status });
    toast('Usuario autorizado salvo', 'success');
    document.getElementById('usr-nome').value = '';
    document.getElementById('usr-email').value = '';
    document.getElementById('usr-email').dataset.id = '';
    document.getElementById('usr-perfil').value = 'CONSULTA';
    document.getElementById('usr-status').value = 'Ativo';
    await carregarUsuariosAutorizados();
  } catch (e) {
    toast('Erro ao salvar usuario: ' + e.message, 'error');
  }
}

async function exportarColaboradores(formato) {
  if (!Security.requirePermission('exportar_relatorios')) return;
  const dados = await DB.colaboradores.listar(APP.filtros.colaboradores);
  if (formato === 'csv') exportarCSV(dados, 'colaboradores');
  else if (formato === 'pdf') exportarPDF(dados, 'Colaboradores');
}

function exportarCSV(dados, nome) {
  if (!dados.length) { toast('Sem dados para exportar', 'warning'); return; }
  const headers = Object.keys(dados[0]);
  const rows = dados.map(d => headers.map(h => `"${(d[h] || '').toString().replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  downloadArquivo(csv, `${nome}_${dataHoje()}.csv`, 'text/csv');
}

function exportarPDF(dados, titulo) {
  if (!dados.length) { toast('Sem dados para exportar', 'warning'); return; }
  const headers = Object.keys(dados[0]).slice(0, 8);
  const html = `
    <html><head><title>${titulo}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
      h1{font-size:16px;margin-bottom:12px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f5f5f5;font-weight:bold}
      tr:nth-child(even){background:#fafafa}
    </style></head><body>
    <h1>${titulo} — ${dataHoje()}</h1>
    <p>Total: ${dados.length} registros</p>
    <table>
      <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${dados.slice(0,500).map(d=>`<tr>${headers.map(h=>`<td>${d[h]||''}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    </body></html>
  `;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.print();
}

function downloadArquivo(conteudo, nome, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// EXCLUSÃO COM CONFIRMAÇÃO
// ============================================================
async function confirmarExclusao(tabela, id, nome) {
  const acoes = {
    colaboradores: 'excluir_colaborador',
    staff: 'excluir_staff',
    escalas: 'excluir_escala',
    programacoes: 'excluir_programacao'
  };
  if (!Security.requirePermission(acoes[tabela] || 'excluir_registro')) return;
  const modal = document.getElementById('modal-confirm');
  const msg = document.getElementById('confirm-msg');
  if (msg) msg.textContent = `Deseja excluir "${nome}"? Esta ação não pode ser desfeita.`;
  window._confirmCallback = async () => {
    try {
      await DB[tabela].excluir(id);
      toast('Registro excluído com sucesso', 'success');
      fecharModal('modal-confirm');
      await carregarPagina(APP.pagina);
    } catch (e) { toast('Erro ao excluir: ' + e.message, 'error'); }
  };
  abrirModal('modal-confirm');
}

// ============================================================
// PAGINAÇÃO
// ============================================================
function renderizarPaginacao(chave, total, pag) {
  const container = document.getElementById(`paginacao-${chave}`);
  if (!container) return;
  const totalPaginas = Math.ceil(total / pag.porPagina);
  const inicio = Math.min((pag.pagina - 1) * pag.porPagina + 1, total);
  const fim = Math.min(pag.pagina * pag.porPagina, total);

  const btns = [];
  if (pag.pagina > 1) btns.push(`<button class="page-btn" onclick="irParaPagina('${chave}',${pag.pagina-1})">‹</button>`);
  for (let i = Math.max(1, pag.pagina-2); i <= Math.min(totalPaginas, pag.pagina+2); i++) {
    btns.push(`<button class="page-btn ${i===pag.pagina?'active':''}" onclick="irParaPagina('${chave}',${i})">${i}</button>`);
  }
  if (pag.pagina < totalPaginas) btns.push(`<button class="page-btn" onclick="irParaPagina('${chave}',${pag.pagina+1})">›</button>`);

  container.innerHTML = `
    <div class="pagination">
      <div class="pagination-info">Exibindo ${inicio}–${fim} de ${total} registros</div>
      <div class="pagination-btns">${btns.join('')}</div>
    </div>
  `;
}

function irParaPagina(chave, pagina) {
  APP.paginacao[chave].pagina = pagina;
  if (chave === 'colaboradores') renderizarTabelaColaboradores();
  if (chave === 'staff') renderizarTabelaStaff();
  if (chave === 'programacoes') renderizarTabelaProgramacoes();
}

// ============================================================
// MODAL HELPERS
// ============================================================
function abrirModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function fecharModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}
function fecharTodosModais() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  document.body.style.overflow = '';
}
// Fechar modal ao clicar fora
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) fecharTodosModais();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') fecharTodosModais();
});

// ============================================================
// TOAST
// ============================================================
function toast(msg, tipo = 'info', duracao = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.innerHTML = `<span class="toast-icon">${icons[tipo] || 'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 250);
  }, duracao);
}

// ============================================================
// HELPERS
// ============================================================
function badgeStatus(status) {
  const map = {
    'Ativo': 'badge-active', 'Inativo': 'badge-inactive', 'Desligado': 'badge-inactive',
    'Férias': 'badge-ferias', 'Day Off': 'badge-dayoff', 'Afastado': 'badge-yellow',
    'Treinamento': 'badge-purple'
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${status || '-'}</span>`;
}
function badgeEscala(tipo) {
  const map = {
    'Férias': 'badge-ferias', 'Day Off': 'badge-dayoff', 'Folga': 'badge-green',
    'Treinamento': 'badge-purple', 'Home Office': 'badge-purple', 'Licença': 'badge-red', 'Normal': 'badge-gray'
  };
  return `<span class="badge ${map[tipo] || 'badge-gray'}">${tipo || '-'}</span>`;
}
function badgeProgramacaoStatus(status) {
  const map = { 'Aprovado': 'badge-green', 'Pendente': 'badge-yellow', 'Rejeitado': 'badge-red', 'Cancelado': 'badge-gray' };
  return `<span class="badge ${map[status] || 'badge-gray'}">${status || '-'}</span>`;
}

function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  r = (soma * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(cpf[10]);
}

function formatarData(data) {
  if (!data) return '-';
  const d = new Date(data + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}

function dataHoje() {
  return new Date().toISOString().split('T')[0];
}

async function carregarComLoading(tbodyId, fn) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = `<tr><td colspan="20"><div class="loading-inline"><div class="spinner"></div> Carregando...</div></td></tr>`;
  try {
    return await fn();
  } catch (e) {
    if (el) el.innerHTML = `<tr><td colspan="20"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Erro ao carregar: ${e.message}</div></div></td></tr>`;
    return [];
  }
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function atualizarContadorSelecao() {
  const checks = document.querySelectorAll('.row-check:checked');
  const bar = document.getElementById('selection-bar');
  const cnt = document.getElementById('selection-count');
  if (bar) bar.classList.toggle('hidden', checks.length === 0);
  if (cnt) cnt.textContent = checks.length;
}

// Select all checkbox
document.addEventListener('change', e => {
  if (e.target.id === 'check-all') {
    document.querySelectorAll('.row-check').forEach(c => c.checked = e.target.checked);
    atualizarContadorSelecao();
  }
  if (e.target.classList.contains('row-check')) atualizarContadorSelecao();
});

// Inicializa dropzone quando carrega a aba
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(configurarDropzone, 500);
});function escapeHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
