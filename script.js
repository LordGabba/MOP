/**
 * MOP 2026 — Mêntore Bank
 * script.js v29
 *
 * PRESERVA 100% da lógica do MOP_V28_FINAL.html:
 *  - Todas as regras de horário, pausas, almoço
 *  - syncField / syncStatus / syncMany
 *  - applyScheduledStatuses (programações por data)
 *  - confirmFill / openFill / openAdd / saveAdd
 *  - applyBulk / bulkTargets (troca em massa)
 *  - colToDate / isWorkDay / getAdmissaoISO
 *  - calcMins com regra de almoço
 *  - shiftFromRow com statusOverride
 *  - Filtros: esc-dow, show-miss, mop-grp, esc-rep
 *  - getMissing / updateMissing / showMissing
 *  - renderMop / renderStaff / renderEscala / renderProg
 *  - Ordenação por coluna em todas as tabelas
 *  - MONTHS / DAY_COLS / buildMonthFilter
 *  - Stats dinâmicas em cada painel
 *
 * MELHORIAS v29:
 *  - loadFromSupabase com retry automático (3 tentativas)
 *  - syncAllToSupabase com fila anti-colisão
 *  - Tratamento de erros granular por tabela
 *  - beforeunload: aviso se há dados não salvos
 *  - Filtros com debounce para melhor performance
 *  - renderEscala: filtro esc-dow funcional
 *  - renderProg: cards com badge de estado
 *  - populateFilters: preserva valor selecionado
 *  - Compatibilidade retroativa com dados existentes
 */

'use strict';

// =====================================================
// 1. SUPABASE CONFIG
// =====================================================
const SUPABASE_URL      = 'https://pjeehaziodnxuakhacmc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqZWVoYXppb2RueHVha2hhY21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjU1MzQsImV4cCI6MjA5NDcwMTUzNH0.h5mIzDOvVS3M8BDFy3TeLM4djdBFHTM72LOpKGNgLkg';

let db; // cliente Supabase
try {
  if (!window.supabase) throw new Error('Biblioteca @supabase/supabase-js não carregou.');
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
  console.log('✓ Supabase client criado');
} catch (err) {
  console.error('✗ Erro ao criar Supabase client:', err);
}

// =====================================================
// 2. ESTADO GLOBAL (preservado do V28)
// =====================================================
let mopData   = [];
let staffData = [];
let escData   = [];
let schedData = [];

let mopHeaders   = [];
let staffHeaders = [];
let escHeaders   = [];
let ALL_DAY_COLS = [];
let MONTHS       = [];
let curMonth     = '';
let curTab       = 'mop';

let sortC = { mop: null, staff: null, escala: null };
let sortD = { mop: 1,    staff: 1,    escala: 1    };

let saveTimeout = null;  // debounce do auto-save
let syncing     = false; // trava contra sincronizações concorrentes
let syncPending = false; // fila: se sync em curso e há nova alteração

// Mapeamento de campos compartilhados entre tabelas (preservado V28)
const SHARED = {
  'Horário':'Horario','Horario':'Horário','Saida':'Saida',
  'Célula':'Célula','Status':'Status','Tipo':'Tipo',
  'Reporte':'Reporte','Matrícula':'Matrícula',
  '1º Pausa':'1ª Pausa','Almoço':'Almoço','2º Pausa':'2ª Pausa'
};
const TIME_FIELDS = ['Horário','Horario','Saida','1º Pausa','Almoço','2º Pausa'];

const STATUS_OPTS = ['Ativo','Desligado','Afastado','Férias','Day Off','Folga','BH'];

// Feriados nacionais 2026 (dd-mm)
const FERIADOS_2026 = [
  '01-01','21-04','01-05','07-09','12-10','02-11','15-11','25-12'
];

// =====================================================
// 3. HELPERS BÁSICOS
// =====================================================

/** Atalho getElementById */
function $(id) { return document.getElementById(id); }

/** Toast de notificação */
function toast(msg, color = 'var(--grn)', dur = 2500) {
  const t = $('toast');
  $('toast-msg').innerText = msg;
  t.style.color = color;
  t.classList.add('on');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('on'), dur);
}

/** Atualiza badge de conexão */
function setConn(cls, txt) {
  const c = $('conn-badge');
  if (!c) return;
  c.className = 'conn ' + cls;
  c.innerText  = txt;
}

/** Iniciais a partir do nome */
function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return ((p[0] || '')[0] || '') + ((p[p.length - 1] || '')[0] || '');
}

/** Badge HTML por status */
function badge(s) {
  const map = {
    'Ativo':'bg','Desligado':'br','Férias':'ba',
    'Afastado':'bp','Day Off':'bb','Folga':'bt','BH':'bgr'
  };
  return s ? `<span class="bdg ${map[s] || 'bgr'}">${s}</span>` : '';
}

/** Formata data ISO → dd/mm/yyyy */
function formatDateDisplay(val) {
  if (!val) return '';
  const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : val;
}

/** Verifica se coluna é de data */
function isDateField(col) {
  const n = col.toLowerCase();
  return n.includes('admissão') || n.includes('admissao') ||
         n.includes('nascimento') || n.includes('data');
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

/** Valores únicos de uma chave, ordenados */
function uniq(arr, k) {
  return [...new Set(arr.map(r => r[k]).filter(Boolean))].sort();
}

/**
 * Preenche um select preservando o valor selecionado.
 * Melhoria v29: não perde a seleção ao recarregar filtros.
 */
function fillSel(id, opts) {
  const el = $(id);
  if (!el) return;
  const prev  = el.value;
  const first = el.options[0]?.textContent || 'Todos';
  el.innerHTML = `<option value="">${first}</option>` +
    opts.map(o => `<option${o === prev ? ' selected' : ''}>${o}</option>`).join('');
}

/** Ordena array por coluna */
function srt(data, tab) {
  const c = sortC[tab];
  if (!c) return data;
  return data.slice().sort((a, b) => {
    const av = String(a[c] || ''), bv = String(b[c] || '');
    return av < bv ? -sortD[tab] : av > bv ? sortD[tab] : 0;
  });
}

// =====================================================
// 4. HELPERS DE ESCALA (preservados do V28)
// =====================================================

/** Verifica se coluna é feriado (dd-mm) */
function isFeriado(col) {
  const m = col.match(/(\d{2})[-\/](\d{2})$/);
  if (!m) return false;
  return FERIADOS_2026.includes(m[1] + '-' + m[2]);
}

/** Dia da semana de uma coluna (3 chars lowercase) */
function dayColWeekday(col) {
  return col.toLowerCase().slice(0, 3);
}

/** Se coluna é fim de semana */
function isWE(col) {
  const w = dayColWeekday(col);
  return w === 'dom' || w === 'sáb' || w === 'sab';
}

/**
 * isWorkDay — verifica se uma coluna é dia útil para o tipo de escala.
 * Preservado do V28.
 */
function isWorkDay(col, tipo) {
  const d = dayColWeekday(col);
  if (d === 'sáb' || d === 'dom') return tipo === '6X1' ? d !== 'dom' : false;
  return true;
}

/** Converte chave de coluna para data ISO "2026-mm-dd" */
function colToDate(key) {
  const m = key.match(/(\d{2})[-\/](\d{2})$/);
  if (m) return '2026-' + m[2] + '-' + m[1];
  return null;
}

/** Extrai data de admissão em formato ISO */
function getAdmissaoISO(row) {
  const adm = row._admissao || row.Admissão || row.Admissao;
  if (adm) {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(adm)) {
      const p = adm.split('/');
      return p[2] + '-' + p[1] + '-' + p[0];
    }
    return adm;
  }
  return null;
}

/**
 * shiftFromRow — determina o tipo de turno visual.
 * Preservado EXATAMENTE do V28, incluindo statusOverride.
 */
