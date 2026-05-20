// ============================================================
// security.js - Protecao visual e funcional da interface
// ============================================================

(function () {
  const ACAO_POR_ONCLICK = [
    { padrao: "navegarPara('dashboard')", acao: 'visualizar_dashboard' },
    { padrao: "navegarPara('colaboradores')", acao: 'visualizar_colaboradores' },
    { padrao: "navegarPara('staff')", acao: 'visualizar_staff' },
    { padrao: "navegarPara('escalas')", acao: 'visualizar_escalas' },
    { padrao: "navegarPara('programacoes')", acao: 'visualizar_programacoes' },
    { padrao: "navegarPara('ferias')", acao: 'visualizar_ferias' },
    { padrao: "navegarPara('relatorios')", acao: 'visualizar_relatorios' },
    { padrao: "navegarPara('importacao')", acao: 'importar_dados' },
    { padrao: "navegarPara('configuracoes')", acao: 'acessar_configuracoes' },
    { padrao: 'exportarColaboradores', acao: 'exportar_relatorios' },
    { padrao: 'gerarRelatorio', acao: 'exportar_relatorios' },
    { padrao: 'gerarRelatorioCompleto', acao: 'exportar_relatorios' },
    { padrao: 'excluirSelecionados', acao: 'excluir_colaborador' },
    { padrao: 'abrirModalStaff', acao: 'cadastrar_staff' },
    { padrao: 'salvarStaff', acao: 'editar_staff' },
    { padrao: 'selecionarArquivoEscalas', acao: 'importar_escala' },
    { padrao: 'processarArquivoEscalas', acao: 'importar_escala' },
    { padrao: 'abrirModalNovaEscala', acao: 'cadastrar_escala' },
    { padrao: 'salvarEscala', acao: 'cadastrar_escala' },
    { padrao: 'excluirEscala', acao: 'excluir_escala' },
    { padrao: 'abrirModalProgramacao', acao: 'cadastrar_programacao' },
    { padrao: 'salvarProgramacao', acao: 'cadastrar_programacao' },
    { padrao: 'aprovarProgramacao', acao: 'aprovar_programacao' },
    { padrao: 'excluirProgramacao', acao: 'excluir_programacao' },
    { padrao: 'confirmarImportacao', acao: 'importar_dados' },
    { padrao: 'salvarConfiguracoes', acao: 'acessar_configuracoes' },
    { padrao: 'salvarUsuarioAutorizado', acao: 'gerenciar_usuarios' },
    { padrao: 'preencherUsuarioAutorizado', acao: 'gerenciar_usuarios' },
    { padrao: 'testarConexao', acao: 'acessar_configuracoes' },
    { padrao: 'verAuditoria', acao: 'ver_auditoria' }
  ];

  function toastSeguro(mensagem, tipo = 'warning') {
    if (typeof window.toast === 'function') window.toast(mensagem, tipo);
    else console.warn(mensagem);
  }

  function verificarPermissao(acao) {
    return window.Permissions?.verificarPermissao(acao) === true;
  }

  function requirePermission(acao, mensagem = 'Voce nao tem permissao para executar esta acao.') {
    if (verificarPermissao(acao)) return true;
    toastSeguro(mensagem, 'warning');
    return false;
  }

  function isAgente() {
    return window.Permissions?.isAgente() === true;
  }

  function getColaboradorLogadoId() {
    return window.Permissions?.estado?.colaborador?.id || null;
  }

  function getEmailLogado() {
    return String(window.Permissions?.estado?.user?.email || '').toLowerCase();
  }

  function permissaoParaOnclick(onclick) {
    if (!onclick) return null;

    if (onclick.includes('abrirModalColaborador')) {
      return onclick.includes('abrirModalColaborador()') ? 'cadastrar_colaborador' : 'editar_colaborador';
    }

    if (onclick.includes('confirmarExclusao')) {
      if (onclick.includes("'colaboradores'") || onclick.includes('"colaboradores"')) return 'excluir_colaborador';
      if (onclick.includes("'staff'") || onclick.includes('"staff"')) return 'excluir_staff';
      return 'excluir_registro';
    }

    return ACAO_POR_ONCLICK.find(item => onclick.includes(item.padrao))?.acao || null;
  }

  function ocultarPorPermissao(el, acao) {
    if (!el || !acao) return;
    el.classList.toggle('hidden-by-permission', !verificarPermissao(acao));
  }

  function aplicarRestricoesVisuais() {
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
      const pagina = item.dataset.page;
      item.classList.toggle('hidden-by-permission', !Permissions.podeAcessarPagina(pagina));
    });

    document.querySelectorAll('[data-permission]').forEach(item => {
      ocultarPorPermissao(item, item.dataset.permission);
    });

    document.querySelectorAll('[onclick]').forEach(item => {
      const acao = permissaoParaOnclick(item.getAttribute('onclick'));
      if (acao) ocultarPorPermissao(item, acao);
    });

    if (isAgente()) {
      document.querySelectorAll('#filtro-escala-colaborador, #filtro-escala-reporte').forEach(el => {
        el.closest('.toolbar')?.classList.add('hidden-by-permission');
      });
      document.querySelectorAll('#topbar-search-input, #topbar-search-input-col').forEach(el => {
        el.closest('.topbar-search, .search-input')?.classList.add('hidden-by-permission');
      });
    }
  }

  function bloquearCliqueSemPermissao(event) {
    const alvo = event.target.closest('[onclick], [data-permission]');
    if (!alvo) return;

    const acao = alvo.dataset.permission || permissaoParaOnclick(alvo.getAttribute('onclick'));
    if (!acao || verificarPermissao(acao)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    toastSeguro('Acesso negado para o seu perfil.', 'warning');
  }

  function protegerExecucaoManual() {
    document.addEventListener('click', bloquearCliqueSemPermissao, true);
  }

  function protegerPaginaAtual(pagina) {
    if (Permissions.podeAcessarPagina(pagina)) return true;
    toastSeguro('Acesso negado para o seu perfil.', 'warning');
    return false;
  }

  function inicializar() {
    protegerExecucaoManual();
    aplicarRestricoesVisuais();
  }

  window.Security = {
    inicializar,
    verificarPermissao,
    requirePermission,
    aplicarRestricoesVisuais,
    protegerPaginaAtual,
    isAgente,
    getColaboradorLogadoId,
    getEmailLogado
  };
})();
