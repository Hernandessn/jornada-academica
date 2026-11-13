// Configuração inicial. Para mudar os padrões do seed, edite só o objeto abaixo.
// Depois de criada, o admin ajusta tudo via PUT /api/configuracoes.
// Só cria a linha se a tabela estiver vazia, para nunca sobrescrever a escolha do admin.
const CONFIGURACAO_INICIAL = {
  modo_aprovacao: 'percentual',
  valor_minimo: 75,
  carga_horaria_certificado: 20,
  certificados_a_partir_de: '2026-12-14',
  inscricoes_de: '2026-11-16',
  inscricoes_ate: '2026-11-30',
  ignorar_datas: false,
  coordenador_nome: '',
  reitora_nome: 'Dra. Roselane Moita Pierot',
};

exports.seed = async function seed(knex) {
  const existente = await knex('configuracoes').first();
  if (existente) {
    console.log('Configuração já existe; mantida.');
    return;
  }
  await knex('configuracoes').insert(CONFIGURACAO_INICIAL);
  console.log('Configuração padrão criada: percentual, mínimo 75%, inscrições de 16/11 a 30/11/2026.');
};
