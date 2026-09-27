// Consultas públicas do site: campanhas/necessidades (RF06, RF07),
// mural de transparência (RF10) e download de relatórios (RF12).
const express = require("express");
const { pool } = require("../db/pool");
const { hoje } = require("../utils/datas");
const { erro } = require("../utils/HttpError");
const map = require("../utils/mapear");

const router = express.Router();

// GET /api/publico/campanhas — campanhas ativas e necessidades de materiais em andamento
router.get("/campanhas", async (req, res) => {
  const dataHoje = hoje();
  const [campanhas] = await pool.query(
    `SELECT * FROM campanhas
     WHERE ativa = TRUE AND data_inicio <= ? AND (data_fim IS NULL OR data_fim >= ?)
     ORDER BY data_inicio DESC, id DESC`,
    [dataHoje, dataHoje]
  );
  const [necessidades] = await pool.query(
    `SELECT n.* FROM necessidades_materiais n
     LEFT JOIN campanhas c ON c.id = n.campanha_id
     WHERE n.status = 'EM_ANDAMENTO'
       AND (n.campanha_id IS NULL OR (c.ativa = TRUE AND c.data_inicio <= ? AND (c.data_fim IS NULL OR c.data_fim >= ?)))
     ORDER BY n.id ASC`,
    [dataHoje, dataHoje]
  );

  const lista = necessidades.map(map.necessidade);
  res.json({
    campanhas: campanhas.map((c) => ({
      ...map.campanha(c),
      necessidades: lista.filter((n) => n.campanhaId === c.id),
    })),
    necessidadesGerais: lista.filter((n) => n.campanhaId === null),
  });
});

// GET /api/publico/transparencia — números consolidados e relatórios publicados
router.get("/transparencia", async (req, res) => {
  const [[doacoes]] = await pool.query(
    `SELECT COALESCE(SUM(valor), 0) AS total, COUNT(*) AS quantidade
     FROM doacoes_financeiras WHERE status_pagamento = 'CONFIRMADO'`
  );
  const [[materiais]] = await pool.query(`SELECT COALESCE(SUM(qtd_recebida), 0) AS total FROM necessidades_materiais`);
  const [[voluntarios]] = await pool.query(`SELECT COUNT(*) AS total FROM voluntarios WHERE status = 'APROVADO'`);
  const [[impacto]] = await pool.query(
    `SELECT COALESCE(SUM(atendimentos_realizados), 0) AS atendimentos,
            COALESCE(SUM(atendimentos_medicos), 0) AS atendimentosMedicos,
            COALESCE(SUM(materiais_arrecadados_qtd), 0) AS materiais
     FROM relatorios_impacto`
  );
  const [relatorios] = await pool.query(`SELECT * FROM relatorios_impacto ORDER BY criado_em DESC, id DESC`);
  const [documentos] = await pool.query(
    `SELECT id, relatorio_id, nome_arquivo, caminho_arquivo, tipo_mime, tamanho_bytes, enviado_em
     FROM documentos_relatorios ORDER BY enviado_em DESC, id DESC`
  );

  const docs = documentos.map(map.documento);
  res.json({
    totais: {
      arrecadadoConfirmado: Number(doacoes.total),
      doacoesConfirmadas: Number(doacoes.quantidade),
      materiaisRecebidos: Number(materiais.total),
      voluntariosAtivos: Number(voluntarios.total),
      atendimentosRealizados: Number(impacto.atendimentos),
      atendimentosMedicos: Number(impacto.atendimentosMedicos),
      materiaisArrecadadosRelatorios: Number(impacto.materiais),
    },
    relatorios: relatorios.map((r) => ({ ...map.relatorio(r), documentos: docs.filter((d) => d.relatorioId === r.id) })),
  });
});

// GET /api/publico/documentos/:id — download do PDF guardado no banco
router.get("/documentos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw erro.naoEncontrado("Documento não encontrado.");

  const [[doc]] = await pool.query(`SELECT nome_arquivo, tipo_mime FROM documentos_relatorios WHERE id = ?`, [id]);
  if (!doc) throw erro.naoEncontrado("Documento não encontrado.");

  const [partes] = await pool.query(
    `SELECT dados FROM documentos_conteudo WHERE documento_id = ? ORDER BY parte ASC`,
    [id]
  );
  const arquivo = Buffer.concat(partes.map((p) => p.dados));

  const nomeAscii = doc.nome_arquivo.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
  res.set({
    "Content-Type": "application/pdf",
    "Content-Length": String(arquivo.length),
    "Content-Disposition": `inline; filename="${nomeAscii}"; filename*=UTF-8''${encodeURIComponent(doc.nome_arquivo)}`,
    "Cache-Control": "public, max-age=3600",
  });
  res.send(arquivo);
});

module.exports = router;
