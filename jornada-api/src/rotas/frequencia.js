const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { autenticar, exigirPapel } = require('../middlewares/auth');
const { naoEncontrado } = require('../erros');
const { assincrono } = require('../utils/async');
const { ehViolacaoUnica } = require('../utils/erros-bd');
const { mascararCpf } = require('../utils/cpf');
const { calcularResumoPresenca } = require('../servicos/presenca');

const router = express.Router();

router.use(autenticar, exigirPapel('professor', 'admin'));

const idPositivo = (msg) =>
  z.coerce.number({ required_error: msg, invalid_type_error: msg }).int(msg).positive(msg);

const registroSchema = z.object({
  aluno_id: idPositivo('Informe um aluno_id válido.'),
  evento_id: idPositivo('Informe um evento_id válido.'),
});

// POST /api/frequencia  { aluno_id, evento_id }
//  - primeira vez: 201 | repetido: 200 com ja_registrada=true (RN04, nunca duplica)
router.post(
  '/',
  assincrono(async (req, res) => {
    const { aluno_id: alunoId, evento_id: eventoId } = registroSchema.parse(req.body ?? {});

    if (!(await db('alunos').where({ id: alunoId }).first('id'))) {
      throw naoEncontrado('Aluno não encontrado.');
    }
    if (!(await db('eventos').where({ id: eventoId }).first('id'))) {
      throw naoEncontrado('Evento não encontrado.');
    }

    const buscar = () => db('frequencia').where({ aluno_id: alunoId, evento_id: eventoId }).first();
    const jaRegistrada = (registro) =>
      res.status(200).json({
        mensagem: 'Presença já estava registrada.',
        ja_registrada: true,
        frequencia: registro,
      });

    const existente = await buscar();
    if (existente) return jaRegistrada(existente);

    try {
      await db('frequencia').insert({
        aluno_id: alunoId,
        evento_id: eventoId,
        registrado_por: req.usuario.id,
      });
    } catch (err) {
      // Duas chamadas simultâneas: a segunda bate no UNIQUE(aluno_id, evento_id).
      if (ehViolacaoUnica(err)) {
        const registro = await buscar();
        if (registro) return jaRegistrada(registro);
      }
      throw err;
    }

    return res.status(201).json({
      mensagem: 'Presença registrada.',
      ja_registrada: false,
      frequencia: await buscar(),
    });
  })
);

// GET /api/frequencia/resumo
//  -> { configuracao, carga_horaria_total, total_alunos, total_elegiveis, alunos: [...] }
router.get(
  '/resumo',
  assincrono(async (req, res) => {
    const resumo = await calcularResumoPresenca();
    const alunos = resumo.alunos.map((a) => ({ ...a, cpf: mascararCpf(a.cpf) }));

    res.json({
      configuracao: resumo.configuracao,
      carga_horaria_total: resumo.carga_horaria_total,
      total_alunos: alunos.length,
      total_elegiveis: alunos.filter((a) => a.elegivel).length,
      alunos,
    });
  })
);

module.exports = router;
