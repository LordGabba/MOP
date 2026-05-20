// ============================================================
// supabase.js - Módulo de conexão e operações com Supabase
// ============================================================

const SUPABASE_URL = 'https://pjeehaziodnxuakhacmc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqZWVoYXppb2RueHVha2hhY21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjU1MzQsImV4cCI6MjA5NDcwMTUzNH0.h5mIzDOvVS3M8BDFy3TeLM4djdBFHTM72LOpKGNgLkg';

// Inicializa o cliente Supabase
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// MÓDULO DE BANCO DE DADOS
// ============================================================
const DB = {

  // ---------- COLABORADORES ----------
  colaboradores: {
    async listar(filtros = {}) {
      let query = db.from('colaboradores').select('*').order('nome');
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
      const { data, error } = await db.from('colaboradores').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async criar(dados) {
      const payload = calcularCamposAuto(dados);
      const { data, error } = await db.from('colaboradores').insert([payload]).select().single();
      if (error) throw error;
      await registrarAuditoria('colaboradores', 'INSERT', data.id, null, data);
      return data;
    },
    async atualizar(id, dados) {
      const anterior = await this.buscarPorId(id);
      const payload = calcularCamposAuto(dados);
      const { data, error } = await db.from('colaboradores').update(payload).eq('id', id).select().single();
      if (error) throw error;
      await registrarAuditoria('colaboradores', 'UPDATE', id, anterior, data);
      return data;
    },
    async excluir(id) {
      const anterior = await this.buscarPorId(id);
      const { error } = await db.from('colaboradores').delete().eq('id', id);
      if (error) throw error;
      await registrarAuditoria('colaboradores', 'DELETE', id, anterior, null);
    },
    async importarLote(lista) {
      const payload = lista.map(d => calcularCamposAuto(d));
      const { data, error } = await db.from('colaboradores').upsert(payload, { onConflict: 'matricula' }).select();
      if (error) throw error;
      return data;
    },
    async contar() {
      const { count, error } = await db.from('colaboradores').select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
    async contarPorStatus(status) {
      const { count, error } = await db.from('colaboradores').select('*', { count: 'exact', head: true }).eq('status', status);
      if (error) throw error;
      return count || 0;
    }
  },

  // ---------- STAFF ----------
  staff: {
    async listar(filtros = {}) {
      let query = db.from('staff').select('*').order('nome');
      if (filtros.status) query = query.eq('status', filtros.status);
      if (filtros.celula) query = query.eq('celula', filtros.celula);
      if (filtros.busca) query = query.ilike('nome', `%${filtros.busca}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async buscarPorId(id) {
      const { data, error } = await db.from('staff').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async criar(dados) {
      const payload = calcularCamposAuto(dados);
      const { data, error } = await db.from('staff').insert([payload]).select().single();
      if (error) throw error;
      await registrarAuditoria('staff', 'INSERT', data.id, null, data);
      return data;
    },
    async atualizar(id, dados) {
      const anterior = await this.buscarPorId(id);
      const payload = calcularCamposAuto(dados);
      const { data, error } = await db.from('staff').update(payload).eq('id', id).select().single();
      if (error) throw error;
      await registrarAuditoria('staff', 'UPDATE', id, anterior, data);
      return data;
    },
    async excluir(id) {
      const anterior = await this.buscarPorId(id);
      const { error } = await db.from('staff').delete().eq('id', id);
      if (error) throw error;
      await registrarAuditoria('staff', 'DELETE', id, anterior, null);
    }
  },

  // ---------- ESCALAS ----------
  escalas: {
    async listar(filtros = {}) {
      let query = db.from('escalas').select('*').order('data', { ascending: false });
      if (filtros.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id);
      if (filtros.data_inicio) query = query.gte('data', filtros.data_inicio);
      if (filtros.data_fim) query = query.lte('data', filtros.data_fim);
      if (filtros.tipo) query = query.eq('tipo_alteracao', filtros.tipo);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async criar(dados) {
      const { data, error } = await db.from('escalas').insert([dados]).select().single();
      if (error) throw error;
      await registrarAuditoria('escalas', 'INSERT', data.id, null, data);
      return data;
    },
    async atualizar(id, dados) {
      const { data, error } = await db.from('escalas').update(dados).eq('id', id).select().single();
      if (error) throw error;
      await registrarAuditoria('escalas', 'UPDATE', id, null, data);
      return data;
    },
    async excluir(id) {
      const { error } = await db.from('escalas').delete().eq('id', id);
      if (error) throw error;
    },
    async listarPorData(data) {
      const { data: rows, error } = await db.from('escalas').select('*').eq('data', data);
      if (error) throw error;
      return rows || [];
    }
  },

  // ---------- PROGRAMAÇÕES ----------
  programacoes: {
    async listar(filtros = {}) {
      let query = db.from('programacoes').select('*').order('data_inicio', { ascending: false });
      if (filtros.colaborador_id) query = query.eq('colaborador_id', filtros.colaborador_id);
      if (filtros.tipo) query = query.eq('tipo', filtros.tipo);
      if (filtros.status) query = query.eq('status', filtros.status);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    async criar(dados) {
      const { data, error } = await db.from('programacoes').insert([dados]).select().single();
      if (error) throw error;
      await registrarAuditoria('programacoes', 'INSERT', data.id, null, data);
      return data;
    },
    async atualizar(id, dados) {
      const { data, error } = await db.from('programacoes').update(dados).eq('id', id).select().single();
      if (error) throw error;
      await registrarAuditoria('programacoes', 'UPDATE', id, null, data);
      return data;
    },
    async excluir(id) {
      const { error } = await db.from('programacoes').delete().eq('id', id);
      if (error) throw error;
    },
    async aprovar(id, usuario) {
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
      const { data, error } = await db.from('auditoria').select('*').order('created_at', { ascending: false }).limit(limite);
      if (error) throw error;
      return data || [];
    }
  },

  // ---------- CONFIGURAÇÕES ----------
  configuracoes: {
    async listar() {
      const { data, error } = await db.from('configuracoes').select('*');
      if (error) throw error;
      const obj = {};
      (data || []).forEach(row => { obj[row.chave] = row.valor; });
      return obj;
    },
    async salvar(chave, valor) {
      const { data, error } = await db.from('configuracoes').upsert({ chave, valor }, { onConflict: 'chave' }).select().single();
      if (error) throw error;
      return data;
    }
  },

  // ---------- REALTIME ----------
  assinarTabela(tabela, callback) {
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
    await db.from('auditoria').insert([{
      tabela,
      operacao,
      registro_id: registroId,
      dados_anteriores: dadosAnteriores,
      dados_novos: dadosNovos,
      usuario: 'Admin',
      created_at: new Date().toISOString()
    }]);
  } catch (e) {
    console.warn('Auditoria falhou:', e.message);
  }
}

// Exporta globalmente
window.DB = DB;
window.db = db;
