// Cria as 6 tabelas do modelo de dados, com os nomes definidos no documento de requisitos.
// Funciona igual em SQLite (desenvolvimento) e PostgreSQL (produção).

exports.up = async function up(knex) {
  await knex.schema.createTable('alunos', (t) => {
    t.increments('id');
    t.string('nome', 150).notNullable();
    t.string('email', 150).notNullable().unique(); // RN01: e-mail único (guardado em minúsculas)
    t.string('telefone', 20).notNullable(); // só dígitos
    t.string('cpf', 11).notNullable().unique(); // RN01: CPF único, só dígitos
    t.string('matricula', 30).notNullable(); // só dígitos
    t.string('curso', 100).notNullable();
    t.timestamp('criado_em').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('eventos', (t) => {
    t.increments('id');
    t.string('titulo', 150).notNullable();
    t.date('data').notNullable();
    t.double('carga_horaria').notNullable(); // em horas
  });

  await knex.schema.createTable('usuarios', (t) => {
    t.increments('id');
    t.string('nome', 150).notNullable();
    t.string('email', 150).notNullable().unique();
    t.string('senha_hash', 100).notNullable();
    t.enu('papel', ['professor', 'admin']).notNullable();
  });

  await knex.schema.createTable('frequencia', (t) => {
    t.increments('id');
    t.integer('aluno_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('alunos')
      .onDelete('CASCADE');
    t.integer('evento_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('eventos')
      .onDelete('CASCADE');
    t.timestamp('registrado_em').notNullable().defaultTo(knex.fn.now());
    t.integer('registrado_por').unsigned().notNullable().references('id').inTable('usuarios');
    t.unique(['aluno_id', 'evento_id']); // RN04: presença única por aluno e evento
    t.index(['evento_id']);
  });

  // Tabela de uma linha só: a regra de presença vigente.
  await knex.schema.createTable('configuracoes', (t) => {
    t.enu('modo_aprovacao', ['horas', 'percentual']).notNullable();
    t.double('valor_minimo').notNullable();
  });

  await knex.schema.createTable('certificados', (t) => {
    t.increments('id');
    t.integer('aluno_id')
      .unsigned()
      .notNullable()
      .unique() // um certificado por aluno
      .references('id')
      .inTable('alunos')
      .onDelete('CASCADE');
    t.timestamp('enviado_em').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('certificados');
  await knex.schema.dropTableIfExists('configuracoes');
  await knex.schema.dropTableIfExists('frequencia');
  await knex.schema.dropTableIfExists('usuarios');
  await knex.schema.dropTableIfExists('eventos');
  await knex.schema.dropTableIfExists('alunos');
};
