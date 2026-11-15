// Configurações do front-end. Edite aqui; nenhum outro arquivo guarda URLs ou contatos.
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
export const API_URL = local
  ? "http://localhost:3000"
  : "https://TROCAR-PELA-URL-DO-BACK-END.onrender.com"; // TODO: URL do Render/Railway
export const USAR_MOCK_CERTIFICADO = true; // não é mais usado (a rota de consulta existe)

export const EVENTO = {
  nome: "VI Jornada Acadêmica da Uninassau Teresina",
  datas: "09 e 10/12/2026",
  inscricoes: "Inscrições de 16 a 30/11/2026",
  local: "UNINASSAU Teresina - PI",
  lema: "Conhecimento que conecta pessoas e transforma realidades.",
};
// EXEMPLO: troque pelos contatos reais. Enquanto "exemplo" for true, o rodapé não os mostra.
export const SUPORTE = {
  exemplo: true,
  email: "suporte@exemplo.com.br",
  telefone: "(00) 00000-0000",
};
export const REDES = {
  instagram: "https://www.instagram.com/vi_jornadaacademicauninassau",
};
export const SITE = "https://www.uninassau.edu.br";
// Desenvolvedores do rodapé. Só aparece quem tiver "url" (começando com https://).
export const DEVS = [
  {
    nome: "Rony",
    rotulo: "Instagram",
    url: "https://www.instagram.com/c.r_rony",
  },
  {
    nome: "Hernandes",
    rotulo: "Portfólio",
    url: "https://linkhernandess.vercel.app/",
  },
];
// EXEMPLO: substitua pela lista oficial de cursos.
export const CURSOS = [
  "Administração",
  "Direito",
  "Enfermagem",
  "Engenharia de Software",
  "Psicologia",
];
