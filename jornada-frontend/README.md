# Front-end da VI Jornada Acadêmica da Uninassau Teresina

Site estático: HTML, CSS e JavaScript puro (módulos ES), com Bootstrap 5 e Bootstrap Icons por CDN. Não tem etapa de build. Consome a API da pasta `../jornada-api`.

## Páginas

| Arquivo            | Quem acessa       | O que faz                                                                  |
| ------------------ | ----------------- | -------------------------------------------------------------------------- |
| `index.html`       | Público           | Landing: texto do edital, doação, programação e cronograma                 |
| `inscricao.html`   | Público           | Inscrição de trabalho (CPF, e-mail, disciplina, formato)                   |
| `certificado.html` | Público           | Consulta de certificado por CPF e e-mail, e download do PDF                |
| `login.html`       | Professor e admin | Entrada (o token fica no `sessionStorage`)                                 |
| `professor.html`   | Professor e admin | Chamada de presença por sessão                                             |
| `admin.html`       | Admin             | Regra de presença, datas, assinaturas, simulação e emissão de certificados |
| `styleguide.html`  | Equipe            | Componentes do design (uso interno)                                        |

## Rodar no computador

1. API: `cd jornada-api`, `npm install`, `npm run db:setup`, `npm run dev` (fica em `http://localhost:3000`). Use Node 20 ou 22.
2. Front: abra a pasta no VS Code e use a extensão **Live Server** (porta 5500, que a API já permite). Não abra os arquivos direto pelo navegador (`file://`).
3. Antes de 16/11 as inscrições ficam fechadas. Para testar, entre como admin e ligue o **modo de teste**.

Os logins de teste estão no README da API e valem só em desenvolvimento.

## Configuração (`js/config.js`)

Todas as configurações ficam neste arquivo: `API_URL`, dados do evento, contato de suporte, Instagram e lista de cursos.

## Estrutura

- `css/`: `tokens.css` (cores e tipografia), `components.css` (componentes) e `paginas.css` (páginas).
- `js/api.js`: único arquivo que fala com a API. `auth.js`: sessão. `layout.js`: menu, rodapé e avisos. Os demais arquivos têm um por página.
- `assets/`: logos, faixas e foto do hero.

## Publicação

- Hospedagem estática (Vercel ou Netlify): pasta raiz `jornada-frontend`, sem comando de build.
- Edite `API_URL` em `js/config.js` com a URL pública da API e faça o commit.
- No back-end, `CORS_ORIGIN` deve ser o endereço do front, sem barra no final.
- Os nomes dos arquivos são todos em minúsculas (servidores Linux diferenciam maiúsculas).

## Checklist de produção

- [ ] `API_URL` com a URL real da API
- [ ] `CORS_ORIGIN` da API com o endereço do front
- [ ] Lista oficial de cursos em `CURSOS`
- [ ] Contato real de suporte em `SUPORTE`, com `exemplo: false`
- [ ] Senhas `SEED_*` próprias e banco de produção sem dados de teste
- [ ] `ignorar_datas` desligado (o admin mostra uma faixa vermelha quando está ligado)
- [ ] Nome da reitora e do coordenador preenchidos no admin
- [ ] E-mail do servidor configurado (`RESEND_API_KEY` e `EMAIL_FROM`); testar com **Simular** e com um aluno antes de emitir para todos
- [ ] Limites de requisição ajustados para o dia do evento (`RATE_LIMIT_INSCRICOES` e `RATE_LIMIT_GERAL`), e `trust proxy` conferido na plataforma
- [ ] Divulgar o link novo do site (o edital cita outro endereço)
- [ ] Teste completo no link público, com dados fictícios

## Limitações conhecidas

- A inscrição é individual. A API não recebe título, resumo nem lista de participantes, que o edital prevê.
- A matrícula é obrigatória, o que impede a inscrição de participantes externos.
- A carga horária e as datas do certificado ficam impressas no modelo em PDF do back-end.
- O token de login fica no `sessionStorage` (some ao fechar a aba).
