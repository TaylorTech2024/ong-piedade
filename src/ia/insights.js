// Painel de Insights (Cultura de Dados): transforma os dados guardados no
// banco em previsões e alertas para apoiar a tomada de decisão da ONG.
const { pool } = require("../db/pool");
const { hoje } = require("../utils/datas");

// Regressão linear simples (mínimos quadrados): y = a + b·x
function regressaoLinear(ys) {
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const b = sxx ? sxy / sxx : 0;
  const a = my - b * mx;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0; // coeficiente de determinação (0 a 1)
  return { a, b, r2, media: my };
}

// Últimos 12 meses no formato "AAAA-MM", do mais antigo ao atual.
function ultimosMeses(qtd = 12) {
  const [ano, mes] = hoje().split("-").map(Number);
  const meses = [];
  for (let i = qtd - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    meses.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return meses;
}

const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (am) => `${NOMES_MES[Number(am.slice(5)) - 1]}/${am.slice(2, 4)}`;

async function previsaoDoacoes() {
  const meses = ultimosMeses(12);
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(CONVERT_TZ(data_doacao, '+00:00', '-03:00'), '%Y-%m') AS mes,
            SUM(valor) AS total, COUNT(*) AS qtd
     FROM doacoes_financeiras
     WHERE status_pagamento = 'CONFIRMADO' AND data_doacao >= ?
     GROUP BY mes`,
    [`${meses[0]}-01 03:00:00`]
  );
  const porMes = new Map(rows.map((r) => [r.mes, Number(r.total)]));
  const serie = meses.map((m) => ({ mes: m, rotulo: rotuloMes(m), total: porMes.get(m) || 0 }));

  // Usa a série a partir do primeiro mês com doação (meses antes do início do sistema distorceriam a tendência).
  const primeiro = serie.findIndex((p) => p.total > 0);
  const util = primeiro === -1 ? [] : serie.slice(primeiro).map((p) => p.total);
  if (util.length < 3) {
    return { serie, previsaoProximoMes: null, tendencia: null, confiabilidade: null, suficiente: false };
  }
  const { a, b, r2, media } = regressaoLinear(util);
  const previsao = Math.max(0, a + b * util.length);
  const variacaoMensal = media ? (b / media) * 100 : 0;
  return {
    serie,
    suficiente: true,
    previsaoProximoMes: Math.round(previsao * 100) / 100,
    tendencia: Math.abs(variacaoMensal) < 2 ? "ESTAVEL" : variacaoMensal > 0 ? "ALTA" : "QUEDA",
    variacaoMensalPercentual: Math.round(variacaoMensal * 10) / 10,
    confiabilidade: r2 >= 0.7 ? "ALTA" : r2 >= 0.4 ? "MEDIA" : "BAIXA",
    r2: Math.round(r2 * 100) / 100,
  };
}

async function alertasMateriais() {
  const [rows] = await pool.query(
    `SELECT n.id, n.item, n.qtd_necessaria, n.qtd_recebida,
            COALESCE(SUM(CASE WHEN r.recebido_em >= NOW() - INTERVAL 30 DAY AND r.quantidade > 0 THEN r.quantidade END), 0) AS recebido_30d
     FROM necessidades_materiais n
     LEFT JOIN recebimentos_materiais r ON r.necessidade_id = n.id
     WHERE n.status = 'EM_ANDAMENTO'
     GROUP BY n.id, n.item, n.qtd_necessaria, n.qtd_recebida`
  );
  return rows
    .map((n) => {
      const restante = Math.max(n.qtd_necessaria - n.qtd_recebida, 0);
      const ritmoDiario = Number(n.recebido_30d) / 30;
      const dias = ritmoDiario > 0 ? Math.ceil(restante / ritmoDiario) : null;
      const nivel = dias === null ? "CRITICO" : dias > 60 ? "ATENCAO" : "OK";
      return {
        id: n.id,
        item: n.item,
        restante,
        percentual: Math.round((n.qtd_recebida / n.qtd_necessaria) * 100),
        recebidoUltimos30Dias: Number(n.recebido_30d),
        diasParaCompletar: dias,
        nivel,
      };
    })
    .sort((x, y) => ["CRITICO", "ATENCAO", "OK"].indexOf(x.nivel) - ["CRITICO", "ATENCAO", "OK"].indexOf(y.nivel) || y.restante - x.restante);
}

async function perfilVoluntarios() {
  const [porArea] = await pool.query(
    `SELECT area_interesse AS area, COUNT(*) AS total,
            SUM(status = 'APROVADO') AS aprovados, SUM(status = 'PENDENTE') AS pendentes
     FROM voluntarios GROUP BY area_interesse ORDER BY total DESC`
  );
  const [[st]] = await pool.query(
    `SELECT SUM(status = 'APROVADO') AS aprovados, SUM(status = 'REPROVADO') AS reprovados, SUM(status = 'PENDENTE') AS pendentes
     FROM voluntarios`
  );
  const analisados = Number(st.aprovados || 0) + Number(st.reprovados || 0);
  return {
    porArea: porArea.map((r) => ({ area: r.area, total: Number(r.total), aprovados: Number(r.aprovados), pendentes: Number(r.pendentes) })),
    pendentes: Number(st.pendentes || 0),
    taxaAprovacao: analisados ? Math.round((Number(st.aprovados) / analisados) * 100) : null,
  };
}

async function perfilDoacoes() {
  const [porForma] = await pool.query(
    `SELECT forma_pagamento AS forma, COUNT(*) AS qtd, COALESCE(SUM(valor), 0) AS total
     FROM doacoes_financeiras WHERE status_pagamento = 'CONFIRMADO' GROUP BY forma_pagamento`
  );
  const [[rec]] = await pool.query(
    `SELECT SUM(tipo_doacao = 'RECORRENTE') AS recorrentes, COUNT(*) AS total,
            SUM(status_pagamento = 'PENDENTE') AS pendentes, COALESCE(AVG(CASE WHEN status_pagamento = 'CONFIRMADO' THEN valor END), 0) AS ticket
     FROM doacoes_financeiras`
  );
  return {
    porForma: porForma.map((r) => ({ forma: r.forma, qtd: Number(r.qtd), total: Number(r.total) })),
    recorrentes: Number(rec.recorrentes || 0),
    total: Number(rec.total || 0),
    pendentes: Number(rec.pendentes || 0),
    ticketMedio: Math.round(Number(rec.ticket) * 100) / 100,
  };
}

// Recomendações em linguagem natural geradas a partir dos indicadores.
function recomendacoes({ doacoes, materiais, voluntarios, perfil }) {
  const r = [];
  if (!doacoes.suficiente) r.push("Ainda há poucos meses de doações confirmadas para prever a arrecadação. Confirme os pagamentos no menu Doações para alimentar o modelo.");
  else if (doacoes.tendencia === "QUEDA") r.push(`A arrecadação está em queda (${doacoes.variacaoMensalPercentual}% ao mês). Vale divulgar uma campanha nas redes sociais.`);
  else if (doacoes.tendencia === "ALTA") r.push(`A arrecadação está em alta (+${doacoes.variacaoMensalPercentual}% ao mês). Bom momento para lançar a próxima meta!`);

  const criticos = materiais.filter((m) => m.nivel === "CRITICO");
  if (criticos.length) r.push(`${criticos.length} item(ns) sem nenhuma entrada nos últimos 30 dias: ${criticos.slice(0, 3).map((m) => m.item).join(", ")}. Priorize-os na divulgação.`);

  if (voluntarios.pendentes > 0) r.push(`${voluntarios.pendentes} inscrição(ões) de voluntário aguardando análise.`);
  if (perfil.pendentes > 0) r.push(`${perfil.pendentes} doação(ões) com pagamento pendente de confirmação.`);
  if (perfil.total > 0 && perfil.recorrentes / perfil.total < 0.2) r.push("Menos de 20% das doações são mensais. Incentivar o apadrinhamento traz uma renda mais previsível.");
  if (!r.length) r.push("Tudo em dia! Nenhum ponto de atenção no momento.");
  return r;
}

async function gerarInsights() {
  const [doacoes, materiais, voluntarios, perfil] = await Promise.all([
    previsaoDoacoes(), alertasMateriais(), perfilVoluntarios(), perfilDoacoes(),
  ]);
  return { doacoes, materiais, voluntarios, perfilDoacoes: perfil, recomendacoes: recomendacoes({ doacoes, materiais, voluntarios, perfil }) };
}

module.exports = { gerarInsights, regressaoLinear };
