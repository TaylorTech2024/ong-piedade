// Autenticação da área administrativa por token JWT (header Authorization: Bearer <token>).
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config");
const { pool } = require("../db/pool");

function lerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(header.slice(7), jwtSecret, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

// Confere o usuário no banco a cada requisição: um admin desativado ou
// com perfil alterado perde o acesso na hora, sem esperar o token expirar.
function exigirLogin(...perfisPermitidos) {
  return async (req, res, next) => {
    const payload = lerToken(req);
    if (!payload) return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });

    const [rows] = await pool.query(
      `SELECT u.id, u.nome, u.email, u.ativo, p.nome AS perfil
       FROM usuarios_admin u JOIN perfis p ON p.id = u.perfil_id
       WHERE u.id = ?`,
      [payload.sub]
    );
    const usuario = rows[0];
    if (!usuario || !usuario.ativo) return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
    if (perfisPermitidos.length && !perfisPermitidos.includes(usuario.perfil)) {
      return res.status(403).json({ error: "Seu perfil não tem permissão para esta ação." });
    }
    req.usuario = usuario;
    next();
  };
}

function gerarToken(usuario) {
  return jwt.sign({ sub: usuario.id, perfil: usuario.perfil }, jwtSecret, { algorithm: "HS256", expiresIn: "8h" });
}

module.exports = { exigirLogin, gerarToken };
