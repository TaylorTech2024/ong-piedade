// ==========================================
// Site público: menu, galeria, campanhas, doação, cadastro,
// transparência, login e assistente virtual (IA).
// ==========================================
const pagina = window.location.pathname.split("/").pop() || "index.html";
const naPagina = (...nomes) => nomes.some((n) => pagina === n || pagina === n.replace(".html", ""));

function iconeItem(item) {
  const t = item.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/fralda/.test(t)) return "🧷";
  if (/formula|leite|mamadeira/.test(t)) return "🍼";
  if (/higiene|sabonete|escova|shampoo/.test(t)) return "🧼";
  if (/roupa|camisa|calca|sapato|calcado/.test(t)) return "👕";
  if (/brinquedo|boneca|jogo|bola/.test(t)) return "🧩";
  if (/cobertor|enxoval|lencol|toalha/.test(t)) return "🛏️";
  if (/aliment|comida|arroz|feijao|cesta/.test(t)) return "🍚";
  if (/livro|caderno|escolar|lapis/.test(t)) return "📚";
  if (/remedio|medic|saude/.test(t)) return "💊";
  return "📦";
}

function cardNecessidade(n) {
  const pct = Math.min(100, Math.round((n.qtdRecebida / n.qtdNecessaria) * 100));
  return `
    <article class="campaign-card">
      <div class="campaign-icon" aria-hidden="true">${iconeItem(n.item)}</div>
      <h3>${esc(n.item)}</h3>
      ${n.descricao ? `<p>${esc(n.descricao)}</p>` : ""}
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      <div class="progress-info"><span>Recebido: <b>${fmt.numero(n.qtdRecebida)}</b> de ${fmt.numero(n.qtdNecessaria)}</span><span>Faltam <b>${fmt.numero(n.qtdRestante)}</b></span></div>
      <button type="button" class="btn btn-secondary item-btn" data-item="${esc(n.item)}" data-coleta="${esc(n.pontoColeta)}" data-restante="${n.qtdRestante}">Eu posso doar</button>
    </article>`;
}

document.addEventListener("DOMContentLoaded", () => {
  // ---------- Menu mobile ----------
  const menu = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".header nav");
  if (menu && nav) menu.addEventListener("click", () => nav.classList.toggle("open"));

  // ---------- Transição suave entre páginas ----------
  document.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (!href || href.startsWith("#") || this.target === "_blank" || this.hostname !== window.location.hostname) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      document.body.classList.add("fade-out");
      setTimeout(() => (window.location.href = this.href), 280);
    });
  });
  window.addEventListener("pageshow", () => document.body.classList.remove("fade-out"));

  if (naPagina("index.html")) iniciarGaleria();
  if (naPagina("campanhas.html")) iniciarCampanhas();
  if (naPagina("doacao.html")) iniciarDoacao();
  if (naPagina("cadastro.html")) iniciarCadastro();
  if (naPagina("transparencia.html")) iniciarTransparencia();
  if (naPagina("login.html")) iniciarLogin();
  iniciarChatbot();
});

// ---------- INDEX: galeria de projetos (RF01) ----------
async function iniciarGaleria() {
  const alvo = document.querySelector("#galeriaProjetos");
  try {
    const { campanhas } = await api("/api/publico/campanhas");
    if (!campanhas.length) {
      alvo.innerHTML = `<p class="muted">Novos projetos em breve. Enquanto isso, você pode <a href="doacao.html"><b>fazer uma doação</b></a>.</p>`;
      return;
    }
    alvo.innerHTML = campanhas.slice(0, 6).map((c) => {
      const icone = c.necessidades[0] ? iconeItem(c.necessidades[0].item) : "🌟";
      const necessario = c.necessidades.reduce((s, n) => s + n.qtdNecessaria, 0);
      const recebido = c.necessidades.reduce((s, n) => s + n.qtdRecebida, 0);
      const pct = necessario ? Math.round((recebido / necessario) * 100) : 0;
      return `
        <article class="gallery-card">
          <div class="gallery-cover" aria-hidden="true">${icone}</div>
          <div class="gallery-body">
            <span class="tag">Desde ${fmt.dia(c.dataInicio)}${c.dataFim ? ` até ${fmt.dia(c.dataFim)}` : ""}</span>
            <h3>${esc(c.titulo)}</h3>
            ${c.descricao ? `<p>${esc(c.descricao)}</p>` : ""}
            ${necessario ? `<div class="progress"><span style="width:${Math.min(pct, 100)}%"></span></div><small class="muted">${pct}% dos materiais arrecadados</small>` : ""}
            <a class="btn btn-secondary" style="margin-top:auto" href="campanhas.html">Quero ajudar</a>
          </div>
        </article>`;
    }).join("");
  } catch {
    alvo.innerHTML = `<p class="erro-carga">Não foi possível carregar os projetos agora.</p>`;
  }
}

