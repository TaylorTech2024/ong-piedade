// Configuração central, lida das variáveis de ambiente (.env local ou painel do Render).
require("dotenv").config();
const crypto = require("crypto");

const producao = process.env.NODE_ENV === "production";

function lerBooleano(valor, padrao) {
  if (valor === undefined || valor === "") return padrao;
  return ["1", "true", "sim", "yes"].includes(String(valor).toLowerCase());
}

// Banco: aceita DATABASE_URL (string de conexão do TiDB) ou variáveis separadas.
function configBanco() {
  const cfg = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "ong_piedade_db",
  };

  if (process.env.DATABASE_URL) {
    let url;
    try {
      url = new URL(process.env.DATABASE_URL.trim());
    } catch {
      console.error("❌ DATABASE_URL inválida. Formato: mysql://usuario:senha@host:4000/test");
      process.exit(1);
    }
    cfg.host = url.hostname;
    cfg.port = Number(url.port || 4000);
    cfg.user = decodeURIComponent(url.username);
    cfg.password = decodeURIComponent(url.password);
    const nomeNaUrl = url.pathname.replace(/^\//, "");
    // DB_NAME tem prioridade; o TiDB costuma entregar a URL apontando para "test".
    if (!process.env.DB_NAME && nomeNaUrl) cfg.database = nomeNaUrl;
  }

  // TiDB Cloud exige conexão criptografada (TLS). Localmente costuma ser desligado.
  const usarSsl = lerBooleano(process.env.DB_SSL, /tidbcloud\.com$/.test(cfg.host));
  if (usarSsl) cfg.ssl = { minVersion: "TLSv1.2", rejectUnauthorized: true };

  if (!/^[A-Za-z0-9_]+$/.test(cfg.database)) {
    console.error("❌ DB_NAME inválido: use apenas letras, números e _.");
    process.exit(1);
  }
  return cfg;
}

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (producao) {
    console.error("❌ Defina a variável JWT_SECRET (valor longo e aleatório) no painel do Render (Environment).");
    process.exit(1);
  }
  jwtSecret = crypto.randomBytes(48).toString("hex");
  console.warn("[config] JWT_SECRET não definido: usando um segredo temporário (os logins caem ao reiniciar).");
}

module.exports = {
  producao,
  porta: Number(process.env.PORT || 3000),
  banco: configBanco(),
  jwtSecret,
  jwtExpiracao: "8h",
  admin: {
    email: (process.env.ADMIN_EMAIL || "admin@ongpiedade.org.br").trim().toLowerCase(),
    senha: process.env.ADMIN_PASSWORD || "",
    nome: process.env.ADMIN_NOME || "Administrador ONG",
  },
  // Render e outros serviços ficam atrás de um proxy; necessário para o IP real (limite de tentativas).
  trustProxy: process.env.TRUST_PROXY ?? (process.env.RENDER ? "1" : ""),
  corsOrigens: (process.env.CORS_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean),
  fusoHorario: "America/Recife",
};
