// Instância única do Knex, compartilhada por toda a aplicação.
const knex = require('knex');
const configuracaoKnex = require('../knexfile');

module.exports = knex(configuracaoKnex);
