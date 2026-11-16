# API da VI Jornada Acadêmica UNINASSAU

Back-end (Node.js + Express) do sistema de **inscrição, frequência e certificado** da Jornada.
Cobre API, banco, autenticação, regras de negócio, geração do certificado em PDF e envio por e-mail.
O front-end consome esta API.

- Stack: Node.js 22 LTS, Express, Knex (SQLite em desenvolvimento, PostgreSQL em produção), JWT, bcryptjs, zod, helmet, cors, express-rate-limit, pdf-lib (certificado em PDF) e nodemailer / Resend (e-mail).
- Testes: Jest + Supertest (rodam em SQLite na memória, sem tocar no seu banco).

## 1. Instalação

```bash
cd jornada-api
cp .env.example .env      # no Windows (PowerShell): copy .env.example .env
npm install
npm run db:setup          # cria as tabelas e popula: 1 admin, 1 professor, 4 sessões, configuração padrão
npm run dev               # http://localhost:3000
```

Teste rápido: `curl http://localhost:3000/api/saude`

> `better-sqlite3` usa um módulo nativo e **só tem binário pronto para o Node 22 LTS** (e 20). Em versões mais
> novas, como a 26, o `npm install` tenta compilar e falha. Use o Node 22. No Render, defina `NODE_VERSION=22`
> (veja a seção 9).

### Já tinha o banco de desenvolvimento da versão anterior?

Atualize sem perder dados:

```bash
npm run migrate    # acrescenta as colunas novas (disciplina, formato, horários, configurações, instituicao)
npm run seed       # troca os 2 eventos antigos de 10 h pelas 4 sessões novas
```

- Os 2 eventos antigos só são removidos se não tiverem presença registrada; senão o seed avisa e os mantém.
- Se a regra de presença ainda estava no padrão antigo (horas, 20), a migration passa para 75%. Se o admin já tinha escolhido outra regra, ela é mantida.
- Alunos já cadastrados ficam com `disciplina` e `formato` vazios (só as novas inscrições exigem).
- Em desenvolvimento, se preferir começar do zero: `npm run db:reset` (**apaga tudo**).

### Logins criados pelo seed

| Papel | E-mail | Senha |
|---|---|---|
| Admin | `admin@jornada.local` | `trocar-admin-123` |
| Professor | `professor@jornada.local` | `trocar-professor-123` |

Os valores vêm de `SEED_*` no `.env`. **Em produção o seed se recusa a rodar com as senhas padrão.**

## 2. Variáveis de ambiente

