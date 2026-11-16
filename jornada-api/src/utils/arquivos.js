// Regras do arquivo enviado na inscrição. A validação do servidor é a que vale
// (a do front é só conveniência).
const path = require('path');
const config = require('../config');

// Extensões aceitas -> tipo MIME escolhido PELO SERVIDOR (nunca o que o cliente envia).
const TIPOS = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
};

// Primeiros bytes de cada formato.
const ASSINATURAS = {
  pdf: [Buffer.from('%PDF-', 'latin1')],
  doc: [Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
  docx: [Buffer.from([0x50, 0x4b, 0x03, 0x04])], // "PK\x03\x04" (ZIP)
  odt: [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
};

const MSG_FORMATO = 'Envie um arquivo PDF, DOC, DOCX ou ODT.';

const limiteBytes = () => Math.round(config.upload.maxMb * 1024 * 1024);
const msgTamanho = () => `O arquivo deve ter até ${config.upload.maxMb} MB.`;

// O multer/busboy lê o nome do arquivo como latin1; os navegadores enviam UTF-8.
// Sem esta correção, "relatório.pdf" viraria "relatÃ³rio.pdf".
function corrigirCodificacao(nome) {
  const corrigido = Buffer.from(String(nome), 'latin1').toString('utf8');
  return corrigido.includes('\uFFFD') ? String(nome) : corrigido;
}

function extensaoDe(nome) {
  return path.extname(String(nome || '')).slice(1).toLowerCase();
}

// Nome seguro para guardar e devolver no download: sem caminho, sem caracteres de controle
// e sem marcadores de direção de texto (usados para disfarçar extensões). Mantém a extensão.
function nomeSeguro(nomeBruto, extensao) {
  let nome = String(nomeBruto || '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
  nome = nome.split(/[\\/]/).pop(); // só o último trecho (remove "..\\", "/etc/" etc.)
  nome = nome.replace(/["<>:*?|]/g, '_').replace(/\s+/g, ' ').trim();

  const ext = extensao ? `.${extensao}` : '';
  let base = ext && nome.toLowerCase().endsWith(ext) ? nome.slice(0, -ext.length) : nome;
  base = base.replace(/^\.+/, '').trim().slice(0, 150);
  if (!base) base = 'arquivo';
  return `${base}${ext}`;
}

// Cabeçalho Content-Disposition de download (sempre "attachment"): um nome só com ASCII para
// clientes antigos e o nome real em UTF-8 (RFC 5987), então os acentos chegam certos em qualquer navegador.
function cabecalhoDownload(nome) {
  const ascii = String(nome).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(nome).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

// Valida o arquivo recebido (objeto do multer ou undefined).
// Devolve { erro } com a mensagem para campos.arquivo, ou { dados } pronto para gravar,
// ou {} quando não há arquivo e ele não é obrigatório.
function validarArquivo(arquivo) {
  if (!arquivo) {
    return config.inscricao.arquivoObrigatorio ? { erro: 'Envie o arquivo do trabalho.' } : {};
  }

  const nomeOriginal = corrigirCodificacao(arquivo.originalname);
  const extensao = extensaoDe(nomeOriginal);
  if (!TIPOS[extensao]) return { erro: MSG_FORMATO };

  const conteudo = arquivo.buffer;
  if (!Buffer.isBuffer(conteudo) || conteudo.length === 0) return { erro: 'O arquivo está vazio.' };
  if (conteudo.length > limiteBytes()) return { erro: msgTamanho() };

  const confere = ASSINATURAS[extensao].some((a) => conteudo.subarray(0, a.length).equals(a));
  if (!confere) return { erro: `O arquivo não parece ser um ${extensao.toUpperCase()} válido.` };

  return {
    dados: {
      nome_original: nomeSeguro(nomeOriginal, extensao),
      extensao,
      tipo_mime: TIPOS[extensao],
      tamanho: conteudo.length,
      conteudo,
    },
  };
}

module.exports = {
  TIPOS,
  MSG_FORMATO,
  limiteBytes,
  msgTamanho,
  corrigirCodificacao,
  extensaoDe,
  nomeSeguro,
  cabecalhoDownload,
  validarArquivo,
};
