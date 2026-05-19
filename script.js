/**
 * MOP 2026 — Sistema de Gestão
 * script.js — Lógica principal com integração Supabase
 *
 * Estrutura:
 *  1. Configuração & Inicialização
 *  2. Carregamento de dados (carregarDados)
 *  3. Salvamento (salvarDados / sincronizacaoAutomatica)
 *  4. Atualização de interface (atualizarInterface)
 *  5. Render de cada painel (MOP, Staff, Escala, Prog)
 *  6. Helpers & utilitários
 *  7. Modais & eventos
 *  8. Bootstrap
 */

// =====================================================
// 1. CONFIGURAÇÃO & SUPABASE
// =====================================================

const SUPABASE_URL     = 'https://pjeehaziodnxuakhacmc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqZWVoYXppb2RueHVha2hhY21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjU1MzQsImV4cCI6MjA5NDcwMTUzNH0.h5mIzDOvVS3M8BDFy3TeLM4djdBFHTM72LOpKGNgLkg';

// Inicializar cliente Supabase
let db;
try {
  if (!window.supabase) throw new Error('Biblioteca @supabase/supabase-js não carregou.');
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
  console.log('✓ Supabase client criado');
} catch (err) {
  console.error('✗ Erro ao criar Supabase client:', err);
  setConn('err', '❌ Falha na conexão');
  toast('Erro: ' + err.message, 'var(--red)', 6000);
}

// =====================================================
// ESTADO GLOBAL
// =====================================================
let mopData    = [];   // Linha MOP (operação)
let staffData  = [];   // Staff (supervisores / líderes)
let escData    = [];   // Escala mensal
let schedData  = [];   // Programações de status

let mopHeaders   = [];
let staffHeaders = [];
let escHeaders   = [];
let ALL_DAY_COLS = [];
let MONTHS       = [];
let curMonth     = '';
let curTab       = 'mop';
let saveTimeout  = null;

let sortC = { mop: null, staff: null, escala: null };
let sortD = { mop: 1,    staff: 1,    escala: 1    };

// Opções de status disponíveis
const STATUS_OPTS = ['Ativo', 'Desligado', 'Afastado', 'Férias', 'Day Off', 'Folga', 'BH'];

// Feriados nacionais 2026 (dd-mm)
const FERIADOS = [
  '01-01','21-04','01-05','07-09','12-10','02-11','15-11','25-12'
];

// =====================================================
// HELPERS
// =====================================================
function $(id) { return document.getElementById(id); }

/** Exibe toast de notificação */
function toast(msg, color = 'var(--grn)', dur = 2500) {
  const t = $('toast');
  $('toast-msg').innerText = msg;
  t.style.color = color;
  t.classList.add('on');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('on'), dur);
}

/** Atualiza o badge de conexão */
function setConn(cls, txt) {
  const c = $('conn-badge');
  c.className = 'conn ' + cls;
  c.innerText = txt;
}

/** Mostra/oculta o overlay de loading */
function setLoading(vis, msg = '') {
  const el = $('loading-overlay');
  if (msg) $('loading-msg').innerText = msg;
  el.classList.toggle('hidden', !vis);
}

/** Gera iniciais a partir do nome */
function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return ((p[0] || '')[0] || '') + ((p[p.length - 1] || '')[0] || '');
}

/** Badge HTML por status */
function badge(s) {
  const map = {
    'Ativo': 'bg', 'Desligado': 'br', 'Férias': 'ba',
    'Afastado': 'bp', 'Day Off': 'bb', 'Folga': 'bt', 'BH': 'bgr'
  };
  return s ? `<span class="bdg ${map[s] || 'bgr'}">${s}</span>` : '';
}

/** Formata data ISO → dd/mm/yyyy */
function fmtDate(val) {
  if (!val) return '';
  const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : val;
}

/** Verifica se coluna é de data */
function isDateField(col) {
  const n = col.toLowerCase();
  return n.includes('admiss') || n.includes('nascimento') || n.includes('data');
}

/** Normaliza horário para HH:MM */
function normalizeTime(v) {
  if (!v) return v;
  const s = String(v).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return s;
  let h = parseInt(m[1]), mn = m[2], ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return String(h).padStart(2, '0') + ':' + mn;
}

/** Valores únicos de uma chave */
function uniq(arr, k) {
  return [...new Set(arr.map(r => r[k]).filter(Boolean))].sort();
}

/** Preenche select com opções */
function fillSel(id, opts) {
  const el = $(id);
  if (!el) return;
  const first = el.options[0]?.textContent || 'Todos';
  el.innerHTML = `<option value="">${first}</option>` +
    opts.map(o => `<option>${o}</option>`).join('');
}

/** Ordena array por coluna */
function srt(data, tab) {
  const c = sortC[tab];
  if (!c) return data;
  return data.slice().sort((a, b) => {
    const av = a[c] || '', bv = b[c] || '';
    return av < bv ? -sortD[tab] : av > bv ? sortD[tab] : 0;
  });
}

/** Verifica se uma data é feriado (string dd-mm) */
function isFeriado(col) {
  const m = col.match(/(\d{2})[-\/](\d{2})$/);
  if (!m) return false;
  return FERIADOS.includes(m[1] + '-' + m[2]);
}

