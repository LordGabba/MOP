/**
 * MOP 2026 — Mêntore Bank · script.js v31 (Integrado com Supabase & Corrigido)
 */

'use strict';

// =====================================================
// 1. SUPABASE & CONFIGURAÇÕES DE CONEXÃO
// =====================================================
const SUPABASE_URL      = 'https://pjeehaziodnxuakhacmc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqZWVoYXppb2RueHVha2hhY21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjU1MzQsImV4cCI6MjA5NDcwMTUzNH0.h5mIzDOvVS3M8BDFy3TeLM4djdBFHTM72LOpKGNgLkg';

let db;
try {
  if (!window.supabase) throw new Error('Biblioteca @supabase/supabase-js não carregou.');
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  
  // Inicializa o carregamento assim que o DOM estiver pronto
  document.addEventListener('DOMContentLoaded', carregarDadosDoSupabase);
} catch (err) {
  console.error('✗ Erro Supabase:', err);
  setTimeout(() => setConn('offline', 'Erro de Link'), 500);
}

// =====================================================
// 2. ESTADO GLOBAL
// =====================================================
let mopData = [], staffData = [], escData = [], schedData = [];
let mopHeaders = [], staffHeaders = [], escHeaders = [];
let ALL_DAY_COLS = [], MONTHS = [], curMonth = '', curTab = 'mop';
let sortC = { mop: null, staff: null, escala: null };
let sortD = { mop: 1,    staff: 1,    escala: 1    };

// Variáveis de controle do Auto-Save (Debounce)
let saveTimeout = null;
let syncing = false;
let syncPending = false;

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

const FERIADOS_BASE = ['01-01','21-04','01-05','07-09','12-10','02-11','15-11','20-11','25-12'];
let HOL_MAP = {};

function buildHolMap() {
  const y=2026, a=y%19, b=Math.floor(y/100), c=y%100, d=Math.floor(b/4), e=b%4;
  const f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30, i=Math.floor(c/4), k=c%4;
  const l=(32+2*e+2*i-h-k)%7, m=Math.floor((a+11*h+22*l)/451);
  const mo=Math.floor((h+l-7*m+114)/31), da=((h+l-7*m+114)%31)+1;
  const easter = new Date(y, mo-1, da);
  const ad = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
  const fmt = d => String(d.getDate()).padStart(2,'0')+'-'+String(d.getMonth()+1).padStart(2,'0');
  HOL_MAP = {
    '01-01':'Confraternização',
    [fmt(ad(easter,-48))]:'Carnaval', [fmt(ad(easter,-47))]:'Carnaval',
    [fmt(ad(easter,-2))]:'Sexta-Feira Santa',
    '21-04':'Tiradentes', '01-05':'Dia do Trabalho',
    [fmt(ad(easter,60))]:'Corpus Christi',
    '07-09':'Independência', '12-10':'N.Sra. Aparecida',
    '02-11':'Finados', '15-11':'Proclamação', '20-11':'Consciência Negra', '25-12':'Natal'
  };
}

function isFeriado(col) {
  const m = col.match(/(\d{2})[-\/](\d{2})$/);
  return m ? !!HOL_MAP[m[1]+'-'+m[2]] : false;
}
function feriadoNome(col) {
  const m = col.match(/(\d{2})[-\/](\d{2})$/);
  return m ? (HOL_MAP[m[1]+'-'+m[2]] || '') : '';
}

// =====================================================
// 3. HELPERS GERAIS E COORDENAÇÃO DE UI
// =====================================================
function $(id) { return document.getElementById(id); }

function toast(msg, color='var(--grn)', dur=2600) {
  const t=$('toast'); if(!t) return;
  const tm=$('toast-msg'); if(tm) tm.innerText=msg;
  t.style.color=color; t.classList.add('on');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('on'),dur);
}

function setConn(cls, txt) {
  const c=$('conn-badge'); if(!c) return;
  c.className='conn '+cls; c.innerText=txt;
}

function initials(name) {
  if (!name) return '?';
  const p=name.trim().split(/\s+/);
  return ((p[0]||'')[0]||'')+((p[p.length-1]||'')[0]||'');
}

function badge(s) {
  return s ? `<span class="bdg ${SMAP[s]||'bgr'}">${s}</span>` : '';
}

function formatDateDisplay(v) {
  if (!v) return '';
  const m=String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
}

