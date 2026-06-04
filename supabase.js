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
      await aplicarProgramacoesVigentes();
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
      const payload = deduplicarPorCampos(
        lista.map(d => limparChavesConflito(calcularCamposAuto(d), ['matricula'])),
        ['matricula']
      );
      const comMatricula = payload.filter(d => d.matricula);
      const semMatricula = payload.filter(d => !d.matricula);
      const importados = [];

      if (comMatricula.length) {
        const { data, error } = await db.from('colaboradores').upsert(comMatricula, { onConflict: 'matricula' }).select();
        if (error) throw error;
        importados.push(...(data || []));
      }

      if (semMatricula.length) {
        const { data, error } = await db.from('colaboradores').insert(semMatricula).select();
        if (error) throw error;
        importados.push(...(data || []));
      }

      return importados;
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
      const programadas = await listarEscalasProgramadas(filtros);
      return [...(data || []), ...programadas];
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
      const limpos = deduplicarPorCampos((registros || []).map(r => ({
        ...r,
        colaborador_id: r.colaborador_id || null,
        hora_extra: r.hora_extra === '' ? null : r.hora_extra
      })), ['colaborador_id', 'data']);

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
    let meses = (hoje.getFullYear() - adm.getFullYear()) * 12 + (hoje.getMonth() - adm.getMonth());
    if (hoje.getDate() < adm.getDate()) meses -= 1;
    d.tempo_meses = Math.max(0, meses);
  }
  return d;
}

function deduplicarPorCampos(registros, campos) {
  const semChave = [];
  const porChave = new Map();

  (registros || []).forEach(registro => {
    const partes = campos.map(campo => String(registro?.[campo] ?? '').trim().toLowerCase());
    if (partes.some(parte => !parte)) {
      semChave.push(registro);
      return;
    }
    porChave.set(partes.join('|'), registro);
  });

  return [...semChave, ...porChave.values()];
}

function limparChavesConflito(registro, campos) {
  const limpo = { ...registro };
  campos.forEach(campo => {
    if (String(limpo[campo] ?? '').trim() === '') {
      limpo[campo] = null;
    } else if (typeof limpo[campo] === 'string') {
      limpo[campo] = limpo[campo].trim();
    }
  });
  return limpo;
}

let sincronizandoProgramacoes = false;

async function aplicarProgramacoesVigentes() {
  if (sincronizandoProgramacoes) return;
  sincronizandoProgramacoes = true;
  try {
    const hoje = dataHojeLocal();
    const { data, error } = await db
      .from('programacoes')
      .select('*')
      .lte('data_inicio', hoje);
    if (error) throw error;

    const vigentes = (data || []).filter(p => programacaoAplicavel(p) && programacaoVigente(p, hoje));
    for (const p of vigentes) {
      if (!p.colaborador_id) continue;
      const status = statusPorProgramacao(p.tipo);
      const payload = {
        status,
        escala: p.tipo || status,
      };
      if (status === 'Férias') {
        payload.primeiro_dia_ferias = p.data_inicio;
        payload.ultimo_dia_ferias = p.data_fim || p.data_inicio;
      }

      await db.from('colaboradores').update(payload).eq('id', p.colaborador_id);
    }
  } catch (e) {
    console.warn('Sincronização de programações falhou:', e.message);
  } finally {
    sincronizandoProgramacoes = false;
  }
}

async function listarEscalasProgramadas(filtros = {}) {
  const inicio = filtros.data_inicio || dataHojeLocal();
  const fim = filtros.data_fim || inicio;
  const { data, error } = await db
    .from('programacoes')
    .select('*')
    .lte('data_inicio', fim);
  if (error) return [];

  return (data || [])
    .filter(p => programacaoAplicavel(p) && programacaoCruzaPeriodo(p, inicio, fim))
    .filter(p => !filtros.colaborador_id || String(p.colaborador_id) === String(filtros.colaborador_id))
    .flatMap(p => datasDaProgramacao(p, inicio, fim).map(data => ({
      id: -Number(p.id || 0),
      colaborador_id: p.colaborador_id,
      colaborador_nome: p.colaborador_nome,
      data,
      horario: '',
      entrada: '',
      saida: '',
      tipo_alteracao: p.tipo,
      observacao: p.motivo || p.observacao || 'Programação planejada',
      status: statusPorProgramacao(p.tipo),
      cor: corProgramacao(p.tipo),
      origem_programacao_id: p.id,
    })));
}

function dataHojeLocal() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function programacaoVigente(programacao, data) {
  return programacaoCruzaPeriodo(programacao, data, data);
}

function programacaoCruzaPeriodo(programacao, inicio, fim) {
  if (!programacao?.data_inicio) return false;
  const progInicio = programacao.data_inicio;
  const progFim = programacao.data_fim || programacao.data_inicio;
  return progInicio <= fim && progFim >= inicio;
}

function programacaoAplicavel(programacao) {
  return !['Rejeitado', 'Cancelado'].includes(String(programacao?.status || '').trim());
}