/** Verifica se coluna é dia de fim de semana */
function isWE(col) {
  const w = col.toLowerCase().slice(0, 3);
  return w === 'dom' || w === 'sáb' || w === 'sab';
}

/** Coluna filtrada pelo mês atual */
function DAY_COLS() {
  if (!curMonth) return ALL_DAY_COLS;
  return ALL_DAY_COLS.filter(c => {
    const m = c.match(/(\d{2})[-\/](\d{2})$/);
    return m && m[2] === curMonth;
  });
}

/** Determina tipo de turno para estilo de célula */
function shiftFromRow(row, val, isHoliday) {
  if (isHoliday) return 'h';
  const st = String(row.Status || '').toLowerCase();
  if (st === 'férias')   return 'v';
  if (st === 'afastado') return 'a';
  if (st === 'day off')  return 'd';
  if (st === 'folga')    return 'f';
  if (st === 'bh')       return 'b';
  if (val === '' || val == null) return '';
  const absMap = { 'Folga': 'f', 'Day Off': 'd', 'BH': 'b', 'Férias': 'v', 'Afastado': 'a' };
  if (typeof val === 'string' && absMap[val.trim()]) return absMap[val.trim()];
  const n = parseInt(val);
  if (isNaN(n)) return '';
  if (n === 0) return 'f';
  return 'c';
}

/** Calcula minutos de trabalho de uma linha */
function calcMins(row) {
  const e = (row.Horário || row.Horario || '08:00').trim();
  const x = (row.Saida || '').trim();
  if (x && x !== '-' && /\d{1,2}:\d{2}/.test(x)) {
    const toM = s => { const p = s.split(':'); return parseInt(p[0]) * 60 + (parseInt(p[1]) || 0); };
    let t = toM(x) - toM(e);
    if (t > 240) t -= 60; // descontar almoço
    return Math.max(t, 0);
  }
  return ['BackOffice', 'Ouvidoria', 'PJ'].includes(row.Célula || '') ? 600 : 540;
}

// =====================================================
// 2. CARREGAR DADOS DO SUPABASE
// =====================================================

/**
 * carregarDados() — Lê todas as tabelas do Supabase
 * e atualiza o estado global.
 */
async function carregarDados() {
  setLoading(true, 'Conectando ao Supabase...');
  setConn('spin', '⟳ Carregando...');

  const TIMEOUT_MS = 12000;
  const timeout = new Promise((_, rej) =>
    setTimeout(() => rej(new Error('Timeout: servidor não respondeu em 12s')), TIMEOUT_MS)
  );

  try {
    const loadAll = async () => {
      setLoading(true, 'Buscando dados...');
      const [r1, r2, r3, r4] = await Promise.all([
        db.from('mop').select('data').eq('id', 1).maybeSingle(),
        db.from('staff').select('data').eq('id', 1).maybeSingle(),
        db.from('escala').select('data').eq('id', 1).maybeSingle(),
        db.from('programacoes').select('data').eq('id', 1).maybeSingle()
      ]);
      const errors = [r1.error, r2.error, r3.error, r4.error].filter(Boolean);
      if (errors.length) throw new Error(errors[0].message);
      return { r1, r2, r3, r4 };
    };

    const { r1, r2, r3, r4 } = await Promise.race([loadAll(), timeout]);

    // Popula estado global
    mopData   = Array.isArray(r1.data?.data) ? r1.data.data : [];
    staffData = Array.isArray(r2.data?.data) ? r2.data.data : [];
    escData   = Array.isArray(r3.data?.data) ? r3.data.data : [];
    schedData = Array.isArray(r4.data?.data) ? r4.data.data : [];

    console.log('Dados carregados:', { mop: mopData.length, staff: staffData.length, escala: escData.length, prog: schedData.length });

    // Inferir headers dinamicamente
    mopHeaders   = mopData.length
      ? Object.keys(mopData[0]).filter(k => !k.startsWith('_'))
      : ['Colaborador', 'Status', 'Célula', 'Tipo', 'Reporte', 'Horário', 'Saida'];

    staffHeaders = staffData.length
      ? Object.keys(staffData[0]).filter(k => !k.startsWith('_'))
      : ['Colaborador', 'Status', 'Cargo', 'Célula', 'Tipo'];

    const allEscKeys = new Set();
    escData.forEach(r => Object.keys(r).forEach(k => allEscKeys.add(k)));
    escHeaders = Array.from(allEscKeys).filter(k => !k.startsWith('_'));

    // Colunas de dias (formato: "seg 01-01" ou "seg 01/01")
    ALL_DAY_COLS = escHeaders.filter(h => /[a-záéíóúâêîôûãõ]{2,3}\s+\d{2}[-\/]\d{2}/i.test(h));
    ALL_DAY_COLS.sort((a, b) => {
      const ma = a.match(/(\d{2})[-\/](\d{2})$/);
      const mb = b.match(/(\d{2})[-\/](\d{2})$/);
      if (!ma || !mb) return 0;
      const da = ma[2] + ma[1], db = mb[2] + mb[1];
      return da.localeCompare(db);
    });
    MONTHS = [...new Set(ALL_DAY_COLS.map(c => {
      const m = c.match(/(\d{2})[-\/](\d{2})$/);
      return m ? m[2] : null;
    }).filter(Boolean))].sort();
    curMonth = MONTHS[0] || '';

    // IDs únicos para cada linha
    [mopData, staffData, escData].forEach(arr =>
      arr.forEach((r, i) => { r._id = r._id || (i + Date.now()); })
    );

    // Aplica programações de status agendadas
    applyScheduledStatuses();

    // Atualiza filtros e renderiza
    buildMonthFilter();
    populateFilters();
    atualizarInterface();

    setConn('ok', '✅ Conectado');
    setLoading(false);
    toast('Dados carregados com sucesso!');

  } catch (err) {
    console.error('Erro ao carregar:', err);
    setConn('err', '❌ Erro');
    setLoading(false);
    toast('Erro ao carregar: ' + err.message, 'var(--red)', 6000);
  }
}

