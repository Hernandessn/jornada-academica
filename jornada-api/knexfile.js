// Configuração do Knex (usada pela CLI: npm run migrate / npm run seed) e por src/db.js.
//
// Qual banco é usado:
//   - NODE_ENV=test           -> SQLite em memória (os testes nunca tocam no banco de desenvolvimento)
//   - DATABASE_URL preenchida -> PostgreSQL (produção no Render/Railway)
//   - caso contrário          -> SQLite no arquivo SQLITE_FILE (desenvolvimento)
const path = require('path');
const config = require('./src/config');

const comum = {
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.join(__dirname, 'seeds'),
  },
};

function sqlite(arquivo) {
  return {
    ...comum,
    client: 'better-sqlite3',
    connection: { filename: arquivo },
    useNullAsDefault: true,
    // Uma conexão só: simples e evita "database is locked" no SQLite.
    pool: {
      min: 1,
      max: 1,
      // O SQLite não aplica chaves estrangeiras por padrão; aqui ligamos.
      afterCreate(conn, done) {
        conn.pragma('foreign_keys = ON');
        done();
      },
    },
  };
}

function postgres() {
  const pg = require('pg');
  // Colunas "date" voltam como texto 'AAAA-MM-DD' (e não como Date, que muda com fuso horário).
  pg.types.setTypeParser(1082, (valor) => valor);

  return {
    ...comum,
    client: 'pg',
    connection: {
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
    },
    pool: { min: 0, max: 10 },
  };
}

function escolher() {
  if (config.ambiente === 'test') return sqlite(':memory:');
  if (config.databaseUrl) return postgres();
  return sqlite(path.resolve(config.sqliteFile));
}

module.exports = escolher();
