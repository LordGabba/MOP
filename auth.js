// ============================================================
// auth.js - Autenticacao Google com Supabase Auth
// ============================================================

(function () {
  const TEMPO_INATIVIDADE_MS = 60 * 60 * 1000;
  let timeoutInatividade = null;
  let authInicializado = false;

  function $(id) {
    return document.getElementById(id);
  }

  function setAuthMessage(mensagem, tipo = 'info') {
    const el = $('auth-message');
    if (!el) return;
    el.textContent = mensagem || '';
    el.className = `auth-message ${tipo}`;
    el.hidden = !mensagem;
  }

  function setAuthLoading(loading, texto = 'Validando acesso...') {
    const loader = $('auth-loading');
    const btn = $('btn-google-login');
    if (loader) {
      loader.hidden = !loading;
      const label = loader.querySelector('span');
      if (label) label.textContent = texto;
    }
    if (btn) btn.disabled = loading;
  }

  function mostrarLogin(mensagem = '') {
    $('global-loader')?.classList.add('hidden');
    $('auth-screen')?.classList.remove('hidden');
    $('app-layout')?.classList.add('hidden');
    setAuthLoading(false);
    if (mensagem) setAuthMessage(mensagem, 'error');
  }

  function mostrarApp() {
    $('auth-screen')?.classList.add('hidden');
    $('app-layout')?.classList.remove('hidden');
    setAuthMessage('');
  }

  function dadosGoogle(user) {
    const meta = user?.user_metadata || {};
    return {
      id: user?.id || '',
      nome: meta.full_name || meta.name || user?.email || 'Usuario',
      email: String(user?.email || '').toLowerCase(),
      foto: meta.avatar_url || meta.picture || ''
    };
  }

  async function registrarAuthLog(operacao, detalhes = {}) {
    try {
      const usuario = Permissions?.estado?.user;
      await db.from('auth_logs').insert([{
        operacao,
        user_id: usuario?.id || null,
        email: usuario?.email || detalhes.email || null,
        perfil: Permissions?.estado?.autorizado?.perfil || null,
        detalhes
      }]);
    } catch (e) {
      console.warn('Falha ao registrar auth log:', e.message);
    }
  }

  async function buscarUsuarioAutorizado(email) {
    const { data, error } = await db
      .from('usuarios_autorizados')
      .select('id,email,nome,perfil,status,created_at')
      .ilike('email', email)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function buscarColaboradorPorEmail(email) {
    const { data, error } = await db
      .from('colaboradores')
      .select('*')
      .ilike('email', email)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async function validarSessao(session) {
    if (!session?.user) {
      Permissions.limparContexto();
      mostrarLogin();
      return false;
    }

    setAuthLoading(true);
    const google = dadosGoogle(session.user);
    const autorizado = await buscarUsuarioAutorizado(google.email);

    if (!autorizado) {
      await registrarAuthLog('login_negado', { email: google.email, motivo: 'email_nao_autorizado' });
      await db.auth.signOut();
      Permissions.limparContexto();
      mostrarLogin('Acesso nao autorizado.');
      return false;
    }

    const status = String(autorizado.status || '').trim().toLowerCase();
    const perfil = String(autorizado.perfil || '').trim().toUpperCase();

    if (status !== 'ativo' || perfil === 'BLOQUEADO' || perfil === 'INATIVO') {
      await registrarAuthLog('login_bloqueado', { email: google.email, status: autorizado.status, perfil: autorizado.perfil });
      await db.auth.signOut();
      Permissions.limparContexto();
      mostrarLogin('Seu acesso esta bloqueado.');
      return false;
    }

    const colaborador = await buscarColaboradorPorEmail(google.email);
    Permissions.setContexto({
      session,
      user: {
        ...session.user,
        nome: google.nome,
        email: google.email,
        foto: google.foto,
        session_id: session.access_token
      },
      autorizado: {
        ...autorizado,
        perfil: perfil || 'CONSULTA'
      },
      colaborador
    });

    atualizarInterfaceUsuario();
    mostrarApp();
    iniciarTimeoutSessao();
    await registrarAuthLog('login', { email: google.email, perfil: autorizado.perfil });
    document.dispatchEvent(new CustomEvent('auth:ready', { detail: Permissions.estado }));
    return true;
  }

  function atualizarInterfaceUsuario() {
    const user = Permissions.estado.user || {};
    const perfil = Permissions.getPerfil();
    const nome = Permissions.estado.autorizado?.nome || user.nome || user.email || 'Usuario';
    const email = user.email || '';
    const foto = user.foto || '';

    const nomeEl = $('user-name');
    const emailEl = $('user-email');
    const perfilEl = $('user-profile');
    const avatarEl = $('user-avatar');

    if (nomeEl) nomeEl.textContent = nome;
    if (emailEl) emailEl.textContent = email;
    if (perfilEl) perfilEl.textContent = perfil;

    if (avatarEl) {
      avatarEl.innerHTML = foto
        ? `<img src="${foto}" alt="${nome}">`
        : `<span>${String(nome).slice(0, 2).toUpperCase()}</span>`;
      avatarEl.title = `${nome} - ${perfil}`;
    }
  }

  function reiniciarTimeoutSessao() {
    clearTimeout(timeoutInatividade);
    timeoutInatividade = setTimeout(async () => {
      await logout('Sessao expirada por inatividade.');
    }, TEMPO_INATIVIDADE_MS);
  }

  function iniciarTimeoutSessao() {
    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(evento => {
      window.removeEventListener(evento, reiniciarTimeoutSessao);
      window.addEventListener(evento, reiniciarTimeoutSessao, { passive: true });
    });
    reiniciarTimeoutSessao();
  }

  async function loginComGoogle() {
    setAuthMessage('');
    setAuthLoading(true, 'Abrindo Google...');
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });

    if (error) {
      setAuthLoading(false);
      setAuthMessage('Erro ao autenticar com Google: ' + error.message, 'error');
    }
  }

  async function logout(mensagem = '') {
    await registrarAuthLog('logout', { motivo: mensagem || 'usuario' });
    clearTimeout(timeoutInatividade);
    await db.auth.signOut();
    Permissions.limparContexto();
    mostrarLogin(mensagem);
  }

  async function inicializar() {
    if (authInicializado) return !!Permissions.estado.session;
    authInicializado = true;

    setAuthLoading(true);
    const loginBtn = $('btn-google-login');
    if (loginBtn) loginBtn.addEventListener('click', loginComGoogle);

    const logoutBtn = $('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', () => logout());

    db.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        Permissions.limparContexto();
        mostrarLogin();
        return;
      }

      if (event === 'TOKEN_REFRESHED' && !session) {
        await logout('Sessao expirada. Entre novamente.');
        return;
      }
    });

    try {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      return await validarSessao(data.session);
    } catch (e) {
      console.error(e);
      Permissions.limparContexto();
      mostrarLogin('Erro ao validar sessao.');
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  window.Auth = {
    inicializar,
    loginComGoogle,
    logout,
    validarSessao,
    registrarAuthLog
  };
})();
