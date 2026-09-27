// Regras de cadastro de doador (RF02), usadas pelo site e pelo painel.
const { validar } = require("../utils/validar");
const { soDigitos, cpfValido, cnpjValido } = require("../utils/documentos");
const { erro } = require("../utils/HttpError");

const ESQUEMA_DOADOR = {
  tipoPessoa: { tipo: "enum", valores: ["PF", "PJ"], padrao: "PF", rotulo: "Tipo de pessoa" },
  nomeRazaoSocial: { tipo: "texto", obrigatorio: true, min: 2, max: 150, rotulo: "Nome / Razão social" },
  cpfCnpj: { tipo: "texto", max: 18, rotulo: "CPF/CNPJ" },
  email: { tipo: "email", obrigatorio: true, rotulo: "E-mail" },
  telefone: { tipo: "telefone", rotulo: "Telefone" },
};

// Valida os dados e normaliza o CPF/CNPJ (só dígitos, conferindo o dígito verificador).
function validarDoador(corpo, opcoes) {
  const dados = validar(corpo, ESQUEMA_DOADOR, opcoes);
  if (dados.cpfCnpj) {
    const doc = soDigitos(dados.cpfCnpj);
    const tipo = dados.tipoPessoa || (doc.length === 14 ? "PJ" : "PF");
    if (tipo === "PF" && !cpfValido(doc)) throw erro.requisicao("CPF inválido.");
    if (tipo === "PJ" && !cnpjValido(doc)) throw erro.requisicao("CNPJ inválido.");
    dados.cpfCnpj = doc;
  }
  return dados;
}

// Localiza o doador pelo e-mail ou cria um novo. Um doador existente não tem
// seus dados sobrescritos por quem apenas sabe o e-mail dele: só campos vazios
// são completados.
async function obterOuCriarDoador(conn, dados) {
  const [[existente]] = await conn.query(`SELECT * FROM doadores WHERE email = ? FOR UPDATE`, [dados.email]);

  if (dados.cpfCnpj) {
    const [[dono]] = await conn.query(`SELECT id FROM doadores WHERE cpf_cnpj = ?`, [dados.cpfCnpj]);
    if (dono && (!existente || dono.id !== existente.id)) {
      throw erro.conflito("Este CPF/CNPJ já está cadastrado com outro e-mail.");
    }
  }

  if (existente) {
    if (dados.cpfCnpj && existente.cpf_cnpj && existente.cpf_cnpj !== dados.cpfCnpj) {
      throw erro.conflito("Este e-mail já está cadastrado com outro CPF/CNPJ.");
    }
    await conn.query(
      `UPDATE doadores SET cpf_cnpj = COALESCE(cpf_cnpj, ?), telefone = COALESCE(telefone, ?) WHERE id = ?`,
      [dados.cpfCnpj || null, dados.telefone || null, existente.id]
    );
    return existente.id;
  }

  const [r] = await conn.query(
    `INSERT INTO doadores (tipo_pessoa, nome_razao_social, cpf_cnpj, email, telefone) VALUES (?, ?, ?, ?, ?)`,
    [dados.tipoPessoa || "PF", dados.nomeRazaoSocial, dados.cpfCnpj || null, dados.email, dados.telefone || null]
  );
  return r.insertId;
}

module.exports = { ESQUEMA_DOADOR, validarDoador, obterOuCriarDoador };