// ---------- CAMPANHAS: campanhas e necessidades (RF06, RF07) ----------
async function iniciarCampanhas() {
  const alvo = document.querySelector("#campanhasLista");
  try {
    const { campanhas, necessidadesGerais } = await api("/api/publico/campanhas");
    const blocos = campanhas
      .filter((c) => c.necessidades.length)
      .map((c) => `
        <div class="campaign-block">
          <div class="campaign-block-head">
            <div><span class="tag">Campanha ativa</span><h2>${esc(c.titulo)}</h2>${c.descricao ? `<p>${esc(c.descricao)}</p>` : ""}</div>
            ${c.dataFim ? `<span class="muted">Até ${fmt.dia(c.dataFim)}</span>` : ""}
          </div>
          <div class="campaign-grid">${c.necessidades.map(cardNecessidade).join("")}</div>
        </div>`);
    if (necessidadesGerais.length) {
      blocos.push(`
        <div class="campaign-block">
          <div class="campaign-block-head"><div><h2>Outras necessidades</h2></div></div>
          <div class="campaign-grid">${necessidadesGerais.map(cardNecessidade).join("")}</div>
        </div>`);
    }
    alvo.innerHTML = blocos.length
      ? blocos.join("")
      : `<p class="center muted" style="padding:30px 0">No momento todas as necessidades estão atendidas! 🎉 Doações financeiras continuam fazendo a diferença: <a href="doacao.html"><b>doe agora</b></a>.</p>`;

    alvo.querySelectorAll(".item-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const r = await Swal.fire({
          icon: "success",
          title: "Obrigado por ajudar!",
          html: `Ainda precisamos de <b>${esc(btn.dataset.restante)}</b> unidade(s) de <b>${esc(btn.dataset.item)}</b>.<br><br>📍 Entregue em:<br><b>${esc(btn.dataset.coleta)}</b>`,
          showCancelButton: true,
          confirmButtonText: "Ver no mapa",
          cancelButtonText: "Fechar",
          confirmButtonColor: "#75c5ad",
        });
        if (r.isConfirmed) document.querySelector("#coleta").scrollIntoView({ behavior: "smooth" });
      });
    });
  } catch {
    alvo.innerHTML = `<p class="erro-carga">Não foi possível carregar as campanhas agora. Tente novamente em instantes.</p>`;
  }
}

