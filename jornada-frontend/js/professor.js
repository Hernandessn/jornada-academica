import { exigirPapel, sair } from "./auth.js";
import {
  listarEventos,
  listarAlunos,
  registrarPresenca,
  resumoFrequencia,
  ApiError,
} from "./api.js";
import { mostrarToast } from "./layout.js";

const sessao = exigirPapel(["professor", "admin"]);
const $ = (id) => document.getElementById(id);
const selecionados = new Set();
let eventoId = null,
  alunos = [],
  idsCpf = null,
  enviando = false,
  temporizador;

const norm = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const fmtData = (d) => d.split("-").reverse().join("/"); // sem new Date: evita mudar o dia por fuso
const num = (n) =>
  Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function erroGeral(msg) {
  $("alerta-geral").textContent = msg;
  $("alerta-geral").hidden = false;
}
function tratarErro(e) {
  if (!(e instanceof ApiError)) throw e;
  erroGeral(e.mensagem);
}

function visiveis() {
  const t = norm($("busca").value.trim());
  if (!t) return alunos;
  const d = t.replace(/\D/g, "");
  return alunos.filter(
    (a) =>
      norm(a.nome).includes(t) ||
      (d && String(a.matricula).includes(d)) ||
      idsCpf?.has(a.id),
  );
}

function contar() {
  const n = [...selecionados].filter((id) =>
    alunos.some((a) => a.id === id && !a.presente),
  ).length;
  $("contador").textContent = n
    ? `${n} selecionado(s)`
    : "Nenhum aluno selecionado";
  $("salvar").disabled = enviando || n === 0;
  return n;
}

function desenhar() {
  const lista = visiveis();
  $("linhas").replaceChildren();
  lista.forEach((a) => {
    const tr = document.createElement("tr");
    const tdc = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "jr-check";
    cb.setAttribute("aria-label", `Selecionar ${a.nome}`);
    cb.checked = a.presente || selecionados.has(a.id);
    cb.disabled = a.presente; // a API não desfaz presença
    cb.addEventListener("change", () => {
      cb.checked ? selecionados.add(a.id) : selecionados.delete(a.id);
      contar();
    });
    tdc.append(cb);
    tr.append(tdc);
    [
      ["Nome", a.nome],
      ["Matrícula", a.matricula],
      ["Curso", a.curso],
    ].forEach(([r, t]) => {
      const td = document.createElement("td");
      td.dataset.rotulo = r;
      td.textContent = t;
      tr.append(td);
    });
    const tds = document.createElement("td");
    tds.dataset.rotulo = "Presença";
    const selo = document.createElement("span");
    selo.className = `jr-selo ${a.presente ? "jr-selo-presente" : "jr-selo-pendente"}`;
    selo.textContent = a.presente ? "Presente" : "Pendente";
    tds.append(selo);
    tr.append(tds);
    $("linhas").append(tr);
  });
  $("tabela").hidden = !lista.length;
  $("vazio").hidden = Boolean(lista.length) || !$("carregando").hidden;
  $("total").textContent = alunos.length;
  $("presentes").textContent = alunos.filter((a) => a.presente).length;
  contar();
}

async function carregarAlunos() {
  $("carregando").hidden = false;
  $("tabela").hidden = true;
  $("vazio").hidden = true;
  try {
    alunos = (await listarAlunos(eventoId)).alunos;
  } catch (e) {
    alunos = [];
    tratarErro(e);
  }
  selecionados.clear();
  $("carregando").hidden = true;
  desenhar();
}

function mostrarRegra(r) {
  if (!r) return ($("regra").textContent = "Indisponível");
  const { modo_aprovacao: modo, valor_minimo: v } = r.configuracao;
  $("regra").textContent =
    modo === "horas"
      ? `Mínimo de ${num(v)} h`
      : `Mínimo de ${num(v)}% (≈ ${num((v / 100) * r.carga_horaria_total)} h de ${num(r.carga_horaria_total)} h)`;
}

