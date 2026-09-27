// ==========================================
// Comunicação com a API + utilitários compartilhados (site e painel)
// ==========================================
// Mesmo domínio do site. Se o front-end for hospedado separado, coloque aqui a URL da API.
const API_BASE = "";

const sessao = {
  token: () => localStorage.getItem("ong_token"),
  usuario: () => {
    try { return JSON.parse(localStorage.getItem("ong_usuario") || "null"); } catch { return null; }
  },
  salvar(token, usuario) {
    localStorage.setItem("ong_token", token);
    localStorage.setItem("ong_usuario", JSON.stringify(usuario));
  },
  limpar() {
    localStorage.removeItem("ong_token");
    localStorage.removeItem("ong_usuario");
  },
};

async function api(caminho, { method = "GET", body, form } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = sessao.token();
  if (token) headers.Authorization = `Bearer ${token}`;

  let resposta;
  try {
    resposta = await fetch(API_BASE + caminho, {
      method,
      headers,
      body: form || (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new Error("Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  }

  let dados = null;
  try { dados = await resposta.json(); } catch { dados = null; }

  if (!resposta.ok) {
    if (resposta.status === 401 && caminho.startsWith("/api/admin")) {
      sessao.limpar();
      window.location.href = "login.html";
    }
    const erro = new Error((dados && dados.error) || "Ocorreu um erro. Tente novamente.");
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

// Escapa texto antes de inserir em HTML (evita XSS).
function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const fmt = {
  moeda: (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  numero: (v) => Number(v || 0).toLocaleString("pt-BR"),
  // TIMESTAMP (UTC, ISO) -> data/hora local
  dataHora: (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"),
  data: (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—"),
  // DATE "AAAA-MM-DD" -> "DD/MM/AAAA" (sem conversão de fuso)
  dia: (d) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—"),
  // DATETIME "AAAA-MM-DD HH:MM:SS" -> "DD/MM/AAAA HH:MM"
  diaHora: (d) => (d ? `${fmt.dia(d)} ${d.slice(11, 16)}` : "—"),
  documento(doc) {
    const d = String(doc || "");
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    return d || "—";
  },
  telefone(t) {
    const d = String(t || "");
    if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return d || "—";
  },
};

// Máscara simples de CPF/CNPJ enquanto digita.
function mascaraDocumento(input) {
  input.addEventListener("input", () => {
    const d = input.value.replace(/\D/g, "").slice(0, 14);
    input.value =
      d.length <= 11
        ? d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2")
        : d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  });
}

function mascaraTelefone(input) {
  input.addEventListener("input", () => {
    const d = input.value.replace(/\D/g, "").slice(0, 11);
    input.value = d.length > 10
      ? d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3")
      : d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/[-\s(]+$/, "");
  });
}

// SweetAlert com as cores do site (e fallback caso o CDN não carregue).
function alerta(icon, title, text) {
  if (window.Swal) return Swal.fire({ icon, title, text, confirmButtonColor: "#75c5ad" });
  window.alert(`${title}\n${text || ""}`);
  return Promise.resolve({ isConfirmed: true });
}
