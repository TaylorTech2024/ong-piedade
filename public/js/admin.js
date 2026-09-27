// ==========================================
// Painel administrativo (RF06, RF09, RF11, RF12, RF13, RF15)
// ==========================================
if (!sessao.token()) window.location.href = "login.html";

const PERFIL = (sessao.usuario() || {}).perfil;
const ROTULOS = {
  geral: "Visão Geral", insights: "Insights (IA)", doacoes: "Doações", doadores: "Doadores", campanhas: "Campanhas",
  voluntarios: "Voluntários", escalas: "Escalas", relatorios: "Relatórios", usuarios: "Usuários",
};
const FORMAS = { PIX: "PIX", CARTAO_CREDITO: "Cartão", BOLETO: "Boleto" };
const BADGE = {
  PENDENTE: "pending", CONFIRMADO: "active", APROVADO: "active", CANCELADO: "danger", FALHOU: "danger",
  REPROVADO: "danger", EM_ANDAMENTO: "info", CONCLUIDO: "active", CRITICO: "danger", ATENCAO: "pending", OK: "active",
};
const badge = (status, texto) => `<span class="badge ${BADGE[status] || "neutral"}">${esc(texto || status.replace("_", " "))}</span>`;
const vazio = (colunas, texto = "Nenhum registro encontrado.") => `<tr class="empty-row"><td colspan="${colunas}">${texto}</td></tr>`;
const erroLinha = (colunas, err) => `<tr class="empty-row"><td colspan="${colunas}" style="color:#c94a4a">${esc(err.message)}</td></tr>`;

function toast(texto) {
  if (!window.Swal) return;
  Swal.fire({ toast: true, position: "top-end", icon: "success", title: texto, timer: 2200, showConfirmButton: false });
}

async function confirmar(titulo, texto, botao = "Confirmar") {
  const r = await Swal.fire({ icon: "warning", title: titulo, text: texto, showCancelButton: true, confirmButtonText: botao, cancelButtonText: "Cancelar", confirmButtonColor: "#df7b7b" });
  return r.isConfirmed;
}

// Executa uma ação da API mostrando o erro, se houver. Retorna true se deu certo.
async function executar(fn, sucesso) {
  try {
    const r = await fn();
    toast(sucesso || (r && r.message) || "Salvo!");
    return true;
  } catch (err) {
    alerta("error", "Não foi possível concluir", err.message);
    return false;
  }
}

// Formulário em modal gerado a partir de uma lista de campos.
// campo: { nome, rotulo, tipo: text|email|number|date|datetime-local|textarea|select|checkbox|password|file, opcoes: [[valor, texto]], obrigatorio, attrs }
async function formulario(titulo, campos, valores = {}, { botao = "Salvar", didOpen } = {}) {
  const html = campos.map((c) => {
    const v = valores[c.nome] ?? "";
    const id = `f_${c.nome}`;
    const req = c.obrigatorio ? " *" : "";
    const attrs = c.attrs || "";
    if (c.tipo === "checkbox") return `<label class="check"><input type="checkbox" id="${id}" ${v === true || v === undefined && c.padrao ? "checked" : ""}> ${esc(c.rotulo)}</label>`;
    if (c.tipo === "textarea") return `<label>${esc(c.rotulo)}${req}<textarea id="${id}" ${attrs}>${esc(v)}</textarea></label>`;
    if (c.tipo === "select") {
      const ops = c.opcoes.map(([val, txt]) => `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(txt)}</option>`).join("");
      return `<label>${esc(c.rotulo)}${req}<select id="${id}" ${attrs}>${ops}</select></label>`;
    }
    if (c.tipo === "html") return c.html;
    return `<label>${esc(c.rotulo)}${req}<input type="${c.tipo || "text"}" id="${id}" value="${esc(v)}" ${attrs}></label>`;
  }).join("");

  const { value } = await Swal.fire({
    title: titulo,
    html: `<div class="swal-form">${html}</div>`,
    width: 560,
    showCancelButton: true,
    confirmButtonText: botao,
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#75c5ad",
    focusConfirm: false,
    didOpen,
    preConfirm: () => {
      const saida = {};
      for (const c of campos) {
        if (c.tipo === "html") continue;
        const el = document.getElementById(`f_${c.nome}`);
        if (c.tipo === "checkbox") saida[c.nome] = el.checked;
        else if (c.tipo === "file") saida[c.nome] = el.files[0] || null;
        else saida[c.nome] = el.value.trim() === "" ? null : el.value.trim();
        if (c.obrigatorio && (saida[c.nome] === null || saida[c.nome] === "")) {
          Swal.showValidationMessage(`Preencha: ${c.rotulo}`);
          return false;
        }
      }
      return saida;
    },
  });
  return value || null;
}

