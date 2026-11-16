const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const config = require('../config');
const db = require('../db');
const { badRequest, conflito, proibido } = require('../erros');
const { assincrono } = require('../utils/async');
const { ehViolacaoUnica } = require('../utils/erros-bd');
const {
  somenteDigitos,
  cpfValido,
  mascararCpf,
  normalizarTelefone,
} = require('../utils/cpf');
const {
  DISCIPLINAS,
  FORMATOS,
  FORMATO_AUTOMATICO,
  normalizarFormato,
} = require('../utils/disciplinas');
const { limiteBytes, msgTamanho, validarArquivo } = require('../utils/arquivos');
const { obterConfiguracao } = require('../servicos/configuracao');
const { motivoInscricoesFechadas } = require('../servicos/periodos');

const router = express.Router();

const RESUMO_MAX = 2000; // caracteres (mesma contagem do maxlength do navegador)

const texto = (msg) => z.string({ required_error: msg, invalid_type_error: msg });

// Regra: todas as validações ficam em .refine e a limpeza (.transform) vem por último.
// A mensagem que o cliente recebe por campo é a PRIMEIRA que falhar, na ordem abaixo.
const inscricaoSchema = z
  .object({
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

    // Opcional: participantes externos não têm matrícula (gravada como '' no banco).
    matricula: z
      .string({ invalid_type_error: 'A matrícula deve conter apenas números.' })
      .nullish()
      .transform((v) => (typeof v === 'string' ? v.trim() : ''))
      .refine((v) => v === '' || /^[\d.\-/\s]+$/.test(v), 'A matrícula deve conter apenas números.')
      .refine(
        (v) => v === '' || (somenteDigitos(v).length >= 4 && somenteDigitos(v).length <= 20),
        'Matrícula inválida (use de 4 a 20 dígitos).'
      )
      .transform((v) => somenteDigitos(v)),

    // "Sou aluno" ou "Público externo". Aluno: a matrícula é obrigatória. Externo: a matrícula é ignorada.
    // Sem este campo (clientes antigos), vale só a regra "matrícula opcional".
    tipo: z
      .string({ invalid_type_error: 'Tipo de participante inválido.' })
      .nullish()
      .transform((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
      .refine((v) => v === '' || ['aluno', 'externo'].includes(v), 'Escolha: aluno ou externo.'),

    // Opcional: instituição de origem de quem é de fora da Uninassau.
    instituicao: z
      .string({ invalid_type_error: 'Instituição inválida.' })
      .nullish()
      .transform((v) => (typeof v === 'string' ? v.trim() : ''))
      .refine((v) => v.length <= 150, 'A instituição deve ter no máximo 150 caracteres.')
      .transform((v) => v || null),

    // Resumo do trabalho: texto livre, até 2000 caracteres. Opcional (RESUMO_OBRIGATORIO=true exige).
    // Quebras de linha CRLF (envio por formulário) contam como uma só, como no contador do front.
    resumo: z
      .string({ invalid_type_error: 'O resumo deve ser um texto.' })
      .nullish()
      .transform((v) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim() : ''))
      .refine((v) => v.length <= RESUMO_MAX, `O resumo deve ter no máximo ${RESUMO_MAX} caracteres.`)
      .refine((v) => v !== '' || !config.inscricao.resumoObrigatorio, 'Informe o resumo do trabalho.')
      .transform((v) => v || null),

    curso: texto('Informe o curso.')
      .trim()
      .min(1, 'Informe o curso.')
      .max(100, 'O curso deve ter no máximo 100 caracteres.'),

    disciplina: texto('Informe a disciplina.')
      .trim()
      .min(1, 'Informe a disciplina.')
      .refine((v) => DISCIPLINAS.includes(v), `Disciplina inválida. Use: ${DISCIPLINAS.join(', ')}.`),

    // Só vale para PIC e Outras. Nas APIExt o servidor define o formato e ignora este campo.
    formato: z.string({ invalid_type_error: 'Formato inválido.' }).nullish(),
  })
  .superRefine((dados, ctx) => {
    if (dados.tipo === 'aluno' && !dados.matricula) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['matricula'], message: 'Informe a matrícula.' });
    }
    if (dados.tipo === 'externo' && !dados.instituicao && config.inscricao.instituicaoObrigatoriaExterno) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['instituicao'],
        message: 'Informe a instituição de origem.',
      });
    }
    if (!DISCIPLINAS.includes(dados.disciplina)) return; // o erro de disciplina já foi reportado
    if (FORMATO_AUTOMATICO[dados.disciplina]) return;

    const formato = normalizarFormato(dados.formato);
    if (!formato) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['formato'],
        message: 'Escolha o formato do trabalho: banner ou comunicação oral.',
      });
    } else if (!FORMATOS.includes(formato)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['formato'],
        message: 'Formato inválido. Use banner ou comunicação oral.',
      });
    }
  })
  .transform(({ tipo, ...dados }) => ({
    ...dados,
    matricula: tipo === 'externo' ? '' : dados.matricula,
    formato: FORMATO_AUTOMATICO[dados.disciplina] || normalizarFormato(dados.formato),
  }));

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

