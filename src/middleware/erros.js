// Tratamento centralizado de erros: sempre responde JSON { error: "mensagem" }.
const { HttpError } = require("../utils/HttpError");

// eslint-disable-next-line no-unused-vars
function tratarErros(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });

  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON inválido no corpo da requisição." });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Requisição grande demais." });
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "O arquivo deve ter no máximo 10 MB." });
  if (err.name === "MulterError") return res.status(400).json({ error: "Envio de arquivo inválido." });

  if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Já existe um registro com esses dados (e-mail ou documento repetido)." });
  if (err.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ error: "Registro relacionado não encontrado." });
  if (err.code === "ER_ROW_IS_REFERENCED_2") return res.status(409).json({ error: "Este registro está em uso e não pode ser excluído." });

  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor. Tente novamente em instantes." });
}

module.exports = { tratarErros };