// ---------- Navegação entre seções ----------
const carregadores = {};
function abrirSecao(secao) {
  if (secao === "usuarios" && PERFIL !== "ADMINISTRADOR") secao = "geral";
  document.querySelectorAll(".admin-nav a").forEach((a) => a.classList.toggle("active", a.dataset.secao === secao));
  document.querySelectorAll(".admin-section").forEach((s) => s.classList.toggle("active", s.dataset.secao === secao));
  document.querySelector("#tituloSecao").textContent = ROTULOS[secao];
  history.replaceState(null, "", `#${secao}`);
  if (carregadores[secao]) carregadores[secao]();
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const { user } = await api("/api/auth/me");
    sessao.salvar(sessao.token(), user);
    document.querySelector("#adminNome").textContent = user.nome;
    document.querySelector("#adminAvatar").textContent = user.nome.charAt(0).toUpperCase();
    if (user.perfil === "ADMINISTRADOR") document.querySelector("[data-somente-admin]").classList.remove("hidden");
  } catch {
    return;
  }

  document.querySelectorAll(".admin-nav a").forEach((a) => a.addEventListener("click", () => abrirSecao(a.dataset.secao)));
  document.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => abrirSecao(b.dataset.ir)));
  document.querySelector("#btnSair").addEventListener("click", (e) => {
    e.preventDefault();
    sessao.limpar();
    window.location.href = "index.html";
  });
  document.querySelector("#filtroDoacoes").addEventListener("change", carregadores.doacoes);
  document.querySelector("#filtroVoluntarios").addEventListener("change", carregadores.voluntarios);
  document.querySelector("#btnNovaCampanha").addEventListener("click", () => editarCampanha());
  document.querySelector("#btnNovaNecessidade").addEventListener("click", () => editarNecessidade());
  document.querySelector("#btnNovaEscala").addEventListener("click", () => editarEscala());
  document.querySelector("#btnNovoRelatorio").addEventListener("click", () => editarRelatorio());
  document.querySelector("#btnNovoUsuario").addEventListener("click", () => editarUsuario());

  const inicial = location.hash.slice(1);
  abrirSecao(ROTULOS[inicial] ? inicial : "geral");
});

// Liga os botões [data-acao] de uma tabela às funções informadas.
function ligarAcoes(tbody, acoes) {
  tbody.querySelectorAll("[data-acao]").forEach((b) =>
    b.addEventListener("click", () => acoes[b.dataset.acao](Number(b.dataset.id), b))
  );
}

// ---------- VISÃO GERAL ----------
carregadores.geral = async () => {
  const tb = document.querySelector("#tbPendentes");
  try {
    const [m, { voluntarios }] = await Promise.all([api("/api/admin/metricas"), api("/api/admin/voluntarios?status=PENDENTE")]);
    document.querySelector("#mVoluntarios").textContent = fmt.numero(m.voluntariosAtivos);
    document.querySelector("#mDoacoes").textContent = fmt.moeda(m.doacoesMesConfirmado);
    document.querySelector("#mItens").textContent = fmt.numero(m.materiaisRecebidos);
    document.querySelector("#mPendencias").textContent = fmt.numero(m.voluntariosPendentes);
    document.querySelector("#mPendencias").title = `${m.voluntariosPendentes} voluntário(s) e ${fmt.moeda(m.doacoesMesPendente)} em doações pendentes`;
    tb.innerHTML = voluntarios.length
      ? voluntarios.slice(0, 8).map((v) => `<tr><td>${esc(v.nome)}<small>${esc(v.email)}</small></td><td>${esc(v.areaInteresse)}</td><td>${esc(v.disponibilidade)}</td>
          <td><div class="acoes"><button class="btn-action" data-acao="aprovar" data-id="${v.id}">Aprovar</button><button class="btn-action danger" data-acao="reprovar" data-id="${v.id}">Reprovar</button></div></td></tr>`).join("")
      : vazio(4, "Nenhuma inscrição aguardando análise. 🎉");
    ligarAcoes(tb, { aprovar: (id) => mudarStatusVoluntario(id, "APROVADO"), reprovar: (id) => mudarStatusVoluntario(id, "REPROVADO") });
  } catch (err) {
    tb.innerHTML = erroLinha(4, err);
  }
};

