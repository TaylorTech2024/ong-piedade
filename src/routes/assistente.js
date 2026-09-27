// POST /api/assistente — chatbot do site (IA gratuita, ver src/ia/assistente.js)
const express = require("express");
const { limitar } = require("../middleware/limite");
const { responder } = require("../ia/assistente");

const router = express.Router();

router.post("/", limitar({ janelaMs: 60 * 1000, maximo: 30 }), async (req, res) => {
  const mensagem = req.body && req.body.mensagem;
  if (typeof mensagem !== "string" || !mensagem.trim()) return res.status(400).json({ error: "Digite uma mensagem." });
  if (mensagem.length > 500) return res.status(400).json({ error: "Mensagem muito longa (máx. 500 caracteres)." });
  res.json(await responder(mensagem));
});

module.exports = router;
