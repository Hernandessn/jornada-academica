// Cria 1 admin e 1 professor a partir das variáveis SEED_* do .env.
// Pode rodar várias vezes: quem já existe (mesmo e-mail) não é alterado.
const bcrypt = require('bcryptjs');
const config = require('../src/config');

const SENHA_PADRAO_ADMIN = 'trocar-admin-123';
const SENHA_PADRAO_PROFESSOR = 'trocar-professor-123';

exports.seed = async function seed(knex) {
  const usuarios = [
    {
      nome: 'Administrador',
      email: (process.env.SEED_ADMIN_EMAIL || 'admin@jornada.local').trim().toLowerCase(),
      senha: process.env.SEED_ADMIN_SENHA || SENHA_PADRAO_ADMIN,
      senhaPadrao: SENHA_PADRAO_ADMIN,
      papel: 'admin',
    },
    {
      nome: 'Professor',
      email: (process.env.SEED_PROFESSOR_EMAIL || 'professor@jornada.local').trim().toLowerCase(),
      senha: process.env.SEED_PROFESSOR_SENHA || SENHA_PADRAO_PROFESSOR,
      senhaPadrao: SENHA_PADRAO_PROFESSOR,
      papel: 'professor',
    },
  ];

  for (const u of usuarios) {
    if (u.senha.length < 8) {
      throw new Error(`Senha do seed (${u.papel}) precisa ter pelo menos 8 caracteres.`);
    }
    if (config.producao && u.senha === u.senhaPadrao) {
      throw new Error(
        `Defina SEED_${u.papel.toUpperCase()}_SENHA com uma senha própria antes de rodar o seed em produção.`
      );
    }

    const existente = await knex('usuarios').where({ email: u.email }).first();
    if (existente) {
      console.log(`Usuário ${u.email} já existe; mantido sem alterações.`);
      continue;
    }

    await knex('usuarios').insert({
      nome: u.nome,
      email: u.email,
      senha_hash: bcrypt.hashSync(u.senha, 10),
      papel: u.papel,
    });
    console.log(`Usuário ${u.papel} criado: ${u.email}`);
  }
};
