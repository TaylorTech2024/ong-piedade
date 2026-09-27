// Relatórios de impacto (RF11) e upload de documentos em PDF (RF12).
const express = require("express");
const multer = require("multer");
const { pool, transacao } = require("../../db/pool");
const { validar } = require("../../utils/validar");
const { erro } = require("../../utils/HttpError");
const { idParam, montarUpdate } = require("../../utils/params");
const map = require("../../utils/mapear");

const router = express.Router();

const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB
const TAMANHO_PARTE = 1024 * 1024; // 1 MB por linha no banco (limite de linha do TiDB)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO, files: 1 },
  defParamCharset: "utf8", // mantém acentos no nome do arquivo
});

const ESQUEMA_RELATORIO = {
  titulo: { tipo: "texto", obrigatorio: true, max: 150, rotulo: "Título" },
  periodoReferencia: { tipo: "texto", obrigatorio: true, max: 50, rotulo: "Período de referência" },
  atendimentosRealizados: { tipo: "inteiro", min: 0, max: 100000000, padrao: 0, rotulo: "Atendimentos realizados" },
  atendimentosMedicos: { tipo: "inteiro", min: 0, max: 100000000, padrao: 0, rotulo: "Atendimentos médicos" },
  materiaisArrecadadosQtd: { tipo: "inteiro", min: 0, max: 100000000, padrao: 0, rotulo: "Materiais arrecadados" },
  descricaoResultados: { tipo: "texto", max: 20000, rotulo: "Descrição dos resultados" },
};
const COLUNAS_RELATORIO = {
  titulo: "titulo", periodoReferencia: "periodo_referencia", atendimentosRealizados: "atendimentos_realizados",
  atendimentosMedicos: "atendimentos_medicos", materiaisArrecadadosQtd: "materiais_arrecadados_qtd",
  descricaoResultados: "descricao_resultados",
};

router.get("/relatorios", async (req, res) => {
  const [relatorios] = await pool.query(`SELECT * FROM relatorios_impacto ORDER BY criado_em DESC, id DESC`);
  const [documentos] = await pool.query(
    `SELECT id, relatorio_id, nome_arquivo, caminho_arquivo, tipo_mime, tamanho_bytes, enviado_em
     FROM documentos_relatorios ORDER BY enviado_em DESC`
  );
  const docs = documentos.map(map.documento);
  res.json({ relatorios: relatorios.map((r) => ({ ...map.relatorio(r), documentos: docs.filter((d) => d.relatorioId === r.id) })) });
});

router.post("/relatorios", async (req, res) => {
  const r = validar(req.body, ESQUEMA_RELATORIO);
  const [res2] = await pool.query(
    `INSERT INTO relatorios_impacto (titulo, periodo_referencia, atendimentos_realizados, atendimentos_medicos,
       materiais_arrecadados_qtd, descricao_resultados) VALUES (?, ?, ?, ?, ?, ?)`,
    [r.titulo, r.periodoReferencia, r.atendimentosRealizados, r.atendimentosMedicos, r.materiaisArrecadadosQtd, r.descricaoResultados]
  );
  res.status(201).json({ message: "Relatório criado.", id: res2.insertId });
});

router.put("/relatorios/:id", async (req, res) => {
  const id = idParam(req);
  const r = validar(req.body, ESQUEMA_RELATORIO, { parcial: true });
  const { sql, valores } = montarUpdate(r, COLUNAS_RELATORIO);
  if (!sql) throw erro.requisicao("Nada para atualizar.");
  const [out] = await pool.query(`UPDATE relatorios_impacto SET ${sql} WHERE id = ?`, [...valores, id]);
  if (!out.affectedRows) throw erro.naoEncontrado("Relatório não encontrado.");
  res.json({ message: "Relatório atualizado." });
});

router.delete("/relatorios/:id", async (req, res) => {
  const [r] = await pool.query(`DELETE FROM relatorios_impacto WHERE id = ?`, [idParam(req)]);
  if (!r.affectedRows) throw erro.naoEncontrado("Relatório não encontrado.");
  res.json({ message: "Relatório excluído." });
});

// POST /api/admin/relatorios/:id/documentos — campo "arquivo" (multipart/form-data)
router.post("/relatorios/:id/documentos", upload.single("arquivo"), async (req, res) => {
  const relatorioId = idParam(req);
  const arquivo = req.file;
  if (!arquivo) throw erro.requisicao("Nenhum arquivo enviado.");
  // Confere a assinatura real do arquivo: o tipo informado pelo navegador pode ser falsificado.
  if (arquivo.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw erro.requisicao("Envie um arquivo PDF válido.");
  }
  const nome = arquivo.originalname.replace(/[\\/:*?"<>|\x00-\x1F]/g, "_").slice(0, 200) || "relatorio.pdf";

  const id = await transacao(async (conn) => {
    const [[rel]] = await conn.query(`SELECT id FROM relatorios_impacto WHERE id = ?`, [relatorioId]);
    if (!rel) throw erro.naoEncontrado("Relatório não encontrado.");
    const [r] = await conn.query(
      `INSERT INTO documentos_relatorios (relatorio_id, nome_arquivo, caminho_arquivo, tipo_mime, tamanho_bytes)
       VALUES (?, ?, '', 'application/pdf', ?)`,
      [relatorioId, nome.toLowerCase().endsWith(".pdf") ? nome : `${nome}.pdf`, arquivo.size]
    );
    const docId = r.insertId;
    await conn.query(`UPDATE documentos_relatorios SET caminho_arquivo = ? WHERE id = ?`, [`/api/publico/documentos/${docId}`, docId]);
    for (let parte = 0, ini = 0; ini < arquivo.size; parte++, ini += TAMANHO_PARTE) {
      await conn.query(`INSERT INTO documentos_conteudo (documento_id, parte, dados) VALUES (?, ?, ?)`, [
        docId, parte, arquivo.buffer.subarray(ini, ini + TAMANHO_PARTE),
      ]);
    }
    return docId;
  });
  res.status(201).json({ message: "Documento publicado na página de Transparência.", id, url: `/api/publico/documentos/${id}` });
});

router.delete("/documentos/:id", async (req, res) => {
  const [r] = await pool.query(`DELETE FROM documentos_relatorios WHERE id = ?`, [idParam(req)]);
  if (!r.affectedRows) throw erro.naoEncontrado("Documento não encontrado.");
  res.json({ message: "Documento excluído." });
});

module.exports = router;