async function buscarCpf() {
  idsCpf = null;
  const t = $("busca").value.trim();
  if (/^[\d.\-\s]{3,}$/.test(t)) {
    // só números e pontuação: a API busca por CPF
    try {
      idsCpf = new Set(
        (await listarAlunos(eventoId, t)).alunos.map((a) => a.id),
      );
    } catch {
      /* segue só com o filtro local */
    }
  }
  desenhar();
}

$("busca").addEventListener("input", () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(buscarCpf, 300);
});
$("sessao").addEventListener("change", () => {
  eventoId = Number($("sessao").value);
  $("busca").value = "";
  idsCpf = null;
  carregarAlunos();
});
$("sair").addEventListener("click", () => sair());
$("marcar-todos").addEventListener("click", () => {
  const pendentes = visiveis().filter((a) => !a.presente);
  const todos =
    pendentes.length > 0 && pendentes.every((a) => selecionados.has(a.id));
  pendentes.forEach((a) =>
    todos ? selecionados.delete(a.id) : selecionados.add(a.id),
  );
  desenhar();
});

$("salvar").addEventListener("click", async () => {
  if (enviando) return; // anti-duplo-clique
  const ids = [...selecionados].filter((id) =>
    alunos.some((a) => a.id === id && !a.presente),
  );
  if (
    !ids.length ||
    !confirm(
      `Registrar presença de ${ids.length} aluno(s) nesta sessão? Não é possível desfazer por aqui.`,
    )
  )
    return;
  enviando = true;
  $("alerta-geral").hidden = true;
  $("salvar").disabled = true;
  $("salvar").querySelector(".spinner-border").hidden = false;
  const feitos = new Set();
  let novos = 0,
    ja = 0,
    falhas = 0;
  for (const [i, id] of ids.entries()) {
    $("contador").textContent = `Registrando ${i + 1} de ${ids.length}…`;
    try {
      const r = await registrarPresenca(id, eventoId);
      r.ja_registrada ? ja++ : novos++;
      feitos.add(id);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      falhas++;
      if (e.status === 429 || e.status === 0) {
        erroGeral(`${e.mensagem} Os alunos que faltam continuam selecionados.`);
        break;
      }
      erroGeral(e.mensagem);
    }
  }
  enviando = false;
  $("salvar").querySelector(".spinner-border").hidden = true;
  await carregarAlunos(); // mostra o que o servidor realmente gravou
  ids.filter((id) => !feitos.has(id)).forEach((id) => selecionados.add(id));
  desenhar();
  mostrarToast(
    `${novos} registrada(s), ${ja} já estavam registradas${falhas ? `, ${falhas} não registrada(s)` : ""}.`,
    falhas ? "erro" : "sucesso",
  );
});

async function iniciar() {
  $("nome-usuario").textContent = sessao.nome;
  try {
    const [ev, resumo] = await Promise.all([
      listarEventos(),
      resumoFrequencia().catch(() => null),
    ]);
    mostrarRegra(resumo);
    ev.eventos.forEach((e) => {
      const o = document.createElement("option");
      const horas =
        e.hora_inicio && e.hora_fim
          ? ` (${e.hora_inicio.slice(0, 5)} às ${e.hora_fim.slice(0, 5)})`
          : "";
      o.value = e.id;
      o.textContent = `${e.titulo}${horas}`;
      $("sessao").append(o);
    });
    const padrao = ev.eventos.find((e) => e.data === hoje()) || ev.eventos[0];
    if (!padrao) {
      $("carregando").hidden = true;
      return erroGeral("Nenhuma sessão cadastrada.");
    }
    $("sessao").value = padrao.id;
    eventoId = padrao.id;
    await carregarAlunos();
  } catch (e) {
    $("carregando").hidden = true;
    tratarErro(e);
  }
}
if (sessao) iniciar();