// ---------- INSIGHTS (IA) ----------
carregadores.insights = async () => {
  try {
    const d = await api("/api/admin/insights");
    document.querySelector("#iaRecomendacoes").innerHTML = d.recomendacoes.map((r) => `<li>${esc(r)}</li>`).join("");

    const p = d.doacoes;
    const tendencia = { ALTA: "📈 Alta", QUEDA: "📉 Queda", ESTAVEL: "➡️ Estável" };
    document.querySelector("#iaKpis").innerHTML = p.suficiente
      ? `<div><span>Previsão próximo mês</span><strong>${fmt.moeda(p.previsaoProximoMes)}</strong></div>
         <div><span>Tendência</span><strong>${tendencia[p.tendencia]} (${p.variacaoMensalPercentual > 0 ? "+" : ""}${p.variacaoMensalPercentual}%/mês)</strong></div>
         <div><span>Confiabilidade (R²)</span><strong>${p.confiabilidade} · ${p.r2}</strong></div>
         <div><span>Ticket médio</span><strong>${fmt.moeda(d.perfilDoacoes.ticketMedio)}</strong></div>`
      : `<div><span>Previsão</span><strong>Dados insuficientes</strong></div><div><span>Ticket médio</span><strong>${fmt.moeda(d.perfilDoacoes.ticketMedio)}</strong></div>`;

    const barras = p.serie.map((s) => ({ rotulo: s.rotulo, valor: s.total, previsao: false }));
    if (p.suficiente) barras.push({ rotulo: "previsão", valor: p.previsaoProximoMes, previsao: true });
    const max = Math.max(1, ...barras.map((b) => b.valor));
    document.querySelector("#iaGrafico").innerHTML = barras.map((b) => `
      <div class="bar${b.previsao ? " previsao" : ""}" title="${esc(b.rotulo)}: ${fmt.moeda(b.valor)}">
        <em>${b.valor ? fmt.moeda(b.valor).replace(",00", "") : ""}</em>
        <i style="height:${Math.max(1, (b.valor / max) * 150)}px"></i>
        <small>${esc(b.rotulo)}</small>
      </div>`).join("");

    const rotuloNivel = { CRITICO: "Crítico", ATENCAO: "Atenção", OK: "No ritmo" };
    document.querySelector("#iaMateriais").innerHTML = d.materiais.length
      ? d.materiais.map((m) => `<tr><td>${esc(m.item)}<small>${m.percentual}% recebido</small></td><td>${fmt.numero(m.restante)}</td>
          <td>${m.diasParaCompletar === null ? "Sem entradas em 30 dias" : `~${m.diasParaCompletar} dia(s)`}</td><td>${badge(m.nivel, rotuloNivel[m.nivel])}</td></tr>`).join("")
      : vazio(4, "Nenhuma necessidade em aberto.");

    const hbar = (rotulo, valor, total) => `<div class="hbar"><span>${esc(rotulo)}</span><div><i style="width:${total ? (valor / total) * 100 : 0}%"></i></div><b>${valor}</b></div>`;
    const v = d.voluntarios;
    const totalVol = v.porArea.reduce((s, a) => s + a.total, 0);
    document.querySelector("#iaVoluntarios").innerHTML = (v.porArea.length ? v.porArea.map((a) => hbar(a.area, a.total, totalVol)).join("") : `<p class="text-muted">Sem inscrições ainda.</p>`)
      + `<p class="text-muted">Taxa de aprovação: <b>${v.taxaAprovacao === null ? "—" : v.taxaAprovacao + "%"}</b> · Pendentes: <b>${v.pendentes}</b></p>`;
    const totalFormas = d.perfilDoacoes.porForma.reduce((s, f) => s + f.qtd, 0);
    document.querySelector("#iaFormas").innerHTML = d.perfilDoacoes.porForma.length
      ? d.perfilDoacoes.porForma.map((f) => hbar(FORMAS[f.forma], f.qtd, totalFormas)).join("")
      : `<p class="text-muted">Nenhuma doação confirmada ainda.</p>`;
  } catch (err) {
    document.querySelector("#iaRecomendacoes").innerHTML = `<li>${esc(err.message)}</li>`;
  }
};

// ---------- DOAÇÕES ----------
carregadores.doacoes = async () => {
  const tb = document.querySelector("#tbDoacoes");
  const status = document.querySelector("#filtroDoacoes").value;
  try {
    const { doacoes } = await api(`/api/admin/doacoes${status ? `?status=${status}` : ""}`);
    tb.innerHTML = doacoes.length
      ? doacoes.map((d) => `<tr>
          <td>${fmt.dataHora(d.dataDoacao)}</td>
          <td>${d.doador ? `${esc(d.doador.nome)}<small>${esc(d.doador.email)}</small>` : "<i>Doador excluído</i>"}</td>
          <td><b>${fmt.moeda(d.valor)}</b></td>
          <td>${d.tipoDoacao === "RECORRENTE" ? "Mensal" : "Única"}</td>
          <td>${FORMAS[d.formaPagamento]}${d.transacaoId ? `<small>${esc(d.transacaoId)}</small>` : ""}</td>
          <td>${badge(d.statusPagamento)}</td>
          <td><div class="acoes">${d.statusPagamento !== "CONFIRMADO" ? `<button class="btn-action" data-acao="confirmar" data-id="${d.id}">Confirmar</button>` : ""}
            <button class="btn-action secondary" data-acao="status" data-id="${d.id}">Alterar</button></div></td>
        </tr>`).join("")
      : vazio(7);
    ligarAcoes(tb, {
      confirmar: async (id) => {
        const r = await formulario("Confirmar pagamento", [{ nome: "transacaoId", rotulo: "Código da transação / comprovante (opcional)" }], {}, { botao: "Confirmar" });
        if (r && (await executar(() => api(`/api/admin/doacoes/${id}`, { method: "PATCH", body: { statusPagamento: "CONFIRMADO", transacaoId: r.transacaoId } }), "Doação confirmada!"))) carregadores.doacoes();
      },
      status: async (id) => {
        const atual = doacoes.find((d) => d.id === id);
        const r = await formulario("Alterar status do pagamento", [
          { nome: "statusPagamento", rotulo: "Status", tipo: "select", opcoes: [["PENDENTE", "Pendente"], ["CONFIRMADO", "Confirmado"], ["CANCELADO", "Cancelado"], ["FALHOU", "Falhou"]] },
          { nome: "transacaoId", rotulo: "Código da transação" },
        ], atual);
        if (r && (await executar(() => api(`/api/admin/doacoes/${id}`, { method: "PATCH", body: r })))) carregadores.doacoes();
      },
    });
  } catch (err) {
    tb.innerHTML = erroLinha(7, err);
  }
};

