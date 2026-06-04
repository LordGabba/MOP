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

    const ordenadas = ordenarEscalasTabela(escalas);
    container.innerHTML = `
      <div class="table-wrapper" style="grid-column:1/-1;width:100%">
        <table class="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Colaborador</th>
              <th>Tipo</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th>Horário</th>
              <th>Origem</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            ${ordenadas.length ? ordenadas.map(e => `
              <tr>
                <td>${formatarData(e.data)}</td>
                <td>${escapeHtml(e.colaborador_nome || '-')}</td>
                <td>${badgeEscala(e.tipo_alteracao || e.status || '-')}</td>
                <td>${escapeHtml(e.entrada || '-')}</td>
                <td>${escapeHtml(e.saida || '-')}</td>
                <td>${escapeHtml(e.horario || '-')}</td>
                <td>${e.origem_programacao_id ? 'Programação' : 'Escala'}</td>
                <td class="text-sm text-muted">${escapeHtml(e.observacao || '-')}</td>
              </tr>
            `).join('') : '<tr><td colspan="8"><div class="empty-state"><div class="empty-title">Nenhuma escala no período</div></div></td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    window.Security?.aplicarRestricoesVisuais?.();
  }

  function ordenarEscalasTabela(escalas) {
    const ordenacao = window.__escalaOrdenacaoAtual || 'data_asc';
    return [...(escalas || [])].sort((a, b) => {
      const dataCmp = String(a.data || '').localeCompare(String(b.data || ''));
      const nomeCmp = String(a.colaborador_nome || '').localeCompare(String(b.colaborador_nome || ''), 'pt-BR');
      if (ordenacao === 'data_desc') return -dataCmp || nomeCmp;
      if (ordenacao === 'nome_asc') return nomeCmp || dataCmp;
      if (ordenacao === 'nome_desc') return -nomeCmp || dataCmp;
      return dataCmp || nomeCmp;
    });
  }
})();