function isDateField(col) {
  const n=(col||'').toLowerCase();
  return n.includes('admiss')||n.includes('nascimento')||n.includes('nasc')||n.includes('data')||n.includes('férias')||n.includes('ferias');
}

function normalizeTime(v) {
  if (!v && v!==0) return v;
  const s=String(v).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  const m=s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return s;
  let h=parseInt(m[1]), mn=m[2], ap=(m[3]||'').toUpperCase();
  if (ap==='PM'&&h<12) h+=12;
  if (ap==='AM'&&h===12) h=0;
  return String(h).padStart(2,'0')+':'+mn;
}

function fmtM(m) {
  if (!m&&m!==0) return '';
  if (m===0) return '—';
  const h=Math.floor(m/60), mn=m%60;
  return h+(mn?':'+String(mn).padStart(2,'0'):'')+'h';
}

function uniq(arr, k) { return [...new Set(arr.map(r=>r[k]).filter(Boolean))].sort(); }

function srt(data, tab) {
  const c=sortC[tab]; if(!c) return data;
  return data.slice().sort((a,b)=>{
    const av=String(a[c]||''), bv=String(b[c]||'');
    return av<bv ? -sortD[tab] : av>bv ? sortD[tab] : 0;
  });
}

// Modificado para evitar falhas caso o ID não exista no HTML em uso
function fillSel(id, opts) {
  const el=$(id); if(!el) return;
  const prev=el.value, first=el.options[0]?.textContent||'Todos';
  el.innerHTML=`<option value="">${first}</option>`+
    opts.map(o=>`<option${o===prev?' selected':''}>${o}</option>`).join('');
}

function openOv(id)  { const el=$(id); if(el) el.classList.add('on'); }
function closeOv(id) { const el=$(id); if(el) el.classList.remove('on'); }

function dayColWeekday(col) { return (col.split(/\s+/)[0]||'').toLowerCase().slice(0,3); }
function isWE(col) { const w=dayColWeekday(col); return w==='dom'||w==='sáb'||w==='sab'; }

function isWorkDay(col, tipo) {
  const d={seg:1,ter:2,qua:3,qui:4,sex:5,'sáb':6,dom:0}[dayColWeekday(col)];
  if (d===undefined) return true;
  return tipo==='6X1'?(d>=1&&d<=6):(d>=1&&d<=5);
}

function colToDate(key) {
  const m=key.match(/(\d{2})[-\/](\d{2})$/);
  return m ? '2026-'+m[2]+'-'+m[1] : null;
}

function calcMins(row) {
  const e=(row['Horário']||row['Horario']||'08:00').trim();
  const x=(row['Saida']||'').trim();
  if (x&&x!=='-'&&/\d{1,2}:\d{2}/.test(x)) {
    const toM=s=>{const p=s.split(':');return parseInt(p[0])*60+(parseInt(p[1])||0);};
    let t=toM(x)-toM(e);
    if (t>240) t-=60;
    return Math.max(t,0);
  }
  return ['BackOffice','Ouvidoria','PJ'].includes(row['Célula']||'')?600:540;
}

function fillDays(row, adm, tipo) {
  const mins=calcMins(row);
  ALL_DAY_COLS.forEach(col=>{
    const d=colToDate(col);
    if (!d) return;
    if (adm&&d<adm) { row[col]=''; return; }
    row[col]=isWorkDay(col,tipo)?mins:0;
  });
}

function DAY_COLS() {
  if (!curMonth) return ALL_DAY_COLS;
  return ALL_DAY_COLS.filter(c=>{const m=c.match(/(\d{2})[-\/](\d{2})$/);return m&&m[2]===curMonth;});
}

// =====================================================
// 4. PERSISTÊNCIA E SINCROCONIZAÇÃO (SUPABASE REAL)
// =====================================================
async function carregarDadosDoSupabase() {
  if (!db) return;
  try {
    setConn('loading', 'A carregar dados...');
    buildHolMap();

    const { data, error } = await db
      .from('escala')
      .select('*');

    if (error) throw error;

    if (data && data.length > 0) {
      escData = data;
      
      ALL_DAY_COLS = Object.keys(data[0]).filter(k => k.includes('-') || k.includes('/'));
      
      const ms = new Set();
      ALL_DAY_COLS.forEach(c => { const m = c.match(/(\d{2})[-\/](\d{2})$/); if(m) ms.add(m[2]); });
      MONTHS = [...ms].sort();
      if (!curMonth && MONTHS.length) curMonth = MONTHS[0];

      mopData = escData.filter(r => r._src === 'mop');
      staffData = escData.filter(r => r._src === 'staff');

      buildMonthFilter();
      populateFilters();
      updateMissing();
      
      switchTab(curTab);
      
      setConn('online', 'Conectado');
      toast('Dados sincronizados com o Supabase!');
    } else {
      setConn('online', 'Pronto (Vazio)');
    }
  } catch (err) {
    console.error('Erro ao ler dados do Supabase:', err);
    setConn('offline', 'Erro Leitura');
    toast('Falha ao descarregar dados da nuvem.', 'var(--red)');
  }
}

