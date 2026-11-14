// Configurações do front-end. Edite aqui; nenhum outro arquivo guarda URLs ou contatos.
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
export const API_URL = local
  ? "http://localhost:3000"
  : "https://TROCAR-PELA-URL-DO-BACK-END.onrender.com"; // TODO: URL do Render/Railway
export const USAR_MOCK_CERTIFICADO = true; // rota de consulta ainda não existe no back-end
export const EVENTO = {
  nome: "6ª Jornada Acadêmica",
  datas: "09 e 10 de dezembro de 2026",
  carga: "20h",
  local: "UNINASSAU Teresina - PI",
  lema: "Conhecimento que conecta pessoas e transforma realidades.",
};
// EXEMPLO: troque pelos contatos reais antes da entrega.
export const SUPORTE = {
  exemplo: true,
  email: "suporte@exemplo.com.br",
  telefone: "(00) 00000-0000",
};
export const REDES = { instagram: "", youtube: "", linkedin: "" }; // preencha com URLs; vazio = ícone não aparece
export const SITE = "https://www.uninassau.edu.br";
// EXEMPLO: substitua pela lista oficial de cursos.
export const CURSOS = [
  "Administração",
  "Direito",
  "Enfermagem",
  "Engenharia de Software",
  "Psicologia",
];
