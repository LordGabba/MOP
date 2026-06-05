// ============================================================
// permissions.js - Perfis e permissoes centralizadas
// ============================================================

(function () {
  const PERFIS = {
    ADMIN: 'ADMIN',
    GESTOR: 'GESTOR',
    CONSULTA: 'CONSULTA',
    AGENTE: 'AGENTE',
    BLOQUEADO: 'BLOQUEADO',
    INATIVO: 'INATIVO'
  };

  const PERMISSOES_POR_PERFIL = {
    ADMIN: ['*'],
    GESTOR: [
      'visualizar_dashboard',
      'visualizar_colaboradores',
      'visualizar_staff',
      'visualizar_escalas',
      'visualizar_programacoes',
      'visualizar_ferias',
      'visualizar_relatorios',
      'cadastrar_colaborador',
      'editar_colaborador',
      'cadastrar_staff',
      'editar_staff',
      'cadastrar_escala',
      'editar_escala',
      'importar_escala',
      'cadastrar_programacao',
      'editar_programacao',
      'aprovar_programacao',
      'importar_dados',
      'exportar_relatorios'
    ],
    CONSULTA: [
      'visualizar_dashboard',
      'visualizar_colaboradores',
      'visualizar_staff',
      'visualizar_escalas',
      'visualizar_programacoes',
      'visualizar_ferias',
      'visualizar_relatorios',
      'exportar_relatorios'
    ],
    AGENTE: [
      'visualizar_escalas',
      'visualizar_propria_escala'
    ],
    BLOQUEADO: [],
    INATIVO: []
  };

  const PAGINAS = {
    dashboard: 'visualizar_dashboard',
    colaboradores: 'visualizar_colaboradores',
    staff: 'visualizar_staff',
    escalas: 'visualizar_escalas',
    programacoes: 'visualizar_programacoes',
    ferias: 'visualizar_ferias',
    relatorios: 'visualizar_relatorios',
    importacao: 'importar_dados',
    configuracoes: 'acessar_configuracoes'
  };

  const estado = {
    session: null,
    user: null,
    autorizado: null,
    colaborador: null
  };

  function normalizarPerfil(perfil) {
    return String(perfil || '').trim().toUpperCase() || PERFIS.CONSULTA;
  }

  function normalizarStatus(status) {
    return String(status || '').trim().toLowerCase();
  }

  function getPerfil() {
    return normalizarPerfil(estado.autorizado?.perfil);
  }

  function getPermissoes() {
    return PERMISSOES_POR_PERFIL[getPerfil()] || [];
  }

  function verificarPermissao(acao) {
    if (!acao) return false;
    const perfil = getPerfil();
    const status = normalizarStatus(estado.autorizado?.status);

    if (!estado.session || status !== 'ativo') return false;
    if (perfil === PERFIS.BLOQUEADO || perfil === PERFIS.INATIVO) return false;

    const permissoes = getPermissoes();
    return permissoes.includes('*') || permissoes.includes(acao);
  }

  function podeAcessarPagina(pagina) {
    return verificarPermissao(PAGINAS[pagina]);
  }

  function isAdmin() {
    return getPerfil() === PERFIS.ADMIN;
  }

  function isGestor() {
    return getPerfil() === PERFIS.GESTOR;
  }

  function isConsulta() {
    return getPerfil() === PERFIS.CONSULTA;
  }

  function isAgente() {
    return getPerfil() === PERFIS.AGENTE;
  }

  function setContexto({ session, user, autorizado, colaborador }) {
    estado.session = session || null;
    estado.user = user || session?.user || null;
    estado.autorizado = autorizado || null;
    estado.colaborador = colaborador || null;
  }

  function limparContexto() {
    setContexto({});
  }

  function getDefaultPage() {
    if (isAgente()) return 'escalas';
    return podeAcessarPagina('dashboard') ? 'dashboard' : 'escalas';
  }

  window.Permissions = {
    PERFIS,
    PAGINAS,
    estado,
    setContexto,
    limparContexto,
    getPerfil,
    getPermissoes,
    getDefaultPage,
    verificarPermissao,
    podeAcessarPagina,
    isAdmin,
    isGestor,
    isConsulta,
    isAgente
  };

  window.verificarPermissao = verificarPermissao;
})();

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('colaboradores-mop-export-script')) return;
    const script = document.createElement('script');
    script.id = 'colaboradores-mop-export-script';
    script.src = 'colaboradores-mop-export.js?v=20260605-1';
    document.body.appendChild(script);
  });
})();

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(instalarVisualizacaoTabelaEscalas, 900);
    document.addEventListener('auth:ready', () => setTimeout(instalarVisualizacaoTabelaEscalas, 300));
  });

  function instalarVisualizacaoTabelaEscalas() {
    inserirControlesEscalas();

    if (typeof window.renderizarCalendario !== 'function' || window.renderizarCalendario.__tabelaEscalasPatch) return;

    const renderizarCalendarioOriginal = window.renderizarCalendario;
    window.renderizarCalendario = async function renderizarCalendarioComTabela() {
      inserirControlesEscalas();
      atualizarControlesEscalas();
      if (window.__escalaVisualizacaoAtual === 'tabela') {
        await renderizarTabelaEscalas();
        return;
      }
      await renderizarCalendarioOriginal.apply(this, arguments);
    };
    window.renderizarCalendario.__tabelaEscalasPatch = true;
  }

  function inserirControlesEscalas() {
    const controlesAntigos = document.getElementById('escala-view-controls');
    if (controlesAntigos) controlesAntigos.remove();

    const toolbar = document.querySelector('#page-escalas .toolbar');
    if (!toolbar || document.getElementById('escala-view-controls-main')) return;

    window.__escalaVisualizacaoAtual = window.__escalaVisualizacaoAtual || 'calendario';
    window.__escalaOrdenacaoAtual = window.__escalaOrdenacaoAtual || 'data_asc';

    const controls = document.createElement('div');
    controls.id = 'escala-view-controls-main';
    controls.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
    controls.innerHTML = `
      <div class="table-actions" style="gap:4px">
        <button id="btn-view-calendario-main" class="btn btn-secondary btn-sm" type="button">Calendário</button>
        <button id="btn-view-tabela-main" class="btn btn-secondary btn-sm" type="button">Tabela</button>
      </div>
      <select id="escala-sort-select-main" class="filter-select" style="height:32px;min-width:180px;display:none">
        <option value="data_asc">Data: menor para maior</option>
        <option value="data_desc">Data: maior para menor</option>
        <option value="nome_asc">Colaborador: A-Z</option>
        <option value="nome_desc">Colaborador: Z-A</option>
      </select>
    `;
    toolbar.appendChild(controls);

    document.getElementById('btn-view-calendario-main')?.addEventListener('click', () => trocarVisualizacaoEscalasPatch('calendario'));
    document.getElementById('btn-view-tabela-main')?.addEventListener('click', () => trocarVisualizacaoEscalasPatch('tabela'));
    document.getElementById('escala-sort-select-main')?.addEventListener('change', e => {
      window.__escalaOrdenacaoAtual = e.target.value;
      if (window.__escalaVisualizacaoAtual === 'tabela') window.renderizarCalendario?.();
    });

    atualizarControlesEscalas();
  }

  function trocarVisualizacaoEscalasPatch(visualizacao) {
    window.__escalaVisualizacaoAtual = visualizacao;
    atualizarControlesEscalas();
    window.renderizarCalendario?.();
  }

  function atualizarControlesEscalas() {
    const visualizacao = window.__escalaVisualizacaoAtual || 'calendario';
    document.getElementById('btn-view-calendario-main')?.classList.toggle('active', visualizacao === 'calendario');
    document.getElementById('btn-view-tabela-main')?.classList.toggle('active', visualizacao === 'tabela');

    const sort = document.getElementById('escala-sort-select-main');
    if (sort) {
      sort.value = window.__escalaOrdenacaoAtual || 'data_asc';
      sort.style.display = visualizacao === 'tabela' ? '' : 'none';
    }
  }

  async function renderizarTabelaEscalas() {
    const container = document.getElementById('calendario-grid');
    if (!container || typeof APP === 'undefined' || !window.DB) return;

    const ano = APP.calendarioData.getFullYear();
    const mes = APP.calendarioData.getMonth();
    const ultimoDia = new Date(ano, mes + 1, 0).getDate();
    const dataInicio = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
    const dataFim = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const label = document.getElementById('calendario-mes-label');
    if (label) label.textContent = new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

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

    const colaboradoresBase = filtrarColaboradoresTabela(APP.dados.colaboradores || [], escalas);
    const dias = obterDiasTabela(ultimoDia);
    const escalasPorChave = new Map(escalas.map(e => [`${String(e.colaborador_id)}|${e.data}`, e]));

    container.innerHTML = `
      <style>
        .escala-planner{grid-column:1/-1;width:100%;overflow:auto;background:var(--bg2);border:1px solid var(--border);border-radius:10px}
        .escala-planner-toolbar{position:sticky;left:0;z-index:4;display:flex;justify-content:space-between;gap:14px;align-items:center;padding:14px 16px;background:var(--bg2);border-bottom:1px solid var(--border)}
        .escala-planner-search{width:min(320px,100%);height:38px;border:1px solid var(--border);border-radius:8px;background:var(--bg1);color:var(--text1);padding:0 12px;font-size:13px}
        .escala-planner-legend{display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--text2)}
        .escala-planner-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:-1px}
        .escala-planner-grid{display:grid;grid-template-columns:230px repeat(${dias.length},88px);min-width:${230 + dias.length * 88}px}
        .escala-planner-head,.escala-planner-name,.escala-planner-cell{border-bottom:1px solid var(--border)}
        .escala-planner-head{padding:12px 8px;text-align:center;color:var(--text1);font-size:14px;font-weight:700;background:var(--bg2)}
        .escala-planner-head small{display:block;margin-top:3px;color:var(--text3);font-size:10px;font-weight:700;text-transform:uppercase}
        .escala-planner-name{position:sticky;left:0;z-index:2;background:var(--bg2);padding:14px 12px;min-height:84px}
        .escala-planner-name strong{display:block;color:var(--text1);font-size:13px;line-height:1.25}
        .escala-planner-name span{display:block;color:var(--text2);font-size:12px;margin-top:5px}
        .escala-planner-corner{position:sticky;left:0;z-index:5;text-align:left;padding-left:12px}
        .escala-planner-cell{padding:6px;min-height:84px;background:var(--bg2)}
        .escala-card{height:70px;border-radius:8px;border:1px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:11px;font-weight:700}
        .escala-card .muted{font-weight:600;font-size:10px;opacity:.72}
        .escala-card.trabalho{background:#dbeafe;border-color:#60a5fa;color:#2563eb}
        .escala-card.ferias{background:#fef3c7;border-color:#f59e0b;color:#d97706}
        .escala-card.dayoff{background:#ccfbf1;border-color:#14b8a6;color:#0f766e}
        .escala-card.folga{background:#e5e7eb;border-color:#9ca3af;color:#6b7280}
        .escala-card.treinamento{background:#f3e8ff;border-color:#a855f7;color:#9333ea}
      </style>
      <div class="escala-planner">
        <div class="escala-planner-toolbar">
          <input id="escala-table-search-main" class="escala-planner-search" type="text" placeholder="Buscar colaborador ou cargo..." value="${escapeHtml(window.__escalaBuscaTabela || '')}">
          <div class="escala-planner-legend">
            <span><i class="escala-planner-dot" style="background:#3b82f6"></i>Trabalho</span>
            <span><i class="escala-planner-dot" style="background:#d97706"></i>Férias</span>
            <span><i class="escala-planner-dot" style="background:#14b8a6"></i>Day Off</span>
            <span><i class="escala-planner-dot" style="background:#6b7280"></i>Folga</span>
            <span><i class="escala-planner-dot" style="background:#9333ea"></i>Treinamento</span>
          </div>
        </div>
        <div class="escala-planner-grid">
          <div class="escala-planner-head escala-planner-corner">COLABORADOR</div>
          ${dias.map(d => `<div class="escala-planner-head">${d.dia}<small>${d.semana}</small></div>`).join('')}
          ${colaboradoresBase.length ? colaboradoresBase.map(c => `
            <div class="escala-planner-name">
              <strong>${escapeHtml(c.nome || '-')}</strong>
              <span>${escapeHtml(c.cargo || c.celula || '-')}</span>
            </div>
            ${dias.map(d => renderizarCelulaEscala(c, d, escalasPorChave)).join('')}
          `).join('') : `<div style="grid-column:1/-1"><div class="empty-state"><div class="empty-title">Nenhum colaborador encontrado</div></div></div>`}
        </div>
      </div>
    `;
    document.getElementById('escala-table-search-main')?.addEventListener('input', e => {
      window.__escalaBuscaTabela = e.target.value;
      renderizarTabelaEscalas();
    });
    window.Security?.aplicarRestricoesVisuais?.();
  }

  function filtrarColaboradoresTabela(colaboradores, escalas) {
    const idsEscalados = new Set((escalas || []).map(e => String(e.colaborador_id)));
    const busca = String(window.__escalaBuscaTabela || '').trim().toLowerCase();
    const colaboradoresFiltrados = (colaboradores || [])
      .filter(c => !APP.filtros.escalas.colaborador_id || String(c.id) === String(APP.filtros.escalas.colaborador_id))
      .filter(c => !APP.filtros.escalas.reporte || c.reporte === APP.filtros.escalas.reporte)
      .filter(c => idsEscalados.has(String(c.id)) || !APP.filtros.escalas.colaborador_id)
      .filter(c => {
        if (!busca) return true;
        return [c.nome, c.cargo, c.celula, c.grupo].some(v => String(v || '').toLowerCase().includes(busca));
      });

    const ordenacao = window.__escalaOrdenacaoAtual || 'data_asc';
    return colaboradoresFiltrados.sort((a, b) => {
      const nomeCmp = String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
      return ordenacao === 'nome_desc' ? -nomeCmp : nomeCmp;
    });
  }

  function obterDiasTabela(ultimoDia) {
    const ano = APP.calendarioData.getFullYear();
    const mes = APP.calendarioData.getMonth();
    const dias = Array.from({ length: ultimoDia }, (_, i) => {
      const dia = i + 1;
      const data = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const semana = new Date(ano, mes, dia).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3).toUpperCase();
      return { dia, data, semana };
    });
    return window.__escalaOrdenacaoAtual === 'data_desc' ? dias.reverse() : dias;
  }

  function renderizarCelulaEscala(colaborador, dia, escalasPorChave) {
    const escala = escalasPorChave.get(`${String(colaborador.id)}|${dia.data}`);
    const estado = estadoCelulaEscala(escala, dia.data);
    return `
      <div class="escala-planner-cell">
        <div class="escala-card ${estado.classe}" title="${escapeHtml(estado.titulo)}">
          <span>${estado.sigla}</span>
          <span class="muted">${escapeHtml(estado.horario)}</span>
          <span class="muted">${escapeHtml(estado.carga)}</span>
        </div>
      </div>
    `;
  }

  function estadoCelulaEscala(escala, data) {
    const tipo = String(escala?.tipo_alteracao || escala?.status || '').trim();
    if (/férias|ferias/i.test(tipo)) return montarEstadoEscala('ferias', 'F', escala, 'Férias');
    if (/day off/i.test(tipo)) return montarEstadoEscala('dayoff', 'D', escala, 'Day Off');
    if (/folga/i.test(tipo)) return montarEstadoEscala('folga', 'F', escala, 'Folga');
    if (/treinamento/i.test(tipo)) return montarEstadoEscala('treinamento', 'TR', escala, 'Treinamento');
    if (escala) return montarEstadoEscala('trabalho', 'T', escala, 'Trabalho');

    const diaSemana = new Date(`${data}T00:00:00`).getDay();
    return {
      classe: diaSemana === 0 || diaSemana === 6 ? 'folga' : 'trabalho',
      sigla: diaSemana === 0 || diaSemana === 6 ? 'F' : 'T',
      horario: diaSemana === 0 || diaSemana === 6 ? '-' : '08:00',
      carga: diaSemana === 0 || diaSemana === 6 ? '-' : '8h',
      titulo: diaSemana === 0 || diaSemana === 6 ? 'Folga' : 'Trabalho'
    };
  }

  function montarEstadoEscala(classe, sigla, escala, titulo) {
    const entrada = escala?.entrada || escala?.horario || '';
    const saida = escala?.saida || '';
    const horario = entrada && saida ? `${entrada} ${saida}` : (entrada || '-');
    return {
      classe,
      sigla,
      horario,
      carga: escala?.hora_extra ? `${escala.hora_extra}h` : '8h',
      titulo
    };
  }
})();
