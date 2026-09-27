// Cria o banco (se não existir) e aplica, em ordem, os arquivos de
// database/migrations que ainda não foram executados.
// Roda automaticamente ao iniciar o servidor; também pode ser chamado com `npm run migrate`.
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { banco } = require("../config");

const PASTA = path.join(__dirname, "..", "..", "database", "migrations");

// Divide o arquivo em comandos (os scripts não usam ";" dentro de textos).
function comandos(sql) {
  return sql
    .split("\n")
    .filter((linha) => !linha.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((c) => c.trim())
    .filter(Boolean);
}

async function migrar() {
  const { database, ...semBanco } = banco;
  const conn = await mysql.createConnection({ ...semBanco, multipleStatements: false });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${database}\``);
    await conn.query("SET time_zone = '+00:00'");
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      nome VARCHAR(150) PRIMARY KEY,
      executado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    const [feitas] = await conn.query("SELECT nome FROM schema_migrations");
    const jaExecutadas = new Set(feitas.map((r) => r.nome));
    const arquivos = fs.readdirSync(PASTA).filter((f) => f.endsWith(".sql")).sort();

    for (const arquivo of arquivos) {
      if (jaExecutadas.has(arquivo)) continue;
      const sql = fs.readFileSync(path.join(PASTA, arquivo), "utf-8");
      for (const comando of comandos(sql)) await conn.query(comando);
      await conn.query("INSERT INTO schema_migrations (nome) VALUES (?)", [arquivo]);
      console.log(`[banco] Migração aplicada: ${arquivo}`);
    }
  } finally {
    await conn.end();
  }
}

module.exports = { migrar };

if (require.main === module) {
  migrar()
    .then(() => console.log("[banco] Banco atualizado."))
    .catch((err) => {
      console.error("[banco] Falha na migração:", err.message);
      process.exit(1);
    });
}
