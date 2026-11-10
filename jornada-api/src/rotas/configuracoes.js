const express = require('express');
const { z } = require('zod');
const { autenticar, exigirPapel } = require('../middlewares/auth');
const { assincrono } = require('../utils/async');
const { obterConfiguracao, salvarConfiguracao } = require('../servicos/configuracao');

const router = express.Router();

// RN07: só o admin lê e altera a regra de presença.
router.use(autenticar, exigirPapel('admin'));

const configuracaoSchema = z
  .object({
    modo_aprovacao: z.enum(['horas', 'percentual'], {
      errorMap: () => ({ message: "modo_aprovacao deve ser 'horas' ou 'percentual'." }),
    }),
    valor_minimo: z
      .number({
        required_error: 'Informe o valor mínimo.',
        invalid_type_error: 'O valor mínimo deve ser um número.',
      })
      .positive('O valor mínimo deve ser maior que zero.')
      .max(1000, 'O valor mínimo é alto demais.'),
  })
  .superRefine((dados, ctx) => {
    if (dados.modo_aprovacao === 'percentual' && dados.valor_minimo > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valor_minimo'],
        message: 'No modo percentual, o valor mínimo deve ser de até 100.',
      });
    }
  });

// GET /api/configuracoes -> { modo_aprovacao, valor_minimo }
router.get(
  '/',
  assincrono(async (req, res) => {
    res.json(await obterConfiguracao());
  })
);

// PUT /api/configuracoes  { modo_aprovacao: 'horas'|'percentual', valor_minimo: número }
router.put(
  '/',
  assincrono(async (req, res) => {
    const dados = configuracaoSchema.parse(req.body ?? {});
    res.json(await salvarConfiguracao(dados));
  })
);

module.exports = router;