// Fora do período de inscrições (e sem "ignorar_datas"): 403, antes de qualquer outra coisa
// (inclusive antes de ler um upload, para não gastar memória com inscrição que será recusada).
const verificarPeriodo = assincrono(async (req, res, next) => {
  const configuracao = await obterConfiguracao();
  const fechada = motivoInscricoesFechadas(configuracao);
  if (fechada) throw proibido(fechada);
  next();
});

// Upload em memória: um arquivo só, no campo "arquivo". Só roda em requisições multipart;
// o envio JSON (sem arquivo) continua funcionando como antes.
const lerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: limiteBytes(),
    files: 1,
    fields: 20,
    fieldSize: 32 * 1024, // o resumo (2000 caracteres) cabe com folga, mesmo em UTF-8
    parts: 25,
  },
}).single('arquivo');

function erroDoUpload(err) {
  if (!(err instanceof multer.MulterError)) {
    return badRequest('Requisição multipart inválida.');
  }
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return badRequest('Dados inválidos.', { arquivo: msgTamanho() });
    case 'LIMIT_FILE_COUNT':
      return badRequest('Dados inválidos.', { arquivo: 'Envie apenas um arquivo.' });
    case 'LIMIT_UNEXPECTED_FILE':
      return badRequest('Dados inválidos.', {
        arquivo: err.field === 'arquivo' ? 'Envie apenas um arquivo.' : 'Envie o arquivo no campo "arquivo".',
      });
    case 'LIMIT_FIELD_VALUE':
      return badRequest('Dados inválidos.', {
        [err.field || '_']: err.field === 'resumo' ? `O resumo deve ter no máximo ${RESUMO_MAX} caracteres.` : 'Texto longo demais.',
      });
    default:
      return badRequest('Requisição multipart inválida.');
  }
}

function receberMultipart(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  return lerUpload(req, res, (err) => next(err ? erroDoUpload(err) : undefined));
}

// Primeira mensagem de cada campo, no mesmo formato do handler global de erros.
function camposDoZod(erroZod) {
  const campos = {};
  for (const issue of erroZod.issues) {
    const chave = issue.path.join('.') || '_';
    if (!campos[chave]) campos[chave] = issue.message;
  }
  return campos;
}

// POST /api/inscricoes (público): JSON (como antes) ou multipart/form-data com o arquivo em "arquivo".
router.post(
  '/',
  verificarPeriodo,
  receberMultipart,
  assincrono(async (req, res) => {
    // Valida os campos E o arquivo juntos, para o front mostrar todos os erros de uma vez.
    const resultado = inscricaoSchema.safeParse(req.body ?? {});
    const arquivo = validarArquivo(req.file);
    if (!resultado.success || arquivo.erro) {
      const campos = resultado.success ? {} : camposDoZod(resultado.error);
      if (arquivo.erro) campos.arquivo = arquivo.erro;
      throw badRequest('Dados inválidos.', campos);
    }
    const dados = resultado.data;

    // 1) Checagem amigável (diz exatamente qual campo já existe).
    const duplicados = await verificarDuplicidade(dados.cpf, dados.email);
    if (duplicados) throw erroDeDuplicidade(duplicados);

    // 2) A garantia real é o UNIQUE do banco: se duas requisições passarem juntas pela
    //    checagem acima, a segunda falha aqui e é respondida como 409 do mesmo jeito.
    //    Aluno e arquivo são gravados na MESMA transação: se algo falhar, não sobra inscrição sem
    //    arquivo (a nova tentativa do participante daria 409 de CPF duplicado).
    let id;
    try {
      id = await db.transaction(async (trx) => {
        const [linha] = await trx('alunos').insert(dados).returning('id');
        const novoId = typeof linha === 'object' ? linha.id : linha;
        if (arquivo.dados) {
          await trx('arquivos_inscricao').insert({ aluno_id: novoId, ...arquivo.dados });
        }
        return novoId;
      });
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
        instituicao: aluno.instituicao,
        disciplina: aluno.disciplina,
        formato: aluno.formato,
        criado_em: aluno.criado_em,
        tem_resumo: Boolean(aluno.resumo),
        tem_arquivo: Boolean(arquivo.dados),
      },
    });
  })
);

module.exports = router;
