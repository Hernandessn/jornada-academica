// Gera 3 certificados de exemplo em tmp/ (nome curto, longo e com acentos) para conferir o layout.
// Uso: npm run certificado:exemplo
const fs = require('fs');
const path = require('path');
const { gerarCertificadoPdf } = require('../src/servicos/certificadoPdf');

// Mesmos nomes que a configuração teria; o coordenador do exemplo é fictício.
const configuracao = {
  reitora_nome: 'Dra. Roselane Moita Pierot',
  coordenador_nome: 'Prof. Coordenador de Exemplo',
};

const exemplos = [
  ['curto', 'Ana Souza'],
  ['longo', 'Maria Eduarda Fernandes de Albuquerque Cavalcante Nogueira Lima e Silva'],
  ['acentos', 'José Antônio Conceição Müller Ávila Pôrto'],
];

async function main() {
  const pasta = path.join(__dirname, '..', 'tmp');
  fs.mkdirSync(pasta, { recursive: true });

  for (const [rotulo, nome] of exemplos) {
    const pdf = await gerarCertificadoPdf({ nome }, configuracao);
    const arquivo = path.join(pasta, `certificado-exemplo-${rotulo}.pdf`);
    fs.writeFileSync(arquivo, pdf);
    console.log(`Gerado: tmp/certificado-exemplo-${rotulo}.pdf (${Math.round(pdf.length / 1024)} KB)`);
  }
}

main().catch((err) => {
  console.error('Falha ao gerar os exemplos:', err.message);
  process.exit(1);
});