// ---------- DOAÇÃO (RF02, RF03, RF04, RF05) ----------
function iniciarDoacao() {
  const form = document.querySelector("#doacaoForm");
  const custom = document.querySelector(".custom-value");
  const inputCustom = document.querySelector("#custom");
  const doc = document.querySelector("#dDoc");
  mascaraDocumento(doc);
  mascaraTelefone(document.querySelector("#dTelefone"));

  document.querySelectorAll(".amount").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".amount").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      custom.classList.toggle("hidden", btn.dataset.value !== "other");
      if (btn.dataset.value === "other") setTimeout(() => inputCustom.focus(), 50);
    });
  });

  const atualizarRotulos = () => {
    const pj = form.querySelector("input[name=tipoPessoa]:checked").value === "PJ";
    const boleto = form.querySelector("input[name=forma]:checked").value === "BOLETO";
    document.querySelector("#lblNome").textContent = pj ? "Razão social *" : "Nome completo *";
    document.querySelector("#lblDoc").textContent = (pj ? "CNPJ" : "CPF") + (boleto ? " *" : "");
    document.querySelector("#docHint").textContent = boleto ? "Obrigatório para emissão do boleto." : "Opcional para PIX e cartão. Obrigatório para boleto.";
  };
  form.querySelectorAll("input[name=tipoPessoa], input[name=forma]").forEach((i) => i.addEventListener("change", atualizarRotulos));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ativo = document.querySelector(".amount.active");
    const valor = ativo.dataset.value === "other" ? Number(inputCustom.value) : Number(ativo.dataset.value);
    if (!valor || valor < 1) return alerta("warning", "Valor inválido", "Informe um valor de pelo menos R$ 1,00.");

    const dados = {
      valor,
      tipoDoacao: document.querySelector("#monthly").checked ? "RECORRENTE" : "UNICA",
      formaPagamento: form.querySelector("input[name=forma]:checked").value,
      doador: {
        tipoPessoa: form.querySelector("input[name=tipoPessoa]:checked").value,
        nomeRazaoSocial: document.querySelector("#dNome").value.trim(),
        email: document.querySelector("#dEmail").value.trim(),
        telefone: document.querySelector("#dTelefone").value.trim(),
        cpfCnpj: doc.value.trim(),
      },
    };
    if (!dados.doador.nomeRazaoSocial || !dados.doador.email) {
      return alerta("warning", "Faltam dados", "Preencha nome e e-mail para registrarmos sua doação.");
    }

    const botao = document.querySelector("#donateBtn");
    botao.disabled = true;
    botao.textContent = "Registrando...";
    try {
      const { pagamento } = await api("/api/doacoes", { method: "POST", body: dados });
      const recorrente = dados.tipoDoacao === "RECORRENTE" ? "<br><small>Obrigado por se tornar padrinho/madrinha! 💛</small>" : "";
      if (pagamento.pixChave) {
        const r = await Swal.fire({
          title: `Doação de ${fmt.moeda(valor)} registrada!`,
          html: `<div class="pix-box"><p>${esc(pagamento.mensagem)}</p><img src="${esc(pagamento.qrCode)}" alt="QR Code PIX"><div>Chave PIX</div><div class="pix-key">${esc(pagamento.pixChaveExibicao)}</div>${recorrente}</div>`,
          showCancelButton: true,
          confirmButtonText: "Copiar chave PIX",
          cancelButtonText: "Fechar",
          confirmButtonColor: "#75c5ad",
        });
        if (r.isConfirmed) {
          try {
            await navigator.clipboard.writeText(pagamento.pixChave);
            await alerta("success", "Chave copiada!", "Cole no app do seu banco para concluir.");
          } catch {
            await alerta("info", "Chave PIX", pagamento.pixChaveExibicao);
          }
        }
      } else {
        await Swal.fire({ icon: "success", title: pagamento.titulo, html: `${esc(pagamento.mensagem)}${recorrente}`, confirmButtonColor: "#75c5ad" });
      }
      form.reset();
      atualizarRotulos();
      document.querySelectorAll(".amount").forEach((b, i) => b.classList.toggle("active", i === 0));
      custom.classList.add("hidden");
    } catch (err) {
      alerta("error", "Não foi possível registrar", err.message);
    } finally {
      botao.disabled = false;
      botao.textContent = "Confirmar Doação";
    }
  });
}

