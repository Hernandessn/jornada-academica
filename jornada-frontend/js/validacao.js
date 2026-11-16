// Validação de conforto no navegador. A regra de verdade é do servidor.
import { apenasDigitos } from "./mascaras.js";
import { RESUMO_MAX, ARQUIVO_MAX_MB, ARQUIVO_EXTENSOES } from "./config.js";

export const OUTROS = "__outros__"; // valor do item "Outros" na lista de cursos

export function cpfValido(cpf) {
  const d = apenasDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const tam of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < tam; i++) soma += Number(d[i]) * (tam + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(d[tam])) return false;
  }
  return true;
}

// Quebra de linha conta como 1 caractere (como no servidor).
export const tamanhoResumo = (t) => t.replace(/\r\n?/g, "\n").trim().length;

export function formatarTamanho(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

// Valida o arquivo pela extensão (o MIME do .odt no Windows não é confiável) e pelo tamanho.
export function validarArquivo(arquivo) {
  if (!arquivo) return "Anexe o arquivo do seu trabalho (PDF, DOC, DOCX ou ODT).";
  const nome = arquivo.name.toLowerCase();
  if (!ARQUIVO_EXTENSOES.some((ext) => nome.endsWith(ext)))
    return "Envie um arquivo PDF, DOC, DOCX ou ODT.";
  if (arquivo.size === 0) return "O arquivo está vazio.";
  if (arquivo.size > ARQUIVO_MAX_MB * 1024 * 1024)
    return `O arquivo deve ter até ${ARQUIVO_MAX_MB} MB.`;
  return "";
}

// Recebe os valores do formulário e devolve { campo: mensagem } só com os campos inválidos.
export function validarInscricao(v) {
  const e = {};
  const nome = v.nome.trim();
  if (!nome) e.nome = "Informe seu nome completo.";
  else if (nome.split(/\s+/).length < 2) e.nome = "Informe nome e sobrenome.";
  else if (/\d/.test(nome)) e.nome = "O nome não pode ter números.";
  else if (nome.length > 150) e.nome = "O nome deve ter até 150 caracteres.";

  if (!v.email.trim()) e.email = "Informe seu e-mail.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()))
    e.email = "E-mail inválido.";

  const tel = apenasDigitos(v.telefone);
  if (!tel) e.telefone = "Informe seu telefone.";
  else if (tel.length < 10 || tel.length > 11)
    e.telefone = "Informe o telefone com DDD.";

  if (!v.cpf.trim()) e.cpf = "Informe seu CPF.";
  else if (/[A-Za-z]/.test(v.cpf) || !cpfValido(v.cpf)) e.cpf = "CPF inválido.";

  // Matrícula: obrigatória só para alunos. Público externo não tem esse campo.
  if (v.tipo === "aluno") {
    const mat = apenasDigitos(v.matricula);
    if (!mat) e.matricula = "Informe sua matrícula.";
    else if (mat.length < 4)
      e.matricula = "A matrícula deve ter de 4 a 20 dígitos.";
  }

  if (!v.curso) e.curso = "Selecione seu curso.";
  else if (v.curso === OUTROS) {
    const outro = v.cursoOutro.trim();
    if (outro.length < 2) e.curso_outro = "Digite o nome do curso.";
    else if (outro.length > 100)
      e.curso_outro = "O nome do curso deve ter até 100 caracteres.";
  }

  if (v.tipo === "externo") {
    const inst = v.instituicao.trim();
    if (!inst) e.instituicao = "Informe a instituição de origem.";
    else if (inst.length > 150) e.instituicao = "Use até 150 caracteres.";
  }
  if (!v.disciplina) e.disciplina = "Selecione sua disciplina.";
  if (!v.formato) e.formato = "Selecione o formato da apresentação.";
  const tamResumo = tamanhoResumo(v.resumo);
  if (!tamResumo) e.resumo = "Escreva o resumo do seu trabalho.";
  else if (tamResumo > RESUMO_MAX)
    e.resumo = `O resumo deve ter até ${RESUMO_MAX} caracteres.`;
  if (!v.aceite) e.aceite = "Aceite o uso dos dados para continuar.";
  const erroArquivo = validarArquivo(v.arquivo);
  if (erroArquivo) e.arquivo = erroArquivo;
  return e;
}
