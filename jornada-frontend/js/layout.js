// Navbar, rodapé e toasts reutilizáveis. Uso: montarLayout({ ativo: 'inicio' | 'certificado' | '' })
import { EVENTO, SUPORTE, REDES, SITE } from './config.js';
const A = 'assets/';
export function montarLayout({ ativo = '' } = {}) {
  const nav = document.getElementById('app-navbar'), rod = document.getElementById('app-rodape');
  if (nav) nav.innerHTML = `<nav class="navbar navbar-expand-lg jr-navbar" aria-label="Principal"><div class="container">
    <a class="navbar-brand d-flex align-items-center" href="index.html"><img src="${A}logo-uninassau-horizontal.png" alt="UNINASSAU Teresina"><span class="jr-sep"></span><img src="${A}logo-6-jornada-recorte.png" alt="6ª Jornada Acadêmica"></a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#menu-nav" aria-controls="menu-nav" aria-expanded="false" aria-label="Abrir menu"><span class="navbar-toggler-icon"></span></button>
    <div class="collapse navbar-collapse" id="menu-nav"><ul class="navbar-nav ms-auto align-items-lg-center gap-lg-3">
      <li><a class="nav-link ${ativo === 'inicio' ? 'ativo' : ''}" href="index.html">Início</a></li>
      <li><a class="nav-link" href="index.html#sobre">Sobre o evento</a></li>
      <li><a class="nav-link ${ativo === 'certificado' ? 'ativo' : ''}" href="certificado.html">Certificado</a></li>
      <li class="mt-2 mt-lg-0"><a class="jr-btn jr-btn-cta" href="inscricao.html"><i class="bi bi-person-plus" aria-hidden="true"></i>Inscreva-se</a></li>
    </ul></div></div></nav>`;
  if (rod) {
    const redes = [['instagram', REDES.instagram, 'Instagram'], ['youtube', REDES.youtube, 'YouTube'], ['linkedin', REDES.linkedin, 'LinkedIn']]
      .filter(r => r[1]).map(r => `<a href="${r[1]}" aria-label="${r[2]}" class="fs-4 me-2"><i class="bi bi-${r[0]}"></i></a>`).join('');
    rod.innerHTML = `<footer class="jr-rodape"><img class="jr-faixas esq" src="${A}faixas-vetoriais.png" alt="" aria-hidden="true"><img class="jr-faixas dir" src="${A}faixas-vetoriais.png" alt="" aria-hidden="true">
      <div class="container"><div class="row gy-3 align-items-center"><div class="col-lg-7">
        <div class="jr-placa"><img src="${A}logo-uninassau-horizontal.png" alt="UNINASSAU Teresina"><img src="${A}logo-6-jornada-recorte.png" alt="6ª Jornada Acadêmica"></div>
        <p class="jr-lema">${EVENTO.lema}</p></div>
        <div class="col-lg-5 jr-contato"><div class="mb-2">${redes}</div><div>${EVENTO.local}</div><a href="${SITE}">${SITE.replace('https://', '')}</a>
        <div class="mt-2">${SUPORTE.email}<br><span class="text-nowrap">${SUPORTE.telefone}</span>${SUPORTE.exemplo ? ' (exemplo)' : ''}</div>
        <a class="d-inline-block mt-2" href="login.html">Acesso da equipe</a></div></div></div></footer>`;
  }
}
// Toast acessível. tipo: 'sucesso' | 'erro' | 'info'
export function mostrarToast(mensagem, tipo = 'info', ms = 5000) {
  let c = document.querySelector('.jr-toasts');
  if (!c) { c = document.createElement('div'); c.className = 'jr-toasts'; c.setAttribute('aria-live', 'polite'); document.body.append(c); }
  const t = document.createElement('div'); t.className = `jr-alerta jr-alerta-${tipo}`; t.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  t.textContent = mensagem; c.append(t); setTimeout(() => t.remove(), ms);
}
