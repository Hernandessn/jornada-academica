const request = require('supertest');
const {
  db,
  CREDENCIAIS,
  CPF_1,
  CPF_2,
  iniciar,
  limpar,
  loginComo,
  auth,
  alunoValido,
  criarAluno,
  listarEventos,
  registrarPresencas,
} = require('./helpers');

let app;

beforeAll(async () => {
  app = await iniciar();
});

beforeEach(async () => {
  await limpar();
});

afterAll(async () => {
  await db.destroy();
});

describe('Saúde e rotas inexistentes', () => {
  test('GET /api/saude responde ok', async () => {
    const res = await request(app).get('/api/saude').expect(200);
    expect(res.body.status).toBe('ok');
  });

  test('rota inexistente responde 404 em JSON', async () => {
    const res = await request(app).get('/api/nao-existe').expect(404);
    expect(res.body.erro).toBeDefined();
  });
});

describe('POST /api/inscricoes', () => {
  test('formulário vazio: 400 com mensagem em todos os campos', async () => {
    const res = await request(app).post('/api/inscricoes').send({}).expect(400);
    expect(res.body.erro).toBeDefined();
    for (const campo of ['nome', 'email', 'telefone', 'cpf', 'curso', 'disciplina']) {
      expect(res.body.campos[campo]).toEqual(expect.any(String));
    }
  });

  test('campos em branco (só espaços) também são recusados', async () => {
    const res = await request(app)
      .post('/api/inscricoes')
      .send({
        nome: '  ',
        email: ' ',
        telefone: ' ',
        cpf: ' ',
        curso: ' ',
        disciplina: ' ',
      })
      .expect(400);
    expect(Object.keys(res.body.campos)).toHaveLength(6);
  });

  test('CPF com letras: 400 no campo cpf', async () => {
    for (const cpf of ['abc.def.ghi-jk', '529.982.247-2A']) {
      const res = await request(app)
        .post('/api/inscricoes')
        .send(alunoValido({ cpf }))
        .expect(400);
      expect(res.body.campos.cpf).toMatch(/números/i);
    }
  });

  test('CPF inválido: 400 no campo cpf', async () => {
    for (const cpf of ['111.111.111-11', '529.982.247-24', '123.456.789-00', '123']) {
      const res = await request(app)
        .post('/api/inscricoes')
        .send(alunoValido({ cpf }))
        .expect(400);
      expect(res.body.campos.cpf).toEqual(expect.any(String));
    }
  });

  test('e-mail, telefone e nome inválidos são recusados', async () => {
    const res = await request(app)
      .post('/api/inscricoes')
      .send(alunoValido({ email: 'sem-arroba', telefone: '123', nome: 'Maria' }))
      .expect(400);
    expect(res.body.campos.email).toBeDefined();
    expect(res.body.campos.telefone).toBeDefined();
    expect(res.body.campos.nome).toBeDefined();
  });

  test('inscrição válida: 201, salva só dígitos e e-mail em minúsculas, CPF mascarado na resposta', async () => {
    const res = await request(app)
      .post('/api/inscricoes')
      .send(alunoValido({ email: 'MARIA@Exemplo.com', matricula: '2023.1234-5' }))
      .expect(201);

    expect(res.body.aluno.cpf).toBe('***.982.247-**');
    expect(res.body.aluno.disciplina).toBe('APIExt I');
    expect(res.body.aluno.formato).toBe('banner');

    const salvo = await db('alunos').first();
    expect(salvo.cpf).toBe('52998224725');
    expect(salvo.telefone).toBe('86999991234');
    expect(salvo.matricula).toBe('202312345');
    expect(salvo.email).toBe('maria@exemplo.com');
    expect(salvo.disciplina).toBe('APIExt I');
    expect(salvo.formato).toBe('banner');
  });

  test('participante externo: sem matrícula e com instituição, 201', async () => {
    const dados = alunoValido({ instituicao: '  Universidade Federal do Piauí ' });
    delete dados.matricula;
    const res = await request(app).post('/api/inscricoes').send(dados).expect(201);
    expect(res.body.aluno.instituicao).toBe('Universidade Federal do Piauí');

    const salvo = await db('alunos').first();
    expect(salvo.matricula).toBe('');
    expect(salvo.instituicao).toBe('Universidade Federal do Piauí');
  });

  test('matrícula vazia ou nula é aceita; aluno da Uninassau fica sem instituição', async () => {
    await request(app).post('/api/inscricoes').send(alunoValido({ matricula: '' })).expect(201);
    expect((await db('alunos').first()).matricula).toBe('');
    await db('alunos').del();

    const res = await request(app).post('/api/inscricoes').send(alunoValido({ matricula: null })).expect(201);
    expect(res.body.aluno.instituicao).toBeNull();
    await db('alunos').del();

    await request(app).post('/api/inscricoes').send(alunoValido()).expect(201);
    const salvo = await db('alunos').first();
    expect(salvo.matricula).toBe('20231234');
    expect(salvo.instituicao).toBeNull();
  });

  test('matrícula informada continua validada; instituição longa demais é recusada', async () => {
    const letras = await request(app)
      .post('/api/inscricoes')
      .send(alunoValido({ matricula: 'abc123' }))
      .expect(400);
    expect(letras.body.campos.matricula).toMatch(/apenas números/i);

    const curta = await request(app).post('/api/inscricoes').send(alunoValido({ matricula: '12' })).expect(400);
    expect(curta.body.campos.matricula).toMatch(/4 a 20/);

    const longa = await request(app)
      .post('/api/inscricoes')
      .send(alunoValido({ instituicao: 'X'.repeat(151) }))
      .expect(400);
    expect(longa.body.campos.instituicao).toMatch(/150/);
  });

  test('CPF duplicado: 409 apontando o campo cpf (com ou sem máscara)', async () => {
    await criarAluno(app);
    const res = await request(app)
      .post('/api/inscricoes')
      .send(alunoValido({ email: 'outra@exemplo.com', cpf: '52998224725' }))
      .expect(409);
    expect(res.body.campos.cpf).toBeDefined();
    expect(res.body.campos.email).toBeUndefined();
    expect(res.body.erro).toMatch(/CPF/);
  });

  test('e-mail duplicado: 409 apontando o campo email (ignorando maiúsculas)', async () => {
    await criarAluno(app);
    const res = await request(app)
      .post('/api/inscricoes')
      .send(alunoValido({ cpf: CPF_2, email: 'MARIA@exemplo.com' }))
      .expect(409);
    expect(res.body.campos.email).toBeDefined();
    expect(res.body.campos.cpf).toBeUndefined();
    expect(res.body.erro).toMatch(/e-mail/i);
  });

  test('CPF e e-mail duplicados ao mesmo tempo: 409 nos dois campos', async () => {
    await criarAluno(app);
    const res = await request(app).post('/api/inscricoes').send(alunoValido()).expect(409);
    expect(res.body.campos.cpf).toBeDefined();
    expect(res.body.campos.email).toBeDefined();
  });

  test('duas requisições simultâneas iguais: uma cria (201) e a outra recebe 409', async () => {
    const [a, b] = await Promise.all([
      request(app).post('/api/inscricoes').send(alunoValido()),
      request(app).post('/api/inscricoes').send(alunoValido()),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await db('alunos').count({ total: 'id' }).first()).toEqual({ total: 1 });
  });
});

describe('GET /api/eventos', () => {
  test('é público e lista as 4 sessões do seed, em ordem, com horário e carga horária', async () => {
    const res = await request(app).get('/api/eventos').expect(200);
    const resumo = res.body.eventos.map((e) => [e.data, e.hora_inicio, e.hora_fim, e.carga_horaria]);
    expect(resumo).toEqual([
      ['2026-12-09', '09:00', '12:00', 3],
      ['2026-12-09', '18:30', '21:30', 3],
      ['2026-12-10', '08:30', '12:00', 3.5],
      ['2026-12-10', '18:00', '20:00', 2],
    ]);
    expect(res.body.eventos[0]).toEqual(
      expect.objectContaining({ id: expect.any(Number), titulo: expect.any(String) })
    );
  });
});

describe('Autenticação', () => {
  test('login correto devolve token e usuário, sem senha_hash', async () => {
    const res = await request(app).post('/api/auth/login').send(CREDENCIAIS.professor).expect(200);

    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario).toEqual(
      expect.objectContaining({ email: CREDENCIAIS.professor.email, papel: 'professor' })
    );
    expect(JSON.stringify(res.body)).not.toContain('senha_hash');
  });

  test('senha errada e e-mail desconhecido: 401 com a mesma mensagem', async () => {
    const errada = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@jornada.local', senha: 'senha-errada-123' })
      .expect(401);
    const desconhecido = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@jornada.local', senha: 'qualquer-coisa-123' })
      .expect(401);
    expect(errada.body.erro).toBe(desconhecido.body.erro);
  });

  test('login sem campos: 400', async () => {
    const res = await request(app).post('/api/auth/login').send({}).expect(400);
    expect(res.body.campos.email).toBeDefined();
    expect(res.body.campos.senha).toBeDefined();
  });
});