// ---------- DOADORES ----------
carregadores.doadores = async () => {
  const tb = document.querySelector("#tbDoadores");
  try {
    const { doadores } = await api("/api/admin/doadores");
    tb.innerHTML = doadores.length
      ? doadores.map((d) => `<tr>
          <td>${esc(d.nomeRazaoSocial)}<small>${d.tipoPessoa === "PJ" ? "Pessoa jurídica" : "Pessoa física"} · desde ${fmt.data(d.criadoEm)}</small></td>
          <td>${esc(d.email)}<small>${esc(fmt.telefone(d.telefone))}</small></td>
          <td>${esc(fmt.documento(d.cpfCnpj))}</td>
          <td>${d.qtdDoacoes}</td>
          <td>${fmt.moeda(d.totalConfirmado)}</td>
          <td><div class="acoes"><button class="btn-action secondary" data-acao="editar" data-id="${d.id}">Editar</button><button class="btn-action danger" data-acao="excluir" data-id="${d.id}">Excluir</button></div></td>
        </tr>`).join("")
      : vazio(6);
    ligarAcoes(tb, {
      editar: async (id) => {
        const d = doadores.find((x) => x.id === id);
        const r = await formulario("Editar doador", [
          { nome: "tipoPessoa", rotulo: "Tipo", tipo: "select", opcoes: [["PF", "Pessoa física"], ["PJ", "Pessoa jurídica"]] },
          { nome: "nomeRazaoSocial", rotulo: "Nome / Razão social", obrigatorio: true },
          { nome: "email", rotulo: "E-mail", tipo: "email", obrigatorio: true },
          { nome: "telefone", rotulo: "Telefone" },
          { nome: "cpfCnpj", rotulo: "CPF/CNPJ" },
        ], d);
        if (r && (await executar(() => api(`/api/admin/doadores/${id}`, { method: "PUT", body: r })))) carregadores.doadores();
      },
      excluir: async (id) => {
        if (await confirmar("Excluir doador?", "As doações dele continuam registradas, mas sem vínculo com o cadastro.", "Excluir")) {
          if (await executar(() => api(`/api/admin/doadores/${id}`, { method: "DELETE" }))) carregadores.doadores();
        }
      },
    });
  } catch (err) {
    tb.innerHTML = erroLinha(6, err);
  }
};

// ---------- CAMPANHAS E NECESSIDADES ----------
let cacheCampanhas = [];
carregadores.campanhas = async () => {
  const tbC = document.querySelector("#tbCampanhas");
  const tbN = document.querySelector("#tbNecessidades");
  try {
    const [{ campanhas }, { necessidades }] = await Promise.all([api("/api/admin/campanhas"), api("/api/admin/necessidades")]);
    cacheCampanhas = campanhas;
    tbC.innerHTML = campanhas.length
      ? campanhas.map((c) => `<tr>
          <td><b>${esc(c.titulo)}</b>${c.descricao ? `<small>${esc(c.descricao.slice(0, 90))}${c.descricao.length > 90 ? "…" : ""}</small>` : ""}</td>
          <td>${fmt.dia(c.dataInicio)}<small>até ${c.dataFim ? fmt.dia(c.dataFim) : "sem data de fim"}</small></td>
          <td>${c.metaValor ? fmt.moeda(c.metaValor) : "—"}</td>
          <td>${c.qtdNecessidades}</td>
          <td>${c.ativa ? badge("APROVADO", "Ativa") : badge("CANCELADO", "Inativa")}</td>
          <td><div class="acoes"><button class="btn-action secondary" data-acao="editar" data-id="${c.id}">Editar</button><button class="btn-action danger" data-acao="excluir" data-id="${c.id}">Excluir</button></div></td>
        </tr>`).join("")
      : vazio(6, "Nenhuma campanha cadastrada.");
    ligarAcoes(tbC, {
      editar: (id) => editarCampanha(campanhas.find((c) => c.id === id)),
      excluir: async (id) => {
        if (await confirmar("Excluir campanha?", "As necessidades dela continuam cadastradas como \"Outras necessidades\".", "Excluir")) {
          if (await executar(() => api(`/api/admin/campanhas/${id}`, { method: "DELETE" }))) carregadores.campanhas();
        }
      },
    });

    tbN.innerHTML = necessidades.length
      ? necessidades.map((n) => {
          const pct = Math.min(100, Math.round((n.qtdRecebida / n.qtdNecessaria) * 100));
          return `<tr>
            <td><b>${esc(n.item)}</b><small>📍 ${esc(n.pontoColeta)}</small></td>
            <td>${esc(n.campanhaTitulo || "—")}</td>
            <td style="min-width:160px"><div class="progress"><span style="width:${pct}%"></span></div><small>${fmt.numero(n.qtdRecebida)} de ${fmt.numero(n.qtdNecessaria)} (faltam ${fmt.numero(n.qtdRestante)})</small></td>
            <td>${badge(n.status, n.status === "CONCLUIDO" ? "Concluído" : "Em andamento")}</td>
            <td><div class="acoes"><button class="btn-action" data-acao="receber" data-id="${n.id}">+ Entrada</button><button class="btn-action secondary" data-acao="editar" data-id="${n.id}">Editar</button><button class="btn-action danger" data-acao="excluir" data-id="${n.id}">Excluir</button></div></td>
          </tr>`;
        }).join("")
      : vazio(5, "Nenhuma necessidade cadastrada.");
    ligarAcoes(tbN, {
      receber: async (id) => {
        const n = necessidades.find((x) => x.id === id);
        const r = await formulario(`Entrada de "${n.item}"`, [
          { nome: "quantidade", rotulo: "Quantidade recebida (use negativo para corrigir)", tipo: "number", obrigatorio: true, attrs: 'step="1"' },
        ], {}, { botao: "Registrar" });
        if (r && (await executar(() => api(`/api/admin/necessidades/${id}/recebimento`, { method: "POST", body: { quantidade: Number(r.quantidade) } })))) carregadores.campanhas();
      },
      editar: (id) => editarNecessidade(necessidades.find((x) => x.id === id)),
      excluir: async (id) => {
        if (await confirmar("Excluir necessidade?", "O item deixa de aparecer no site.", "Excluir")) {
          if (await executar(() => api(`/api/admin/necessidades/${id}`, { method: "DELETE" }))) carregadores.campanhas();
        }
      },
    });
  } catch (err) {
    tbC.innerHTML = erroLinha(6, err);
  }
};

