// Usuários da área administrativa (RF13, RF15). Só o perfil ADMINISTRADOR acessa.
const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../../db/pool");
const { validar } = require("../../utils/validar");
const { erro } = require("../../utils/HttpError");
const { idParam } = require("../../utils/params");
const map = require("../../utils/mapear");

const router = express.Router();
const PERFIS = { ADMINISTRADOR: 1, OPERADOR: 2 };

async function contarAdminsAtivos(exceto) {
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM usuarios_admin WHERE perfil_id = 1 AND ativo = TRUE AND id <> ?`,
    [exceto]
  );
  return Number(total);
}

router.get("/usuarios", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.nome, u.email, u.ativo, u.criado_em, p.nome AS perfil
     FROM usuarios_admin u JOIN perfis p ON p.id = u.perfil_id ORDER BY u.nome ASC`
  );
  res.json({ usuarios: rows.map(map.usuario) });
});

router.post("/usuarios", async (req, res) => {
  const u = validar(req.body, {
    nome: { tipo: "texto", obrigatorio: true, min: 2, max: 100, rotulo: "Nome" },
    email: { tipo: "email", obrigatorio: true, rotulo: "E-mail" },
    senha: { tipo: "senha", obrigatorio: true, rotulo: "Senha" },
    perfil: { tipo: "enum", valores: Object.keys(PERFIS), padrao: "OPERADOR", rotulo: "Perfil" },
  });
  const [r] = await pool.query(
    `INSERT INTO usuarios_admin (nome, email, senha, perfil_id, ativo) VALUES (?, ?, ?, ?, TRUE)`,
    [u.nome, u.email, bcrypt.hashSync(u.senha, 10), PERFIS[u.perfil]]
  );
  res.status(201).json({ message: "Usuário criado.", id: r.insertId });
});

router.put("/usuarios/:id", async (req, res) => {
  const id = idParam(req);
  const u = validar(
    req.body,
    {
      nome: { tipo: "texto", obrigatorio: true, min: 2, max: 100, rotulo: "Nome" },
      email: { tipo: "email", obrigatorio: true, rotulo: "E-mail" },
      perfil: { tipo: "enum", valores: Object.keys(PERFIS), obrigatorio: true, rotulo: "Perfil" },
      ativo: { tipo: "booleano", obrigatorio: true, rotulo: "Ativo" },
    },
    { parcial: true }
  );

  const perdeAdmin = ("perfil" in u && u.perfil !== "ADMINISTRADOR") || u.ativo === false;
  if (perdeAdmin && id === req.usuario.id) {
    throw erro.requisicao("Você não pode desativar nem rebaixar o seu próprio usuário.");
  }
  if (perdeAdmin && (await contarAdminsAtivos(id)) === 0) {
    const [[alvo]] = await pool.query(`SELECT perfil_id, ativo FROM usuarios_admin WHERE id = ?`, [id]);
    if (alvo && alvo.perfil_id === 1 && alvo.ativo) throw erro.requisicao("O sistema precisa de pelo menos um administrador ativo.");
  }

  const campos = [];
  const valores = [];
  if ("nome" in u) { campos.push("nome = ?"); valores.push(u.nome); }
  if ("email" in u) { campos.push("email = ?"); valores.push(u.email); }
  if ("perfil" in u) { campos.push("perfil_id = ?"); valores.push(PERFIS[u.perfil]); }
  if ("ativo" in u) { campos.push("ativo = ?"); valores.push(u.ativo); }
  if (!campos.length) throw erro.requisicao("Nada para atualizar.");

  const [r] = await pool.query(`UPDATE usuarios_admin SET ${campos.join(", ")} WHERE id = ?`, [...valores, id]);
  if (!r.affectedRows) throw erro.naoEncontrado("Usuário não encontrado.");
  res.json({ message: "Usuário atualizado." });
});

router.patch("/usuarios/:id/senha", async (req, res) => {
  const id = idParam(req);
  const { senha } = validar(req.body, { senha: { tipo: "senha", obrigatorio: true, rotulo: "Nova senha" } });
  const [r] = await pool.query(`UPDATE usuarios_admin SET senha = ? WHERE id = ?`, [bcrypt.hashSync(senha, 10), id]);
  if (!r.affectedRows) throw erro.naoEncontrado("Usuário não encontrado.");
  res.json({ message: "Senha alterada." });
});

module.exports = router;
