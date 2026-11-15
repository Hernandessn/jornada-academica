// Envio do certificado por e-mail.
//
// Três modos, escolhidos pelas variáveis de ambiente (nesta ordem):
//   1) RESEND_API_KEY definida -> API HTTPS do Resend (funciona em qualquer plano do Render/Railway)
//   2) SMTP_HOST definido      -> SMTP via nodemailer (Gmail, Brevo, Mailtrap...)
//   3) nada definido, fora de produção -> Ethereal (caixa de teste): imprime o link de pré-visualização
// Em produção, sem credenciais, o envio falha com uma mensagem clara dizendo o que falta.
//
// Nunca registramos em log o endereço do destinatário, senhas nem o conteúdo do PDF.
const nodemailer = require('nodemailer');
const config = require('../config');

const ASSUNTO = 'Seu certificado da VI Jornada Acadêmica da Uninassau Teresina';
const NOME_ANEXO = 'certificado-jornada-academica.pdf';
const TIMEOUT_MS = 30000;
const REMETENTE_PADRAO_DEV = 'Jornada Acadêmica <nao-responder@jornada.local>';

// Erro com um código curto (seguro para aparecer em respostas e logs, ao contrário da mensagem do servidor SMTP).
class ErroEmail extends Error {
  constructor(mensagem, codigo) {
    super(mensagem);
    this.codigo = codigo;
  }
}

function modo() {
  const { resendApiKey, smtpHost } = config.email;
  if (resendApiKey) return 'resend';
  if (smtpHost) return 'smtp';
  return config.producao ? null : 'ethereal';
}

// Lista as variáveis que faltam para o modo atual (vazia = tudo certo).
function variaveisFaltando() {
  const e = config.email;
  const m = modo();
  const faltam = [];

  if (m === null) {
    faltam.push('SMTP_HOST (ou RESEND_API_KEY)', 'SMTP_USER', 'SMTP_PASS');
  } else if (m === 'smtp' && config.producao) {
    if (!e.smtpUser) faltam.push('SMTP_USER');
    if (!e.smtpPass) faltam.push('SMTP_PASS');
  }
  // Fora de produção o remetente tem um valor padrão; em produção é obrigatório.
  if ((m === null || m === 'resend' || m === 'smtp') && config.producao && !e.from) {
    faltam.push('EMAIL_FROM');
  }
  return faltam;
}

const emailConfigurado = () => variaveisFaltando().length === 0;

function mensagemConfiguracaoEmail() {
  const faltam = variaveisFaltando();
  return faltam.length
    ? `O envio de e-mail não está configurado. Defina: ${faltam.join(', ')}.`
    : 'O envio de e-mail está configurado.';
}

const remetente = () => config.email.from || REMETENTE_PADRAO_DEV;

const escaparHtml = (t) =>
  String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function montarMensagem(nome) {
  const primeiroNome = String(nome || '').trim().split(/\s+/)[0] || 'participante';
  const texto = [
    `Olá, ${primeiroNome}!`,
    '',
    'Muito obrigado por participar da VI Jornada Acadêmica da Uninassau Teresina. Foi uma alegria contar com a sua presença e com o seu envolvimento ao longo do evento.',
    '',
    `Em anexo, segue o seu certificado de participação em PDF (${NOME_ANEXO}).`,
    '',
    'Um abraço,',
    'Organização da VI Jornada Acadêmica',
    'UNINASSAU Teresina',
  ].join('\n');

  const html = `<div style="font-family: Arial, Helvetica, sans-serif; color: #1d1e5b; line-height: 1.5;">
  <p>Olá, <strong>${escaparHtml(primeiroNome)}</strong>!</p>
  <p>Muito obrigado por participar da <strong>VI Jornada Acadêmica da Uninassau Teresina</strong>. Foi uma alegria contar com a sua presença e com o seu envolvimento ao longo do evento.</p>
  <p>Em anexo, segue o seu certificado de participação em PDF (<em>${NOME_ANEXO}</em>).</p>
  <p>Um abraço,<br>Organização da VI Jornada Acadêmica<br>UNINASSAU Teresina</p>
</div>`;

  return { texto, html };
}

// Transporte SMTP reaproveitado entre os envios do lote.
let transporte = null;

async function obterTransporte() {
  if (transporte) return transporte;

  const e = config.email;
  if (modo() === 'smtp') {
    transporte = nodemailer.createTransport({
      host: e.smtpHost,
      port: e.smtpPort,
      secure: e.smtpPort === 465,
      auth: e.smtpUser ? { user: e.smtpUser, pass: e.smtpPass } : undefined,
      pool: true,
      maxConnections: 1,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: TIMEOUT_MS,
    });
    return transporte;
  }

  // Ethereal: cria uma caixa de teste descartável (precisa de internet).
  const conta = await nodemailer.createTestAccount();
  transporte = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: conta.user, pass: conta.pass },
  });
  return transporte;
}

async function enviarPorResend({ para, texto, html, pdf }) {
  let resposta;
  try {
    resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: remetente(),
        to: [para],
        subject: ASSUNTO,
        text: texto,
        html,
        attachments: [{ filename: NOME_ANEXO, content: pdf.toString('base64') }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const tempo = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new ErroEmail('Não foi possível falar com o Resend.', tempo ? 'RESEND_TIMEOUT' : 'RESEND_REDE');
  }

  if (!resposta.ok) {
    // O corpo da resposta pode citar o destinatário: não é repassado, só o status HTTP.
    throw new ErroEmail(`O Resend recusou o envio (HTTP ${resposta.status}).`, `RESEND_${resposta.status}`);
  }
  const dados = await resposta.json().catch(() => ({}));
  return { id: dados.id || null, previewUrl: null };
}

/**
 * Envia o certificado em anexo.
 * @param {{ para: string, nome: string, pdf: Buffer }} dados
 * @returns {Promise<{ id: string|null, previewUrl: string|null }>}
 */
async function enviarCertificado({ para, nome, pdf }) {
  const faltam = variaveisFaltando();
  if (faltam.length) {
    throw new ErroEmail(mensagemConfiguracaoEmail(), 'EMAIL_NAO_CONFIGURADO');
  }

  const { texto, html } = montarMensagem(nome);

  if (modo() === 'resend') {
    return enviarPorResend({ para, texto, html, pdf });
  }

  const canal = await obterTransporte();
  const info = await canal.sendMail({
    from: remetente(),
    to: para,
    subject: ASSUNTO,
    text: texto,
    html,
    attachments: [{ filename: NOME_ANEXO, content: pdf, contentType: 'application/pdf' }],
  });

  const previewUrl = modo() === 'ethereal' ? nodemailer.getTestMessageUrl(info) || null : null;
  if (previewUrl) {
    console.log(`E-mail de teste (Ethereal). Pré-visualização: ${previewUrl}`);
  }
  return { id: info.messageId || null, previewUrl };
}

module.exports = {
  ASSUNTO,
  NOME_ANEXO,
  ErroEmail,
  emailConfigurado,
  mensagemConfiguracaoEmail,
  enviarCertificado,
};
