// Erro de aplicação com status HTTP e, opcionalmente, mensagens por campo.
// Formato de resposta padronizado: { "erro": "mensagem", "campos": { "cpf": "..." } }
class HttpError extends Error {
  constructor(status, mensagem, campos) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
  }
}

const badRequest = (msg, campos) => new HttpError(400, msg, campos);
const naoAutenticado = (msg = 'Autenticação necessária.') => new HttpError(401, msg);
const proibido = (msg = 'Você não tem permissão para esta ação.') => new HttpError(403, msg);
const naoEncontrado = (msg = 'Recurso não encontrado.') => new HttpError(404, msg);
const conflito = (msg, campos) => new HttpError(409, msg, campos);

module.exports = {
  HttpError,
  badRequest,
  naoAutenticado,
  proibido,
  naoEncontrado,
  conflito,
};