async function gravarDadosNoSupabase() {
  if (!db || !escData.length) return;
  if (syncing) {
    syncPending = true;
    return;
  }

  syncing = true;
  setConn('saving', 'A guardar...');

  try {
    const { error } = await db
      .from('escala')
      .upsert(escData, { onConflict: 'Colaborador' });

    if (error) throw error;

    setConn('online', 'Sincronizado');
    toast('Alterações salvas no Supabase!');
    
    syncing = false;
    if (syncPending) {
      syncPending = false;
      gravarDadosNoSupabase();
    }
  } catch (err) {
    console.error('Erro ao gravar no Supabase:', err);
    setConn('offline', 'Erro Sinc');
    toast('Erro ao sincronizar modificações.', 'var(--red)');
    syncing = false;
  }
}

function markUnsaved() {
  setConn('unsaved', 'Pendências locais...');
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(gravarDadosNoSupabase, 2000);
}

// =====================================================
// 5. SINCRONIZAÇÃO EM FLUXO DE MEMÓRIA (Real-time mapping)
// =====================================================
function syncField(colab, field, val, fromSet) {
  if (!colab) return;
  
  let targets=[field];
  if (SHARED[field]&&SHARED[field]!==field) targets.push(SHARED[field]);
  targets=[...new Set(targets)];
  
  if (fromSet!==escData) escData.forEach(r=>{if(r.Colaborador===colab)targets.forEach(f=>{r[f]=val;});});
  
  targets.forEach(f=>{
    const mk=Object.keys(SHARED).find(k=>SHARED[k]===f);
    if (mk&&fromSet!==mopData)   mopData.forEach(r=>{if(r.Colaborador===colab)r[mk]=val;});
    if (mk&&fromSet!==staffData) staffData.forEach(r=>{if(r.Colaborador===colab)r[mk]=val;});
  });
  
  markUnsaved();
  if (fromSet===escData&&curTab==='mop')    setTimeout(renderMop,0);
  if (fromSet===escData&&curTab==='staff')  setTimeout(renderStaff,0);
  if (fromSet!==escData&&curTab==='escala') setTimeout(renderEscala,0);
}

function syncMany(colab, map, from) { Object.keys(map).forEach(f=>syncField(colab,f,map[f],from)); }

function syncStatus(name, ns) {
  [mopData,staffData,escData].forEach(arr=>arr.forEach(r=>{if(r.Colaborador===name)r.Status=ns;}));
  markUnsaved();
  renderMop(); renderStaff();
  if (curTab==='escala') renderEscala();
  toast(name.split(' ')[0]+': '+ns);
  updateMissing();
}

// =====================================================
// 6. GESTÃO DE COLABORADORES AUSENTES (MISSING)
// =====================================================
function getMissing() {
  const en=new Set(escData.map(r=>r.Colaborador).filter(Boolean));
  return [...mopData,...staffData].filter(r=>r.Colaborador&&!en.has(r.Colaborador));
}

function updateMissing() {
  const m=getMissing(), n=m.length;
  const bm=$('bg-miss'), ab=$('abar');
  if(!bm || !ab) return;
  if (n>0) { 
    bm.textContent=n+' sem escala'; bm.style.display=''; ab.classList.add('on'); 
    const txt=$('atxt'); if(txt) txt.textContent=n+' colaborador'+(n>1?'es':'')+' sem escala.'; 
  } else { 
    bm.style.display='none'; ab.classList.remove('on'); 
  }
}

