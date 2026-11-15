// Geração do certificado em PDF (A4 paisagem) sobre o modelo oficial.
//
// O modelo (assets/modelo-certificado.jpg) já traz impressos o texto, as "20 horas", as datas do evento
// e os blocos de assinatura. Este módulo escreve por cima:
//   1) o NOME do participante, sobre a linha "certifica que ____";
//   2) o nome da reitora e o do coordenador (lidos da configuração), cobrindo os placeholders
//      "[Nome do Reitor]" e "[Nome do Coordenador]" do modelo com um retângulo da cor do fundo.
// Observação: a carga horária (20 h) e as datas continuam as impressas no modelo. Se o modelo for
// trocado por uma versão limpa, ajuste LAYOUT abaixo (as medidas são em pixels do arquivo do modelo).
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkitModulo = require('@pdf-lib/fontkit');

const fontkit = fontkitModulo.default || fontkitModulo;

const RAIZ = path.join(__dirname, '..', '..');
const ARQUIVOS = {
  modelo: path.join(RAIZ, 'assets', 'modelo-certificado.jpg'),
  fonteRegular: path.join(RAIZ, 'assets', 'fonts', 'Carlito-Regular.ttf'),
  fonteNegrito: path.join(RAIZ, 'assets', 'fonts', 'Carlito-Bold.ttf'),
};

// A4 paisagem, em pontos. O modelo tem a mesma proporção (2339 x 1654 px = A4 a 200 dpi).
const PAGINA = { largura: 841.89, altura: 595.28 };
const MODELO_PX = { largura: 2339 };
const ESCALA = PAGINA.largura / MODELO_PX.largura; // pontos por pixel do modelo

const X = (px) => px * ESCALA;
const Y = (px) => PAGINA.altura - px * ESCALA; // y do PDF cresce para cima; o do modelo cresce para baixo
const cor = ([r, g, b]) => rgb(r / 255, g / 255, b / 255);

// Todas as posições são em pixels do modelo, medidos a partir do canto superior esquerdo.
const LAYOUT = {
  // Nome do participante: centralizado sobre a linha "certifica que ____" (x de 468 a 1644, y = 1021).
  nome: {
    centroX: 1056,
    linhaBaseY: 1012,
    larguraMax: 1090,
    tamanhoMax: 17, // pt; nomes longos reduzem até tamanhoMin
    tamanhoMin: 6,
    cor: [29, 30, 91],
  },
  // Cobre os placeholders das assinaturas e escreve os nomes reais. Ponha false para não mexer nelas.
  sobreporAssinaturas: true,
  corFundo: [254, 254, 254],
  corTextoAssinatura: [16, 23, 91],
  reitora: {
    centroX: 832.5,
    caixa: { x0: 560, x1: 1105, y0: 1327, y1: 1395 }, // cobre a linha do nome e a do cargo ("Reitor")
    nomeBaseY: 1354,
    cargoBaseY: 1390,
    cargo: 'Reitora',
    tamanhoNome: 10.56,
    tamanhoCargo: 10.89,
    larguraMax: 530,
  },
  coordenador: {
    centroX: 1526.5,
    caixa: { x0: 1255, x1: 1800, y0: 1327, y1: 1366 }, // só a linha do nome; o cargo impresso permanece
    nomeBaseY: 1354,
    tamanhoNome: 10.56,
    larguraMax: 530,
  },
};

const MAX_CARACTERES_NOME = 150;

const cache = {};
function carregar(chave) {
  if (!cache[chave]) {
    cache[chave] = fs.promises.readFile(ARQUIVOS[chave]).catch(() => {
      delete cache[chave];
      throw new Error(`Arquivo do certificado não encontrado: ${path.relative(RAIZ, ARQUIVOS[chave])}`);
    });
  }
  return cache[chave];
}

