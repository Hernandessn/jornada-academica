const rateLimit = require('express-rate-limit');
const config = require('../config');

function criarLimite({ max, mensagem, ...extra }) {
  return rateLimit({
    windowMs: config.limites.janelaMs,
    limit: max,
    standardHeaders: true,
    legacyHeaders: false,
    // Nos testes o limite fica desligado, a menos que o teste defina TESTAR_LIMITES (ver tests/limites.test.js).
    skip: () => config.ambiente === 'test' && !process.env.TESTAR_LIMITES,
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

// Consulta pública de certificado (CPF + e-mail): forte, contra tentativa de varrer CPFs.
// Conta todas as requisições (inclusive as de sucesso).
const limiteConsulta = criarLimite({
  max: config.limites.consulta,
  mensagem: 'Muitas consultas. Aguarde alguns minutos e tente novamente.',
});

module.exports = { limiteGeral, limiteLogin, limiteInscricoes, limiteConsulta };