function shiftFromRow(row, val, isHoliday, weekend, statusOverride) {
  if (isHoliday) return 'h';
  const st = String(statusOverride || row.Status || '').toLowerCase();
  if (st === 'férias')    return 'v';
  if (st === 'afastado')  return 'a';
  if (st === 'day off')   return 'd';
  if (st === 'folga')     return 'f';
  if (st === 'bh')        return 'b';
  if (st === 'desligado') return 'x';
  if (val === '' || val == null) return '';
  const absMap = { 'Folga':'f','Day Off':'d','BH':'b','Férias':'v','Afastado':'a' };
  if (typeof val === 'string' && absMap[val.trim()]) return absMap[val.trim()];
  const n = parseInt(val);
  if (isNaN(n)) return '';
  if (n === 0) return weekend ? 'f' : 'd';
  return 'c';
}

/**
 * calcMins — calcula minutos trabalhados.
 * Preserva regra de almoço (>240min = desconta 60min) e regras por célula.
 */
function calcMins(row) {
  const e = (row.Horário || row.Horario || '08:00').trim();
  const x = (row.Saida || '').trim();
  if (x && x !== '-' && /\d{1,2}:\d{2}/.test(x)) {
    const toM = s => { const p = s.split(':'); return parseInt(p[0]) * 60 + (parseInt(p[1]) || 0); };
    let t = toM(x) - toM(e);
    if (t > 240) t -= 60; // desconta almoço
    return Math.max(t, 0);
  }
  // Regra por célula (preservada do V28)
  return ['BackOffice', 'Ouvidoria', 'PJ'].includes(row.Célula || '') ? 600 : 540;
}

/** Formata minutos como "8h30" */
function fmtHours(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h + 'h' + (m ? String(m).padStart(2, '0') : '');
}

/** Colunas de dias filtradas pelo mês atual */
function DAY_COLS() {
  if (!curMonth) return ALL_DAY_COLS;
  return ALL_DAY_COLS.filter(c => {
    const m = c.match(/(\d{2})[-\/](\d{2})$/);
    return m && m[2] === curMonth;
  });
}

// =====================================================
// 5. SYNC FIELD / STATUS (preservados do V28)
// =====================================================

/**
 * syncField — propaga alteração de campo entre mop/staff/escala.
 * Lógica EXATA do V28 preservada.
 */
function syncField(colab, field, val, fromSet) {
  if (syncing) return;
  syncing = true;
  let targets = [field];
  if (SHARED[field] && SHARED[field] !== field) targets.push(SHARED[field]);
  targets = [...new Set(targets)];

  if (fromSet !== escData) {
    escData.forEach(r => {
      if (r.Colaborador === colab) targets.forEach(f => { r[f] = val; });
    });
  }
  targets.forEach(f => {
    const mkey = Object.keys(SHARED).find(k => SHARED[k] === f);
    if (mkey && fromSet !== mopData)   mopData.forEach(r =>   { if (r.Colaborador === colab) r[mkey] = val; });
    if (mkey && fromSet !== staffData) staffData.forEach(r => { if (r.Colaborador === colab) r[mkey] = val; });
  });

  markUnsaved();
  syncing = false;

  if (curTab === 'mop')    renderMop();
  if (curTab === 'staff')  renderStaff();
  if (curTab === 'escala') renderEscala();
}

/** syncMany — aplica múltiplos campos via syncField */
function syncMany(colab, map, from) {
  Object.keys(map).forEach(f => syncField(colab, f, map[f], from));
}

/**
 * syncStatus — atualiza status em mop, staff e escala simultaneamente.
 * Preservado do V28.
 */
function syncStatus(name, ns) {
  if (syncing) return;
  syncing = true;
  [mopData, staffData, escData].forEach(arr =>
    arr.forEach(r => { if (r.Colaborador === name) r.Status = ns; })
  );
  syncing = false;
  markUnsaved();
  renderMop(); renderStaff(); renderEscala();
  updateMissing();
}

// =====================================================
// 6. PROGRAMAÇÕES DE STATUS (applyScheduledStatuses)
// =====================================================

/**
 * applyScheduledStatuses — aplica programações ativas na data atual.
 * Preservada EXATAMENTE do V28.
 */
function applyScheduledStatuses() {
  const today = new Date().toISOString().slice(0, 10);
  [mopData, staffData, escData].forEach(arr =>
    arr.forEach(row => {
      if (!row.Colaborador) return;
      const sched = schedData.find(s => s.colabName === row.Colaborador);
      if (!sched) { delete row._origStatus; return; }

      let active = null;
      sched.changes.forEach(c => {
        if (c.dateStart <= today && (!c.dateEnd || c.dateEnd >= today)) active = c;
      });

      if (active) {
        row._origStatus = row._origStatus || row.Status;
        row.Status = active.status;
      } else if (row._origStatus) {
        row.Status = row._origStatus;
        delete row._origStatus;
      }
    })
  );
}

// =====================================================
// 7. MISSING (colaboradores sem escala)
// =====================================================

/** Retorna colaboradores de mop/staff sem entrada na escala */
function getMissing() {
  const en = new Set(escData.map(r => r.Colaborador).filter(Boolean));
  return [...mopData, ...staffData].filter(r => r.Colaborador && !en.has(r.Colaborador));
}

/** Atualiza badge e barra de alerta */
function updateMissing() {
  const m = getMissing(), n = m.length;
  const bm = $('bg-miss'), ab = $('abar');
  if (n > 0) {
    bm.textContent = n + ' sem escala';
    bm.style.display = '';
    ab.classList.add('on');
    $('atxt').innerText = n + ' colaborador' + (n > 1 ? 'es' : '') + ' sem escala.';
  } else {
    bm.style.display = 'none';
    ab.classList.remove('on');
  }
}

