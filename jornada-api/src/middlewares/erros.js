const { ZodError } = require('zod');
const { HttpError } = require('../erros');
const config = require('../config');

// 404 para rotas inexistentes, no mesmo formato de erro da API.
function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.path}` });
}

// Handler global: toda resposta de erro sai como { erro, campos? }.
// eslint-disable-next-line no-unused-vars
function tratarErros(err, req, res, next) {
  // Validação do zod -> 400 com a primeira mensagem de cada campo
  if (err instanceof ZodError) {
    const campos = {};
    for (const issue of err.issues) {
      const chave = issue.path.join('.') || '_';
      if (!campos[chave]) campos[chave] = issue.message;
    }
    return res.status(400).json({ erro: 'Dados inválidos.', campos });
  }

  // Erros lançados pela própria aplicação (400, 401, 403, 404, 409)
  if (err instanceof HttpError) {
    const corpo = { erro: err.message };
    if (err.campos) corpo.campos = err.campos;
    return res.status(err.status).json(corpo);
  }

  // Problemas no corpo da requisição
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Corpo da requisição grande demais.' });
  }

  // Qualquer outra coisa: loga no servidor e não vaza detalhes internos
  if (config.ambiente !== 'test') console.error(err);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}

module.exports = { rotaNaoEncontrada, tratarErros };
