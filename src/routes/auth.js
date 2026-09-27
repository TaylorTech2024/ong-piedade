// Login da área administrativa (RF14).
const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db/pool");
const { exigirLogin, gerarToken } = require("../middleware/auth");
const { limitar } = require("../middleware/limite");

const router = express.Router();

const limiteLogin = limitar({
  janelaMs: 15 * 60 * 1000,
  maximo: 10,
  mensagem: "Muitas tentativas de login. Aguarde 15 minutos e tente novamente.",
});

// Usado quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails têm conta.
const HASH_FALSO = bcrypt.hashSync("usuario-inexistente", 10);

// POST /api/auth/login
router.post("/login", limiteLogin, async (req, res) => {
  const { email, senha } = req.body || {};
  if (typeof email !== "string" || typeof senha !== "string" || !email.trim() || !senha) {
    return res.status(400).json({ error: "Informe e-mail e senha." });
  }

  const [rows] = await pool.query(
    `SELECT u.id, u.nome, u.email, u.senha, u.ativo, p.nome AS perfil
     FROM usuarios_admin u JOIN perfis p ON p.id = u.perfil_id
     WHERE u.email = ?`,
    [email.trim().toLowerCase()]
  );
  const usuario = rows[0];
  const senhaOk = bcrypt.compareSync(senha, usuario ? usuario.senha : HASH_FALSO);

  if (!usuario || !senhaOk || !usuario.ativo) {
    return res.status(401).json({ error: "E-mail ou senha inválidos." });
  }

  res.json({
    token: gerarToken(usuario),
    user: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
  });
});

// GET /api/auth/me — confirma se a sessão ainda é válida
router.get("/me", exigirLogin(), (req, res) => {
  res.json({ user: req.usuario });
});

module.exports = router;