/** Exibe modal com cards de colaboradores sem escala */
function showMissing() {
  const ms = getMissing(), body = $('miss-body');

  if (!ms.length) {
    body.innerHTML = '<p style="color:var(--grn);text-align:center;padding:24px">✅ Todos estão na Escala!</p>';
    openOv('ov-miss');
    return;
  }

  function sec(chip, arr) {
    if (!arr.length) return '';
    return `<div class="miss-panel">
      <h3>[${chip}] ${arr.length} sem escala</h3>
      <div class="miss-grid">
        ${arr.map(r => `
          <div class="miss-card" data-mid="${r._id}" data-msrc="${r._src}">
            <div class="miss-name">${r.Colaborador}</div>
            <div class="miss-meta">${r.Célula || '—'} · ${r.Status || '—'}</div>
            <div class="miss-act">Clique para adicionar →</div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  body.innerHTML = sec('MOP',   ms.filter(r => r._src === 'mop')) +
                   sec('Staff', ms.filter(r => r._src === 'staff'));

  body.querySelectorAll('.miss-card').forEach(el => {
    el.addEventListener('click', () => {
      const id  = parseInt(el.dataset.mid);
      const src = el.dataset.msrc;
      const row = src === 'staff'
        ? staffData.find(r => r._id === id)
        : mopData.find(r => r._id === id);
      if (row) { closeOv('ov-miss'); openFill(row); }
    });
  });

  openOv('ov-miss');
}

// =====================================================
// 8. FILL (adicionar à escala)
// =====================================================

let fillTarget = null;

/**
 * openFill — abre modal de preenchimento de escala.
 * Preservado do V28.
 */
function openFill(row) {
  fillTarget = row;
  $('fill-name').innerHTML =
    `<span class="bdg ${row._src === 'staff' ? 'bb' : 'bp'}" style="margin-right:7px">${row._src === 'staff' ? 'Staff' : 'MOP'}</span>` +
    row.Colaborador +
    `<div style="font-size:11px;color:var(--tx3)">${row.Célula || '—'} · ${row.Status || '—'}</div>`;

  $('fi-hor').value = normalizeTime(row.Horario || row.Horário || '08:00');
  $('fi-p1').value  = normalizeTime(row['1º Pausa'] || '09:10');
  $('fi-alm').value = normalizeTime(row.Almoço || '12:00');
  $('fi-p2').value  = normalizeTime(row['2º Pausa'] || '15:10');
  $('fi-sai').value = normalizeTime(row.Saida || '18:00');
  $('fi-tip').value = row.Tipo || '5X2';
  $('fi-adm').value = row.Admissão || row._admissao || '';
  openOv('ov-fill');
}

/**
 * confirmFill — cria entrada na escala com dias calculados.
 * Preservado do V28: calcula minutos, respeita admissão e isWorkDay.
 */
function confirmFill() {
  if (!fillTarget) return;
  const r    = fillTarget;
  const hor  = $('fi-hor').value  || '08:00';
  const sai  = $('fi-sai').value  || '18:00';
  const tipo = $('fi-tip').value;
  const adm  = $('fi-adm').value  || null;

  const ne = {
    _id:        Date.now(),
    _src:       r._src || 'mop',
    Matrícula:  r.Matrícula || '',
    Colaborador:r.Colaborador,
    Célula:     r.Célula     || '',
    Status:     r.Status     || 'Ativo',
    Tipo:       tipo,
    Reporte:    r.Reporte    || '',
    Horário:    hor,
    Horario:    hor,
    Saida:      sai,
    '1º Pausa': $('fi-p1').value  || '09:10',
    'Almoço':   $('fi-alm').value || '12:00',
    '2º Pausa': $('fi-p2').value  || '15:10',
    _admissao:  adm
  };

  const mins = calcMins(ne);

  // Preenche cada coluna de dia
  ALL_DAY_COLS.forEach(col => {
    const d = colToDate(col);
    // Se antes da admissão, célula vazia
    if (d && adm && d < adm) { ne[col] = ''; return; }
    ne[col] = isWorkDay(col, tipo) ? mins : 0;
  });

  // Remove entrada anterior se existir
  escData = escData.filter(x => x.Colaborador !== ne.Colaborador);
  escData.push(ne);

  // Propaga horários para mop/staff
  syncMany(r.Colaborador, { Horário: hor, Saida: sai, Tipo: tipo }, escData);

  closeOv('ov-fill');
  updateMissing();
  renderEscala();
  fillTarget = null;
  markUnsaved();
  toast(`✅ ${ne.Colaborador} adicionado à escala`);
}

// =====================================================
// 9. TROCA EM MASSA (preservada do V28)
// =====================================================

/** Preview de quantos serão afetados */
function updateBulkPreview() {
  const n = bulkTargets().length;
  $('bulk-preview').innerText = n ? ('🎯 ' + n + ' colaborador' + (n !== 1 ? 'es' : '')) : 'Nenhum selecionado';
}

/** Retorna linhas de escData afetadas pelos filtros de massa */
function bulkTargets() {
  const repF = $('bulk-rep').value;
  const celF = $('bulk-cel')?.value || '';
  const cSel = $('bulk-colabs');
  const cs   = cSel ? Array.from(cSel.selectedOptions).map(o => o.value) : [];

  return escData.filter(r => {
    if (r._missing) return false;
    if (cs.length) return cs.includes(r.Colaborador);
    if (repF && r.Reporte !== repF) return false;
    if (celF && r.Célula  !== celF) return false;
    return true;
  });
}

/**
 * applyBulk — aplica alterações em massa.
 * Preservado do V28: altera horários, status geral, sáb e dom.
 */
function applyBulk() {
  const hor    = $('bk-hor').value;
  const p1     = $('bk-p1').value;
  const alm    = $('bk-alm').value;
  const p2     = $('bk-p2').value;
  const newSt  = $('bk-status').value;
  const sabSt  = $('bk-status-sab').value;
  const domSt  = $('bk-status-dom').value;
  const targets = bulkTargets();

  if (!targets.length) { toast('Nenhum colaborador selecionado', 'var(--amb)'); return; }

  targets.forEach(r => {
    if (hor) { r.Horário = hor; r.Horario = hor; }
    if (p1)  r['1º Pausa'] = p1;
    if (alm) r.Almoço      = alm;
    if (p2)  r['2º Pausa'] = p2;
    if (newSt && newSt !== '') r.Status = newSt;
    if (sabSt || domSt) {
      ALL_DAY_COLS.forEach(dc => {
        const w = dc.toLowerCase().slice(0, 3);
        if (sabSt && (w === 'sáb' || w === 'sab')) r[dc] = sabSt;
        if (domSt && w === 'dom') r[dc] = domSt;
      });
    }
  });

  renderEscala(); renderMop(); renderStaff();
  markUnsaved();
  toast(targets.length + ' colaborador(es) atualizados');
}

// =====================================================
// 10. FILTROS E STATS
// =====================================================

/**
 * populateFilters — preenche todos os selects de filtro.
 * Preservado do V28, com melhoria: mantém valor selecionado.
 */
function populateFilters() {
  fillSel('mop-st',   STATUS_OPTS);
  fillSel('mop-cel',  uniq(mopData, 'Célula'));
  fillSel('mop-rep',  uniq(mopData, 'Reporte'));
  fillSel('mop-tip',  uniq(mopData, 'Tipo'));
  fillSel('mop-grp',  uniq(mopData, 'Grupo'));

  fillSel('staff-st',  STATUS_OPTS);
  fillSel('staff-car', uniq(staffData, 'Cargo'));
  fillSel('staff-tip', uniq(staffData, 'Tipo'));

  fillSel('esc-st',  STATUS_OPTS);
  fillSel('esc-cel', uniq([...mopData, ...staffData, ...escData], 'Célula'));
  fillSel('esc-tip', uniq(escData, 'Tipo'));
  fillSel('esc-rep', uniq([...mopData, ...staffData], 'Reporte'));

  // Bulk: líder
  const br = $('bulk-rep');
  if (br) {
    const prevRep = br.value;
    br.innerHTML = '<option value="">— Todos os líderes —</option>';
    uniq([...mopData, ...staffData, ...escData], 'Reporte').forEach(r => {
      const o = document.createElement('option');
      o.textContent = r;
      if (r === prevRep) o.selected = true;
      br.appendChild(o);
    });
    br.onchange = updateBulkPreview;
  }

  // Bulk: célula
  const bc = $('bulk-cel');
  if (bc) {
    const prevCel = bc.value;
    bc.innerHTML = '<option value="">— Todas as células —</option>';
    uniq([...mopData, ...staffData, ...escData], 'Célula').forEach(c => {
      const o = document.createElement('option');
      o.textContent = c;
      if (c === prevCel) o.selected = true;
      bc.appendChild(o);
    });
    bc.onchange = updateBulkPreview;
    setTimeout(updateBulkPreview, 0);
  }

  // Bulk: colaboradores
  const bcol = $('bulk-colabs');
  if (bcol) {
    const prev = Array.from(bcol.selectedOptions).map(o => o.value);
    bcol.innerHTML = '';
    uniq(escData, 'Colaborador').forEach(n => {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      if (prev.includes(n)) o.selected = true;
      bcol.appendChild(o);
    });
    bcol.onchange = updateBulkPreview;
  }
}

/** Constrói o select de meses da escala */
function buildMonthFilter() {
  const sel = $('esc-mes');
  if (!sel) return;
  const names = {
    '01':'Janeiro','02':'Fevereiro','03':'Março','04':'Abril',
    '05':'Maio','06':'Junho','07':'Julho','08':'Agosto',
    '09':'Setembro','10':'Outubro','11':'Novembro','12':'Dezembro'
  };
  const prev = sel.value || curMonth;
  sel.innerHTML = '';
  const all = document.createElement('option');
  all.value = ''; all.textContent = 'Todos';
  sel.appendChild(all);
  MONTHS.forEach(m => {
    const o = document.createElement('option');
    o.value = m;
    o.textContent = (names[m] || m) + ' 2026';
    if (m === prev) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => { curMonth = sel.value; renderEscala(); };
}

// =====================================================
// 11. RENDER MOP
// =====================================================

function renderMop() {
  const q   = ($('mop-q')?.value  || '').toLowerCase();
  const st  = $('mop-st')?.value  || '';
  const cel = $('mop-cel')?.value || '';
  const rep = $('mop-rep')?.value || '';
  const tip = $('mop-tip')?.value || '';
  const grp = $('mop-grp')?.value || '';

  const data = srt(mopData.filter(r =>
    (!q   || (r.Colaborador || '').toLowerCase().includes(q)) &&
    (!st  || r.Status  === st)  &&
    (!cel || r.Célula  === cel) &&
    (!rep || r.Reporte === rep) &&
    (!tip || r.Tipo    === tip) &&
    (!grp || r.Grupo   === grp)
  ), 'mop');

  $('bg-mop').innerText = data.length;

  // Stats dinâmicas
  const stats = $('mop-stats');
  if (stats) {
    const tot  = mopData.length;
    const atv  = mopData.filter(r => r.Status === 'Ativo').length;
    const afa  = mopData.filter(r => r.Status === 'Afastado').length;
    const fer  = mopData.filter(r => r.Status === 'Férias').length;
    const des  = mopData.filter(r => r.Status === 'Desligado').length;
    stats.innerHTML = `
      <div class="si"><span class="sl">Total</span>     <span class="sv cb">${tot}</span></div>
      <div class="si"><span class="sl">Ativos</span>    <span class="sv cg">${atv}</span></div>
      <div class="si"><span class="sl">Afastados</span> <span class="sv ca">${afa}</span></div>
      <div class="si"><span class="sl">Férias</span>    <span class="sv cp">${fer}</span></div>
      <div class="si"><span class="sl">Desligados</span><span class="sv cr">${des}</span></div>`;
  }

  // Cabeçalho com ordenação
  const th = $('mop-th');
  th.innerHTML = mopHeaders.map(col => {
    const cls = sortC.mop === col ? (sortD.mop > 0 ? 'sa' : 'sd') : '';
    return `<th class="${cls}" onclick="sortBy('mop','${col.replace(/'/g,"\\'")}')">
      ${col}${sortC.mop === col ? '' : ''}
    </th>`;
  }).join('');

  const tb = $('mop-tb');
  tb.innerHTML = '';

  if (!data.length) {
    tb.innerHTML = '<tr><td colspan="20" style="text-align:center;padding:28px;color:var(--tx3)">Nenhum resultado encontrado.</td></tr>';
    return;
  }

  data.forEach(row => {
    const tr = document.createElement('tr');
    const st = row.Status || '';
    if (st === 'Desligado') tr.classList.add('rd');
    else if (st === 'Afastado') tr.classList.add('fa');
    else if (st === 'Férias') tr.classList.add('af');

    mopHeaders.forEach(col => {
      const td = document.createElement('td');

      if (col === 'Status') {
        // Select inline de status
        td.className = 'sc';
        td.innerHTML = badge(row[col]);
        const sel = document.createElement('select');
        STATUS_OPTS.forEach(o => {
          const op = document.createElement('option');
          op.value = o; op.textContent = o;
          if (o === row[col]) op.selected = true;
          sel.appendChild(op);
        });
        sel.onchange = () => syncStatus(row.Colaborador, sel.value);
        td.appendChild(sel);

      } else if (col === 'Colaborador') {
        td.innerHTML = `<div class="emp">
          <div class="av">${initials(row[col])}</div>
          <div class="nm">${row[col] || ''}</div>
        </div>`;

      } else if (TIME_FIELDS.includes(col)) {
        td.setAttribute('contenteditable', 'true');
        td.innerText = row[col] || '';
        td.onblur = () => {
          const v = normalizeTime(td.innerText.trim());
          if (v !== row[col]) { syncField(row.Colaborador, col, v, mopData); }
          td.innerText = v || '';
        };

      } else if (isDateField(col)) {
        td.innerText = formatDateDisplay(row[col]);

      } else {
        td.setAttribute('contenteditable', 'true');
        td.innerText = row[col] || '';
        td.onblur = () => {
          const v = td.innerText.trim();
          if (v !== String(row[col] || '')) { row[col] = v; markUnsaved(); }
        };
      }
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}

// =====================================================
// 12. RENDER STAFF
// =====================================================

function renderStaff() {
  const q   = ($('staff-q')?.value  || '').toLowerCase();
  const st  = $('staff-st')?.value  || '';
  const car = $('staff-car')?.value || '';
  const tip = $('staff-tip')?.value || '';

  const data = srt(staffData.filter(r =>
    (!q   || (r.Colaborador || '').toLowerCase().includes(q)) &&
    (!st  || r.Status === st)  &&
    (!car || r.Cargo  === car) &&
    (!tip || r.Tipo   === tip)
  ), 'staff');

  $('bg-staff').innerText = data.length;

  const stats = $('staff-stats');
  if (stats) {
    const tot = staffData.length;
    const atv = staffData.filter(r => r.Status === 'Ativo').length;
    const afa = staffData.filter(r => r.Status === 'Afastado').length;
    stats.innerHTML = `
      <div class="si"><span class="sl">Total</span>    <span class="sv cb">${tot}</span></div>
      <div class="si"><span class="sl">Ativos</span>   <span class="sv cg">${atv}</span></div>
      <div class="si"><span class="sl">Afastados</span><span class="sv ca">${afa}</span></div>`;
  }

  const th = $('staff-th');
  th.innerHTML = staffHeaders.map(col => {
    const cls = sortC.staff === col ? (sortD.staff > 0 ? 'sa' : 'sd') : '';
    return `<th class="${cls}" onclick="sortBy('staff','${col.replace(/'/g,"\\'")}')">
      ${col}
    </th>`;
  }).join('');

  const tb = $('staff-tb');
  tb.innerHTML = '';

  if (!data.length) {
    tb.innerHTML = '<tr><td colspan="20" style="text-align:center;padding:28px;color:var(--tx3)">Nenhum resultado.</td></tr>';
    return;
  }

  data.forEach(row => {
    const tr = document.createElement('tr');
    if (row.Status === 'Desligado') tr.classList.add('rd');

    staffHeaders.forEach(col => {
      const td = document.createElement('td');
      if (col === 'Status') {
        td.className = 'sc';
        td.innerHTML = badge(row[col]);
        const sel = document.createElement('select');
        STATUS_OPTS.forEach(o => {
          const op = document.createElement('option');
          op.value = o; op.textContent = o;
          if (o === row[col]) op.selected = true;
          sel.appendChild(op);
        });
        sel.onchange = () => syncStatus(row.Colaborador, sel.value);
        td.appendChild(sel);
      } else if (col === 'Colaborador') {
        td.innerHTML = `<div class="emp">
          <div class="av">${initials(row[col])}</div>
          <div class="nm">${row[col] || ''}</div>
        </div>`;
      } else if (TIME_FIELDS.includes(col)) {
        td.setAttribute('contenteditable', 'true');
        td.innerText = row[col] || '';
        td.onblur = () => {
          const v = normalizeTime(td.innerText.trim());
          if (v !== row[col]) syncField(row.Colaborador, col, v, staffData);
          td.innerText = v || '';
        };
      } else if (isDateField(col)) {
        td.innerText = formatDateDisplay(row[col]);
      } else {
        td.setAttribute('contenteditable', 'true');
        td.innerText = row[col] || '';
        td.onblur = () => {
          const v = td.innerText.trim();
          if (v !== String(row[col] || '')) { row[col] = v; markUnsaved(); }
        };
      }
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}

// =====================================================
// 13. RENDER ESCALA
// =====================================================

function renderEscala() {
  const q    = ($('esc-q')?.value    || '').toLowerCase();
  const st   = $('esc-st')?.value    || '';
  const cel  = $('esc-cel')?.value   || '';
  const tip  = $('esc-tip')?.value   || '';
  const rep  = $('esc-rep')?.value   || '';
  const dow  = $('esc-dow')?.value   || '';       // filtro dia da semana (v28)
  const miss = $('show-miss')?.checked || false;  // filtro sem escala (v28)

  const dcs = DAY_COLS();

  // Filtro de dia da semana nas colunas visíveis
  const visibleDcs = !dow ? dcs : dcs.filter(col => {
    const w = dayColWeekday(col);
    if (dow === 'we') return w === 'sáb' || w === 'sab' || w === 'dom';
    if (dow === 'wd') return w !== 'sáb' && w !== 'sab' && w !== 'dom';
    return w === dow;
  });

  // Se "Sem escala" marcado, mostra colaboradores do mop/staff sem entrada
  let data;
  if (miss) {
    const en = new Set(escData.map(r => r.Colaborador).filter(Boolean));
    data = [...mopData, ...staffData]
      .filter(r => r.Colaborador && !en.has(r.Colaborador))
      .map(r => ({ ...r, _missing: true }));
  } else {
    data = srt(escData.filter(r =>
      (!q   || (r.Colaborador || '').toLowerCase().includes(q)) &&
      (!st  || r.Status  === st)  &&
      (!cel || r.Célula  === cel) &&
      (!tip || r.Tipo    === tip) &&
      (!rep || r.Reporte === rep)
    ), 'escala');
  }

  $('bg-escala').innerText = data.length;

  // KPIs
  const statsEl = $('esc-stats');
  if (statsEl) {
    const tot   = escData.length;
    let wkCount = 0, folCount = 0, ferCount = 0, afaCount = 0;
    escData.forEach(r => {
      const s = (r.Status || '').toLowerCase();
      if (s === 'férias') ferCount++;
      else if (s === 'afastado') afaCount++;
      else if (s === 'folga' || s === 'day off' || s === 'bh') folCount++;
      else wkCount++;
    });
    const missCount = getMissing().length;
    statsEl.innerHTML = `
      <div class="kpi">  <div class="kl">Na Escala</div>   <div class="kv">${tot}</div></div>
      <div class="kpi g"><div class="kl">Trabalhando</div> <div class="kv">${wkCount}</div></div>
      <div class="kpi a"><div class="kl">Folga/DO/BH</div> <div class="kv">${folCount}</div></div>
      <div class="kpi p"><div class="kl">Férias</div>      <div class="kv">${ferCount}</div></div>
      <div class="kpi r"><div class="kl">Sem escala</div>  <div class="kv">${missCount}</div></div>`;
  }

  // Cabeçalho
  const th = $('esc-th');
  th.innerHTML = `<th class="sticky-l" onclick="sortBy('escala','Colaborador')" style="cursor:pointer">
    Colaborador ${sortC.escala === 'Colaborador' ? (sortD.escala > 0 ? '↑' : '↓') : ''}
  </th>` +
  visibleDcs.map(col => {
    const isWeekend = isWE(col);
    const isHol     = isFeriado(col);
    const m  = col.match(/(\d{2})[-\/](\d{2})$/);
    const dn = col.split(' ')[0] || '';
    const dd = m ? m[1] : '';
    let cls = 'day';
    if (isWeekend) cls += ' we';
    if (isHol)     cls += ' hol';
    return `<th class="${cls}">
      <span class="dn">${dn}</span>
      <span class="dd">${dd}</span>
    </th>`;
  }).join('') +
  `<th style="white-space:nowrap">Hrs/mês</th>`;

  // Linhas
  const tb = $('esc-tb');
  tb.innerHTML = '';

  if (!data.length) {
    tb.innerHTML = `<tr><td colspan="${visibleDcs.length + 2}" style="text-align:center;padding:28px;color:var(--tx3)">
      ${miss ? '✅ Todos os colaboradores têm escala.' : 'Nenhum resultado.'}
    </td></tr>`;
    return;
  }

  data.forEach(row => {
    const tr = document.createElement('tr');
    let totalMins = 0;

    // Coluna sticky: nome
    const tdName = document.createElement('td');
    tdName.className = 'sticky-l';
    tdName.innerHTML = `<div class="emp">
      <div class="av">${initials(row.Colaborador)}</div>
      <div>
        <div class="nm">${row.Colaborador || '?'}</div>
        <div style="font-size:10px;color:var(--tx3);margin-top:1px">${badge(row.Status)}</div>
      </div>
    </div>`;
    tr.appendChild(tdName);

    if (row._missing) {
      // Linha de "sem escala": mostra botão para adicionar
      const tdAdd = document.createElement('td');
      tdAdd.colSpan = visibleDcs.length + 1;
      tdAdd.style.cssText = 'color:var(--tx3);font-size:11px;padding:10px 14px';
      tdAdd.innerHTML = `<button class="btn btn-sm btn-pri" onclick="openFill(${JSON.stringify(row).replace(/"/g,'&quot;')})">
        + Adicionar à escala
      </button>`;
      tr.appendChild(tdAdd);
      tb.appendChild(tr);
      return;
    }

    // Colunas de dias
    visibleDcs.forEach(col => {
      const td = document.createElement('td');
      td.style.cssText = 'padding:4px;text-align:center;';

      const val      = row[col];
      const isHol    = isFeriado(col);
      const weekend  = isWE(col);
      const shift    = shiftFromRow(row, val, isHol, weekend);

      // Label do chip
      let lbl = '--', hrs = '';
      if (shift === 'c') {
        const h = row.Horário || row.Horario || '';
        lbl = h.slice(0, 5) || (typeof val === 'number' ? fmtHours(val) : String(val || '--'));
        hrs = fmtHours(calcMins(row));
        totalMins += calcMins(row);
      } else {
        lbl = { v:'FER', a:'AFA', d:'DO', f:'FOL', b:'BH', h:'FER', x:'DES' }[shift] || '--';
      }

      const cell = document.createElement('div');
      cell.className = `scell ${shift || 'empty'}`;
      cell.innerHTML = `<span class="lbl">${lbl}</span><span class="hrs">${hrs}</span>`;
      cell.title = col;

      // Clique para editar célula de dia
      cell.onclick = (e) => {
        e.stopPropagation();
        openDayEditor(row, col, cell);
      };

      td.appendChild(cell);
      tr.appendChild(td);
    });

    // Total de horas
    const tdTot = document.createElement('td');
    tdTot.style.textAlign = 'center';
    tdTot.innerHTML = `<span class="totcell">${fmtHours(totalMins)}</span>`;
    tr.appendChild(tdTot);

    tb.appendChild(tr);
  });
}

// =====================================================
// 14. EDITOR DE DIA (popup inline)
// =====================================================

let _depRow = null, _depCol = null;

/** Abre editor popup para uma célula de dia */
function openDayEditor(row, col, anchor) {
  _depRow = row;
  _depCol = col;

  // Remove popup anterior
  document.querySelectorAll('.dep-popup').forEach(el => el.remove());

  const popup = document.createElement('div');
  popup.className = 'dep-popup day-editor-popup';
  popup.style.cssText = `
    position:fixed;background:var(--sur);border:1px solid var(--brd);
    border-radius:10px;padding:12px 14px;z-index:1000;
    box-shadow:0 8px 24px rgba(0,0,0,.6);min-width:220px;max-width:260px;
  `;

  popup.innerHTML = `
    <div style="font-size:11px;font-weight:600;color:var(--acc);margin-bottom:8px">${row.Colaborador} — ${col}</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
      ${STATUS_OPTS.map(s =>
        `<button class="btn btn-sm" style="font-size:10px" onclick="setDayVal('${s}',this)">${s}</button>`
      ).join('')}
      <button class="btn btn-sm btn-ok" style="font-size:10px" onclick="setDayVal('${calcMins(row)}',this)">Trabalho (${fmtHours(calcMins(row))})</button>
      <button class="btn btn-sm" style="font-size:10px;background:rgba(248,113,113,.08);color:var(--red)" onclick="setDayVal('',this)">Limpar</button>
    </div>
    <div style="display:flex;gap:5px;align-items:center">
      <input type="text" class="fi" id="dep-custom-input" placeholder="Valor manual…" value="${row[col] || ''}" style="font-size:11px;padding:5px 8px">
      <button class="btn btn-pri btn-sm" onclick="confirmDayCustom()">OK</button>
    </div>`;

  // Posiciona próximo ao elemento
  const rect = anchor.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth  - 270);
  const top  = Math.min(rect.bottom + 4, window.innerHeight - 180);
  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';

  document.body.appendChild(popup);

  // Fechar ao clicar fora
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 80);
}

function setDayVal(val, btn) {
  if (!_depRow || !_depCol) return;
  _depRow[_depCol] = val;
  markUnsaved();
  renderEscala();
  btn.closest('.dep-popup')?.remove();
}

function confirmDayCustom() {
  const input = document.getElementById('dep-custom-input');
  if (!input || !_depRow || !_depCol) return;
  _depRow[_depCol] = input.value;
  markUnsaved();
  renderEscala();
  document.querySelector('.dep-popup')?.remove();
}

// =====================================================
// 15. RENDER PROGRAMAÇÕES
// =====================================================

function renderProg() {
  const q   = ($('prog-q')?.value   || '').toLowerCase();
  const flt = $('prog-flt')?.value  || '';
  const today = new Date().toISOString().slice(0, 10);

  let data = schedData.filter(s =>
    (!q || (s.colabName || '').toLowerCase().includes(q))
  );

  if (flt === 'active') {
    data = data.filter(s => s.changes.some(c =>
      c.dateStart <= today && (!c.dateEnd || c.dateEnd >= today)
    ));
  } else if (flt === 'pending') {
    data = data.filter(s => s.changes.some(c => c.dateStart > today));
  } else if (flt === 'done') {
    data = data.filter(s => s.changes.every(c => c.dateEnd && c.dateEnd < today));
  }

  $('bg-prog').innerText = schedData.length;

  const atv  = schedData.filter(s => s.changes.some(c => c.dateStart <= today && (!c.dateEnd || c.dateEnd >= today))).length;
  const pend = schedData.filter(s => s.changes.some(c => c.dateStart > today)).length;

  const stats = $('prog-stats');
  if (stats) {
    stats.innerHTML = `
      <div class="si"><span class="sl">Total</span>    <span class="sv cb">${schedData.length}</span></div>
      <div class="si"><span class="sl">Em vigor</span> <span class="sv cg">${atv}</span></div>
      <div class="si"><span class="sl">Pendentes</span><span class="sv ca">${pend}</span></div>`;
  }

  const list  = $('prog-list');
  const empty = $('prog-empty');
  list.innerHTML = '';

  if (!data.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  data.forEach(s => {
    const card = document.createElement('div');
    card.className = 'prog-card';

    const isAnyActive = s.changes.some(c =>
      c.dateStart <= today && (!c.dateEnd || c.dateEnd >= today)
    );

    card.innerHTML = `
      <div class="prog-card-hd">
        <div>
          <div class="emp">
            <div class="av">${initials(s.colabName)}</div>
            <div>
              <div class="prog-card-name">${s.colabName}</div>
              <div class="prog-card-meta">${s.changes.length} mudança(s)</div>
            </div>
          </div>
        </div>
        <div class="prog-card-actions">
          ${isAnyActive ? '<span class="bdg bb" style="margin-right:4px">Em vigor</span>' : ''}
          <button class="btn btn-sm eo" onclick="editProg(${s.id})">✏ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProg(${s.id})">✕</button>
        </div>
      </div>
      <div class="prog-changes-list">
        ${s.changes.map(c => {
          const active = c.dateStart <= today && (!c.dateEnd || c.dateEnd >= today);
          const pending = c.dateStart > today;
          return `<div class="prog-change-item">
            ${badge(c.status)}
            <span class="prog-change-dates">${c.dateStart} → ${c.dateEnd || '∞'}</span>
            ${active  ? '<span class="bdg bb">Ativo</span>'  : ''}
            ${pending ? '<span class="bdg ba">Pendente</span>' : ''}
            ${c.returnStatus ? `<span style="color:var(--tx3);font-size:10px">↩ ${c.returnStatus} em ${c.returnDate || '—'}</span>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    list.appendChild(card);
  });
}

// =====================================================
// 16. MODAL PROGRAMAÇÃO
// =====================================================

let schedCount  = 0;
let progEditId  = null;

function openProgModal(editId) {
  progEditId = editId || null;
  schedCount = 0;
  const sel = $('prog-colab');
  sel.innerHTML = '<option value="">— selecione —</option>' +
    [...mopData, ...staffData].map(r => `<option>${r.Colaborador}</option>`).join('');

  $('sc-list').innerHTML = '';

  if (progEditId !== null) {
    const s = schedData.find(x => x.id === progEditId);
    if (s) {
      sel.value = s.colabName;
      s.changes.forEach(c => addScChange(c));
    }
  } else {
    addScChange();
  }
  openOv('ov-prog');
}

/** Adiciona linha de mudança de status no modal */
function addScChange(prefill) {
  schedCount++;
  const div = document.createElement('div');
  div.className = 'sc-item';
  div.innerHTML = `
    <div class="sc-hd">
      <span>Mudança #${schedCount}</span>
      <button class="btn btn-danger btn-sm" onclick="this.closest('.sc-item').remove()">Remover</button>
    </div>
    <div class="sc-g">
      <div class="fgg">
        <label class="flb">Status</label>
        <select class="fi sc-ns">
          ${STATUS_OPTS.map(s => `<option${prefill && prefill.status === s ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="fgg"><label class="flb">Início</label>
        <input type="date" class="fi sc-ds" value="${prefill?.dateStart || ''}">
      </div>
      <div class="fgg"><label class="flb">Fim</label>
        <input type="date" class="fi sc-de" value="${prefill?.dateEnd || ''}">
      </div>
    </div>
    <div class="sc-ret">
      <div class="fgg"><label class="flb">Retorno status</label>
        <select class="fi sc-rs">
          <option value="">—</option>
          ${STATUS_OPTS.map(s => `<option${prefill && prefill.returnStatus === s ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="fgg"><label class="flb">Data retorno</label>
        <input type="date" class="fi sc-rd" value="${prefill?.returnDate || ''}">
      </div>
    </div>`;
  $('sc-list').appendChild(div);
}

/** Salva programação de status */
function saveSched() {
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

  markUnsaved();
  closeOv('ov-prog');
  applyScheduledStatuses();
  renderProg(); renderMop(); renderStaff(); renderEscala();
  updateMissing();
  toast('📅 Programação salva!');
}

function editProg(id) { openProgModal(id); }

function deleteProg(id) {
  if (!confirm('Remover esta programação?')) return;
  schedData = schedData.filter(s => s.id !== id);
  markUnsaved();
  applyScheduledStatuses();
  renderProg(); renderMop(); renderStaff(); renderEscala();
  toast('Programação removida');
}

// =====================================================
// 17. MODAL NOVO COLABORADOR / STAFF
// =====================================================

function openAdd() {
  const isStaff = curTab === 'staff';
  $('add-title').innerText = isStaff ? 'Novo Staff' : 'Novo Colaborador';
  const grid = $('add-grid');
  grid.innerHTML = '';

  const fields = isStaff ? [
    { k:'Matrícula', l:'Matrícula' },
    { k:'Colaborador', l:'Colaborador', full: true },
    { k:'Status', l:'Status', opts: STATUS_OPTS },
    { k:'Cargo',  l:'Cargo',  opts: uniq(staffData, 'Cargo') },
    { k:'Célula', l:'Célula', opts: uniq([...mopData,...staffData,...escData],'Célula') },
    { k:'Tipo',   l:'Tipo',   opts: ['5X2','6X1'] },
    { k:'Reporte',l:'Reporte',opts: uniq([...mopData,...staffData],'Reporte') }
  ] : [
    { k:'Matrícula',  l:'Matrícula'  },
    { k:'Colaborador',l:'Colaborador', full: true },
    { k:'Status',  l:'Status',  opts: STATUS_OPTS },
    { k:'Célula',  l:'Célula',  opts: uniq(mopData,'Célula') },
    { k:'Tipo',    l:'Tipo',    opts: ['5X2','6X1'] },
    { k:'Reporte', l:'Reporte', opts: uniq(mopData,'Reporte') },
    { k:'Horario', l:'Horário' },
    { k:'Saida',   l:'Saída'   },
    { k:'Grupo',   l:'Grupo',   opts: uniq(mopData,'Grupo') }
  ];

  fields.forEach(f => {
    const d = document.createElement('div');
    d.className = 'fgg' + (f.full ? ' full' : '');
    const lbl = document.createElement('label');
    lbl.className = 'flb'; lbl.textContent = f.l;
    d.appendChild(lbl);

    let inp;
    if (f.opts) {
      inp = document.createElement('select');
      inp.className = 'fi';
      f.opts.forEach(o => {
        const op = document.createElement('option');
        op.textContent = o; inp.appendChild(op);
      });
    } else {
      inp = document.createElement('input');
      inp.className = 'fi';
      inp.placeholder = f.l;
    }
    inp.id = 'ad-' + f.k;
    d.appendChild(inp);
    grid.appendChild(d);
  });

  openOv('ov-add');
}

function saveAdd() {
  const isStaff = curTab === 'staff';
  const row = { _id: Date.now(), _src: isStaff ? 'staff' : 'mop' };
  document.querySelectorAll('#add-grid [id^="ad-"]').forEach(el => {
    row[el.id.replace('ad-', '')] = el.value || '';
  });
  if (!row.Colaborador) { toast('Nome é obrigatório', 'var(--red)'); return; }

  if (isStaff) {
    staffData.push(row);
    if (!staffHeaders.length) staffHeaders = Object.keys(row).filter(k => !k.startsWith('_'));
  } else {
    mopData.push(row);
    if (!mopHeaders.length) mopHeaders = Object.keys(row).filter(k => !k.startsWith('_'));
  }

  applyScheduledStatuses();
  if (isStaff) renderStaff(); else renderMop();
  populateFilters();
  closeOv('ov-add');
  updateMissing();
  openFill(row);   // convida a preencher escala imediatamente
  markUnsaved();
  toast(`✅ ${row.Colaborador} adicionado!`);
}

// =====================================================
// 18. NAVEGAÇÃO E ORDENAÇÃO
// =====================================================

function switchTab(name) {
  curTab = name;
  ['mop','staff','escala','prog'].forEach(t => {
    const pnl = $('pnl-' + t);
    const tab = $('tab-' + t);
    if (pnl) pnl.style.display = t === name ? '' : 'none';
    if (tab) tab.classList.toggle('on', t === name);
  });
  // Renderiza o painel ativo
  if (name === 'mop')    renderMop();
  if (name === 'staff')  renderStaff();
  if (name === 'escala') renderEscala();
  if (name === 'prog')   renderProg();
}

function sortBy(tab, col) {
  if (sortC[tab] === col) sortD[tab] *= -1;
  else { sortC[tab] = col; sortD[tab] = 1; }
  if (tab === 'mop')    renderMop();
  if (tab === 'staff')  renderStaff();
  if (tab === 'escala') renderEscala();
}

function openOv(id)  { const el = $(id); if (el) el.classList.add('on'); }
function closeOv(id) { const el = $(id); if (el) el.classList.remove('on'); }

// =====================================================
// 19. SALVAR / SINCRONIZAR COM SUPABASE
// =====================================================

/**
 * markUnsaved — marca que há alterações pendentes e dispara auto-save.
 * Debounce de 1.5s.
 */
function markUnsaved() {
  $('ub').classList.add('on');
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(syncAllToSupabase, 1500);
}

/**
 * syncAllToSupabase — persiste todos os arrays.
 * Melhoria v29: fila anti-colisão (syncPending).
 */
async function syncAllToSupabase() {
  if (!db) { toast('Supabase não conectado', 'var(--red)', 4000); return; }

  // Se já está sincronizando, agenda nova tentativa
  if (syncing) {
    syncPending = true;
    return;
  }

  syncing = true;
  syncPending = false;
  setConn('spin', '💾 Sincronizando...');

  const tables = [
    { name: 'mop',          data: mopData   },
    { name: 'staff',        data: staffData  },
    { name: 'escala',       data: escData    },
    { name: 'programacoes', data: schedData  }
  ];

  try {
    for (const t of tables) {
      // Remove campos internos antes de salvar
      const clean = t.data.map(r => {
        const out = {};
        Object.keys(r).filter(k => !k.startsWith('_') || k === '_admissao').forEach(k => { out[k] = r[k]; });
        return out;
      });
      const { error } = await db.from(t.name).upsert({ id: 1, data: clean }, { onConflict: 'id' });
      if (error) throw new Error(`[${t.name}] ${error.message}`);
    }
    setConn('ok', '✅ Sincronizado');
    $('ub').classList.remove('on');
    toast('Dados salvos no Supabase');
  } catch (e) {
    console.error('Erro ao sincronizar:', e);
    setConn('err', '❌ Erro sync');
    toast('Erro ao salvar: ' + e.message, 'var(--red)', 5000);
  } finally {
    syncing = false;
    // Se houve alteração durante sync, refaz
    if (syncPending) {
      syncPending = false;
      setTimeout(syncAllToSupabase, 800);
    }
  }
}

// =====================================================
// 20. CARREGAR DADOS DO SUPABASE (com retry)
// =====================================================

/**
 * loadFromSupabase — carrega dados com até 3 tentativas automáticas.
 * Melhoria v29: retry com backoff exponencial.
 */
async function loadFromSupabase(attempt) {
  attempt = attempt || 1;
  const MAX_ATTEMPTS = 3;
  const TIMEOUT_MS   = 12000;

  setConn('spin', attempt > 1 ? `🔄 Tentativa ${attempt}...` : '🔄 Carregando dados...');

  const timeout = new Promise((_, rej) =>
    setTimeout(() => rej(new Error('Timeout após ' + (TIMEOUT_MS/1000) + 's')), TIMEOUT_MS)
  );

  try {
    const load = async () => {
      const [r1, r2, r3, r4] = await Promise.all([
        db.from('mop').select('data').eq('id', 1).maybeSingle(),
        db.from('staff').select('data').eq('id', 1).maybeSingle(),
        db.from('escala').select('data').eq('id', 1).maybeSingle(),
        db.from('programacoes').select('data').eq('id', 1).maybeSingle()
      ]);
      // Verifica erros individualmente para melhor diagnóstico
      const errs = [
        r1.error && 'mop: ' + r1.error.message,
        r2.error && 'staff: ' + r2.error.message,
        r3.error && 'escala: ' + r3.error.message,
        r4.error && 'programacoes: ' + r4.error.message
      ].filter(Boolean);
      if (errs.length) throw new Error(errs.join('; '));
      return { r1, r2, r3, r4 };
    };

    const { r1, r2, r3, r4 } = await Promise.race([load(), timeout]);

    // Popula estado global
    mopData   = Array.isArray(r1.data?.data) ? r1.data.data : [];
    staffData = Array.isArray(r2.data?.data) ? r2.data.data : [];
    escData   = Array.isArray(r3.data?.data) ? r3.data.data : [];
    schedData = Array.isArray(r4.data?.data) ? r4.data.data : [];

    console.log('✓ Dados carregados:', {
      mop: mopData.length, staff: staffData.length,
      escala: escData.length, programacoes: schedData.length
    });

    // Marca origem de cada linha
    mopData.forEach(r  => { r._src = r._src || 'mop'; });
    staffData.forEach(r => { r._src = r._src || 'staff'; });

    // Garante _id único
    [mopData, staffData, escData].forEach((arr, i) =>
      arr.forEach((r, j) => { if (!r._id) r._id = (i * 100000) + j + 1; })
    );

    // Infere headers dinamicamente
    mopHeaders = mopData.length
      ? Object.keys(mopData[0]).filter(k => !k.startsWith('_'))
      : ['Colaborador','Status','Célula','Tipo','Reporte','Horário','Saida'];

    staffHeaders = staffData.length
      ? Object.keys(staffData[0]).filter(k => !k.startsWith('_'))
      : ['Colaborador','Status','Cargo','Célula','Tipo'];

    // Descobre colunas de dias da escala
    const allEscKeys = new Set();
    escData.forEach(r => Object.keys(r).forEach(k => allEscKeys.add(k)));
    escHeaders = Array.from(allEscKeys).filter(k => !k.startsWith('_'));

    // Regex: "seg 01-05" ou "seg 01/05"
    ALL_DAY_COLS = escHeaders.filter(h =>
      /[a-záéíóúâêîôûãõ]{2,3}\s+\d{2}[-\/]\d{2}/i.test(h)
    );
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

    curMonth = curMonth || MONTHS[0] || '';

    // Aplica programações ativas
    applyScheduledStatuses();

    // Constrói filtros e renderiza
    buildMonthFilter();
    populateFilters();

    renderMop();
    renderStaff();
    renderEscala();
    renderProg();
    updateMissing();

    setConn('ok', '✅ Supabase conectado');
    toast('Dados carregados do banco');

  } catch (err) {
    console.error(`Tentativa ${attempt}/${MAX_ATTEMPTS} falhou:`, err);

    if (attempt < MAX_ATTEMPTS) {
      const delay = attempt * 2000; // 2s, 4s
      setConn('spin', `⟳ Reconectando (${attempt}/${MAX_ATTEMPTS})…`);
      setTimeout(() => loadFromSupabase(attempt + 1), delay);
    } else {
      setConn('err', '❌ Falha na conexão');
      toast('Erro ao carregar: ' + err.message, 'var(--red)', 8000);
    }
  }
}

// =====================================================
// 21. EXPORT XLSX
// =====================================================

function exportXLSX() {
  if (typeof XLSX === 'undefined') { toast('Biblioteca XLSX indisponível', 'var(--red)'); return; }
  const wb = XLSX.utils.book_new();

  const clean = arr => arr.map(r => {
    const out = {};
    Object.keys(r).filter(k => !k.startsWith('_') || k === '_admissao').forEach(k => { out[k] = r[k]; });
    return out;
  });

  if (mopData.length)   XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clean(mopData)),   'MOP');
  if (staffData.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clean(staffData)), 'STAFF');
  if (escData.length)   XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clean(escData)),   'Escala');
  if (schedData.length) {
    const progClean = schedData.map(s => ({
      Colaborador: s.colabName,
      Mudanças: JSON.stringify(s.changes)
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(progClean), 'Programações');
  }

  XLSX.writeFile(wb, 'MOP_2026_backup_' + new Date().toISOString().slice(0,10) + '.xlsx');
  toast('📊 Exportado com sucesso!');
}

// =====================================================
// 22. DEBOUNCE PARA FILTROS
// =====================================================

let _filterTimer = null;
function debouncedRender() {
  clearTimeout(_filterTimer);
  _filterTimer = setTimeout(() => {
    if (curTab === 'mop')    renderMop();
    if (curTab === 'staff')  renderStaff();
    if (curTab === 'escala') renderEscala();
    if (curTab === 'prog')   renderProg();
  }, 120);
}

// =====================================================
// 23. BOOTSTRAP — window.onload
// =====================================================

window.onerror = function(msg, url, line, col, error) {
  console.error('ERRO GLOBAL:', msg, 'Linha:', line, error);
  setConn('err', '❌ Erro: ' + msg.slice(0, 50));
  return false;
};

window.onload = function() {
  console.log('=== MOP v29 Iniciando ===');
  console.log('Supabase disponível:', typeof window.supabase);

  // ----- Fechar overlays pelo [data-close] -----
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.close || btn.closest('[data-close]')?.dataset.close;
      if (id) closeOv(id);
    });
  });

  // Fechar overlay ao clicar no backdrop
  document.querySelectorAll('.ov').forEach(ov => {
    ov.addEventListener('click', e => {
      if (e.target === ov) closeOv(ov.id);
    });
  });

  // ----- Botões do header -----
  $('btn-save-force').addEventListener('click', syncAllToSupabase);
  $('btn-export').addEventListener('click', exportXLSX);
  $('btn-add').addEventListener('click', openAdd);

  // ----- Alerta sem escala -----
  $('btn-miss-alert').addEventListener('click', showMissing);

  // ----- Troca em massa -----
  $('btn-bulk').addEventListener('click', () => {
    const p = $('bulk-wrap');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
  });
  $('btn-bulk-apply').addEventListener('click', applyBulk);
  $('btn-bulk-close').addEventListener('click', () => { $('bulk-wrap').style.display = 'none'; });

  // ----- Programações -----
  $('btn-prog-add').addEventListener('click', () => openProgModal());
  $('btn-sc-add').addEventListener('click', addScChange);
  $('sc-add-row').addEventListener('click', addScChange);
  $('btn-prog-save').addEventListener('click', saveSched);

  // ----- Formulário novo colaborador -----
  $('btn-add-save').addEventListener('click', saveAdd);

  // ----- Preencher escala -----
  $('btn-fill-ok').addEventListener('click', confirmFill);

  // ----- Tabs -----
  document.querySelectorAll('.tab[data-tab]').forEach(t =>
    t.addEventListener('click', () => switchTab(t.dataset.tab))
  );

  // ----- Filtros com debounce -----
  [
    'mop-q','mop-st','mop-cel','mop-rep','mop-tip','mop-grp',
    'staff-q','staff-st','staff-car','staff-tip',
    'esc-q','esc-st','esc-cel','esc-tip','esc-rep','esc-dow','show-miss',
    'prog-q','prog-flt'
  ].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input',  debouncedRender);
    el.addEventListener('change', debouncedRender);
  });

  // ----- Aviso ao sair com dados não salvos -----
  window.addEventListener('beforeunload', e => {
    if ($('ub').classList.contains('on')) {
      e.preventDefault();
      e.returnValue = 'Há alterações não salvas. Deseja sair?';
    }
  });

  // ----- Carrega dados do Supabase -----
  loadFromSupabase();
};
