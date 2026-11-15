// Lógica compartilhada por POST /api/certificados/consulta e POST /api/certificados/baixar:
// mesma validação (CPF + e-mail juntos) e mesma decisão de status.
const { z } = require('zod');
const db = require('../db');
const { somenteDigitos, cpfValido } = require('../utils/cpf');
const { obterConfiguracao } = require('./configuracao');
const { certificadosLiberados } = require('./periodos');
const { calcularResumoPresenca } = require('./presenca');

const texto = (msg) => z.string({ required_error: msg, invalid_type_error: msg });

// Os dois campos são obrigatórios e precisam pertencer ao MESMO aluno.
const consultaCertificadoSchema = z.object({
  cpf: texto('Informe o CPF.')
    .trim()
    .min(1, 'Informe o CPF.')
    .refine((v) => /^[\d.\-\s]+$/.test(v), 'O CPF deve conter apenas números.')
    .refine((v) => somenteDigitos(v).length === 11, 'O CPF deve ter 11 dígitos.')
    .refine((v) => cpfValido(v), 'CPF inválido.')
    .transform(somenteDigitos),

  email: texto('Informe o e-mail.')
    .trim()
    .min(1, 'Informe o e-mail.')
    .max(150, 'O e-mail deve ter no máximo 150 caracteres.')
    .email('E-mail inválido.')
    .transform((v) => v.toLowerCase()),
});

/**
 * Decide a situação do certificado de quem informou CPF e e-mail (já validados pelo schema).
 * Retorna { status, config, aluno?, resumo? }:
 *   'ainda_nao_liberado'  antes da data de liberação (nem consulta o banco)
 *   'nao_encontrado'      CPF inexistente OU e-mail que não confere (indistinguíveis)
 *   'nao_elegivel'        presença abaixo da regra
 *   'aprovado'            presença atinge a regra
 */
async function consultarCertificado({ cpf, email }, conn = db) {
  const config = await obterConfiguracao(conn);

  if (!certificadosLiberados(config)) {
    return { status: 'ainda_nao_liberado', config };
  }

  // CPF e e-mail entram juntos na mesma consulta.
  const aluno = await conn('alunos').where({ cpf, email }).first('id', 'nome');
  if (!aluno) return { status: 'nao_encontrado', config };

  const { alunos } = await calcularResumoPresenca(conn, { alunoId: aluno.id });
  const resumo = alunos[0];

  return { status: resumo.elegivel ? 'aprovado' : 'nao_elegivel', config, aluno, resumo };
}

module.exports = { consultaCertificadoSchema, consultarCertificado };
