import { login, acordarServidor, ApiError } from "./api.js";
import { salvarSessao, sessao } from "./auth.js";
import { montarLayout } from "./layout.js";

montarLayout({ ativo: "entrar" });
acordarServidor();

const DESTINO = { professor: "professor.html", admin: "admin.html" };
const ir = (s) => {
  location.href = DESTINO[s.papel] || "index.html";
};
const $ = (id) => document.getElementById(id);
let enviando = false;

const atual = sessao();
if (atual) ir(atual);
if (new URLSearchParams(location.search).has("expirou"))
  $("aviso").hidden = false;

function erro(campo, msg) {
  $(campo).classList.add("is-erro");
  $(`erro-${campo}`).textContent = msg;
  $(`erro-${campo}`).hidden = false;
}

$("form-login").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (enviando) return;
  ["email", "senha"].forEach((c) => {
    $(c).classList.remove("is-erro");
    $(`erro-${c}`).hidden = true;
  });
  $("alerta-geral").hidden = true;
  const email = $("email").value.trim();
  const senha = $("senha").value;
  if (!email) return (erro("email", "Informe seu e-mail."), $("email").focus());
  if (!senha) return (erro("senha", "Informe sua senha."), $("senha").focus());

  enviando = true;
  $("botao").disabled = true;
  $("botao").querySelector(".spinner-border").hidden = false;
  $("texto-botao").textContent = "Entrando…";
  try {
    const r = await login(email, senha);
    salvarSessao(r);
    ir(r.usuario);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (Object.keys(e.campos).length)
      Object.entries(e.campos).forEach(([c, m]) => $(c) && erro(c, m));
    else {
      $("alerta-geral").textContent = e.mensagem;
      $("alerta-geral").hidden = false;
    }
  } finally {
    enviando = false;
    $("botao").disabled = false;
    $("botao").querySelector(".spinner-border").hidden = true;
    $("texto-botao").textContent = "Entrar";
  }
});