| Variável | Para que serve | Padrão |
|---|---|---|
| `NODE_ENV` | `development`, `production` ou `test` | `development` |
| `PORT` | Porta do servidor (Render/Railway definem sozinhos) | `3000` |
| `CORS_ORIGIN` | Origens permitidas, separadas por vírgula (link do front). `*` libera tudo (só em desenvolvimento) | `http://localhost:5500,http://127.0.0.1:5500` |
| `JWT_SECRET` | Segredo do token. **Obrigatório em produção, com 32+ caracteres** | valor de desenvolvimento |
| `JWT_EXPIRES_IN` | Validade do token | `8h` |
| `DATABASE_URL` | String do PostgreSQL. Vazia = usa SQLite | vazio |
| `DATABASE_SSL` | `false` desliga SSL no PostgreSQL (padrão: ligado em produção) | automático |
| `SQLITE_FILE` | Arquivo do SQLite em desenvolvimento | `./dev.sqlite3` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_SENHA` | Admin criado pelo seed | ver `.env.example` |
| `SEED_PROFESSOR_EMAIL` / `SEED_PROFESSOR_SENHA` | Professor criado pelo seed | ver `.env.example` |
| `RATE_LIMIT_GERAL` / `RATE_LIMIT_LOGIN` / `RATE_LIMIT_INSCRICOES` / `RATE_LIMIT_CONSULTA` / `RATE_LIMIT_DOWNLOAD` | Requisições por IP a cada 15 min | `600` / `10` / `30` / `10` / `10` |
| `RESEND_API_KEY` | Chave do Resend (envio de e-mail por API HTTPS). Se definida, é o modo usado | vazio |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Envio por SMTP (Gmail, Brevo, Mailtrap...). Sem `SMTP_HOST` e fora de produção, usa o Ethereal (caixa de teste) | vazio / `587` |
| `EMAIL_FROM` | Remetente dos certificados, ex.: `Jornada Acadêmica <certificados@seudominio.com>`. **Obrigatório em produção** | vazio |

Gerar um `JWT_SECRET` forte:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor com recarga automática |
| `npm start` | Servidor (produção) |
| `npm run migrate` | Cria/atualiza as tabelas |
| `npm run seed` | Cria usuários, sessões e configuração padrão (pode repetir sem duplicar) |
| `npm run db:setup` | `migrate` + `seed` |
| `npm run db:reset` | **Apaga tudo** e recria (só desenvolvimento) |
| `npm run certificado:exemplo` | Gera 3 PDFs de exemplo (nome curto, longo e com acentos) em `tmp/` para conferir o layout |
| `npm test` | Testes automatizados |

### Mudar datas, horários e carga horária das sessões

Edite a lista `EVENTOS` no topo de `seeds/02_eventos.js` (a `carga_horaria` é em horas e aceita decimais:
`3.5` = 3h30). Em um banco novo, rode `npm run db:setup`. Em um banco que já tem as sessões, o seed só
**adiciona** as que ainda não existem (mesmo título e data); ele nunca altera nem apaga sessões que já
existem, para não perder presenças. Para corrigir uma sessão existente, altere direto no banco.

### Mudar os padrões da configuração

Os valores iniciais estão em `seeds/03_configuracoes.js`. Depois de criada, a configuração é alterada
pelo admin via `PUT /api/configuracoes` (o seed nunca sobrescreve).

## 4. Testes

```bash
npm test
```

| Arquivo | O que cobre |
|---|---|
| `tests/api.test.js` | Formulário vazio, inscrição de participantes externos (matrícula opcional, `tipo`, `instituicao`), CPF com letras, CPF inválido, CPF e e-mail duplicados (inclusive simultâneos), presença duplicada, acesso sem login (401), papel errado (403), resumo de presença e troca da regra (horas ↔ percentual) |
| `tests/requisitos.test.js` | Disciplina obrigatória, formato automático, período de inscrições, configurações novas, consulta de certificado (inclusive CPF com e-mail incorreto) |
| `tests/certificados.test.js` | Emissão (acesso, só elegíveis, não reenviar, falha isolada, simular, trava), geração do PDF, download público |
| `tests/limites.test.js` | Rate limit da consulta, do download e do login |
| `tests/utils.test.js` | Funções puras: CPF, elegibilidade, datas, disciplinas |

## 5. Formato de erro

Todo erro sai em JSON padronizado:

```json
{ "erro": "Dados inválidos.", "campos": { "cpf": "CPF inválido." } }
```

| Status | Quando |
|---|---|
| 400 | Dados inválidos (`campos` traz a mensagem de cada campo) |
| 401 | Sem token, token inválido/expirado ou login incorreto |
| 403 | Papel sem permissão, ou inscrições fora do período |
| 404 | Aluno, evento ou rota inexistente |
| 409 | CPF ou e-mail já cadastrado (`campos` diz qual), ou emissão de certificados já em andamento |
| 429 | Limite de requisições por IP excedido |
| 503 | E-mail não configurado (só na emissão de certificados) |

## 6. Rotas, com exemplos `curl`

Os exemplos assumem `http://localhost:3000`. Primeiro, pegue um token (o `node` abaixo só extrai o campo
do JSON, então não precisa de `jq`):

```bash
TOKEN_ADMIN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@jornada.local","senha":"trocar-admin-123"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

TOKEN_PROF=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"professor@jornada.local","senha":"trocar-professor-123"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
```

### `GET /api/saude` (público)

```bash
curl http://localhost:3000/api/saude
```