async function editarCampanha(c) {
  const r = await formulario(c ? "Editar campanha" : "Nova campanha", [
    { nome: "titulo", rotulo: "Título", obrigatorio: true, attrs: 'maxlength="150"' },
    { nome: "descricao", rotulo: "Descrição", tipo: "textarea" },
    { nome: "metaValor", rotulo: "Meta de arrecadação (R$)", tipo: "number", attrs: 'min="0" step="0.01"' },
    { nome: "dataInicio", rotulo: "Data de início", tipo: "date", obrigatorio: true },
    { nome: "dataFim", rotulo: "Data de fim (opcional)", tipo: "date" },
    { nome: "ativa", rotulo: "Campanha ativa (aparece no site)", tipo: "checkbox", padrao: true },
  ], c || { dataInicio: new Date().toISOString().slice(0, 10) });
  if (!r) return;
  const ok = await executar(() => api(c ? `/api/admin/campanhas/${c.id}` : "/api/admin/campanhas", { method: c ? "PUT" : "POST", body: r }));
  if (ok) carregadores.campanhas();
}

async function editarNecessidade(n) {
  if (!cacheCampanhas.length) cacheCampanhas = (await api("/api/admin/campanhas")).campanhas;
  const r = await formulario(n ? "Editar necessidade" : "Nova necessidade de material", [
    { nome: "item", rotulo: "Item", obrigatorio: true, attrs: 'maxlength="100" placeholder="Ex.: Fraldas tamanho G"' },
    { nome: "descricao", rotulo: "Descrição", tipo: "textarea" },
    { nome: "campanhaId", rotulo: "Campanha", tipo: "select", opcoes: [["", "— Sem campanha (necessidade geral) —"], ...cacheCampanhas.map((c) => [c.id, c.titulo])] },
    { nome: "qtdNecessaria", rotulo: "Quantidade necessária", tipo: "number", obrigatorio: true, attrs: 'min="1" step="1"' },
    { nome: "qtdRecebida", rotulo: "Quantidade já recebida", tipo: "number", attrs: 'min="0" step="1"' },
    { nome: "pontoColeta", rotulo: "Ponto de coleta", obrigatorio: true, attrs: 'maxlength="255"' },
  ], n || { qtdRecebida: 0, pontoColeta: "Sede da Associação - Av. Ayrton Senna da Silva, 1100 - Piedade, Jaboatão dos Guararapes - PE" });
  if (!r) return;
  const corpo = { ...r, campanhaId: r.campanhaId ? Number(r.campanhaId) : null, qtdNecessaria: Number(r.qtdNecessaria), qtdRecebida: Number(r.qtdRecebida || 0) };
  const ok = await executar(() => api(n ? `/api/admin/necessidades/${n.id}` : "/api/admin/necessidades", { method: n ? "PUT" : "POST", body: corpo }));
  if (ok) carregadores.campanhas();
}

// ---------- VOLUNTÁRIOS ----------
async function mudarStatusVoluntario(id, status) {
  let observacoesAdmin = null;
  if (status === "REPROVADO") {
    const r = await formulario("Reprovar voluntário", [{ nome: "obs", rotulo: "Motivo / observação (uso interno)", tipo: "textarea" }], {}, { botao: "Reprovar" });
    if (!r) return;
    observacoesAdmin = r.obs;
  }
  if (await executar(() => api(`/api/admin/voluntarios/${id}/status`, { method: "PATCH", body: { status, observacoesAdmin } }))) {
    document.querySelector(".admin-section.active").dataset.secao === "geral" ? carregadores.geral() : carregadores.voluntarios();
  }
}

