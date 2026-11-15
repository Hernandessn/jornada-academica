// Único ponto de acesso à API. Todas as páginas chamam estas funções.
import { API_URL } from "./config.js";

const TEMPO_LIMITE_MS = 70000; // folga para o Render (plano gratuito) acordar

// Erro padronizado: status HTTP, mensagem geral e mensagens por campo.
export class ApiError extends Error {
  constructor(status, mensagem, campos = {}) {
    super(mensagem);
    this.mensagem = mensagem;
    this.status = status;
    this.campos = campos;
  }
}

async function requisicao(
  metodo,
  rota,
  corpo,
  { auth = false, limite = TEMPO_LIMITE_MS } = {},
) {
  const cabecalhos = { "Content-Type": "application/json" };
  if (auth) {
    const token = sessionStorage.getItem("jr_token");
    if (token) cabecalhos.Authorization = `Bearer ${token}`;
  }
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), limite);
  let resposta;
  try {
    resposta = await fetch(`${API_URL}${rota}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
    });
  } catch {
    throw new ApiError(
      0,
      "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.",
    );
  } finally {
    clearTimeout(timer);
  }
  let dados = {};
  try {
    dados = await resposta.json();
  } catch {
    /* resposta sem JSON */
  }
  if (resposta.ok) return dados;
  if (resposta.status === 401 && auth) {
    // token expirado: volta ao login com aviso
    sessionStorage.clear();
    location.href = "login.html?expirou=1";
  }
  const mensagem =
    resposta.status === 429
      ? "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo."
      : dados.erro || "Ocorreu um erro inesperado. Tente novamente.";
  throw new ApiError(resposta.status, mensagem, dados.campos || {});
}

// ---------- Públicas ----------
export const inscrever = (dados) =>
  requisicao("POST", "/api/inscricoes", dados);
export const listarEventos = () => requisicao("GET", "/api/eventos");
export const login = (email, senha) =>
  requisicao("POST", "/api/auth/login", { email, senha });
export const consultarCertificado = (cpf, email) =>
  requisicao("POST", "/api/certificados/consulta", { cpf, email });
// Ping silencioso: acorda o servidor em planos gratuitos que hibernam.
export const acordarServidor = () =>
  fetch(`${API_URL}/api/saude`, { mode: "no-cors" }).catch(() => {});

// Download do PDF (a resposta é um arquivo, não JSON). Devolve um Blob.
export async function baixarCertificado(cpf, email) {
  let resposta;
  try {
    resposta = await fetch(`${API_URL}/api/certificados/baixar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf, email }),
    });
  } catch {
    throw new ApiError(
      0,
      "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.",
    );
  }
  if (!resposta.ok) {
    let dados = {};
    try {
      dados = await resposta.json();
    } catch {
      /* sem JSON */
    }
    const msg =
      resposta.status === 429
        ? "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo."
        : dados.erro || "Certificado não disponível.";
    throw new ApiError(resposta.status, msg, dados.campos || {});
  }
  return resposta.blob();
}

// ---------- Protegidas (professor/admin) ----------
export function listarAlunos(eventoId, busca) {
  const p = new URLSearchParams();
  if (eventoId) p.set("evento_id", eventoId);
  if (busca) p.set("busca", busca);
  return requisicao("GET", `/api/alunos?${p}`, null, { auth: true });
}

export const registrarPresenca = (alunoId, eventoId) =>
  requisicao(
    "POST",
    "/api/frequencia",
    { aluno_id: alunoId, evento_id: eventoId },
    { auth: true },
  );

export const resumoFrequencia = () =>
  requisicao("GET", "/api/frequencia/resumo", null, { auth: true });

// ---------- Protegidas (somente admin) ----------
export const lerConfiguracoes = () =>
  requisicao("GET", "/api/configuracoes", null, { auth: true });
export const salvarConfiguracoes = (dados) =>
  requisicao("PUT", "/api/configuracoes", dados, { auth: true });
// A emissão envia um e-mail por aluno (1 a 3 s cada): damos até 5 minutos.
export const emitirCertificados = (opcoes = {}) =>
  requisicao("POST", "/api/certificados/emitir", opcoes, {
    auth: true,
    limite: 300000,
  });
