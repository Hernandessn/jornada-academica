// Único ponto de acesso à API. Todas as páginas chamam estas funções.
import { API_URL } from "./config.js";

const TEMPO_LIMITE_MS = 45000; // folga para o servidor gratuito "acordar"

// Erro padronizado: status HTTP, mensagem geral e mensagens por campo.
export class ApiError extends Error {
  constructor(status, mensagem, campos = {}) {
    super(mensagem);
    this.mensagem = mensagem;
    this.status = status;
    this.campos = campos;
  }
}

async function requisicao(metodo, rota, corpo, { auth = false } = {}) {
  const cabecalhos = { "Content-Type": "application/json" };
  if (auth) {
    const token = sessionStorage.getItem("jr_token");
    if (token) cabecalhos.Authorization = `Bearer ${token}`;
  }
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
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

// Públicas
export const inscrever = (dados) =>
  requisicao("POST", "/api/inscricoes", dados);
export const listarEventos = () => requisicao("GET", "/api/eventos");
export const login = (email, senha) =>
  requisicao("POST", "/api/auth/login", { email, senha });
// Ping silencioso: acorda o servidor em planos gratuitos que hibernam.
export const acordarServidor = () =>
  fetch(`${API_URL}/api/saude`, { mode: "no-cors" }).catch(() => {});

// Protegidas (professor/admin)
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
