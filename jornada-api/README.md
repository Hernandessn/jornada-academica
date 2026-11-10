# API da 6ª Jornada Acadêmica UNINASSAU

Back-end (Node.js + Express) do sistema de **inscrição, frequência e certificado** da Jornada.
Cobre API, banco, autenticação e regras de negócio. O front-end e o gerador de certificado
consomem esta API.

- Stack: Node.js 18+, Express, Knex (SQLite em desenvolvimento, PostgreSQL em produção), JWT, bcryptjs, zod, helmet, cors, express-rate-limit.
- Testes: Jest + Supertest (rodam em SQLite na memória, sem tocar no seu banco).

## 1. Instalação

```bash
cd jornada-api
cp .env.example .env      # no Windows (PowerShell): copy .env.example .env
npm install
npm run db:setup          # cria as tabelas e popula: 1 admin, 1 professor, 2 eventos, regra padrão
npm run dev               # http://localhost:3000
```

Teste rápido: `curl http://localhost:3000/api/saude`

> `better-sqlite3` usa um módulo nativo. Se `npm install` falhar no Windows, use Node 20 ou 22 (LTS),
> que têm binários prontos.

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
| `RATE_LIMIT_GERAL` / `RATE_LIMIT_LOGIN` / `RATE_LIMIT_INSCRICOES` | Requisições por IP a cada 15 min | `600` / `10` / `30` |

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
| `npm run seed` | Cria usuários, eventos e regra padrão (pode repetir sem duplicar) |
| `npm run db:setup` | `migrate` + `seed` |
| `npm run db:reset` | **Apaga tudo** e recria (só desenvolvimento) |
| `npm test` | Testes automatizados |

### Mudar datas e horas dos eventos

Edite a lista `EVENTOS` no topo de `seeds/02_eventos.js`. Em um banco novo, rode `npm run db:setup`.
Em um banco que já tem eventos, o seed só **adiciona** os que ainda não existem (mesmo título e data);
ele nunca apaga, para não perder presenças.

## 4. Testes

```bash
npm test
```

Cobrem: formulário vazio, CPF com letras, CPF inválido, CPF e e-mail duplicados (inclusive requisições
simultâneas), presença duplicada, acesso sem login (401), acesso com papel errado (403) e troca da regra
de presença (horas ↔ percentual).

## 5. Formato de erro

Todo erro sai em JSON padronizado:

```json
{ "erro": "Dados inválidos.", "campos": { "cpf": "CPF inválido." } }
```

| Status | Quando |
|---|---|
| 400 | Dados inválidos (`campos` traz a mensagem de cada campo) |
| 401 | Sem token, token inválido/expirado ou login incorreto |
| 403 | Papel sem permissão |
| 404 | Aluno, evento ou rota inexistente |
| 409 | CPF ou e-mail já cadastrado (`campos` diz qual) |
| 429 | Limite de requisições por IP excedido |

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
Nas demais rotas, envie `Authorization: Bearer <token>`.

### `POST /api/inscricoes` (público)

CPF, telefone e matrícula podem vir com ou sem máscara; o servidor guarda só dígitos.

```bash
curl -X POST http://localhost:3000/api/inscricoes \
  -H 'Content-Type: application/json' \
  -d '{
    "nome": "Maria da Silva",
    "email": "maria@exemplo.com",
    "telefone": "(86) 99999-1234",
    "cpf": "529.982.247-25",
    "matricula": "20231234",
    "curso": "Análise e Desenvolvimento de Sistemas"
  }'
```

Resposta 201: `{ "mensagem": "...", "aluno": { "id", "nome", "email", "cpf": "***.982.247-**", "curso", "criado_em" } }`.
CPF ou e-mail repetido: **409** com `campos.cpf` e/ou `campos.email`.

### `GET /api/eventos` (público)

```bash
curl http://localhost:3000/api/eventos
```

Resposta: `{ "eventos": [ { "id": 1, "titulo": "...", "data": "2026-12-09", "carga_horaria": 10 } ] }`.

### `GET /api/alunos` (professor, admin)

Parâmetros opcionais: `busca` (só números/pontuação = CPF; senão = nome) e `evento_id` (acrescenta `presente`
true/false em cada aluno, útil para a tela de chamada). O CPF sai sempre mascarado.

