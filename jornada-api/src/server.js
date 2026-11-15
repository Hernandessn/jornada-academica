const config = require('./config');
const { criarApp } = require('./app');

const app = criarApp();

const servidor = app.listen(config.porta, '0.0.0.0', () => {
  console.log(
    `API da Jornada iniciada na porta ${config.porta} (${config.ambiente})`
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
