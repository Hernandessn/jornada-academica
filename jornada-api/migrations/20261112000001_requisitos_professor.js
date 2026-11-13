// Mudanças de requisitos pedidas pelo professor (12/11/2026):
//  - alunos: disciplina e formato do trabalho
//  - eventos: horário de início e fim de cada sessão
//  - configuracoes: período de inscrições, liberação dos certificados e nomes para o certificado
//
// Alunos já cadastrados ficam com disciplina/formato vazios (a API exige os campos só em novas inscrições).

const COLUNAS_CONFIGURACOES = [
  'carga_horaria_certificado',
  'certificados_a_partir_de',
  'inscricoes_de',
  'inscricoes_ate',
  'ignorar_datas',
  'coordenador_nome',
  'reitora_nome',
];

async function removerColunas(knex, tabela, colunas) {
  if (knex.client.config.client === 'better-sqlite3') {
    // O SQLite suporta DROP COLUMN direto; evita recriar a tabela (e mexer nas chaves estrangeiras).
    for (const coluna of colunas) {
      await knex.raw('ALTER TABLE ?? DROP COLUMN ??', [tabela, coluna]);
    }
    return;
  }
  await knex.schema.alterTable(tabela, (t) => {
    t.dropColumns(...colunas);
  });
}

exports.up = async function up(knex) {
  await knex.schema.alterTable('alunos', (t) => {
    t.string('disciplina', 20);
    t.string('formato', 20); // 'banner' ou 'comunicacao_oral'
  });

  await knex.schema.alterTable('eventos', (t) => {
    t.string('hora_inicio', 5); // 'HH:MM'
    t.string('hora_fim', 5);
  });

  await knex.schema.alterTable('configuracoes', (t) => {
    t.double('carga_horaria_certificado').notNullable().defaultTo(20);
    t.date('certificados_a_partir_de').notNullable().defaultTo('2026-12-14');
    t.date('inscricoes_de').notNullable().defaultTo('2026-11-16');
    t.date('inscricoes_ate').notNullable().defaultTo('2026-11-30');
    t.boolean('ignorar_datas').notNullable().defaultTo(false);
    t.string('coordenador_nome', 150).notNullable().defaultTo('');
    t.string('reitora_nome', 150).notNullable().defaultTo('Dra. Roselane Moita Pierot');
  });

  // Novo padrão da regra: 75%. Só troca quem ainda está no padrão antigo (horas, 20);
  // se o admin já escolheu outra regra, ela é respeitada.
  await knex('configuracoes')
    .where({ modo_aprovacao: 'horas', valor_minimo: 20 })
    .update({ modo_aprovacao: 'percentual', valor_minimo: 75 });
};

exports.down = async function down(knex) {
  await removerColunas(knex, 'configuracoes', COLUNAS_CONFIGURACOES);
  await removerColunas(knex, 'eventos', ['hora_inicio', 'hora_fim']);
  await removerColunas(knex, 'alunos', ['disciplina', 'formato']);
};