// Remove caracteres de controle e invisíveis, junta espaços e descarta o que a fonte não sabe desenhar
// (por exemplo emojis), para o pdf-lib não falhar.
function sanitizarTexto(texto, fonte, max = MAX_CARACTERES_NOME) {
  let t = String(texto ?? '').normalize('NFC');
  t = t.replace(/[\p{Cc}\p{Cf}]/gu, ' ');
  t = t.replace(/\s+/g, ' ').trim();

  if (typeof fonte.getCharacterSet === 'function') {
    const suportados = new Set(fonte.getCharacterSet());
    t = Array.from(t)
      .filter((c) => suportados.has(c.codePointAt(0)))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (t.length > max) t = t.slice(0, max).trim();
  return t;
}

function desenharCentralizado(pagina, fonte, texto, { centroX, baseY, tamanho, corTexto }) {
  const largura = fonte.widthOfTextAtSize(texto, tamanho);
  pagina.drawText(texto, {
    x: X(centroX) - largura / 2,
    y: Y(baseY),
    size: tamanho,
    font: fonte,
    color: cor(corTexto),
  });
}

// Tamanho que faz o texto caber em larguraMax (px do modelo), sem passar de tamanhoMax.
function tamanhoQueCabe(fonte, texto, tamanhoMax, larguraMaxPx) {
  const larguraMax = larguraMaxPx * ESCALA;
  const larguraNoMax = fonte.widthOfTextAtSize(texto, tamanhoMax);
  return larguraNoMax <= larguraMax ? tamanhoMax : (tamanhoMax * larguraMax) / larguraNoMax;
}

function cobrir(pagina, { x0, x1, y0, y1 }) {
  pagina.drawRectangle({
    x: X(x0),
    y: Y(y1),
    width: X(x1 - x0),
    height: (y1 - y0) * ESCALA,
    color: cor(LAYOUT.corFundo),
    borderWidth: 0,
  });
}

function escreverAssinaturas(pagina, { regular, negrito }, configuracao) {
  const { reitora, coordenador, corTextoAssinatura } = LAYOUT;

  // Reitora: nome (negrito) e cargo.
  cobrir(pagina, reitora.caixa);
  const nomeReitora = sanitizarTexto(configuracao.reitora_nome, negrito);
  if (nomeReitora) {
    const tamanho = tamanhoQueCabe(negrito, nomeReitora, reitora.tamanhoNome, reitora.larguraMax);
    desenharCentralizado(pagina, negrito, nomeReitora, {
      centroX: reitora.centroX,
      baseY: reitora.nomeBaseY,
      tamanho,
      corTexto: corTextoAssinatura,
    });
  }
  desenharCentralizado(pagina, regular, reitora.cargo, {
    centroX: reitora.centroX,
    baseY: reitora.cargoBaseY,
    tamanho: reitora.tamanhoCargo,
    corTexto: corTextoAssinatura,
  });

  // Coordenador: só o nome (pode estar vazio; nesse caso a linha do nome fica em branco).
  cobrir(pagina, coordenador.caixa);
  const nomeCoordenador = sanitizarTexto(configuracao.coordenador_nome, negrito);
  if (nomeCoordenador) {
    const tamanho = tamanhoQueCabe(negrito, nomeCoordenador, coordenador.tamanhoNome, coordenador.larguraMax);
    desenharCentralizado(pagina, negrito, nomeCoordenador, {
      centroX: coordenador.centroX,
      baseY: coordenador.nomeBaseY,
      tamanho,
      corTexto: corTextoAssinatura,
    });
  }
}

/**
 * Gera o certificado de um participante.
 * @param {{ nome: string }} aluno
 * @param {{ reitora_nome?: string, coordenador_nome?: string }} configuracao  (configuração do sistema)
 * @returns {Promise<Buffer>} PDF pronto (A4 paisagem)
 */
async function gerarCertificadoPdf({ nome } = {}, configuracao = {}) {
  const [modelo, bytesRegular, bytesNegrito] = await Promise.all([
    carregar('modelo'),
    carregar('fonteRegular'),
    carregar('fonteNegrito'),
  ]);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle('Certificado de Participação - VI Jornada Acadêmica Uninassau Teresina');
  doc.setAuthor('UNINASSAU Teresina');
  doc.setProducer('Jornada API');
  doc.setCreator('Jornada API');

  const negrito = await doc.embedFont(bytesNegrito, { subset: false });
  const regular = await doc.embedFont(bytesRegular, { subset: false });

  const nomeLimpo = sanitizarTexto(nome, negrito);
  if (!nomeLimpo) throw new Error('Nome inválido para o certificado.');

  const { nome: layoutNome } = LAYOUT;
  const tamanho = tamanhoQueCabe(negrito, nomeLimpo, layoutNome.tamanhoMax, layoutNome.larguraMax);
  if (tamanho < layoutNome.tamanhoMin) {
    throw new Error('Nome longo demais para caber no certificado.');
  }

  const pagina = doc.addPage([PAGINA.largura, PAGINA.altura]);
  const imagem = await doc.embedJpg(modelo);
  pagina.drawImage(imagem, { x: 0, y: 0, width: PAGINA.largura, height: PAGINA.altura });

  if (LAYOUT.sobreporAssinaturas) {
    escreverAssinaturas(pagina, { regular, negrito }, configuracao || {});
  }

  desenharCentralizado(pagina, negrito, nomeLimpo, {
    centroX: layoutNome.centroX,
    baseY: layoutNome.linhaBaseY,
    tamanho,
    corTexto: layoutNome.cor,
  });

  return Buffer.from(await doc.save());
}

module.exports = { gerarCertificadoPdf, LAYOUT };