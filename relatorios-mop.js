(function () {
  function agendarRelatorioMOP() {
    setTimeout(instalarRelatorioMOP, 1200);
    document.addEventListener('auth:ready', () => setTimeout(instalarRelatorioMOP, 400));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', agendarRelatorioMOP);
  } else {
    agendarRelatorioMOP();
  }

  function instalarRelatorioMOP() {
    if (window.__relatorioMOPPatch) return;
    if (typeof window.DB === 'undefined') {
      setTimeout(instalarRelatorioMOP, 500);
      return;
    }

    window.__relatorioMOPPatch = true;
    const gerarRelatorioOriginal = window.gerarRelatorio;

    window.carregarRelatorios = carregarRelatorioMOP;
    window.gerarRelatorioMOP = exportarRelatorioMOP;
    window.gerarRelatorioCompleto = () => exportarRelatorioMOP('xlsx');
    window.gerarRelatorio = async function gerarRelatorioCompat(tipo) {
      if (!tipo || tipo === 'mop' || tipo === 'colaboradores') return exportarRelatorioMOP('csv');
      if (typeof gerarRelatorioOriginal === 'function') return gerarRelatorioOriginal(tipo);
      return exportarRelatorioMOP('csv');
    };

    const page = document.getElementById('page-relatorios');
    if (page?.classList.contains('active')) carregarRelatorioMOP();
  }

  async function carregarRelatorioMOP() {
    const page = document.getElementById('page-relatorios');
    if (!page) return;

    page.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Relatórios</div>
          <div class="page-subtitle">Planilha MOP operacional</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" type="button" onclick="gerarRelatorioMOP('csv')">CSV</button>
          <button class="btn btn-primary btn-sm" type="button" onclick="gerarRelatorioMOP('xlsx')">Excel</button>
        </div>
      </div>

      <style>
        .mop-report{background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden}
        .mop-report-summary{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:1px;background:var(--border)}
        .mop-report-kpi{background:var(--card);padding:14px 16px}
        .mop-report-kpi span{display:block;color:var(--text2);font-size:11px;text-transform:uppercase;font-weight:700;margin-bottom:6px}
        .mop-report-kpi strong{font-size:22px;color:var(--text1)}
        .mop-report-toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:14px 16px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--bg2)}
        .mop-report-search{flex:1;min-width:240px;height:38px;border:1px solid var(--border);border-radius:8px;background:var(--bg1);color:var(--text1);padding:0 12px;font-size:13px}
        .mop-report-table-wrap{overflow:auto;max-height:calc(100vh - 300px)}
        .mop-report-table{width:100%;border-collapse:separate;border-spacing:0;min-width:1500px}
        .mop-report-table th{position:sticky;top:0;z-index:2;background:var(--bg2);color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:0;font-weight:700;text-align:left;padding:12px 10px;border-bottom:1px solid var(--border);white-space:nowrap}
        .mop-report-table td{padding:11px 10px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text1);vertical-align:middle;white-space:nowrap}
        .mop-report-table tbody tr:hover td{background:rgba(59,130,246,.08)}
        .mop-report-name{font-weight:700;color:var(--text1)}
        .mop-report-muted{color:var(--text2)}
        .mop-report-status{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(34,197,94,.12);color:#22c55e}
        .mop-report-status.ferias{background:rgba(245,158,11,.14);color:#f59e0b}
        .mop-report-status.inativo{background:rgba(148,163,184,.16);color:#94a3b8}
        @media(max-width:900px){.mop-report-summary{grid-template-columns:repeat(2,minmax(120px,1fr))}.mop-report-table-wrap{max-height:none}}
      </style>

      <div class="mop-report">
        <div id="mop-report-summary" class="mop-report-summary">
          <div class="mop-report-kpi"><span>Total</span><strong>-</strong></div>
          <div class="mop-report-kpi"><span>Ativos</span><strong>-</strong></div>
          <div class="mop-report-kpi"><span>Férias</span><strong>-</strong></div>
          <div class="mop-report-kpi"><span>Programações</span><strong>-</strong></div>
        </div>
        <div class="mop-report-toolbar">
          <input id="mop-report-search" class="mop-report-search" type="text" placeholder="Buscar matrícula, colaborador, cargo ou supervisor...">
          <select id="mop-report-status" class="filter-select" style="height:38px;min-width:150px"><option value="">Todos status</option></select>
          <select id="mop-report-supervisor" class="filter-select" style="height:38px;min-width:180px"><option value="">Todos supervisores</option></select>
        </div>
        <div class="mop-report-table-wrap">
          <table class="mop-report-table">
            <thead>
              <tr>
                <th>Matrícula</th>
                <th>Colaborador</th>
                <th>Célula</th>
                <th>Grupo</th>
                <th>Cargo</th>
                <th>Horário</th>
                <th>Escala</th>
                <th>Filial</th>
                <th>Supervisor</th>
                <th>Admissão</th>
                <th>Tempo</th>
                <th>Status</th>
                <th>Férias</th>
                <th>Programação</th>
                <th>Última escala</th>
              </tr>
            </thead>
            <tbody id="mop-report-body">
              <tr><td colspan="15"><div class="loading-inline"><div class="spinner"></div> Carregando...</div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    try {
      const [colaboradores, staff, programacoes, escalas] = await Promise.all([
        DB.colaboradores.listar().catch(() => []),
        DB.staff.listar().catch(() => []),
        DB.programacoes.listar().catch(() => []),
        DB.escalas.listar().catch(() => [])
      ]);

      window.__relatorioMOP = {
        linhas: montarLinhasRelatorioMOP(colaboradores, staff, programacoes, escalas),
        filtros: window.__relatorioMOP?.filtros || { busca: '', status: '', supervisor: '' }
      };

      preencherFiltrosRelatorioMOP();
      renderizarRelatorioMOP();
    } catch (e) {
      const body = document.getElementById('mop-report-body');
      if (body) body.innerHTML = '<tr><td colspan="15"><div class="empty-state"><div class="empty-title">Erro ao carregar relatório</div></div></td></tr>';
      window.toast?.('Erro ao carregar relatório', 'error');
    }
  }

  function montarLinhasRelatorioMOP(colaboradores, staff, programacoes, escalas) {
    const staffPorNome = new Map((staff || []).map(s => [normalizarTexto(s.nome), s]));
    const programacoesPorColaborador = agruparPorColaborador(programacoes || [], 'data_inicio');
    const escalasPorColaborador = agruparPorColaborador(escalas || [], 'data');

    return (colaboradores || []).map(c => {
      const supervisor = c.supervisor || c.reporte || '';
      const lider = staffPorNome.get(normalizarTexto(supervisor));
      const programacao = primeiraProgramacao(programacoesPorColaborador.get(String(c.id)) || []);
      const ultimaEscala = (escalasPorColaborador.get(String(c.id)) || [])[0];

      return {
        matricula: c.matricula || '',
        colaborador: c.nome || '',
        celula: c.celula || '',
        grupo: c.grupo || '',
        cargo: c.cargo || '',
        horario: c.horario || '',
        escala: c.escala || '',
        filial: c.filial || '',
        supervisor,
        liderCargo: lider?.cargo || '',
        admissao: c.admissao || '',
        admissaoFmt: formatarDataMOP(c.admissao),
        tempo: calcularTempoCasaMOP(c.admissao, c.tempo_meses),
        status: c.status || '',
        ferias: formatarFeriasMOP(c),
        programacao: programacao ? `${programacao.tipo || '-'} (${formatarDataMOP(programacao.data_inicio)}${programacao.data_fim ? ' a ' + formatarDataMOP(programacao.data_fim) : ''})` : '',
        ultimaEscala: ultimaEscala ? `${formatarDataMOP(ultimaEscala.data)} - ${ultimaEscala.tipo_alteracao || ultimaEscala.status || ultimaEscala.horario || 'Trabalho'}` : ''
      };
    });
  }

  function preencherFiltrosRelatorioMOP() {
    const estado = window.__relatorioMOP;
    const statusSelect = document.getElementById('mop-report-status');
    const supervisorSelect = document.getElementById('mop-report-supervisor');
    const busca = document.getElementById('mop-report-search');
    if (!estado || !statusSelect || !supervisorSelect || !busca) return;

    const status = [...new Set(estado.linhas.map(l => l.status).filter(Boolean))].sort();
    const supervisores = [...new Set(estado.linhas.map(l => l.supervisor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    statusSelect.innerHTML = '<option value="">Todos status</option>' + status.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    supervisorSelect.innerHTML = '<option value="">Todos supervisores</option>' + supervisores.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');

    busca.value = estado.filtros.busca || '';
    statusSelect.value = estado.filtros.status || '';
    supervisorSelect.value = estado.filtros.supervisor || '';

    busca.addEventListener('input', e => atualizarFiltroRelatorioMOP('busca', e.target.value));
    statusSelect.addEventListener('change', e => atualizarFiltroRelatorioMOP('status', e.target.value));
    supervisorSelect.addEventListener('change', e => atualizarFiltroRelatorioMOP('supervisor', e.target.value));
  }

  function atualizarFiltroRelatorioMOP(campo, valor) {
    window.__relatorioMOP.filtros[campo] = valor;
    renderizarRelatorioMOP();
  }

  function renderizarRelatorioMOP() {
    const estado = window.__relatorioMOP;
    const body = document.getElementById('mop-report-body');
    const summary = document.getElementById('mop-report-summary');
    if (!estado || !body) return;

    const linhas = filtrarLinhasRelatorioMOP(estado.linhas);
    window.__relatorioMOPFiltrado = linhas;

    if (summary) {
      const ativos = estado.linhas.filter(l => normalizarTexto(l.status) === 'ativo').length;
      const ferias = estado.linhas.filter(l => /ferias|férias/i.test(l.status) || l.ferias).length;
      const programadas = estado.linhas.filter(l => l.programacao).length;
      summary.innerHTML = `
        <div class="mop-report-kpi"><span>Total</span><strong>${estado.linhas.length}</strong></div>
        <div class="mop-report-kpi"><span>Ativos</span><strong>${ativos}</strong></div>
        <div class="mop-report-kpi"><span>Férias</span><strong>${ferias}</strong></div>
        <div class="mop-report-kpi"><span>Programações</span><strong>${programadas}</strong></div>
      `;
    }

    body.innerHTML = linhas.length ? linhas.map(l => `
      <tr>
        <td class="font-mono">${esc(l.matricula) || '-'}</td>
        <td><span class="mop-report-name">${esc(l.colaborador) || '-'}</span></td>
        <td>${esc(l.celula) || '-'}</td>
        <td>${esc(l.grupo) || '-'}</td>
        <td>${esc(l.cargo) || '-'}</td>
        <td>${esc(l.horario) || '-'}</td>
        <td>${esc(l.escala) || '-'}</td>
        <td>${esc(l.filial) || '-'}</td>
        <td>${esc(l.supervisor) || '-'}</td>
        <td>${esc(l.admissaoFmt) || '-'}</td>
        <td>${esc(l.tempo) || '-'}</td>
        <td>${statusRelatorioMOP(l.status)}</td>
        <td>${esc(l.ferias) || '-'}</td>
        <td>${esc(l.programacao) || '-'}</td>
        <td>${esc(l.ultimaEscala) || '-'}</td>
      </tr>
    `).join('') : '<tr><td colspan="15"><div class="empty-state"><div class="empty-title">Nenhum registro encontrado</div></div></td></tr>';
  }

  function filtrarLinhasRelatorioMOP(linhas) {
    const filtros = window.__relatorioMOP?.filtros || {};
    const busca = normalizarTexto(filtros.busca);
    return [...(linhas || [])]
      .filter(l => !filtros.status || l.status === filtros.status)
      .filter(l => !filtros.supervisor || l.supervisor === filtros.supervisor)
      .filter(l => !busca || normalizarTexto(Object.values(l).join(' ')).includes(busca))
      .sort((a, b) => String(a.colaborador).localeCompare(String(b.colaborador), 'pt-BR'));
  }

  function exportarRelatorioMOP(formato = 'xlsx') {
    if (window.Security && !Security.requirePermission('exportar_relatorios')) return;
    const linhas = window.__relatorioMOPFiltrado || window.__relatorioMOP?.linhas || [];
    if (!linhas.length) {
      window.toast?.('Sem dados para exportar', 'warning');
      return;
    }

    const headers = ['Matrícula', 'Colaborador', 'Célula', 'Grupo', 'Cargo', 'Horário', 'Escala', 'Filial', 'Supervisor', 'Admissão', 'Tempo', 'Status', 'Férias', 'Programação', 'Última escala'];
    const rows = linhas.map(l => [l.matricula, l.colaborador, l.celula, l.grupo, l.cargo, l.horario, l.escala, l.filial, l.supervisor, l.admissaoFmt, l.tempo, l.status, l.ferias, l.programacao, l.ultimaEscala]);
    const nome = `relatorio_mop_${dataHojeRelatorioMOP()}`;

    if (formato === 'xlsx' && window.XLSX) {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = headers.map(h => ({ wch: Math.max(12, h.length + 4) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'MOP');
      XLSX.writeFile(wb, `${nome}.xlsx`);
    } else {
      const csv = [headers, ...rows]
        .map(row => row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
      baixarRelatorioMOP(csv, `${nome}.csv`, 'text/csv;charset=utf-8');
    }
    window.toast?.('Relatório MOP exportado com sucesso', 'success');
  }

  function agruparPorColaborador(lista, campoData) {
    const map = new Map();
    [...lista].sort((a, b) => String(b[campoData] || '').localeCompare(String(a[campoData] || ''))).forEach(item => {
      const id = String(item.colaborador_id || '');
      if (!id) return;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(item);
    });
    return map;
  }

  function primeiraProgramacao(programacoes) {
    const hoje = dataHojeRelatorioMOP();
    return [...programacoes]
      .filter(p => String(p.status || '').toLowerCase() !== 'cancelado')
      .sort((a, b) => {
        const aFuturo = String(a.data_inicio || '') >= hoje ? 0 : 1;
        const bFuturo = String(b.data_inicio || '') >= hoje ? 0 : 1;
        return aFuturo - bFuturo || String(a.data_inicio || '').localeCompare(String(b.data_inicio || ''));
      })[0];
  }

  function calcularTempoCasaMOP(admissao, tempoMeses) {
    let meses = Number.isFinite(Number(tempoMeses)) ? Number(tempoMeses) : null;
    if (meses == null && admissao) {
      const adm = new Date(`${admissao}T00:00:00`);
      const hoje = new Date();
      meses = (hoje.getFullYear() - adm.getFullYear()) * 12 + (hoje.getMonth() - adm.getMonth());
      if (hoje.getDate() < adm.getDate()) meses -= 1;
    }
    if (meses == null || meses < 0) return '';
    const anos = Math.floor(meses / 12);
    const resto = meses % 12;
    const partes = [];
    if (anos) partes.push(`${anos} ${anos === 1 ? 'ano' : 'anos'}`);
    if (resto || !partes.length) partes.push(`${resto} ${resto === 1 ? 'mês' : 'meses'}`);
    return partes.join(' e ');
  }

  function formatarFeriasMOP(c) {
    if (!c.primeiro_dia_ferias && !c.ultimo_dia_ferias) return '';
    if (c.primeiro_dia_ferias && c.ultimo_dia_ferias) return `${formatarDataMOP(c.primeiro_dia_ferias)} a ${formatarDataMOP(c.ultimo_dia_ferias)}`;
    return formatarDataMOP(c.primeiro_dia_ferias || c.ultimo_dia_ferias);
  }

  function statusRelatorioMOP(status) {
    const label = esc(status || '-');
    const classe = /ferias|férias/i.test(status) ? 'ferias' : (/inativo|bloqueado/i.test(status) ? 'inativo' : '');
    return `<span class="mop-report-status ${classe}">${label}</span>`;
  }

  function formatarDataMOP(data) {
    if (!data) return '';
    const [ano, mes, dia] = String(data).slice(0, 10).split('-');
    if (!ano || !mes || !dia) return String(data);
    return `${dia}/${mes}/${ano}`;
  }

  function dataHojeRelatorioMOP() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function baixarRelatorioMOP(conteudo, nome, tipo) {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function normalizarTexto(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function esc(valor) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(valor);
    return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();