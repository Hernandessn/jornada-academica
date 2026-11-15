// Módulo de certificado e e-mail: emissão (admin), download público e geração do PDF.
// O envio de e-mail é simulado (mock): nenhum e-mail de verdade sai nos testes.
jest.mock('../src/servicos/email', () => ({
  NOME_ANEXO: 'certificado-jornada-academica.pdf',
  emailConfigurado: jest.fn(),
  mensagemConfiguracaoEmail: jest.fn(() => 'O envio de e-mail não está configurado (teste).'),
  enviarCertificado: jest.fn(),
}));

const request = require('supertest');
const email = require('../src/servicos/email');
const { gerarCertificadoPdf } = require('../src/servicos/certificadoPdf');
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
  email.enviarCertificado.mockReset();
  email.enviarCertificado.mockResolvedValue({ id: 'teste', previewUrl: null });
  email.emailConfigurado.mockReset();
  email.emailConfigurado.mockReturnValue(true);
});

afterAll(async () => {
  await db.destroy();
});

const emitir = (token, corpo = {}) =>
  request(app).post('/api/certificados/emitir').set(auth(token)).send(corpo);

const baixar = (corpo) => request(app).post('/api/certificados/baixar').send(corpo);

// Parser para respostas binárias (PDF) no supertest.
const comoBuffer = (res, cb) => {
  const pedacos = [];
  res.on('data', (p) => pedacos.push(p));
  res.on('end', () => cb(null, Buffer.concat(pedacos)));
};

const baixarPdf = (corpo) => request(app).post('/api/certificados/baixar').send(corpo).buffer(true).parse(comoBuffer);

const MARIA = { cpf: '529.982.247-25', email: 'maria@exemplo.com' };
const JOAO = { nome: 'João Pereira', email: 'joao@exemplo.com', cpf: CPF_2 };

// Cria a Maria (elegível: esteve em todas as sessões) e, opcionalmente, o João.
async function criarElegivel(dados = {}) {
  const aluno = await criarAluno(app, dados);
  await registrarPresencas(app, aluno.id, await listarEventos(app));
  return aluno;
}

describe('POST /api/certificados/emitir: acesso', () => {
  test('sem token: 401', async () => {
    await request(app).post('/api/certificados/emitir').send({}).expect(401);
    expect(email.enviarCertificado).not.toHaveBeenCalled();
  });

  test('professor: 403 e nada é enviado', async () => {
    await criarElegivel();
    const professor = await loginComo(app, 'professor');
    await emitir(professor).expect(403);
    expect(email.enviarCertificado).not.toHaveBeenCalled();
    expect(await db('certificados').count({ total: 'id' }).first()).toEqual({ total: 0 });
  });
});

describe('POST /api/certificados/emitir: antes da liberação', () => {
  test('403 com mensagem clara e nada é enviado nem gravado', async () => {
    await criarElegivel();
    const liberacao = somarDias(hojeSaoPaulo(), 5);
    await restaurarConfiguracao({ certificados_a_partir_de: liberacao });

    const admin = await loginComo(app, 'admin');
    const res = await emitir(admin).expect(403);
    const [ano, mes, dia] = liberacao.split('-');
    expect(res.body.erro).toContain(`${dia}/${mes}/${ano}`);
    expect(email.enviarCertificado).not.toHaveBeenCalled();
    expect(await db('certificados').count({ total: 'id' }).first()).toEqual({ total: 0 });
  });

  test('com ignorar_datas verdadeiro a emissão é liberada', async () => {
    await criarElegivel();
    await restaurarConfiguracao({
      certificados_a_partir_de: somarDias(hojeSaoPaulo(), 5),
      ignorar_datas: true,
    });
    const admin = await loginComo(app, 'admin');
    const res = await emitir(admin).expect(200);
    expect(res.body.enviados).toBe(1);
  });
});

