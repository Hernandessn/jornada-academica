// Sessão do professor/admin. O token fica só no sessionStorage (some ao fechar a aba).
const TOKEN = "jr_token";
const DADOS = "jr_sessao";

export function salvarSessao({ token, usuario }) {
  sessionStorage.setItem(TOKEN, token);
  sessionStorage.setItem(
    DADOS,
    JSON.stringify({ nome: usuario.nome, papel: usuario.papel }),
  );
}

function tokenExpirado() {
  try {
    const payload = sessionStorage
      .getItem(TOKEN)
      .split(".")[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    return JSON.parse(atob(payload)).exp * 1000 < Date.now();
  } catch {
    return false; // sem como ler: o servidor decide (401)
  }
}

export function sessao() {
  try {
    const dados = JSON.parse(sessionStorage.getItem(DADOS));
    return dados && sessionStorage.getItem(TOKEN) ? dados : null;
  } catch {
    return null;
  }
}

export function sair(aviso) {
  sessionStorage.clear();
  location.href = "login.html" + (aviso ? `?${aviso}=1` : "");
}

// Use no início de cada página protegida. Devolve a sessão ou null (e já redireciona).
export function exigirPapel(papeis) {
  const s = sessao();
  if (!s || !papeis.includes(s.papel)) return (sair(), null);
  if (tokenExpirado()) return (sair("expirou"), null);
  return s;
}
