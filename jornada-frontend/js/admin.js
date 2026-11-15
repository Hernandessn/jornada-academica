import { exigirPapel, sair, sessao as sessaoAtual } from "./auth.js";
import {
  lerConfiguracoes,
  salvarConfiguracoes,
  resumoFrequencia,
  emitirCertificados,
  ApiError,
} from "./api.js";
import { mostrarToast } from "./layout.js";

// Professor que cair aqui vai para a página dele, em vez de ser deslogado.
if (sessaoAtual()?.papel === "professor") location.href = "professor.html";
const sessao = exigirPapel(["admin"]);

const $ = (id) => document.getElementById(id);
const CAMPOS = [
  "modo_aprovacao",
  "valor_minimo",
  "inscricoes_de",
  "inscricoes_ate",
  "certificados_a_partir_de",
  "reitora_nome",
  "coordenador_nome",
];
const DATAS = ["inscricoes_de", "inscricoes_ate", "certificados_a_partir_de"];
const ICONES = {
  sucesso: "bi-check-circle-fill",
  info: "bi-info-circle-fill",
  erro: "bi-exclamation-triangle-fill",
};
const num = (n) =>
  Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
let atual = null,
  cargaTotal = 0,
  elegiveis = 0,
  salvando = false,
  emitindo = false;

function erroGeral(msg) {
  $("alerta-geral").textContent = msg;
  $("alerta-geral").hidden = false;
}
function tratarErro(e) {
  if (!(e instanceof ApiError)) throw e;
  erroGeral(e.mensagem);
}

function limparErros() {
  $("alerta-geral").hidden = true;
  CAMPOS.forEach((c) => {
    $(c).classList.remove("is-erro");
    $(c).removeAttribute("aria-invalid");
    $(`erro-${c}`).hidden = true;
  });
}
function erroCampo(c, msg) {
  if (!$(c) || !$(`erro-${c}`)) return;
  $(c).classList.add("is-erro");
  $(c).setAttribute("aria-invalid", "true");
  $(`erro-${c}`).textContent = msg;
  $(`erro-${c}`).hidden = false;
}
function mostrarErros(erros) {
  Object.entries(erros).forEach(([c, m]) => erroCampo(c, m));
  const primeiro = CAMPOS.find((c) => erros[c]);
  if (primeiro) $(primeiro).focus();
}

function dica() {
  const modo = $("modo_aprovacao").value;
  const v = Number($("valor_minimo").value);
  let t = "";
  if (cargaTotal && v > 0) {
    if (modo === "percentual")
      t = `≈ ${num((v / 100) * cargaTotal)} h de ${num(cargaTotal)} h de sessões`;
    else
      t =
        v > cargaTotal
          ? `Atenção: o mínimo é maior que a soma das sessões (${num(cargaTotal)} h). Ninguém seria aprovado.`
          : `Soma das sessões: ${num(cargaTotal)} h`;
  }
  $("dica-valor").textContent = t;
}

function preencher(c) {
  atual = c;
  CAMPOS.forEach((id) => {
    $(id).value = DATAS.includes(id)
      ? String(c[id] ?? "").slice(0, 10)
      : (c[id] ?? "");
  });
  $("ignorar_datas").checked = Boolean(c.ignorar_datas);
  $("aviso-teste").hidden = !c.ignorar_datas;
  $("regra").textContent =
    c.modo_aprovacao === "horas"
      ? `Mínimo de ${num(c.valor_minimo)} h`
      : `Mínimo de ${num(c.valor_minimo)}%`;
  dica();
}

function validar(d) {
  const e = {};
  if (!(d.valor_minimo > 0))
    e.valor_minimo = "Informe um número maior que zero.";
  else if (d.modo_aprovacao === "percentual" && d.valor_minimo > 100)
    e.valor_minimo = "No modo percentual, o máximo é 100.";
  DATAS.forEach((c) => {
    if (!d[c]) e[c] = "Informe a data.";
  });
  if (
    !e.inscricoes_de &&
    !e.inscricoes_ate &&
    d.inscricoes_ate < d.inscricoes_de
  )
    e.inscricoes_ate = "O fim não pode ser anterior ao início.";
  if (!d.reitora_nome) e.reitora_nome = "Informe o nome da reitora.";
  return e;
}

function atualizarEmissao() {
  $("elegiveis").textContent = elegiveis;
  $("texto-emissao").textContent = elegiveis
    ? `${elegiveis} aluno(s) elegível(is) pela regra atual. Quem já recebeu é pulado. O envio dos e-mails não pode ser desfeito.`
    : "Nenhum aluno elegível pela regra atual.";
  $("simular").disabled = emitindo;
  $("emitir").disabled = emitindo || elegiveis === 0;
}

async function carregarResumo() {
  try {
    const r = await resumoFrequencia();
    cargaTotal = r.carga_horaria_total;
    elegiveis = r.total_elegiveis;
    $("total").textContent = r.total_alunos;
  } catch (e) {
    tratarErro(e);
  }
  atualizarEmissao();
  dica();
}

