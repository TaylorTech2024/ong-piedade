// Garante que exista ao menos um administrador ativo.
const bcrypt = require("bcryptjs");
const { pool } = require("./pool");
const { admin, producao } = require("../config");

const PERFIL_ADMINISTRADOR = 1;

async function garantirAdmin() {
  const [[{ total }]] = await pool.query(
    "SELECT COUNT(*) AS total FROM usuarios_admin WHERE perfil_id = ? AND ativo = TRUE",
    [PERFIL_ADMINISTRADOR]
  );
  if (total > 0) return;

  if (!admin.senha || admin.senha.length < 8) {
    const msg = "Nenhum administrador cadastrado. Defina ADMIN_EMAIL e ADMIN_PASSWORD (mín. 8 caracteres) e reinicie.";
    if (producao) throw new Error(msg);
    console.warn(`[seed] ${msg}`);
    return;
  }

  await pool.query(
    `INSERT INTO usuarios_admin (nome, email, senha, perfil_id, ativo) VALUES (?, ?, ?, ?, TRUE)
     ON DUPLICATE KEY UPDATE senha = VALUES(senha), perfil_id = VALUES(perfil_id), ativo = TRUE`,
    [admin.nome, admin.email, bcrypt.hashSync(admin.senha, 10), PERFIL_ADMINISTRADOR]
  );
  console.log(`[seed] Administrador criado: ${admin.email}`);
}

module.exports = { garantirAdmin };