carregadores.voluntarios = async () => {
  const tb = document.querySelector("#tbVoluntarios");
  const status = document.querySelector("#filtroVoluntarios").value;
  try {
    const { voluntarios } = await api(`/api/admin/voluntarios${status ? `?status=${status}` : ""}`);
    tb.innerHTML = voluntarios.length
      ? voluntarios.map((v) => `<tr>
          <td><b>${esc(v.nome)}</b><small>inscrito em ${fmt.data(v.cadastradoEm)}${v.qtdEscalas ? ` · ${v.qtdEscalas} escala(s)` : ""}</small></td>
          <td>${esc(v.email)}<small>${esc(fmt.telefone(v.telefone))}</small></td>
          <td>${esc(v.areaInteresse)}<small>${esc(v.especialidadeProfissao || "")}</small></td>
          <td>${esc(v.disponibilidade)}</td>
          <td>${badge(v.status)}${v.observacoesAdmin ? `<small title="${esc(v.observacoesAdmin)}">📝 ${esc(v.observacoesAdmin.slice(0, 40))}</small>` : ""}</td>
          <td><div class="acoes">
            ${v.status !== "APROVADO" ? `<button class="btn-action" data-acao="aprovar" data-id="${v.id}">Aprovar</button>` : ""}
            ${v.status !== "REPROVADO" ? `<button class="btn-action warn" data-acao="reprovar" data-id="${v.id}">Reprovar</button>` : ""}
            <button class="btn-action secondary" data-acao="editar" data-id="${v.id}">Editar</button>
            <button class="btn-action danger" data-acao="excluir" data-id="${v.id}">Excluir</button>
          </div></td>
        </tr>`).join("")
      : vazio(6);
    ligarAcoes(tb, {
      aprovar: (id) => mudarStatusVoluntario(id, "APROVADO"),
      reprovar: (id) => mudarStatusVoluntario(id, "REPROVADO"),
      editar: async (id) => {
        const v = voluntarios.find((x) => x.id === id);
        const r = await formulario("Editar voluntário", [
          { nome: "nome", rotulo: "Nome", obrigatorio: true },
          { nome: "email", rotulo: "E-mail", tipo: "email", obrigatorio: true },
          { nome: "telefone", rotulo: "Telefone", obrigatorio: true },
          { nome: "especialidadeProfissao", rotulo: "Especialidade / profissão" },
          { nome: "areaInteresse", rotulo: "Área de interesse", obrigatorio: true },
          { nome: "disponibilidade", rotulo: "Disponibilidade", obrigatorio: true },
          { nome: "observacoesAdmin", rotulo: "Observações (uso interno)", tipo: "textarea" },
        ], v);
        if (r && (await executar(() => api(`/api/admin/voluntarios/${id}`, { method: "PUT", body: r })))) carregadores.voluntarios();
      },
      excluir: async (id) => {
        if (await confirmar("Excluir voluntário?", "As escalas dele também serão excluídas.", "Excluir")) {
          if (await executar(() => api(`/api/admin/voluntarios/${id}`, { method: "DELETE" }))) carregadores.voluntarios();
        }
      },
    });
  } catch (err) {
    tb.innerHTML = erroLinha(6, err);
  }
};

// ---------- ESCALAS (com sugestão da IA) ----------
carregadores.escalas = async () => {
  const tb = document.querySelector("#tbEscalas");
  try {
    const { escalas } = await api("/api/admin/escalas");
    tb.innerHTML = escalas.length
      ? escalas.map((e) => `<tr>
          <td><b>${fmt.diaHora(e.dataInicio)}</b><small>até ${fmt.diaHora(e.dataFim)}</small></td>
          <td>${esc(e.atividade)}</td>
          <td>${esc(e.voluntarioNome)}<small>${esc(fmt.telefone(e.voluntarioTelefone))}</small></td>
          <td>${esc(e.local || "—")}</td>
          <td><div class="acoes"><button class="btn-action secondary" data-acao="editar" data-id="${e.id}">Editar</button><button class="btn-action danger" data-acao="excluir" data-id="${e.id}">Excluir</button></div></td>
        </tr>`).join("")
      : vazio(5, "Nenhuma escala cadastrada.");
    ligarAcoes(tb, {
      editar: (id) => editarEscala(escalas.find((e) => e.id === id)),
      excluir: async (id) => {
        if (await confirmar("Excluir escala?", "", "Excluir")) {
          if (await executar(() => api(`/api/admin/escalas/${id}`, { method: "DELETE" }))) carregadores.escalas();
        }
      },
    });
  } catch (err) {
    tb.innerHTML = erroLinha(5, err);
  }
};

