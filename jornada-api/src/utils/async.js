// Express 4 não captura erros de funções async; este wrapper repassa o erro ao handler global.
const assincrono = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { assincrono };
