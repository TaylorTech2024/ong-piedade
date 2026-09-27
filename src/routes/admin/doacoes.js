// Gestão de doações financeiras e doadores (RF13).
const express = require("express");
const { pool } = require("../../db/pool");
const { validar } = require("../../utils/validar");
const { erro } = require("../../utils/HttpError");
const { idParam, montarUpdate } = require("../../utils/params");
const { validarDoador } = require("../../services/doadores");
const map = require("../../utils/mapear");

const router = express.Router();
const STATUS = ["PENDENTE", "CONFIRMADO", "CANCELADO", "FALHOU"];

// GET /api/admin/doacoes?status=PENDENTE
router.get("/doacoes", async (req, res) => {
  const filtros = [];
  const valores = [];
  if (req.query.status) {
    if (!STATUS.includes(req.query.status)) throw erro.requisicao("Status inválido.");
    filtros.push("d.status_pagamento = ?");
    valores.push(req.query.status);
  }
  const [rows] = await pool.query(
    `SELECT d.*, o.nome_razao_social, o.email, o.telefone, o.cpf_cnpj
     FROM doacoes_financeiras d LEFT JOIN doadores o ON o.id = d.doador_id
     ${filtros.length ? "WHERE " + filtros.join(" AND ") : ""}
     ORDER BY d.data_doacao DESC, d.id DESC LIMIT 1000`,
    valores
  );
  res.json({
    doacoes: rows.map((r) => ({
      ...map.doacao(r),
      doador: r.doador_id
        ? { nome: r.nome_razao_social, email: r.email, telefone: r.telefone, cpfCnpj: r.cpf_cnpj }
        : null,
    })),
  });
});

// PATCH /api/admin/doacoes/:id — confirmar/cancelar pagamento
router.patch("/doacoes/:id", async (req, res) => {
  const id = idParam(req);
  const dados = validar(req.body, {
    statusPagamento: { tipo: "enum", valores: STATUS, obrigatorio: true, rotulo: "Status" },
    transacaoId: { tipo: "texto", max: 100, rotulo: "Código da transação" },
  });
  const [r] = await pool.query(
    `UPDATE doacoes_financeiras SET status_pagamento = ?, transacao_id = COALESCE(?, transacao_id) WHERE id = ?`,
    [dados.statusPagamento, dados.transacaoId, id]
  );
  if (!r.affectedRows) throw erro.naoEncontrado("Doação não encontrada.");
  res.json({ message: "Doação atualizada." });
});

// GET /api/admin/doadores
router.get("/doadores", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT o.*,
            COUNT(d.id) AS qtd_doacoes,
            COALESCE(SUM(CASE WHEN d.status_pagamento = 'CONFIRMADO' THEN d.valor END), 0) AS total_confirmado
     FROM doadores o LEFT JOIN doacoes_financeiras d ON d.doador_id = o.id
     GROUP BY o.id ORDER BY o.criado_em DESC, o.id DESC`
  );
  res.json({
    doadores: rows.map((r) => ({ ...map.doador(r), qtdDoacoes: Number(r.qtd_doacoes), totalConfirmado: Number(r.total_confirmado) })),
  });
});

// PUT /api/admin/doadores/:id
router.put("/doadores/:id", async (req, res) => {
  const id = idParam(req);
  const dados = validarDoador(req.body, { parcial: true });
  const { sql, valores } = montarUpdate(dados, {
    tipoPessoa: "tipo_pessoa", nomeRazaoSocial: "nome_razao_social", cpfCnpj: "cpf_cnpj", email: "email", telefone: "telefone",
  });
  if (!sql) throw erro.requisicao("Nada para atualizar.");
  const [r] = await pool.query(`UPDATE doadores SET ${sql} WHERE id = ?`, [...valores, id]);
  if (!r.affectedRows) throw erro.naoEncontrado("Doador não encontrado.");
  res.json({ message: "Doador atualizado." });
});

// DELETE /api/admin/doadores/:id — as doações ficam registradas, sem vínculo (ON DELETE SET NULL)
router.delete("/doadores/:id", async (req, res) => {
  const [r] = await pool.query(`DELETE FROM doadores WHERE id = ?`, [idParam(req)]);
  if (!r.affectedRows) throw erro.naoEncontrado("Doador não encontrado.");
  res.json({ message: "Doador excluído." });
});

module.exports = router;
