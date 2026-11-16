// Resumo e arquivo na inscrição (multipart), detalhe e download para o admin.
const request = require('supertest');
const config = require('../src/config');
const {
  nomeSeguro,
  corrigirCodificacao,
  validarArquivo,
} = require('../src/utils/arquivos');
const { db, iniciar, limpar, loginComo, auth, alunoValido, CPF_2 } = require('./helpers');

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

// Conteúdos mínimos com a assinatura certa de cada formato.
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('word/document.xml')]);
const ODT = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('mimetype')]);
const DOC = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.from('Microsoft Word'),
]);

// Envia a inscrição como multipart (campos de texto + arquivo opcional).
function enviar(dados, arquivo) {
  const req = request(app).post('/api/inscricoes');
  for (const [campo, valor] of Object.entries(dados)) {
    if (valor !== undefined && valor !== null) req.field(campo, String(valor));
  }
  if (arquivo) req.attach(arquivo.campo || 'arquivo', arquivo.conteudo, arquivo.nome);
  return req;
}

const contar = async (tabela) => Number((await db(tabela).count({ total: '*' }).first()).total);

describe('POST /api/inscricoes com arquivo (multipart)', () => {
  test('PDF válido: 201, resumo e arquivo gravados', async () => {
    const res = await enviar(alunoValido({ resumo: '  Resumo do trabalho.  ' }), {
      conteudo: PDF,
      nome: 'trabalho.pdf',
    }).expect(201);

    expect(res.body.aluno.tem_arquivo).toBe(true);
    expect(res.body.aluno.tem_resumo).toBe(true);

    const aluno = await db('alunos').first();
    expect(aluno.resumo).toBe('Resumo do trabalho.');

    const arq = await db('arquivos_inscricao').first();
    expect(arq.aluno_id).toBe(aluno.id);
    expect(arq.nome_original).toBe('trabalho.pdf');
    expect(arq.extensao).toBe('pdf');
    expect(arq.tipo_mime).toBe('application/pdf');
    expect(arq.tamanho).toBe(PDF.length);
    expect(Buffer.from(arq.conteudo).equals(PDF)).toBe(true);
  });

  test.each([
    ['doc', DOC, 'application/msword'],
    [
      'docx',
      DOCX,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    ['odt', ODT, 'application/vnd.oasis.opendocument.text'],
  ])('aceita .%s e o servidor escolhe o tipo MIME', async (ext, conteudo, mime) => {
    await enviar(alunoValido(), { conteudo, nome: `trabalho.${ext.toUpperCase()}` }).expect(201);
    const arq = await db('arquivos_inscricao').first();
    expect(arq.extensao).toBe(ext);
    expect(arq.tipo_mime).toBe(mime);
  });

  test('o tipo MIME enviado pelo cliente é ignorado', async () => {
    await request(app)
      .post('/api/inscricoes')
      .field('nome', 'Maria da Silva')
      .field('email', 'maria@exemplo.com')
      .field('telefone', '86999991234')
      .field('cpf', '52998224725')
      .field('matricula', '20231234')
      .field('curso', 'ADS')
      .field('disciplina', 'APIExt I')
      .attach('arquivo', PDF, { filename: 'a.pdf', contentType: 'text/html' })
      .expect(201);
    expect((await db('arquivos_inscricao').first()).tipo_mime).toBe('application/pdf');
  });

  test('extensão não permitida: 400 em campos.arquivo e nada é gravado', async () => {
    for (const nome of ['programa.exe', 'texto.txt', 'pagina.html', 'sem-extensao', 'duplo.pdf.exe']) {
      const res = await enviar(alunoValido(), { conteudo: PDF, nome }).expect(400);
      expect(res.body.campos.arquivo).toMatch(/PDF, DOC, DOCX ou ODT/);
    }
    expect(await contar('alunos')).toBe(0);
    expect(await contar('arquivos_inscricao')).toBe(0);
  });

  test('arquivo falso: extensão .pdf com conteúdo de texto é recusado', async () => {
    const res = await enviar(alunoValido(), {
      conteudo: Buffer.from('<script>alert(1)</script>'),
      nome: 'trabalho.pdf',
    }).expect(400);
    expect(res.body.campos.arquivo).toMatch(/PDF/);
    expect(await contar('alunos')).toBe(0);
  });

  test('conteúdo de um formato com extensão de outro é recusado (docx com nome .pdf, PDF com nome .docx)', async () => {
    await enviar(alunoValido(), { conteudo: DOCX, nome: 'a.pdf' }).expect(400);
    await enviar(alunoValido(), { conteudo: PDF, nome: 'a.docx' }).expect(400);
    await enviar(alunoValido(), { conteudo: DOC, nome: 'a.odt' }).expect(400);
    expect(await contar('alunos')).toBe(0);
  });

  test('arquivo vazio é recusado', async () => {
    const res = await enviar(alunoValido(), { conteudo: Buffer.alloc(0), nome: 'vazio.pdf' }).expect(400);
    expect(res.body.campos.arquivo).toMatch(/vazio/i);
  });

  test('arquivo acima do limite: 400 em campos.arquivo, sem inscrição e sem arquivo órfão', async () => {
    const grande = Buffer.concat([PDF, Buffer.alloc(Math.round(config.upload.maxMb * 1024 * 1024))]);
    const res = await enviar(alunoValido(), { conteudo: grande, nome: 'grande.pdf' }).expect(400);
    expect(res.body.campos.arquivo).toMatch(new RegExp(`${config.upload.maxMb} MB`));
    expect(await contar('alunos')).toBe(0);
    expect(await contar('arquivos_inscricao')).toBe(0);
  });

  test('mais de um arquivo ou arquivo em outro campo: 400 em campos.arquivo', async () => {
    const dois = request(app).post('/api/inscricoes');
    for (const [k, v] of Object.entries(alunoValido())) dois.field(k, v);
    dois.attach('arquivo', PDF, 'a.pdf').attach('arquivo', PDF, 'b.pdf');
    const r1 = await dois.expect(400);
    expect(r1.body.campos.arquivo).toEqual(expect.any(String));

    const r2 = await enviar(alunoValido(), { campo: 'outro', conteudo: PDF, nome: 'a.pdf' }).expect(400);
    expect(r2.body.campos.arquivo).toMatch(/campo "arquivo"/);
    expect(await contar('alunos')).toBe(0);
  });

  test('erro de campo e erro de arquivo juntos: as duas mensagens voltam na mesma resposta', async () => {
    const res = await enviar(alunoValido({ cpf: '123' }), { conteudo: PDF, nome: 'a.exe' }).expect(400);
    expect(res.body.erro).toBe('Dados inválidos.');
    expect(res.body.campos.cpf).toEqual(expect.any(String));
    expect(res.body.campos.arquivo).toEqual(expect.any(String));
  });

  test('nome com acento chega correto (UTF-8)', async () => {
    await enviar(alunoValido(), { conteudo: PDF, nome: 'relatório final.pdf' }).expect(201);
    expect((await db('arquivos_inscricao').first()).nome_original).toBe('relatório final.pdf');
  });

  test('fora do período: 403 mesmo com upload', async () => {
    await db('configuracoes').update({ inscricoes_ate: '2000-01-01', inscricoes_de: '2000-01-01' });
    await enviar(alunoValido(), { conteudo: PDF, nome: 'a.pdf' }).expect(403);
    expect(await contar('alunos')).toBe(0);
  });

  test('corpo multipart quebrado: 400 (e não 500)', async () => {
    const res = await request(app)
      .post('/api/inscricoes')
      .set('Content-Type', 'multipart/form-data; boundary=xyz')
      .send('--xyz\r\nContent-Disposition: form-data; name="nome"\r\n\r\nMaria')
      .expect(400);
    expect(res.body.erro).toEqual(expect.any(String));
  });
});

describe('Atomicidade e duplicidade', () => {
  test('CPF duplicado com arquivo: 409 e nenhum arquivo órfão', async () => {
    await request(app).post('/api/inscricoes').send(alunoValido()).expect(201);
    const res = await enviar(alunoValido({ email: 'outra@exemplo.com' }), {
      conteudo: PDF,
      nome: 'a.pdf',
    }).expect(409);
    expect(res.body.campos.cpf).toBeDefined();
    expect(await contar('alunos')).toBe(1);
    expect(await contar('arquivos_inscricao')).toBe(0);
  });

  test('duas inscrições simultâneas iguais com arquivo: 201 e 409, um só arquivo', async () => {
    const dados = alunoValido();
    const [a, b] = await Promise.all([
      enviar(dados, { conteudo: PDF, nome: 'a.pdf' }),
      enviar(dados, { conteudo: PDF, nome: 'a.pdf' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await contar('alunos')).toBe(1);
    expect(await contar('arquivos_inscricao')).toBe(1);
  });

  test('falha ao gravar o arquivo desfaz a inscrição (não sobra aluno sem arquivo)', async () => {
    await db.schema.renameTable('arquivos_inscricao', 'arquivos_provisorio');
    try {
      await enviar(alunoValido(), { conteudo: PDF, nome: 'a.pdf' }).expect(500);
      expect(await contar('alunos')).toBe(0);
    } finally {
      await db.schema.renameTable('arquivos_provisorio', 'arquivos_inscricao');
    }
    // A nova tentativa do participante funciona (não dá 409).
    await enviar(alunoValido(), { conteudo: PDF, nome: 'a.pdf' }).expect(201);
  });
});

describe('Resumo', () => {
  test('envio só em JSON continua funcionando, com ou sem resumo', async () => {
    const r1 = await request(app).post('/api/inscricoes').send(alunoValido()).expect(201);
    expect(r1.body.aluno.tem_arquivo).toBe(false);
    expect(r1.body.aluno.tem_resumo).toBe(false);
    expect((await db('alunos').first()).resumo).toBeNull();
    await db('alunos').del();

    const r2 = await request(app)
      .post('/api/inscricoes')
      .send(alunoValido({ resumo: 'Texto do resumo.' }))
      .expect(201);
    expect(r2.body.aluno.tem_resumo).toBe(true);
    expect((await db('alunos').first()).resumo).toBe('Texto do resumo.');
  });

  test('2000 caracteres é aceito; 2001 é recusado em campos.resumo (JSON e multipart)', async () => {
    await request(app).post('/api/inscricoes').send(alunoValido({ resumo: 'a'.repeat(2000) })).expect(201);
    await db('alunos').del();

    const json = await request(app)
      .post('/api/inscricoes')
      .send(alunoValido({ resumo: 'a'.repeat(2001) }))
      .expect(400);
    expect(json.body.campos.resumo).toMatch(/2000/);

    const multi = await enviar(alunoValido({ resumo: 'a'.repeat(2001) }), {
      conteudo: PDF,
      nome: 'a.pdf',
    }).expect(400);
    expect(multi.body.campos.resumo).toMatch(/2000/);
    expect(await contar('alunos')).toBe(0);
  });

  test('quebra de linha CRLF conta como um caractere (2000 com CRLF é aceito)', async () => {
    const resumo = `${'a'.repeat(1999)}\r\n`.slice(0, 1999) + '\r\n' + 'b'; // 1999 + 1 quebra + 'b' = 2001 → recusa
    await enviar(alunoValido({ resumo }), { conteudo: PDF, nome: 'a.pdf' }).expect(400);

    const certo = `${'a'.repeat(998)}\r\n${'b'.repeat(1000)}`; // 998 + 1 + 1000 = 1999 (seria 2000 contando CRLF como 2)
    await enviar(alunoValido({ resumo: certo }), { conteudo: PDF, nome: 'a.pdf' }).expect(201);
    expect((await db('alunos').first()).resumo).toBe(`${'a'.repeat(998)}\n${'b'.repeat(1000)}`);
  });

  test('resumo com 33 KB é recusado pelo limite do campo', async () => {
    const res = await enviar(alunoValido({ resumo: 'a'.repeat(33 * 1024) }), {
      conteudo: PDF,
      nome: 'a.pdf',
    }).expect(400);
    expect(res.body.campos.resumo).toMatch(/2000/);
  });
});

describe('Regras configuráveis (obrigatoriedade)', () => {
  afterEach(() => {
    config.inscricao.resumoObrigatorio = false;
    config.inscricao.arquivoObrigatorio = false;
    config.inscricao.instituicaoObrigatoriaExterno = true;
  });

  test('por padrão resumo e arquivo são opcionais', async () => {
    await enviar(alunoValido()).expect(201);
  });

  test('RESUMO_OBRIGATORIO exige o resumo', async () => {
    config.inscricao.resumoObrigatorio = true;
    const res = await request(app).post('/api/inscricoes').send(alunoValido()).expect(400);
    expect(res.body.campos.resumo).toMatch(/resumo/i);
    await request(app).post('/api/inscricoes').send(alunoValido({ resumo: 'ok' })).expect(201);
  });

  test('ARQUIVO_OBRIGATORIO exige o arquivo (inclusive no envio JSON)', async () => {
    config.inscricao.arquivoObrigatorio = true;
    const json = await request(app).post('/api/inscricoes').send(alunoValido()).expect(400);
    expect(json.body.campos.arquivo).toMatch(/arquivo/i);
    await enviar(alunoValido(), { conteudo: PDF, nome: 'a.pdf' }).expect(201);
  });

  test('instituição é obrigatória para tipo "externo" (e só para ele)', async () => {
    const semInstituicao = alunoValido({ tipo: 'externo' });
    delete semInstituicao.matricula;
    const r1 = await request(app).post('/api/inscricoes').send(semInstituicao).expect(400);
    expect(r1.body.campos.instituicao).toMatch(/institui/i);

    await request(app)
      .post('/api/inscricoes')
      .send({ ...semInstituicao, instituicao: 'UFPI' })
      .expect(201);
    await db('alunos').del();

    // aluno da Uninassau não precisa de instituição
    await request(app).post('/api/inscricoes').send(alunoValido({ tipo: 'aluno' })).expect(201);
    await db('alunos').del();

    // pelo multipart também
    const r2 = await enviar({ ...semInstituicao }, { conteudo: PDF, nome: 'a.pdf' }).expect(400);
    expect(r2.body.campos.instituicao).toBeDefined();

    config.inscricao.instituicaoObrigatoriaExterno = false;
    await request(app).post('/api/inscricoes').send(semInstituicao).expect(201);
  });
});

describe('Listagem, detalhe e download', () => {
  async function criarComArquivo(extra = {}, arquivo = { conteudo: PDF, nome: 'trabalho.pdf' }) {
    const res = await enviar(alunoValido({ resumo: 'Resumo completo do trabalho.', ...extra }), arquivo).expect(201);
    return res.body.aluno.id;
  }

  test('GET /api/alunos traz tem_arquivo e tem_resumo, sem resumo nem conteúdo', async () => {
    await criarComArquivo();
    await request(app)
      .post('/api/inscricoes')
      .send(alunoValido({ nome: 'Joao Pereira', email: 'joao@exemplo.com', cpf: CPF_2 }))
      .expect(201);

    const token = await loginComo(app, 'professor');
    const res = await request(app).get('/api/alunos').set(auth(token)).expect(200);
    const porNome = Object.fromEntries(res.body.alunos.map((a) => [a.nome, a]));

    expect(porNome['Maria da Silva'].tem_arquivo).toBe(true);
    expect(porNome['Maria da Silva'].tem_resumo).toBe(true);
    expect(porNome['Joao Pereira'].tem_arquivo).toBe(false);
    expect(porNome['Joao Pereira'].tem_resumo).toBe(false);
    for (const a of res.body.alunos) {
      expect(a).not.toHaveProperty('resumo');
      expect(a).not.toHaveProperty('conteudo');
    }
  });

  test('GET /api/alunos/:id (admin) devolve o resumo e os dados do arquivo, sem o conteúdo', async () => {
    const id = await criarComArquivo();
    const token = await loginComo(app, 'admin');
    const res = await request(app).get(`/api/alunos/${id}`).set(auth(token)).expect(200);

    expect(res.body.aluno.resumo).toBe('Resumo completo do trabalho.');
    expect(res.body.aluno.cpf).toBe('***.982.247-**');
    expect(res.body.aluno.arquivo).toEqual(
      expect.objectContaining({
        nome_original: 'trabalho.pdf',
        extensao: 'pdf',
        tipo_mime: 'application/pdf',
        tamanho: PDF.length,
      })
    );
    expect(res.body.aluno.arquivo).not.toHaveProperty('conteudo');
  });

  test('detalhe: sem login 401, professor 403, inexistente 404, id inválido 400', async () => {
    const id = await criarComArquivo();
    await request(app).get(`/api/alunos/${id}`).expect(401);
    const prof = await loginComo(app, 'professor');
    await request(app).get(`/api/alunos/${id}`).set(auth(prof)).expect(403);
    const admin = await loginComo(app, 'admin');
    await request(app).get('/api/alunos/99999').set(auth(admin)).expect(404);
    await request(app).get('/api/alunos/abc').set(auth(admin)).expect(400);
  });

  test('download com admin: 200, conteúdo idêntico e cabeçalhos de segurança', async () => {
    const id = await criarComArquivo({}, { conteudo: PDF, nome: 'relatório final.pdf' });
    const token = await loginComo(app, 'admin');
    const res = await request(app)
      .get(`/api/alunos/${id}/arquivo`)
      .set(auth(token))
      .buffer(true)
      .parse((r, cb) => {
        const partes = [];
        r.on('data', (p) => partes.push(p));
        r.on('end', () => cb(null, Buffer.concat(partes)));
      })
      .expect(200);

    expect(Buffer.from(res.body).equals(PDF)).toBe(true);
    expect(res.headers['content-type']).toMatch(/^application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/^attachment;/);
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="relat_rio final.pdf"; filename*=UTF-8''relat%C3%B3rio%20final.pdf`
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-length']).toBe(String(PDF.length));
  });

  test('download: sem login 401, professor 403, sem arquivo 404, aluno inexistente 404', async () => {
    const id = await criarComArquivo();
    await request(app).get(`/api/alunos/${id}/arquivo`).expect(401);

    const prof = await loginComo(app, 'professor');
    await request(app).get(`/api/alunos/${id}/arquivo`).set(auth(prof)).expect(403);

    const admin = await loginComo(app, 'admin');
    const semArquivo = await request(app)
      .post('/api/inscricoes')
      .send(alunoValido({ email: 'sem@exemplo.com', cpf: CPF_2 }))
      .expect(201);
    await request(app).get(`/api/alunos/${semArquivo.body.aluno.id}/arquivo`).set(auth(admin)).expect(404);
    await request(app).get('/api/alunos/99999/arquivo').set(auth(admin)).expect(404);
  });

  test('apagar o aluno apaga o arquivo (ON DELETE CASCADE)', async () => {
    await criarComArquivo();
    expect(await contar('arquivos_inscricao')).toBe(1);
    await db('alunos').del();
    expect(await contar('arquivos_inscricao')).toBe(0);
  });
});

describe('utils/arquivos', () => {
  test('nomeSeguro remove caminho, caracteres de controle e marcadores de direção', () => {
    expect(nomeSeguro('../../etc/passwd.pdf', 'pdf')).toBe('passwd.pdf');
    expect(nomeSeguro('C:\\Users\\Maria\\trabalho final.docx', 'docx')).toBe('trabalho final.docx');
    expect(nomeSeguro('a\u0000b\r\nc.pdf', 'pdf')).toBe('abc.pdf');
    expect(nomeSeguro('fdp.\u202Eexe.pdf'.replace('fdp', 'doc'), 'pdf')).toBe('doc.exe.pdf');
    expect(nomeSeguro('.pdf', 'pdf')).toBe('arquivo.pdf');
    expect(nomeSeguro('"a<b>:c?.odt', 'odt')).toBe('_a_b__c_.odt');
    const longo = nomeSeguro(`${'x'.repeat(400)}.pdf`, 'pdf');
    expect(longo.length).toBeLessThanOrEqual(154);
    expect(longo.endsWith('.pdf')).toBe(true);
  });

  test('corrigirCodificacao desfaz o latin1 do multipart e preserva texto já correto', () => {
    expect(corrigirCodificacao(Buffer.from('relatório.pdf', 'utf8').toString('latin1'))).toBe('relatório.pdf');
    expect(corrigirCodificacao('simples.pdf')).toBe('simples.pdf');
  });

  test('validarArquivo: sem arquivo e não obrigatório devolve objeto vazio', () => {
    expect(validarArquivo(undefined)).toEqual({});
  });
});
