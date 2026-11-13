const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { autenticar, exigirPapel } = require('../middlewares/auth');
const { assincrono } = require('../utils/async');
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
        'alunos.disciplina',
        'alunos.formato',
        'alunos.criado_em'
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
      const item = { ...a, cpf: mascararCpf(a.cpf) };
      if (eventoId) item.presente = Boolean(a.presente);
      return item;
    });

    res.json({ total: alunos.length, alunos });
  })
);

module.exports = router;
