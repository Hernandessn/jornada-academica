const express = require('express');
const { z } = require('zod');
const { autenticar, exigirPapel } = require('../middlewares/auth');
const { badRequest } = require('../erros');
const { assincrono } = require('../utils/async');
const { dataValida } = require('../utils/datas');
const { obterConfiguracao, salvarConfiguracao } = require('../servicos/configuracao');

const router = express.Router();

// RN07: só o admin lê e altera as configurações.
router.use(autenticar, exigirPapel('admin'));

const MSG_DATA = 'Data inválida. Use o formato AAAA-MM-DD (ex.: 2026-12-14).';

const dataIso = z
  .string({ invalid_type_error: MSG_DATA })
  .trim()
  .refine(dataValida, MSG_DATA);

const numero = (msgTipo) => z.number({ invalid_type_error: msgTipo });

// Todos os campos são opcionais: o PUT atualiza só o que for enviado.
const configuracaoSchema = z.object({
  modo_aprovacao: z
    .enum(['horas', 'percentual'], {
      errorMap: () => ({ message: "modo_aprovacao deve ser 'horas' ou 'percentual'." }),
    })
    .optional(),
  valor_minimo: numero('O valor mínimo deve ser um número.')
    .positive('O valor mínimo deve ser maior que zero.')
    .max(1000, 'O valor mínimo é alto demais.')
    .optional(),
  carga_horaria_certificado: numero('A carga horária do certificado deve ser um número.')
    .positive('A carga horária do certificado deve ser maior que zero.')
    .max(1000, 'A carga horária do certificado é alta demais.')
    .optional(),
  certificados_a_partir_de: dataIso.optional(),
  inscricoes_de: dataIso.optional(),
  inscricoes_ate: dataIso.optional(),
  ignorar_datas: z.boolean({ invalid_type_error: 'ignorar_datas deve ser true ou false.' }).optional(),
  coordenador_nome: z
    .string({ invalid_type_error: 'O nome do coordenador deve ser um texto.' })
    .trim()
    .max(150, 'O nome do coordenador deve ter no máximo 150 caracteres.')
    .optional(),
  reitora_nome: z
    .string({ invalid_type_error: 'O nome da reitora deve ser um texto.' })
    .trim()
    .min(1, 'Informe o nome da reitora.')
    .max(150, 'O nome da reitora deve ter no máximo 150 caracteres.')
    .optional(),
});

// GET /api/configuracoes -> todos os campos da configuração
router.get(
  '/',
  assincrono(async (req, res) => {
    res.json(await obterConfiguracao());
  })
);

// PUT /api/configuracoes  (envie só os campos que quer mudar)
router.put(
  '/',
  assincrono(async (req, res) => {
    const dados = configuracaoSchema.parse(req.body ?? {});
    if (Object.keys(dados).length === 0) {
      throw badRequest('Informe ao menos um campo para alterar.');
    }

    // Regras que dependem do conjunto final (o que já estava salvo + o que veio na requisição).
    const atual = await obterConfiguracao();
    const final = { ...atual, ...dados };
    const campos = {};

    if (
      dados.modo_aprovacao !== undefined &&
      dados.modo_aprovacao !== atual.modo_aprovacao &&
      dados.valor_minimo === undefined
    ) {
      // Trocar de horas para percentual (ou o contrário) mantendo o número antigo daria uma regra sem sentido.
      campos.valor_minimo = 'Informe o valor mínimo ao trocar o modo de aprovação.';
    } else if (final.modo_aprovacao === 'percentual' && final.valor_minimo > 100) {
      campos.valor_minimo = 'No modo percentual, o valor mínimo deve ser de até 100.';
    }

    if (final.inscricoes_de > final.inscricoes_ate) {
      campos.inscricoes_ate = 'A data final das inscrições não pode ser anterior à data inicial.';
    }

    if (Object.keys(campos).length > 0) {
      throw badRequest('Dados inválidos.', campos);
    }

    res.json(await salvarConfiguracao(dados));
  })
);

module.exports = router;
