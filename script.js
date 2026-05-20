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
  await inicializarApp();
});

async function inicializarApp() {
  mostrarLoader(true);
  try {
    APP.config = await DB.configuracoes.listar();
    await carregarPagina('dashboard');
    configurarEventos();
    configurarRealtime();
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
}

async function abrirModalStaff(id = null) {
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
  await renderizarCalendario();
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
  const escalas = await DB.escalas.listar({ data_inicio: dataInicio, data_fim: dataFim });

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
  const escalas = await DB.escalas.listar({ data_inicio: data, data_fim: data });
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
      <thead><tr><th>Colaborador</th><th>Entrada</th><th>Saída</th><th>Tipo</th><th>Obs</th><th></th></tr></thead>
      <tbody>
        ${escalas.map(e => `
          <tr>
            <td>${e.colaborador_nome || '-'}</td>
            <td>${e.entrada || e.horario || '-'}</td>
            <td>${e.saida || '-'}</td>
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
}

async function abrirModalNovaEscala(data = '') {
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

async function salvarEscala() {
  const form = document.getElementById('form-nova-escala');
  const dados = Object.fromEntries(new FormData(form));
  if (!dados.colaborador_id) { toast('Selecione um colaborador', 'error'); return; }
  if (!dados.data) { toast('Data é obrigatória', 'error'); return; }
  const sel = document.getElementById('esc-colaborador');
  const opt = sel.querySelector(`option[value="${dados.colaborador_id}"]`);
  dados.colaborador_nome = opt?.dataset.nome || '';
  try {
    await DB.escalas.criar(dados);
    toast('Escala adicionada', 'success');
    fecharModal('modal-nova-escala');
    await renderizarCalendario();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

async function excluirEscala(id) {
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
}

async function abrirModalProgramacao() {
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
  try {
    await DB.programacoes.aprovar(id, 'Admin');
    toast('Programação aprovada', 'success');
    await carregarProgramacoes();
  } catch (e) { toast('Erro: ' + e.message, 'error'); }
}

async function excluirProgramacao(id) {
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
  // Inicializado via HTML
}

function configurarDropzone() {
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
  const linhas = texto.split('\n').filter(l => l.trim());
  if (!linhas.length) return [];
  const headers = linhas[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
  return linhas.slice(1).map(linha => {
    const valores = linha.split(',').map(v => v.trim().replace(/['"]/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = valores[i] || ''; });
    return obj;
  });
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
  } catch (e) {}
}

async function salvarConfiguracoes() {
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
async function exportarColaboradores(formato) {
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
});
