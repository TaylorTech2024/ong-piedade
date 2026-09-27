// Pool de conexões MySQL/TiDB.
const mysql = require("mysql2/promise");
const { banco } = require("../config");

const pool = mysql.createPool({
  ...banco,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL || 5),
  enableKeepAlive: true,
  charset: "utf8mb4_unicode_ci",
  timezone: "Z", // datas TIMESTAMP sempre em UTC; o navegador converte para o horário local
  dateStrings: ["DATE", "DATETIME"], // DATE/DATETIME (datas de campanha e escalas) voltam como texto, sem conversão de fuso
  decimalNumbers: true,
  supportBigNumbers: true,
});

pool.on("connection", (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

// Executa fn(conn) dentro de uma transação; faz ROLLBACK se algo falhar.
async function transacao(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, transacao };
