// Regras de data: período de inscrições e liberação dos certificados.
// "ignorar_datas" (configuração do admin) desliga as duas travas, útil para testes e apresentação.
const { hojeSaoPaulo, formatarDataBr } = require('../utils/datas');

// Retorna null se as inscrições estão abertas, ou a mensagem do motivo se estão fechadas.
// O período é inclusivo: vale do dia inscricoes_de até o fim do dia inscricoes_ate.
function motivoInscricoesFechadas(config, hoje = hojeSaoPaulo()) {
  if (config.ignorar_datas) return null;
  if (hoje < config.inscricoes_de) {
    return `As inscrições ainda não começaram. Elas abrem em ${formatarDataBr(config.inscricoes_de)}.`;
  }
  if (hoje > config.inscricoes_ate) {
    return `As inscrições foram encerradas em ${formatarDataBr(config.inscricoes_ate)}.`;
  }
  return null;
}

// Os certificados ficam disponíveis a partir do dia certificados_a_partir_de (inclusive).
function certificadosLiberados(config, hoje = hojeSaoPaulo()) {
  if (config.ignorar_datas) return true;
  return hoje >= config.certificados_a_partir_de;
}

module.exports = { motivoInscricoesFechadas, certificadosLiberados };