// =====================================================
// 3. SALVAR DADOS NO SUPABASE
// =====================================================

/**
 * salvarDados() — Persiste todos os arrays no Supabase
 * usando upsert na linha id=1 de cada tabela.
 */
async function salvarDados() {
  try {
    setConn('spin', '💾 Salvando...');
    const tabelas = [
      { name: 'mop',         data: mopData },
      { name: 'staff',       data: staffData },
      { name: 'escala',      data: escData },
      { name: 'programacoes', data: schedData }
    ];
    for (const t of tabelas) {
      const { error } = await db.from(t.name).upsert({ id: 1, data: t.data }, { onConflict: 'id' });
      if (error) throw error;
    }
    setConn('ok', '✅ Sincronizado');
    $('ub').classList.remove('on');
    toast('💾 Dados salvos no Supabase');
  } catch (e) {
    setConn('err', '❌ Erro ao salvar');
    toast('Erro ao salvar: ' + e.message, 'var(--red)', 5000);
    console.error('Erro salvarDados:', e);
  }
}

/**
 * sincronizacaoAutomatica() — Debounce de 1.5s para salvar
 * automaticamente após alterações.
 */
function sincronizacaoAutomatica() {
  $('ub').classList.add('on');
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => salvarDados(), 1500);
}

// =====================================================
// 4. ATUALIZAR INTERFACE
// =====================================================

/**
 * atualizarInterface() — Re-renderiza o painel ativo
 * e atualiza estatísticas de todos os painéis.
 */
function atualizarInterface() {
  renderMop();
  renderStaff();
  renderEscala();
  renderProg();
  updateMissing();
}

// =====================================================
// 5. RENDER PAINÉIS
// =====================================================

