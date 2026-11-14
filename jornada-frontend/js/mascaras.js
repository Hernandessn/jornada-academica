// Máscaras de digitação. O back-end aceita com ou sem máscara; enviamos só dígitos.
export const apenasDigitos = (v) => String(v).replace(/\D/g, "");

export function mascaraCpf(v) {
  const d = apenasDigitos(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function mascaraTelefone(v) {
  const d = apenasDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const mascaraMatricula = (v) => apenasDigitos(v).slice(0, 20);

export function aplicarMascara(input, funcao) {
  input.addEventListener("input", () => {
    input.value = funcao(input.value);
  });
}
