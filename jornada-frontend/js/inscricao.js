import { CURSOS, EVENTO, RESUMO_MAX } from "./config.js";
import { montarLayout, mostrarToast } from "./layout.js";
import { inscrever, acordarServidor, ApiError } from "./api.js";
import {
  aplicarMascara,
  mascaraCpf,
  mascaraTelefone,
  mascaraMatricula,
  apenasDigitos,
} from "./mascaras.js";
import {
  validarInscricao,
  validarArquivo,
  tamanhoResumo,
  formatarTamanho,
  OUTROS,
} from "./validacao.js";

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
  "curso_outro",
  "instituicao",
  "disciplina",
  "formato",
  "resumo",
  "aceite",
  "arquivo",
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

const tipoAtual = () =>
  document.querySelector('input[name="tipo"]:checked').value;
function preencher(select, pares) {
  pares.forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    select.append(o);
  });
}
preencher($("curso"), [...CURSOS.map((c) => [c, c]), [OUTROS, "Outros"]]);
preencher(
  $("disciplina"),
  DISCIPLINAS.map((d) => [d, d]),
);
preencher($("formato"), Object.entries(FORMATOS));
aplicarMascara($("cpf"), mascaraCpf);
aplicarMascara($("telefone"), mascaraTelefone);
aplicarMascara($("matricula"), mascaraMatricula);

function ajustarTipo() {
  const externo = tipoAtual() === "externo";
  $("campo-matricula").hidden = externo; // público externo não informa matrícula
  $("campo-instituicao").hidden = !externo;
  if (externo) $("matricula").value = "";
  else $("instituicao").value = "";
}
function atualizarContador() {
  const n = tamanhoResumo($("resumo").value);
  $("contador-resumo").textContent = `${n}/${RESUMO_MAX}`;
  // Aviso para leitor de tela só perto do limite (evita falar a cada tecla)
  const restante = RESUMO_MAX - n;
  $("aviso-resumo").textContent =
    restante <= 0
      ? "Limite de caracteres atingido."
      : restante <= 100 && restante % 50 === 0
        ? `Restam ${restante} caracteres.`
        : "";
}
function mostrarArquivo() {
  const f = $("arquivo").files[0];
  $("arquivo-escolhido").hidden = !f;
  $("arquivo-nome").textContent = f
    ? `${f.name} (${formatarTamanho(f.size)})`
    : "";
}
function limparArquivo() {
  $("arquivo").value = "";
  mostrarArquivo();
}
$("resumo").addEventListener("input", atualizarContador);
$("arquivo").addEventListener("change", () => {
  const f = $("arquivo").files[0];
  const erro = f ? validarArquivo(f) : "";
  if (erro) {
    limparArquivo(); // não mantém um arquivo inválido selecionado
    mostrarErro("arquivo", erro);
    return;
  }
  mostrarArquivo();
});
$("remover-arquivo").addEventListener("click", () => {
  limparArquivo();
  $("arquivo").focus();
});

function ajustarCurso() {
  const outros = $("curso").value === OUTROS;
  $("campo-curso-outro").hidden = !outros;
  if (!outros) $("curso_outro").value = "";
}
function ajustarFormato() {
  const auto = FORMATO_AUTO[$("disciplina").value];
  $("formato").value = auto || "";
  $("formato").disabled = Boolean(auto);
  $("ajuda-formato").textContent = auto
    ? "Definido pelo edital para esta disciplina."
    : "";
}
document
  .querySelectorAll('input[name="tipo"]')
  .forEach((r) => r.addEventListener("change", ajustarTipo));
$("curso").addEventListener("change", ajustarCurso);
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
  if (campo === "curso" && $("curso").value === OUTROS) campo = "curso_outro";
  const el = $(campo);
  if (!el || !$(`erro-${campo}`)) return;
  if (el.closest("[hidden]")) {
    // campo oculto: a mensagem vai para o aviso do topo
    $("alerta-geral").textContent = `Não foi possível concluir: ${msg}`;
    $("alerta-geral").hidden = false;
    return;
  }
  el.classList.add("is-erro");
  el.setAttribute("aria-invalid", "true");
  $(`erro-${campo}`).textContent = msg;
  $(`erro-${campo}`).hidden = false;
}
function mostrarErros(erros) {
  Object.entries(erros).forEach(([c, m]) => mostrarErro(c, m));
  const primeiro = CAMPOS.find((c) => erros[c] && !$(c).closest("[hidden]"));
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
    tipo: tipoAtual(),
    nome: $("nome").value,
    email: $("email").value,
    telefone: $("telefone").value,
    cpf: $("cpf").value,
    matricula: $("matricula").value,
    curso: $("curso").value,
    cursoOutro: $("curso_outro").value,
    instituicao: $("instituicao").value,
    disciplina: $("disciplina").value,
    formato: $("formato").value,
    resumo: $("resumo").value,
    arquivo: $("arquivo").files[0] || null,
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
      tipo: valores.tipo, // "aluno" (matrícula obrigatória) ou "externo" (matrícula ignorada)
      nome: valores.nome.trim(),
      email: valores.email.trim(),
      telefone: apenasDigitos(valores.telefone),
      cpf: apenasDigitos(valores.cpf),
      disciplina: valores.disciplina,
      curso:
        valores.curso === OUTROS ? valores.cursoOutro.trim() : valores.curso,
    };
    if (valores.tipo === "aluno")
      dados.matricula = apenasDigitos(valores.matricula);
    if (valores.tipo === "externo")
      dados.instituicao = valores.instituicao.trim();
    if (!FORMATO_AUTO[valores.disciplina]) dados.formato = valores.formato; // nas APIExt o servidor define o formato
    dados.resumo = valores.resumo.trim();
    // Com arquivo: uma única requisição multipart (inscrição e arquivo juntos).
    // O corpo é montado campo a campo (sem new FormData(form)) para não enviar CRLF nem campos extras.
    let corpo = dados;
    if (valores.arquivo) {
      corpo = new FormData();
      Object.entries(dados).forEach(([k, v]) => corpo.append(k, v));
      corpo.append("arquivo", valores.arquivo, valores.arquivo.name);
    }
    const { aluno } = await inscrever(corpo);
    $("msg-sucesso").textContent =
      `Inscrição confirmada, ${aluno.nome.split(" ")[0]}!`;
    $("formato-sucesso").textContent = FORMATOS[aluno.formato] || "";
    $("linha-formato").hidden = !FORMATOS[aluno.formato];
    const recebidos = [
      aluno.tem_resumo ? "o resumo" : "",
      aluno.tem_arquivo ? "o arquivo" : "",
    ].filter(Boolean);
    $("linha-recebido").textContent = recebidos.length
      ? `Recebemos ${recebidos.join(" e ")} do seu trabalho.`
      : "";
    $("linha-recebido").hidden = !recebidos.length;
    $("datas-sucesso").textContent = EVENTO.datas;
    $("painel-form").hidden = true;
    $("painel-sucesso").hidden = false;
    $("painel-sucesso").focus();
    form.reset();
    ajustarTipo();
    ajustarCurso();
    ajustarFormato(); // não guardamos CPF nem outros dados no navegador
    mostrarArquivo();
    atualizarContador();
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