### `POST /api/auth/login` (público)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"professor@jornada.local","senha":"trocar-professor-123"}'
```

Resposta 200: `{ "token": "...", "expira_em": "8h", "usuario": { "id", "nome", "email", "papel" } }`.
Nas demais rotas protegidas, envie `Authorization: Bearer <token>`.

### `POST /api/inscricoes` (público)

Campos obrigatórios: `nome` (nome e sobrenome), `email`, `telefone`, `cpf`, `curso`, `disciplina`.
Opcionais, para **participantes externos** (o edital aceita trabalhos de fora da instituição): `matricula` (só alunos da Uninassau; sem ela fica vazia) e `instituicao` (até 150 caracteres). Se a matrícula for informada, continua validada (4 a 20 dígitos).
Campo opcional `tipo`: `"aluno"` (matrícula obrigatória) ou `"externo"` (a matrícula é ignorada e gravada vazia). Sem `tipo`, vale a regra de matrícula opcional. O `curso` é texto livre (o front oferece a lista de cursos e a opção "Outros" com campo para digitar).
CPF, telefone e matrícula podem vir com ou sem máscara; o servidor guarda só dígitos.

**Disciplina e formato:** `disciplina` precisa ser uma de `APIExt I`, `APIExt II`, `APIExt III`, `APIExt IV`,
`APIExt V`, `APIExt VI`, `PIC` ou `Outras` (escrita exata). O `formato` do trabalho é definido pelo servidor:

| Disciplina | Formato |
|---|---|
| APIExt I, III e V | `banner` |
| APIExt II, IV e VI | `comunicacao_oral` |
| PIC e Outras | o aluno escolhe: envie `"formato": "banner"` ou `"formato": "comunicacao_oral"` (obrigatório) |

Nas APIExt, um `formato` enviado pelo cliente é ignorado. Para PIC e Outras, o servidor também aceita
`"Comunicação oral"` e normaliza para `comunicacao_oral`.

```bash
curl -X POST http://localhost:3000/api/inscricoes \
  -H 'Content-Type: application/json' \
  -d '{
    "nome": "Maria da Silva",
    "email": "maria@exemplo.com",
    "telefone": "(86) 99999-1234",
    "cpf": "529.982.247-25",
    "matricula": "20231234",
    "curso": "Análise e Desenvolvimento de Sistemas",
    "disciplina": "PIC",
    "formato": "banner"
  }'
```

- **201:** `{ "mensagem": "...", "aluno": { "id", "nome", "email", "cpf": "***.982.247-**", "curso", "instituicao", "disciplina", "formato", "criado_em" } }`
- **400:** `campos` com a mensagem de cada campo inválido (ex.: `campos.formato` para PIC sem formato)
- **409:** CPF ou e-mail repetido, com `campos.cpf` e/ou `campos.email`
- **403:** fora do período de inscrições (veja `inscricoes_de`, `inscricoes_ate` e `ignorar_datas` em `/api/configuracoes`).
  Mensagens: `"As inscrições ainda não começaram. Elas abrem em 16/11/2026."` ou
  `"As inscrições foram encerradas em 30/11/2026."`. O período é inclusivo e a data de "hoje" é a de São Paulo.
  Com `ignorar_datas` verdadeiro, a trava não vale.

### `GET /api/eventos` (público)

```bash
curl http://localhost:3000/api/eventos
```

Resposta: `{ "eventos": [ { "id": 1, "titulo": "Dia 1 (09/12) - Manhã", "data": "2026-12-09", "hora_inicio": "09:00", "hora_fim": "12:00", "carga_horaria": 3 } ] }`,
em ordem de data e horário. Sessões do seed: 09/12 manhã (3 h) e noite (3 h), 10/12 manhã (3,5 h) e noite (2 h), somando 11,5 h.

### `GET /api/alunos` (professor, admin)

Parâmetros opcionais: `busca` (só números/pontuação = CPF; senão = nome) e `evento_id` (acrescenta `presente`
true/false em cada aluno, útil para a tela de chamada). O CPF sai sempre mascarado.

```bash
curl -H "Authorization: Bearer $TOKEN_PROF" "http://localhost:3000/api/alunos"
curl -H "Authorization: Bearer $TOKEN_PROF" "http://localhost:3000/api/alunos?busca=maria"
curl -H "Authorization: Bearer $TOKEN_PROF" "http://localhost:3000/api/alunos?busca=982.247"
curl -H "Authorization: Bearer $TOKEN_PROF" "http://localhost:3000/api/alunos?evento_id=1"
```

Resposta: `{ "total": 1, "alunos": [ { "id", "nome", "email", "telefone", "cpf", "matricula", "curso", "instituicao", "disciplina", "formato", "criado_em", "presente"? } ] }`.

### `POST /api/frequencia` (professor, admin)

```bash
curl -X POST http://localhost:3000/api/frequencia \
  -H "Authorization: Bearer $TOKEN_PROF" \
  -H 'Content-Type: application/json' \
  -d '{"aluno_id": 1, "evento_id": 1}'
