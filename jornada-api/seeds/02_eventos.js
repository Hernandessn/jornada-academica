// Eventos da Jornada. Para mudar datas, títulos ou carga horária, edite SÓ a lista abaixo.
// (Premissa: 2 dias de 10 h cada, somando as 20 h do certificado.)
const EVENTOS = [
  { titulo: 'Jornada Acadêmica - Dia 1', data: '2026-12-09', carga_horaria: 10 },
  { titulo: 'Jornada Acadêmica - Dia 2', data: '2026-12-10', carga_horaria: 10 },
];

// Pode rodar várias vezes: só insere o evento que ainda não existe (mesmo título e data).
// Se já houver presenças registradas, NÃO apague eventos (isso apagaria a frequência deles);
// corrija direto no banco ou crie um novo evento.
exports.seed = async function seed(knex) {
  for (const evento of EVENTOS) {
    const existente = await knex('eventos')
      .where({ titulo: evento.titulo, data: evento.data })
      .first();
    if (existente) {
      console.log(`Evento "${evento.titulo}" (${evento.data}) já existe; mantido.`);
      continue;
    }
    await knex('eventos').insert(evento);
    console.log(`Evento criado: "${evento.titulo}" (${evento.data}, ${evento.carga_horaria} h)`);
  }
};
