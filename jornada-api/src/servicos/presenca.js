const db = require('../db');
const { obterConfiguracao } = require('./configuracao');
const { arredondar2, percentualDe, estaElegivel } = require('../utils/elegibilidade');

/**
 * Calcula a presença acumulada e a elegibilidade de TODOS os alunos inscritos.
 * Usada por GET /api/frequencia/resumo e reutilizável pelo módulo de certificado.
 *
 * Com { alunoId }, calcula só para esse aluno (o total de horas continua sendo o de todos os eventos).
 *
 * Retorna:
 * {
 *   configuracao: { ...todos os campos de servicos/configuracao.js (modo, mínimo, nomes, datas...) },
 *   carga_horaria_total,          // soma da carga horária de todos os eventos
 *   alunos: [{
 *     id, nome, email, cpf, matricula, curso, disciplina, formato,   // ATENÇÃO: cpf completo (só dígitos); mascare antes de expor
 *     presencas,                                // quantidade de eventos com presença
 *     horas_presentes, percentual,              // percentual de 0 a 100, com 2 casas
 *     elegivel                                  // boolean, conforme a regra vigente
 *   }]
 * }
 */
async function calcularResumoPresenca(conn = db, { alunoId } = {}) {
  const configuracao = await obterConfiguracao(conn);

  const eventos = await conn('eventos').select('carga_horaria');
  const cargaTotal = eventos.reduce((soma, e) => soma + Number(e.carga_horaria), 0);

  const alunos = await conn('alunos')
    .select('id', 'nome', 'email', 'cpf', 'matricula', 'curso', 'disciplina', 'formato')
    .modify((q) => {
      if (alunoId) q.where('id', alunoId);
    })
    .orderBy('nome')
    .orderBy('id');

  const somas = await conn('frequencia')
    .join('eventos', 'eventos.id', 'frequencia.evento_id')
    .modify((q) => {
      if (alunoId) q.where('frequencia.aluno_id', alunoId);
    })
    .groupBy('frequencia.aluno_id')
    .select('frequencia.aluno_id')
    .sum({ horas: 'eventos.carga_horaria' })
    .count({ presencas: 'frequencia.id' });

  const porAluno = new Map(
    somas.map((s) => [s.aluno_id, { horas: Number(s.horas), presencas: Number(s.presencas) }])
  );

  return {
    configuracao,
    carga_horaria_total: arredondar2(cargaTotal),
    alunos: alunos.map((aluno) => {
      const { horas, presencas } = porAluno.get(aluno.id) || { horas: 0, presencas: 0 };
      return {
        ...aluno,
        presencas,
        horas_presentes: arredondar2(horas),
        percentual: arredondar2(percentualDe(horas, cargaTotal)),
        elegivel: estaElegivel(horas, cargaTotal, configuracao),
      };
    }),
  };
}

module.exports = { calcularResumoPresenca };
