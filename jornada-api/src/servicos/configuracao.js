const db = require('../db');

const CONFIGURACAO_PADRAO = { modo_aprovacao: 'horas', valor_minimo: 20 };

// Lê a regra de presença vigente. Se a tabela estiver vazia (seed não rodou), usa o padrão.
async function obterConfiguracao(conn = db) {
  const linha = await conn('configuracoes').first('modo_aprovacao', 'valor_minimo');
  if (!linha) return { ...CONFIGURACAO_PADRAO };
  return { modo_aprovacao: linha.modo_aprovacao, valor_minimo: Number(linha.valor_minimo) };
}

// A tabela guarda uma linha só: atualiza se existir, senão cria.
async function salvarConfiguracao({ modo_aprovacao, valor_minimo }, conn = db) {
  const atualizadas = await conn('configuracoes').update({ modo_aprovacao, valor_minimo });
  if (!atualizadas) {
    await conn('configuracoes').insert({ modo_aprovacao, valor_minimo });
  }
  return obterConfiguracao(conn);
}

module.exports = { CONFIGURACAO_PADRAO, obterConfiguracao, salvarConfiguracao };
