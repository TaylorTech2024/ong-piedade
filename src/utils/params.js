const { erro } = require("./HttpError");

// Converte o :id da URL em número inteiro positivo (404 se inválido).
function idParam(req, nome = "id") {
  const id = Number(req.params[nome]);
  if (!Number.isInteger(id) || id <= 0) throw erro.naoEncontrado();
  return id;
}

// Monta "coluna = ?" apenas com os campos enviados (edições parciais).
function montarUpdate(dados, colunas) {
  const partes = [];
  const valores = [];
  for (const [campo, coluna] of Object.entries(colunas)) {
    if (campo in dados) {
      partes.push(`${coluna} = ?`);
      valores.push(dados[campo]);
    }
  }
  return { sql: partes.join(", "), valores };
}

module.exports = { idParam, montarUpdate };