/** Renderiza o painel MOP */
function renderMop() {
  const q   = ($('mop-q')?.value || '').toLowerCase();
  const st  = $('mop-st')?.value  || '';
  const cel = $('mop-cel')?.value || '';
  const rep = $('mop-rep')?.value || '';
  const tip = $('mop-tip')?.value || '';

  let data = srt(mopData, 'mop').filter(r =>
    (!q   || (r.Colaborador || '').toLowerCase().includes(q)) &&
    (!st  || r.Status === st)  &&
    (!cel || r.Célula === cel) &&
    (!rep || r.Reporte === rep) &&
    (!tip || r.Tipo === tip)
  );

  // Stats
  $('mop-tot').innerText = mopData.length;
  $('mop-atv').innerText = mopData.filter(r => r.Status === 'Ativo').length;
  $('mop-afa').innerText = mopData.filter(r => r.Status === 'Afastado').length;
  $('mop-fer').innerText = mopData.filter(r => r.Status === 'Férias').length;
  $('mop-des').innerText = mopData.filter(r => r.Status === 'Desligado').length;
  $('bg-mop').innerText  = data.length;

  // Cabeçalhos
  const th = $('mop-th');
  th.innerHTML = mopHeaders.map(col => {
    const cls = sortC.mop === col ? (sortD.mop > 0 ? 'sa' : 'sd') : '';
    return `<th class="${cls}" onclick="sortBy('mop','${col}')">${col}</th>`;
  }).join('') + '<th>Ações</th>';

  // Linhas
  const tb = $('mop-tb');
  tb.innerHTML = '';
  const empty = $('mop-empty');

  if (data.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  data.forEach(row => {
    const tr = document.createElement('tr');
    const st = row.Status || '';
    if (st === 'Desligado') tr.classList.add('rd');
    else if (st === 'Afastado') tr.classList.add('fa');
    else if (st === 'Férias') tr.classList.add('af');

    mopHeaders.forEach(col => {
      const td = document.createElement('td');
      if (col === 'Status') {
        // Select de status inline
        const sel = document.createElement('select');
        sel.className = 'fi';
        sel.style.cssText = 'width:100px;padding:2px 6px;font-size:11px';
        STATUS_OPTS.forEach(o => {
          const op = document.createElement('option');
          op.value = o; op.textContent = o;
          if (o === row[col]) op.selected = true;
          sel.appendChild(op);
        });
        sel.onchange = () => {
          row[col] = sel.value;
          sincronizacaoAutomatica();
          renderMop();
        };
        td.appendChild(sel);
      } else if (col === 'Colaborador') {
        td.innerHTML = `<div class="emp">
          <div class="av">${initials(row[col])}</div>
          <div class="nm">${row[col] || ''}</div>
        </div>`;
      } else if (isDateField(col)) {
        td.innerText = fmtDate(row[col]);
      } else {
        td.setAttribute('contenteditable', 'true');
        td.innerText = row[col] || '';
        td.onblur = () => {
          row[col] = td.innerText.trim();
          sincronizacaoAutomatica();
        };
      }
      tr.appendChild(td);
    });

    // Ações
    const tdAct = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'btn btn-danger btn-sm';
    btn.innerText = '✕';
    btn.onclick = () => {
      if (confirm(`Remover "${row.Colaborador}"?`)) {
        mopData = mopData.filter(r => r !== row);
        sincronizacaoAutomatica();
        renderMop();
      }
    };
    tdAct.appendChild(btn);
    tr.appendChild(tdAct);
    tb.appendChild(tr);
  });
}

/** Renderiza o painel Staff */
function renderStaff() {
  const q   = ($('staff-q')?.value || '').toLowerCase();
  const st  = $('staff-st')?.value  || '';
  const car = $('staff-car')?.value || '';
  const tip = $('staff-tip')?.value || '';

  let data = srt(staffData, 'staff').filter(r =>
    (!q   || (r.Colaborador || '').toLowerCase().includes(q)) &&
    (!st  || r.Status === st)  &&
    (!car || r.Cargo === car)  &&
    (!tip || r.Tipo === tip)
  );

  $('staff-tot').innerText = staffData.length;
  $('staff-atv').innerText = staffData.filter(r => r.Status === 'Ativo').length;
  $('staff-afa').innerText = staffData.filter(r => r.Status === 'Afastado').length;
  $('bg-staff').innerText  = data.length;

  const th = $('staff-th');
  th.innerHTML = staffHeaders.map(col => {
    const cls = sortC.staff === col ? (sortD.staff > 0 ? 'sa' : 'sd') : '';
    return `<th class="${cls}" onclick="sortBy('staff','${col}')">${col}</th>`;
  }).join('') + '<th>Ações</th>';

  const tb = $('staff-tb');
  tb.innerHTML = '';
  const empty = $('staff-empty');

  if (data.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  data.forEach(row => {
    const tr = document.createElement('tr');
    if (row.Status === 'Desligado') tr.classList.add('rd');

    staffHeaders.forEach(col => {
      const td = document.createElement('td');
      if (col === 'Status') {
        td.innerHTML = badge(row[col]);
        td.style.cursor = 'pointer';
        td.onclick = () => {
          const idx = STATUS_OPTS.indexOf(row.Status) || 0;
          row.Status = STATUS_OPTS[(idx + 1) % STATUS_OPTS.length];
          sincronizacaoAutomatica();
          renderStaff();
        };
      } else if (col === 'Colaborador') {
        td.innerHTML = `<div class="emp">
          <div class="av">${initials(row[col])}</div>
          <div class="nm">${row[col] || ''}</div>
        </div>`;
      } else {
        td.setAttribute('contenteditable', 'true');
        td.innerText = row[col] || '';
        td.onblur = () => { row[col] = td.innerText.trim(); sincronizacaoAutomatica(); };
      }
      tr.appendChild(td);
    });

    const tdAct = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'btn btn-danger btn-sm';
    btn.innerText = '✕';
    btn.onclick = () => {
      if (confirm(`Remover "${row.Colaborador}"?`)) {
        staffData = staffData.filter(r => r !== row);
        sincronizacaoAutomatica();
        renderStaff();
      }
    };
    tdAct.appendChild(btn);
    tr.appendChild(tdAct);
    tb.appendChild(tr);
  });
}

/** Renderiza o painel Escala */
function renderEscala() {
  const q   = ($('esc-q')?.value  || '').toLowerCase();
  const st  = $('esc-st')?.value  || '';
  const cel = $('esc-cel')?.value || '';
  const tip = $('esc-tip')?.value || '';

  const dcs = DAY_COLS();
  let data = srt(escData, 'escala').filter(r =>
    (!q   || (r.Colaborador || '').toLowerCase().includes(q)) &&
    (!st  || r.Status === st)  &&
    (!cel || r.Célula === cel) &&
    (!tip || r.Tipo === tip)
  );

  // KPIs
  $('bg-escala').innerText = data.length;
  $('esc-tot').innerText   = data.length;
  let wk = 0, off = 0;
  data.forEach(r => {
    const today = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
      .replace('.', '').toLowerCase().replace(' ', ' ');
    const st = (r.Status || '').toLowerCase();
    if (['férias','afastado','day off','folga','bh'].includes(st)) off++;
    else wk++;
  });
  $('esc-wk').innerText  = wk;
  $('esc-off').innerText = off;
  $('esc-miss').innerText = missingCount();

  const empty = $('esc-empty');
  if (data.length === 0) { empty.style.display = ''; $('esc-th').innerHTML = ''; $('esc-tb').innerHTML = ''; return; }
  empty.style.display = 'none';

  // Cabeçalho
  const th = $('esc-th');
  th.innerHTML = `<th class="sticky-l">Colaborador</th>` +
    dcs.map(col => {
      const isWeekend = isWE(col);
      const isHol = isFeriado(col);
      const m = col.match(/(\d{2})[-\/](\d{2})$/);
      const dn = col.split(' ')[0] || '';
      const dd = m ? m[1] : '';
      let cls = 'day';
      if (isWeekend) cls += ' we';
      if (isHol) cls += ' hol';
      return `<th class="${cls}"><span class="dn">${dn}</span><span class="dd">${dd}</span></th>`;
    }).join('') +
    `<th>Hrs/mês</th>`;

  // Linhas
  const tb = $('esc-tb');
  tb.innerHTML = '';

  data.forEach(row => {
    const tr = document.createElement('tr');
    let totalMins = 0;

    // Nome (sticky)
    const tdName = document.createElement('td');
    tdName.className = 'sticky-l';
    tdName.innerHTML = `<div class="emp">
      <div class="av">${initials(row.Colaborador)}</div>
      <div>
        <div class="nm">${row.Colaborador || '?'}</div>
        <div style="font-size:10px;color:var(--tx3)">${badge(row.Status)}</div>
      </div>
    </div>`;
    tr.appendChild(tdName);

    // Colunas de dias
    dcs.forEach(col => {
      const td = document.createElement('td');
      td.style.padding = '4px';
      td.style.textAlign = 'center';
      const val = row[col];
      const isHol = isFeriado(col);
      const shift = shiftFromRow(row, val, isHol);

      const lbl = shift === 'c' ? (row.Horário || row.Horario || '').slice(0,5) || String(val || '') : (
        shift === 'v' ? 'FER' :
        shift === 'a' ? 'AFA' :
        shift === 'd' ? 'DO'  :
        shift === 'f' ? 'FOL' :
        shift === 'b' ? 'BH'  :
        shift === 'h' ? 'FER' : '--'
      );

      const hrs = (shift === 'c')
        ? (() => { const m = calcMins(row); return Math.floor(m/60)+'h'+(m%60?String(m%60).padStart(2,'0'):''); })()
        : '';

      const cell = document.createElement('div');
      cell.className = `scell ${shift || 'empty'}`;
      cell.innerHTML = `<span class="lbl">${lbl}</span><span class="hrs">${hrs}</span>`;
      cell.onclick = () => openDayEditor(row, col, td);
      td.appendChild(cell);

      // Acumula horas trabalhadas
      if (shift === 'c') totalMins += calcMins(row);
      tr.appendChild(td);
    });

    // Total de horas
    const tdTot = document.createElement('td');
    const h = Math.floor(totalMins / 60), m = totalMins % 60;
    tdTot.innerHTML = `<span class="totcell">${h}h${m ? String(m).padStart(2,'0') : ''}</span>`;
    tr.appendChild(tdTot);

    tb.appendChild(tr);
  });
}

/** Renderiza o painel de Programações */
function renderProg() {
  const q   = ($('prog-q')?.value  || '').toLowerCase();
  const flt = $('prog-flt')?.value || '';
  const today = new Date().toISOString().slice(0, 10);

  let data = schedData.filter(s =>
    (!q || (s.colabName || '').toLowerCase().includes(q))
  );

  if (flt === 'active') {
    data = data.filter(s => s.changes.some(c => c.dateStart <= today && (!c.dateEnd || c.dateEnd >= today)));
  } else if (flt === 'pending') {
    data = data.filter(s => s.changes.some(c => c.dateStart > today));
  } else if (flt === 'done') {
    data = data.filter(s => s.changes.every(c => c.dateEnd && c.dateEnd < today));
  }

  $('bg-prog').innerText   = schedData.length;
  $('prog-tot').innerText  = schedData.length;
  $('prog-atv').innerText  = schedData.filter(s => s.changes.some(c => c.dateStart <= today && (!c.dateEnd || c.dateEnd >= today))).length;
  $('prog-pend').innerText = schedData.filter(s => s.changes.some(c => c.dateStart > today)).length;

  const list = $('prog-list');
  const empty = $('prog-empty');
  list.innerHTML = '';

  if (data.length === 0) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  data.forEach(s => {
    const card = document.createElement('div');
    card.className = 'prog-card';
    card.innerHTML = `
      <div class="prog-card-hd">
        <div class="emp">
          <div class="av">${initials(s.colabName)}</div>
          <span class="prog-card-name">${s.colabName}</span>
        </div>
        <div class="prog-card-actions">
          <button class="btn btn-sm btn-pri" onclick="editProg(${s.id})">✏ Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProg(${s.id})">✕</button>
        </div>
      </div>
      <div class="prog-card-changes">
        ${s.changes.map(c => {
          const isActive = c.dateStart <= today && (!c.dateEnd || c.dateEnd >= today);
          return `<div class="prog-change">
            ${badge(c.status)}
            <span class="prog-change-dates">${c.dateStart} → ${c.dateEnd || '∞'}</span>
            ${isActive ? '<span class="bdg bb">Em vigor</span>' : ''}
            ${c.returnStatus ? `<span style="color:var(--tx3);font-size:10px">→ retorno: ${c.returnStatus} em ${c.returnDate || '?'}</span>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    list.appendChild(card);
  });
}

// =====================================================
// ESCALA UTILS
// =====================================================

/** Conta colaboradores do MOP sem registro na escala */
function missingCount() {
  const escNames = new Set(escData.map(r => r.Colaborador));
  return mopData.filter(r => r.Status === 'Ativo' && !escNames.has(r.Colaborador)).length;
}

/** Atualiza badge "Sem escala" */
function updateMissing() {
  const n = missingCount();
  const btn = $('btn-miss');
  if (btn) btn.textContent = `⚠ Sem escala (${n})`;
}

/** Exibe modal com colaboradores sem escala */
function showMissing() {
  const escNames = new Set(escData.map(r => r.Colaborador));
  const missing  = mopData.filter(r => r.Status === 'Ativo' && !escNames.has(r.Colaborador));
  const body = $('miss-body');
  if (missing.length === 0) {
    body.innerHTML = '<p style="color:var(--grn)">✅ Todos os colaboradores ativos possuem escala!</p>';
  } else {
    body.innerHTML = `<div class="miss-panel"><h3>⚠ ${missing.length} colaborador(es) sem escala</h3>
      <div class="miss-grid">
        ${missing.map(r => `
          <div class="miss-card" onclick="addToEscala(${JSON.stringify(r).replace(/"/g,'&quot;')})">
            <div class="miss-name">${r.Colaborador || '?'}</div>
            <div class="miss-meta">${r.Célula || ''} · ${r.Tipo || ''}</div>
            <div style="font-size:10px;color:var(--acc);margin-top:3px">+ Adicionar à escala →</div>
          </div>`).join('')}
      </div></div>`;
  }
  openOv('ov-miss');
}

/** Adiciona colaborador do MOP à escala */
function addToEscala(row) {
  if (escData.find(r => r.Colaborador === row.Colaborador)) {
    toast('Colaborador já está na escala', 'var(--amb)');
    return;
  }
  const newRow = { ...row, _id: Date.now() };
  escData.push(newRow);
  sincronizacaoAutomatica();
  renderEscala();
  updateMissing();
  closeOv('ov-miss');
  toast(`${row.Colaborador} adicionado à escala`);
}

/** Constrói filtro de meses na escala */
function buildMonthFilter() {
  const sel = $('esc-mes');
  if (!sel) return;
  const names = { '01':'Janeiro','02':'Fevereiro','03':'Março','04':'Abril','05':'Maio','06':'Junho','07':'Julho','08':'Agosto','09':'Setembro','10':'Outubro','11':'Novembro','12':'Dezembro' };
  sel.innerHTML = '<option value="">Todos</option>';
  MONTHS.forEach(m => {
    const o = document.createElement('option');
    o.value = m;
    o.textContent = (names[m] || m) + ' 2026';
    if (m === curMonth) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => { curMonth = sel.value; renderEscala(); };
}

/** Preenche selects de filtros */
function populateFilters() {
  fillSel('mop-st',   STATUS_OPTS);
  fillSel('mop-cel',  uniq(mopData, 'Célula'));
  fillSel('mop-rep',  uniq(mopData, 'Reporte'));
  fillSel('mop-tip',  uniq(mopData, 'Tipo'));
  fillSel('staff-st',  STATUS_OPTS);
  fillSel('staff-car', uniq(staffData, 'Cargo'));
  fillSel('staff-tip', uniq(staffData, 'Tipo'));
  fillSel('esc-st',   STATUS_OPTS);
  fillSel('esc-cel',  uniq([...mopData, ...staffData, ...escData], 'Célula'));
  fillSel('esc-tip',  uniq(escData, 'Tipo'));
}

/** Aplica programações de status agendadas */
function applyScheduledStatuses() {
  const today = new Date().toISOString().slice(0, 10);
  [...mopData, ...staffData, ...escData].forEach(row => {
    if (!row.Colaborador) return;
    const sched = schedData.find(s => s.colabName === row.Colaborador);
    if (!sched) { delete row._origStatus; return; }
    const active = sched.changes.find(c =>
      c.dateStart <= today && (!c.dateEnd || c.dateEnd >= today)
    );
    if (active) {
      if (!row._origStatus) row._origStatus = row.Status;
      row.Status = active.status;
    } else if (row._origStatus) {
      row.Status = row._origStatus;
      delete row._origStatus;
    }
  });
}

// =====================================================
// MODAIS
// =====================================================

let addTarget = 'mop'; // qual tabela está sendo adicionada

/** Abre modal de adicionar colaborador */
function openAddModal(target) {
  addTarget = target;
  const headers = target === 'staff' ? staffHeaders : mopHeaders;
  $('add-title').innerText = target === 'staff' ? 'Novo Staff' : 'Novo Colaborador';
  const grid = $('add-grid');
  grid.innerHTML = headers.map(col => {
    const isStatus = col === 'Status';
    const isDate   = isDateField(col);
    return `<div class="fgg">
      <label class="flb">${col}</label>
      ${isStatus
        ? `<select class="fi" id="new-${col}">${STATUS_OPTS.map(s => `<option>${s}</option>`).join('')}</select>`
        : isDate
          ? `<input type="date" class="fi" id="new-${col}">`
          : `<input type="text" class="fi" id="new-${col}" placeholder="${col}">`
      }
    </div>`;
  }).join('');
  openOv('ov-add');
}

/** Salva novo colaborador/staff */
function saveNew() {
  const headers = addTarget === 'staff' ? staffHeaders : mopHeaders;
  const row = { _id: Date.now() };
  let hasName = false;
  headers.forEach(col => {
    const el = $(`new-${col}`);
    if (el) {
      row[col] = el.value || '';
      if (col === 'Colaborador' && row[col]) hasName = true;
    }
  });
  if (!hasName) { toast('Nome do colaborador é obrigatório', 'var(--red)'); return; }

  if (addTarget === 'staff') {
    staffData.push(row);
    if (staffHeaders.length === 0) staffHeaders = Object.keys(row).filter(k => !k.startsWith('_'));
  } else {
    mopData.push(row);
    if (mopHeaders.length === 0) mopHeaders = Object.keys(row).filter(k => !k.startsWith('_'));
  }
  sincronizacaoAutomatica();
  atualizarInterface();
  populateFilters();
  closeOv('ov-add');
  toast(`✅ ${row.Colaborador} adicionado!`);
}

/** Abre modal de programação de status */
function openProgModal(editId = null) {
  const sel = $('prog-colab');
  sel.innerHTML = '<option value="">— selecione —</option>' +
    [...mopData, ...staffData].map(r => `<option>${r.Colaborador}</option>`).join('');

  $('sc-list').innerHTML = '';
  schedCount = 0;

  if (editId !== null) {
    const s = schedData.find(x => x.id === editId);
    if (s) {
      sel.value = s.colabName;
      s.changes.forEach(c => addScChange(c));
      progEditId = editId;
    }
  } else {
    progEditId = null;
    addScChange();
  }
  openOv('ov-prog');
}

let schedCount  = 0;
let progEditId  = null;

/** Adiciona linha de mudança no modal de prog */
function addScChange(prefill = null) {
  schedCount++;
  const div = document.createElement('div');
  div.className = 'sc-item';
  div.innerHTML = `
    <div class="sc-hd">
      <span style="font-size:12px;font-weight:600">Mudança #${schedCount}</span>
      <button class="btn btn-danger" onclick="this.closest('.sc-item').remove()">Remover</button>
    </div>
    <div class="sc-g">
      <div class="fgg"><label class="flb">Status</label>
        <select class="fi sc-ns">${STATUS_OPTS.map(s => `<option${prefill && prefill.status===s?' selected':''}>${s}</option>`).join('')}</select>
      </div>
      <div class="fgg"><label class="flb">Início</label>
        <input type="date" class="fi sc-ds" value="${prefill?.dateStart||''}">
      </div>
      <div class="fgg"><label class="flb">Fim</label>
        <input type="date" class="fi sc-de" value="${prefill?.dateEnd||''}">
      </div>
      <div class="sc-ret">
        <div class="fgg"><label class="flb">Retorno status</label>
          <select class="fi sc-rs"><option value="">—</option>${STATUS_OPTS.map(s => `<option${prefill?.returnStatus===s?' selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="fgg"><label class="flb">Data retorno</label>
          <input type="date" class="fi sc-rd" value="${prefill?.returnDate||''}">
        </div>
      </div>
    </div>`;
  $('sc-list').appendChild(div);
}

/** Salva programação de status */
function saveProg() {
  const colab = $('prog-colab').value;
  if (!colab) { toast('Selecione um colaborador', 'var(--red)'); return; }
  const changes = [];
  document.querySelectorAll('.sc-item').forEach(item => {
    const ns = item.querySelector('.sc-ns').value;
    const ds = item.querySelector('.sc-ds').value;
    const de = item.querySelector('.sc-de').value;
    const rs = item.querySelector('.sc-rs').value;
    const rd = item.querySelector('.sc-rd').value;
    if (ns && ds) changes.push({ status: ns, dateStart: ds, dateEnd: de || '', returnStatus: rs, returnDate: rd });
  });
  if (!changes.length) { toast('Adicione ao menos uma mudança', 'var(--red)'); return; }

  if (progEditId !== null) schedData = schedData.filter(s => s.id !== progEditId);
  schedData.push({ id: Date.now(), colabName: colab, changes });

  sincronizacaoAutomatica();
  applyScheduledStatuses();
  atualizarInterface();
  closeOv('ov-prog');
  toast('📅 Programação salva!');
}

function editProg(id) { openProgModal(id); }
function deleteProg(id) {
  if (confirm('Remover esta programação?')) {
    schedData = schedData.filter(s => s.id !== id);
    sincronizacaoAutomatica();
    renderProg();
    toast('Programação removida');
  }
}

// Day editor popup
let dayEditorRow = null, dayEditorCol = null;

function openDayEditor(row, col, anchorTd) {
  dayEditorRow = row;
  dayEditorCol = col;

  // Remove popup anterior
  document.querySelectorAll('.day-popup').forEach(el => el.remove());

  const popup = document.createElement('div');
  popup.className = 'day-popup';
  popup.style.cssText = `
    position:fixed; background:var(--sur); border:1px solid var(--brd);
    border-radius:10px; padding:12px; z-index:9999;
    box-shadow:0 8px 24px rgba(0,0,0,.6); min-width:180px;
    font-size:12px;
  `;
  popup.innerHTML = `
    <div style="font-weight:600;margin-bottom:8px;color:var(--acc)">${row.Colaborador} — ${col}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${STATUS_OPTS.map(s => `<button class="btn btn-sm" onclick="setDayVal('${s}',this.closest('.day-popup'))">${s}</button>`).join('')}
      <button class="btn btn-sm" style="background:var(--grn);color:#fff" onclick="setDayVal('C',this.closest('.day-popup'))">Trabalho</button>
    </div>
    <div style="margin-top:8px">
      <input type="text" class="fi" id="day-custom" placeholder="Valor manual (ex: M, 08:00)" value="${row[col]||''}">
      <button class="btn btn-pri btn-sm" style="margin-top:6px;width:100%" onclick="setDayCustom(this.closest('.day-popup'))">Confirmar</button>
    </div>`;

  // Posiciona próximo ao elemento
  const rect = anchorTd.getBoundingClientRect();
  popup.style.top  = Math.min(rect.bottom + 4, window.innerHeight - 200) + 'px';
  popup.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';

  document.body.appendChild(popup);
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 100);
}

function setDayVal(val, popup) {
  if (dayEditorRow && dayEditorCol) {
    dayEditorRow[dayEditorCol] = val;
    sincronizacaoAutomatica();
    renderEscala();
  }
  popup?.remove();
}

function setDayCustom(popup) {
  const val = popup.querySelector('#day-custom')?.value || '';
  setDayVal(val, popup);
}

// =====================================================
// NAVEGAÇÃO
// =====================================================

function switchTab(name) {
  curTab = name;
  ['mop', 'staff', 'escala', 'prog'].forEach(t => {
    $(`pnl-${t}`).style.display = t === name ? '' : 'none';
    $(`tab-${t}`).classList.toggle('on', t === name);
  });
}

function sortBy(tab, col) {
  if (sortC[tab] === col) sortD[tab] *= -1;
  else { sortC[tab] = col; sortD[tab] = 1; }
  if (tab === 'mop')    renderMop();
  if (tab === 'staff')  renderStaff();
  if (tab === 'escala') renderEscala();
}

// Modal helpers
function openOv(id)  { $(id).classList.add('on'); }
function closeOv(id) { $(id).classList.remove('on'); }

// Export para XLSX
function exportXLSX() {
  if (typeof XLSX === 'undefined') { toast('Biblioteca XLSX não disponível', 'var(--red)'); return; }
  const wb = XLSX.utils.book_new();
  const sheets = [
    { name: 'MOP',     data: mopData },
    { name: 'Staff',   data: staffData },
    { name: 'Escala',  data: escData },
    { name: 'Prog',    data: schedData.map(s => ({ colabName: s.colabName, mudancas: JSON.stringify(s.changes) })) }
  ];
  sheets.forEach(s => {
    if (s.data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(s.data.map(r => {
      const out = {};
      Object.keys(r).filter(k => !k.startsWith('_')).forEach(k => out[k] = r[k]);
      return out;
    }));
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  });
  XLSX.writeFile(wb, `MOP_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('📊 Exportado com sucesso!');
}

// =====================================================
// 8. BOOTSTRAP — INICIALIZAÇÃO
// =====================================================

document.addEventListener('DOMContentLoaded', () => {

  // Fechar modais pelo botão [data-close]
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.onclick = () => closeOv(btn.dataset.close);
  });

  // Fechar modal ao clicar fora
  document.querySelectorAll('.ov').forEach(ov => {
    ov.addEventListener('click', e => {
      if (e.target === ov) closeOv(ov.id);
    });
  });

  // Botão Sync manual
  $('btn-sync').onclick = salvarDados;

  // Botão Export
  $('btn-export').onclick = exportXLSX;

  // Botão add MOP
  $('btn-mop-add').onclick = () => openAddModal('mop');
  const btn2 = $('btn-mop-add2');
  if (btn2) btn2.onclick = () => openAddModal('mop');

  // Botão add Staff
  $('btn-staff-add').onclick = () => openAddModal('staff');
  const btn3 = $('btn-staff-add2');
  if (btn3) btn3.onclick = () => openAddModal('staff');

  // Salvar novo registro
  $('btn-add-save').onclick = saveNew;

  // Programações
  $('btn-prog-add').onclick = () => openProgModal();
  $('btn-sc-add').onclick   = () => addScChange();
  $('btn-prog-save').onclick = saveProg;

  // Sem escala
  $('btn-miss').onclick = showMissing;

  // Adicionar à escala
  $('btn-esc-add').onclick = () => {
    if (mopData.length === 0) { toast('Nenhum colaborador no MOP', 'var(--amb)'); return; }
    showMissing();
  };

  // Fill modal
  $('btn-fill-ok').onclick = () => {
    // Modal de edição de horários da escala
    const row = fillRow;
    if (!row) return;
    row.Horário = $('fi-hor').value || row.Horário;
    row.Horario = row.Horário;
    row['1º Pausa'] = $('fi-p1').value  || row['1º Pausa'];
    row.Almoço      = $('fi-alm').value || row.Almoço;
    row['2º Pausa'] = $('fi-p2').value  || row['2º Pausa'];
    row.Saida       = $('fi-sai').value || row.Saida;
    row.Tipo        = $('fi-tip').value  || row.Tipo;
    if ($('fi-adm').value) row.Admissão = $('fi-adm').value;
    sincronizacaoAutomatica();
    renderEscala();
    closeOv('ov-fill');
    toast('Horários atualizados');
  };

  // Filtros reativos
  const filterInputs = [
    'mop-q','mop-st','mop-cel','mop-rep','mop-tip',
    'staff-q','staff-st','staff-car','staff-tip',
    'esc-q','esc-st','esc-cel','esc-tip',
    'prog-q','prog-flt'
  ];
  filterInputs.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input',  () => atualizarInterface());
    el.addEventListener('change', () => atualizarInterface());
  });

  // Inicia carregamento dos dados
  carregarDados();
});

// Variável auxiliar para o modal de fill
let fillRow = null;
