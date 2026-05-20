// ===== CORREÇÃO IMPORTAÇÃO DE ESCALAS =====

// Adicione esta função no script.js
function normalizarData(valor) {
  if (valor === null || valor === undefined || valor === '') return null;

  // Data serial do Excel (ex: 46174)
  if (!isNaN(valor) && String(valor).trim() !== '') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const data = new Date(excelEpoch.getTime() + Number(valor) * 86400000);
    return data.toISOString().slice(0, 10);
  }

  const texto = String(valor).trim();

  // DD/MM/AAAA
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    return `${br[3]}-${br[2]}-${br[1]}`;
  }

  // AAAA-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  return null;
}

// ===== AJUSTE NO MAPEAMENTO DA IMPORTAÇÃO =====

// Troque:
data: get(d, ['Data'])

// Por:
data: normalizarData(get(d, ['Data', 'DATA', 'data']))


// Se existir Data fim, troque:
data_fim: get(d, ['Data fim'])

// Por:
data_fim: normalizarData(
  get(d, ['Data fim', 'DATA FIM', 'data_fim'])
)