```

Primeira vez: **201** com `"ja_registrada": false`. Repetindo: **200** com `"ja_registrada": true` (nunca duplica).

### `GET /api/frequencia/resumo` (professor, admin)

```bash
curl -H "Authorization: Bearer $TOKEN_PROF" http://localhost:3000/api/frequencia/resumo
```

Resposta:

```json
{
  "configuracao": { "modo_aprovacao": "percentual", "valor_minimo": 75 },
  "carga_horaria_total": 11.5,
  "total_alunos": 1,
  "total_elegiveis": 0,
  "alunos": [
    { "id": 1, "nome": "Maria da Silva", "email": "maria@exemplo.com", "cpf": "***.982.247-**",
      "matricula": "20231234", "curso": "...", "disciplina": "PIC", "formato": "banner",
      "presencas": 2, "horas_presentes": 6, "percentual": 52.17, "elegivel": false }
  ]
}
```

### `GET /api/configuracoes` (somente admin)

```bash
curl -H "Authorization: Bearer $TOKEN_ADMIN" http://localhost:3000/api/configuracoes
```

Resposta (valores padrão do seed):

```json
{
  "modo_aprovacao": "percentual",
  "valor_minimo": 75,
  "carga_horaria_certificado": 20,
  "certificados_a_partir_de": "2026-12-14",
  "inscricoes_de": "2026-11-16",
  "inscricoes_ate": "2026-11-30",
  "ignorar_datas": false,
  "coordenador_nome": "",
  "reitora_nome": "Dra. Roselane Moita Pierot"
}
```

### `PUT /api/configuracoes` (somente admin)

Aceita **só os campos que você quer mudar** (pelo menos um). Devolve a configuração completa já salva.

| Campo | Regra |
|---|---|
| `modo_aprovacao` | `"horas"` ou `"percentual"`. Ao **trocar** o modo, envie também `valor_minimo` |
| `valor_minimo` | Número maior que zero (até 100 no modo percentual) |
| `carga_horaria_certificado` | Número maior que zero (horas que constam no certificado) |
| `certificados_a_partir_de`, `inscricoes_de`, `inscricoes_ate` | Data `AAAA-MM-DD` real; `inscricoes_ate` não pode ser anterior a `inscricoes_de` |
| `ignorar_datas` | `true` ou `false` (booleano de verdade, não texto) |
| `coordenador_nome` | Texto até 150 caracteres (pode ser vazio) |
| `reitora_nome` | Texto de 1 a 150 caracteres |

```bash
# 75% de presença
curl -X PUT http://localhost:3000/api/configuracoes \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"modo_aprovacao": "percentual", "valor_minimo": 75}'

# Abrir as inscrições para teste (ignora as datas de inscrição e de certificado)
curl -X PUT http://localhost:3000/api/configuracoes \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"ignorar_datas": true}'

