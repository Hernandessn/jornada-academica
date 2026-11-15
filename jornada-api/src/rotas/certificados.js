const express = require('express');
const { z } = require('zod');
const db = require('../db');
const config = require('../config');
const { autenticar, exigirPapel } = require('../middlewares/auth');
const { limiteConsulta, limiteDownload } = require('../middlewares/limites');
const { HttpError, proibido, conflito, naoEncontrado, badRequest } = require('../erros');
const { assincrono } = require('../utils/async');
const { ehViolacaoUnica } = require('../utils/erros-bd');
const { formatarDataBr } = require('../utils/datas');
const { obterConfiguracao } = require('../servicos/configuracao');
const { certificadosLiberados } = require('../servicos/periodos');
const { calcularResumoPresenca } = require('../servicos/presenca');
const { consultaCertificadoSchema, consultarCertificado } = require('../servicos/consultaCertificado');
const { gerarCertificadoPdf } = require('../servicos/certificadoPdf');
const {
  NOME_ANEXO,
  emailConfigurado,
  mensagemConfiguracaoEmail,
  enviarCertificado,
} = require('../servicos/email');

const router = express.Router();

// Corpo idêntico para "CPF inexistente" e "e-mail não confere": quem consulta não descobre se um CPF existe.
const respostaNaoEncontrado = () => ({
  status: 'nao_encontrado',
  primeiro_nome: null,
  presenca: null,
  minimo: null,
});

const primeiroNome = (nome) => nome.trim().split(/\s+/)[0];

