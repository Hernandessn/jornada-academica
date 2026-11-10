require('dotenv').config();

const ambiente = process.env.NODE_ENV || 'development';
const producao = ambiente === 'production';

const JWT_PADRAO_DEV = 'troque-este-segredo-em-desenvolvimento';

const jwtSecret = process.env.JWT_SECRET || JWT_PADRAO_DEV;
if (producao && (jwtSecret === JWT_PADRAO_DEV || jwtSecret.length < 32)) {
  throw new Error(
    'JWT_SECRET precisa ser definido em produção com pelo menos 32 caracteres.'
  );
}

const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const numero = (nome, padrao) => {
  const n = Number(process.env[nome]);
  return Number.isFinite(n) && n > 0 ? n : padrao;
};

module.exports = {
  ambiente,
  producao,
  porta: Number(process.env.PORT) || 3000,
  corsOrigins,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  databaseUrl: process.env.DATABASE_URL || '',
  // SSL com o PostgreSQL: ligado por padrão em produção. Use DATABASE_SSL=false
  // se o banco for acessado por rede interna (ex.: URL interna do Railway).
  databaseSsl: process.env.DATABASE_SSL
    ? process.env.DATABASE_SSL.toLowerCase() !== 'false'
    : producao,
  sqliteFile: process.env.SQLITE_FILE || './dev.sqlite3',
  // Rate limit por IP, em janelas de 15 minutos.
  limites: {
    janelaMs: 15 * 60 * 1000,
    geral: numero('RATE_LIMIT_GERAL', 600),
    login: numero('RATE_LIMIT_LOGIN', 10),
    inscricoes: numero('RATE_LIMIT_INSCRICOES', 30),
  },
};
