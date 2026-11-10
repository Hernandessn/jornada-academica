const rateLimit = require('express-rate-limit');
const config = require('../config');

function criarLimite({ max, mensagem, ...extra }) {
  return rateLimit({
    windowMs: config.limites.janelaMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.ambiente === 'test', // os testes automatizados não esbarram no limite
    handler: (req, res) => res.status(429).json({ erro: mensagem }),
    ...extra,
  });
}

// Geral: folga grande, porque muitos alunos podem sair pelo mesmo IP (wi-fi da faculdade).
const limiteGeral = criarLimite({
  max: config.limites.geral,
  mensagem: 'Muitas requisições. Aguarde alguns minutos e tente novamente.',
});

// Login: restrito contra tentativa de adivinhar senha (só conta as tentativas que falham).
const limiteLogin = criarLimite({
  max: config.limites.login,
  skipSuccessfulRequests: true,
  mensagem: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
});

// Inscrições: evita criação em massa de cadastros falsos.
const limiteInscricoes = criarLimite({
  max: config.limites.inscricoes,
  mensagem: 'Muitas tentativas de inscrição. Aguarde alguns minutos e tente novamente.',
});

module.exports = { limiteGeral, limiteLogin, limiteInscricoes };