// ---------- CADASTRO: voluntário (RF08) e doador (RF02) ----------
function iniciarCadastro() {
  const abas = document.querySelectorAll(".tabs button");
  const trocar = (tab) => {
    abas.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll("[data-painel]").forEach((p) => p.classList.toggle("hidden", p.dataset.painel !== tab));
  };
  abas.forEach((b) => b.addEventListener("click", () => trocar(b.dataset.tab)));
  const inicial = new URLSearchParams(location.search).get("tipo");
  if (inicial === "doador") trocar("doador");

  mascaraTelefone(document.querySelector("#vTelefone"));
  mascaraTelefone(document.querySelector("#cTelefone"));
  mascaraDocumento(document.querySelector("#cDoc"));

  const enviar = async (form, caminho, dados, aoConcluir) => {
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    try {
      const { message } = await api(caminho, { method: "POST", body: dados });
      await alerta("success", "Tudo certo!", message);
      form.reset();
      if (aoConcluir) aoConcluir();
    } catch (err) {
      alerta("error", "Não foi possível concluir", err.message);
    } finally {
      botao.disabled = false;
    }
  };

  const fv = document.querySelector("#voluntarioForm");
  fv.addEventListener("submit", (e) => {
    e.preventDefault();
    const dias = [...document.querySelectorAll("#vDias input:checked")].map((i) => i.value);
    const turnos = [...document.querySelectorAll("#vTurnos input:checked")].map((i) => i.value);
    const dados = {
      nome: document.querySelector("#vNome").value.trim(),
      email: document.querySelector("#vEmail").value.trim(),
      telefone: document.querySelector("#vTelefone").value.trim(),
      especialidadeProfissao: document.querySelector("#vProfissao").value.trim(),
      areaInteresse: document.querySelector("#vArea").value,
      disponibilidade: dias.length && turnos.length ? `${dias.join(", ")} - ${turnos.join(", ")}` : "",
    };
    if (!dados.nome || !dados.email || !dados.telefone || !dados.areaInteresse) {
      return alerta("warning", "Faltam dados", "Preencha nome, e-mail, telefone e área de interesse.");
    }
    if (!dados.disponibilidade) return alerta("warning", "Disponibilidade", "Marque pelo menos um dia e um turno.");
    enviar(fv, "/api/voluntarios", dados);
  });

  const fd = document.querySelector("#doadorForm");
  const rotulos = () => {
    const pj = fd.querySelector("input[name=cTipoPessoa]:checked").value === "PJ";
    document.querySelector("#cLblNome").textContent = pj ? "Razão social *" : "Nome completo *";
    document.querySelector("#cLblDoc").textContent = pj ? "CNPJ" : "CPF";
  };
  fd.querySelectorAll("input[name=cTipoPessoa]").forEach((i) => i.addEventListener("change", rotulos));
  fd.addEventListener("submit", (e) => {
    e.preventDefault();
    const dados = {
      tipoPessoa: fd.querySelector("input[name=cTipoPessoa]:checked").value,
      nomeRazaoSocial: document.querySelector("#cNome").value.trim(),
      email: document.querySelector("#cEmail").value.trim(),
      telefone: document.querySelector("#cTelefone").value.trim(),
      cpfCnpj: document.querySelector("#cDoc").value.trim(),
    };
    if (!dados.nomeRazaoSocial || !dados.email) return alerta("warning", "Faltam dados", "Preencha nome e e-mail.");
    enviar(fd, "/api/doadores", dados, rotulos);
  });
}

// ---------- TRANSPARÊNCIA (RF10, RF12) ----------
async function iniciarTransparencia() {
  const numeros = document.querySelector("#impactoNumeros");
  const lista = document.querySelector("#reportsList");
  try {
    const { totais, relatorios } = await api("/api/publico/transparencia");
    const cards = [
      ["💰", fmt.moeda(totais.arrecadadoConfirmado), "arrecadados em doações confirmadas"],
      ["❤️", fmt.numero(totais.doacoesConfirmadas), "doações financeiras recebidas"],
      ["📦", fmt.numero(totais.materiaisRecebidos), "itens de materiais recebidos"],
      ["🤝", fmt.numero(totais.voluntariosAtivos), "voluntários ativos"],
      ["👧", fmt.numero(totais.atendimentosRealizados), "atendimentos realizados"],
      ["🩺", fmt.numero(totais.atendimentosMedicos), "atendimentos médicos"],
    ];
    numeros.innerHTML = cards.map(([i, v, t]) => `<article><span aria-hidden="true">${i}</span><b>${v}</b><p>${t}</p></article>`).join("");

    if (!relatorios.length) {
      lista.innerHTML = `<p class="center muted">Nenhum relatório publicado ainda.</p>`;
      return;
    }
    lista.innerHTML = relatorios.map((r) => `
      <article class="report-card">
        <span class="tag">${esc(r.periodoReferencia)}</span>
        <h3 style="margin-top:8px">${esc(r.titulo)}</h3>
        <div class="report-stats">
          <span>👧 ${fmt.numero(r.atendimentosRealizados)} atendimentos</span>
          <span>🩺 ${fmt.numero(r.atendimentosMedicos)} atendimentos médicos</span>
          <span>📦 ${fmt.numero(r.materiaisArrecadadosQtd)} materiais arrecadados</span>
        </div>
        ${r.descricaoResultados ? `<p>${esc(r.descricaoResultados)}</p>` : ""}
        ${r.documentos.length ? `<div class="report-docs">${r.documentos.map((d) => `<a class="btn btn-secondary" href="${esc(d.url)}" target="_blank" rel="noopener">📄 ${esc(d.nomeArquivo)}</a>`).join("")}</div>` : ""}
      </article>`).join("");
  } catch {
    numeros.innerHTML = `<p class="erro-carga">Não foi possível carregar os números agora.</p>`;
    lista.innerHTML = "";
  }
}