describe('POST /api/certificados/emitir: emissão', () => {
  test('só os elegíveis entram: envia o PDF, registra e responde sem CPF', async () => {
    const maria = await criarElegivel();
    await criarAluno(app, JOAO); // sem presença: não elegível
    const parcial = await criarAluno(app, {
      nome: 'Ana Souza',
      email: 'ana@exemplo.com',
      cpf: '390.533.447-05',
    });
    await registrarPresencas(app, parcial.id, [(await listarEventos(app))[3]]); // 2 h de 11,5 h: não elegível

    const admin = await loginComo(app, 'admin');
    const res = await emitir(admin).expect(200);

    expect(res.body).toEqual({ emitidos: 1, enviados: 1, ja_enviados: 0, falhas: [] });

    // um único e-mail, para a Maria, com o PDF anexado
    expect(email.enviarCertificado).toHaveBeenCalledTimes(1);
    const envio = email.enviarCertificado.mock.calls[0][0];
    expect(envio.para).toBe('maria@exemplo.com');
    expect(envio.nome).toBe('Maria da Silva');
    expect(Buffer.isBuffer(envio.pdf)).toBe(true);
    expect(envio.pdf.subarray(0, 4).toString()).toBe('%PDF');

    // só ela foi registrada
    const registros = await db('certificados').select('aluno_id');
    expect(registros).toEqual([{ aluno_id: maria.id }]);

    // a resposta não tem CPF
    expect(JSON.stringify(res.body)).not.toMatch(/\d{3}\.?\d{3}\.?\d{3}/);
  });

  test('quem já recebeu não recebe de novo', async () => {
    await criarElegivel();
    const admin = await loginComo(app, 'admin');

    const primeira = await emitir(admin).expect(200);
    expect(primeira.body).toEqual({ emitidos: 1, enviados: 1, ja_enviados: 0, falhas: [] });

    const segunda = await emitir(admin).expect(200);
    expect(segunda.body).toEqual({ emitidos: 0, enviados: 0, ja_enviados: 1, falhas: [] });

    expect(email.enviarCertificado).toHaveBeenCalledTimes(1);
    expect(await db('certificados').count({ total: 'id' }).first()).toEqual({ total: 1 });
  });

  test('falha no e-mail de um participante não derruba o lote e ele não é registrado', async () => {
    await criarElegivel();
    await criarElegivel(JOAO);

    const erro = Object.assign(new Error('550 mailbox joao@exemplo.com unavailable'), { code: 'EENVELOPE' });
    email.enviarCertificado.mockImplementation(async ({ para }) => {
      if (para === 'joao@exemplo.com') throw erro;
      return { id: 'ok', previewUrl: null };
    });

    const admin = await loginComo(app, 'admin');
    const res = await emitir(admin).expect(200);

    expect(res.body.emitidos).toBe(2);
    expect(res.body.enviados).toBe(1);
    expect(res.body.ja_enviados).toBe(0);
    expect(res.body.falhas).toHaveLength(1);
    expect(res.body.falhas[0]).toEqual({
      aluno_id: expect.any(Number),
      nome: 'João Pereira',
      motivo: 'Falha no envio do e-mail (EENVELOPE).',
    });
    // o motivo não repassa a mensagem do servidor, que cita o e-mail do destinatário
    expect(JSON.stringify(res.body)).not.toContain('joao@exemplo.com');

    // só a Maria foi registrada
    const registrados = await db('certificados').join('alunos', 'alunos.id', 'certificados.aluno_id').select('alunos.nome');
    expect(registrados.map((r) => r.nome)).toEqual(['Maria da Silva']);

    // repetir a emissão tenta de novo só quem falhou
    email.enviarCertificado.mockResolvedValue({ id: 'ok', previewUrl: null });
    const nova = await emitir(admin).expect(200);
    expect(nova.body).toEqual({ emitidos: 1, enviados: 1, ja_enviados: 1, falhas: [] });
  });

  test('simular: não envia, não grava, e funciona mesmo sem e-mail configurado', async () => {
    await criarElegivel();
    await criarElegivel(JOAO);
    email.emailConfigurado.mockReturnValue(false);

    const admin = await loginComo(app, 'admin');
    const res = await emitir(admin, { simular: true }).expect(200);

    expect(res.body).toEqual({ simulacao: true, emitidos: 2, enviados: 0, ja_enviados: 0, falhas: [] });
    expect(email.enviarCertificado).not.toHaveBeenCalled();
    expect(await db('certificados').count({ total: 'id' }).first()).toEqual({ total: 0 });
  });

  test('e-mail não configurado: 503 com mensagem clara, sem processar o lote', async () => {
    await criarElegivel();
    email.emailConfigurado.mockReturnValue(false);

    const admin = await loginComo(app, 'admin');
    const res = await emitir(admin).expect(503);
    expect(res.body.erro).toMatch(/e-mail/i);
    expect(email.enviarCertificado).not.toHaveBeenCalled();
  });

  test('com aluno_id emite só para aquele aluno', async () => {
    await criarElegivel();
    const joao = await criarElegivel(JOAO);

    const admin = await loginComo(app, 'admin');
    const res = await emitir(admin, { aluno_id: joao.id }).expect(200);

    expect(res.body).toEqual({ emitidos: 1, enviados: 1, ja_enviados: 0, falhas: [] });
    expect(email.enviarCertificado).toHaveBeenCalledTimes(1);
    expect(email.enviarCertificado.mock.calls[0][0].para).toBe('joao@exemplo.com');
  });

  test('aluno_id inexistente: 404; não elegível: 400; inválido: 400', async () => {
    const semPresenca = await criarAluno(app);
    const admin = await loginComo(app, 'admin');

    await emitir(admin, { aluno_id: 99999 }).expect(404);
    await emitir(admin, { aluno_id: semPresenca.id }).expect(400);
    const invalido = await emitir(admin, { aluno_id: 'abc' }).expect(400);
    expect(invalido.body.campos.aluno_id).toBeDefined();
    expect((await emitir(admin, { simular: 'sim' }).expect(400)).body.campos.simular).toBeDefined();
    expect(email.enviarCertificado).not.toHaveBeenCalled();
  });

  test('duas emissões ao mesmo tempo: a segunda recebe 409 e ninguém recebe e-mail em dobro', async () => {
    await criarElegivel();
    const admin = await loginComo(app, 'admin');

    let liberarEnvio;
    email.enviarCertificado.mockImplementationOnce(
      () =>
        new Promise((resolver) => {
          liberarEnvio = () => resolver({ id: 'ok', previewUrl: null });
        })
    );

    const primeira = emitir(admin).then((r) => r); // dispara a primeira, que fica esperando o envio
    const inicio = Date.now();
    while (email.enviarCertificado.mock.calls.length === 0) {
      if (Date.now() - inicio > 8000) throw new Error('A primeira emissão não chegou ao envio.');
      await new Promise((r) => setTimeout(r, 20));
    }

    const segunda = await emitir(admin).expect(409);
    expect(segunda.body.erro).toMatch(/em andamento/i);

    liberarEnvio();
    const resposta = await primeira;
    expect(resposta.status).toBe(200);
    expect(resposta.body.enviados).toBe(1);
    expect(email.enviarCertificado).toHaveBeenCalledTimes(1);

    // terminou: a trava foi liberada
    const terceira = await emitir(admin).expect(200);
    expect(terceira.body.ja_enviados).toBe(1);
  });
});

