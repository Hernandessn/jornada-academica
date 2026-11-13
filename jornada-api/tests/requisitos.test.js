// Requisitos novos do professor (12/11/2026): disciplina e formato, período de inscrições,
// configurações ampliadas e consulta pública de certificado.
const request = require('supertest');
const {
  db,
  CPF_2,
  CPF_3,
  hojeSaoPaulo,
  somarDias,
  iniciar,
  limpar,
  restaurarConfiguracao,
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

const inscrever = (corpo) => request(app).post('/api/inscricoes').send(corpo);

describe('Disciplina e formato', () => {
  test('disciplina ausente: 400 no campo disciplina', async () => {
    const { disciplina, ...semDisciplina } = alunoValido();
    const res = await inscrever(semDisciplina).expect(400);
    expect(res.body.campos.disciplina).toEqual(expect.any(String));
    expect(await db('alunos').count({ total: 'id' }).first()).toEqual({ total: 0 });
  });

  test('disciplina inexistente (ou escrita diferente): 400 no campo disciplina', async () => {
    for (const disciplina of ['Matemática', 'apiext i', 'APIExt VII']) {
      const res = await inscrever(alunoValido({ disciplina })).expect(400);
      expect(res.body.campos.disciplina).toMatch(/inválida/i);
    }
  });

  test.each([
    ['APIExt I', 'banner'],
    ['APIExt II', 'comunicacao_oral'],
    ['APIExt III', 'banner'],
    ['APIExt IV', 'comunicacao_oral'],
    ['APIExt V', 'banner'],
    ['APIExt VI', 'comunicacao_oral'],
  ])('%s define o formato automaticamente: %s', async (disciplina, formato) => {
    const res = await inscrever(alunoValido({ disciplina })).expect(201);
    expect(res.body.aluno.disciplina).toBe(disciplina);
    expect(res.body.aluno.formato).toBe(formato);

    const salvo = await db('alunos').first();
    expect(salvo.disciplina).toBe(disciplina);
    expect(salvo.formato).toBe(formato);
  });

  test('nas APIExt o servidor decide: formato enviado pelo cliente é ignorado', async () => {
    const res = await inscrever(
      alunoValido({ disciplina: 'APIExt I', formato: 'comunicacao_oral' })
    ).expect(201);
    expect(res.body.aluno.formato).toBe('banner');
  });

  test.each(['PIC', 'Outras'])('%s sem formato: 400 pedindo para escolher', async (disciplina) => {
    const res = await inscrever(alunoValido({ disciplina })).expect(400);
    expect(res.body.campos.formato).toMatch(/banner ou comunicação oral/i);
    expect(res.body.campos.disciplina).toBeUndefined();
  });

  test('PIC e Outras: o aluno escolhe entre banner e comunicação oral', async () => {
    const pic = await inscrever(alunoValido({ disciplina: 'PIC', formato: 'banner' })).expect(201);
    expect(pic.body.aluno.formato).toBe('banner');

    // aceita o texto "bonito" e normaliza para o valor canônico
    const outras = await inscrever(
      alunoValido({
        disciplina: 'Outras',
        formato: 'Comunicação oral',
        email: 'outra@exemplo.com',
        cpf: CPF_2,
      })
    ).expect(201);
    expect(outras.body.aluno.formato).toBe('comunicacao_oral');
    expect(await db('alunos').where({ cpf: '11144477735' }).first()).toEqual(
      expect.objectContaining({ disciplina: 'Outras', formato: 'comunicacao_oral' })
    );
  });

  test('PIC com formato inválido: 400 no campo formato', async () => {
    for (const formato of ['pôster', 'oral', 123]) {
      const res = await inscrever(alunoValido({ disciplina: 'PIC', formato })).expect(400);
      expect(res.body.campos.formato).toEqual(expect.any(String));
    }
  });

  test('GET /api/alunos devolve disciplina e formato', async () => {
    await criarAluno(app, { disciplina: 'APIExt II' });
    const token = await loginComo(app, 'professor');
    const res = await request(app).get('/api/alunos').set(auth(token)).expect(200);
    expect(res.body.alunos[0]).toEqual(
      expect.objectContaining({ disciplina: 'APIExt II', formato: 'comunicacao_oral' })
    );
  });
});

describe('Período de inscrições', () => {
  const hoje = () => hojeSaoPaulo();

  test('dentro do período: 201', async () => {
    await inscrever(alunoValido()).expect(201);
  });

  test('antes de inscricoes_de: 403 com mensagem clara e nada é gravado', async () => {
    await restaurarConfiguracao({
      inscricoes_de: somarDias(hoje(), 1),
      inscricoes_ate: somarDias(hoje(), 10),
    });
    const res = await inscrever(alunoValido()).expect(403);
    expect(res.body.erro).toMatch(/ainda não começaram/i);
    const [ano, mes, dia] = somarDias(hoje(), 1).split('-');
    expect(res.body.erro).toContain(`${dia}/${mes}/${ano}`);
    expect(res.body.campos).toBeUndefined();
    expect(await db('alunos').count({ total: 'id' }).first()).toEqual({ total: 0 });
  });

  test('depois de inscricoes_ate: 403 com mensagem clara', async () => {
    await restaurarConfiguracao({
      inscricoes_de: somarDias(hoje(), -10),
      inscricoes_ate: somarDias(hoje(), -1),
    });
    const res = await inscrever(alunoValido()).expect(403);
    expect(res.body.erro).toMatch(/encerradas/i);
    expect(await db('alunos').count({ total: 'id' }).first()).toEqual({ total: 0 });
  });

  test('o período é inclusivo: no primeiro e no último dia ainda aceita', async () => {
    await restaurarConfiguracao({ inscricoes_de: hoje(), inscricoes_ate: hoje() });
    await inscrever(alunoValido()).expect(201);
  });

  test('ignorar_datas verdadeiro libera as inscrições mesmo fora do período', async () => {
    await restaurarConfiguracao({
      inscricoes_de: somarDias(hoje(), -10),
      inscricoes_ate: somarDias(hoje(), -1),
      ignorar_datas: true,
    });
    await inscrever(alunoValido()).expect(201);
  });

  test('fora do período responde 403 mesmo com formulário vazio', async () => {
    await restaurarConfiguracao({
      inscricoes_de: somarDias(hoje(), 3),
      inscricoes_ate: somarDias(hoje(), 6),
    });
    await inscrever({}).expect(403);
  });

  test('o admin reabre as inscrições pela API', async () => {
    await restaurarConfiguracao({
      inscricoes_de: somarDias(hoje(), -10),
      inscricoes_ate: somarDias(hoje(), -1),
    });
    await inscrever(alunoValido()).expect(403);

    const admin = await loginComo(app, 'admin');
    await request(app)
      .put('/api/configuracoes')
      .set(auth(admin))
      .send({ inscricoes_ate: somarDias(hoje(), 5) })
      .expect(200);

    await inscrever(alunoValido()).expect(201);
  });
});

describe('Configurações ampliadas', () => {
  const silenciar = async (fn) => {
    const log = console.log;
    console.log = () => {};
    try {
      await fn();
    } finally {
      console.log = log;
    }
  };

  test('o seed cria a configuração padrão pedida pelo professor', async () => {
    await db('configuracoes').del();
    await silenciar(() => require('../seeds/03_configuracoes').seed(db));

    const admin = await loginComo(app, 'admin');
    const res = await request(app).get('/api/configuracoes').set(auth(admin)).expect(200);
    expect(res.body).toEqual({
      modo_aprovacao: 'percentual',
      valor_minimo: 75,
      carga_horaria_certificado: 20,
      certificados_a_partir_de: '2026-12-14',
      inscricoes_de: '2026-11-16',
      inscricoes_ate: '2026-11-30',
      ignorar_datas: false,
      coordenador_nome: '',
      reitora_nome: 'Dra. Roselane Moita Pierot',
    });
  });

  test('o seed não sobrescreve a configuração que o admin já escolheu', async () => {
    await restaurarConfiguracao({ modo_aprovacao: 'horas', valor_minimo: 9 });
    await silenciar(() => require('../seeds/03_configuracoes').seed(db));
    expect(await db('configuracoes').first()).toEqual(
      expect.objectContaining({ modo_aprovacao: 'horas', valor_minimo: 9 })
    );
  });

  test('PUT grava todos os campos e GET devolve os mesmos valores', async () => {
    const admin = await loginComo(app, 'admin');
    const nova = {
      modo_aprovacao: 'horas',
      valor_minimo: 8,
      carga_horaria_certificado: 30,
      certificados_a_partir_de: '2026-12-20',
      inscricoes_de: '2026-11-17',
      inscricoes_ate: '2026-12-01',
      ignorar_datas: true,
      coordenador_nome: 'Prof. Coordenador de Teste',
      reitora_nome: 'Dra. Reitora de Teste',
    };

    const put = await request(app).put('/api/configuracoes').set(auth(admin)).send(nova).expect(200);
    expect(put.body).toEqual(nova);

    const get = await request(app).get('/api/configuracoes').set(auth(admin)).expect(200);
    expect(get.body).toEqual(nova);
    expect(typeof get.body.ignorar_datas).toBe('boolean');
  });

  test('PUT parcial altera só o que foi enviado', async () => {
    const admin = await loginComo(app, 'admin');
    const antes = (await request(app).get('/api/configuracoes').set(auth(admin)).expect(200)).body;

    const res = await request(app)
      .put('/api/configuracoes')
      .set(auth(admin))
      .send({ coordenador_nome: '  Prof. Fulano  ', ignorar_datas: true })
      .expect(200);

    expect(res.body).toEqual({
      ...antes,
      coordenador_nome: 'Prof. Fulano', // sem os espaços das pontas
      ignorar_datas: true,
    });

    // e dá para desligar de novo
    const desligado = await request(app)
      .put('/api/configuracoes')
      .set(auth(admin))
      .send({ ignorar_datas: false })
      .expect(200);
    expect(desligado.body.ignorar_datas).toBe(false);
  });

  test('PUT valida cada campo novo (400 apontando o campo)', async () => {
    const admin = await loginComo(app, 'admin');
    const put = (corpo) => request(app).put('/api/configuracoes').set(auth(admin)).send(corpo);

    for (const data of ['2026-13-40', '16/11/2026', '2026-02-30', 20261116, '']) {
      const res = await put({ inscricoes_de: data }).expect(400);
      expect(res.body.campos.inscricoes_de).toEqual(expect.any(String));
    }
    expect((await put({ certificados_a_partir_de: 'amanhã' }).expect(400)).body.campos.certificados_a_partir_de).toBeDefined();
    expect((await put({ ignorar_datas: 'sim' }).expect(400)).body.campos.ignorar_datas).toBeDefined();
    expect((await put({ ignorar_datas: 1 }).expect(400)).body.campos.ignorar_datas).toBeDefined();
    expect((await put({ carga_horaria_certificado: 0 }).expect(400)).body.campos.carga_horaria_certificado).toBeDefined();
    expect((await put({ carga_horaria_certificado: '20' }).expect(400)).body.campos.carga_horaria_certificado).toBeDefined();
    expect((await put({ reitora_nome: '   ' }).expect(400)).body.campos.reitora_nome).toBeDefined();
    expect((await put({ coordenador_nome: 'x'.repeat(151) }).expect(400)).body.campos.coordenador_nome).toBeDefined();
  });

  test('inscricoes_ate anterior a inscricoes_de: 400 (inclusive quando só um dos dois é enviado)', async () => {
    const admin = await loginComo(app, 'admin');
    const put = (corpo) => request(app).put('/api/configuracoes').set(auth(admin)).send(corpo);

    const junto = await put({ inscricoes_de: '2026-12-10', inscricoes_ate: '2026-12-01' }).expect(400);
    expect(junto.body.campos.inscricoes_ate).toBeDefined();

    // a data inicial salva é de uma semana atrás: uma data final de dez dias atrás fica antes dela
    const so = await put({ inscricoes_ate: somarDias(hojeSaoPaulo(), -10) }).expect(400);
    expect(so.body.campos.inscricoes_ate).toBeDefined();
  });

  test('trocar o modo de aprovação exige informar o valor mínimo', async () => {
    const admin = await loginComo(app, 'admin');
    const put = (corpo) => request(app).put('/api/configuracoes').set(auth(admin)).send(corpo);

    const res = await put({ modo_aprovacao: 'horas' }).expect(400);
    expect(res.body.campos.valor_minimo).toMatch(/modo/i);

    // nada mudou
    expect(await db('configuracoes').first()).toEqual(
      expect.objectContaining({ modo_aprovacao: 'percentual', valor_minimo: 75 })
    );

    // repetir o mesmo modo sem valor é permitido; e trocar informando o valor também
    await put({ modo_aprovacao: 'percentual' }).expect(200);
    await put({ modo_aprovacao: 'horas', valor_minimo: 10 }).expect(200);
  });

  test('só o admin lê e altera (professor recebe 403 e nada muda)', async () => {
    const professor = await loginComo(app, 'professor');
    await request(app).get('/api/configuracoes').set(auth(professor)).expect(403);
    await request(app)
      .put('/api/configuracoes')
      .set(auth(professor))
      .send({ reitora_nome: 'Outra Pessoa' })
      .expect(403);
    expect((await db('configuracoes').first()).reitora_nome).toBe('Dra. Roselane Moita Pierot');
  });
});

describe('POST /api/certificados/consulta', () => {
  const consultar = (corpo) => request(app).post('/api/certificados/consulta').send(corpo);
  const MARIA = { cpf: '529.982.247-25', email: 'maria@exemplo.com' };
  const NAO_ENCONTRADO = {
    status: 'nao_encontrado',
    primeiro_nome: null,
    presenca: null,
    minimo: null,
  };

  test('é público (sem login) e não deixa a resposta em cache', async () => {
    await criarAluno(app);
    const res = await consultar(MARIA).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('aprovado: devolve só primeiro nome, status, presença e mínimo', async () => {
    const aluno = await criarAluno(app);
    await registrarPresencas(app, aluno.id, await listarEventos(app));

    const res = await consultar(MARIA).expect(200);
    expect(res.body).toEqual({
      status: 'aprovado',
      primeiro_nome: 'Maria',
      presenca: { horas: 11.5, percentual: 100 },
      minimo: { modo_aprovacao: 'percentual', valor_minimo: 75 },
    });

    // nenhum outro dado pessoal em lugar nenhum da resposta
    const texto = JSON.stringify(res.body).toLowerCase();
    for (const proibido of ['silva', 'maria@exemplo.com', '52998224725', '99999', '20231234']) {
      expect(texto).not.toContain(proibido);
    }
  });

  test('nao_elegivel: presença abaixo do mínimo (ou nenhuma)', async () => {
    const aluno = await criarAluno(app);

    const semPresenca = await consultar(MARIA).expect(200);
    expect(semPresenca.body).toEqual({
      status: 'nao_elegivel',
      primeiro_nome: 'Maria',
      presenca: { horas: 0, percentual: 0 },
      minimo: { modo_aprovacao: 'percentual', valor_minimo: 75 },
    });

    // só a última sessão (2 h de 11,5 h = 17,39%)
    const sessoes = await listarEventos(app);
    await registrarPresencas(app, aluno.id, [sessoes[3]]);
    const pouca = await consultar(MARIA).expect(200);
    expect(pouca.body.status).toBe('nao_elegivel');
    expect(pouca.body.presenca).toEqual({ horas: 2, percentual: 17.39 });
  });

  test('segue a regra vigente: no modo horas devolve o mínimo em horas', async () => {
    const aluno = await criarAluno(app);
    const sessoes = await listarEventos(app);
    await registrarPresencas(app, aluno.id, [sessoes[0], sessoes[1]]); // 6 h

    const admin = await loginComo(app, 'admin');
    await request(app)
      .put('/api/configuracoes')
      .set(auth(admin))
      .send({ modo_aprovacao: 'horas', valor_minimo: 6 })
      .expect(200);

    const res = await consultar(MARIA).expect(200);
    expect(res.body.status).toBe('aprovado');
    expect(res.body.minimo).toEqual({ modo_aprovacao: 'horas', valor_minimo: 6 });
  });

  test('aceita CPF com ou sem máscara e e-mail em maiúsculas', async () => {
    await criarAluno(app);
    for (const corpo of [
      { cpf: '52998224725', email: 'maria@exemplo.com' },
      { cpf: '529.982.247-25', email: 'MARIA@EXEMPLO.COM' },
      { cpf: ' 529.982.247-25 ', email: '  Maria@Exemplo.com ' },
    ]) {
      const res = await consultar(corpo).expect(200);
      expect(res.body.primeiro_nome).toBe('Maria');
    }
  });

  describe('antes da data de liberação', () => {
    test('devolve ainda_nao_liberado, sem consultar o aluno', async () => {
      const aluno = await criarAluno(app);
      await registrarPresencas(app, aluno.id, await listarEventos(app));
      const liberacao = somarDias(hojeSaoPaulo(), 5);
      await restaurarConfiguracao({ certificados_a_partir_de: liberacao });

      const res = await consultar(MARIA).expect(200);
      expect(res.body).toEqual({
        status: 'ainda_nao_liberado',
        primeiro_nome: null,
        presenca: null,
        minimo: null,
        certificados_a_partir_de: liberacao,
      });

      // CPF que nem existe recebe exatamente a mesma resposta
      const outro = await consultar({ cpf: CPF_3, email: 'ninguem@exemplo.com' }).expect(200);
      expect(outro.body).toEqual(res.body);
    });

    test('ignorar_datas verdadeiro libera a consulta', async () => {
      const aluno = await criarAluno(app);
      await registrarPresencas(app, aluno.id, await listarEventos(app));
      await restaurarConfiguracao({
        certificados_a_partir_de: somarDias(hojeSaoPaulo(), 5),
        ignorar_datas: true,
      });

      const res = await consultar(MARIA).expect(200);
      expect(res.body.status).toBe('aprovado');
    });

    test('no próprio dia da liberação já responde normalmente', async () => {
      await criarAluno(app);
      await restaurarConfiguracao({ certificados_a_partir_de: hojeSaoPaulo() });
      const res = await consultar(MARIA).expect(200);
      expect(res.body.status).toBe('nao_elegivel');
    });
  });

  describe('não encontrado: a resposta não revela se o CPF existe', () => {
    test('CPF inexistente e CPF com e-mail incorreto recebem a MESMA resposta', async () => {
      await criarAluno(app);

      const cpfInexistente = await consultar({ cpf: CPF_3, email: 'maria@exemplo.com' });
      const emailErrado = await consultar({ cpf: MARIA.cpf, email: 'outro@exemplo.com' });

      expect(cpfInexistente.status).toBe(200);
      expect(emailErrado.status).toBe(cpfInexistente.status);
      expect(cpfInexistente.body).toEqual(NAO_ENCONTRADO);
      expect(emailErrado.body).toEqual(cpfInexistente.body);
      expect(JSON.stringify(emailErrado.body)).not.toContain('Maria');
    });

    test('CPF de um aluno com o e-mail de outro aluno também não é encontrado', async () => {
      await criarAluno(app);
      await criarAluno(app, { nome: 'João Pereira', email: 'joao@exemplo.com', cpf: CPF_2 });

      const res = await consultar({ cpf: MARIA.cpf, email: 'joao@exemplo.com' }).expect(200);
      expect(res.body).toEqual(NAO_ENCONTRADO);
    });
  });

  describe('dados malformados (400)', () => {
    test('corpo vazio: os dois campos são obrigatórios', async () => {
      const res = await consultar({}).expect(400);
      expect(res.body.campos.cpf).toBeDefined();
      expect(res.body.campos.email).toBeDefined();
    });

    test('só o CPF ou só o e-mail: 400 no campo que falta', async () => {
      expect((await consultar({ cpf: MARIA.cpf }).expect(400)).body.campos.email).toBeDefined();
      expect((await consultar({ email: MARIA.email }).expect(400)).body.campos.cpf).toBeDefined();
    });

    test('CPF com letras, CPF inválido e e-mail inválido', async () => {
      expect((await consultar({ cpf: '529.982.247-2A', email: MARIA.email }).expect(400)).body.campos.cpf).toMatch(/números/i);
      expect((await consultar({ cpf: '111.111.111-11', email: MARIA.email }).expect(400)).body.campos.cpf).toBeDefined();
      expect((await consultar({ cpf: MARIA.cpf, email: 'sem-arroba' }).expect(400)).body.campos.email).toBeDefined();
    });
  });
});
