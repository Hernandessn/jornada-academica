const config = require('./config');
const { criarApp } = require('./app');

const app = criarApp();

console.log(
  `API da Jornada rodando em ${config.url}${config.porta ? `:${config.porta}` : ''} (${config.ambiente})`
);
// Encerramento limpo (Render/Railway enviam SIGTERM ao fazer novo deploy)
function encerrar() {
  servidor.close(() => process.exit(0));
}
process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