// ---------- LOGIN (RF14) ----------
function iniciarLogin() {
  if (sessao.token()) {
    api("/api/auth/me").then(() => (window.location.href = "admin.html")).catch(() => sessao.limpar());
  }
  const form = document.querySelector("#loginForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    try {
      const { token, user } = await api("/api/auth/login", {
        method: "POST",
        body: { email: document.querySelector("#email").value.trim(), senha: document.querySelector("#senha").value },
      });
      sessao.salvar(token, user);
      window.location.href = "admin.html";
    } catch (err) {
      alerta("error", "Não foi possível entrar", err.message);
    } finally {
      botao.disabled = false;
    }
  });
}

// ---------- ASSISTENTE VIRTUAL (IA) ----------
function iniciarChatbot() {
  const root = document.querySelector("#chatbot-root");
  if (!root) return;
  root.innerHTML = `
    <button class="chatbot-launcher" id="chatbotLauncher" aria-label="Abrir assistente virtual"><div class="chatbot-launcher-icon">💬</div><span class="chatbot-launcher-text">Tire suas dúvidas...</span></button>
    <section class="chatbot-window" id="chatbotWindow" aria-label="Assistente virtual">
      <header class="chatbot-head"><div><strong>Assistente Virtual <span class="chatbot-ia-tag">IA</span></strong><small style="display:block">Respostas com dados atualizados da ONG</small></div><button class="chatbot-close" id="chatbotClose" aria-label="Fechar">×</button></header>
      <div class="chatbot-messages" id="chatbotMessages" aria-live="polite"></div>
      <div class="chatbot-quick">
        <button data-chat="Quero fazer uma doação">Quero doar</button>
        <button data-chat="O que vocês estão precisando?">O que precisam?</button>
        <button data-chat="Quero ser voluntário">Ser voluntário</button>
        <button data-chat="Onde entrego as doações?">Onde entregar</button>
      </div>
      <form class="chatbot-form" id="chatbotForm"><input id="chatbotInput" autocomplete="off" maxlength="500" placeholder="Digite sua dúvida..." aria-label="Sua mensagem"><button type="submit" aria-label="Enviar">➤</button></form>
    </section>`;

  const janela = document.querySelector("#chatbotWindow");
  const msgs = document.querySelector("#chatbotMessages");
  const input = document.querySelector("#chatbotInput");

  const adicionar = (texto, tipo = "bot", link) => {
    const div = document.createElement("div");
    div.className = `chat-msg ${tipo}`;
    div.textContent = texto;
    if (link && /^[a-z0-9-]+\.html(\?[\w=]*)?(#[\w-]*)?$/i.test(link.url)) {
      const a = document.createElement("a");
      a.className = "chat-link";
      a.href = link.url;
      a.textContent = `${link.rotulo} →`;
      div.appendChild(document.createElement("br"));
      div.appendChild(a);
    }
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  };

  const perguntar = async (texto) => {
    adicionar(texto, "user");
    const digitando = adicionar("Digitando...");
    try {
      const r = await api("/api/assistente", { method: "POST", body: { mensagem: texto } });
      digitando.remove();
      adicionar(r.texto, "bot", r.link);
    } catch {
      digitando.remove();
      adicionar("Estou sem conexão agora. 😕 Você pode falar com a gente pelo (81) 99265-5586.");
    }
  };

  document.querySelector("#chatbotLauncher").addEventListener("click", () => {
    janela.classList.add("open");
    if (!msgs.children.length) adicionar("Olá! Sou a assistente virtual da Associação Nossa Senhora de Piedade. Em que posso ajudar?");
    input.focus();
  });
  document.querySelector("#chatbotClose").addEventListener("click", () => janela.classList.remove("open"));
  document.querySelectorAll("[data-chat]").forEach((b) => b.addEventListener("click", () => perguntar(b.dataset.chat)));
  document.querySelector("#chatbotForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t) return;
    input.value = "";
    perguntar(t);
  });
}