# Informar o coordenador
curl -X PUT http://localhost:3000/api/configuracoes \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"coordenador_nome": "Prof. Fulano de Tal"}'
```

### `POST /api/certificados/consulta` (público, com rate limit forte)

O participante consulta se tem certificado informando **CPF e e-mail juntos** (os dois são obrigatórios e
precisam ser do mesmo aluno). Limite: 10 consultas por IP a cada 15 minutos (`RATE_LIMIT_CONSULTA`).

```bash
curl -X POST http://localhost:3000/api/certificados/consulta \
  -H 'Content-Type: application/json' \
  -d '{"cpf": "529.982.247-25", "email": "maria@exemplo.com"}'
```

Resposta **200** sempre com este formato:

```json
{
  "status": "aprovado",
  "primeiro_nome": "Maria",
  "presenca": { "horas": 11.5, "percentual": 100 },
  "minimo": { "modo_aprovacao": "percentual", "valor_minimo": 75 }
}
```

| `status` | Quando | Demais campos |
|---|---|---|
| `aprovado` | Presença atinge a regra vigente | `primeiro_nome`, `presenca`, `minimo` preenchidos |
| `nao_elegivel` | Presença abaixo da regra (ou nenhuma) | `primeiro_nome`, `presenca`, `minimo` preenchidos |
| `ainda_nao_liberado` | Hoje é antes de `certificados_a_partir_de` e `ignorar_datas` é falso | `primeiro_nome`, `presenca`, `minimo` = `null`; vem também `certificados_a_partir_de` (a data de liberação) |
| `nao_encontrado` | CPF inexistente **ou** e-mail que não confere | `primeiro_nome`, `presenca`, `minimo` = `null` |

Privacidade:
- Só o **primeiro nome** é devolvido; nenhum outro dado pessoal.
- `nao_encontrado` é **idêntico** para CPF inexistente e para e-mail errado (mesmo status e mesmo corpo), então a rota não confirma se um CPF está cadastrado.
- Antes da data de liberação, a rota nem consulta o banco: responde `ainda_nao_liberado` para qualquer entrada.
- CPF ou e-mail mal formados (CPF com letras, dígitos verificadores inválidos, e-mail sem formato) respondem **400**, pois isso não depende do banco.
- A resposta leva `Cache-Control: no-store`.

### `POST /api/certificados/emitir` (somente admin)

Gera o PDF e envia por e-mail o certificado de cada aluno **elegível** que ainda não recebeu. O processamento é
**um participante por vez**: gera o PDF, envia o e-mail e **só depois** grava em `certificados`. Se um e-mail falhar,
o participante não é registrado, o lote continua e ele volta a ser tentado na próxima emissão.

Corpo opcional: `{ "aluno_id": 1 }` (só aquele aluno) e/ou `{ "simular": true }` (não gera, não envia e não grava).

```bash
# 1) Ver quantos receberiam (não envia nada)
curl -X POST http://localhost:3000/api/certificados/emitir \
  -H "Authorization: Bearer $TOKEN_ADMIN" -H 'Content-Type: application/json' \
  -d '{"simular": true}'

# 2) Emitir para todos os elegíveis que ainda não receberam
curl -X POST http://localhost:3000/api/certificados/emitir \
  -H "Authorization: Bearer $TOKEN_ADMIN" -H 'Content-Type: application/json' -d '{}'

# 3) Só um aluno
curl -X POST http://localhost:3000/api/certificados/emitir \
  -H "Authorization: Bearer $TOKEN_ADMIN" -H 'Content-Type: application/json' \
  -d '{"aluno_id": 1}'