function showMissing() {
  const ms=getMissing(), body=$('miss-body');
  if (!body) return;
  if (!ms.length) { body.innerHTML='<p style="color:var(--grn);text-align:center;padding:24px">✅ Todos estão na Escala!</p>'; openOv('ov-miss'); return; }
  function sec(chip,arr) {
    if (!arr.length) return '';
    return `<div class="miss-panel"><h3>[${chip}] ${arr.length} sem escala</h3><div class="miss-grid">${arr.map(r=>`<div class="miss-card" data-mid="${r._id}" data-msrc="${r._src}"><div class="miss-name">${r.Colaborador}</div><div class="miss-meta">${r.Célula||'—'} · ${r.Status||'—'}</div><div class="miss-act">Clique para adicionar →</div></div>`).join('')}</div></div>`;
  }
  body.innerHTML=sec('MOP',ms.filter(r=>r._src==='mop'))+sec('Staff',ms.filter(r=>r._src==='staff'));
  body.querySelectorAll('.miss-card').forEach(el=>el.addEventListener('click',()=>{
    const id=parseInt(el.dataset.mid), src=el.dataset.msrc;
    const row=src==='staff'?staffData.find(r=>r._id===id):mopData.find(r=>r._id===id);
    if (row) { closeOv('ov-miss'); openFill(row); }
  }));
  openOv('ov-miss');
}

// =====================================================
// 7. PREENCHIMENTO E CRIAÇÃO DE ESCALA INDIVIDUAL
// =====================================================
let fillTarget=null;
function openFill(row) {
  fillTarget=row;
  const fn=$('fill-name');
  if(fn) fn.innerHTML=`<span class="bdg ${row._src==='staff'?'bb':'bp'}" style="margin-right:7px">${row._src==='staff'?'Staff':'MOP'}</span>${row.Colaborador}<div style="font-size:11px;color:var(--tx3)">${row.Célula||'—'} · ${row.Status||'—'}</div>`;
  
  const fields = { 'fi-hor':'Horario', 'fi-sai':'Saida', 'fi-p1':'1º Pausa', 'fi-alm':'Almoço', 'fi-p2':'2º Pausa' };
  Object.keys(fields).forEach(id => {
    const el=$(id); if(el) el.value = normalizeTime(row[fields[id]] || (id==='fi-hor'?'08:00':id==='fi-sai'?'18:00':''));
  });
  const tip=$('fi-tip'); if(tip) tip.value=row.Tipo||'5X2';
  const adm=$('fi-adm'); if(adm) adm.value=row.Admissão||row._admissao|| '';
  openOv('ov-fill');
}

function confirmFill() {
  if (!fillTarget) return;
  const r=fillTarget;
  const hor=$('fi-hor')?.value||'08:00', sai=$('fi-sai')?.value||'18:00';
  const tipo=$('fi-tip')?.value||'5X2', adm=$('fi-adm')?.value||null;
  const ne={
    _id:Date.now(), _src:r._src||'mop',
    'Matrícula':r['Matrícula']||'', Colaborador:r.Colaborador,
    'Célula':r['Célula']||'', Status:r.Status||'Ativo',
    Tipo:tipo, Reporte:r.Reporte||'',
    'Horário':hor, Horario:hor, Saida:sai,
    '1º Pausa':$('fi-p1')?.value||'09:10',
    'Almoço':$('fi-alm')?.value||'12:00',
    '2º Pausa':$('fi-p2')?.value||'15:10',
    _admissao:adm
  };
  fillDays(ne, adm, tipo);
  escData=escData.filter(x=>x.Colaborador!==ne.Colaborador);
  escData.push(ne);
  syncMany(r.Colaborador,{'Horário':hor,'Saida':sai,'Tipo':tipo},escData);
  closeOv('ov-fill'); updateMissing();
  toast(r.Colaborador.split(' ')[0]+' na Escala!');
  markUnsaved();
  if (curTab==='escala') renderEscala();
}

// =====================================================
// 8. TROCAS CASADAS - MAPEAÇÃO EXATA DO SEU HTML (Imagem 2)
// =====================================================
function openSwap() {
  const colabs=uniq(escData,'Colaborador');
  // Mapeia os seletores reais do seu arquivo HTML: 'troca-a' e 'troca-b'
  ['troca-a','troca-b'].forEach(id=>{
    const sel=$(id); if(!sel) return;
    const prev=sel.value;
    sel.innerHTML='<option value="">— selecione —</option>'+
      colabs.map(n=>`<option${n===prev?' selected':''}>${n}</option>`).join('');
    sel.onchange=updateSwapPreview;
  });
  updateSwapPreview();
  openOv('ov-troca-casada');
}