// ---------------------------------------------------------------------------
// POST /api/certificados/consulta  (público, com rate limit forte)
// Corpo: { cpf, email }
// Resposta 200 sempre com: { status, primeiro_nome, presenca, minimo }
//   status: 'aprovado' | 'nao_elegivel' | 'ainda_nao_liberado' | 'nao_encontrado'
//   presenca: { horas, percentual }          (só em aprovado / nao_elegivel)
//   minimo: { modo_aprovacao, valor_minimo } (só em aprovado / nao_elegivel)
// Em 'ainda_nao_liberado' vai também certificados_a_partir_de (data de liberação, não é dado pessoal).
// ---------------------------------------------------------------------------
router.post(
  '/consulta',
  limiteConsulta,
  assincrono(async (req, res) => {
    res.set('Cache-Control', 'no-store');

    const dados = consultaCertificadoSchema.parse(req.body ?? {});
    const resultado = await consultarCertificado(dados);

    if (resultado.status === 'ainda_nao_liberado') {
      return res.json({
        status: 'ainda_nao_liberado',
        primeiro_nome: null,
        presenca: null,
        minimo: null,
        certificados_a_partir_de: resultado.config.certificados_a_partir_de,
      });
    }

    if (resultado.status === 'nao_encontrado') return res.json(respostaNaoEncontrado());

    return res.json({
      status: resultado.status,
      primeiro_nome: primeiroNome(resultado.aluno.nome),
      presenca: {
        horas: resultado.resumo.horas_presentes,
        percentual: resultado.resumo.percentual,
      },
      minimo: {
        modo_aprovacao: resultado.config.modo_aprovacao,
        valor_minimo: resultado.config.valor_minimo,
      },
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/certificados/baixar  (público, com rate limit próprio)
// Corpo: { cpf, email }  (mesma validação da consulta)
// Devolve o PDF só se o status for 'aprovado' e os certificados estiverem liberados.
// Qualquer outro caso responde a MESMA 404 { erro: 'Certificado não disponível.' }.
// ---------------------------------------------------------------------------
router.post(
  '/baixar',
  limiteDownload,
  assincrono(async (req, res) => {
    res.set('Cache-Control', 'no-store');

    const dados = consultaCertificadoSchema.parse(req.body ?? {});
    const resultado = await consultarCertificado(dados);

    if (resultado.status !== 'aprovado') {
      return res.status(404).json({ erro: 'Certificado não disponível.' });
    }

    const pdf = await gerarCertificadoPdf({ nome: resultado.aluno.nome }, resultado.config);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${NOME_ANEXO}"`,
      'Content-Length': String(pdf.length),
    });
    return res.send(pdf);
  })
);

// ---------------------------------------------------------------------------
// POST /api/certificados/emitir  (somente admin)
// Corpo opcional: { aluno_id?: número, simular?: boolean }
// Gera e envia por e-mail o certificado de cada aluno elegível que ainda não recebeu, UM DE CADA VEZ:
// gera o PDF -> envia o e-mail -> só então grava em "certificados". Falha em um não derruba o lote.
// Resposta 200: { emitidos, enviados, ja_enviados, falhas: [{ aluno_id, nome, motivo }] }
//   emitidos    = elegíveis que ainda não tinham recebido (processados nesta chamada)
//   enviados    = e-mails enviados e registrados com sucesso
//   ja_enviados = elegíveis pulados porque já tinham recebido
// Com simular: true nada é gerado, enviado nem gravado (e vem "simulacao": true).
// ---------------------------------------------------------------------------
const idPositivo = (msg) =>
  z.coerce.number({ required_error: msg, invalid_type_error: msg }).int(msg).positive(msg);

const emitirSchema = z.object({
  aluno_id: idPositivo('Informe um aluno_id válido.').optional(),
  simular: z.boolean({ invalid_type_error: 'simular deve ser true ou false.' }).optional(),
});

// Trava simples (vale para uma instância do servidor): evita dois lotes ao mesmo tempo,
// que enviariam e-mail em dobro para as mesmas pessoas.
let emissaoEmAndamento = false;

// Motivo mostrado ao admin: genérico, com um código curto quando houver. Nunca repassa a mensagem
// do servidor de e-mail, que pode conter o endereço do destinatário.
function motivoDaFalha(err, etapa) {
  if (etapa === 'pdf') return 'Falha ao gerar o PDF do certificado.';
  if (etapa === 'registro') return 'E-mail enviado, mas não foi possível registrar o envio.';
  const codigo = err && (err.codigo || err.code);
  const sufixo = typeof codigo === 'string' && /^[A-Z0-9_]{3,40}$/.test(codigo) ? ` (${codigo})` : '';
  return `Falha no envio do e-mail${sufixo}.`;
}

function registrarFalha(alunoId, err, etapa) {
  if (config.ambiente === 'test') return;
  const codigo = err && (err.codigo || err.code);
  console.error(`Certificado: falha na etapa "${etapa}" (aluno ${alunoId})${codigo ? `, código ${codigo}` : ''}.`);
}

router.post(
  '/emitir',
  autenticar,
  exigirPapel('admin'),
  assincrono(async (req, res) => {
    const { aluno_id: alunoId, simular = false } = emitirSchema.parse(req.body ?? {});

    const configuracao = await obterConfiguracao();
    if (!certificadosLiberados(configuracao)) {
      throw proibido(
        `Os certificados só podem ser emitidos a partir de ${formatarDataBr(configuracao.certificados_a_partir_de)}.`
      );
    }

    if (!simular && !emailConfigurado()) {
      throw new HttpError(503, mensagemConfiguracaoEmail());
    }

    const { alunos } = await calcularResumoPresenca(db, alunoId ? { alunoId } : {});
    if (alunoId) {
      if (alunos.length === 0) throw naoEncontrado('Aluno não encontrado.');
      if (!alunos[0].elegivel) throw badRequest('O aluno não é elegível ao certificado.');
    }

    const elegiveis = alunos.filter((a) => a.elegivel);
    const jaRecebeu = new Set(
      (
        await db('certificados')
          .whereIn(
            'aluno_id',
            elegiveis.map((a) => a.id)
          )
          .select('aluno_id')
      ).map((linha) => linha.aluno_id)
    );
    const pendentes = elegiveis.filter((a) => !jaRecebeu.has(a.id));

    const resposta = {
      emitidos: pendentes.length,
      enviados: 0,
      ja_enviados: elegiveis.length - pendentes.length,
      falhas: [],
    };

    if (simular) {
      return res.json({ simulacao: true, ...resposta });
    }

    if (emissaoEmAndamento) {
      throw conflito('Já existe uma emissão em andamento. Aguarde terminar e tente novamente.');
    }
    emissaoEmAndamento = true;

    try {
      for (const aluno of pendentes) {
        // 1) PDF
        let pdf;
        try {
          pdf = await gerarCertificadoPdf({ nome: aluno.nome }, configuracao);
        } catch (err) {
          registrarFalha(aluno.id, err, 'pdf');
          resposta.falhas.push({ aluno_id: aluno.id, nome: aluno.nome, motivo: motivoDaFalha(err, 'pdf') });
          continue;
        }

        // 2) E-mail
        try {
          await enviarCertificado({ para: aluno.email, nome: aluno.nome, pdf });
        } catch (err) {
          registrarFalha(aluno.id, err, 'email');
          resposta.falhas.push({ aluno_id: aluno.id, nome: aluno.nome, motivo: motivoDaFalha(err, 'email') });
          continue;
        }

        // 3) Só depois do envio, registra. Se outra emissão gravou antes (UNIQUE), conta como já enviado.
        try {
          await db('certificados').insert({ aluno_id: aluno.id });
          resposta.enviados += 1;
        } catch (err) {
          if (ehViolacaoUnica(err)) {
            resposta.ja_enviados += 1;
            resposta.emitidos -= 1;
          } else {
            registrarFalha(aluno.id, err, 'registro');
            resposta.falhas.push({
              aluno_id: aluno.id,
              nome: aluno.nome,
              motivo: motivoDaFalha(err, 'registro'),
            });
          }
        }
      }
    } finally {
      emissaoEmAndamento = false;
    }

    if (config.ambiente !== 'test') {
      console.log(`Certificados: ${resposta.enviados} enviado(s), ${resposta.falhas.length} falha(s).`);
    }
    return res.json(resposta);
  })
);

module.exports = router;
