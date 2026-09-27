// Erro com status HTTP: lançado pelas rotas e convertido em JSON pelo middleware de erros.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const erro = {
  requisicao: (msg) => new HttpError(400, msg),
  naoEncontrado: (msg = "Registro não encontrado.") => new HttpError(404, msg),
  conflito: (msg) => new HttpError(409, msg),
};

module.exports = { HttpError, erro };
