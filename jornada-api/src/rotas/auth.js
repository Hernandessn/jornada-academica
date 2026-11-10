const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../db');
const config = require('../config');
const { naoAutenticado } = require('../erros');
const { assincrono } = require('../utils/async');

const router = express.Router();

const texto = (msg) => z.string({ required_error: msg, invalid_type_error: msg });

const loginSchema = z.object({
  email: texto('Informe o e-mail.').trim().min(1, 'Informe o e-mail.'),
  senha: texto('Informe a senha.').min(1, 'Informe a senha.'),
});

// Hash falso: se o e-mail não existir, ainda gastamos o mesmo tempo comparando, para não
// revelar (pelo tempo de resposta) quais e-mails têm conta.
const HASH_FALSO = bcrypt.hashSync('senha-que-nao-existe', 10);

// POST /api/auth/login  { email, senha } -> { token, expira_em, usuario }
router.post(
  '/login',
  assincrono(async (req, res) => {
    const { email, senha } = loginSchema.parse(req.body ?? {});

    const usuario = await db('usuarios').where({ email: email.toLowerCase() }).first();
    const senhaConfere = await bcrypt.compare(senha, usuario ? usuario.senha_hash : HASH_FALSO);

    if (!usuario || !senhaConfere) {
      throw naoAutenticado('E-mail ou senha incorretos.');
    }

    const token = jwt.sign({ papel: usuario.papel, nome: usuario.nome }, config.jwtSecret, {
      algorithm: 'HS256',
      subject: String(usuario.id),
      expiresIn: config.jwtExpiresIn,
    });

    res.json({
      token,
      expira_em: config.jwtExpiresIn,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
    });
  })
);

module.exports = router;