```

Resposta **200**: `{ "emitidos": 2, "enviados": 1, "ja_enviados": 5, "falhas": [ { "aluno_id": 7, "nome": "João Pereira", "motivo": "Falha no envio do e-mail (EENVELOPE)." } ] }`

- `emitidos`: elegíveis que ainda não tinham recebido (processados nesta chamada); `enviados`: enviados e registrados; `ja_enviados`: pulados porque já tinham recebido.
- Sem CPF na resposta. O `motivo` é genérico e nunca repassa a mensagem do servidor de e-mail (que pode conter o endereço do destinatário).
- Com `simular`, a resposta traz também `"simulacao": true` e funciona mesmo sem e-mail configurado.
- **403:** antes de `certificados_a_partir_de` (a não ser que `ignorar_datas` seja verdadeiro). **503:** e-mail não configurado. **409:** já existe uma emissão em andamento (evita e-mail em dobro se alguém clicar duas vezes). Com `aluno_id`: **404** se não existir e **400** se não for elegível.
- É seguro repetir: quem já recebeu é pulado. Cada e-mail leva de 1 a 3 segundos; se a requisição expirar no navegador ou na plataforma, o servidor termina o lote mesmo assim. Aguarde e rode de novo para conferir (`ja_enviados` sobe, `emitidos` cai).

### `POST /api/certificados/baixar` (público, com rate limit próprio)

Baixa o PDF. Mesma validação da consulta: `cpf` e `email` juntos (10 downloads por IP a cada 15 minutos, contador
separado da consulta; `RATE_LIMIT_DOWNLOAD`).

```bash
curl -X POST http://localhost:3000/api/certificados/baixar \
  -H 'Content-Type: application/json' \
  -d '{"cpf": "529.982.247-25", "email": "maria@exemplo.com"}' \
  -o certificado.pdf
```

- **200:** o PDF (`application/pdf`, `Content-Disposition: attachment; filename="certificado-jornada-academica.pdf"`, `Cache-Control: no-store`), **só** se o status for `aprovado` e os certificados estiverem liberados.
- **404** `{ "erro": "Certificado não disponível." }` em **todos** os outros casos (CPF inexistente, e-mail errado, não elegível, ainda não liberado): a resposta é idêntica e não revela se o CPF existe.
- **400:** CPF ou e-mail mal formados (CPF com letras, dígitos verificadores inválidos, e-mail sem formato).

## 7. Regras de presença (RN02)

- **Modo `percentual` (padrão, 75%):** elegível se `horas presentes ÷ carga horária total de todas as sessões × 100 >= valor_minimo`.
- **Modo `horas`:** elegível se a soma da carga horária das sessões com presença for `>= valor_minimo`.
- Quem nunca teve presença registrada nunca é elegível.
- A carga horária total é a **soma das sessões cadastradas** (no seed: 11,5 h; 75% = 8,625 h). A
  `carga_horaria_certificado` (20 h) é independente: é só a carga que consta no certificado e **não entra no cálculo**.
- Atenção: no modo `horas`, um mínimo maior que a soma das sessões (por exemplo, 20 h com 11,5 h de sessões) nunca é atingido.

## 8. Como o módulo de certificado é organizado

| Arquivo | Papel |
|---|---|
| `src/rotas/certificados.js` | Rotas `/consulta`, `/baixar` e `/emitir` |
| `src/servicos/consultaCertificado.js` | Validação (CPF + e-mail) e decisão de status, usadas por `/consulta` e `/baixar` |
| `src/servicos/certificadoPdf.js` | `gerarCertificadoPdf({ nome }, configuracao)` devolve um `Buffer` com o PDF |
| `src/servicos/email.js` | `enviarCertificado({ para, nome, pdf })` (Resend, SMTP ou Ethereal) |
| `src/servicos/presenca.js` | `calcularResumoPresenca()` (elegibilidade), reaproveitada pela emissão |
| `src/servicos/periodos.js` | `certificadosLiberados(configuracao)` (data de liberação) |

A tabela `certificados` tem `aluno_id` único; a linha só é gravada depois que o e-mail foi enviado.

## 9. Deploy com PostgreSQL

Antes de tudo, suba o código para um repositório no GitHub (o `.gitignore` já deixa `.env` e `node_modules` de fora).
Se a API está em uma subpasta do repositório (por exemplo `jornada-api/`), defina o **Root Directory** do serviço
com o nome dessa pasta nas configurações do Render ou do Railway; senão ele não encontra o `package.json`.
Confira também que o `CORS_ORIGIN` é exatamente o endereço do front, **sem barra no final**: com barra, o
navegador bloqueia as chamadas (erro de CORS).

### Render

1. **Banco:** *New → PostgreSQL*. Quando ficar pronto, copie a **Internal Database URL** (se o serviço e o banco estiverem na mesma região).
2. **API:** *New → Web Service*, aponte para o repositório.
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm run db:setup && npm start`
   - Health Check Path: `/api/saude`