describe('Acesso sem login (401)', () => {
  const rotas = [
    ['get', '/api/alunos'],
    ['post', '/api/frequencia'],
    ['get', '/api/frequencia/resumo'],
    ['get', '/api/configuracoes'],
    ['put', '/api/configuracoes'],
  ];

  test.each(rotas)('%s %s sem token responde 401', async (metodo, rota) => {
    const res = await request(app)[metodo](rota).send({}).expect(401);
    expect(res.body.erro).toBeDefined();
  });

  test('token inválido responde 401', async () => {
    await request(app).get('/api/alunos').set(auth('token.invalido.aqui')).expect(401);
  });

  test('cabeçalho Authorization sem "Bearer" responde 401', async () => {
    const token = await loginComo(app, 'admin');
    await request(app).get('/api/alunos').set({ Authorization: token }).expect(401);
  });
});

describe('Acesso com papel errado (403)', () => {
  test('professor não lê nem altera a regra de presença', async () => {
    const professor = await loginComo(app, 'professor');
    await request(app).get('/api/configuracoes').set(auth(professor)).expect(403);
    await request(app)
      .put('/api/configuracoes')
      .set(auth(professor))
      .send({ modo_aprovacao: 'horas', valor_minimo: 5 })
      .expect(403);
    await request(app)
      .put('/api/configuracoes')
      .set(auth(professor))
      .send({ ignorar_datas: true })
      .expect(403);

    // e a configuração continua a mesma
    const config = await db('configuracoes').first();
    expect(config.modo_aprovacao).toBe('percentual');
    expect(config.valor_minimo).toBe(75);
    expect(Boolean(config.ignorar_datas)).toBe(false);
  });

  test('professor consegue listar alunos e o admin também', async () => {
    await criarAluno(app);
    for (const papel of ['professor', 'admin']) {
      const token = await loginComo(app, papel);
      const res = await request(app).get('/api/alunos').set(auth(token)).expect(200);
      expect(res.body.total).toBe(1);
    }
  });
});

