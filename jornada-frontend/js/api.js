// Único ponto de acesso à API. Todas as páginas chamam estas funções.
import { API_URL } from "./config.js";

const TEMPO_LIMITE_MS = 45000; // folga para o servidor gratuito "acordar"

// Erro padronizado: status HTTP, mensagem geral e mensagens por campo.
export class ApiError extends Error {
  constructor(status, mensagem, campos = {}) {
    super(mensagem);
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
    // token expirado (usado a partir da etapa 5)
    sessionStorage.clear();
    location.href = "login.html?expirou=1";
  }
  const mensagem =
    resposta.status === 429
      ? "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo."
      : dados.erro || "Ocorreu um erro inesperado. Tente novamente.";
  throw new ApiError(resposta.status, mensagem, dados.campos || {});
}

export const inscrever = (dados) =>
  requisicao("POST", "/api/inscricoes", dados);
export const listarEventos = () => requisicao("GET", "/api/eventos");
// Ping silencioso: acorda o servidor em planos gratuitos que hibernam.
export const acordarServidor = () =>
  fetch(`${API_URL}/api/saude`, { mode: "no-cors" }).catch(() => {});