3. **Variáveis de ambiente** do serviço:
   - `NODE_ENV=production`
   - `NODE_VERSION=22` (obrigatório: sem isso o Render usa o Node mais novo e o `better-sqlite3` não instala)
   - `DATABASE_URL` = a URL copiada do banco
   - `JWT_SECRET` = valor aleatório com 32+ caracteres (comando na seção 2)
   - `CORS_ORIGIN` = link do front-end (ex.: `https://jornada.vercel.app`), sem barra no final
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_SENHA`, `SEED_PROFESSOR_EMAIL`, `SEED_PROFESSOR_SENHA` com senhas próprias
   - `RESEND_API_KEY` e `EMAIL_FROM` (e-mail dos certificados; veja a seção 10)
4. Faça o deploy e teste: `curl https://SEU-SERVICO.onrender.com/api/saude`.

### Railway

1. *New Project → Deploy from GitHub repo* e escolha o repositório.
2. No mesmo projeto: *New → Database → Add PostgreSQL*.
3. No serviço da API, aba *Variables*:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (referência ao banco do projeto)
   - `NODE_ENV=production`, `JWT_SECRET`, `CORS_ORIGIN` e as `SEED_*` como no Render
   - Se aparecer erro de SSL na conexão com o banco, adicione `DATABASE_SSL=false`
4. Em *Settings*: Start Command `npm run db:setup && npm start` e gere um domínio público em *Networking*.

### Observações

- `npm run db:setup` roda a cada início e é seguro repetir: cria tabelas que faltam, aplica as migrations novas e não duplica usuários, sessões nem a configuração. Se as senhas do seed forem as padrão, o serviço **não sobe** em produção, de propósito.
- Senhas do seed só valem na primeira criação do usuário. Para trocar depois, altere direto no banco ou crie uma rota de troca de senha.
- Em produção as inscrições só funcionam de `inscricoes_de` a `inscricoes_ate` (16 a 30/11/2026 por padrão). Para testar antes, o admin liga `ignorar_datas` e **desliga de novo** antes do evento.
- O plano gratuito dessas plataformas hiberna o serviço e pode limitar ou expirar o banco: confira as regras atuais do plano antes da apresentação e faça um teste completo no link público com dados fictícios.
- Use HTTPS (os dois fornecem) e mantenha `CORS_ORIGIN` restrito ao link do front-end.

## 10. Certificado em PDF e e-mail

### O modelo e o que o código escreve

O modelo é `assets/modelo-certificado.jpg` (A4 paisagem, 2339 × 1654 px). Ele já traz impressos o texto do
certificado, **"20 horas"**, as datas ("09 e 10 de dezembro de 2026" e "Teresina - PI, 10 de dezembro de 2026") e o
cargo do coordenador. O código escreve por cima, com a fonte Carlito (licença OFL em `assets/fonts/`, aceita acentos):

- o **nome do participante**, centralizado sobre a linha "certifica que ____" (a fonte reduz para nomes longos; um nome impossível de caber é recusado);
- o **nome da reitora** (`reitora_nome`) e o cargo "Reitora", e o **nome do coordenador** (`coordenador_nome`, pode ficar vazio). Os placeholders "[Nome do Reitor]" e "[Nome do Coordenador]" do modelo são cobertos com um retângulo da cor do fundo. Inclua o título no próprio nome da configuração (ex.: `Prof. Fulano de Tal`).

O que **não** muda pela configuração: as "20 horas" e as datas, que estão na imagem (`carga_horaria_certificado`
não é usado no PDF). Se o evento mudar, troque o modelo por uma nova imagem e ajuste as medidas em `LAYOUT`, no topo de
`src/servicos/certificadoPdf.js` (valores em pixels do modelo). Para parar de cobrir as assinaturas, ponha
`sobreporAssinaturas: false`.

