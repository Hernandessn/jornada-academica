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
// Co-autores (equipes participantes), em ordem alfabética. Os desenvolvedores ficam em DEVS.
export const EQUIPES = [
  "Agostinho Pereira de Souza Neto",
  "Ana Letícia Brandão Costa Sousa",
  "Antonio Jose Barros Silva Filho",
  "Ataniel Lucas Bacelar Soares de Sousa",
  "Cleverton Robson Carvalho Brasil",
  "Danillo Vinicius Alves Costa",
  "David Beckham de Oliveira Delmiro",
  "Erasmo Vinícius Lima de Carvalho",
  "Erick Wendler Ferreira Sousa Silva Nascimento",
  "Fernando Adryan Moura Lima",
  "Francisco de Sales Fortes Neto",
  "Francisco Vitor Santos Lima",
  "Franscisco Arthur Gomes Lima e Silva",
  "Gabriel Melo Mendes",
  "Gilvan de Sousa Gervasio",
  "Giulianno Lustosa Silva Gomes",
  "Guilherme Henrique Mendes da Fonseca",
  "Gustavo Mateus Santana Ferreira",
  "Italo Gabriel Santos Oliveira",
  "Italo Gustavo de Oliveira Soares",
  "Ithalo Morais Ferreira",
  "Jessica Hellen Carvalho da Silva",
  "Joao Victor Sousa de Assis",
  "José Rodolfo Ferreira Moura",
  "Kallyson Antonio Rodrigues de Deus",
  "Larissa Viana Pereira",
  "Lucas Emanuel Araujo da Silva",
  "Lucas Martins Santos",
  "Luis Gustavo Machado da Silva",
  "Luiz Claudio Brito Rocha de Sousa",
  "Marco Antonio de Sousa Lopes",
  "Marcos Aurélio Silva Machado",
  "Marcos da Silva Costa Junior",
  "Marcos Fernando Praxedes Nunes",
  "Marcos Paulo Feitosa Espinosa",
  "Marcos Vinícius Moreira Lima",
  "Marcus Vinicius Assuncao Bomfim",
  "Maria Clara da Cunha Araujo",
  "Maria Heloisa Mendes",
  "Maria Letícia da Silva Xavier",
  "Marilia Medeiros Santos",
  "Marlon Willian Silva Costa",
  "Matheus Ferreira Barros",
  "Matheus Medeiros de Melo e Silva",
  "Mayson de Tacio Freire Ferreia",
  "Michael Reis Vaz de Sousa",
  "Miguel Lucas Mendes do Monte",
  "Miqueias Silva dos Santos",
  "Natanael Lima Fernandez",
  "Pedro Gabriel de Almeida Avelino",
  "Raysllane Amanda de Souza Andrade",
  "Rosanne Mayara Rodrigues de Sousa",
  "Sarah Rebeca Leão de Moraes",
  "Victor Emanuel Pereira da Silva",
  "Victor Lucas Batista e Silva",
  "Vinícius José Pereira Lopes",
  "Wagner Vinícius de Sousa Bastos Moura",
  "Wenderson Victhor Sousa Bezerra",
];
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
    nome: "Carlos Rony",
    rotulo: "Instagram",
    url: "https://www.instagram.com/c.r_rony",
  },
  {
    nome: "Hernandes Sales",
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
