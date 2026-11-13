const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { limiteConsulta } = require('../middlewares/limites');
const { assincrono } = require('../utils/async');
const { somenteDigitos, cpfValido } = require('../utils/cpf');
const { obterConfiguracao } = require('../servicos/configuracao');
const { certificadosLiberados } = require('../servicos/periodos');
const { calcularResumoPresenca } = require('../servicos/presenca');

const router = express.Router();

const texto = (msg) => z.string({ required_error: msg, invalid_type_error: msg });

// Os dois campos são obrigatórios e precisam pertencer ao MESMO aluno.
const consultaSchema = z.object({
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

// Corpo idêntico para "CPF inexistente" e "e-mail não confere": quem consulta não descobre se um CPF existe.
const respostaNaoEncontrado = () => ({
  status: 'nao_encontrado',
  primeiro_nome: null,
  presenca: null,
  minimo: null,
});

const primeiroNome = (nome) => nome.trim().split(/\s+/)[0];

// POST /api/certificados/consulta  (público, com rate limit forte)
// Corpo: { cpf, email }
// Resposta 200 sempre com: { status, primeiro_nome, presenca, minimo }
//   status: 'aprovado' | 'nao_elegivel' | 'ainda_nao_liberado' | 'nao_encontrado'
//   presenca: { horas, percentual }          (só em aprovado / nao_elegivel)
//   minimo: { modo_aprovacao, valor_minimo } (só em aprovado / nao_elegivel)
// Em 'ainda_nao_liberado' vai também certificados_a_partir_de (data de liberação, não é dado pessoal).
router.post(
  '/consulta',
  limiteConsulta,
  assincrono(async (req, res) => {
    res.set('Cache-Control', 'no-store');

    const { cpf, email } = consultaSchema.parse(req.body ?? {});
    const config = await obterConfiguracao();

    // Antes da data de liberação nem consultamos o banco: a resposta é a mesma para qualquer entrada.
    if (!certificadosLiberados(config)) {
      return res.json({
        status: 'ainda_nao_liberado',
        primeiro_nome: null,
        presenca: null,
        minimo: null,
        certificados_a_partir_de: config.certificados_a_partir_de,
      });
    }

    // CPF e e-mail entram juntos na mesma consulta.
    const aluno = await db('alunos').where({ cpf, email }).first('id', 'nome');
    if (!aluno) return res.json(respostaNaoEncontrado());

    const { alunos } = await calcularResumoPresenca(db, { alunoId: aluno.id });
    const resumo = alunos[0];

    return res.json({
      status: resumo.elegivel ? 'aprovado' : 'nao_elegivel',
      primeiro_nome: primeiroNome(aluno.nome),
      presenca: { horas: resumo.horas_presentes, percentual: resumo.percentual },
      minimo: { modo_aprovacao: config.modo_aprovacao, valor_minimo: config.valor_minimo },
    });
  })
);

module.exports = router;