describe('gerarCertificadoPdf', () => {
  const inicioDoPdf = (buffer) => buffer.subarray(0, 5).toString();

  test('devolve um Buffer de PDF (começa com %PDF) para nome curto, longo e com acentos', async () => {
    for (const nome of [
      'Ana Souza',
      'Maria Eduarda Fernandes de Albuquerque Cavalcante Nogueira Lima e Silva',
      'José Antônio Conceição Müller Ávila Pôrto',
    ]) {
      const pdf = await gerarCertificadoPdf({ nome }, { reitora_nome: 'Dra. Roselane Moita Pierot', coordenador_nome: '' });
      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(inicioDoPdf(pdf)).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(10000);
    }
  });

  test('sanitiza o nome: caracteres de controle, invisíveis e emojis não quebram a geração', async () => {
    const pdf = await gerarCertificadoPdf({ nome: '  Maria\u0000 ‮Silva​ 😀 \n\t da   Costa  ' });
    expect(inicioDoPdf(pdf)).toBe('%PDF-');
  });

  test('nome vazio ou só com caracteres não imprimíveis é recusado', async () => {
    await expect(gerarCertificadoPdf({ nome: '   ' })).rejects.toThrow(/inválido/i);
    await expect(gerarCertificadoPdf({ nome: '😀😀' })).rejects.toThrow(/inválido/i);
    await expect(gerarCertificadoPdf({})).rejects.toThrow(/inválido/i);
  });

  test('nome impossível de caber (muito longo) é recusado em vez de sair ilegível', async () => {
    await expect(gerarCertificadoPdf({ nome: 'WM'.repeat(60) })).rejects.toThrow(/longo demais/i);
  });

  test('coordenador vazio ou configuração ausente também geram o PDF', async () => {
    expect(inicioDoPdf(await gerarCertificadoPdf({ nome: 'Ana Souza' }, { coordenador_nome: '' }))).toBe('%PDF-');
    expect(inicioDoPdf(await gerarCertificadoPdf({ nome: 'Ana Souza' }))).toBe('%PDF-');
  });
});