function datasDaProgramacao(programacao, inicio, fim) {
  const datas = [];
  const primeiro = maiorData(programacao.data_inicio, inicio);
  const ultimo = menorData(programacao.data_fim || programacao.data_inicio, fim);
  const cursor = new Date(`${primeiro}T00:00:00`);
  const limite = new Date(`${ultimo}T00:00:00`);

  while (cursor <= limite) {
    datas.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return datas;
}

function maiorData(a, b) {
  return a > b ? a : b;
}

function menorData(a, b) {
  return a < b ? a : b;
}

function statusPorProgramacao(tipo) {
  const normalizado = String(tipo || '').trim();
  const mapa = {
    'Férias': 'Férias',
    'Ferias': 'Férias',
    'Day Off': 'Day Off',
    'Folga': 'Day Off',
    'Treinamento': 'Treinamento',
    'Home Office': 'Ativo',
    'Licença': 'Afastado',
    'Licenca': 'Afastado',
    'Ausência': 'Afastado',
    'Ausencia': 'Afastado',
  };
  return mapa[normalizado] || normalizado || 'Ativo';
}

function corProgramacao(tipo) {
  const mapa = {
    'Férias': '#f59e0b',
    'Ferias': '#f59e0b',
    'Day Off': '#3b82f6',
    'Folga': '#10b981',
    'Treinamento': '#6366f1',
    'Home Office': '#8b5cf6',
    'Licença': '#ef4444',
    'Licenca': '#ef4444',
  };
  return mapa[String(tipo || '').trim()] || '#6b7280';
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

document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.renderizarTabelaColaboradores === 'function' && !window.renderizarTabelaColaboradores.__tempoCasaFormatado) {
    const renderOriginal = window.renderizarTabelaColaboradores;
    window.renderizarTabelaColaboradores = function renderizarTabelaColaboradoresComTempoCasa() {
      renderOriginal();
      formatarTempoCasaNaTabela();
    };
    window.renderizarTabelaColaboradores.__tempoCasaFormatado = true;
  }

  window.confirmarImportacao = async function confirmarImportacaoComReporte(dados) {
    if (!Security.requirePermission('importar_dados')) return;
    if (!dados?.length) return;
    const destino = document.getElementById('import-destino')?.value || 'colaboradores';
    toast(`Importando ${dados.length} registros...`, 'info');

    try {
      const mapeados = dados.map(d => {
        const lider = d.supervisor || d.Supervisor || d.SUPERVISOR ||
          d.reporte || d.Reporte || d.REPORTE ||
          d.lider || d.Lider || d.Líder || d.LIDER || '';

        return {
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
          escala: d.escala || d.Escala || d.ESCALA || '',
          admissao: normalizarDataImportacao(
            d.admissao || d.Admissão || d.Admissao || d.ADMISSAO ||
            d['Data de Admissão'] || d['Data Admissão'] ||
            d['Data de Admissao'] || d['Data Admissao'] || ''
          ),
          supervisor: lider,
          reporte: lider,
        };
      }).filter(d => d.nome);

      if (destino === 'colaboradores') {
        await DB.colaboradores.importarLote(mapeados);
      } else if (destino === 'staff') {
        const staffPayload = deduplicarPorCampos(
          mapeados.map(d => limparChavesConflito(calcularCamposAuto(d), ['matricula'])),
          ['matricula']
        );
        const comMatricula = staffPayload.filter(d => d.matricula);
        const semMatricula = staffPayload.filter(d => !d.matricula);

        if (comMatricula.length) {
          const { error } = await db.from('staff').upsert(comMatricula, { onConflict: 'matricula' });
          if (error) throw error;
        }
        if (semMatricula.length) {
          const { error } = await db.from('staff').insert(semMatricula);
          if (error) throw error;
        }
      }

      toast(`${mapeados.length} registros importados com sucesso!`, 'success');
      document.getElementById('import-preview').innerHTML = '';
      window._dadosImport = null;
    } catch (e) {
      toast('Erro na importação: ' + e.message, 'error');
    }
  };
});

function formatarTempoCasaNaTabela() {
  const tbody = document.getElementById('tabela-colaboradores');
  if (!tbody) return;

  [...tbody.querySelectorAll('tr')].forEach(tr => {
    if (!tr.cells || tr.cells.length < 12) return;
    const texto = String(tr.cells[11].textContent || '').trim();
    const match = texto.match(/^(\d+)\s*m$/i);
    if (!match) return;
    tr.cells[11].textContent = formatarTempoCasa(Number(match[1]));
  });
}

function formatarTempoCasa(tempoMeses) {
  if (tempoMeses === null || tempoMeses === undefined || tempoMeses === '') return '-';
  const totalMeses = Math.max(0, Number(tempoMeses) || 0);
  const anos = Math.floor(totalMeses / 12);
  const meses = totalMeses % 12;

  if (!anos) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  if (!meses) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  return `${anos} ${anos === 1 ? 'ano' : 'anos'} e ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
}

function normalizarDataImportacao(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  if (typeof valor === 'number' || /^\d{5}$/.test(String(valor).trim())) {
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
