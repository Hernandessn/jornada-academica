// Rate limit. Nos outros testes o limite fica desligado; aqui ele é ligado de propósito e os
// valores são reduzidos ANTES de carregar a aplicação (a configuração é lida na importação).
process.env.TESTAR_LIMITES = '1';
process.env.RATE_LIMIT_CONSULTA = '3';
process.env.RATE_LIMIT_LOGIN = '2';

const request = require('supertest');
const { db, iniciar, restaurarConfiguracao, CPF_3 } = require('./helpers');

let app;

beforeAll(async () => {
  app = await iniciar();
  await restaurarConfiguracao();
});

afterAll(async () => {
  delete process.env.TESTAR_LIMITES;
  delete process.env.RATE_LIMIT_CONSULTA;
  delete process.env.RATE_LIMIT_LOGIN;
  await db.destroy();
});

describe('Rate limit', () => {
  test('consulta de certificado: após 3 consultas a 4ª recebe 429', async () => {
    const consultar = () =>
      request(app)
        .post('/api/certificados/consulta')
        .send({ cpf: CPF_3, email: 'ninguem@exemplo.com' });

    for (let i = 0; i < 3; i += 1) {
      expect((await consultar()).status).toBe(200);
    }
    const bloqueada = await consultar();
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.erro).toMatch(/muitas consultas/i);
  });

  test('login: após 2 tentativas erradas a 3ª recebe 429', async () => {
    const tentar = () =>
      request(app).post('/api/auth/login').send({ email: 'admin@jornada.local', senha: 'errada-123456' });

    expect((await tentar()).status).toBe(401);
    expect((await tentar()).status).toBe(401);
    const bloqueada = await tentar();
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body.erro).toMatch(/muitas tentativas/i);
  });
});
