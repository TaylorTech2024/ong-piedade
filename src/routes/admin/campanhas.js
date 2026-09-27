// Gestão de campanhas (RF06) e necessidades de materiais (RF07).
const express = require("express");
const { pool, transacao } = require("../../db/pool");
const { validar } = require("../../utils/validar");
const { erro } = require("../../utils/HttpError");
const { idParam, montarUpdate } = require("../../utils/params");
const map = require("../../utils/mapear");

const router = express.Router();

const ESQUEMA_CAMPANHA = {
  titulo: { tipo: "texto", obrigatorio: true, max: 150, rotulo: "Título" },
  descricao: { tipo: "texto", max: 5000, rotulo: "Descrição" },
  metaValor: { tipo: "dinheiro", min: 0, max: 99999999, rotulo: "Meta (R$)" },
  dataInicio: { tipo: "data", obrigatorio: true, rotulo: "Data de início" },
  dataFim: { tipo: "data", rotulo: "Data de fim" },
  ativa: { tipo: "booleano", padrao: true, rotulo: "Ativa" },
};
const COLUNAS_CAMPANHA = {
  titulo: "titulo", descricao: "descricao", metaValor: "meta_valor", dataInicio: "data_inicio", dataFim: "data_fim", ativa: "ativa",
};

const ESQUEMA_NECESSIDADE = {
  campanhaId: { tipo: "inteiro", min: 1, rotulo: "Campanha" },
  item: { tipo: "texto", obrigatorio: true, max: 100, rotulo: "Item" },
  descricao: { tipo: "texto", max: 5000, rotulo: "Descrição" },
  qtdNecessaria: { tipo: "inteiro", obrigatorio: true, min: 1, max: 10000000, rotulo: "Quantidade necessária" },
  qtdRecebida: { tipo: "inteiro", min: 0, max: 10000000, padrao: 0, rotulo: "Quantidade recebida" },
  pontoColeta: { tipo: "texto", obrigatorio: true, max: 255, rotulo: "Ponto de coleta" },
};
const COLUNAS_NECESSIDADE = {
  campanhaId: "campanha_id", item: "item", descricao: "descricao",
  qtdNecessaria: "qtd_necessaria", qtdRecebida: "qtd_recebida", pontoColeta: "ponto_coleta",
};
// O status é sempre calculado: concluído quando a quantidade recebida atinge a necessária.
const SQL_STATUS = `status = IF(qtd_recebida >= qtd_necessaria, 'CONCLUIDO', 'EM_ANDAMENTO')`;

// ---------- CAMPANHAS ----------
router.get("/campanhas", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*, COUNT(n.id) AS qtd_necessidades
     FROM campanhas c LEFT JOIN necessidades_materiais n ON n.campanha_id = c.id
     GROUP BY c.id ORDER BY c.data_inicio DESC, c.id DESC`
  );
  res.json({ campanhas: rows.map((r) => ({ ...map.campanha(r), qtdNecessidades: Number(r.qtd_necessidades) })) });
});

router.post("/campanhas", async (req, res) => {
  const c = validar(req.body, ESQUEMA_CAMPANHA);
  if (c.dataFim && c.dataFim < c.dataInicio) throw erro.requisicao("A data de fim não pode ser anterior à de início.");
  const [r] = await pool.query(
    `INSERT INTO campanhas (titulo, descricao, meta_valor, data_inicio, data_fim, ativa) VALUES (?, ?, ?, ?, ?, ?)`,
    [c.titulo, c.descricao, c.metaValor, c.dataInicio, c.dataFim, c.ativa]
  );
  res.status(201).json({ message: "Campanha criada.", id: r.insertId });
});

router.put("/campanhas/:id", async (req, res) => {
  const id = idParam(req);
  const c = validar(req.body, ESQUEMA_CAMPANHA, { parcial: true });
  const [[atual]] = await pool.query(`SELECT data_inicio, data_fim FROM campanhas WHERE id = ?`, [id]);
  if (!atual) throw erro.naoEncontrado("Campanha não encontrada.");
  const inicio = c.dataInicio ?? atual.data_inicio;
  const fim = "dataFim" in c ? c.dataFim : atual.data_fim;
  if (fim && fim < inicio) throw erro.requisicao("A data de fim não pode ser anterior à de início.");

  const { sql, valores } = montarUpdate(c, COLUNAS_CAMPANHA);
  if (!sql) throw erro.requisicao("Nada para atualizar.");
  await pool.query(`UPDATE campanhas SET ${sql} WHERE id = ?`, [...valores, id]);
  res.json({ message: "Campanha atualizada." });
});

// As necessidades da campanha excluída continuam cadastradas, como "necessidades gerais".
router.delete("/campanhas/:id", async (req, res) => {
  const [r] = await pool.query(`DELETE FROM campanhas WHERE id = ?`, [idParam(req)]);
  if (!r.affectedRows) throw erro.naoEncontrado("Campanha não encontrada.");
  res.json({ message: "Campanha excluída." });
});

// ---------- NECESSIDADES DE MATERIAIS ----------
router.get("/necessidades", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT n.*, c.titulo AS campanha_titulo
     FROM necessidades_materiais n LEFT JOIN campanhas c ON c.id = n.campanha_id
     ORDER BY n.status ASC, n.id DESC`
  );
  res.json({ necessidades: rows.map((r) => ({ ...map.necessidade(r), campanhaTitulo: r.campanha_titulo })) });
});

