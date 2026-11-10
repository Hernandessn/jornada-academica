// Regra de presença mínima (RN02). Funções puras, sem banco, fáceis de testar.
const EPS = 1e-9;

const arredondar2 = (n) => Math.round(n * 100) / 100;

function percentualDe(horas, cargaTotal) {
  return cargaTotal > 0 ? (horas / cargaTotal) * 100 : 0;
}

// config = { modo_aprovacao: 'horas' | 'percentual', valor_minimo: número }
function estaElegivel(horas, cargaTotal, config) {
  if (!(horas > 0)) return false; // quem nunca esteve presente nunca é elegível

  if (config.modo_aprovacao === 'horas') {
    return horas + EPS >= config.valor_minimo;
  }

  // Modo percentual: compara horas*100 >= minimo*cargaTotal para evitar erro de ponto flutuante.
  if (!(cargaTotal > 0)) return false;
  return horas * 100 + EPS >= config.valor_minimo * cargaTotal;
}

module.exports = { arredondar2, percentualDe, estaElegivel };
