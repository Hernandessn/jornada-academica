// Participantes externos (o edital aceita trabalhos de fora da instituição):
//  - alunos.instituicao: instituição de origem (opcional; vazia para alunos da Uninassau)
// A matrícula continua NOT NULL no banco: quem não tem matrícula é gravado com '' (texto vazio),
// o que evita recriar a tabela (arriscado no SQLite) e não afeta quem já está cadastrado.

exports.up = async function up(knex) {
  await knex.schema.alterTable('alunos', (t) => {
    t.string('instituicao', 150).nullable();
  });
};

exports.down = async function down(knex) {
  if (knex.client.config.client === 'better-sqlite3') {
    await knex.raw('ALTER TABLE ?? DROP COLUMN ??', ['alunos', 'instituicao']);
    return;
  }
  await knex.schema.alterTable('alunos', (t) => {
    t.dropColumn('instituicao');
  });
};
