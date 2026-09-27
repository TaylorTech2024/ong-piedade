// Ponto de entrada: API REST (/api/...) + site estático (pasta public/).
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const config = require("./src/config");
const { pool } = require("./src/db/pool");
const { migrar } = require("./src/db/migrate");
const { garantirAdmin } = require("./src/db/seed");
const { tratarErros } = require("./src/middleware/erros");
const { limitar } = require("./src/middleware/limite");

const app = express();

if (config.trustProxy) app.set("trust proxy", Number(config.trustProxy) || config.trustProxy);
app.disable("x-powered-by");

// Cabeçalhos de segurança (CSP): scripts só do próprio site; libera apenas o mapa do Google.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        frameSrc: ["https://maps.google.com", "https://www.google.com"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: config.producao ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());

// CORS: só é necessário se o front-end for hospedado em outro domínio (CORS_ORIGINS).
if (config.corsOrigens.length) {
  app.use("/api", (req, res, next) => {
    const origem = req.headers.origin;
    if (origem && config.corsOrigens.includes(origem)) {
      res.set({
        "Access-Control-Allow-Origin": origem,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE",
        Vary: "Origin",
      });
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
}

app.use(express.json({ limit: "100kb" }));

// Limite geral por IP: dificulta ataques de sobrecarga e robôs (o login e os
// formulários ainda têm limites próprios, mais rígidos).
app.use("/api", limitar({ janelaMs: 60 * 1000, maximo: 300, mensagem: "Muitas requisições. Aguarde um minuto." }));

// ---------- API ----------
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, banco: "conectado" });
  } catch {
    res.status(503).json({ ok: false, banco: "indisponível" });
  }
});
app.use("/api/auth", require("./src/routes/auth"));
app.use("/api/publico", require("./src/routes/publico"));
app.use("/api/assistente", require("./src/routes/assistente"));
app.use("/api/admin", require("./src/routes/admin"));
app.use("/api", require("./src/routes/cadastros"));
app.use("/api", (req, res) => res.status(404).json({ error: "Rota de API não encontrada." }));

// ---------- Site ----------
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"], maxAge: config.producao ? "1h" : 0 }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, "public", "404.html")));

app.use(tratarErros);

async function iniciar() {
  await migrar();
  await garantirAdmin();
  const servidor = app.listen(config.porta, () => {
    console.log(`✅ ONG Piedade no ar em http://localhost:${config.porta}`);
  });
  // Derruba conexões lentas de propósito (ataque "slowloris").
  servidor.requestTimeout = 30 * 1000;
  servidor.headersTimeout = 20 * 1000;
}

iniciar().catch((err) => {
  console.error("❌ Não foi possível iniciar o servidor:", err.message);
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    console.error("   Verifique DATABASE_URL / DB_HOST e se o banco está no ar.");
  } else if (err.code === "ER_ACCESS_DENIED_ERROR") {
    console.error("   Usuário ou senha do banco incorretos.");
  }
  process.exit(1);
});
