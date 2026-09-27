// Área administrativa (RF13). Toda rota daqui exige login (RF15).
const express = require("express");
const { pool } = require("../../db/pool");
const { exigirLogin } = require("../../middleware/auth");
const { inicioDoMes } = require("../../utils/datas");
const { gerarInsights } = require("../../ia/insights");

const router = express.Router();

router.use(exigirLogin("ADMINISTRADOR", "OPERADOR"));

// GET /api/admin/metricas — números do topo do dashboard
router.get("/metricas", async (req, res) => {
  const [[vol]] = await pool.query(
    `SELECT SUM(status = 'APROVADO') AS aprovados, SUM(status = 'PENDENTE') AS pendentes FROM voluntarios`
  );
  const [[mes]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN status_pagamento = 'CONFIRMADO' THEN valor END), 0) AS confirmado,
            COALESCE(SUM(CASE WHEN status_pagamento = 'PENDENTE' THEN valor END), 0) AS pendente,
            COUNT(*) AS qtd
     FROM doacoes_financeiras WHERE data_doacao >= ?`,
    [inicioDoMes()]
  );
  const [[mat]] = await pool.query(
    `SELECT COALESCE(SUM(qtd_recebida), 0) AS recebidos, SUM(status = 'EM_ANDAMENTO') AS abertas FROM necessidades_materiais`
  );
  const [[doadores]] = await pool.query(`SELECT COUNT(*) AS total FROM doadores`);
  const [[escalas]] = await pool.query(`SELECT COUNT(*) AS total FROM escalas_voluntarios WHERE data_fim >= UTC_TIMESTAMP() - INTERVAL 3 HOUR`);

  res.json({
    voluntariosAtivos: Number(vol.aprovados || 0),
    voluntariosPendentes: Number(vol.pendentes || 0),
    doacoesMesConfirmado: Number(mes.confirmado),
    doacoesMesPendente: Number(mes.pendente),
    doacoesMesQuantidade: Number(mes.qtd),
    materiaisRecebidos: Number(mat.recebidos),
    necessidadesAbertas: Number(mat.abertas || 0),
    totalDoadores: Number(doadores.total),
    proximasEscalas: Number(escalas.total),
  });
});

// GET /api/admin/insights — Painel de Insights (IA / Cultura de Dados)
router.get("/insights", async (req, res) => {
  res.json(await gerarInsights());
});

router.use(require("./doacoes"));
router.use(require("./campanhas"));
router.use(require("./voluntarios"));
router.use(require("./relatorios"));
router.use("/usuarios", exigirLogin("ADMINISTRADOR"));
router.use(require("./usuarios"));

module.exports = router;
