const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const { rotaNaoEncontrada, tratarErros } = require('./middlewares/erros');
const { limiteGeral, limiteLogin, limiteInscricoes } = require('./middlewares/limites');
const rotasAuth = require('./rotas/auth');
const rotasEventos = require('./rotas/eventos');
const rotasInscricoes = require('./rotas/inscricoes');
const rotasAlunos = require('./rotas/alunos');
const rotasFrequencia = require('./rotas/frequencia');
const rotasConfiguracoes = require('./rotas/configuracoes');
const rotasCertificados = require('./rotas/certificados');

function criarApp() {
  const app = express();

  // Atrás de proxy (Render/Railway): necessário para o rate limit ver o IP real.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());

  // CORS com origem configurável. "*" libera tudo (só para desenvolvimento).
  const liberaTudo = config.corsOrigins.includes('*');
  app.use(
    cors({
      origin(origin, cb) {
        // Sem header Origin (curl, Postman, mesmo domínio): permitido.
        if (!origin || liberaTudo || config.corsOrigins.includes(origin)) {
          return cb(null, true);
        }
        return cb(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '100kb' }));

  // Rota de saúde (usada também pelo health check do Render/Railway)
  app.get('/api/saude', (req, res) => {
    res.json({
      status: 'ok',
      servico: 'jornada-api',
      ambiente: config.ambiente,
      hora: new Date().toISOString(),
    });
  });

  // Rate limit geral em tudo que fica abaixo (a rota de saúde fica de fora).
  app.use('/api', limiteGeral);

  app.use('/api/auth', limiteLogin, rotasAuth);
  app.use('/api/inscricoes', limiteInscricoes, rotasInscricoes);
  app.use('/api/eventos', rotasEventos);
  app.use('/api/alunos', rotasAlunos);
  app.use('/api/frequencia', rotasFrequencia);
  app.use('/api/configuracoes', rotasConfiguracoes);
  // /api/certificados: a consulta pública está pronta; POST /api/certificados/emitir (admin) será
  // acrescentado em src/rotas/certificados.js pelo módulo de certificado.
  app.use('/api/certificados', rotasCertificados);

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);

  return app;
}

module.exports = { criarApp };
