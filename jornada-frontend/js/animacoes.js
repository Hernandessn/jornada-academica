// Animações de rolagem com a biblioteca AOS (https://aos-animate.vercel.app/).
// Só é ativada se a biblioteca carregar por completo; se falhar, o site aparece normalmente.
const AOS_VERSAO = "2.3.1";
const ALVOS = [
  [".sobre h2, .sobre-texto p, .sobre h3", "fade-up", false],
  [".passos li", "fade-up", true],
  [".doacao-card", "zoom-in", false],
  [".bloco > h2", "fade-up", false],
  ["#programacao .jr-card, #cronograma .jr-card", "fade-up", true],
  [".insc-card, .login-card", "fade-up", false],
];

function marcarElementos() {
  ALVOS.forEach(([seletor, efeito, escalonar]) => {
    document.querySelectorAll(seletor).forEach((el, i) => {
      el.setAttribute("data-aos", efeito);
      if (escalonar) el.setAttribute("data-aos-delay", String((i % 4) * 100));
    });
  });
}

function carregar(tag, atributos) {
  return new Promise((ok, falha) => {
    const el = document.createElement(tag);
    Object.assign(el, atributos);
    el.onload = ok;
    el.onerror = falha;
    document.head.append(el);
  });
}

async function iniciar() {
  const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduzir || document.querySelector(".topo-painel")) return;
  const base = `https://unpkg.com/aos@${AOS_VERSAO}/dist/`;
  try {
    await carregar("script", { src: `${base}aos.js` });
    await carregar("link", { rel: "stylesheet", href: `${base}aos.css` });
    if (!window.AOS) return;
    marcarElementos(); // só depois de tudo carregado: assim nada fica escondido por engano
    window.AOS.init({
      duration: 700,
      easing: "ease-out-cubic",
      once: true,
      offset: 60,
    });
  } catch {
    /* sem animações: o conteúdo continua visível */
  }
}
iniciar();
