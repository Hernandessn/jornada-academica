// Resumo e arquivo do trabalho (formulário de inscrição):
//  - alunos.resumo: texto livre (até 2000 caracteres, validado pela API), opcional.
//  - arquivos_inscricao: o arquivo enviado (PDF, DOC, DOCX ou ODT), um por aluno.
//    Fica em tabela separada para as listagens de alunos nunca carregarem o conteúdo.
//    O conteúdo é gravado no próprio banco (coluna binária): o disco do Render gratuito é
//    efêmero e apagaria arquivos locais a cada reinício. Migration ADITIVA: não altera dados.

exports.up = async function up(knex) {
  await knex.schema.alterTable('alunos', (t) => {
    t.text('resumo').nullable();
  });

  await knex.schema.createTable('arquivos_inscricao', (t) => {
    t.increments('id');
    t.integer('aluno_id')
      .unsigned()
      .notNullable()
      .unique() // um arquivo por inscrição
      .references('id')
      .inTable('alunos')
      .onDelete('CASCADE');
    t.string('nome_original', 255).notNullable(); // já sanitizado (sem caminho nem caracteres de controle)
    t.string('extensao', 10).notNullable(); // pdf, doc, docx ou odt
    t.string('tipo_mime', 100).notNullable(); // escolhido pelo servidor a partir da extensão
    t.integer('tamanho').notNullable(); // em bytes
    t.binary('conteudo').notNullable();
    t.timestamp('criado_em').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('arquivos_inscricao');
  if (knex.client.config.client === 'better-sqlite3') {
    await knex.raw('ALTER TABLE ?? DROP COLUMN ??', ['alunos', 'resumo']);
    return;
  }
  await knex.schema.alterTable('alunos', (t) => {
    t.dropColumn('resumo');
  });
};
