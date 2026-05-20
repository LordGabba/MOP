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
