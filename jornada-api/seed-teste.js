#!/usr/bin/env node
/**
 * Cria dados de TESTE pela própria API (só para desenvolvimento).
 * Precisa do Node 18+ e do back-end rodando.
 *
 * Uso:
 *   node seed-teste.js                   liga "ignorar_datas", cria 10 inscritos fictícios
 *                                        e as presenças de cada cenário
 *   node seed-teste.js --desligar-datas  desliga "ignorar_datas" (rode ao fim dos testes)
 *
 * Variáveis opcionais: API_URL, ADMIN_EMAIL, ADMIN_SENHA
 * Por segurança, recusa rodar contra qualquer endereço que não seja localhost.
 */
const API = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@jornada.local';
const ADMIN_SENHA = process.env.ADMIN_SENHA || 'trocar-admin-123';

const host = new URL(API).hostname;
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error(`Recusado: este script só roda contra localhost (API_URL atual: ${API}).`);
  process.exit(1);
}

async function chamar(metodo, caminho, token, corpo) {
  const resp = await fetch(API + caminho, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dados = null;
  try { dados = await resp.json(); } catch { /* resposta sem corpo */ }
  return { status: resp.status, dados };
}

// CPF fictício, mas com dígitos verificadores válidos
function gerarCpf(n) {
  const base = String(100000000 + n * 7919).slice(0, 9).split('').map(Number);
  const dv = (digs) => {
    const peso = digs.length + 1;
    const soma = digs.reduce((acc, d, i) => acc + d * (peso - i), 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  base.push(dv(base));
  base.push(dv(base));
  return base.join('');
}
const mascarar = (c) => `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;

const PRIMEIROS = ['Ana', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Felipe', 'Gabriela', 'Hugo', 'Isabela', 'João'];
const SOBRENOMES = ['Almeida', 'Barros', 'Cardoso', 'Dantas', 'Esteves', 'Ferraz', 'Gomes', 'Holanda', 'Ibiapina', 'Lima'];
const DISCIPLINAS = ['APIExt I', 'APIExt II', 'APIExt III', 'APIExt IV', 'APIExt V', 'APIExt VI', 'PIC', 'Outras', 'PIC', 'Outras'];

// Índices das sessões (0 = 09/12 manhã, 1 = 09/12 noite, 2 = 10/12 manhã, 3 = 10/12 noite)
const CENARIOS = [
  { presentes: [0, 1, 2, 3], descricao: 'presente em todas as sessões (100%)' },
  { presentes: [0, 1, 2], descricao: 'faltou só a noite de 10/12 (82,6%)' },
  { presentes: [1, 2, 3], descricao: 'faltou a manhã de 09/12 (73,9%, logo abaixo de 75%)' },
  { presentes: [0, 1, 3], descricao: 'faltou a manhã de 10/12 (69,6%)' },
  { presentes: [0, 1], descricao: 'só 09/12 (52,2%)' },
  { presentes: [3], descricao: 'só a noite de 10/12 (17,4%)' },
  { presentes: [], descricao: 'sem presença' },
  { presentes: [], descricao: 'sem presença' },
  { presentes: [], descricao: 'sem presença' },
  { presentes: [], descricao: 'sem presença' },
];

async function main() {
  const login = await chamar('POST', '/api/auth/login', null, { email: ADMIN_EMAIL, senha: ADMIN_SENHA });
  if (login.status !== 200) {
    console.error('Não consegui entrar como admin. O back-end está rodando? Status:', login.status, login.dados);
    process.exit(1);
  }
  const token = login.dados.token;

  if (process.argv.includes('--desligar-datas')) {
    const r = await chamar('PUT', '/api/configuracoes', token, { ignorar_datas: false });
    console.log(r.status === 200 ? 'ignorar_datas DESLIGADO.' : `Falhou (${r.status}): ${JSON.stringify(r.dados)}`);
    return;
  }

  let r = await chamar('PUT', '/api/configuracoes', token, { ignorar_datas: true });
  if (r.status !== 200) throw new Error(`Não consegui ligar ignorar_datas: ${JSON.stringify(r.dados)}`);
  console.log('ignorar_datas LIGADO (lembre de desligar ao fim dos testes).');

  const eventos = (await chamar('GET', '/api/eventos')).dados.eventos;
  if (eventos.length !== 4) console.warn(`Atenção: esperava 4 sessões e encontrei ${eventos.length}.`);

  const emails = {};
  for (let i = 0; i < CENARIOS.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    const cpf = gerarCpf(i + 1);
    const email = `aluno${num}@example.com`;
    const disciplina = DISCIPLINAS[i];
    const corpo = {
      nome: `${PRIMEIROS[i]} ${SOBRENOMES[i]}`,
      email,
      telefone: `(86) 99999-00${num}`,
      cpf,
      matricula: `20260000${num}`,
      curso: 'Análise e Desenvolvimento de Sistemas',
      disciplina,
    };
    if (disciplina === 'PIC' || disciplina === 'Outras') {
      corpo.formato = i % 2 === 0 ? 'banner' : 'comunicacao_oral';
    }

    let alunoId;
    const ins = await chamar('POST', '/api/inscricoes', null, corpo);
    if (ins.status === 201) {
      alunoId = ins.dados.aluno.id;
    } else if (ins.status === 409) {
      const busca = await chamar('GET', `/api/alunos?busca=${cpf}`, token);
      alunoId = busca.dados.alunos[0].id;
    } else {
      console.error(`Falha ao inscrever ${corpo.nome}: ${ins.status} ${JSON.stringify(ins.dados)}`);
      continue;
    }
    emails[email] = { cpf, nome: corpo.nome };

    for (const idx of CENARIOS[i].presentes) {
      const ev = eventos[idx];
      if (!ev) continue;
      const f = await chamar('POST', '/api/frequencia', token, { aluno_id: alunoId, evento_id: ev.id });
      if (![200, 201].includes(f.status)) console.error(`Falha na presença de ${corpo.nome}: ${f.status}`);
    }
  }

  const resumo = (await chamar('GET', '/api/frequencia/resumo', token)).dados;
  console.log(`\nRegra atual: ${resumo.configuracao.modo_aprovacao} (mínimo ${resumo.configuracao.valor_minimo}) | carga total das sessões: ${resumo.carga_horaria_total} h\n`);
  console.table(
    resumo.alunos
      .filter((a) => emails[a.email])
      .map((a, i) => ({
        '#': i + 1,
        nome: a.nome,
        cpf: mascarar(emails[a.email].cpf),
        email: a.email,
        disciplina: a.disciplina,
        formato: a.formato,
        horas: a.horas_presentes,
        '%': a.percentual,
        elegivel: a.elegivel ? 'sim' : 'não',
      }))
  );
  console.log('\nCenários planejados:');
  CENARIOS.forEach((c, i) => console.log(`  Aluno ${String(i + 1).padStart(2, '0')}: ${c.descricao}`));
}

main().catch((e) => { console.error(e); process.exit(1); });