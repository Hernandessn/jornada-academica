# Sistema da VI Jornada Acadêmica da Uninassau Teresina

Sistema web de **inscrição de trabalhos, frequência (chamada) e certificado** da VI Jornada Acadêmica da Uninassau Teresina (09 e 10/12/2026). Foi desenvolvido na atividade do Hackathon da disciplina de Engenharia de Software (2º ADS), coordenado pelo Prof. Juaceli Júnior.

- **Site publicado:** [colar aqui o link]
- **Autores:** Hernandes Sales Neves e Carlos Rony Andrade Oliveira

## Funcionalidades

- Site do evento com texto do edital, programação, cronograma e pedido de doação de 1 kg de alimento.
- Inscrição de trabalhos com máscaras, validação de CPF, bloqueio de duplicidade e disciplina (APIExt I a VI, PIC e Outras). O formato de apresentação (banner ou comunicação oral) é definido pela disciplina.
- Painel do professor para a chamada por sessão (quatro turnos).
- Painel do administrador para configurar a regra de presença, as datas e emitir certificados.
- Consulta pública de certificado (CPF e e-mail juntos) e download em PDF.
- Emissão de certificados em lote, com envio por e-mail.

## Tecnologias

| Parte | Tecnologias |
|---|---|
| Front-end (`jornada-frontend`) | HTML, CSS e JavaScript |
| API (`jornada-api`) | Node.js 22+, Express, Knex, JWT, bcryptjs, zod, helmet, cors, express-rate-limit |
| Banco de dados | SQLite em desenvolvimento e PostgreSQL em produção |
| Certificado e e-mail | PDF gerado sobre o modelo oficial; envio por SMTP, Resend ou Ethereal (testes) |
| Testes | Jest e Supertest (na API) |

## Estrutura do repositório

```
jornada-academica/
├── jornada-api/        API (back-end), banco de dados e testes
├── jornada-frontend/   Site (front-end)
└── README.md           Este arquivo
```

Cada pasta tem o seu próprio `README.md`, com detalhes de instalação, variáveis de ambiente e uso.

## Como rodar (resumo)

Pré-requisitos: Node.js 22 ou mais novo e Git.

### 1. API

```bash
cd jornada-api
cp .env.example .env      # no Windows (PowerShell): copy .env.example .env
npm install
npm run db:setup          # cria as tabelas e os dados iniciais
npm run dev               # http://localhost:3000
```

Teste rápido: `http://localhost:3000/api/saude`. As contas de teste criadas pelo `db:setup` e todas as variáveis de ambiente estão em `jornada-api/README.md`.

### 2. Front-end

Siga `jornada-frontend/README.md`. A API só aceita chamadas das origens listadas em `CORS_ORIGIN` no `.env` (o padrão libera `http://localhost:5500` e `http://127.0.0.1:5500`). Se o front abrir em outro endereço ou porta, inclua-o em `CORS_ORIGIN` e reinicie a API. O front deve apontar para `http://localhost:3000` no arquivo de configuração da URL da API.

### 3. Testes automatizados (API)

```bash
cd jornada-api
npm test
```

### Testar antes de 16/11 ou depois de 30/11

As inscrições só funcionam de 16 a 30/11/2026, e a consulta de certificado só libera a partir de 14/12/2026. Para testar fora dessas datas, o administrador liga `ignorar_datas` em `PUT /api/configuracoes` (veja `jornada-api/README.md`). **Desligue depois dos testes.**

## Regras principais

- **Inscrição:** CPF e e-mail únicos; CPF com dígitos verificadores válidos.
- **Presença:** quatro sessões (09/12 manhã e noite, 10/12 manhã e noite), somando 11,5 horas. A regra de aprovação é configurável (padrão: 75% de presença). As 20 horas impressas no certificado são um valor fixo e não entram no cálculo.
- **Certificado:** consulta com CPF e e-mail juntos, liberada a partir de 14/12/2026. A emissão em lote é feita pelo administrador.

## Rotas da API (resumo)

| Rota | Acesso |
|---|---|
| `POST /api/auth/login` | Público |
| `POST /api/inscricoes` | Público (no período de inscrições) |
| `GET /api/eventos` | Público |
| `POST /api/certificados/consulta` | Público |
| `POST /api/certificados/baixar` | Público |
| `GET /api/alunos` | Professor, admin |
| `POST /api/frequencia` | Professor, admin |
| `GET /api/frequencia/resumo` | Professor, admin |
| `GET` e `PUT /api/configuracoes` | Admin |
| `POST /api/certificados/emitir` | Admin |

Exemplos, formatos de resposta e códigos de erro: `jornada-api/README.md`.

## Segurança e LGPD

- Login com perfis (professor e admin) e token JWT.
- CPF mascarado nas listas e nunca devolvido por completo na consulta pública.
- A consulta e o download de certificado exigem CPF e e-mail juntos, sem revelar se um CPF está cadastrado.
- Limite de requisições por IP no login, na inscrição, na consulta e no download.
- Segredos em variáveis de ambiente, fora do repositório.

## Autoria e uso

Copyright (c) 2026 Hernandes Sales Neves e Carlos Rony Andrade Oliveira. Todos os direitos reservados.

Este projeto foi desenvolvido como atividade acadêmica da UNINASSAU Teresina (Hackathon da VI Jornada Acadêmica) e é entregue ao professor para avaliação. O uso para outras finalidades, inclusive na VI Jornada Acadêmica, depende de acordo por escrito com os autores.
