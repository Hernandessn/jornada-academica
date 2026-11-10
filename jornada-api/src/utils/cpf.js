// Utilidades de CPF e de campos numéricos. Sem dependências externas.

function somenteDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

// Valida os dois dígitos verificadores (aceita com ou sem máscara).
function cpfValido(cpf) {
  const d = somenteDigitos(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // 111.111.111-11 etc. passam na conta, mas são inválidos

  const digitoVerificador = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) {
      soma += Number(base[i]) * (base.length + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return (
    digitoVerificador(d.slice(0, 9)) === Number(d[9]) &&
    digitoVerificador(d.slice(0, 10)) === Number(d[10])
  );
}

// 52998224725 -> ***.982.247-**  (LGPD: nunca devolver o CPF inteiro em listas)
function mascararCpf(cpf) {
  const d = somenteDigitos(cpf);
  if (d.length !== 11) return '***.***.***-**';
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

// Telefone: guarda só dígitos e remove o código do país (55), se vier.
function normalizarTelefone(valor) {
  let d = somenteDigitos(valor);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return d;
}

module.exports = { somenteDigitos, cpfValido, mascararCpf, normalizarTelefone };
