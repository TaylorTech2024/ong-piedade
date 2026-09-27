// Formulários públicos do site: cadastro de doador (RF02), doação financeira
// (RF03, RF04, RF05) e cadastro de voluntário (RF08). Não exigem login.
const express = require("express");
const { pool, transacao } = require("../db/pool");
const { validar } = require("../utils/validar");
const { erro } = require("../utils/HttpError");
const { limitar } = require("../middleware/limite");
const { validarDoador, obterOuCriarDoador } = require("../services/doadores");
const { instrucoesPagamento, FORMAS_PAGAMENTO } = require("../services/pagamentos");

const router = express.Router();

// Evita spam/robôs enchendo o banco com cadastros falsos.
const limiteFormularios = limitar({ janelaMs: 60 * 60 * 1000, maximo: 20 });

// POST /api/doadores — cadastro de doador
router.post("/doadores", limiteFormularios, async (req, res) => {
  const dados = validarDoador(req.body);
  const [[existe]] = await pool.query(`SELECT id FROM doadores WHERE email = ?`, [dados.email]);
  if (existe) throw erro.conflito("Este e-mail já está cadastrado como doador. Você já pode doar normalmente.");

  const id = await transacao((conn) => obterOuCriarDoador(conn, dados));
  res.status(201).json({ message: "Cadastro de doador realizado com sucesso! Obrigado por fazer parte.", id });
});

// POST /api/doacoes — registra a doação e devolve as instruções de pagamento
router.post("/doacoes", limiteFormularios, async (req, res) => {
  const doacao = validar(req.body, {
    valor: { tipo: "dinheiro", obrigatorio: true, min: 1, max: 1000000, rotulo: "Valor" },
    tipoDoacao: { tipo: "enum", valores: ["UNICA", "RECORRENTE"], padrao: "UNICA", rotulo: "Tipo de doação" },
    formaPagamento: { tipo: "enum", valores: FORMAS_PAGAMENTO, obrigatorio: true, rotulo: "Forma de pagamento" },
  });
  const doador = validarDoador(req.body && req.body.doador);
  if (doacao.formaPagamento === "BOLETO" && !doador.cpfCnpj) {
    throw erro.requisicao("Para pagar com boleto, informe o CPF ou CNPJ.");
  }

  const id = await transacao(async (conn) => {
    const doadorId = await obterOuCriarDoador(conn, doador);
    const [r] = await conn.query(
      `INSERT INTO doacoes_financeiras (doador_id, valor, tipo_doacao, forma_pagamento, status_pagamento)
       VALUES (?, ?, ?, ?, 'PENDENTE')`,
      [doadorId, doacao.valor, doacao.tipoDoacao, doacao.formaPagamento]
    );
    return r.insertId;
  });

  res.status(201).json({
    message: "Doação registrada.",
    doacao: { id, ...doacao, statusPagamento: "PENDENTE" },
    pagamento: instrucoesPagamento(doacao.formaPagamento),
  });
});

// POST /api/voluntarios — inscrição de voluntário (fica PENDENTE até aprovação)
router.post("/voluntarios", limiteFormularios, async (req, res) => {
  const v = validar(req.body, {
    nome: { tipo: "texto", obrigatorio: true, min: 2, max: 100, rotulo: "Nome" },
    email: { tipo: "email", obrigatorio: true, rotulo: "E-mail" },
    telefone: { tipo: "telefone", obrigatorio: true, rotulo: "Telefone" },
    especialidadeProfissao: { tipo: "texto", max: 100, rotulo: "Especialidade/Profissão" },
    areaInteresse: { tipo: "texto", obrigatorio: true, max: 100, rotulo: "Área de interesse" },
    disponibilidade: { tipo: "texto", obrigatorio: true, max: 150, rotulo: "Disponibilidade" },
  });

  const [[existe]] = await pool.query(`SELECT id FROM voluntarios WHERE email = ?`, [v.email]);
  if (existe) throw erro.conflito("Já existe uma inscrição de voluntário com este e-mail. Aguarde nosso contato!");

  const [r] = await pool.query(
    `INSERT INTO voluntarios (nome, email, telefone, especialidade_profissao, area_interesse, disponibilidade)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [v.nome, v.email, v.telefone, v.especialidadeProfissao, v.areaInteresse, v.disponibilidade]
  );
  res.status(201).json({
    message: "Inscrição enviada! A equipe vai analisar seu cadastro e entrar em contato.",
    id: r.insertId,
  });
});

module.exports = router;
