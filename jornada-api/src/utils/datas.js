// Datas "AAAA-MM-DD" (como o banco guarda). Tudo calculado no fuso de São Paulo,
// porque o servidor (Render/Railway) roda em UTC e "hoje" mudaria às 21h no horário de Brasília.
const FUSO = 'America/Sao_Paulo';

const formatador = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Data de hoje em São Paulo, como 'AAAA-MM-DD'.
function hojeSaoPaulo(agora = new Date()) {
  const partes = {};
  for (const p of formatador.formatToParts(agora)) partes[p.type] = p.value;
  return `${partes.year}-${partes.month}-${partes.day}`;
}

// true só para datas reais no formato AAAA-MM-DD (rejeita 2026-13-40, 16/11/2026 etc.).
function dataValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function somarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

// '2026-11-16' -> '16/11/2026'
function formatarDataBr(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

module.exports = { hojeSaoPaulo, dataValida, somarDias, formatarDataBr };
