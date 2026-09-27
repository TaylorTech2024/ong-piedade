// Gestão de voluntários e escalas (RF09).
const express = require("express");
const { pool } = require("../../db/pool");
const { validar } = require("../../utils/validar");
const { erro } = require("../../utils/HttpError");
const { idParam, montarUpdate } = require("../../utils/params");
const { sugerirVoluntarios } = require("../../ia/recomendacao");
const map = require("../../utils/mapear");

const router = express.Router();
const STATUS = ["PENDENTE", "APROVADO", "REPROVADO"];

const ESQUEMA_VOLUNTARIO = {
  nome: { tipo: "texto", obrigatorio: true, min: 2, max: 100, rotulo: "Nome" },
  email: { tipo: "email", obrigatorio: true, rotulo: "E-mail" },
  telefone: { tipo: "telefone", obrigatorio: true, rotulo: "Telefone" },
  especialidadeProfissao: { tipo: "texto", max: 100, rotulo: "Especialidade/Profissão" },
  areaInteresse: { tipo: "texto", obrigatorio: true, max: 100, rotulo: "Área de interesse" },
  disponibilidade: { tipo: "texto", obrigatorio: true, max: 150, rotulo: "Disponibilidade" },
  observacoesAdmin: { tipo: "texto", max: 5000, rotulo: "Observações" },
};
const COLUNAS_VOLUNTARIO = {
  nome: "nome", email: "email", telefone: "telefone", especialidadeProfissao: "especialidade_profissao",
  areaInteresse: "area_interesse", disponibilidade: "disponibilidade", observacoesAdmin: "observacoes_admin",
};

const ESQUEMA_ESCALA = {
  voluntarioId: { tipo: "inteiro", obrigatorio: true, min: 1, rotulo: "Voluntário" },
  atividade: { tipo: "texto", obrigatorio: true, max: 150, rotulo: "Atividade" },
  dataInicio: { tipo: "dataHora", obrigatorio: true, rotulo: "Início" },
  dataFim: { tipo: "dataHora", obrigatorio: true, rotulo: "Fim" },
  local: { tipo: "texto", max: 200, rotulo: "Local" },
};

// ---------- VOLUNTÁRIOS ----------
// GET /api/admin/voluntarios?status=PENDENTE
router.get("/voluntarios", async (req, res) => {
  const valores = [];
  let where = "";
  if (req.query.status) {
    if (!STATUS.includes(req.query.status)) throw erro.requisicao("Status inválido.");
    where = "WHERE v.status = ?";
    valores.push(req.query.status);
  }
  const [rows] = await pool.query(
    `SELECT v.*, (SELECT COUNT(*) FROM escalas_voluntarios e WHERE e.voluntario_id = v.id) AS qtd_escalas
     FROM voluntarios v ${where}
     ORDER BY FIELD(v.status, 'PENDENTE', 'APROVADO', 'REPROVADO'), v.cadastrado_em DESC`,
    valores
  );
  res.json({ voluntarios: rows.map((r) => ({ ...map.voluntario(r), qtdEscalas: Number(r.qtd_escalas) })) });
});

// PUT /api/admin/voluntarios/:id — alterar informações
router.put("/voluntarios/:id", async (req, res) => {
  const id = idParam(req);
  const v = validar(req.body, ESQUEMA_VOLUNTARIO, { parcial: true });
  const { sql, valores } = montarUpdate(v, COLUNAS_VOLUNTARIO);
  if (!sql) throw erro.requisicao("Nada para atualizar.");
  const [r] = await pool.query(`UPDATE voluntarios SET ${sql} WHERE id = ?`, [...valores, id]);
  if (!r.affectedRows) throw erro.naoEncontrado("Voluntário não encontrado.");
  res.json({ message: "Voluntário atualizado." });
});

// PATCH /api/admin/voluntarios/:id/status — aprovar / reprovar
router.patch("/voluntarios/:id/status", async (req, res) => {
  const id = idParam(req);
  const d = validar(req.body, {
    status: { tipo: "enum", valores: STATUS, obrigatorio: true, rotulo: "Status" },
    observacoesAdmin: { tipo: "texto", max: 5000, rotulo: "Observações" },
  });
  const [r] = await pool.query(
    `UPDATE voluntarios SET status = ?, observacoes_admin = COALESCE(?, observacoes_admin) WHERE id = ?`,
    [d.status, d.observacoesAdmin, id]
  );
  if (!r.affectedRows) throw erro.naoEncontrado("Voluntário não encontrado.");
  res.json({ message: d.status === "APROVADO" ? "Voluntário aprovado." : d.status === "REPROVADO" ? "Voluntário reprovado." : "Status atualizado." });
});

