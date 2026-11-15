// Navbar, rodapé e toasts reutilizáveis. Uso: montarLayout({ ativo: 'inicio' | 'certificado' | 'inscricao' | 'entrar' | '' })
import { EVENTO, SUPORTE, REDES, SITE } from "./config.js";

const A = "assets/";
const LINKS = [
  ["inicio", "index.html", "Início"],
  ["sobre", "index.html#sobre", "Sobre o evento"],
  ["programacao", "index.html#programacao", "Programação"],
  ["cronograma", "index.html#cronograma", "Cronograma"],
  ["certificado", "certificado.html", "Certificado"],
];

export function montarLayout({ ativo = "" } = {}) {
  // Link para pular ao conteúdo (acessibilidade para quem usa o teclado)
  const main = document.querySelector("main");
  if (main && !main.id) main.id = "conteudo";
  if (main && !document.querySelector(".pular")) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<a class="pular" href="#conteudo">Pular para o conteúdo</a>',
    );
  }

  const nav = document.getElementById("app-navbar");
  const rod = document.getElementById("app-rodape");
  if (nav) {
    const itens = LINKS.map(
      ([id, href, texto]) =>
        `<li><a class="nav-link ${ativo === id ? "ativo" : ""}" href="${href}">${texto}</a></li>`,
    ).join("");
    nav.innerHTML = `<nav class="navbar navbar-expand-xl jr-navbar" aria-label="Principal"><div class="container">
      <a class="navbar-brand d-flex align-items-center" href="index.html"><img src="${A}logo-uninassau-horizontal.png" alt="UNINASSAU Teresina"><span class="jr-sep"></span><img src="${A}logo-6-jornada-recorte.png" alt="Logo da VI Jornada Acadêmica"></a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu-nav" aria-controls="menu-nav" aria-expanded="false" aria-label="Abrir menu"><span class="navbar-toggler-icon"></span></button>
      <div class="collapse navbar-collapse" id="menu-nav"><ul class="navbar-nav ms-auto align-items-xl-center gap-xl-2">
        ${itens}
        <li><a class="nav-link ${ativo === "entrar" ? "ativo" : ""}" href="login.html"><i class="bi bi-box-arrow-in-right" aria-hidden="true"></i> Entrar</a></li>
      </ul></div></div></nav>`;
  }
  if (rod) {
    const usuario = REDES.instagram
      ? REDES.instagram.replace(/\/$/, "").split("/").pop()
      : "";
    const instagram = REDES.instagram
      ? `<a class="d-inline-flex align-items-center gap-2" href="${REDES.instagram}" target="_blank" rel="noopener"><i class="bi bi-instagram fs-4" aria-hidden="true"></i><span>@${usuario}</span></a>`
      : "";
    const suporte = SUPORTE.exemplo
      ? ""
      : `<div class="mt-2">${SUPORTE.email}<br><span class="text-nowrap">${SUPORTE.telefone}</span></div>`;
    rod.innerHTML = `<footer class="jr-rodape"><img class="jr-faixas esq" src="${A}faixas-vetoriais.png" alt="" aria-hidden="true"><img class="jr-faixas dir" src="${A}faixas-vetoriais.png" alt="" aria-hidden="true">
      <div class="container"><div class="row gy-3 align-items-center"><div class="col-lg-7">
        <div class="jr-placa"><img src="${A}logo-uninassau-horizontal.png" alt="UNINASSAU Teresina"><img src="${A}logo-6-jornada-recorte.png" alt="Logo da VI Jornada Acadêmica"></div>
        <p class="jr-lema">${EVENTO.lema}</p></div>
        <div class="col-lg-5 jr-contato"><div class="mb-2">${instagram}</div><div>${EVENTO.local}</div><a href="${SITE}">${SITE.replace("https://", "")}</a>${suporte}</div></div></div></footer>`;
  }
}

// Toast acessível. tipo: 'sucesso' | 'erro' | 'info'
export function mostrarToast(mensagem, tipo = "info", ms = 5000) {
  let c = document.querySelector(".jr-toasts");
  if (!c) {
    c = document.createElement("div");
    c.className = "jr-toasts";
    c.setAttribute("aria-live", "polite");
    document.body.append(c);
  }
  const t = document.createElement("div");
  t.className = `jr-alerta jr-alerta-${tipo}`;
  t.setAttribute("role", tipo === "erro" ? "alert" : "status");
  t.textContent = mensagem;
  c.append(t);
  setTimeout(() => t.remove(), ms);
}