router.post("/necessidades", async (req, res) => {
  const n = validar(req.body, ESQUEMA_NECESSIDADE);
  const id = await transacao(async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO necessidades_materiais (campanha_id, item, descricao, qtd_necessaria, qtd_recebida, ponto_coleta)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [n.campanhaId, n.item, n.descricao, n.qtdNecessaria, n.qtdRecebida, n.pontoColeta]
    );
    await conn.query(`UPDATE necessidades_materiais SET ${SQL_STATUS} WHERE id = ?`, [r.insertId]);
    return r.insertId;
  });
  res.status(201).json({ message: "Necessidade cadastrada.", id });
});

router.put("/necessidades/:id", async (req, res) => {
  const id = idParam(req);
  const n = validar(req.body, ESQUEMA_NECESSIDADE, { parcial: true });
  const { sql, valores } = montarUpdate(n, COLUNAS_NECESSIDADE);
  if (!sql) throw erro.requisicao("Nada para atualizar.");
  const [r] = await pool.query(`UPDATE necessidades_materiais SET ${sql} WHERE id = ?`, [...valores, id]);
  if (!r.affectedRows) throw erro.naoEncontrado("Necessidade não encontrada.");
  await pool.query(`UPDATE necessidades_materiais SET ${SQL_STATUS} WHERE id = ?`, [id]);
  res.json({ message: "Necessidade atualizada." });
});

// POST /api/admin/necessidades/:id/recebimento — registra entrada de material (ou correção, se negativo)
router.post("/necessidades/:id/recebimento", async (req, res) => {
  const id = idParam(req);
  const { quantidade } = validar(req.body, {
    quantidade: { tipo: "inteiro", obrigatorio: true, min: -1000000, max: 1000000, rotulo: "Quantidade" },
  });
  if (quantidade === 0) throw erro.requisicao("Informe uma quantidade diferente de zero.");

  const necessidade = await transacao(async (conn) => {
    const [[atual]] = await conn.query(`SELECT * FROM necessidades_materiais WHERE id = ? FOR UPDATE`, [id]);
    if (!atual) throw erro.naoEncontrado("Necessidade não encontrada.");
    if (atual.qtd_recebida + quantidade < 0) throw erro.requisicao("A quantidade recebida não pode ficar negativa.");
    await conn.query(`UPDATE necessidades_materiais SET qtd_recebida = qtd_recebida + ? WHERE id = ?`, [quantidade, id]);
    await conn.query(`UPDATE necessidades_materiais SET ${SQL_STATUS} WHERE id = ?`, [id]);
    await conn.query(`INSERT INTO recebimentos_materiais (necessidade_id, quantidade) VALUES (?, ?)`, [id, quantidade]);
    const [[nova]] = await conn.query(`SELECT * FROM necessidades_materiais WHERE id = ?`, [id]);
    return nova;
  });
  res.json({ message: "Recebimento registrado.", necessidade: map.necessidade(necessidade) });
});

router.delete("/necessidades/:id", async (req, res) => {
  const [r] = await pool.query(`DELETE FROM necessidades_materiais WHERE id = ?`, [idParam(req)]);
  if (!r.affectedRows) throw erro.naoEncontrado("Necessidade não encontrada.");
  res.json({ message: "Necessidade excluída." });
});

module.exports = router;