function mostrarEmissao(tipo, texto, falhas = []) {
  const caixa = document.createElement("div");
  caixa.className = `jr-alerta jr-alerta-${tipo}`;
  const icone = document.createElement("i");
  icone.className = `bi ${ICONES[tipo]}`;
  icone.setAttribute("aria-hidden", "true");
  const corpo = document.createElement("div");
  const p = document.createElement("p");
  p.className = "mb-0";
  p.textContent = texto;
  corpo.append(p);
  if (falhas.length) {
    const ul = document.createElement("ul");
    ul.className = "mb-0 mt-2";
    falhas.forEach((f) => {
      const li = document.createElement("li");
      li.textContent = `${f.nome}: ${f.motivo}`;
      ul.append(li);
    });
    corpo.append(ul);
  }
  caixa.append(icone, corpo);
  $("resultado-emissao").replaceChildren(caixa);
}

async function executarEmissao(simular) {
  if (emitindo) return; // anti-duplo-clique
  if (
    !simular &&
    !confirm(
      `Emitir e enviar os certificados para quem ainda não recebeu (${elegiveis} elegível(is) pela regra atual)? O envio dos e-mails não pode ser desfeito.`,
    )
  )
    return;
  emitindo = true;
  $("simular").disabled = true;
  $("emitir").disabled = true;
  $("resultado-emissao").replaceChildren();
  $("texto-emissao").textContent = simular
    ? "Simulando…"
    : "Emitindo… isso pode levar alguns minutos. Não feche esta página.";
  try {
    const r = await emitirCertificados(simular ? { simular: true } : {});
    const falhas = Array.isArray(r.falhas) ? r.falhas : [];
    if (simular)
      mostrarEmissao(
        "info",
        `Simulação: ${r.emitidos} receberiam agora e ${r.ja_enviados} já receberam. Nada foi enviado.`,
      );
    else
      mostrarEmissao(
        falhas.length ? "erro" : "sucesso",
        `Emissão concluída: ${r.enviados} enviado(s), ${r.ja_enviados} já tinham recebido${falhas.length ? `, ${falhas.length} falha(s) (serão tentadas na próxima emissão)` : ""}.`,
        falhas,
      );
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    mostrarEmissao(
      "erro",
      e.status === 0
        ? "A conexão expirou, mas o servidor pode ter continuado o envio. Aguarde um pouco e use Simular para conferir quantos já receberam."
        : e.status === 503
          ? "O envio de e-mail não está configurado no servidor."
          : e.mensagem,
    );
  } finally {
    emitindo = false;
    await carregarResumo(); // atualiza os números e reabilita os botões
  }
}

$("modo_aprovacao").addEventListener("change", dica);
$("valor_minimo").addEventListener("input", dica);
CAMPOS.forEach((c) =>
  $(c).addEventListener("input", () => {
    $(c).classList.remove("is-erro");
    $(`erro-${c}`).hidden = true;
  }),
);
$("sair").addEventListener("click", () => sair());
$("simular").addEventListener("click", () => executarEmissao(true));
$("emitir").addEventListener("click", () => executarEmissao(false));

$("form-config").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (salvando) return; // anti-duplo-clique
  limparErros();
  const dados = {
    modo_aprovacao: $("modo_aprovacao").value,
    valor_minimo: Number($("valor_minimo").value),
    inscricoes_de: $("inscricoes_de").value,
    inscricoes_ate: $("inscricoes_ate").value,
    certificados_a_partir_de: $("certificados_a_partir_de").value,
    ignorar_datas: $("ignorar_datas").checked,
    coordenador_nome: $("coordenador_nome").value.trim(),
    reitora_nome: $("reitora_nome").value.trim(),
  };
  const erros = validar(dados);
  if (Object.keys(erros).length) return mostrarErros(erros);
  if (
    dados.ignorar_datas &&
    !atual?.ignorar_datas &&
    !confirm(
      "Ligar o modo de teste faz o sistema ignorar as datas de inscrição e de certificado. Use apenas para testes. Continuar?",
    )
  )
    return;

  salvando = true;
  $("salvar").disabled = true;
  $("salvar").querySelector(".spinner-border").hidden = false;
  $("texto-salvar").textContent = "Salvando…";
  try {
    preencher(await salvarConfiguracoes(dados));
    await carregarResumo(); // a regra pode ter mudado quem é elegível
    mostrarToast("Configurações salvas.", "sucesso");
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (Object.keys(e.campos).length) mostrarErros(e.campos);
    else erroGeral(e.mensagem);
  } finally {
    salvando = false;
    $("salvar").disabled = false;
    $("salvar").querySelector(".spinner-border").hidden = true;
    $("texto-salvar").textContent = "Salvar configurações";
  }
});

async function iniciar() {
  $("nome-usuario").textContent = sessao.nome;
  try {
    preencher(await lerConfiguracoes());
  } catch (e) {
    tratarErro(e);
  }
  await carregarResumo();
}
if (sessao) iniciar();