describe('GET /api/alunos', () => {
  test('CPF sai mascarado e nunca aparece senha_hash', async () => {
    await criarAluno(app);
    const token = await loginComo(app, 'professor');
    const res = await request(app).get('/api/alunos').set(auth(token)).expect(200);

    expect(res.body.alunos[0].cpf).toBe('***.982.247-**');
    expect(JSON.stringify(res.body)).not.toContain('52998224725');
    expect(JSON.stringify(res.body)).not.toContain('senha_hash');
  });

  test('busca por nome (sem diferenciar maiúsculas) e por CPF (com ou sem máscara)', async () => {
    await criarAluno(app);
    await criarAluno(app, { nome: 'João Pereira', email: 'joao@exemplo.com', cpf: CPF_2 });
    const token = await loginComo(app, 'professor');

    const porNome = await request(app).get('/api/alunos?busca=maria').set(auth(token)).expect(200);
    expect(porNome.body.alunos.map((a) => a.nome)).toEqual(['Maria da Silva']);

    const porCpf = await request(app)
      .get(`/api/alunos?busca=${encodeURIComponent('111.444')}`)
      .set(auth(token))
      .expect(200);
    expect(porCpf.body.alunos.map((a) => a.nome)).toEqual(['João Pereira']);

    const semResultado = await request(app)
      .get('/api/alunos?busca=zzz')
      .set(auth(token))
      .expect(200);
    expect(semResultado.body.total).toBe(0);
  });

  test('evento_id acrescenta o campo presente', async () => {
    const aluno = await criarAluno(app);
    const [sessao1, sessao2] = await listarEventos(app);
    const token = await loginComo(app, 'professor');
    await request(app)
      .post('/api/frequencia')
      .set(auth(token))
      .send({ aluno_id: aluno.id, evento_id: sessao1.id })
      .expect(201);

    const s1 = await request(app).get(`/api/alunos?evento_id=${sessao1.id}`).set(auth(token));
    const s2 = await request(app).get(`/api/alunos?evento_id=${sessao2.id}`).set(auth(token));
    expect(s1.body.alunos[0].presente).toBe(true);
    expect(s2.body.alunos[0].presente).toBe(false);
  });
});

