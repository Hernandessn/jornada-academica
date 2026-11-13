// Sessões da VI Jornada. Para mudar datas, horários ou carga horária, edite SÓ a lista abaixo.
// carga_horaria é em horas (aceita decimais: 3.5 = 3h30).
const EVENTOS = [
  { titulo: 'Dia 1 (09/12) - Manhã', data: '2026-12-09', hora_inicio: '09:00', hora_fim: '12:00', carga_horaria: 3 },
  { titulo: 'Dia 1 (09/12) - Noite', data: '2026-12-09', hora_inicio: '18:30', hora_fim: '21:30', carga_horaria: 3 },
  { titulo: 'Dia 2 (10/12) - Manhã', data: '2026-12-10', hora_inicio: '08:30', hora_fim: '12:00', carga_horaria: 3.5 },
  { titulo: 'Dia 2 (10/12) - Noite', data: '2026-12-10', hora_inicio: '18:00', hora_fim: '20:00', carga_horaria: 2 },
];

// Os dois eventos de 10 h do desenho anterior. São removidos, mas só se ainda não tiverem
// presença registrada (apagar um evento apagaria a frequência dele).
const TITULOS_ANTIGOS = ['Jornada Acadêmica - Dia 1', 'Jornada Acadêmica - Dia 2'];

// Pode rodar várias vezes: só insere a sessão que ainda não existe (mesmo título e data).
// Para alterar uma sessão que já existe, mude direto no banco (ou apague-a se não tiver presenças).
exports.seed = async function seed(knex) {
  for (const titulo of TITULOS_ANTIGOS) {
    const antigo = await knex('eventos').where({ titulo }).first('id');
    if (!antigo) continue;

    const { total } = await knex('frequencia').where({ evento_id: antigo.id }).count({ total: 'id' }).first();
    if (Number(total) > 0) {
      console.log(`Evento antigo "${titulo}" tem ${total} presença(s) e foi mantido. Remova-o manualmente se quiser.`);
      continue;
    }
    await knex('eventos').where({ id: antigo.id }).del();
    console.log(`Evento antigo removido: "${titulo}"`);
  }

  for (const evento of EVENTOS) {
    const existente = await knex('eventos').where({ titulo: evento.titulo, data: evento.data }).first('id');
    if (existente) {
      console.log(`Evento "${evento.titulo}" (${evento.data}) já existe; mantido.`);
      continue;
    }
    await knex('eventos').insert(evento);
    console.log(
      `Evento criado: "${evento.titulo}" (${evento.data}, ${evento.hora_inicio}-${evento.hora_fim}, ${evento.carga_horaria} h)`
    );
  }
};
