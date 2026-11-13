const db = require('../db');

// Valores usados se a tabela estiver vazia (seed não rodou). Mantenha igual a seeds/03_configuracoes.js.
const CONFIGURACAO_PADRAO = {
  modo_aprovacao: 'percentual',
  valor_minimo: 75,
  carga_horaria_certificado: 20,
  certificados_a_partir_de: '2026-12-14',
  inscricoes_de: '2026-11-16',
  inscricoes_ate: '2026-11-30',
  ignorar_datas: false,
  coordenador_nome: '',
  reitora_nome: 'Dra. Roselane Moita Pierot',
};

const CAMPOS = Object.keys(CONFIGURACAO_PADRAO);

const ehVerdadeiro = (v) => v === true || v === 1 || v === '1' || v === 't' || v === 'true';

// Converte a linha do banco (SQLite e PostgreSQL devolvem tipos um pouco diferentes) para o formato da API.
function normalizar(linha) {
  return {
    modo_aprovacao: linha.modo_aprovacao,
    valor_minimo: Number(linha.valor_minimo),
    carga_horaria_certificado: Number(linha.carga_horaria_certificado),
    certificados_a_partir_de: String(linha.certificados_a_partir_de).slice(0, 10),
    inscricoes_de: String(linha.inscricoes_de).slice(0, 10),
    inscricoes_ate: String(linha.inscricoes_ate).slice(0, 10),
    ignorar_datas: ehVerdadeiro(linha.ignorar_datas),
    coordenador_nome: linha.coordenador_nome ?? '',
    reitora_nome: linha.reitora_nome ?? '',
  };
}

// Lê a configuração vigente completa.
async function obterConfiguracao(conn = db) {
  const linha = await conn('configuracoes').first(...CAMPOS);
  if (!linha) return { ...CONFIGURACAO_PADRAO };
  return normalizar(linha);
}

// Aceita só os campos que mudam (parcial). Os demais ficam como estão.
// A tabela guarda uma linha só: atualiza se existir, senão cria.
async function salvarConfiguracao(parcial, conn = db) {
  const atual = await obterConfiguracao(conn);
  const novo = { ...atual };
  for (const campo of CAMPOS) {
    if (parcial[campo] !== undefined) novo[campo] = parcial[campo];
  }

  const atualizadas = await conn('configuracoes').update(novo);
  if (!atualizadas) {
    await conn('configuracoes').insert(novo);
  }
  return obterConfiguracao(conn);
}

module.exports = { CONFIGURACAO_PADRAO, CAMPOS, obterConfiguracao, salvarConfiguracao };
