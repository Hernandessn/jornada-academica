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

// Variável booleana: aceita true/false, 1/0, sim/nao. Vazia ou ausente = padrão.
const booleano = (nome, padrao) => {
  const v = (process.env[nome] || '').trim().toLowerCase();
  if (!v) return padrao;
  return ['true', '1', 'sim', 'yes'].includes(v);
};

module.exports = {
  ambiente,
  producao,
  porta: Number(process.env.PORT) || 3000,
  url: process.env.APP_URL || 'http://localhost',
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
  // E-mail dos certificados (ver src/servicos/email.js).
  email: {
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
  },
  // Arquivo enviado na inscrição (PDF, DOC, DOCX, ODT): limite por arquivo, em MB.
  // Fica na memória durante o envio e depois no banco; no Render gratuito (512 MB de RAM) não exagere.
  upload: {
    maxMb: numero('UPLOAD_MAX_MB', 10),
  },
  // Regras do formulário de inscrição ainda dependentes de decisão do professor.
  inscricao: {
    resumoObrigatorio: booleano('RESUMO_OBRIGATORIO', false),
    arquivoObrigatorio: booleano('ARQUIVO_OBRIGATORIO', false),
    instituicaoObrigatoriaExterno: booleano('INSTITUICAO_OBRIGATORIA_EXTERNO', true),
  },
  // Rate limit por IP, em janelas de 15 minutos.
  limites: {
    janelaMs: 15 * 60 * 1000,
    geral: numero('RATE_LIMIT_GERAL', 600),
    login: numero('RATE_LIMIT_LOGIN', 10),
    inscricoes: numero('RATE_LIMIT_INSCRICOES', 30),
    consulta: numero('RATE_LIMIT_CONSULTA', 10),
    download: numero('RATE_LIMIT_DOWNLOAD', 10),
  },
};
