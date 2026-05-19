/**
 * MOP 2026 — Mêntore Bank · script.js v30
 *
 * BASE: V29 (Supabase + toda lógica V28)
 * ADICIONADO DO V25:
 *  - brHolidays(): calendário dinâmico (Carnaval, Corpus Christi, Sexta Santa…)
 *  - fmtM(): formata minutos como "8h30"
 *  - generateSmartScale(): Escala Inteligente (5X2, 6X1, Domingos alternados)
 *  - renderCapacity() + computeCapacity(): painel Capacidade com heatmap
 *  - importMassCSV(): importação em massa por CSV
 *  - applyBulkPeriod(): troca em massa com período personalizado
 *  - openAdd() expandido: campos User, Jira, E-mail, Cargo, CPF, etc.
 *  - Pesquisa MOP por Matrícula e E-mail
 *  - Filtro esc-dow com dias úteis "wd"
 *  - kpi .kh (subtítulo nos KPIs)
 *  - syncStatus com toast de nome
 *  - escala inteligente com modal + preview
 *  - Modal importação CSV com seletor de destino
 *  MANTIDO: toda lógica V28/V29 sem nenhuma alteração
 */

'use strict';

// =====================================================
// 1. SUPABASE CONFIG
// =====================================================
const SUPABASE_URL      = 'https://pjeehaziodnxuakhacmc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqZWVoYXppb2RueHVha2hhY21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjU1MzQsImV4cCI6MjA5NDcwMTUzNH0.h5mIzDOvVS3M8BDFy3TeLM4djdBFHTM72LOpKGNgLkg';

let db;
try {
  if (!window.supabase) throw new Error('Biblioteca @supabase/supabase-js não carregou.');
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  console.log('✓ Supabase client criado');
} catch (err) {
  console.error('✗ Erro Supabase:', err);
}

// =====================================================
// 2. ESTADO GLOBAL
// =====================================================
let mopData   = [], staffData  = [], escData   = [], schedData = [];
let mopHeaders = [], staffHeaders = [], escHeaders = [];
let ALL_DAY_COLS = [], MONTHS = [], curMonth = '', curTab = 'mop';
let sortC = { mop: null, staff: null, escala: null };
let sortD = { mop: 1,    staff: 1,    escala: 1    };
let saveTimeout = null, syncing = false, syncPending = false;

const SHARED = {
  'Horário':'Horario','Horario':'Horário','Saida':'Saida',
  'Célula':'Célula','Status':'Status','Tipo':'Tipo',
  'Reporte':'Reporte','Matrícula':'Matrícula',
  '1º Pausa':'1ª Pausa','1ª Pausa':'1º Pausa',
  'Almoço':'Almoço','2º Pausa':'2ª Pausa','2ª Pausa':'2º Pausa'
};
const TIME_FIELDS = ['Horário','Horario','Saida','1º Pausa','Almoço','2º Pausa','1ª Pausa','2ª Pausa'];
const STATUS_OPTS = ['Ativo','Desligado','Afastado','Férias','Day Off','Folga','BH'];
const SMAP = { Ativo:'bg',Desligado:'br','Férias':'ba',Afastado:'bp','Day Off':'bb',Folga:'bt',BH:'bgr' };

// =====================================================
// 3. FERIADOS DINÂMICOS (V25)
// =====================================================