describe('POST /api/frequencia', () => {
  test('presença duplicada: a primeira cria (201) e a repetição responde 200 sem duplicar', async () => {
    const aluno = await criarAluno(app);
    const [sessao1] = await listarEventos(app);
    const token = await loginComo(app, 'professor');
    const corpo = { aluno_id: aluno.id, evento_id: sessao1.id };

    const primeira = await request(app).post('/api/frequencia').set(auth(token)).send(corpo);
    expect(primeira.status).toBe(201);
    expect(primeira.body.ja_registrada).toBe(false);

    const segunda = await request(app).post('/api/frequencia').set(auth(token)).send(corpo);
    expect(segunda.status).toBe(200);
    expect(segunda.body.ja_registrada).toBe(true);
    expect(segunda.body.mensagem).toMatch(/já/i);

    expect(await db('frequencia').count({ total: 'id' }).first()).toEqual({ total: 1 });
  });

  test('duas chamadas simultâneas não duplicam', async () => {
    const aluno = await criarAluno(app);
    const [sessao1] = await listarEventos(app);
    const token = await loginComo(app, 'professor');
    const corpo = { aluno_id: aluno.id, evento_id: sessao1.id };

    const [a, b] = await Promise.all([
      request(app).post('/api/frequencia').set(auth(token)).send(corpo),
      request(app).post('/api/frequencia').set(auth(token)).send(corpo),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(await db('frequencia').count({ total: 'id' }).first()).toEqual({ total: 1 });
  });

  test('registra quem fez a chamada', async () => {
    const aluno = await criarAluno(app);
    const [sessao1] = await listarEventos(app);
    const token = await loginComo(app, 'professor');
    await request(app)
      .post('/api/frequencia')
      .set(auth(token))
      .send({ aluno_id: aluno.id, evento_id: sessao1.id })
      .expect(201);

    const professor = await db('usuarios').where({ papel: 'professor' }).first();
    const registro = await db('frequencia').first();
    expect(registro.registrado_por).toBe(professor.id);
  });

  test('aluno ou evento inexistente: 404; corpo inválido: 400', async () => {
    const aluno = await criarAluno(app);
    const [sessao1] = await listarEventos(app);
    const token = await loginComo(app, 'professor');

    await request(app)
      .post('/api/frequencia')
      .set(auth(token))
      .send({ aluno_id: 99999, evento_id: sessao1.id })
      .expect(404);
    await request(app)
      .post('/api/frequencia')
      .set(auth(token))
      .send({ aluno_id: aluno.id, evento_id: 99999 })
      .expect(404);

    const invalido = await request(app)
      .post('/api/frequencia')
      .set(auth(token))
      .send({ aluno_id: 'abc' })
      .expect(400);
    expect(invalido.body.campos.aluno_id).toBeDefined();
    expect(invalido.body.campos.evento_id).toBeDefined();
  });
});

// As 4 sessões do seed somam 11,5 h (3 + 3 + 3,5 + 2). Regra padrão: percentual, mínimo 75%
// (75% de 11,5 h = 8,625 h).
describe('Resumo de presença e troca da regra', () => {
  test('sem presença ninguém é elegível', async () => {
    await criarAluno(app);
    const token = await loginComo(app, 'professor');
    const res = await request(app).get('/api/frequencia/resumo').set(auth(token)).expect(200);

    expect(res.body.carga_horaria_total).toBe(11.5);
    expect(res.body.configuracao).toEqual({ modo_aprovacao: 'percentual', valor_minimo: 75 });
    expect(res.body.alunos[0]).toEqual(
      expect.objectContaining({ horas_presentes: 0, percentual: 0, elegivel: false })
    );
  });

  test('trocar a regra de presença muda a elegibilidade', async () => {
    const aluno = await criarAluno(app);
    const sessoes = await listarEventos(app);
    const professor = await loginComo(app, 'professor');
    const admin = await loginComo(app, 'admin');

    // O aluno esteve nas 2 sessões do dia 09/12: 6 h de 11,5 h (52,17%).
    await registrarPresencas(app, aluno.id, [sessoes[0], sessoes[1]]);

    const resumo = async () => {
      const res = await request(app).get('/api/frequencia/resumo').set(auth(professor)).expect(200);
      return res.body;
    };
    const definir = (corpo) =>
      request(app).put('/api/configuracoes').set(auth(admin)).send(corpo);

    // Regra padrão: 75% -> não elegível
    let r = await resumo();
    expect(r.configuracao).toEqual({ modo_aprovacao: 'percentual', valor_minimo: 75 });
    expect(r.alunos[0]).toEqual(
      expect.objectContaining({ presencas: 2, horas_presentes: 6, percentual: 52.17, elegivel: false })
    );
    expect(r.total_elegiveis).toBe(0);

    // Admin muda para 50% -> elegível
    let res = await definir({ modo_aprovacao: 'percentual', valor_minimo: 50 }).expect(200);
    expect(res.body).toEqual(expect.objectContaining({ modo_aprovacao: 'percentual', valor_minimo: 50 }));
    r = await resumo();
    expect(r.alunos[0].elegivel).toBe(true);
    expect(r.total_elegiveis).toBe(1);

    // Modo horas com mínimo de 7 h -> 6 h não bastam
    await definir({ modo_aprovacao: 'horas', valor_minimo: 7 }).expect(200);
    r = await resumo();
    expect(r.configuracao).toEqual({ modo_aprovacao: 'horas', valor_minimo: 7 });
    expect(r.alunos[0].elegivel).toBe(false);

    // Modo horas com mínimo de 6 h -> exatamente 6 h é suficiente
    await definir({ modo_aprovacao: 'horas', valor_minimo: 6 }).expect(200);
    r = await resumo();
    expect(r.alunos[0].elegivel).toBe(true);

    // Volta para 75% -> não elegível de novo
    await definir({ modo_aprovacao: 'percentual', valor_minimo: 75 }).expect(200);
    r = await resumo();
    expect(r.alunos[0].elegivel).toBe(false);

    // Com a 3ª sessão (+3,5 h = 9,5 h = 82,61%) passa dos 75%
    await registrarPresencas(app, aluno.id, [sessoes[2]]);
    r = await resumo();
    expect(r.alunos[0]).toEqual(
      expect.objectContaining({ presencas: 3, horas_presentes: 9.5, percentual: 82.61, elegivel: true })
    );

    // O admin consegue ler a regra
    const lida = await request(app).get('/api/configuracoes').set(auth(admin)).expect(200);
    expect(lida.body).toEqual(
      expect.objectContaining({ modo_aprovacao: 'percentual', valor_minimo: 75 })
    );
  });

  test('presença em todas as sessões: 11,5 h, 100% e elegível', async () => {
    const aluno = await criarAluno(app);
    const sessoes = await listarEventos(app);
    await registrarPresencas(app, aluno.id, sessoes);

    const professor = await loginComo(app, 'professor');
    const res = await request(app).get('/api/frequencia/resumo').set(auth(professor)).expect(200);
    expect(res.body.alunos[0]).toEqual(
      expect.objectContaining({ presencas: 4, horas_presentes: 11.5, percentual: 100, elegivel: true })
    );
  });

  test('o resumo mostra só a regra de presença e mascara o CPF', async () => {
    await criarAluno(app);
    const token = await loginComo(app, 'professor');
    const res = await request(app).get('/api/frequencia/resumo').set(auth(token)).expect(200);
    expect(res.body.alunos[0].cpf).toBe('***.982.247-**');
    expect(Object.keys(res.body.configuracao).sort()).toEqual(['modo_aprovacao', 'valor_minimo']);
  });

  test('PUT /api/configuracoes valida os dados (400)', async () => {
    const admin = await loginComo(app, 'admin');
    const put = (corpo) => request(app).put('/api/configuracoes').set(auth(admin)).send(corpo);

    expect((await put({}).expect(400)).body.erro).toMatch(/ao menos um campo/i);
    expect((await put({ modo_aprovacao: 'xyz', valor_minimo: 10 }).expect(400)).body.campos.modo_aprovacao).toBeDefined();
    expect((await put({ modo_aprovacao: 'horas', valor_minimo: -5 }).expect(400)).body.campos.valor_minimo).toBeDefined();
    expect((await put({ modo_aprovacao: 'horas', valor_minimo: '20' }).expect(400)).body.campos.valor_minimo).toBeDefined();
    expect((await put({ modo_aprovacao: 'percentual', valor_minimo: 150 }).expect(400)).body.campos.valor_minimo).toBeDefined();

    // nada foi alterado
    expect(await db('configuracoes').first()).toEqual(
      expect.objectContaining({ modo_aprovacao: 'percentual', valor_minimo: 75 })
    );
  });
});

describe('calcularResumoPresenca (reutilizável pelo módulo de certificado)', () => {
  test('devolve a configuração completa e os alunos com elegivel e CPF completo para uso interno', async () => {
    const { calcularResumoPresenca } = require('../src/servicos/presenca');
    const aluno = await criarAluno(app);
    const sessoes = await listarEventos(app);
    await registrarPresencas(app, aluno.id, sessoes);

    const resumo = await calcularResumoPresenca();
    expect(resumo.configuracao).toEqual(
      expect.objectContaining({
        modo_aprovacao: 'percentual',
        valor_minimo: 75,
        carga_horaria_certificado: 20,
        reitora_nome: 'Dra. Roselane Moita Pierot',
      })
    );
    expect(resumo.carga_horaria_total).toBe(11.5);
    expect(resumo.alunos).toHaveLength(1);
    expect(resumo.alunos[0]).toEqual(
      expect.objectContaining({
        id: aluno.id,
        cpf: '52998224725',
        disciplina: 'APIExt I',
        formato: 'banner',
        elegivel: true,
      })
    );
  });

  test('com { alunoId } calcula só para aquele aluno', async () => {
    const { calcularResumoPresenca } = require('../src/servicos/presenca');
    const maria = await criarAluno(app);
    await criarAluno(app, { nome: 'João Pereira', email: 'joao@exemplo.com', cpf: CPF_2 });
    const sessoes = await listarEventos(app);
    await registrarPresencas(app, maria.id, sessoes);

    const resumo = await calcularResumoPresenca(db, { alunoId: maria.id });
    expect(resumo.alunos).toHaveLength(1);
    expect(resumo.alunos[0].id).toBe(maria.id);
    expect(resumo.alunos[0].horas_presentes).toBe(11.5);
  });
});
