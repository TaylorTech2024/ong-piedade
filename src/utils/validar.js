// Validação declarativa do corpo das requisições.
// Uso: const dados = validar(req.body, { nome: { tipo: "texto", obrigatorio: true, max: 100 } });
// Devolve só os campos conhecidos, já limpos/convertidos. Lança HTTP 400 no primeiro erro.
const { erro } = require("./HttpError");

const EMAIL = /^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]{2,}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const DATA_HORA = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;

function dataReal(texto) {
  const [a, m, d] = texto.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function validarCampo(valor, regra, rotulo) {
  const vazio = valor === undefined || valor === null || (typeof valor === "string" && valor.trim() === "");
  if (vazio) {
    if (regra.obrigatorio) throw erro.requisicao(`O campo "${rotulo}" é obrigatório.`);
    return regra.padrao !== undefined ? regra.padrao : null;
  }

  switch (regra.tipo) {
    case "texto": {
      if (typeof valor !== "string" && typeof valor !== "number") throw erro.requisicao(`"${rotulo}" inválido.`);
      const t = String(valor).trim();
      if (regra.max && t.length > regra.max) throw erro.requisicao(`"${rotulo}" deve ter no máximo ${regra.max} caracteres.`);
      if (regra.min && t.length < regra.min) throw erro.requisicao(`"${rotulo}" deve ter no mínimo ${regra.min} caracteres.`);
      return t;
    }
    case "senha": {
      if (typeof valor !== "string" || valor.length < 8 || valor.length > 72) {
        throw erro.requisicao(`"${rotulo}" deve ter entre 8 e 72 caracteres.`);
      }
      return valor;
    }
    case "email": {
      const e = String(valor).trim().toLowerCase();
      if (e.length > 100 || !EMAIL.test(e)) throw erro.requisicao(`"${rotulo}" inválido.`);
      return e;
    }
    case "telefone": {
      const d = String(valor).replace(/\D/g, "");
      if (d.length < 10 || d.length > 13) throw erro.requisicao(`"${rotulo}" inválido (informe DDD + número).`);
      return d;
    }
    case "inteiro": {
      const n = Number(valor);
      if (!Number.isInteger(n)) throw erro.requisicao(`"${rotulo}" deve ser um número inteiro.`);
      if (regra.min !== undefined && n < regra.min) throw erro.requisicao(`"${rotulo}" deve ser no mínimo ${regra.min}.`);
      if (regra.max !== undefined && n > regra.max) throw erro.requisicao(`"${rotulo}" deve ser no máximo ${regra.max}.`);
      return n;
    }
    case "dinheiro": {
      const n = Math.round(Number(valor) * 100) / 100;
      if (!Number.isFinite(n)) throw erro.requisicao(`"${rotulo}" inválido.`);
      if (regra.min !== undefined && n < regra.min) throw erro.requisicao(`"${rotulo}" deve ser no mínimo R$ ${regra.min}.`);
      if (regra.max !== undefined && n > regra.max) throw erro.requisicao(`"${rotulo}" deve ser no máximo R$ ${regra.max}.`);
      return n;
    }
    case "enum": {
      const v = String(valor).trim().toUpperCase();
      if (!regra.valores.includes(v)) throw erro.requisicao(`"${rotulo}" inválido. Use: ${regra.valores.join(", ")}.`);
      return v;
    }
    case "booleano": {
      if (typeof valor === "boolean") return valor;
      if (["true", "1", 1].includes(valor)) return true;
      if (["false", "0", 0].includes(valor)) return false;
      throw erro.requisicao(`"${rotulo}" inválido.`);
    }
    case "data": {
      const t = String(valor).trim();
      if (!DATA.test(t) || !dataReal(t)) throw erro.requisicao(`"${rotulo}" deve ser uma data válida (AAAA-MM-DD).`);
      return t;
    }
    case "dataHora": {
      const t = String(valor).trim();
      if (!DATA_HORA.test(t) || !dataReal(t)) throw erro.requisicao(`"${rotulo}" deve ser data e hora válidas.`);
      const [data, hora] = t.split(/[T ]/);
      return `${data} ${hora.length === 5 ? hora + ":00" : hora}`;
    }
    default:
      throw new Error(`Tipo de validação desconhecido: ${regra.tipo}`);
  }
}

// parcial = true: valida só os campos enviados (usado em edições).
function validar(corpo, esquema, { parcial = false } = {}) {
  const origem = corpo && typeof corpo === "object" ? corpo : {};
  const saida = {};
  for (const [campo, regra] of Object.entries(esquema)) {
    if (parcial && !(campo in origem)) continue;
    const r = parcial ? { ...regra, obrigatorio: regra.obrigatorio && campo in origem } : regra;
    saida[campo] = validarCampo(origem[campo], r, regra.rotulo || campo);
  }
  return saida;
}

module.exports = { validar };
