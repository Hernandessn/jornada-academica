// Regra de presença inicial: modo "horas" com mínimo de 20 h.
// A regra oficial (20 h ou 75%) ainda não foi definida; o admin troca depois via PUT /api/configuracoes.
// Só cria a linha se a tabela estiver vazia, para nunca sobrescrever a escolha do admin.
exports.seed = async function seed(knex) {
  const existente = await knex('configuracoes').first();
  if (existente) {
    console.log('Configuração de presença já existe; mantida.');
    return;
  }
  await knex('configuracoes').insert({ modo_aprovacao: 'horas', valor_minimo: 20 });
  console.log('Configuração padrão criada: modo horas, mínimo 20.');
};
