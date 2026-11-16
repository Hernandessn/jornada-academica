// Configurações do front-end. Edite aqui; nenhum outro arquivo guarda URLs ou contatos.
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
export const API_URL = local
  ? "http://localhost:3000"
  : "https://jornada-academica-8axu.onrender.com";
export const USAR_MOCK_CERTIFICADO = true; // não é mais usado (a rota de consulta existe)

export const EVENTO = {
  nome: "VI Jornada Acadêmica da Uninassau Teresina",
  datas: "09 e 10/12/2026",
  inscricoes: "Inscrições de 16 a 30/11/2026",
  local: "UNINASSAU Teresina - PI",
  lema: "Conhecimento que conecta pessoas e transforma realidades.",
};
// Regras do formulário de inscrição (o servidor valida de novo; estes valores são para conforto).
export const RESUMO_MAX = 2000; // caracteres
export const ARQUIVO_MAX_MB = 10; // igual ao UPLOAD_MAX_MB do back-end
export const ARQUIVO_EXTENSOES = [".pdf", ".doc", ".docx", ".odt"];
// Créditos do rodapé. Só aparece o que estiver preenchido.
export const ORIENTADOR = "Juaceli Junior";
export const EQUIPES = []; // ex.: ["Equipe A", "Equipe B"] (nomes ainda a definir)
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
// Cursos de graduação da UNINASSAU Teresina (CONFERIR no site oficial). "Outros" é adicionado pelo formulário.
export const CURSOS = [
  "Administração",
  "Análise e Desenvolvimento de Sistemas",
  "Ciências Contábeis",
  "Design",
  "Direito",
  "Enfermagem",
  "Engenharia Civil",
  "Estética e Cosmética",
  "Farmácia",
  "Fisioterapia",
  "Fonoaudiologia",
  "Gestão de Recursos Humanos",
  "História",
  "Medicina",
  "Medicina Veterinária",
  "Odontologia",
  "Pedagogia",
  "Psicologia",
  "Publicidade e Propaganda",
  "Radiologia",
  "Terapia Ocupacional",
];
