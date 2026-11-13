# API da VI Jornada Acadêmica UNINASSAU

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
npm run db:setup          # cria as tabelas e popula: 1 admin, 1 professor, 4 sessões, configuração padrão
npm run dev               # http://localhost:3000
```

Teste rápido: `curl http://localhost:3000/api/saude`

> `better-sqlite3` usa um módulo nativo. Se `npm install` falhar no Windows, use Node 20 ou 22 (LTS),
> que têm binários prontos.

### Já tinha o banco de desenvolvimento da versão anterior?

Atualize sem perder dados:

```bash
npm run migrate    # acrescenta as colunas novas (disciplina, formato, horários, configurações)
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
| `RATE_LIMIT_GERAL` / `RATE_LIMIT_LOGIN` / `RATE_LIMIT_INSCRICOES` / `RATE_LIMIT_CONSULTA` | Requisições por IP a cada 15 min | `600` / `10` / `30` / `10` |

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
| `tests/api.test.js` | Formulário vazio, CPF com letras, CPF inválido, CPF e e-mail duplicados (inclusive simultâneos), presença duplicada, acesso sem login (401), papel errado (403), resumo de presença e troca da regra (horas ↔ percentual) |
| `tests/requisitos.test.js` | Disciplina obrigatória, formato automático, período de inscrições, configurações novas, consulta de certificado (inclusive CPF com e-mail incorreto) |
| `tests/limites.test.js` | Rate limit da consulta e do login |
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
Nas demais rotas protegidas, envie `Authorization: Bearer <token>`.

### `POST /api/inscricoes` (público)

Campos obrigatórios: `nome` (nome e sobrenome), `email`, `telefone`, `cpf`, `matricula`, `curso`, `disciplina`.
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

- **201:** `{ "mensagem": "...", "aluno": { "id", "nome", "email", "cpf": "***.982.247-**", "curso", "disciplina", "formato", "criado_em" } }`
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

Resposta: `{ "total": 1, "alunos": [ { "id", "nome", "email", "telefone", "cpf", "matricula", "curso", "disciplina", "formato", "criado_em", "presente"? } ] }`.

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

## 7. Regras de presença (RN02)

- **Modo `percentual` (padrão, 75%):** elegível se `horas presentes ÷ carga horária total de todas as sessões × 100 >= valor_minimo`.
- **Modo `horas`:** elegível se a soma da carga horária das sessões com presença for `>= valor_minimo`.
- Quem nunca teve presença registrada nunca é elegível.
- A carga horária total é a **soma das sessões cadastradas** (no seed: 11,5 h; 75% = 8,625 h). A
  `carga_horaria_certificado` (20 h) é independente: é só a carga que consta no certificado e **não entra no cálculo**.
- Atenção: no modo `horas`, um mínimo maior que a soma das sessões (por exemplo, 20 h com 11,5 h de sessões) nunca é atingido.

## 8. Para o módulo de certificado

`POST /api/certificados/emitir` fica fora deste módulo. Para montá-la, importe a função de cálculo:

```js
const { calcularResumoPresenca } = require('./servicos/presenca');
const db = require('./db');
const { autenticar, exigirPapel } = require('./middlewares/auth');

const { configuracao, alunos } = await calcularResumoPresenca();
const aprovados = alunos.filter((a) => a.elegivel); // trazem nome, email, disciplina, formato e CPF completo (só dígitos)
// configuracao inclui: carga_horaria_certificado, reitora_nome, coordenador_nome, certificados_a_partir_de...
```

- Acrescente a rota em `src/rotas/certificados.js` (já montada em `/api/certificados` e com a rota `/consulta`), protegida por `autenticar, exigirPapel('admin')`.
- Para um aluno só: `calcularResumoPresenca(db, { alunoId })`.
- `certificadosLiberados(configuracao)` (em `src/servicos/periodos.js`) diz se a data de liberação já passou.
- A tabela `certificados` tem `aluno_id` único: grave uma linha depois de enviar o e-mail para saber quem já recebeu.
- O CPF completo só deve ir para o PDF se o professor decidir isso; nas listas da API ele sai sempre mascarado.

## 9. Deploy com PostgreSQL

Antes de tudo, suba o código para um repositório no GitHub (o `.gitignore` já deixa `.env` e `node_modules` de fora).
Se a API está em uma subpasta do repositório (por exemplo `jornada-api/`), defina o **Root Directory** do serviço
com o nome dessa pasta nas configurações do Render ou do Railway; senão ele não encontra o `package.json`.

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

- `npm run db:setup` roda a cada início e é seguro repetir: cria tabelas que faltam, aplica as migrations novas e não duplica usuários, sessões nem a configuração. Se as senhas do seed forem as padrão, o serviço **não sobe** em produção, de propósito.
- Senhas do seed só valem na primeira criação do usuário. Para trocar depois, altere direto no banco ou crie uma rota de troca de senha.
- Em produção as inscrições só funcionam de `inscricoes_de` a `inscricoes_ate` (16 a 30/11/2026 por padrão). Para testar antes, o admin liga `ignorar_datas` e **desliga de novo** antes do evento.
- O plano gratuito dessas plataformas hiberna o serviço e pode limitar ou expirar o banco: confira as regras atuais do plano antes da apresentação e faça um teste completo no link público com dados fictícios.
- Use HTTPS (os dois fornecem) e mantenha `CORS_ORIGIN` restrito ao link do front-end.
