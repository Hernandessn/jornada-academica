const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { conflito } = require('../erros');
const { assincrono } = require('../utils/async');
const { ehViolacaoUnica } = require('../utils/erros-bd');
const {
  somenteDigitos,
  cpfValido,
  mascararCpf,
  normalizarTelefone,
} = require('../utils/cpf');

const router = express.Router();

const texto = (msg) => z.string({ required_error: msg, invalid_type_error: msg });

// Regra: todas as validações ficam em .refine e a limpeza (.transform) vem por último.
// A mensagem que o cliente recebe por campo é a PRIMEIRA que falhar, na ordem abaixo.
const inscricaoSchema = z.object({
  nome: texto('Informe o nome completo.')
    .trim()
    .min(1, 'Informe o nome completo.')
    .max(150, 'O nome deve ter no máximo 150 caracteres.')
    .refine((v) => !/\d/.test(v), 'O nome não pode conter números.')
    .refine(
      (v) => v.split(/\s+/).filter(Boolean).length >= 2,
      'Informe o nome completo (nome e sobrenome).'
    )
    .transform((v) => v.replace(/\s+/g, ' ')),

  email: texto('Informe o e-mail.')
    .trim()
    .min(1, 'Informe o e-mail.')
    .max(150, 'O e-mail deve ter no máximo 150 caracteres.')
    .email('E-mail inválido.')
    .transform((v) => v.toLowerCase()),

  telefone: texto('Informe o telefone.')
    .trim()
    .min(1, 'Informe o telefone.')
    .refine((v) => /^[\d\s()+\-]+$/.test(v), 'O telefone deve conter apenas números.')
    .refine(
      (v) => [10, 11].includes(normalizarTelefone(v).length),
      'Telefone inválido. Informe o DDD e o número.'
    )
    .transform(normalizarTelefone),

  cpf: texto('Informe o CPF.')
    .trim()
    .min(1, 'Informe o CPF.')
    .refine((v) => /^[\d.\-\s]+$/.test(v), 'O CPF deve conter apenas números.')
    .refine((v) => somenteDigitos(v).length === 11, 'O CPF deve ter 11 dígitos.')
    .refine((v) => cpfValido(v), 'CPF inválido.')
    .transform(somenteDigitos),

  matricula: texto('Informe a matrícula.')
    .trim()
    .min(1, 'Informe a matrícula.')
    .refine((v) => /^[\d.\-/\s]+$/.test(v), 'A matrícula deve conter apenas números.')
    .refine(
      (v) => {
        const n = somenteDigitos(v).length;
        return n >= 4 && n <= 20;
      },
      'Matrícula inválida (use de 4 a 20 dígitos).'
    )
    .transform(somenteDigitos),

  curso: texto('Informe o curso.')
    .trim()
    .min(1, 'Informe o curso.')
    .max(100, 'O curso deve ter no máximo 100 caracteres.'),
});

// Procura cadastros que já usam o CPF ou o e-mail. Retorna { cpf?, email? } ou null.
async function verificarDuplicidade(cpf, email) {
  const campos = {};
  if (await db('alunos').where({ cpf }).first('id')) {
    campos.cpf = 'Este CPF já está cadastrado.';
  }
  if (await db('alunos').where({ email }).first('id')) {
    campos.email = 'Este e-mail já está cadastrado.';
  }
  return Object.keys(campos).length ? campos : null;
}

function erroDeDuplicidade(campos) {
  let mensagem = campos.cpf || campos.email;
  if (campos.cpf && campos.email) mensagem = 'CPF e e-mail já estão cadastrados.';
  return conflito(mensagem, campos);
}

// POST /api/inscricoes (público)
router.post(
  '/',
  assincrono(async (req, res) => {
    const dados = inscricaoSchema.parse(req.body ?? {});

    // 1) Checagem amigável (diz exatamente qual campo já existe).
    const duplicados = await verificarDuplicidade(dados.cpf, dados.email);
    if (duplicados) throw erroDeDuplicidade(duplicados);

    // 2) A garantia real é o UNIQUE do banco: se duas requisições passarem juntas pela
    //    checagem acima, a segunda falha aqui e é respondida como 409 do mesmo jeito.
    let id;
    try {
      const [linha] = await db('alunos').insert(dados).returning('id');
      id = typeof linha === 'object' ? linha.id : linha;
    } catch (err) {
      if (ehViolacaoUnica(err)) {
        const campos = await verificarDuplicidade(dados.cpf, dados.email);
        if (campos) throw erroDeDuplicidade(campos);
      }
      throw err;
    }

    const aluno = await db('alunos').where({ id }).first();
    res.status(201).json({
      mensagem: 'Inscrição realizada com sucesso.',
      aluno: {
        id: aluno.id,
        nome: aluno.nome,
        email: aluno.email,
        cpf: mascararCpf(aluno.cpf),
        curso: aluno.curso,
        criado_em: aluno.criado_em,
      },
    });
  })
);

module.exports = router;