```bash
curl -H "Authorization: Bearer $TOKEN_PROF" "http://localhost:3000/api/alunos"
curl -H "Authorization: Bearer $TOKEN_PROF" "http://localhost:3000/api/alunos?busca=maria"
curl -H "Authorization: Bearer $TOKEN_PROF" "http://localhost:3000/api/alunos?busca=982.247"
curl -H "Authorization: Bearer $TOKEN_PROF" "http://localhost:3000/api/alunos?evento_id=1"
```

Resposta: `{ "total": 1, "alunos": [ { "id", "nome", "email", "telefone", "cpf", "matricula", "curso", "criado_em", "presente"? } ] }`.

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
  "configuracao": { "modo_aprovacao": "horas", "valor_minimo": 20 },
  "carga_horaria_total": 20,
  "total_alunos": 1,
  "total_elegiveis": 0,
  "alunos": [
    { "id": 1, "nome": "Maria da Silva", "email": "maria@exemplo.com", "cpf": "***.982.247-**",
      "matricula": "20231234", "curso": "...", "presencas": 1,
      "horas_presentes": 10, "percentual": 50, "elegivel": false }
  ]
}
```

### `GET /api/configuracoes` (somente admin)

```bash
curl -H "Authorization: Bearer $TOKEN_ADMIN" http://localhost:3000/api/configuracoes
```

### `PUT /api/configuracoes` (somente admin)

```bash
# 75% de presença
curl -X PUT http://localhost:3000/api/configuracoes \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"modo_aprovacao": "percentual", "valor_minimo": 75}'

# 20 horas
curl -X PUT http://localhost:3000/api/configuracoes \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"modo_aprovacao": "horas", "valor_minimo": 20}'
```

`valor_minimo` precisa ser um **número** maior que zero (e até 100 no modo percentual).

## 7. Regras de presença (RN02)

- **Modo `horas`:** elegível se a soma da carga horária dos eventos com presença for `>= valor_minimo`.
- **Modo `percentual`:** elegível se `horas presentes ÷ carga horária total de todos os eventos × 100 >= valor_minimo`.
- Quem nunca teve presença registrada nunca é elegível.
- Padrão inicial: modo `horas`, mínimo `20`.

## 8. Para o módulo de certificado

`POST /api/certificados/emitir` fica fora deste módulo. Para montá-la, importe a função de cálculo:

```js
const { calcularResumoPresenca } = require('./servicos/presenca');
const db = require('./db');
const { autenticar, exigirPapel } = require('./middlewares/auth');

const { alunos } = await calcularResumoPresenca();
const aprovados = alunos.filter((a) => a.elegivel); // trazem nome, email e CPF completo (só dígitos)
```

- Monte a rota em `src/app.js`, no ponto marcado com um comentário, protegida por `autenticar, exigirPapel('admin')`.
- A tabela `certificados` tem `aluno_id` único: grave uma linha depois de enviar o e-mail para saber quem já recebeu.
- O CPF completo só deve ir para o PDF se o professor decidir isso; nas listas da API ele sai sempre mascarado.

## 9. Deploy com PostgreSQL

Antes de tudo, suba o código para um repositório no GitHub (o `.gitignore` já deixa `.env` e `node_modules` de fora).

### Render

1. **Banco:** *New → PostgreSQL*. Quando ficar pronto, copie a **Internal Database URL** (se o serviço e o banco estiverem na mesma região).
2. **API:** *New → Web Service*, aponte para o repositório.
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm run db:setup && npm start`
   - Health Check Path: `/api/saude`
3. **Variáveis de ambiente** do serviço:
   - `NODE_ENV=production`
   - `DATABASE_URL` = a URL copiada do banco
   - `JWT_SECRET` = valor aleatório com 32+ caracteres (comando na seção 2)
   - `CORS_ORIGIN` = link do front-end (ex.: `https://jornada.vercel.app`), sem barra no final
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_SENHA`, `SEED_PROFESSOR_EMAIL`, `SEED_PROFESSOR_SENHA` com senhas próprias
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

- `npm run db:setup` roda a cada início e é seguro repetir: cria tabelas que faltam e não duplica usuários, eventos nem a regra. Se as senhas do seed forem as padrão, o serviço **não sobe** em produção, de propósito.
- Senhas do seed só valem na primeira criação do usuário. Para trocar depois, altere direto no banco ou crie uma rota de troca de senha.
- O plano gratuito dessas plataformas hiberna o serviço e pode limitar ou expirar o banco: confira as regras atuais do plano antes da apresentação e faça um teste completo no link público com dados fictícios.
- Use HTTPS (os dois fornecem) e mantenha `CORS_ORIGIN` restrito ao link do front-end.
