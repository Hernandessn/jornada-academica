const jwt = require('jsonwebtoken');
const config = require('../config');
const { naoAutenticado, proibido } = require('../erros');

// Exige "Authorization: Bearer <token>" válido. Preenche req.usuario = { id, papel, nome }.
function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const [tipo, token] = cabecalho.split(' ');

  if (!tipo || tipo.toLowerCase() !== 'bearer' || !token) {
    return next(naoAutenticado());
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.usuario = { id: Number(payload.sub), papel: payload.papel, nome: payload.nome };
    return next();
  } catch (err) {
    return next(naoAutenticado('Token inválido ou expirado.'));
  }
}

// Uso: exigirPapel('admin')  ou  exigirPapel('professor', 'admin'). Sempre depois de autenticar.
function exigirPapel(...papeis) {
  return (req, res, next) => {
    if (!req.usuario) return next(naoAutenticado());
    if (!papeis.includes(req.usuario.papel)) return next(proibido());
    return next();
  };
}

module.exports = { autenticar, exigirPapel };