describe('POST /api/certificados/baixar', () => {
  const NAO_DISPONIVEL = { erro: 'Certificado não disponível.' };

  test('aprovado: devolve o PDF como anexo, sem cache', async () => {
    await criarElegivel();
    const res = await baixarPdf(MARIA).expect(200);

    expect(res.headers['content-type']).toMatch(/^application\/pdf/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="certificado-jornada-academica.pdf"');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('aceita CPF com ou sem máscara e e-mail em maiúsculas', async () => {
    await criarElegivel();
    await baixarPdf({ cpf: '52998224725', email: 'MARIA@Exemplo.com' }).expect(200);
  });

  test('todos os outros casos respondem a MESMA 404', async () => {
    await criarAluno(app); // Maria cadastrada, sem presença (não elegível)
    const joao = await criarAluno(app, JOAO);
    await registrarPresencas(app, joao.id, await listarEventos(app)); // João elegível

    const respostas = [
      await baixar(MARIA), // não elegível
      await baixar({ cpf: CPF_3, email: 'ninguem@exemplo.com' }), // CPF inexistente
      await baixar({ cpf: JOAO.cpf, email: 'outro@exemplo.com' }), // elegível, e-mail errado
      await baixar({ cpf: JOAO.cpf, email: MARIA.email }), // CPF de um com o e-mail de outro
    ];

    for (const res of respostas) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual(NAO_DISPONIVEL);
      expect(res.headers['content-type']).not.toMatch(/pdf/);
    }
  });

  test('antes da liberação responde a mesma 404, mesmo para quem é elegível', async () => {
    await criarElegivel();
    await restaurarConfiguracao({ certificados_a_partir_de: somarDias(hojeSaoPaulo(), 5) });

    const res = await baixar(MARIA).expect(404);
    expect(res.body).toEqual(NAO_DISPONIVEL);
  });

  test('com ignorar_datas verdadeiro baixa mesmo antes da data', async () => {
    await criarElegivel();
    await restaurarConfiguracao({
      certificados_a_partir_de: somarDias(hojeSaoPaulo(), 5),
      ignorar_datas: true,
    });
    await baixarPdf(MARIA).expect(200);
  });

  test('CPF ou e-mail mal formados: 400 (não 404)', async () => {
    const vazio = await baixar({}).expect(400);
    expect(vazio.body.campos.cpf).toBeDefined();
    expect(vazio.body.campos.email).toBeDefined();

    expect((await baixar({ cpf: '529.982.247-2A', email: MARIA.email }).expect(400)).body.campos.cpf).toMatch(/números/i);
    expect((await baixar({ cpf: '111.111.111-11', email: MARIA.email }).expect(400)).body.campos.cpf).toBeDefined();
    expect((await baixar({ cpf: MARIA.cpf, email: 'sem-arroba' }).expect(400)).body.campos.email).toBeDefined();
    expect((await baixar({ cpf: MARIA.cpf }).expect(400)).body.campos.email).toBeDefined();
  });
});
