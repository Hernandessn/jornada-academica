import { CURSOS, EVENTO } from "./config.js";
import { montarLayout, mostrarToast } from "./layout.js";
import { inscrever, acordarServidor, ApiError } from "./api.js";
import {
  aplicarMascara,
  mascaraCpf,
  mascaraTelefone,
  mascaraMatricula,
  apenasDigitos,
} from "./mascaras.js";
import { validarInscricao } from "./validacao.js";

montarLayout({ ativo: "inscricao" });
acordarServidor();

const $ = (id) => document.getElementById(id);
const form = $("form-inscricao"),
  botao = $("botao-enviar");
const CAMPOS = [
  "nome",
  "email",
  "telefone",
  "cpf",
  "matricula",
  "curso",
  "instituicao",
  "disciplina",
  "formato",
  "aceite",
];
const DISCIPLINAS = [
  "APIExt I",
  "APIExt II",
  "APIExt III",
  "APIExt IV",
  "APIExt V",
  "APIExt VI",
  "PIC",
  "Outras",
]; // escrita exata exigida pela API
const FORMATOS = { banner: "Banner", comunicacao_oral: "Comunicação oral" };
// Regra do edital: APIExt I, III e V = banner; II, IV e VI = comunicação oral. PIC e Outras: a pessoa escolhe.
const FORMATO_AUTO = {
  "APIExt I": "banner",
  "APIExt III": "banner",
  "APIExt V": "banner",
  "APIExt II": "comunicacao_oral",
  "APIExt IV": "comunicacao_oral",
  "APIExt VI": "comunicacao_oral",
};
let enviando = false;

function preencher(select, pares) {
  pares.forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    select.append(o);
  });
}
preencher(
  $("curso"),
  CURSOS.map((c) => [c, c]),
);
preencher(
  $("disciplina"),
  DISCIPLINAS.map((d) => [d, d]),
);
preencher($("formato"), Object.entries(FORMATOS));
aplicarMascara($("cpf"), mascaraCpf);
aplicarMascara($("telefone"), mascaraTelefone);
aplicarMascara($("matricula"), mascaraMatricula);

function ajustarFormato() {
  const auto = FORMATO_AUTO[$("disciplina").value];
  $("formato").value = auto || "";
  $("formato").disabled = Boolean(auto);
  $("ajuda-formato").textContent = auto
    ? "Definido pelo edital para esta disciplina."
    : "";
}
$("disciplina").addEventListener("change", ajustarFormato);

function limparErros() {
  $("alerta-geral").hidden = true;
  CAMPOS.forEach((c) => {
    $(c).classList.remove("is-erro");
    $(c).removeAttribute("aria-invalid");
    $(`erro-${c}`).hidden = true;
  });
}
function mostrarErro(campo, msg) {
  if (!$(campo) || !$(`erro-${campo}`)) return;
  $(campo).classList.add("is-erro");
  $(campo).setAttribute("aria-invalid", "true");
  $(`erro-${campo}`).textContent = msg;
  $(`erro-${campo}`).hidden = false;
}
function mostrarErros(erros) {
  Object.entries(erros).forEach(([c, m]) => mostrarErro(c, m));
  const primeiro = CAMPOS.find((c) => erros[c]);
  if (primeiro) $(primeiro).focus();
}
function estadoEnvio(ativo) {
  enviando = ativo;
  botao.disabled = ativo;
  botao.querySelector(".spinner-border").hidden = !ativo;
  $("texto-botao").textContent = ativo ? "Enviando…" : "Confirmar inscrição";
}
CAMPOS.forEach((c) =>
  $(c).addEventListener("input", () => {
    $(c).classList.remove("is-erro");
    $(`erro-${c}`).hidden = true;
  }),
);

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (enviando) return; // anti-duplo-clique
  limparErros();
  const valores = {
    nome: $("nome").value,
    email: $("email").value,
    telefone: $("telefone").value,
    cpf: $("cpf").value,
    matricula: $("matricula").value,
    curso: $("curso").value,
    instituicao: $("instituicao").value,
    disciplina: $("disciplina").value,
    formato: $("formato").value,
    aceite: $("aceite").checked,
  };
  const locais = validarInscricao(valores);
  if (Object.keys(locais).length) return mostrarErros(locais);

  estadoEnvio(true);
  const aviso = setTimeout(() => {
    $("alerta-espera").hidden = false;
  }, 6000); // servidor acordando
  try {
    const dados = {
      nome: valores.nome.trim(),
      email: valores.email.trim(),
      telefone: apenasDigitos(valores.telefone),
      cpf: apenasDigitos(valores.cpf),
      curso: valores.curso,
      disciplina: valores.disciplina,
    };
    const matricula = apenasDigitos(valores.matricula);
    if (matricula) dados.matricula = matricula; // opcional para participantes externos
    const instituicao = valores.instituicao.trim();
    if (instituicao) dados.instituicao = instituicao;
    if (!FORMATO_AUTO[valores.disciplina]) dados.formato = valores.formato; // nas APIExt o servidor define o formato
    const { aluno } = await inscrever(dados);
    $("msg-sucesso").textContent =
      `Inscrição confirmada, ${aluno.nome.split(" ")[0]}!`;
    $("formato-sucesso").textContent = FORMATOS[aluno.formato] || "";
    $("linha-formato").hidden = !FORMATOS[aluno.formato];
    $("datas-sucesso").textContent = EVENTO.datas;
    $("painel-form").hidden = true;
    $("painel-sucesso").hidden = false;
    $("painel-sucesso").focus();
    form.reset();
    ajustarFormato(); // não guardamos CPF nem outros dados no navegador
  } catch (erro) {
    if (!(erro instanceof ApiError)) throw erro;
    if (Object.keys(erro.campos).length)
      mostrarErros(erro.campos); // mensagens da API, sob cada campo
    else {
      $("alerta-geral").textContent = erro.mensagem;
      $("alerta-geral").hidden = false;
    } // inclui 403 fora do período
    if (erro.status === 0 || erro.status >= 500)
      mostrarToast(erro.mensagem, "erro");
  } finally {
    clearTimeout(aviso);
    $("alerta-espera").hidden = true;
    estadoEnvio(false);
  }
});

$("nova-inscricao").addEventListener("click", () => {
  $("painel-sucesso").hidden = true;
  $("painel-form").hidden = false;
  $("nome").focus();
});