function updateSwapPreview() {
  const nA=$('troca-a')?.value, nB=$('troca-b')?.value;
  const prev=$('troca-preview');
  if(!prev) return;
  if (!nA||!nB||nA===nB) { prev.textContent='Selecione dois colaboradores para ver o preview da troca…'; return; }
  const rA=escData.find(r=>r.Colaborador===nA), rB=escData.find(r=>r.Colaborador===nB);
  if (!rA||!rB) { prev.textContent='Um dos colaboradores não possui dados estruturados de turno.'; return; }
  const hA=rA['Horário']||rA.Horario||'—', sA=rA.Saida||'—';
  const hB=rB['Horário']||rB.Horario||'—', sB=rB.Saida||'—';
  prev.innerHTML=`<b>${nA}</b>: ${hA}➔${sA} (${fmtM(calcMins(rA))})<br>↔<br><b>${nB}</b>: ${hB}➔${sB} (${fmtM(calcMins(rB))})`;
}

function applySwap() {
  const nA=$('troca-a')?.value, nB=$('troca-b')?.value;
  if (!nA||!nB) { toast('Selecione ambos os colaboradores','var(--amb)'); return; }
  if (nA===nB)  { toast('Escolha colaboradores distintos','var(--amb)'); return; }
  const rA=escData.find(r=>r.Colaborador===nA), rB=escData.find(r=>r.Colaborador===nB);
  if (!rA||!rB) { toast('Dados de escala ausentes em um dos alvos','var(--red)'); return; }

  const horFields=['Horário','Horario','Saida','1º Pausa','Almoço','2º Pausa','1ª Pausa','2ª Pausa'];
  horFields.forEach(f=>{ const tmp=rA[f]; rA[f]=rB[f]; rB[f]=tmp; });

  ALL_DAY_COLS.forEach(col=>{ const tmp=rA[col]; rA[col]=rB[col]; rB[col]=tmp; });

  syncMany(nA,{'Horário':rA['Horário']||rA.Horario,'Saida':rA.Saida},escData);
  syncMany(nB,{'Horário':rB['Horário']||rB.Horario,'Saida':rB.Saida},escData);
  
  markUnsaved(); renderEscala(); closeOv('ov-troca-casada');
  toast(`🔄 Troca realizada com sucesso!`);
}

function updateBulkPreview() {
  const n=bulkTargets().length; const cnt=$('bk-cnt');
  if (cnt) cnt.textContent=n?`(${n} selecionado${n!==1?'s':''})` :'';
  const prev=$('bulk-preview'); if (prev) prev.textContent=n?`🎯 ${n} colaborador${n!==1?'es':''}` :'Nenhum selecionado';
}

function bulkTargets() {
  const repF=$('bulk-rep')?.value, celF=$('bulk-cel')?.value||'';
  const cSel=$('bulk-colabs'); const cs=cSel?Array.from(cSel.selectedOptions).map(o=>o.value):[];
  return escData.filter(r=>{
    if (r._missing) return false;
    if (cs.length) return cs.includes(r.Colaborador);
    if (repF&&r.Reporte!==repF) return false;
    if (celF&&r['Célula']!==celF) return false;
    return true;
  });
}

function applyBulk() {
  const hor=$('bk-hor')?.value, p1=$('bk-p1')?.value, alm=$('bk-alm')?.value, p2=$('bk-p2')?.value;
  const newSt=$('bk-status')?.value, sabSt=$('bk-status-sab')?.value, domSt=$('bk-status-dom')?.value;
  const targets=bulkTargets();
  if (!targets.length) { toast('Nenhum colaborador selecionado','var(--amb)'); return; }
  targets.forEach(r=>{
    if (hor) { r['Horário']=hor; r.Horario=hor; }
    if (p1) r['1º Pausa']=p1; if (alm) r.Almoço=alm; if (p2) r['2º Pausa']=p2; if (newSt) r.Status=newSt;
    if (sabSt||domSt||newSt) {
      ALL_DAY_COLS.forEach(dc=>{
        const w=dc.toLowerCase().slice(0,3);
        if (sabSt && (w==='sáb'||w==='sab')) { r[dc]=sabSt; return; }
        if (domSt && w==='dom') { r[dc]=domSt; return; }
        if (hor&&isWorkDay(dc,r.Tipo||'5X2')) { if (typeof r[dc]==='number'&&r[dc]>0) r[dc]=calcMins(r); }
      });
    }
  });
  renderEscala(); renderMop(); renderStaff(); markUnsaved();
  toast(`✅ ${targets.length} colaborador(es) atualizados`);
}

