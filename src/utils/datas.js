// Datas no fuso da ONG (Recife, UTC-3, sem horário de verão desde 2019).
const { fusoHorario } = require("../config");

// "AAAA-MM-DD" de hoje no fuso da ONG.
function hoje() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fusoHorario }).format(new Date());
}

// Início do mês atual (meia-noite em Recife) como Date em UTC.
function inicioDoMes() {
  const [ano, mes] = hoje().split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, 1, 3, 0, 0));
}

module.exports = { hoje, inicioDoMes };
