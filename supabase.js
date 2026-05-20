// ============================================================
// supabase.js - Módulo de conexão e operações com Supabase
// ============================================================

const SUPABASE_URL = 'https://pjeehaziodnxuakhacmc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqZWVoYXppb2RueHVha2hhY21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjU1MzQsImV4cCI6MjA5NDcwMTUzNH0.h5mIzDOvVS3M8BDFy3TeLM4djdBFHTM72LOpKGNgLkg';

// Inicializa o cliente Supabase
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

function permissaoLiberada(acao) {
  return !window.Security || window.Security.requirePermission(acao);
}

function temPermissao(acao) {
  return !window.Security || window.Security.verificarPermissao(acao);
}

function agenteLogado() {
  return window.Security?.isAgente?.() === true;
}

function colaboradorLogadoId() {
  return window.Security?.getColaboradorLogadoId?.() || null;
}

function emailLogado() {
  return window.Security?.getEmailLogado?.() || '';
}

// ============================================================
// MÓDULO DE BANCO DE DADOS
// ============================================================
const DB = {

  // ---------- COLABORADORES ----------
  colaboradores: {
    async listar(filtros = {}) {
      if (!permissaoLiberada(agenteLogado() ? 'visualizar_propria_escala' : 'visualizar_colaboradores')) return [];
      let query = db.from('colaboradores').select('*').order('nome');
      if (agenteLogado()) query = query.ilike('email', emailLogado());
      if (filtros.status) query = query.eq('status', filtros.status);
      if (filtros.celula) query = query.eq('celula', filtros.celula);
      if (filtros.grupo) query = query.eq('grupo', filtros.grupo);
      if (filtros.filial) query = query.eq('filial', filtros.filial);
      if (filtros.escala) query = query.eq('escala', filtros.escala);
      if (filtros.busca) query = query.ilike('nome', `%${filtros.busca}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async buscarPorId(id) {
      if (!permissaoLiberada(agenteLogado() ? 'visualizar_propria_escala' : 'visualizar_colaboradores')) return null;
      const { data, error } = await db.from('colaboradores').select('*').eq('id', id).single();
      if (error) throw error;
      if (agenteLogado() && String(data?.email || '').toLowerCase() !== emailLogado()) {
        throw new Error('Acesso negado ao colaborador solicitado.');
      }
      return data;
    },
    async criar(dados) {
      if (!permissaoLiberada('cadastrar_colaborador')) return null;
      const payload = calcularCamposAuto(dados);
      const { data, error } = await db.from('colaboradores').insert([payload]).select().single();
      if (error) throw error;
      await registrarAuditoria('colaboradores', 'INSERT', data.id, null, data);
      return data;
    },
    async atualizar(id, dados) {
      if (!permissaoLiberada('editar_colaborador')) return null;
      const anterior = await this.buscarPorId(id);
      const payload = calcularCamposAuto(dados);
      const { data, error } = await db.from('colaboradores').update(payload).eq('id', id).select().single();
      if (error) throw error;
      await registrarAuditoria('colaboradores', 'UPDATE', id, anterior, data);
      return data;
    },
    async excluir(id) {
      if (!permissaoLiberada('excluir_colaborador')) return null;
      const anterior = await this.buscarPorId(id);
      const { error } = await db.from('colaboradores').delete().eq('id', id);
      if (error) throw error;
      await registrarAuditoria('colaboradores', 'DELETE', id, anterior, null);
    },
    async importarLote(lista) {
      if (!permissaoLiberada('importar_dados')) return [];
      const payload = lista.map(d => calcularCamposAuto(d));
      const { data, error } = await db.from('colaboradores').upsert(payload, { onConflict: 'matricula' }).select();
      if (error) throw error;
      return data;
    },
    async contar() {
      if (!permissaoLiberada('visualizar_dashboard')) return 0;
      const { count, error } = await db.from('colaboradores').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
    async contarPorStatus(status) {
      if (!permissaoLiberada('visualizar_dashboard')) return 0;
      const { count, error } = await db.from('colaboradores').select('*', { count: 'exact', head: true }).eq('status', status);
      if (error) throw error;
      return count || 0;
    }
  },

  // ---------- STAFF ----------
  staff: {
    async listar(filtros = {}) {
      if (!permissaoLiberada('visualizar_staff')) return [];
      let query = db.from('staff').select('*').order('nome');
      if (filtros.status) query = query.eq('status', filtros.status);
      if (filtros.celula) query = query.eq('celula', filtros.celula);
      if (filtros.busca) query = query.ilike('nome', `%${filtros.busca}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async buscarPorId(id) {
      if (!permissaoLiberada('visualizar_staff')) return null;
      const { data, error } = await db.from('staff').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async criar(dados) {
      if (!permissaoLiberada('cadastrar_staff')) return null;
      const payload = calcularCamposAuto(dados);
      const { data, error } = await db.from('staff').insert([payload]).select().single();
      if (error) throw error;
      await registrarAuditoria('staff', 'INSERT', data.id, null, data);
      return data;
    },
    async atualizar(id, dados) {
      if (!permissaoLiberada('editar_staff')) return null;
      const anterior = await this.buscarPorId(id);
      const payload = calcularCamposAuto(dados);
      const { data, error } = await db.from('staff').update(payload).eq('id', id).select().single();
      if (error) throw error;
      await registrarAuditoria('staff', 'UPDATE', id, anterior, data);
      return data;
    },
    async excluir(id) {
      if (!permissaoLiberada('excluir_staff')) return null;
      const anterior = await this.buscarPorId(id);
      const { error } = await db.from('staff').delete().eq('id', id);
      if (error) throw error;
      await registrarAuditoria('staff', 'DELETE', id, anterior, null);
    }
  },

  // ---------- ESCALAS ----------
  escalas: {
    async listar(filtros = {}) {
      if (!permissaoLiberada(agenteLogado() ? 'visualizar_propria_escala' : 'visualizar_escalas')) return [];
      let query = db.from('escalas').select('*').order('data', { ascending: false });
      if (agenteLogado()) {
        const id = colaboradorLogadoId();
        if (!id) return [];
        query = query.eq('colaborador_id', id);
      }
      if (filtros.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id);
      if (filtros.data_inicio) query = query.gte('data', filtros.data_inicio);
      if (filtros.data_fim) query = query.lte('data', filtros.data_fim);
      if (filtros.tipo) query = query.eq('tipo_alteracao', filtros.tipo);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async criar(dados) {
      if (!permissaoLiberada('cadastrar_escala')) return null;
      const { data, error } = await db.from('escalas').insert([dados]).select().single();
      if (error) throw error;
      await registrarAuditoria('escalas', 'INSERT', data.id, null, data);
      return data;
    },
    async atualizar(id, dados) {
      if (!permissaoLiberada('editar_escala')) return null;
      const { data, error } = await db.from('escalas').update(dados).eq('id', id).select().single();
      if (error) throw error;
      await registrarAuditoria('escalas', 'UPDATE', id, null, data);
      return data;
    },
    async excluir(id) {
      if (!permissaoLiberada('excluir_escala')) return null;
      const { error } = await db.from('escalas').delete().eq('id', id);
      if (error) throw error;
    },
    async listarPorData(data) {
      if (!permissaoLiberada(agenteLogado() ? 'visualizar_propria_escala' : 'visualizar_escalas')) return [];
      let query = db.from('escalas').select('*').eq('data', data);
      if (agenteLogado()) query = query.eq('colaborador_id', colaboradorLogadoId());
      const { data: rows, error } = await query;
      if (error) throw error;
      return rows || [];
    },
    async importarLote(registros) {
      if (!permissaoLiberada('importar_escala')) return [];
      const limpos = (registros || []).map(r => ({
        ...r,
        colaborador_id: r.colaborador_id || null,
        hora_extra: r.hora_extra === '' ? null : r.hora_extra
      }));

      const { data, error } = await db
        .from('escalas')
        .upsert(limpos, { onConflict: 'colaborador_id,data' })
        .select();
      if (error) throw error;
      return data || [];
    }
  },

  // ---------- PROGRAMAÇÕES ----------
  programacoes: {
    async listar(filtros = {}) {
      if (!permissaoLiberada('visualizar_programacoes')) return [];
      let query = db.from('programacoes').select('*').order('data_inicio', { ascending: false });
      if (filtros.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id);
      if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
      if (filtros.status) query = query.eq('status', filtros.status);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async criar(dados) {
      if (!permissaoLiberada('cadastrar_programacao')) return null;
      const { data, error } = await db.from('programacoes').insert([dados]).select().single();
      if (error) throw error;
      await registrarAuditoria('programacoes', 'INSERT', data.id, null, data);
      return data;
    },
    async atualizar(id, dados) {
      if (!permissaoLiberada('editar_programacao')) return null;
      const { data, error } = await db.from('programacoes').update(dados).eq('id', id).select().single();
      if (error) throw error;
      await registrarAuditoria('programacoes', 'UPDATE', id, null, data);
      return data;
    },
    async excluir(id) {
      if (!permissaoLiberada('excluir_programacao')) return null;
      const { error } = await db.from('programacoes').delete().eq('id', id);
      if (error) throw error;
    },
    async aprovar(id, usuario) {
      if (!permissaoLiberada('aprovar_programacao')) return null;
      const { data, error } = await db.from('programacoes').update({
        aprovado: true,
        aprovado_por: usuario,
        aprovado_em: new Date().toISOString(),
        status: 'Aprovado'
      }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }
  },

  // ---------- AUDITORIA ----------
  auditoria: {
    async listar(limite = 100) {
      if (!permissaoLiberada('ver_auditoria')) return [];
      const { data, error } = await db.from('auditoria').select('*').order('created_at', { ascending: false }).limit(limite);
      if (error) throw error;
      return data || [];
    }
  },

  // ---------- CONFIGURAÇÕES ----------
  configuracoes: {
    async listar() {
      if (!temPermissao('acessar_configuracoes')) return {};
      const { data, error } = await db.from('configuracoes').select('*');
      if (error) throw error;
      const obj = {};
      (data || []).forEach(row => { obj[row.chave] = row.valor; });
      return obj;
    },
    async salvar(chave, valor) {
      if (!permissaoLiberada('acessar_configuracoes')) return null;
      const { data, error } = await db.from('configuracoes').upsert({ chave, valor }, { onConflict: 'chave' }).select().single();
      if (error) throw error;
      return data;
    }
  },

  // ---------- USUARIOS AUTORIZADOS ----------
  usuariosAutorizados: {
    async listar() {
      if (!permissaoLiberada('gerenciar_usuarios')) return [];
      const { data, error } = await db
        .from('usuarios_autorizados')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    async salvar(dados) {
      if (!permissaoLiberada('gerenciar_usuarios')) return null;
      const payload = {
        email: String(dados.email || '').trim().toLowerCase(),
        nome: String(dados.nome || '').trim(),
        perfil: String(dados.perfil || 'CONSULTA').trim().toUpperCase(),
        status: String(dados.status || 'Ativo').trim()
      };
      const { data, error } = await db
        .from('usuarios_autorizados')
        .upsert(payload, { onConflict: 'email' })
        .select()
        .single();
      if (error) throw error;
      await registrarAuditoria('usuarios_autorizados', 'UPSERT', data.id, null, data);
      return data;
    },
    async atualizarStatus(id, status) {
      if (!permissaoLiberada('gerenciar_usuarios')) return null;
      const { data, error } = await db
        .from('usuarios_autorizados')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      await registrarAuditoria('usuarios_autorizados', 'UPDATE_STATUS', id, null, data);
      return data;
    }
  },

  // ---------- REALTIME ----------
  assinarTabela(tabela, callback) {
    if (agenteLogado() && !['escalas'].includes(tabela)) return null;
    return db.channel(`realtime_${tabela}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tabela }, callback)
      .subscribe();
  }
};

// ============================================================
// HELPERS INTERNOS
// ============================================================

function calcularCamposAuto(dados) {
  const d = { ...dados };
  // Calcular idade a partir da data de nascimento
  if (d.data_nasc) {
    const nasc = new Date(d.data_nasc);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    d.idade = idade;
  }
  // Calcular tempo de empresa em meses
  if (d.admissao) {
    const adm = new Date(d.admissao);
    const hoje = new Date();
    const meses = (hoje.getFullYear() - adm.getFullYear()) * 12 + (hoje.getMonth() - adm.getMonth());
    d.tempo_meses = Math.max(0, meses);
  }
  return d;
}

async function registrarAuditoria(tabela, operacao, registroId, dadosAnteriores, dadosNovos) {
  try {
    const usuarioAtual = window.Permissions?.estado?.user;
    await db.from('auditoria').insert([{
      tabela,
      operacao,
      registro_id: registroId,
      dados_anteriores: dadosAnteriores,
      dados_novos: dadosNovos,
      usuario: usuarioAtual?.email || 'Sistema',
      created_at: new Date().toISOString()
    }]);
  } catch (e) {
    console.warn('Auditoria falhou:', e.message);
  }
}

// Exporta globalmente
window.DB = DB;
window.db = db;
