(function () {
  function agendarExportadorMOP() {
    setTimeout(instalarExportadorMOP, 500);
    document.addEventListener('auth:ready', () => setTimeout(instalarExportadorMOP, 400));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', agendarExportadorMOP);
  } else {
    agendarExportadorMOP();
  }

  function instalarExportadorMOP() {
    if (window.__colaboradoresMOPExportPatch) return;
    if (typeof window.gerarRelatorio !== 'function' || typeof window.DB === 'undefined' || typeof window.XLSX === 'undefined') {
      setTimeout(instalarExportadorMOP, 500);
      return;
    }

    window.__colaboradoresMOPExportPatch = true;
    const gerarRelatorioOriginal = window.gerarRelatorio;
    const carregarRelatoriosOriginal = window.carregarRelatorios;

    window.gerarRelatorio = async function gerarRelatorioComMOP(tipo) {
      if (tipo === 'colaboradores') return gerarRelatorioColaboradoresMOP();
      return gerarRelatorioOriginal.apply(this, arguments);
    };

    window.carregarRelatorios = async function carregarRelatoriosComBotaoMOP() {
      const retorno = await carregarRelatoriosOriginal.apply(this, arguments);
      ajustarBotaoRelatorioColaboradores();
      return retorno;
    };

    ajustarBotaoRelatorioColaboradores();
  }

  async function gerarRelatorioColaboradoresMOP() {
    if (window.Security && !Security.requirePermission('exportar_relatorios')) return;
    window.toast?.('Gerando planilha MOP...', 'info');

    try {
      const dados = await DB.colaboradores.listar();
      if (!dados.length) {
        window.toast?.('Sem dados para exportar', 'warning');
        return;
      }

      const xlsx = await obterBibliotecaXLSXMOP();
      const workbook = xlsx.utils.book_new();
      const headers = [
        'Matrícula', 'Centro de custo', 'Colaborador', 'User Jira', 'User Blip', 'E-mail',
        'Reporte', 'Status', 'Célula', 'Grupo', 'Tipo', 'Horario', 'Escala', 'Saida',
        'Admissão', 'Tempo Meses', 'Cargo', 'Cpf', 'Data Nasc', 'Idade', 'Sexo',
        'Filial', 'Área', 'Telefone', 'Data Limite', 'Primeiro dia férias', 'Período'
      ];

      const rows = dados.map(colaboradorParaLinhaMOP);
      const sheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);
      aplicarFormatoMOP(sheet, rows.length, xlsx);

      xlsx.utils.book_append_sheet(workbook, sheet, 'MOP');
      xlsx.writeFile(workbook, `MOP_colaboradores_${dataHojeMOP()}.xlsx`, { cellDates: true });
      window.toast?.('Planilha MOP exportada com sucesso!', 'success');
    } catch (e) {
      window.toast?.('Erro ao gerar planilha MOP: ' + (e.message || e), 'error');
    }
  }

  function colaboradorParaLinhaMOP(c) {
    return [
      matriculaMOP(c.matricula),
      c.centro_custo || 'Mêntore',
      c.nome || '',
      c.user_jira || (c.nome ? `${c.nome} | Mêntore Bank` : ''),
      c.user_blip || nomeCurtoMOP(c.nome),
      c.email || '',
      c.reporte || c.supervisor || '',
      c.status || '',
      c.celula || '',
      c.grupo || '',
      c.tipo || '',
      horarioExcelMOP(c.horario),
      horarioExcelMOP(c.escala),
      null,
      dataExcelMOP(c.admissao),
      null,
      c.cargo || '',
      c.cpf || '',
      dataExcelMOP(c.data_nasc),
      null,
      c.sexo || '',
      c.filial || '',
      c.area || '',
      c.telefone || '',
      dataExcelMOP(c.data_limite),
      dataExcelMOP(c.primeiro_dia_ferias),
      periodoFeriasMOP(c)
    ];
  }

  function obterBibliotecaXLSXMOP() {
    return new Promise(resolve => {
      if (window.__xlsxStyleMOPLoaded) return resolve(window.XLSX);
      if (document.getElementById('xlsx-style-mop-lib')) return resolve(window.XLSX);

      const script = document.createElement('script');
      script.id = 'xlsx-style-mop-lib';
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
      script.onload = () => {
        window.__xlsxStyleMOPLoaded = true;
        resolve(window.XLSX);
      };
      script.onerror = () => resolve(window.XLSX);
      document.head.appendChild(script);
    });
  }

  function aplicarFormatoMOP(sheet, rowCount, xlsx) {
    const widths = [12.66, 18, 24.66, 34, 13.33, 26.78, 12.55, 10.33, 13.11, 10.33, 8.78, 11.33, 10.55, 9.66, 13.11, 16.33, 14.44, 11.11, 13.22, 9.89, 9.33, 13.22, 9.55, 12.44, 14.22, 19.78, 11.55];
    sheet['!cols'] = widths.map(wch => ({ wch }));
    sheet['!autofilter'] = { ref: `A1:AA${rowCount + 1}` };
    sheet['!freeze'] = { xSplit: 0, ySplit: 1 };

    const headerStyle = {
      fill: { fgColor: { rgb: '0A3041' } },
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: bordaMOP()
    };
    const dataStyle = {
      fill: { fgColor: { rgb: 'F2F2F2' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: bordaMOP()
    };

    for (let col = 0; col < 27; col++) {
      const cell = sheet[xlsx.utils.encode_cell({ r: 0, c: col })];
      if (cell) cell.s = headerStyle;
    }

    for (let row = 1; row <= rowCount; row++) {
      const excelRow = row + 1;
      for (let col = 0; col < 27; col++) {
        const ref = xlsx.utils.encode_cell({ r: row, c: col });
        if (!sheet[ref]) sheet[ref] = { t: 's', v: '' };
        sheet[ref].s = dataStyle;
      }

      definirFormato(sheet, `A${excelRow}`, '0000');
      definirFormato(sheet, `L${excelRow}`, 'hh:mm:ss');
      definirFormato(sheet, `M${excelRow}`, 'hh:mm:ss');
      definirFormula(sheet, `N${excelRow}`, `IF(OR(L${excelRow}="",M${excelRow}=""),"",L${excelRow}+M${excelRow})`, 'hh:mm:ss');
      definirFormato(sheet, `O${excelRow}`, 'mm-dd-yy');
      definirFormula(sheet, `P${excelRow}`, `IF(O${excelRow}="","",DATEDIF(O${excelRow},TODAY(),"m"))`, '0');
      definirFormato(sheet, `S${excelRow}`, 'mm-dd-yy');
      definirFormula(sheet, `T${excelRow}`, `IF(S${excelRow}="","",DATEDIF(S${excelRow},TODAY(),"y"))`, '0');
      definirFormato(sheet, `Y${excelRow}`, 'mm-dd-yy');
      definirFormato(sheet, `Z${excelRow}`, 'mm-dd-yy');
    }
  }

  function definirFormula(sheet, ref, formula, formato) {
    const atual = sheet[ref] || {};
    sheet[ref] = { ...atual, t: 'n', f: formula, z: formato, s: atual.s };
  }

  function definirFormato(sheet, ref, formato) {
    if (sheet[ref]) sheet[ref].z = formato;
  }

  function bordaMOP() {
    const linha = { style: 'hair', color: { rgb: '808080' } };
    return { top: linha, right: linha, bottom: linha, left: linha };
  }

  function matriculaMOP(valor) {
    const texto = String(valor || '').trim();
    if (/^\d+$/.test(texto)) return Number(texto);
    return texto;
  }

  function horarioExcelMOP(valor) {
    if (typeof valor === 'number') return valor;
    const match = String(valor || '').match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return valor || '';
    const h = Number(match[1]);
    const m = Number(match[2]);
    const s = Number(match[3] || 0);
    return (h * 3600 + m * 60 + s) / 86400;
  }

  function dataExcelMOP(valor) {
    if (!valor) return '';
    const data = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
    return Number.isNaN(data.getTime()) ? '' : data;
  }

  function nomeCurtoMOP(nome) {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '';
    if (partes.length === 1) return partes[0];
    return `${partes[0]} ${partes[partes.length - 1]}`;
  }

  function periodoFeriasMOP(c) {
    if (!c.primeiro_dia_ferias || !c.ultimo_dia_ferias) return '';
    const ini = new Date(`${String(c.primeiro_dia_ferias).slice(0, 10)}T00:00:00`);
    const fim = new Date(`${String(c.ultimo_dia_ferias).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) return '';
    const dias = Math.ceil((fim - ini) / 86400000) + 1;
    return `${dias} ${dias === 1 ? 'Dia' : 'Dias'}`;
  }

  function ajustarBotaoRelatorioColaboradores() {
    document.querySelectorAll('button[onclick*="gerarRelatorio"][onclick*="colaboradores"]').forEach(btn => {
      btn.textContent = 'Excel MOP';
      btn.title = 'Exportar colaboradores no formato da planilha MOP';
    });
  }

  function dataHojeMOP() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
})();