Para conferir o resultado depois de qualquer ajuste:

```bash
npm run certificado:exemplo    # gera tmp/certificado-exemplo-curto.pdf, -longo.pdf e -acentos.pdf
```

### Como o e-mail é enviado

| Modo | Quando é usado | Observação |
|---|---|---|
| **Resend** (API HTTPS) | `RESEND_API_KEY` definida | Recomendado em produção: funciona em qualquer plano do Render e do Railway |
| **SMTP** | `SMTP_HOST` definido | Gmail, Brevo, Mailtrap... Em produção exige `SMTP_USER`, `SMTP_PASS` e `EMAIL_FROM` |
| **Ethereal** (teste) | Nada definido, fora de produção | Cria uma caixa de teste e imprime no terminal o link para ver o e-mail |

Em produção, sem credenciais, `POST /api/certificados/emitir` responde **503** dizendo quais variáveis faltam (a
simulação continua funcionando). Assunto: "Seu certificado da VI Jornada Acadêmica da Uninassau Teresina"; o PDF vai
anexo como `certificado-jornada-academica.pdf`.

### Testar o e-mail no seu computador

**Com o Ethereal (o mais simples, precisa de internet):**

1. Deixe `SMTP_HOST`, `RESEND_API_KEY` e `EMAIL_FROM` vazios no `.env` e rode `npm run dev`.
2. Libere a emissão antes da data oficial (como admin) e crie alguns alunos com presença:
   ```bash
   curl -X PUT http://localhost:3000/api/configuracoes \
     -H "Authorization: Bearer $TOKEN_ADMIN" -H 'Content-Type: application/json' \
     -d '{"ignorar_datas": true}'
   ```
3. Rode `{"simular": true}` para ver quantos receberiam e depois `{}` para emitir.
4. O terminal imprime `E-mail de teste (Ethereal). Pré-visualização: https://ethereal.email/message/...`. Abra o link para ver o e-mail e baixar o PDF. Nada é entregue a ninguém de verdade.

**Com o Mailtrap** (caixa de teste na nuvem): crie uma conta gratuita, abra o *Email Testing → Inboxes → SMTP Settings*
e copie os dados para o `.env` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e um `EMAIL_FROM` qualquer). Os
e-mails aparecem na caixa do Mailtrap. Um SMTP local como o Mailpit (`SMTP_HOST=localhost`, `SMTP_PORT=1025`, sem usuário e senha) também funciona.

Lembre de **desligar `ignorar_datas`** (`{"ignorar_datas": false}`) antes do evento.

### Configurar o e-mail no Render ou no Railway

Atenção: pela documentação das plataformas, o **Render bloqueia as portas SMTP (25, 465 e 587) nos serviços do plano
gratuito** e o **Railway só libera SMTP no plano Pro**. Em planos gratuitos, o SMTP falha por tempo esgotado mesmo
com as credenciais certas. Por isso, use o Resend (API HTTPS):

1. Crie uma conta em resend.com, gere uma **API Key** e, para enviar a qualquer pessoa, verifique um domínio seu. Sem domínio verificado, o endereço de testes `onboarding@resend.dev` costuma entregar só para o e-mail do dono da conta (confira a documentação do Resend).
2. No serviço da API, defina as variáveis de ambiente:
   - Render: *Environment → Add Environment Variable*. Railway: aba *Variables*.
   - `RESEND_API_KEY` = a chave
   - `EMAIL_FROM` = `Jornada Acadêmica <certificados@seudominio.com>` (domínio verificado)
3. Salve (o serviço reinicia) e teste com `{"simular": true}` e depois com `{"aluno_id": N}` para um aluno seu antes de emitir para todos.

Se preferir SMTP em um plano pago, defina `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASS` e `EMAIL_FROM`
(com Gmail, use uma *senha de app*; o limite é de cerca de 500 e-mails por dia).