import {
  consultarCertificado,
  baixarCertificado,
  acordarServidor,
  ApiError,
} from "./api.js";
import { montarLayout, mostrarToast } from "./layout.js";
import { aplicarMascara, mascaraCpf, apenasDigitos } from "./mascaras.js";
import { cpfValido } from "./validacao.js";

montarLayout({ ativo: "certificado" });
acordarServidor();

const $ = (id) => document.getElementById(id);
const ICONES = {
  sucesso: "bi-check-circle-fill",
  info: "bi-info-circle-fill",
  erro: "bi-exclamation-triangle-fill",
};
const num = (n) =>
  Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const fmtData = (d) =>
  /^\d{4}-\d{2}-\d{2}/.test(d)
    ? d.slice(0, 10).split("-").reverse().join("/")
    : String(d);
let enviando = false;
let baixando = false;
let consulta = null; // só em memória; nada é guardado no navegador

aplicarMascara($("cpf"), mascaraCpf);

function mostrar(tipo, titulo, texto) {
  const caixa = document.createElement("div");
  caixa.className = `jr-alerta jr-alerta-${tipo}`;
  const icone = document.createElement("i");
  icone.className = `bi ${ICONES[tipo]}`;
  icone.setAttribute("aria-hidden", "true");
  const corpo = document.createElement("div");
  const t = document.createElement("strong");
  t.textContent = titulo;
  corpo.append(t);
  if (texto) {
    const p = document.createElement("p");
    p.className = "mb-0 mt-1";
    p.textContent = texto;
    corpo.append(p);
  }
  caixa.append(icone, corpo);
  $("resultado").replaceChildren(caixa);
}

function linhaPresenca(p, m) {
  return m.modo_aprovacao === "horas"
    ? `Sua presença: ${num(p.horas)} h. Mínimo exigido: ${num(m.valor_minimo)} h.`
    : `Sua presença: ${num(p.percentual)}%. Mínimo exigido: ${num(m.valor_minimo)}%.`;
}

async function baixar(botao) {
  if (baixando || !consulta) return; // anti-duplo-clique
  baixando = true;
  botao.disabled = true;
  botao.textContent = "Baixando…";
  try {
    const blob = await baixarCertificado(consulta.cpf, consulta.email);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "certificado-jornada-academica.pdf";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    mostrarToast(e.mensagem, "erro");
  } finally {
    baixando = false;
    botao.disabled = false;
    botao.textContent = "Baixar certificado (PDF)";
  }
}

function exibirResultado(r) {
  switch (r.status) {
    case "aprovado": {
      mostrar(
        "sucesso",
        `Parabéns, ${r.primeiro_nome}!`,
        `Você atingiu a presença mínima. ${linhaPresenca(r.presenca, r.minimo)}`,
      );
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "jr-btn jr-btn-primario mt-3";
      botao.textContent = "Baixar certificado (PDF)";
      botao.addEventListener("click", () => baixar(botao));
      $("resultado").append(botao);
      return;
    }
    case "nao_elegivel":
      return mostrar(
        "info",
        `Olá, ${r.primeiro_nome}. Sua presença não atingiu o mínimo.`,
        linhaPresenca(r.presenca, r.minimo),
      );
    case "ainda_nao_liberado":
      return mostrar(
        "info",
        "Certificados ainda não liberados",
        r.certificados_a_partir_de
          ? `Eles ficam disponíveis a partir de ${fmtData(r.certificados_a_partir_de)}. Volte nessa data para consultar.`
          : "Volte mais tarde para consultar.",
      );
    case "nao_encontrado":
      return mostrar(
        "erro",
        "Não encontramos sua inscrição",
        "Confira se o CPF e o e-mail são os mesmos usados na inscrição.",
      );
    default:
      return mostrar(
        "erro",
        "Não foi possível consultar",
        "Tente novamente em instantes.",
      );
  }
}

function erroCampo(campo, msg) {
  $(campo).classList.add("is-erro");
  $(`erro-${campo}`).textContent = msg;
  $(`erro-${campo}`).hidden = false;
}

$("form-consulta").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (enviando) return; // anti-duplo-clique
  ["cpf", "email"].forEach((c) => {
    $(c).classList.remove("is-erro");
    $(`erro-${c}`).hidden = true;
  });
  $("resultado").replaceChildren();
  consulta = null;
  const cpf = $("cpf").value;
  const email = $("email").value.trim();
  if (!cpfValido(cpf))
    return (erroCampo("cpf", "CPF inválido."), $("cpf").focus());
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return (erroCampo("email", "E-mail inválido."), $("email").focus());

  enviando = true;
  $("botao").disabled = true;
  $("botao").querySelector(".spinner-border").hidden = false;
  $("texto-botao").textContent = "Consultando…";
  try {
    consulta = { cpf: apenasDigitos(cpf), email };
    exibirResultado(await consultarCertificado(consulta.cpf, consulta.email));
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (Object.keys(e.campos).length)
      Object.entries(e.campos).forEach(
        ([c, m]) => $(`erro-${c}`) && erroCampo(c, m),
      );
    else mostrar("erro", "Não foi possível consultar", e.mensagem);
  } finally {
    enviando = false;
    $("botao").disabled = false;
    $("botao").querySelector(".spinner-border").hidden = true;
    $("texto-botao").textContent = "Consultar";
  }
});