async function editarEscala(e) {
  const { voluntarios } = await api("/api/admin/voluntarios?status=APROVADO");
  if (!voluntarios.length) return alerta("info", "Nenhum voluntário aprovado", "Aprove voluntários antes de montar escalas.");
  const paraInput = (d) => (d ? d.slice(0, 16).replace(" ", "T") : "");
  const valores = e ? { ...e, dataInicio: paraInput(e.dataInicio), dataFim: paraInput(e.dataFim) } : {};

  const r = await formulario(e ? "Editar escala" : "Nova escala", [
    { nome: "atividade", rotulo: "Atividade", obrigatorio: true, attrs: 'maxlength="150" placeholder="Ex.: Reforço escolar"' },
    { nome: "dataInicio", rotulo: "Início", tipo: "datetime-local", obrigatorio: true },
    { nome: "dataFim", rotulo: "Fim", tipo: "datetime-local", obrigatorio: true },
    { nome: "local", rotulo: "Local", attrs: 'maxlength="200"' },
    { nome: "html", tipo: "html", html: `<div><button type="button" class="btn-action" id="btnSugerir" style="background:#8b5cf6">✨ Sugerir voluntários com IA</button><div class="sugestoes" id="listaSugestoes"></div></div>` },
    { nome: "voluntarioId", rotulo: "Voluntário", tipo: "select", obrigatorio: true, opcoes: [["", "Selecione..."], ...voluntarios.map((v) => [v.id, `${v.nome} — ${v.areaInteresse}`])] },
  ], valores, {
    didOpen: () => {
      document.querySelector("#btnSugerir").addEventListener("click", async () => {
        const lista = document.querySelector("#listaSugestoes");
        const q = {
          atividade: document.querySelector("#f_atividade").value.trim(),
          dataInicio: document.querySelector("#f_dataInicio").value,
          dataFim: document.querySelector("#f_dataFim").value,
        };
        if (!q.atividade || !q.dataInicio || !q.dataFim) {
          lista.innerHTML = `<small style="color:#c94a4a">Preencha atividade, início e fim para a IA sugerir.</small>`;
          return;
        }
        lista.innerHTML = "<small>Analisando perfis...</small>";
        try {
          const { sugestoes } = await api(`/api/admin/escalas/sugestoes?${new URLSearchParams(q)}`);
          if (!sugestoes.length) {
            lista.innerHTML = "<small>Nenhum voluntário livre nesse horário.</small>";
            return;
          }
          lista.innerHTML = sugestoes.map((s) => `<button type="button" class="sugestao" data-vid="${s.voluntarioId}">
            <span class="nota">${s.nota}%</span><b>${esc(s.nome)}</b><br>${esc(s.areaInteresse)} · ${esc(s.disponibilidade)}
            ${s.motivos.length ? `<br><small>${s.motivos.map(esc).join(" · ")}</small>` : ""}</button>`).join("");
          lista.querySelectorAll(".sugestao").forEach((b) => b.addEventListener("click", () => {
            lista.querySelectorAll(".sugestao").forEach((x) => x.classList.remove("selecionada"));
            b.classList.add("selecionada");
            document.querySelector("#f_voluntarioId").value = b.dataset.vid;
          }));
        } catch (err) {
          lista.innerHTML = `<small style="color:#c94a4a">${esc(err.message)}</small>`;
        }
      });
    },
  });
  if (!r) return;
  const corpo = { atividade: r.atividade, dataInicio: r.dataInicio, dataFim: r.dataFim, local: r.local, voluntarioId: Number(r.voluntarioId) };
  const ok = await executar(() => api(e ? `/api/admin/escalas/${e.id}` : "/api/admin/escalas", { method: e ? "PUT" : "POST", body: corpo }));
  if (ok) carregadores.escalas();
}