function applyBulkPeriod() {
  const from=$('bk-from')?.value, to=$('bk-to')?.value;
  if (!from||!to) { toast('Defina o período (de/até)','var(--amb)'); return; }
  const hor=$('bk-hor')?.value, p1=$('bk-p1')?.value, alm=$('bk-alm')?.value, p2=$('bk-p2')?.value;
  const newSt=$('bk-status')?.value, sabSt=$('bk-status-sab')?.value, domSt=$('bk-status-dom')?.value;
  const targets=bulkTargets();
  if (!targets.length) { toast('Nenhum colaborador selecionado','var(--amb)'); return; }
  const perioDcs=ALL_DAY_COLS.filter(c=>{ const d=colToDate(c); return d&&d>=from&&d<=to; });
  targets.forEach(r=>{
    if (hor) { r['Horário']=hor; r.Horario=hor; }
    if (p1) r['1º Pausa']=p1; if (alm) r.Almoço=alm; if (p2) r['2º Pausa']=p2; if (newSt) r.Status=newSt;
    perioDcs.forEach(dc=>{
      const w=dc.toLowerCase().slice(0,3);
      if (sabSt&&(w==='sáb'||w==='sab')) { r[dc]=sabSt; return; }
      if (domSt&&w==='dom') { r[dc]=domSt; return; }
      if (newSt&&isWorkDay(dc,r.Tipo||'5X2')) r[dc]=newSt;
      else if (hor&&isWorkDay(dc,r.Tipo||'5X2')) { if (typeof r[dc]==='number'&&r[dc]>0) r[dc]=calcMins(r); }
    });
  });
  renderEscala(); renderMop(); renderStaff(); markUnsaved();
  toast(`✅ ${targets.length} atualizados (${from} → ${to})`);
}

// =====================================================
// 9. ELEMENTOS DE FILTRO E SELEÇÃO DE MENUS
// =====================================================
function populateFilters() {
  fillSel('mop-st',STATUS_OPTS); fillSel('mop-cel',uniq(mopData,'Célula'));
  fillSel('mop-rep',uniq(mopData,'Reporte')); fillSel('mop-tip',uniq(mopData,'Tipo'));
  fillSel('mop-grp',uniq(mopData,'Grupo'));
  fillSel('staff-st',STATUS_OPTS); fillSel('staff-car',uniq(staffData,'Cargo')); fillSel('staff-tip',uniq(staffData,'Tipo'));
  fillSel('esc-st',STATUS_OPTS); fillSel('esc-cel',uniq([...mopData,...staffData,...escData],'Célula'));
  fillSel('esc-tip',uniq(escData,'Tipo')); fillSel('esc-rep',uniq([...mopData,...staffData],'Reporte'));

  const br=$('bulk-rep');
  if (br) {
    const prev=br.value; br.innerHTML='<option value="">— Todos os líderes —</option>';
    uniq([...mopData,...staffData,...escData],'Reporte').forEach(r=>{const o=document.createElement('option');o.textContent=r;if(r===prev)o.selected=true;br.appendChild(o);});
    br.onchange=updateBulkPreview;
  }
  const bc=$('bulk-cel');
  if (bc) {
    const prev=bc.value; bc.innerHTML='<option value="">— Todas as células —</option>';
    uniq([...mopData,...staffData,...escData],'Célula').forEach(c=>{const o=document.createElement('option');o.textContent=c;if(c===prev)o.selected=true;bc.appendChild(o);});
    bc.onchange=updateBulkPreview; setTimeout(updateBulkPreview,0);
  }
  const bcol=$('bulk-colabs');
  if (bcol) {
    const prev=Array.from(bcol.selectedOptions).map(o=>o.value); bcol.innerHTML='';
    uniq(escData,'Colaborador').forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent=n;if(prev.includes(n))o.selected=true;bcol.appendChild(o);});
    bcol.onchange=updateBulkPreview;
  }
}

