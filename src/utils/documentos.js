// Validação de CPF e CNPJ pelos dígitos verificadores.
const soDigitos = (v) => String(v || "").replace(/\D/g, "");

function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(cpf[i]) * (t + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(cpf[t])) return false;
  }
  return true;
}

function cnpjValido(cnpj) {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base) => {
    let peso = base.length - 7;
    let soma = 0;
    for (const d of base) {
      soma += Number(d) * peso--;
      if (peso < 2) peso = 9;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(cnpj.slice(0, 12)) === Number(cnpj[12]) && calc(cnpj.slice(0, 13)) === Number(cnpj[13]);
}

module.exports = { soDigitos, cpfValido, cnpjValido };
