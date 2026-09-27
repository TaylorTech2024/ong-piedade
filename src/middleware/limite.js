// Limite de requisições por IP, em memória (protege login contra força bruta
// e os formulários públicos contra spam).
function limitar({ janelaMs, maximo, mensagem }) {
  const acessos = new Map();

  setInterval(() => {
    const agora = Date.now();
    for (const [ip, a] of acessos) if (a.fim <= agora) acessos.delete(ip);
  }, janelaMs).unref();

  return (req, res, next) => {
    const ip = req.ip || "desconhecido";
    const agora = Date.now();
    let a = acessos.get(ip);
    if (!a || a.fim <= agora) {
      a = { total: 0, fim: agora + janelaMs };
      acessos.set(ip, a);
    }
    a.total++;
    if (a.total > maximo) {
      res.set("Retry-After", String(Math.ceil((a.fim - agora) / 1000)));
      return res.status(429).json({ error: mensagem || "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    }
    next();
  };
}

module.exports = { limitar };