function buildMonthFilter() {
  const sel=$('esc-mes'); if(!sel) return;
  const names={'01':'Janeiro','02':'Fevereiro','03':'Março','04':'Abril','05':'Maio','06':'Junho','07':'Julho','08':'Agosto','09':'Setembro','10':'Outubro','11':'Novembro','12':'Dezembro'};
  const prev=sel.value||curMonth; sel.innerHTML='<option value="">Todos</option>';
  MONTHS.forEach(m=>{
    const o=document.createElement('option'); o.value=m; o.textContent=(names[m]||m)+' 2026';
    if(m===prev)o.selected=true; sel.appendChild(o);
  });
  sel.onchange=()=>{curMonth=sel.value;renderEscala();};
}

// =====================================================
// 10. SWITCH TAB & DIRECIONAMENTO DE RENDER (Mapeamento Base)
// =====================================================
function switchTab(t) {
  curTab=t; document.querySelectorAll('.tab[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===t));
  ['mop-view','staff-view','esc-view','prog-view'].forEach(id=>{ const el=$(id); if(el) el.style.display='none'; });
  if(t==='mop') { const v=$('mop-view'); if(v) v.style.display='block'; renderMop(); }
  if(t==='staff') { const v=$('staff-view'); if(v) v.style.display='block'; renderStaff(); }
  if(t==='escala') { const v=$('esc-view'); if(v) v.style.display='block'; renderEscala(); }
}

function renderMop() {
  const body=$('mop-body'); if(!body) return;
  const filtered=srt(mopData,'mop');
  body.innerHTML=filtered.map(r=>`<tr><td>${r.Colaborador}</td><td>${r['Célula']||''}</td><td>${badge(r.Status)}</td><td>${r['Horário']||''}</td></tr>`).join('');
}

function renderStaff() {
  const body=$('staff-body'); if(!body) return;
  const filtered=srt(staffData,'staff');
  body.innerHTML=filtered.map(r=>`<tr><td>${r.Colaborador}</td><td>${r['Cargo']||''}</td><td>${badge(r.Status)}</td></tr>`).join('');
}

function renderEscala() {
  const body=$('esc-body'); if(!body) return;
  const cols=DAY_COLS();
  const filtered=srt(escData,'escala');
  
  const head=$('esc-head');
  if(head) {
    head.innerHTML='<tr><th>Colaborador</th><th>Turno</th>'+cols.map(c=>`<th>${c}</th>`).join('')+'</tr>';
  }
  
  body.innerHTML=filtered.map(r=>{
    const h=r['Horário']||r.Horario||'—';
    return `<tr>
      <td><b>${r.Colaborador}</b></td>
      <td><small>${h}</small></td>
      ${cols.map(c=>{
        const val=r[c];
        const isH=isFeriado(c);
        const type=shiftFromRow(r,val,isH,isWE(c));
        return `<td class="cell-${type}">${typeof val==='number'?fmtM(val):val||''}</td>`;
      }).join('')}
    </tr>`;
  }).join('');
}

function shiftFromRow(row, val, isHoliday, weekend) {
  if (isHoliday) return 'h';
  const st=String(row.Status||'').toLowerCase();
  if (st==='férias') return 'v'; if (st==='afastado') return 'a';
  if (st==='day off') return 'd'; if (st==='folga') return 'f';
  if (val===''||val==null) return '';
  if (typeof val==='string'&&{'Folga':'f','Day Off':'d','BH':'b'}[val.trim()]) return 'f';
  return 'c';
}

function debouncedRender() {
  if(curTab==='mop') renderMop();
  if(curTab==='staff') renderStaff();
  if(curTab==='escala') renderEscala();
}

// =====================================================
// 11. EVENT LISTENERS GLOBAIS E GATILHOS DOS BOTÕES
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  // Configuração dos botões das abas principais
  document.querySelectorAll('.tab[data-tab]').forEach(t => {
    t.addEventListener('click', function() { switchTab(this.dataset.tab); });
  });

  // Gatilho do botão de Ausentes
  const bm=$('btn-show-miss'); if(bm) bm.addEventListener('click', showMissing);
  
  // CORREÇÃO DOS ID'S DO MODAL DE TROCA CASADA (Respeitando a imagem 2 e 3)
  const bs=$('btn-swap'); if(bs) bs.addEventListener('click', openSwap);
  const bsa=$('btn-troca-aplicar'); if(bsa) bsa.addEventListener('click', applySwap);
  
  // Fechamento automático de overlays via atributo data-close
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeOv(btn.dataset.close));
  });

  // Confirmação de escala individual
  const bf=$('btn-fill-ok'); if(bf) bf.addEventListener('click', confirmFill);
});