router.delete("/voluntarios/:id", async (req, res) => {
  const [r] = await pool.query(`DELETE FROM voluntarios WHERE id = ?`, [idParam(req)]);
  if (!r.affectedRows) throw erro.naoEncontrado("Voluntário não encontrado.");
  res.json({ message: "Voluntário excluído." });
});

// ---------- ESCALAS ----------
async function validarEscala(e, idIgnorar = 0) {
  if (e.dataFim <= e.dataInicio) throw erro.requisicao("O fim da escala deve ser depois do início.");
  const [[vol]] = await pool.query(`SELECT status FROM voluntarios WHERE id = ?`, [e.voluntarioId]);
  if (!vol) throw erro.requisicao("Voluntário não encontrado.");
  if (vol.status !== "APROVADO") throw erro.requisicao("Só voluntários aprovados podem entrar em escalas.");
  const [[conflito]] = await pool.query(
    `SELECT id FROM escalas_voluntarios
     WHERE voluntario_id = ? AND id <> ? AND data_inicio < ? AND data_fim > ?`,
    [e.voluntarioId, idIgnorar, e.dataFim, e.dataInicio]
  );
  if (conflito) throw erro.conflito("Este voluntário já tem outra escala nesse horário.");
}

// GET /api/admin/escalas?voluntarioId=1
router.get("/escalas", async (req, res) => {
  const valores = [];
  let where = "";
  if (req.query.voluntarioId) {
    where = "WHERE e.voluntario_id = ?";
    valores.push(Number(req.query.voluntarioId) || 0);
  }
  const [rows] = await pool.query(
    `SELECT e.*, v.nome AS voluntario_nome, v.telefone AS voluntario_telefone
     FROM escalas_voluntarios e JOIN voluntarios v ON v.id = e.voluntario_id
     ${where} ORDER BY e.data_inicio DESC`,
    valores
  );
  res.json({
    escalas: rows.map((r) => ({ ...map.escala(r), voluntarioNome: r.voluntario_nome, voluntarioTelefone: r.voluntario_telefone })),
  });
});

// GET /api/admin/escalas/sugestoes?atividade=...&dataInicio=...&dataFim=... — IA de recomendação
router.get("/escalas/sugestoes", async (req, res) => {
  const q = validar(req.query, {
    atividade: { tipo: "texto", obrigatorio: true, max: 150, rotulo: "Atividade" },
    dataInicio: { tipo: "dataHora", obrigatorio: true, rotulo: "Início" },
    dataFim: { tipo: "dataHora", obrigatorio: true, rotulo: "Fim" },
  });
  if (q.dataFim <= q.dataInicio) throw erro.requisicao("O fim deve ser depois do início.");
  res.json({ sugestoes: await sugerirVoluntarios(q) });
});

router.post("/escalas", async (req, res) => {
  const e = validar(req.body, ESQUEMA_ESCALA);
  await validarEscala(e);
  const [r] = await pool.query(
    `INSERT INTO escalas_voluntarios (voluntario_id, atividade, data_inicio, data_fim, local) VALUES (?, ?, ?, ?, ?)`,
    [e.voluntarioId, e.atividade, e.dataInicio, e.dataFim, e.local]
  );
  res.status(201).json({ message: "Escala criada.", id: r.insertId });
});

router.put("/escalas/:id", async (req, res) => {
  const id = idParam(req);
  const [[atual]] = await pool.query(`SELECT * FROM escalas_voluntarios WHERE id = ?`, [id]);
  if (!atual) throw erro.naoEncontrado("Escala não encontrada.");
  const e = validar({ ...map.escala(atual), ...(req.body || {}) }, ESQUEMA_ESCALA);
  await validarEscala(e, id);
  await pool.query(
    `UPDATE escalas_voluntarios SET voluntario_id = ?, atividade = ?, data_inicio = ?, data_fim = ?, local = ? WHERE id = ?`,
    [e.voluntarioId, e.atividade, e.dataInicio, e.dataFim, e.local, id]
  );
  res.json({ message: "Escala atualizada." });
});

router.delete("/escalas/:id", async (req, res) => {
  const [r] = await pool.query(`DELETE FROM escalas_voluntarios WHERE id = ?`, [idParam(req)]);
  if (!r.affectedRows) throw erro.naoEncontrado("Escala não encontrada.");
  res.json({ message: "Escala excluída." });
});

module.exports = router;
