// Auxiliares dos testes. O Jest define NODE_ENV=test, então o knexfile usa SQLite em memória
// e os testes nunca tocam no banco de desenvolvimento.
require('../src/config'); // carrega o .env (as credenciais do seed podem vir de lá)
const request = require('supertest');
const db = require('../src/db');
const { criarApp } = require('../src/app');
const { hojeSaoPaulo, somarDias } = require('../src/utils/datas');

const CREDENCIAIS = {
  admin: {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@jornada.local').trim().toLowerCase(),
    senha: process.env.SEED_ADMIN_SENHA || 'trocar-admin-123',
  },
  professor: {
    email: (process.env.SEED_PROFESSOR_EMAIL || 'professor@jornada.local').trim().toLowerCase(),
    senha: process.env.SEED_PROFESSOR_SENHA || 'trocar-professor-123',
  },
};

// CPFs válidos (dígitos verificadores corretos) para usar nos testes.
const CPF_1 = '529.982.247-25';
const CPF_2 = '111.444.777-35';
const CPF_3 = '390.533.447-05';

// Cria as tabelas e roda os seeds (usuários, eventos e configuração padrão).
async function iniciar() {
  await db.migrate.latest();
  const log = console.log;
  console.log = () => {}; // os seeds imprimem mensagens; silenciamos nos testes
  try {
    await db.seed.run();
  } finally {
    console.log = log;
  }
  return criarApp();
}

// Configuração de teste: mesma do seed (percentual 75%, carga 20 h), mas com as datas calculadas a
// partir de HOJE, para os testes não dependerem do dia em que rodam:
//   inscrições abertas (de uma semana atrás até uma semana adiante) e certificados já liberados.
// "extra" sobrescreve qualquer campo.
async function restaurarConfiguracao(extra = {}) {
  const hoje = hojeSaoPaulo();
  await db('configuracoes').del();
  await db('configuracoes').insert({
    modo_aprovacao: 'percentual',
    valor_minimo: 75,
    carga_horaria_certificado: 20,
    certificados_a_partir_de: somarDias(hoje, -1),
    inscricoes_de: somarDias(hoje, -7),
    inscricoes_ate: somarDias(hoje, 7),
    ignorar_datas: false,
    coordenador_nome: '',
    reitora_nome: 'Dra. Roselane Moita Pierot',
    ...extra,
  });
}

// Volta ao estado inicial entre os testes: sem alunos/presenças e com a configuração de teste.
async function limpar() {
  await db('certificados').del();
  await db('frequencia').del();
  await db('alunos').del();
  await restaurarConfiguracao();
}

async function loginComo(app, papel) {
  const res = await request(app).post('/api/auth/login').send(CREDENCIAIS[papel]).expect(200);
  return res.body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const alunoValido = (extra = {}) => ({
  nome: 'Maria da Silva',
  email: 'maria@exemplo.com',
  telefone: '(86) 99999-1234',
  cpf: CPF_1,
  matricula: '20231234',
  curso: 'Análise e Desenvolvimento de Sistemas',
  disciplina: 'APIExt I',
  ...extra,
});

async function criarAluno(app, extra = {}) {
  const res = await request(app).post('/api/inscricoes').send(alunoValido(extra)).expect(201);
  return res.body.aluno;
}

async function listarEventos(app) {
  const res = await request(app).get('/api/eventos').expect(200);
  return res.body.eventos;
}

// Registra presença do aluno em todos os eventos informados (usa o login de professor).
async function registrarPresencas(app, alunoId, eventos) {
  const token = await loginComo(app, 'professor');
  for (const evento of eventos) {
    await request(app)
      .post('/api/frequencia')
      .set(auth(token))
      .send({ aluno_id: alunoId, evento_id: evento.id })
      .expect(201);
  }
}

module.exports = {
  db,
  CREDENCIAIS,
  CPF_1,
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
};
