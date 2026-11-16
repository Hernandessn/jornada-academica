const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { autenticar, exigirPapel } = require('../middlewares/auth');
const { naoEncontrado } = require('../erros');
const { assincrono } = require('../utils/async');
const { TIPOS, cabecalhoDownload } = require('../utils/arquivos');
const { somenteDigitos, mascararCpf } = require('../utils/cpf');

const router = express.Router();

const consultaSchema = z.object({
  busca: z
    .string({ invalid_type_error: 'A busca deve ser um texto.' })
    .trim()
    .max(100, 'A busca deve ter no máximo 100 caracteres.')
    .optional(),
  evento_id: z.coerce
    .number({ invalid_type_error: 'evento_id inválido.' })
    .int('evento_id inválido.')
    .positive('evento_id inválido.')
    .optional(),
});

const escaparLike = (t) => t.replace(/[\\%_]/g, '\\$&');

// GET /api/alunos?busca=<nome ou CPF>&evento_id=<id>   (professor, admin)
//  - busca só com números/pontuação -> procura pelo CPF; caso contrário, pelo nome.
//  - evento_id (opcional) acrescenta o campo "presente" (true/false) para a tela de chamada.
//  - O CPF sempre sai mascarado (***.123.456-**).
//  - tem_arquivo / tem_resumo dizem se o participante enviou arquivo e resumo (sem o conteúdo).
router.get(
  '/',
  autenticar,
  exigirPapel('professor', 'admin'),
  assincrono(async (req, res) => {
    const { busca, evento_id: eventoId } = consultaSchema.parse(req.query);

    const consulta = db('alunos')
      .select(
        'alunos.id',
        'alunos.nome',
        'alunos.email',
        'alunos.telefone',
        'alunos.cpf',
        'alunos.matricula',
        'alunos.curso',
        'alunos.instituicao',
        'alunos.disciplina',
        'alunos.formato',
        'alunos.criado_em',
        db.raw('exists (select 1 from arquivos_inscricao a where a.aluno_id = alunos.id) as tem_arquivo'),
        db.raw("(alunos.resumo is not null and alunos.resumo <> '') as tem_resumo")
      )
      .orderBy('alunos.nome')
      .orderBy('alunos.id');

    if (eventoId) {
      consulta.select(
        db.raw(
          'exists (select 1 from frequencia f where f.aluno_id = alunos.id and f.evento_id = ?) as presente',
          [eventoId]
        )
      );
    }

    if (busca) {
      if (/^[\d.\-\s]+$/.test(busca)) {
        const digitos = somenteDigitos(busca);
        if (digitos) consulta.where('alunos.cpf', 'like', `%${digitos}%`);
      } else {
        const termo = `%${escaparLike(busca.toLowerCase())}%`;
        consulta.whereRaw("lower(alunos.nome) like ? escape '\\'", [termo]);
      }
    }

    const linhas = await consulta;
    const alunos = linhas.map((a) => {
      const item = {
        ...a,
        cpf: mascararCpf(a.cpf),
        tem_arquivo: Boolean(a.tem_arquivo),
        tem_resumo: Boolean(a.tem_resumo),
      };
      if (eventoId) item.presente = Boolean(a.presente);
      return item;
    });

    res.json({ total: alunos.length, alunos });
  })
);

const idSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: 'id inválido.' })
    .int('id inválido.')
    .positive('id inválido.'),
});

// GET /api/alunos/:id   (somente admin)
// Detalhe de uma inscrição: tudo da listagem + o resumo completo + os dados do arquivo (sem o conteúdo).
router.get(
  '/:id',
  autenticar,
  exigirPapel('admin'),
  assincrono(async (req, res) => {
    const { id } = idSchema.parse(req.params);

    const aluno = await db('alunos')
      .where({ id })
      .first(
        'id',
        'nome',
        'email',
        'telefone',
        'cpf',
        'matricula',
        'curso',
        'instituicao',
        'disciplina',
        'formato',
        'resumo',
        'criado_em'
      );
    if (!aluno) throw naoEncontrado('Participante não encontrado.');

    const arquivo = await db('arquivos_inscricao')
      .where({ aluno_id: id })
      .first('nome_original', 'extensao', 'tipo_mime', 'tamanho', 'criado_em');

    res.json({
      aluno: {
        ...aluno,
        cpf: mascararCpf(aluno.cpf),
        resumo: aluno.resumo || null,
        arquivo: arquivo || null,
      },
    });
  })
);

// GET /api/alunos/:id/arquivo   (somente admin)
// Baixa o arquivo enviado na inscrição. O tipo MIME vem da extensão validada (nunca do cliente), a
// resposta é sempre um download (attachment) e o navegador não pode "adivinhar" outro tipo (nosniff).
router.get(
  '/:id/arquivo',
  autenticar,
  exigirPapel('admin'),
  assincrono(async (req, res) => {
    const { id } = idSchema.parse(req.params);

    const arquivo = await db('arquivos_inscricao')
      .where({ aluno_id: id })
      .first('nome_original', 'extensao', 'conteudo');
    if (!arquivo) throw naoEncontrado('Este participante não enviou arquivo.');

    const conteudo = Buffer.from(arquivo.conteudo);
    res.set({
      'Content-Disposition': cabecalhoDownload(arquivo.nome_original),
      'Content-Type': TIPOS[arquivo.extensao] || 'application/octet-stream',
      'Content-Length': String(conteudo.length),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    res.send(conteudo);
  })
);

module.exports = router;
