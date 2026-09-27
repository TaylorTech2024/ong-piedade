// Sistema de recomendação de voluntários para uma escala.
// Nota de 0 a 100 combinando três critérios:
//  • 50% afinidade: semelhança (cosseno) entre a atividade e a área de
//    interesse/profissão do voluntário;
//  • 30% disponibilidade: o dia da semana e o turno batem com o que ele informou;
//  • 20% equilíbrio: quem teve menos horas de escala nos últimos 30 dias é priorizado.
// Voluntários com outra escala no mesmo horário são descartados.
const { pool } = require("../db/pool");
const { tokens, normalizar } = require("./texto");

const DIAS = [
  ["domingo", "dom"], ["segunda", "seg"], ["terca", "ter"], ["quarta", "qua"],
  ["quinta", "qui"], ["sexta", "sex"], ["sabado", "sab"],
];

function cosseno(a, b) {
  const va = new Map();
  const vb = new Map();
  a.forEach((t) => va.set(t, (va.get(t) || 0) + 1));
  b.forEach((t) => vb.set(t, (vb.get(t) || 0) + 1));
  let dot = 0;
  for (const [t, v] of va) dot += v * (vb.get(t) || 0);
  const na = Math.sqrt([...va.values()].reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt([...vb.values()].reduce((s, v) => s + v * v, 0));
  return na && nb ? dot / (na * nb) : 0;
}

// Compara o texto livre de disponibilidade ("sábados pela manhã", "fins de semana", "qualquer dia")
// com o dia e o turno da escala. Retorna 0 a 1.
function notaDisponibilidade(texto, dataInicio) {
  const t = normalizar(texto);
  if (/qualquer|livre|flexiv|todos os dias|integral/.test(t)) return 1;

  const [data, hora] = dataInicio.split(" ");
  const [a, m, d] = data.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  const h = Number(hora.slice(0, 2));
  const turno = h < 12 ? "manha" : h < 18 ? "tarde" : "noite";

  const citaDia = DIAS.some(([nome, abrev]) => new RegExp(`\\b(${nome}|${abrev})`).test(t)) || /fi[mn]s? de semana|semana|uteis/.test(t);
  const diaOk =
    new RegExp(`\\b(${DIAS[diaSemana][0]}|${DIAS[diaSemana][1]})`).test(t) ||
    (/fi[mn]s? de semana/.test(t) && (diaSemana === 0 || diaSemana === 6)) ||
    (/(dias? uteis|durante a semana|semana)/.test(t) && !/fi[mn]s? de semana/.test(t) && diaSemana >= 1 && diaSemana <= 5);
  const citaTurno = /manha|tarde|noite/.test(t);
  const turnoOk = t.includes(turno);

  const nDia = citaDia ? (diaOk ? 1 : 0) : 0.5; // não informou o dia: neutro
  const nTurno = citaTurno ? (turnoOk ? 1 : 0) : 0.5;
  return nDia * 0.6 + nTurno * 0.4;
}

async function sugerirVoluntarios({ atividade, dataInicio, dataFim }) {
  const [voluntarios] = await pool.query(
    `SELECT v.id, v.nome, v.telefone, v.area_interesse, v.especialidade_profissao, v.disponibilidade,
            COALESCE((SELECT SUM(TIMESTAMPDIFF(MINUTE, e.data_inicio, e.data_fim)) FROM escalas_voluntarios e
                      WHERE e.voluntario_id = v.id AND e.data_inicio >= NOW() - INTERVAL 30 DAY), 0) AS minutos_30d,
            EXISTS(SELECT 1 FROM escalas_voluntarios e
                   WHERE e.voluntario_id = v.id AND e.data_inicio < ? AND e.data_fim > ?) AS conflito
     FROM voluntarios v WHERE v.status = 'APROVADO'`,
    [dataFim, dataInicio]
  );

  const tAtividade = tokens(atividade);
  const maxMin = Math.max(1, ...voluntarios.map((v) => Number(v.minutos_30d)));

  return voluntarios
    .filter((v) => !Number(v.conflito))
    .map((v) => {
      const afinidade = cosseno(tAtividade, tokens(`${v.area_interesse} ${v.especialidade_profissao || ""}`));
      const disponibilidade = notaDisponibilidade(v.disponibilidade, dataInicio);
      const equilibrio = 1 - Number(v.minutos_30d) / maxMin;
      const nota = Math.round((afinidade * 0.5 + disponibilidade * 0.3 + equilibrio * 0.2) * 100);

      const motivos = [];
      if (afinidade >= 0.3) motivos.push(`perfil combina com a atividade (${v.area_interesse}${v.especialidade_profissao ? ", " + v.especialidade_profissao : ""})`);
      if (disponibilidade >= 0.8) motivos.push("disponível neste dia/turno");
      else if (disponibilidade < 0.4) motivos.push("disponibilidade informada não bate com o horário");
      if (Number(v.minutos_30d) === 0) motivos.push("ainda não participou de escalas no último mês");

      return {
        voluntarioId: v.id, nome: v.nome, telefone: v.telefone, areaInteresse: v.area_interesse,
        disponibilidade: v.disponibilidade, nota, motivos,
      };
    })
    .sort((a, b) => b.nota - a.nota)
    .slice(0, 5);
}

module.exports = { sugerirVoluntarios, notaDisponibilidade, cosseno };
