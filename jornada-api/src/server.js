const config = require('./config');
const { criarApp } = require('./app');

const app = criarApp();

const servidor = app.listen(config.porta, '0.0.0.0', () => {
  const endereco = config.producao
    ? config.url
    : `${config.url}:${config.porta}`;

  console.log(
    `API da Jornada rodando em ${endereco} (${config.ambiente})`
  );
});

// Encerramento limpo (Render/Railway enviam SIGTERM ao fazer novo deploy)
function encerrar() {
  console.log('Encerrando servidor...');

  servidor.close(() => {
    console.log('Servidor encerrado com sucesso.');
    process.exit(0);
  });
}

process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