// ---------- RELATÓRIOS ----------
carregadores.relatorios = async () => {
  const tb = document.querySelector("#tbRelatorios");
  try {
    const { relatorios } = await api("/api/admin/relatorios");
    tb.innerHTML = relatorios.length
      ? relatorios.map((r) => `<tr>
          <td><b>${esc(r.titulo)}</b><small>${esc(r.periodoReferencia)}</small></td>
          <td><small>👧 ${fmt.numero(r.atendimentosRealizados)} atendimentos · 🩺 ${fmt.numero(r.atendimentosMedicos)} médicos · 📦 ${fmt.numero(r.materiaisArrecadadosQtd)} materiais</small></td>
          <td>${r.documentos.map((d) => `<div style="margin-bottom:6px"><a href="${esc(d.url)}" target="_blank" rel="noopener">📄 ${esc(d.nomeArquivo)}</a> <button class="btn-action danger" data-acao="excluirDoc" data-id="${d.id}" title="Excluir documento">×</button></div>`).join("") || "<small>Nenhum</small>"}</td>
          <td><div class="acoes">
            <button class="btn-action" data-acao="anexar" data-id="${r.id}">📎 Anexar PDF</button>
            <button class="btn-action secondary" data-acao="editar" data-id="${r.id}">Editar</button>
            <button class="btn-action danger" data-acao="excluir" data-id="${r.id}">Excluir</button>
          </div></td>
        </tr>`).join("")
      : vazio(4, "Nenhum relatório cadastrado.");
    ligarAcoes(tb, {
      editar: (id) => editarRelatorio(relatorios.find((r) => r.id === id)),
      anexar: async (id) => {
        const r = await formulario("Anexar PDF", [{ nome: "arquivo", rotulo: "Arquivo PDF (até 10 MB)", tipo: "file", obrigatorio: true, attrs: 'accept="application/pdf,.pdf"' }], {}, { botao: "Enviar" });
        if (!r) return;
        const form = new FormData();
        form.append("arquivo", r.arquivo);
        Swal.fire({ title: "Enviando...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        if (await executar(() => api(`/api/admin/relatorios/${id}/documentos`, { method: "POST", form }), "PDF publicado na Transparência!")) carregadores.relatorios();
      },
      excluirDoc: async (id) => {
        if (await confirmar("Excluir documento?", "Ele deixa de aparecer na página de Transparência.", "Excluir")) {
          if (await executar(() => api(`/api/admin/documentos/${id}`, { method: "DELETE" }))) carregadores.relatorios();
        }
      },
      excluir: async (id) => {
        if (await confirmar("Excluir relatório?", "Os PDFs anexados também serão excluídos.", "Excluir")) {
          if (await executar(() => api(`/api/admin/relatorios/${id}`, { method: "DELETE" }))) carregadores.relatorios();
        }
      },
    });
  } catch (err) {
    tb.innerHTML = erroLinha(4, err);
  }
};

async function editarRelatorio(r) {
  const v = await formulario(r ? "Editar relatório" : "Novo relatório de impacto", [
    { nome: "titulo", rotulo: "Título", obrigatorio: true, attrs: 'maxlength="150"' },
    { nome: "periodoReferencia", rotulo: "Período de referência", obrigatorio: true, attrs: 'maxlength="50" placeholder="Ex.: Janeiro/2026"' },
    { nome: "atendimentosRealizados", rotulo: "Atendimentos realizados", tipo: "number", attrs: 'min="0" step="1"' },
    { nome: "atendimentosMedicos", rotulo: "Atendimentos médicos", tipo: "number", attrs: 'min="0" step="1"' },
    { nome: "materiaisArrecadadosQtd", rotulo: "Materiais arrecadados (qtd.)", tipo: "number", attrs: 'min="0" step="1"' },
    { nome: "descricaoResultados", rotulo: "Descrição dos resultados", tipo: "textarea" },
  ], r || {});
  if (!v) return;
  const corpo = {
    ...v,
    atendimentosRealizados: Number(v.atendimentosRealizados || 0),
    atendimentosMedicos: Number(v.atendimentosMedicos || 0),
    materiaisArrecadadosQtd: Number(v.materiaisArrecadadosQtd || 0),
  };
  const ok = await executar(() => api(r ? `/api/admin/relatorios/${r.id}` : "/api/admin/relatorios", { method: r ? "PUT" : "POST", body: corpo }));
  if (ok) carregadores.relatorios();
}

// ---------- USUÁRIOS (somente ADMINISTRADOR) ----------
carregadores.usuarios = async () => {
  const tb = document.querySelector("#tbUsuarios");
  try {
    const { usuarios } = await api("/api/admin/usuarios");
    tb.innerHTML = usuarios.map((u) => `<tr>
        <td><b>${esc(u.nome)}</b></td><td>${esc(u.email)}</td>
        <td>${badge(u.perfil === "ADMINISTRADOR" ? "EM_ANDAMENTO" : "NEUTRO", u.perfil === "ADMINISTRADOR" ? "Administrador" : "Operador")}</td>
        <td>${u.ativo ? badge("APROVADO", "Ativo") : badge("CANCELADO", "Inativo")}</td>
        <td><div class="acoes"><button class="btn-action secondary" data-acao="editar" data-id="${u.id}">Editar</button><button class="btn-action warn" data-acao="senha" data-id="${u.id}">Trocar senha</button></div></td>
      </tr>`).join("");
    ligarAcoes(tb, {
      editar: (id) => editarUsuario(usuarios.find((u) => u.id === id)),
      senha: async (id) => {
        const r = await formulario("Trocar senha", [{ nome: "senha", rotulo: "Nova senha (mín. 8 caracteres)", tipo: "password", obrigatorio: true, attrs: 'autocomplete="new-password"' }]);
        if (r) await executar(() => api(`/api/admin/usuarios/${id}/senha`, { method: "PATCH", body: r }));
      },
    });
  } catch (err) {
    tb.innerHTML = erroLinha(5, err);
  }
};

async function editarUsuario(u) {
  const campos = [
    { nome: "nome", rotulo: "Nome", obrigatorio: true },
    { nome: "email", rotulo: "E-mail", tipo: "email", obrigatorio: true },
    { nome: "perfil", rotulo: "Perfil", tipo: "select", opcoes: [["OPERADOR", "Operador"], ["ADMINISTRADOR", "Administrador"]] },
  ];
  if (u) campos.push({ nome: "ativo", rotulo: "Usuário ativo", tipo: "checkbox" });
  else campos.push({ nome: "senha", rotulo: "Senha (mín. 8 caracteres)", tipo: "password", obrigatorio: true, attrs: 'autocomplete="new-password"' });
  const r = await formulario(u ? "Editar usuário" : "Novo usuário", campos, u || {});
  if (!r) return;
  const ok = await executar(() => api(u ? `/api/admin/usuarios/${u.id}` : "/api/admin/usuarios", { method: u ? "PUT" : "POST", body: r }));
  if (ok) carregadores.usuarios();
}