/** Calcula a Páscoa pelo algoritmo de Meeus/Jones/Butcher */
function _easter(y) {
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4;
  const l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;
  return new Date(y, mo-1, da);
}
function _ad(d,n) { const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function _mm(d)   { return String(d.getMonth()+1).padStart(2,'0'); }
function _dd(d)   { return String(d.getDate()).padStart(2,'0'); }

/** Mapa de feriados nacionais 2026 com datas móveis */
function brHolidays(y) {
  const e=_easter(y);
  const c2=_ad(e,-48), c1=_ad(e,-47), sx=_ad(e,-2), cc=_ad(e,60);
  return {
    ['01-01']:'Confraternização',
    [_dd(c2)+'-'+_mm(c2)]:'Carnaval',
    [_dd(c1)+'-'+_mm(c1)]:'Carnaval',
    [_dd(sx)+'-'+_mm(sx)]:'Sexta Santa',
    ['21-04']:'Tiradentes',
    ['01-05']:'Dia do Trabalho',
    [_dd(cc)+'-'+_mm(cc)]:'Corpus Christi',
    ['07-09']:'Independência',
    ['12-10']:'N.Sra. Aparecida',
    ['02-11']:'Finados',
    ['15-11']:'Proclamação',
    ['20-11']:'Consciência Negra',
    ['25-12']:'Natal'
  };
}
const HOL_MAP = brHolidays(2026);   // { "dd-mm": "Nome" }

function isFeriado(col) {
  const m = col.match(/(\d{2})[-\/](\d{2})$/);
  return m ? !!HOL_MAP[m[1]+'-'+m[2]] : false;
}
function feriadoNome(col) {
  const m = col.match(/(\d{2})[-\/](\d{2})$/);
  return m ? (HOL_MAP[m[1]+'-'+m[2]] || '') : '';
}

// =====================================================
// 4. HELPERS BÁSICOS
// =====================================================
function $(id) { return document.getElementById(id); }

function toast(msg, col='var(--grn)', dur=2800) {
  $('toast-msg').textContent = msg;
  const t = $('toast'); t.style.color = col; t.classList.add('on');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), dur);
}
function setConn(cls, txt) {
  const c = $('conn-badge'); if (!c) return;
  c.className = 'conn '+cls; c.innerText = txt;
}
function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return ((p[0]||'')[0]||'') + ((p[p.length-1]||'')[0]||'');
}
function badge(s) { return s ? `<span class="bdg ${SMAP[s]||'bgr'}">${s}</span>` : ''; }
function formatDateDisplay(v) {
  if (!v) return '';
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
function isDateField(col) {
  const n = (col||'').toLowerCase();
  return n.includes('admiss') || n.includes('nascimento') || n.includes('data');
}
function normalizeTime(v) {
  if (!v && v!==0) return v;
  const s = String(v).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return s;
  let h=parseInt(m[1]), mn=m[2], ap=(m[3]||'').toUpperCase();
  if (ap==='PM' && h<12) h+=12;
  if (ap==='AM' && h===12) h=0;
  return String(h).padStart(2,'0')+':'+mn;
}
/** Formata minutos como "8h30" (V25: fmtM) */
function fmtM(m) {
  if (!m && m!==0) return '';
  if (m===0) return '—';
  const h=Math.floor(m/60), mn=m%60;
  return h+(mn?':'+String(mn).padStart(2,'0'):'')+'h';
}
function uniq(arr, k) { return [...new Set(arr.map(r=>r[k]).filter(Boolean))].sort(); }
function srt(data, tab) {
  const c = sortC[tab]; if (!c) return data;
  return data.slice().sort((a,b) => {
    const av=String(a[c]||''), bv=String(b[c]||'');
    return av<bv ? -sortD[tab] : av>bv ? sortD[tab] : 0;
  });
}
function fillSel(id, opts) {
  const el=$(id); if (!el) return;
  const prev=el.value, first=el.options[0]?.textContent||'Todos';
  el.innerHTML = `<option value="">${first}</option>` +
    opts.map(o=>`<option${o===prev?' selected':''}>${o}</option>`).join('');
}
function openOv(id)  { const el=$(id); if(el) el.classList.add('on'); }
function closeOv(id) { const el=$(id); if(el) el.classList.remove('on'); }

// =====================================================
// 5. HELPERS DE ESCALA
// =====================================================
function dayColWeekday(col) { return (col.split(/\s+/)[0]||'').toLowerCase().slice(0,3); }
function isWE(col) { const w=dayColWeekday(col); return w==='dom'||w==='sáb'||w==='sab'; }
function isWorkDay(col, tipo) {
  const d = {seg:1,ter:2,qua:3,qui:4,sex:5,'sáb':6,dom:0}[dayColWeekday(col)];
  if (d===undefined) return true;
  return tipo==='6X1' ? (d>=1&&d<=6) : (d>=1&&d<=5);
}
function colToDate(key) {
  const m = key.match(/(\d{2})[-\/](\d{2})$/);
  if (m) return '2026-'+m[2]+'-'+m[1];
  return null;
}
function getAdmissaoISO(row) {
  let adm = row._admissao || row['Admissão'] || row['Admissao'];
  if (!adm) {
    const ref = mopData.find(x=>x.Colaborador===row.Colaborador) ||
                staffData.find(x=>x.Colaborador===row.Colaborador);
    if (ref) adm = ref['Admissão'] || ref['Admissao'];
  }
  if (!adm) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(adm)) {
    const p=adm.split('/'); return p[2]+'-'+p[1]+'-'+p[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(adm)) return adm;
  return null;
}
/**
 * shiftFromRow — preservado V28 com statusOverride.
 * Adiciona 'x' para desligado.
 */
function shiftFromRow(row, val, isHoliday, weekend, statusOverride) {
  if (isHoliday) return 'h';
  const st = String(statusOverride||row.Status||'').toLowerCase();
  if (st==='férias')    return 'v';
  if (st==='afastado')  return 'a';
  if (st==='day off')   return 'd';
  if (st==='folga')     return 'f';
  if (st==='bh')        return 'b';
  if (st==='desligado') return 'x';
  if (val===''||val==null) return '';
  const absMap={'Folga':'f','Day Off':'d','BH':'b','Férias':'v','Afastado':'a'};
  if (typeof val==='string' && absMap[val.trim()]) return absMap[val.trim()];
  const n=parseInt(val);
  if (isNaN(n)) return '';
  if (n===0) return weekend?'f':'d';
  return 'c';
}
/** calcMins preservado V28 com regra almoço e célula */
function calcMins(row) {
  const e=(row['Horário']||row['Horario']||'08:00').trim();
  const x=(row['Saida']||'').trim();
  if (x&&x!=='-'&&/\d{1,2}:\d{2}/.test(x)) {
    const toM = s => { const p=s.split(':'); return parseInt(p[0])*60+(parseInt(p[1])||0); };
    let t=toM(x)-toM(e);
    if (t>240) t-=60;
    return Math.max(t,0);
  }
  return ['BackOffice','Ouvidoria','PJ'].includes(row['Célula']||'')?600:540;
}
/**
 * fillDays — V25: preenche todas as colunas de dia respeitando admissão e isWorkDay.
 * Substituiu o confirmFill inline da V28.
 */
function fillDays(row, adm, tipo) {
  const mins = calcMins(row);
  ALL_DAY_COLS.forEach(col => {
    const d = colToDate(col);
    if (!d) return;
    if (adm && d < adm) { row[col]=''; return; }
    row[col] = isWorkDay(col,tipo) ? mins : 0;
  });
}
function DAY_COLS() {
  if (!curMonth) return ALL_DAY_COLS;
  return ALL_DAY_COLS.filter(c => { const m=c.match(/(\d{2})[-\/](\d{2})$/); return m&&m[2]===curMonth; });
}

// =====================================================
// 6. SYNC FIELD / STATUS (V28 preservado)
// =====================================================
function syncField(colab, field, val, fromSet) {
  if (syncing||!colab) return;
  syncing=true;
  let targets=[field];
  if (SHARED[field]&&SHARED[field]!==field) targets.push(SHARED[field]);
  targets=[...new Set(targets)];
  if (fromSet!==escData)   escData.forEach(r=>{if(r.Colaborador===colab) targets.forEach(f=>{r[f]=val;});});
  targets.forEach(f=>{
    const mk=Object.keys(SHARED).find(k=>SHARED[k]===f);
    if (mk&&fromSet!==mopData)   mopData.forEach(r=>{if(r.Colaborador===colab)r[mk]=val;});
    if (mk&&fromSet!==staffData) staffData.forEach(r=>{if(r.Colaborador===colab)r[mk]=val;});
  });
  markUnsaved();
  if (fromSet===escData&&curTab==='mop')    setTimeout(renderMop,0);
  if (fromSet===escData&&curTab==='staff')  setTimeout(renderStaff,0);
  if (fromSet!==escData&&curTab==='escala') setTimeout(renderEscala,0);
  syncing=false;
}
function syncMany(colab, map, from) { Object.keys(map).forEach(f=>syncField(colab,f,map[f],from)); }
function syncStatus(name, ns) {
  if (syncing) return;
  syncing=true;
  [mopData,staffData,escData].forEach(arr=>arr.forEach(r=>{if(r.Colaborador===name)r.Status=ns;}));
  syncing=false;
  markUnsaved();
  renderMop(); renderStaff();
  if (curTab==='escala') renderEscala();
  toast(name.split(' ')[0]+': '+ns);
  updateMissing();
}

// =====================================================
// 7. PROGRAMAÇÕES DE STATUS (V28 preservado)
// =====================================================
function applyScheduledStatuses() {
  const today=new Date().toISOString().slice(0,10);
  [mopData,staffData,escData].forEach(arr=>arr.forEach(row=>{
    if (!row.Colaborador) return;
    const sched=schedData.find(s=>s.colabName===row.Colaborador);
    if (!sched) { delete row._origStatus; return; }
    let active=null;
    sched.changes.forEach(c=>{
      if (c.dateStart<=today&&(!c.dateEnd||c.dateEnd>=today)) active=c;
    });
    if (active) { row._origStatus=row._origStatus||row.Status; row.Status=active.status; }
    else if (row._origStatus) { row.Status=row._origStatus; delete row._origStatus; }
  }));
}

// =====================================================
// 8. MISSING (V28 preservado)
// =====================================================
function getMissing() {
  const en=new Set(escData.map(r=>r.Colaborador).filter(Boolean));
  return [...mopData,...staffData].filter(r=>r.Colaborador&&!en.has(r.Colaborador));
}
function updateMissing() {
  const m=getMissing(), n=m.length;
  const bm=$('bg-miss'), ab=$('abar');
  if (n>0) { bm.textContent=n+' sem escala'; bm.style.display=''; ab.classList.add('on'); $('atxt').textContent=n+' colaborador'+(n>1?'es':'')+' sem escala.'; }
  else     { bm.style.display='none'; ab.classList.remove('on'); }
}
function showMissing() {
  const ms=getMissing(), body=$('miss-body');
  if (!ms.length) { body.innerHTML='<p style="color:var(--grn);text-align:center;padding:24px">✅ Todos estão na Escala!</p>'; openOv('ov-miss'); return; }
  function sec(chip,arr) {
    if (!arr.length) return '';
    return `<div class="miss-panel"><h3>[${chip}] ${arr.length} sem escala</h3><div class="miss-grid">${arr.map(r=>`<div class="miss-card" data-mid="${r._id}" data-msrc="${r._src}"><div class="miss-name">${r.Colaborador}</div><div class="miss-meta">${r.Célula||'—'} · ${r.Status||'—'}</div><div class="miss-act">Clique para adicionar →</div></div>`).join('')}</div></div>`;
  }
  body.innerHTML = sec('MOP',ms.filter(r=>r._src==='mop'))+sec('Staff',ms.filter(r=>r._src==='staff'));
  body.querySelectorAll('.miss-card').forEach(el=>el.addEventListener('click',()=>{
    const id=parseInt(el.dataset.mid), src=el.dataset.msrc;
    const row=src==='staff'?staffData.find(r=>r._id===id):mopData.find(r=>r._id===id);
    if (row) { closeOv('ov-miss'); openFill(row); }
  }));
  openOv('ov-miss');
}

// =====================================================
// 9. FILL (V28 + fillDays do V25)
// =====================================================
let fillTarget=null;
function openFill(row) {
  fillTarget=row;
  $('fill-name').innerHTML=`<span class="bdg ${row._src==='staff'?'bb':'bp'}" style="margin-right:7px">${row._src==='staff'?'Staff':'MOP'}</span>${row.Colaborador}<div style="font-size:11px;color:var(--tx3)">${row.Célula||'—'} · ${row.Status||'—'}</div>`;
  $('fi-hor').value=normalizeTime(row.Horario||row.Horário||'08:00');
  $('fi-p1').value=normalizeTime(row['1º Pausa']||'09:10');
  $('fi-alm').value=normalizeTime(row.Almoço||'12:00');
  $('fi-p2').value=normalizeTime(row['2º Pausa']||'15:10');
  $('fi-sai').value=normalizeTime(row.Saida||'18:00');
  $('fi-tip').value=row.Tipo||'5X2';
  $('fi-adm').value=row.Admissão||row._admissao||'';
  openOv('ov-fill');
}
function confirmFill() {
  if (!fillTarget) return;
  const r=fillTarget, hor=$('fi-hor').value||'08:00', sai=$('fi-sai').value||'18:00';
  const tipo=$('fi-tip').value, adm=$('fi-adm').value||null;
  const ne={
    _id:Date.now(), _src:r._src||'mop',
    'Matrícula':r['Matrícula']||'', Colaborador:r.Colaborador,
    'Célula':r['Célula']||'', Status:r.Status||'Ativo',
    Tipo:tipo, Reporte:r.Reporte||'',
    'Horário':hor, Horario:hor, Saida:sai,
    '1º Pausa':$('fi-p1').value||'09:10',
    'Almoço':$('fi-alm').value||'12:00',
    '2º Pausa':$('fi-p2').value||'15:10',
    _admissao:adm
  };
  fillDays(ne, adm, tipo);                                 // V25: preenche todos os dias
  escData=escData.filter(x=>x.Colaborador!==ne.Colaborador);
  escData.push(ne);
  syncMany(r.Colaborador,{'Horário':hor,'Saida':sai,'Tipo':tipo},escData);
  closeOv('ov-fill'); updateMissing();
  toast(r.Colaborador.split(' ')[0]+' na Escala!');
  markUnsaved();
  if (curTab==='escala') renderEscala();
}

// =====================================================
// 10. TROCA EM MASSA (V28 + V25: período personalizado)
// =====================================================
function updateBulkPreview() {
  const n=bulkTargets().length;
  $('bulk-preview').innerText=n?('🎯 '+n+' colaborador'+(n!==1?'es':'')):'Nenhum selecionado';
  const bkCnt=$('bk-cnt');
  if (bkCnt) bkCnt.textContent=n?`(${n} selecionados)`:'(nenhum — usa filtros acima)';
}
function bulkTargets() {
  const repF=$('bulk-rep').value, celF=$('bulk-cel')?.value||'';
  const cSel=$('bulk-colabs');
  const cs=cSel?Array.from(cSel.selectedOptions).map(o=>o.value):[];
  return escData.filter(r=>{
    if (r._missing) return false;
    if (cs.length) return cs.includes(r.Colaborador);
    if (repF&&r.Reporte!==repF) return false;
    if (celF&&r.Célula!==celF)  return false;
    return true;
  });
}
/** Aplica até o fim do ano (V28) */
function applyBulk() {
  const hor=$('bk-hor').value, p1=$('bk-p1').value, alm=$('bk-alm').value, p2=$('bk-p2').value;
  const newSt=$('bk-status').value, sabSt=$('bk-status-sab').value, domSt=$('bk-status-dom').value;
  const targets=bulkTargets();
  if (!targets.length) { toast('Nenhum colaborador selecionado','var(--amb)'); return; }
  targets.forEach(r=>{
    if (hor) { r.Horário=hor; r.Horario=hor; }
    if (p1)  r['1º Pausa']=p1;
    if (alm) r.Almoço=alm;
    if (p2)  r['2º Pausa']=p2;
    if (newSt&&newSt!=='') r.Status=newSt;
    if (sabSt||domSt) {
      ALL_DAY_COLS.forEach(dc=>{
        const w=dc.toLowerCase().slice(0,3);
        if (sabSt&&(w==='sáb'||w==='sab')) r[dc]=sabSt;
        if (domSt&&w==='dom') r[dc]=domSt;
      });
    }
  });
  renderEscala(); renderMop(); renderStaff();
  markUnsaved(); toast(targets.length+' colaborador(es) atualizados');
}
/** Aplica num período personalizado (V25) */
function applyBulkPeriod() {
  const from=$('bk-hor-from').value, to=$('bk-hor-to').value;
  if (!from||!to) { toast('Defina o período (de/até)','var(--amb)'); return; }
  const hor=$('bk-hor').value, p1=$('bk-p1').value, alm=$('bk-alm').value, p2=$('bk-p2').value;
  const newSt=$('bk-status').value, sabSt=$('bk-status-sab').value, domSt=$('bk-status-dom').value;
  const targets=bulkTargets();
  if (!targets.length) { toast('Nenhum colaborador selecionado','var(--amb)'); return; }
  const perioDcs=ALL_DAY_COLS.filter(col=>{ const d=colToDate(col); return d&&d>=from&&d<=to; });
  targets.forEach(r=>{
    if (hor) { r.Horário=hor; r.Horario=hor; }
    if (p1)  r['1º Pausa']=p1;
    if (alm) r.Almoço=alm;
    if (p2)  r['2º Pausa']=p2;
    if (newSt&&newSt!=='') r.Status=newSt;
    perioDcs.forEach(dc=>{
      const w=dc.toLowerCase().slice(0,3);
      if (sabSt&&(w==='sáb'||w==='sab')) r[dc]=sabSt;
      else if (domSt&&w==='dom') r[dc]=domSt;
      else if (!sabSt&&!domSt&&newSt&&newSt!=='') r[dc]=newSt;
    });
  });
  renderEscala(); renderMop(); renderStaff();
  markUnsaved(); toast(`${targets.length} colaborador(es) atualizados (período ${from} → ${to})`);
}

// =====================================================
// 11. ESCALA INTELIGENTE (V25)
// =====================================================
/** Gera escala automática para um tipo e mês */
function generateSmartScale(targets, tipo, mes) {
  targets.forEach(r=>{
    const dcs=ALL_DAY_COLS.filter(c=>{ const m=c.match(/(\d{2})[-\/](\d{2})$/); return m&&m[2]===mes; });
    dcs.forEach(dc=>{
      const w=dayColWeekday(dc); let isWork=false;
      if (tipo==='5X2') isWork=(w!=='sáb'&&w!=='sab'&&w!=='dom');
      else if (tipo==='6X1') isWork=(w!=='dom');
      else if (tipo==='Domingos alternados') {
        const d=parseInt(dc.split(' ')[1]?.split('-')[0]||dc.split('-')[0]);
        isWork=!(w==='dom'&&Math.floor(d/7)%2===0);
      }
      r[dc]=isWork?calcMins(r):0;
    });
  });
  renderEscala(); toast('Escala gerada para '+targets.length+' colaborador(es)');
}

function openSchedulerModal() {
  const sel=$('sch-mes'); sel.innerHTML='';
  MONTHS.forEach(m=>{
    const o=document.createElement('option'); o.value=m;
    const names={'01':'Jan','02':'Fev','03':'Mar','04':'Abr','05':'Mai','06':'Jun','07':'Jul','08':'Ago','09':'Set','10':'Out','11':'Nov','12':'Dez'};
    o.textContent=(names[m]||m)+'/2026';
    sel.appendChild(o);
  });
  const colabs=$('sch-colabs'); colabs.innerHTML='';
  escData.forEach(r=>{
    const o=document.createElement('option'); o.value=r.Colaborador; o.textContent=r.Colaborador;
    colabs.appendChild(o);
  });
  $('sch-preview').textContent='Selecione tipo e mês para ver o preview…';
  openOv('ov-scheduler');
}

function runScheduler() {
  const tipo=$('sch-tipo').value, mes=$('sch-mes').value;
  const selColabs=Array.from($('sch-colabs').selectedOptions).map(o=>o.value);
  const targets=selColabs.length?escData.filter(r=>selColabs.includes(r.Colaborador)):escData;
  generateSmartScale(targets,tipo,mes);
  markUnsaved(); closeOv('ov-scheduler');
}

// Update preview ao mudar tipo/mês
function updateSchedulerPreview() {
  const tipo=$('sch-tipo')?.value, mes=$('sch-mes')?.value;
  if (!tipo||!mes) return;
  const dcs=ALL_DAY_COLS.filter(c=>{ const m=c.match(/(\d{2})[-\/](\d{2})$/); return m&&m[2]===mes; });
  const wd=dcs.filter(c=>{ const w=dayColWeekday(c);
    if (tipo==='5X2') return w!=='sáb'&&w!=='sab'&&w!=='dom';
    if (tipo==='6X1') return w!=='dom';
    return true;
  });
  $('sch-preview').textContent=`Tipo: ${tipo} · Mês: ${mes} · ${dcs.length} dias no mês · ${wd.length} dias úteis`;
}

// =====================================================
// 12. IMPORTAÇÃO MASSA CSV (V25)
// =====================================================
function importMassCSV(file, dest) {
  const reader=new FileReader();
  reader.onload=e=>{
    const lines=e.target.result.split('\n').filter(l=>l.trim());
    if (lines.length<2) { toast('CSV inválido','var(--red)'); return; }
    const headers=lines[0].split(',').map(h=>h.trim());
    const data=lines.slice(1).map(line=>{
      const vals=line.split(',');
      const obj={};
      headers.forEach((h,i)=>{ obj[h]=(vals[i]||'').trim(); });
      return obj;
    }).filter(r=>r.Colaborador);
    data.forEach(r=>{
      r._id=Date.now()+Math.random();
      r._src=dest;
      if (dest==='staff') staffData.push(r);
      else               mopData.push(r);
    });
    applyScheduledStatuses();
    if (dest==='staff') renderStaff(); else renderMop();
    populateFilters();
    updateMissing();
    markUnsaved();
    toast(`✅ ${data.length} colaboradores importados!`);
    closeOv('ov-mass');
  };
  reader.onerror=()=>toast('Erro ao ler arquivo','var(--red)');
  reader.readAsText(file, 'UTF-8');
}

// =====================================================
// 13. CAPACIDADE (V25)
// =====================================================
/** Calcula quantos colaboradores ativos estão trabalhando em cada hora */
function computeCapacity(dateStr, celFiltro) {
  const hours=Array(24).fill(0);
  const colKey=ALL_DAY_COLS.find(c=>{ const d=colToDate(c); return d===dateStr; });
  escData.forEach(r=>{
    if (r.Status!=='Ativo'&&r.Status!=='Folga'&&r.Status!=='BH') {} // conta só ativos
    if (r.Status!=='Ativo') return;
    if (celFiltro&&r['Célula']!==celFiltro) return;
    // verifica se é dia de trabalho nesta data
    if (colKey) {
      const val=r[colKey];
      if (!val||val===0||val==='Folga'||val==='Day Off') return;
    }
    const hor=(r['Horário']||r['Horario']||'08:00').trim();
    const sai=(r['Saida']||'18:00').trim();
    const p1=r['1º Pausa']||r['1ª Pausa']||'';
    const alm=r['Almoço']||'';
    const toH=s=>parseInt((s||'0').split(':')[0]);
    const hIni=toH(hor), hFim=toH(sai);
    for (let h=hIni; h<hFim; h++) {
      if (p1&&h===toH(p1)) continue;
      if (alm&&h>=toH(alm)&&h<toH(alm)+1) continue;
      hours[h]=(hours[h]||0)+1;
    }
  });
  return hours;
}

function renderCapacity() {
  const dateStr=$('cap-data').value||new Date().toISOString().slice(0,10);
  const celFiltro=$('cap-cel').value||'';
  const hours=computeCapacity(dateStr, celFiltro);
  const maxH=Math.max(...hours,1);

  // Heatmap
  const hm=$('cap-heatmap');
  hm.innerHTML=hours.map((c,h)=>{
    const pct=c/maxH, alpha=Math.max(pct,.08);
    const bg=`rgba(91,138,240,${alpha.toFixed(2)})`;
    return `<div class="cap-bar" style="background:${bg};height:${Math.max(20,Math.round(50*pct)+10}px" title="${h}:00 — ${c} colaborador(es)">
      <span class="cap-bar-count">${c||''}</span>
      <span class="cap-bar-label">${h}h</span>
    </div>`;
  }).join('');

  // Alertas
  const alertas=$('cap-alertas');
  const baixos=hours.map((c,h)=>c>0&&c<2?`⚠️ ${h}h: ${c} pessoa`:'').filter(Boolean);
  if (baixos.length) { alertas.className='cap-alertas'; alertas.textContent=baixos.join(' · '); }
  else               { alertas.className='cap-alertas ok'; alertas.textContent='✅ Cobertura adequada em todos os horários'; }

  // Cards de colaboradores ativos
  const cards=$('cap-cards');
  const today=dateStr;
  const colKey=ALL_DAY_COLS.find(c=>colToDate(c)===today);
  const ativos=escData.filter(r=>{
    if (r.Status!=='Ativo') return false;
    if (celFiltro&&r['Célula']!==celFiltro) return false;
    if (colKey) { const v=r[colKey]; return v&&v!==0&&v!=='Folga'&&v!=='Day Off'; }
    return true;
  });
  $('bg-cap').textContent=ativos.length;
  $('cap-subtitle').textContent=`${ativos.length} colaboradores ativos em ${dateStr}${celFiltro?' · '+celFiltro:''}`;
  cards.innerHTML=ativos.map(r=>`
    <div class="cap-card">
      <div class="av">${initials(r.Colaborador)}</div>
      <div class="cap-card-info">
        <div class="nm">${r.Colaborador}</div>
        <div class="hrs">${r['Horário']||r.Horario||'—'} → ${r.Saida||'—'} · ${r['Célula']||'—'}</div>
      </div>
    </div>`).join('');
}

// =====================================================
// 14. FILTROS / POPULAÇÃO
// =====================================================
function populateFilters() {
  fillSel('mop-st',STATUS_OPTS); fillSel('mop-cel',uniq(mopData,'Célula')); fillSel('mop-rep',uniq(mopData,'Reporte')); fillSel('mop-tip',uniq(mopData,'Tipo')); fillSel('mop-grp',uniq(mopData,'Grupo'));
  fillSel('staff-st',STATUS_OPTS); fillSel('staff-car',uniq(staffData,'Cargo')); fillSel('staff-tip',uniq(staffData,'Tipo'));
  fillSel('esc-st',STATUS_OPTS); fillSel('esc-cel',uniq([...mopData,...staffData,...escData],'Célula')); fillSel('esc-tip',uniq(escData,'Tipo')); fillSel('esc-rep',uniq([...mopData,...staffData],'Reporte'));

  // Capacidade: célula
  const capCel=$('cap-cel');
  if (capCel) {
    const prev=capCel.value;
    capCel.innerHTML='<option value="">Todas</option>';
    uniq([...mopData,...staffData,...escData],'Célula').forEach(c=>{
      const o=document.createElement('option'); o.textContent=c; if(c===prev)o.selected=true; capCel.appendChild(o);
    });
  }

  // Bulk
  const br=$('bulk-rep');
  if (br) {
    const prev=br.value;
    br.innerHTML='<option value="">— Todos os líderes —</option>';
    uniq([...mopData,...staffData,...escData],'Reporte').forEach(r=>{ const o=document.createElement('option'); o.textContent=r; if(r===prev)o.selected=true; br.appendChild(o); });
    br.onchange=updateBulkPreview;
  }
  const bc=$('bulk-cel');
  if (bc) {
    const prev=bc.value;
    bc.innerHTML='<option value="">— Todas as células —</option>';
    uniq([...mopData,...staffData,...escData],'Célula').forEach(c=>{ const o=document.createElement('option'); o.textContent=c; if(c===prev)o.selected=true; bc.appendChild(o); });
    bc.onchange=updateBulkPreview; setTimeout(updateBulkPreview,0);
  }
  const bcol=$('bulk-colabs');
  if (bcol) {
    const prev=Array.from(bcol.selectedOptions).map(o=>o.value);
    bcol.innerHTML='';
    uniq(escData,'Colaborador').forEach(n=>{ const o=document.createElement('option'); o.value=n; o.textContent=n; if(prev.includes(n))o.selected=true; bcol.appendChild(o); });
    bcol.onchange=updateBulkPreview;
  }
}

function buildMonthFilter() {
  const sel=$('esc-mes'); if(!sel) return;
  const names={'01':'Janeiro','02':'Fevereiro','03':'Março','04':'Abril','05':'Maio','06':'Junho','07':'Julho','08':'Agosto','09':'Setembro','10':'Outubro','11':'Novembro','12':'Dezembro'};
  const prev=sel.value||curMonth;
  sel.innerHTML='<option value="">Todos</option>';
  MONTHS.forEach(m=>{
    const o=document.createElement('option'); o.value=m; o.textContent=(names[m]||m)+' 2026';
    if(m===prev)o.selected=true; sel.appendChild(o);
  });
  sel.onchange=()=>{ curMonth=sel.value; renderEscala(); };
}

// =====================================================
// 15. RENDER MOP (V28 + busca em Matrícula/Email do V25)
// =====================================================
function renderMop() {
  applyScheduledStatuses();
  const q=($('mop-q')?.value||'').toLowerCase(), st=$('mop-st')?.value||'', cel=$('mop-cel')?.value||'', rep=$('mop-rep')?.value||'', tip=$('mop-tip')?.value||'', grp=$('mop-grp')?.value||'';
  const data=srt(mopData.filter(r=>{
    // V25: busca também por Matrícula e E-mail
    const ok=!q||(r.Colaborador||'').toLowerCase().includes(q)||String(r['Matrícula']||'').includes(q)||(r['E-mail']||'').toLowerCase().includes(q);
    return ok&&(!st||r.Status===st)&&(!cel||r['Célula']===cel)&&(!rep||r.Reporte===rep)&&(!tip||r.Tipo===tip)&&(!grp||r.Grupo===grp);
  }),'mop');
  $('bg-mop').textContent=data.length;
  const stats=$('mop-stats');
  if (stats) {
    const tot=mopData.length, atv=mopData.filter(r=>r.Status==='Ativo').length, afa=mopData.filter(r=>r.Status==='Afastado').length, fer=mopData.filter(r=>r.Status==='Férias').length, des=mopData.filter(r=>r.Status==='Desligado').length;
    stats.innerHTML=`<div class="si"><span class="sl">Total</span><span class="sv cb">${tot}</span></div><div class="si"><span class="sl">Ativos</span><span class="sv cg">${atv}</span></div><div class="si"><span class="sl">Afastados</span><span class="sv ca">${afa}</span></div><div class="si"><span class="sl">Férias</span><span class="sv cp">${fer}</span></div><div class="si"><span class="sl">Desligados</span><span class="sv cr">${des}</span></div>`;
  }
  const th=$('mop-th');
  th.innerHTML=mopHeaders.map(col=>{ const cls=sortC.mop===col?(sortD.mop>0?'sa':'sd'):''; return `<th class="${cls}" onclick="sortBy('mop','${col.replace(/'/g,"\\'")}')">  ${col}</th>`; }).join('');
  const tb=$('mop-tb'); tb.innerHTML='';
  if (!data.length) { tb.innerHTML='<tr><td colspan="30" style="text-align:center;padding:32px;color:var(--tx3)">Nenhum resultado</td></tr>'; return; }
  data.forEach(row=>{
    const tr=document.createElement('tr');
    const st=row.Status||'';
    if (st==='Desligado') tr.classList.add('rd');
    else if (st==='Afastado') tr.classList.add('fa');
    else if (st==='Férias') tr.classList.add('af');
    mopHeaders.forEach(col=>{
      const td=document.createElement('td');
      if (col==='Status') {
        td.className='sc'; td.innerHTML=badge(row[col]);
        const sel=document.createElement('select');
        STATUS_OPTS.forEach(o=>{ const op=document.createElement('option'); op.value=o; op.textContent=o; if(o===row[col])op.selected=true; sel.appendChild(op); });
        sel.onchange=()=>syncStatus(row.Colaborador,sel.value);
        td.appendChild(sel);
      } else if (col==='Colaborador') {
        td.innerHTML=`<div class="emp"><div class="av">${initials(row[col])}</div><div class="nm">${row[col]||''}</div></div>`;
      } else if (TIME_FIELDS.includes(col)) {
        td.setAttribute('contenteditable','true'); td.innerText=row[col]||'';
        td.onblur=()=>{ const v=normalizeTime(td.innerText.trim()); if(v!==row[col]){syncField(row.Colaborador,col,v,mopData);} td.innerText=v||''; };
      } else if (isDateField(col)) {
        td.innerText=formatDateDisplay(row[col]);
      } else {
        td.setAttribute('contenteditable','true'); td.innerText=row[col]||'';
        td.onblur=()=>{ const v=td.innerText.trim(); if(v!==String(row[col]||'')){row[col]=v;markUnsaved();} };
      }
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}

// =====================================================
// 16. RENDER STAFF (V28)
// =====================================================
function renderStaff() {
  applyScheduledStatuses();
  const q=($('staff-q')?.value||'').toLowerCase(), st=$('staff-st')?.value||'', car=$('staff-car')?.value||'', tip=$('staff-tip')?.value||'';
  const data=srt(staffData.filter(r=>(!q||(r.Colaborador||'').toLowerCase().includes(q))&&(!st||r.Status===st)&&(!car||r.Cargo===car)&&(!tip||r.Tipo===tip)),'staff');
  $('bg-staff').textContent=data.length;
  const stats=$('staff-stats');
  if (stats) {
    const tot=staffData.length, atv=staffData.filter(r=>r.Status==='Ativo').length, afa=staffData.filter(r=>r.Status==='Afastado').length;
    stats.innerHTML=`<div class="si"><span class="sl">Total</span><span class="sv cb">${tot}</span></div><div class="si"><span class="sl">Ativos</span><span class="sv cg">${atv}</span></div><div class="si"><span class="sl">Afastados</span><span class="sv ca">${afa}</span></div>`;
  }
  const th=$('staff-th');
  th.innerHTML=staffHeaders.map(col=>{ const cls=sortC.staff===col?(sortD.staff>0?'sa':'sd'):''; return `<th class="${cls}" onclick="sortBy('staff','${col.replace(/'/g,"\\'")}')">  ${col}</th>`; }).join('');
  const tb=$('staff-tb'); tb.innerHTML='';
  if (!data.length) { tb.innerHTML='<tr><td colspan="30" style="text-align:center;padding:32px;color:var(--tx3)">Nenhum resultado</td></tr>'; return; }
  data.forEach(row=>{
    const tr=document.createElement('tr');
    if (row.Status==='Desligado') tr.classList.add('rd');
    staffHeaders.forEach(col=>{
      const td=document.createElement('td');
      if (col==='Status') {
        td.className='sc'; td.innerHTML=badge(row[col]);
        const sel=document.createElement('select');
        STATUS_OPTS.forEach(o=>{ const op=document.createElement('option'); op.value=o; op.textContent=o; if(o===row[col])op.selected=true; sel.appendChild(op); });
        sel.onchange=()=>syncStatus(row.Colaborador,sel.value);
        td.appendChild(sel);
      } else if (col==='Colaborador') {
        td.innerHTML=`<div class="emp"><div class="av">${initials(row[col])}</div><div class="nm">${row[col]||''}</div></div>`;
      } else if (TIME_FIELDS.includes(col)) {
        td.setAttribute('contenteditable','true'); td.innerText=row[col]||'';
        td.onblur=()=>{ const v=normalizeTime(td.innerText.trim()); if(v!==row[col])syncField(row.Colaborador,col,v,staffData); td.innerText=v||''; };
      } else if (isDateField(col)) {
        td.innerText=formatDateDisplay(row[col]);
      } else {
        td.setAttribute('contenteditable','true'); td.innerText=row[col]||'';
        td.onblur=()=>{ const v=td.innerText.trim(); if(v!==String(row[col]||'')){row[col]=v;markUnsaved();} };
      }
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
}

// =====================================================
// 17. RENDER ESCALA (V28 completo + kpi.kh V25)
// =====================================================
function renderEscala() {
  applyScheduledStatuses();
  const q=($('esc-q')?.value||'').toLowerCase(), st=$('esc-st')?.value||'', cel=$('esc-cel')?.value||'', tip=$('esc-tip')?.value||'', rep=$('esc-rep')?.value||'', showMs=$('show-miss')?.checked||false, dowF=$('esc-dow')?.value||'';
  let dcs=DAY_COLS();
  if (dowF) dcs=dcs.filter(c=>{ const w=dayColWeekday(c); if(dowF==='we')return w==='sáb'||w==='sab'||w==='dom'; if(dowF==='wd')return['seg','ter','qua','qui','sex'].includes(w); return w===dowF; });

  let data=escData.slice();
  if (showMs) {
    [...mopData,...staffData].filter(r=>r.Colaborador&&!escData.some(e=>e.Colaborador===r.Colaborador))
      .forEach(r=>data.push({Matrícula:r['Matrícula'],Colaborador:r.Colaborador,'Célula':r['Célula']||'',Status:r.Status,Tipo:r.Tipo||'',Reporte:r.Reporte||'','Horário':'',_missing:true,_ref:r,_id:'m'+r._id,_src:r._src}));
  }
  data=srt(data.filter(r=>(!q||(r.Colaborador||'').toLowerCase().includes(q))&&(!st||r.Status===st)&&(!cel||r['Célula']===cel)&&(!tip||r.Tipo===tip)&&(!rep||r.Reporte===rep)),'escala');
  $('bg-escala').textContent=data.length;

  // KPIs com kh (V25)
  const statsEl=$('esc-stats');
  if (statsEl) {
    const tot=escData.length, atv=escData.filter(r=>r.Status==='Ativo').length, fer=escData.filter(r=>r.Status==='Férias').length, afa=escData.filter(r=>r.Status==='Afastado').length;
    const miss=getMissing().length;
    const totalHorasMs=escData.reduce((acc,r)=>acc+dcs.reduce((s,c)=>{ const v=r[c]; return s+(typeof v==='number'&&v>0?v:0); },0),0);
    statsEl.innerHTML=`
      <div class="kpi">  <div class="kl">Na Escala</div>  <div class="kv">${tot}</div><div class="kh">${atv} ativos</div></div>
      <div class="kpi g"><div class="kl">Trabalhando</div><div class="kv">${atv}</div><div class="kh">status Ativo</div></div>
      <div class="kpi p"><div class="kl">Férias</div>     <div class="kv">${fer}</div></div>
      <div class="kpi a"><div class="kl">Afastados</div>  <div class="kv">${afa}</div></div>
      <div class="kpi r"><div class="kl">Sem escala</div> <div class="kv">${miss}</div></div>
      <div class="kpi">  <div class="kl">Total horas</div><div class="kv" style="font-size:16px">${fmtM(Math.round(totalHorasMs/dcs.length||1))}</div><div class="kh">média/dia</div></div>`;
  }

  // Cabeçalho
  const th=$('esc-th');
  th.innerHTML=`<th class="sticky-l" onclick="sortBy('escala','Colaborador')" style="cursor:pointer">Colaborador ${sortC.escala==='Colaborador'?(sortD.escala>0?'↑':'↓'):''}</th>`+
    dcs.map(col=>{
      const isWeekend=isWE(col), isHol=isFeriado(col);
      const m=col.match(/(\d{2})[-\/](\d{2})$/), dn=col.split(' ')[0]||'', dd=m?m[1]:'';
      let cls='day'; if(isWeekend)cls+=' we'; if(isHol)cls+=' hol';
      const holNm=feriadoNome(col);
      return `<th class="${cls}" title="${holNm||col}"><span class="dn">${dn}</span><span class="dd">${dd}</span>${holNm?`<span class="hol-name">${holNm.slice(0,4)}</span>`:''}</th>`;
    }).join('')+`<th style="white-space:nowrap">Hrs/mês</th>`;

  const tb=$('esc-tb'); tb.innerHTML='';
  if (!data.length) { tb.innerHTML=`<tr><td colspan="${dcs.length+2}" style="text-align:center;padding:32px;color:var(--tx3)">${showMs?'✅ Todos os colaboradores têm escala.':'Nenhum resultado.'}</td></tr>`; return; }

  data.forEach(row=>{
    const tr=document.createElement('tr');
    const tdName=document.createElement('td'); tdName.className='sticky-l';
    tdName.innerHTML=`<div class="emp"><div class="av">${initials(row.Colaborador)}</div><div><div class="nm">${row.Colaborador||'?'}</div><div style="font-size:10px;color:var(--tx3);margin-top:1px">${badge(row.Status)}</div></div></div>`;
    tr.appendChild(tdName);

    if (row._missing) {
      const tdAdd=document.createElement('td'); tdAdd.colSpan=dcs.length+1; tdAdd.style.cssText='color:var(--tx3);font-size:11px;padding:10px 14px';
      tdAdd.innerHTML=`<span style="margin-right:10px;color:var(--amb)">Sem escala</span><button class="btn btn-sm btn-pri" onclick="openFill(escData.find(r=>r.Colaborador==='${row.Colaborador.replace(/'/g,"\\'")}') || ${JSON.stringify({...row,_missing:undefined}).replace(/"/g,'&quot;')})">+ Adicionar</button>`;
      tr.appendChild(tdAdd); tb.appendChild(tr); return;
    }

    let totalMins=0;
    dcs.forEach(col=>{
      const td=document.createElement('td'); td.style.cssText='padding:4px;text-align:center;';
      const isHol=isFeriado(col), weekend=isWE(col), val=row[col];
      const shift=shiftFromRow(row,val,isHol,weekend);
      let lbl='--', hrs='';
      if (shift==='c') {
        const h=row['Horário']||row.Horario||'';
        lbl=h.slice(0,5)||(typeof val==='number'?fmtM(val):String(val||'--'));
        hrs=fmtM(calcMins(row));
        totalMins+=calcMins(row);
      } else {
        lbl={v:'FER',a:'AFA',d:'DO',f:'FOL',b:'BH',h:'FER',x:'DES'}[shift]||'--';
      }
      const cell=document.createElement('div'); cell.className=`scell ${shift||'empty'}`; cell.title=col+(feriadoNome(col)?' — '+feriadoNome(col):'');
      cell.innerHTML=`<span class="lbl">${lbl}</span><span class="hrs">${hrs}</span>`;
      cell.onclick=e=>{ e.stopPropagation(); openDayEditor(row,col,cell); };
      td.appendChild(cell); tr.appendChild(td);
    });

    const tdTot=document.createElement('td'); tdTot.style.textAlign='center';
    tdTot.innerHTML=`<span class="totcell">${fmtM(totalMins)}</span>`;
    tr.appendChild(tdTot); tb.appendChild(tr);
  });
}

// =====================================================
// 18. EDITOR DE DIA (popup)
// =====================================================
let _depRow=null, _depCol=null;
function openDayEditor(row, col, anchor) {
  _depRow=row; _depCol=col;
  document.querySelectorAll('.dep-popup').forEach(el=>el.remove());
  const popup=document.createElement('div'); popup.className='dep-popup';
  popup.innerHTML=`
    <div style="font-size:11px;font-weight:600;color:var(--acc);margin-bottom:8px">${row.Colaborador} — ${col}</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
      ${STATUS_OPTS.map(s=>`<button class="btn btn-sm" style="font-size:10px" onclick="setDayVal('${s}',this)">${s}</button>`).join('')}
      <button class="btn btn-sm btn-ok" style="font-size:10px" onclick="setDayVal('${calcMins(row)}',this)">Trabalho (${fmtM(calcMins(row))})</button>
      <button class="btn btn-sm" style="font-size:10px;background:rgba(248,113,113,.08);color:var(--red)" onclick="setDayVal('',this)">Limpar</button>
    </div>
    <div style="display:flex;gap:5px;align-items:center">
      <input type="text" class="fi" id="dep-ci" placeholder="Valor manual…" value="${row[col]||''}" style="font-size:11px;padding:5px 8px">
      <button class="btn btn-pri btn-sm" onclick="confirmDayCustom()">OK</button>
    </div>`;
  const rect=anchor.getBoundingClientRect();
  popup.style.cssText=`position:fixed;top:${Math.min(rect.bottom+4,window.innerHeight-180)}px;left:${Math.min(rect.left,window.innerWidth-270)}px;z-index:1000`;
  document.body.appendChild(popup);
  setTimeout(()=>{ document.addEventListener('click',function h(e){ if(!popup.contains(e.target)){ popup.remove(); document.removeEventListener('click',h); } }); },80);
}
function setDayVal(val,btn) { if(!_depRow||!_depCol)return; _depRow[_depCol]=val; markUnsaved(); renderEscala(); btn.closest('.dep-popup')?.remove(); }
function confirmDayCustom() { const input=$('dep-ci'); if(!input||!_depRow||!_depCol)return; _depRow[_depCol]=input.value; markUnsaved(); renderEscala(); document.querySelector('.dep-popup')?.remove(); }

// =====================================================
// 19. RENDER PROGRAMAÇÕES (V28 com cards)
// =====================================================
function renderProg() {
  const q=($('prog-q')?.value||'').toLowerCase(), flt=$('prog-flt')?.value||'', today=new Date().toISOString().slice(0,10);
  let data=schedData.filter(s=>!q||(s.colabName||'').toLowerCase().includes(q));
  if (flt==='active') data=data.filter(s=>s.changes.some(c=>c.dateStart<=today&&(!c.dateEnd||c.dateEnd>=today)));
  else if (flt==='pending') data=data.filter(s=>s.changes.some(c=>c.dateStart>today));
  else if (flt==='done') data=data.filter(s=>s.changes.every(c=>c.dateEnd&&c.dateEnd<today));
  $('bg-prog').textContent=schedData.length;
  const atv=schedData.filter(s=>s.changes.some(c=>c.dateStart<=today&&(!c.dateEnd||c.dateEnd>=today))).length;
  const pend=schedData.filter(s=>s.changes.some(c=>c.dateStart>today)).length;
  const stats=$('prog-stats');
  if (stats) stats.innerHTML=`<div class="si"><span class="sl">Total</span><span class="sv cb">${schedData.length}</span></div><div class="si"><span class="sl">Em vigor</span><span class="sv cg">${atv}</span></div><div class="si"><span class="sl">Pendentes</span><span class="sv ca">${pend}</span></div>`;
  const list=$('prog-list'), empty=$('prog-empty'); list.innerHTML='';
  if (!data.length) { empty.style.display=''; return; }
  empty.style.display='none';
  data.forEach(s=>{
    const isAnyActive=s.changes.some(c=>c.dateStart<=today&&(!c.dateEnd||c.dateEnd>=today));
    const card=document.createElement('div'); card.className='prog-card';
    card.innerHTML=`<div class="prog-card-hd"><div class="emp"><div class="av">${initials(s.colabName)}</div><div><div class="prog-card-name">${s.colabName}</div><div class="prog-card-meta">${s.changes.length} mudança(s)${isAnyActive?' · <span style="color:var(--grn)">Em vigor</span>':''}</div></div></div><div class="prog-card-actions"><button class="btn btn-sm eo" onclick="editProg(${s.id})">✏ Editar</button><button class="btn btn-danger btn-sm" onclick="deleteProg(${s.id})">✕</button></div></div><div class="prog-changes-list">${s.changes.map(c=>{ const active=c.dateStart<=today&&(!c.dateEnd||c.dateEnd>=today); const pending=c.dateStart>today; return `<div class="prog-change-item">${badge(c.status)}<span class="prog-change-dates">${c.dateStart} → ${c.dateEnd||'∞'}</span>${active?'<span class="bdg bb">Ativo</span>':''}${pending?'<span class="bdg ba">Pendente</span>':''}${c.returnStatus?`<span style="color:var(--tx3);font-size:10px">↩ ${c.returnStatus} em ${c.returnDate||'—'}</span>`:''}</div>`; }).join('')}</div>`;
    list.appendChild(card);
  });
}

// =====================================================
// 20. MODAL PROGRAMAÇÃO
// =====================================================
let schedCount=0, progEditId=null;
function openProgModal(editId) {
  progEditId=editId||null; schedCount=0;
  const sel=$('prog-colab');
  sel.innerHTML='<option value="">— selecione —</option>'+[...mopData,...staffData].map(r=>`<option>${r.Colaborador}</option>`).join('');
  $('sc-list').innerHTML='';
  if (progEditId!==null) { const s=schedData.find(x=>x.id===progEditId); if(s){sel.value=s.colabName;s.changes.forEach(c=>addScChange(c));} }
  else addScChange();
  openOv('ov-prog');
}
function addScChange(prefill) {
  schedCount++;
  const div=document.createElement('div'); div.className='sc-item';
  div.innerHTML=`<div class="sc-hd"><span>Mudança #${schedCount}</span><button class="btn btn-danger btn-sm" onclick="this.closest('.sc-item').remove()">Remover</button></div><div class="sc-g"><div class="fgg"><label class="flb">Status</label><select class="fi sc-ns">${STATUS_OPTS.map(s=>`<option${prefill&&prefill.status===s?' selected':''}>${s}</option>`).join('')}</select></div><div class="fgg"><label class="flb">Início</label><input type="date" class="fi sc-ds" value="${prefill?.dateStart||''}"></div><div class="fgg"><label class="flb">Fim</label><input type="date" class="fi sc-de" value="${prefill?.dateEnd||''}"></div></div><div class="sc-ret"><div class="fgg"><label class="flb">Retorno status</label><select class="fi sc-rs"><option value="">—</option>${STATUS_OPTS.map(s=>`<option${prefill?.returnStatus===s?' selected':''}>${s}</option>`).join('')}</select></div><div class="fgg"><label class="flb">Data retorno</label><input type="date" class="fi sc-rd" value="${prefill?.returnDate||''}"></div></div>`;
  $('sc-list').appendChild(div);
}
function saveSched() {
  const colab=$('prog-colab').value; if(!colab){toast('Selecione um colaborador','var(--red)');return;}
  const changes=[];
  document.querySelectorAll('.sc-item').forEach(item=>{
    const ns=item.querySelector('.sc-ns').value, ds=item.querySelector('.sc-ds').value, de=item.querySelector('.sc-de').value, rs=item.querySelector('.sc-rs').value, rd=item.querySelector('.sc-rd').value;
    if(ns&&ds)changes.push({status:ns,dateStart:ds,dateEnd:de||'',returnStatus:rs,returnDate:rd});
  });
  if (!changes.length){toast('Adicione ao menos uma mudança','var(--red)');return;}
  if (progEditId!==null) schedData=schedData.filter(s=>s.id!==progEditId);
  schedData.push({id:Date.now(),colabName:colab,changes});
  markUnsaved(); closeOv('ov-prog'); applyScheduledStatuses(); renderProg(); renderMop(); renderStaff(); renderEscala(); updateMissing(); toast('📅 Programação salva!');
}
function editProg(id) { openProgModal(id); }
function deleteProg(id) { if(!confirm('Remover esta programação?'))return; schedData=schedData.filter(s=>s.id!==id); markUnsaved(); applyScheduledStatuses(); renderProg(); renderMop(); renderStaff(); renderEscala(); toast('Programação removida'); }

// =====================================================
// 21. MODAL NOVO COLABORADOR (V25 expandido)
// =====================================================
function openAdd() {
  const isStaff=curTab==='staff';
  $('add-title').innerText=isStaff?'Novo Staff':'Novo Colaborador';
  const grid=$('add-grid'); grid.innerHTML='';
  const fields=isStaff?[
    {k:'Matrícula',l:'Matrícula'},{k:'Colaborador',l:'Colaborador',f:true},{k:'Status',l:'Status',s:STATUS_OPTS},{k:'Cargo',l:'Cargo',s:uniq(staffData,'Cargo')},{k:'Célula',l:'Célula',s:uniq([...mopData,...staffData,...escData],'Célula')},{k:'Tipo',l:'Tipo',s:['5X2','6X1']},{k:'Reporte',l:'Reporte',s:uniq([...mopData,...staffData],'Reporte')},{k:'E-mail',l:'E-mail',f:true},{k:'Horario',l:'Horário'},{k:'Saida',l:'Saída'}
  ]:[
    {k:'Matrícula',l:'Matrícula'},{k:'Centro de custo',l:'Centro de custo'},{k:'Colaborador',l:'Colaborador',f:true},{k:'User',l:'User'},{k:'Jira',l:'Jira'},{k:'User Blip',l:'User Blip'},{k:'E-mail',l:'E-mail',f:true},{k:'Reporte',l:'Reporte',s:uniq(mopData,'Reporte')},{k:'Status',l:'Status',s:STATUS_OPTS},{k:'Célula',l:'Célula',s:uniq(mopData,'Célula')},{k:'Grupo',l:'Grupo',s:uniq(mopData,'Grupo')},{k:'Tipo',l:'Tipo',s:['5X2','6X1']},{k:'Horario',l:'Horário'},{k:'Saida',l:'Saída'},{k:'Admissão',l:'Admissão',dt:'date'},{k:'Cargo',l:'Cargo'},{k:'Cpf',l:'CPF'},{k:'Sexo',l:'Sexo',s:['F','M']},{k:'Telefone',l:'Telefone'}
  ];
  fields.forEach(f=>{
    const d=document.createElement('div'); d.className='fgg'+(f.f?' full':'');
    const lbl=document.createElement('label'); lbl.className='flb'; lbl.textContent=f.l; d.appendChild(lbl);
    let inp; if(f.s){inp=document.createElement('select');inp.className='fi';f.s.forEach(o=>{const op=document.createElement('option');op.textContent=o;inp.appendChild(op);});}else{inp=document.createElement('input');inp.className='fi';inp.placeholder=f.l;if(f.dt)inp.type=f.dt;}
    inp.id='ad-'+f.k; d.appendChild(inp); grid.appendChild(d);
  });
  openOv('ov-add');
}
function saveAdd() {
  const isStaff=curTab==='staff';
  const row={_id:Date.now(),_src:isStaff?'staff':'mop'};
  document.querySelectorAll('#add-grid [id^="ad-"]').forEach(el=>{row[el.id.replace('ad-','')]=el.value||'';});
  if (!row.Colaborador){toast('Nome é obrigatório','var(--red)');return;}
  if (isStaff){staffData.push(row);if(!staffHeaders.length)staffHeaders=Object.keys(row).filter(k=>!k.startsWith('_'));}
  else{mopData.push(row);if(!mopHeaders.length)mopHeaders=Object.keys(row).filter(k=>!k.startsWith('_'));}
  applyScheduledStatuses();
  if(isStaff)renderStaff();else renderMop();
  populateFilters(); closeOv('ov-add'); updateMissing(); openFill(row); markUnsaved();
  toast(`✅ ${row.Colaborador} adicionado!`);
}

// =====================================================
// 22. NAVEGAÇÃO / ORDENAÇÃO
// =====================================================
function switchTab(name) {
  curTab=name;
  ['mop','staff','escala','prog','capacidade'].forEach(t=>{
    const p=$('pnl-'+t),ta=$('tab-'+t);
    if(p)p.style.display=t===name?'':'none';
    if(ta)ta.classList.toggle('on',t===name);
  });
  if(name==='mop')renderMop();
  else if(name==='staff')renderStaff();
  else if(name==='escala')renderEscala();
  else if(name==='prog')renderProg();
  else if(name==='capacidade')renderCapacity();
}
function sortBy(tab,col) {
  if(sortC[tab]===col)sortD[tab]*=-1;
  else{sortC[tab]=col;sortD[tab]=1;}
  if(tab==='mop')renderMop();
  if(tab==='staff')renderStaff();
  if(tab==='escala')renderEscala();
}

// =====================================================
// 23. SAVE / SYNC SUPABASE
// =====================================================
function markUnsaved() {
  $('ub').classList.add('on');
  clearTimeout(saveTimeout);
  saveTimeout=setTimeout(syncAllToSupabase,1500);
}
async function syncAllToSupabase() {
  if (!db){toast('Supabase não conectado','var(--red)',4000);return;}
  if (syncing){syncPending=true;return;}
  syncing=true; syncPending=false;
  setConn('spin','💾 Sincronizando...');
  const tables=[{name:'mop',data:mopData},{name:'staff',data:staffData},{name:'escala',data:escData},{name:'programacoes',data:schedData}];
  try {
    for (const t of tables) {
      const clean=t.data.map(r=>{ const o={}; Object.keys(r).filter(k=>!k.startsWith('_')||k==='_admissao').forEach(k=>{o[k]=r[k];}); return o; });
      const{error}=await db.from(t.name).upsert({id:1,data:clean},{onConflict:'id'});
      if(error)throw new Error(`[${t.name}] ${error.message}`);
    }
    setConn('ok','✅ Sincronizado');
    $('ub').classList.remove('on');
    toast('Dados salvos no Supabase');
  } catch(e) {
    console.error('Sync error:',e);
    setConn('err','❌ Erro sync');
    toast('Erro ao salvar: '+e.message,'var(--red)',5000);
  } finally {
    syncing=false;
    if(syncPending){syncPending=false;setTimeout(syncAllToSupabase,800);}
  }
}

// =====================================================
// 24. LOAD SUPABASE (com retry)
// =====================================================
async function loadFromSupabase(attempt) {
  attempt=attempt||1;
  const MAX=3, TM=12000;
  setConn('spin',attempt>1?`🔄 Tentativa ${attempt}…`:'🔄 Carregando dados…');
  const timeout=new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout após '+TM/1000+'s')),TM));
  try {
    const{r1,r2,r3,r4}=await Promise.race([
      (async()=>{
        const[r1,r2,r3,r4]=await Promise.all([
          db.from('mop').select('data').eq('id',1).maybeSingle(),
          db.from('staff').select('data').eq('id',1).maybeSingle(),
          db.from('escala').select('data').eq('id',1).maybeSingle(),
          db.from('programacoes').select('data').eq('id',1).maybeSingle()
        ]);
        const errs=[r1.error&&'mop: '+r1.error.message,r2.error&&'staff: '+r2.error.message,r3.error&&'escala: '+r3.error.message,r4.error&&'prog: '+r4.error.message].filter(Boolean);
        if(errs.length)throw new Error(errs.join('; '));
        return{r1,r2,r3,r4};
      })(),timeout
    ]);

    mopData  =Array.isArray(r1.data?.data)?r1.data.data:[];
    staffData=Array.isArray(r2.data?.data)?r2.data.data:[];
    escData  =Array.isArray(r3.data?.data)?r3.data.data:[];
    schedData=Array.isArray(r4.data?.data)?r4.data.data:[];

    mopData.forEach(r=>{r._src=r._src||'mop';});
    staffData.forEach(r=>{r._src=r._src||'staff';});
    [mopData,staffData,escData].forEach((arr,i)=>arr.forEach((r,j)=>{if(!r._id)r._id=(i*100000)+j+1;}));

    mopHeaders  =mopData.length  ?Object.keys(mopData[0]).filter(k=>!k.startsWith('_')):['Colaborador','Status','Célula','Tipo','Reporte','Horário','Saida'];
    staffHeaders=staffData.length?Object.keys(staffData[0]).filter(k=>!k.startsWith('_')):['Colaborador','Status','Cargo','Célula','Tipo'];

    const allEscKeys=new Set();
    escData.forEach(r=>Object.keys(r).forEach(k=>allEscKeys.add(k)));
    escHeaders=Array.from(allEscKeys).filter(k=>!k.startsWith('_'));

    ALL_DAY_COLS=escHeaders.filter(h=>/[a-záéíóúâêîôûãõ]{2,3}\s+\d{2}[-\/]\d{2}/i.test(h));
    ALL_DAY_COLS.sort((a,b)=>{ const ga=c=>{const m=c.match(/(\d{2})[-\/](\d{2})$/);return m?'2026-'+m[2]+'-'+m[1]:'';};return ga(a).localeCompare(ga(b)); });
    MONTHS=[...new Set(ALL_DAY_COLS.map(c=>{const m=c.match(/(\d{2})[-\/](\d{2})$/);return m?m[2]:null;}).filter(Boolean))].sort();
    curMonth=curMonth||MONTHS[0]||'';

    applyScheduledStatuses();
    buildMonthFilter();
    populateFilters();
    renderMop(); renderStaff(); renderEscala(); renderProg();
    updateMissing();
    // Inicializa data do capacidade
    const capData=$('cap-data');
    if (capData&&!capData.value) capData.value=new Date().toISOString().slice(0,10);
    setConn('ok','✅ Supabase conectado');
    toast('Dados carregados do banco');
  } catch(err) {
    console.error(`Tentativa ${attempt}/${MAX}:`,err);
    if(attempt<MAX){setConn('spin',`⟳ Reconectando (${attempt}/${MAX})…`);setTimeout(()=>loadFromSupabase(attempt+1),attempt*2000);}
    else{setConn('err','❌ Falha na conexão');toast('Erro: '+err.message,'var(--red)',8000);}
  }
}

// =====================================================
// 25. EXPORT XLSX
// =====================================================
function exportXLSX() {
  if(typeof XLSX==='undefined'){toast('XLSX indisponível','var(--red)');return;}
  applyScheduledStatuses();
  const wb=XLSX.utils.book_new();
  const mkS=(d,h)=>XLSX.utils.json_to_sheet(d.map(r=>{const o={};(h.length?h:Object.keys(r)).filter(k=>!k.startsWith('_')||k==='_admissao').forEach(k=>{o[k]=r[k]!==undefined?r[k]:'';});return o;}));
  if(mopData.length)  XLSX.utils.book_append_sheet(wb,mkS(mopData,mopHeaders),'MOP');
  if(staffData.length)XLSX.utils.book_append_sheet(wb,mkS(staffData,staffHeaders),'STAFF');
  if(escData.length)  XLSX.utils.book_append_sheet(wb,mkS(escData,escHeaders),'Escala');
  if(schedData.length){
    const sr=schedData.flatMap(s=>s.changes.map((c,i)=>({Colaborador:s.colabName,'#':i+1,Status:c.status,'Início':c.dateStart,'Fim':c.dateEnd,'Retorno':c.returnStatus,'Dt.Retorno':c.returnDate})));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(sr),'Programações');
  }
  XLSX.writeFile(wb,'MOP_2026_backup_'+new Date().toISOString().slice(0,10)+'.xlsx');
  toast('📊 Exportado com sucesso!');
}

// =====================================================
// 26. DEBOUNCE FILTROS
// =====================================================
let _ft=null;
function debouncedRender() {
  clearTimeout(_ft); _ft=setTimeout(()=>{
    if(curTab==='mop')renderMop();
    else if(curTab==='staff')renderStaff();
    else if(curTab==='escala')renderEscala();
    else if(curTab==='prog')renderProg();
    else if(curTab==='capacidade')renderCapacity();
  },120);
}

// =====================================================
// 27. BOOTSTRAP
// =====================================================
window.onerror=function(msg,url,line,col,err){
  console.error('ERRO GLOBAL:',msg,'Linha:',line,err);
  setConn('err','❌ '+msg.slice(0,40));
  return false;
};

window.onload=function(){
  console.log('=== MOP v30 Iniciando ===');

  // Fechar overlays
  document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeOv(btn.dataset.close)));
  document.querySelectorAll('.ov').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)closeOv(ov.id);}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.ov.on').forEach(o=>o.classList.remove('on'));});

  // Header
  $('btn-save-force').addEventListener('click',syncAllToSupabase);
  $('btn-export').addEventListener('click',exportXLSX);
  $('btn-add').addEventListener('click',openAdd);
  $('btn-miss-alert').addEventListener('click',showMissing);

  // Importação CSV
  $('btn-mass-add').addEventListener('click',()=>openOv('ov-mass'));
  $('mass-file').addEventListener('change',function(){
    const f=this.files[0]; if(!f)return;
    const r=new FileReader(); r.onload=e=>{ $('mass-preview').textContent=e.target.result.slice(0,600)+(e.target.result.length>600?'\n…':''); }; r.readAsText(f,'UTF-8');
  });
  $('btn-mass-import').addEventListener('click',()=>{
    const f=$('mass-file').files[0]; if(!f){toast('Selecione um arquivo CSV','var(--red)');return;}
    importMassCSV(f,$('mass-dest').value);
  });

  // Escala inteligente
  $('btn-scheduler-open').addEventListener('click',openSchedulerModal);
  $('btn-scheduler-run').addEventListener('click',runScheduler);
  $('sch-tipo').addEventListener('change',updateSchedulerPreview);
  $('sch-mes').addEventListener('change',updateSchedulerPreview);

  // Troca em massa
  $('btn-bulk').addEventListener('click',()=>{ const p=$('bulk-wrap'); p.style.display=p.style.display==='none'?'block':'none'; });
  $('btn-bulk-apply').addEventListener('click',applyBulk);
  $('btn-bulk-apply-period').addEventListener('click',applyBulkPeriod);
  $('btn-bulk-close').addEventListener('click',()=>{ $('bulk-wrap').style.display='none'; });
  // Mostrar/ocultar campos de demissão ao selecionar "Desligado"
  $('bk-status').addEventListener('change',function(){
    const isDes=this.value==='Desligado';
    $('bk-dem-wrap').style.display=isDes?'':'none';
    $('bk-stfrom-wrap').style.display='';
    $('bk-stto-wrap').style.display='';
  });

  // Programações
  $('btn-prog-add').addEventListener('click',()=>openProgModal());
  $('btn-sc-add').addEventListener('click',addScChange);
  $('sc-add-row').addEventListener('click',addScChange);
  $('btn-prog-save').addEventListener('click',saveSched);

  // Form novo colaborador
  $('btn-add-save').addEventListener('click',saveAdd);
  $('btn-fill-ok').addEventListener('click',confirmFill);

  // Tabs
  document.querySelectorAll('.tab[data-tab]').forEach(t=>t.addEventListener('click',function(){switchTab(this.dataset.tab);}));

  // Capacidade
  $('btn-cap-refresh').addEventListener('click',renderCapacity);
  $('cap-cel').addEventListener('change',renderCapacity);

  // Filtros com debounce
  ['mop-q','mop-st','mop-cel','mop-rep','mop-tip','mop-grp',
   'staff-q','staff-st','staff-car','staff-tip',
   'esc-q','esc-st','esc-cel','esc-tip','esc-rep','esc-dow','show-miss',
   'prog-q','prog-flt'
  ].forEach(id=>{ const el=$(id); if(!el)return; el.addEventListener('input',debouncedRender); el.addEventListener('change',debouncedRender); });

  // Aviso ao sair com dados não salvos
  window.addEventListener('beforeunload',e=>{ if($('ub').classList.contains('on')){e.preventDefault();e.returnValue='Há alterações não salvas.';} });

  loadFromSupabase();
};
