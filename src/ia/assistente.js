// Assistente virtual do site (IA gratuita, roda no próprio servidor).
// 1) Um classificador Naive Bayes identifica a INTENÇÃO da pergunta;
// 2) a resposta é montada com os DADOS REAIS do banco (necessidades,
//    campanhas, números de transparência).
// O assistente só consulta dados públicos: nunca nomes, e-mails ou CPFs.
const { pool } = require("../db/pool");
const { hoje } = require("../utils/datas");
const { ClassificadorNaiveBayes } = require("./classificador");

const EXEMPLOS = {
  saudacao: ["oi", "oi, tudo bem?", "oii", "oi boa tarde", "olá", "olá, tudo bem?", "bom dia", "boa tarde", "boa noite", "e aí", "alguém aí?", "olá assistente"],
  agradecimento: ["obrigado", "obrigada", "muito obrigada", "valeu", "valeu mesmo", "gratidão", "muito obrigado pela ajuda", "agradeço", "show, obrigado"],
  doar_dinheiro: [
    "quero doar", "como faço para doar", "quero fazer uma doação", "como doar dinheiro", "quero ajudar com dinheiro",
    "posso doar qualquer valor?", "qual o valor mínimo para doar", "doação em dinheiro", "contribuir financeiramente",
    "como contribuir", "quero contribuir com a ong", "como faço pra doar", "como posso doar", "doar",
    "fazer uma doação", "onde faço a doação", "doar pelo site",
  ],
  pix: ["qual a chave pix", "tem pix?", "doar por pix", "chave pix da ong", "qr code do pix", "como pago no pix", "cnpj para pix"],
  cartao_boleto: [
    "posso pagar no cartão?", "aceita cartão de crédito", "doar com cartão", "tem boleto?", "pagar com boleto",
    "vocês aceitam cartão", "dá para parcelar no cartão",
    "formas de pagamento", "quais formas de pagamento", "aceita boleto bancário",
  ],
  doacao_mensal: [
    "quero doar todo mês", "doação mensal", "como apadrinhar", "apadrinhamento", "doação recorrente",
    "posso ser padrinho", "contribuição mensal", "doar mensalmente", "quero ser madrinha", "virar padrinho de uma criança",
    "débito todo mês",
  ],
  materiais: [
    "o que vocês precisam", "quais itens estão precisando", "o que está faltando", "quero doar fraldas",
    "posso doar roupas?", "precisam de alimentos?", "doar brinquedos", "doação de materiais", "quais materiais doar",
    "lista de necessidades", "quero doar leite", "doar kit de higiene", "doar cobertor", "o que posso levar",
    "o que vocês estão precisando", "estão precisando de quê", "que itens faltam", "doar fralda e roupa",
  ],
  ponto_coleta: [
    "onde entrego as doações", "onde fica o ponto de coleta", "onde levo os materiais", "qual o endereço",
    "onde fica a ong", "como chegar", "localização", "endereço da sede", "posso entregar pessoalmente",
    "onde eu entrego", "onde deixo as fraldas", "onde levar as roupas", "entregar doação de materiais",
  ],
  voluntario: [
    "quero ser voluntário", "como ser voluntária", "quero ajudar como voluntário", "trabalho voluntário",
    "vocês precisam de voluntários?", "posso ajudar com meu tempo", "como me inscrever como voluntário",
    "sou médico, posso ajudar", "sou professora, quero ajudar", "voluntariado", "sou enfermeira e quero ajudar",
    "tenho tempo livre para ajudar", "quero ajudar nas atividades com as crianças",
  ],
  campanhas: [
    "quais campanhas estão ativas", "tem campanha agora?", "campanhas atuais", "quais os projetos",
    "projetos da ong", "campanha de arrecadação", "o que vocês estão arrecadando",
  ],
  transparencia: [
    "como vocês usam o dinheiro", "prestação de contas", "relatórios financeiros", "transparência",
    "quanto já arrecadaram", "para onde vai o dinheiro", "quantas pessoas vocês atendem", "resultados da ong",
    "relatório de contas", "balanço financeiro", "posso ver os gastos",
  ],
  sobre: [
    "o que é a associação", "o que a ong faz", "quem são vocês", "qual a missão da ong", "sobre a instituição",
    "o que é a nossa senhora de piedade", "quem vocês ajudam", "qual o trabalho de vocês", "quem são vocês", "me fale sobre a ong", "o que vocês fazem",
  ],
  contato: [
    "qual o telefone", "como entro em contato", "tem whatsapp?", "número de contato", "falar com alguém",
    "falar com atendente", "contato da ong", "telefone da associação", "qual o número de telefone", "email para contato",
  ],
};

const modelo = new ClassificadorNaiveBayes();
for (const [intencao, frases] of Object.entries(EXEMPLOS)) for (const f of frases) modelo.treinar(f, intencao);

// Abaixo desta probabilidade o assistente admite que não entendeu (evita respostas erradas).
const CONFIANCA_MINIMA = 0.2;
const ENDERECO = "Av. Ayrton Senna da Silva, 1100 - Piedade, Jaboatão dos Guararapes - PE";
const TELEFONE = "(81) 99265-5586";

async function necessidadesAbertas() {
  const d = hoje();
  const [rows] = await pool.query(
    `SELECT n.item, n.qtd_necessaria - n.qtd_recebida AS restante, n.ponto_coleta
     FROM necessidades_materiais n LEFT JOIN campanhas c ON c.id = n.campanha_id
     WHERE n.status = 'EM_ANDAMENTO'
       AND (n.campanha_id IS NULL OR (c.ativa = TRUE AND c.data_inicio <= ? AND (c.data_fim IS NULL OR c.data_fim >= ?)))
     ORDER BY (n.qtd_recebida / n.qtd_necessaria) ASC LIMIT 5`,
    [d, d]
  );
  return rows;
}

const RESPOSTAS = {
  saudacao: async () => ({ texto: "Olá! 😊 Sou a assistente virtual da Associação Nossa Senhora de Piedade. Posso ajudar com doações, materiais, voluntariado e transparência. O que você procura?" }),
  agradecimento: async () => ({ texto: "Nós que agradecemos! Cada ajuda transforma a vida de uma criança. 💛" }),
  doar_dinheiro: async () => ({
    texto: "Você pode doar qualquer valor (a partir de R$ 1) na página Doe Agora, por PIX, cartão de crédito ou boleto. É rápido e não precisa criar conta!",
    link: { rotulo: "Doar agora", url: "doacao.html" },
  }),
  pix: async () => ({
    texto: "Nossa chave PIX é o CNPJ 12.588.232/0001-91. Na página Doe Agora também tem o QR Code — é só escanear no app do banco.",
    link: { rotulo: "Ver QR Code", url: "doacao.html" },
  }),
  cartao_boleto: async () => ({
    texto: "Aceitamos PIX, cartão de crédito e boleto. Escolha a forma na página Doe Agora; para cartão e boleto, enviamos o link/boleto para o seu e-mail.",
    link: { rotulo: "Escolher forma de pagamento", url: "doacao.html" },
  }),
  doacao_mensal: async () => ({
    texto: "Que lindo! Na página Doe Agora é só marcar a opção \"Doação mensal\" para se tornar padrinho/madrinha e ajudar todos os meses.",
    link: { rotulo: "Quero doar todo mês", url: "doacao.html" },
  }),
  materiais: async () => {
    const lista = await necessidadesAbertas();
    if (!lista.length) {
      return { texto: `No momento todas as nossas necessidades estão atendidas! 🎉 Mesmo assim, doações são sempre bem-vindas na sede: ${ENDERECO}.` };
    }
    const itens = lista.map((n) => `• ${n.item}: faltam ${n.restante}`).join("\n");
    return {
      texto: `Os itens que mais estamos precisando agora são:\n${itens}\n\nEntregue em: ${lista[0].ponto_coleta}.`,
      link: { rotulo: "Ver todas as campanhas", url: "campanhas.html" },
    };
  },
  ponto_coleta: async () => ({
    texto: `Nosso ponto de coleta é a sede da Associação: ${ENDERECO}. Dúvidas sobre horários: ${TELEFONE}.`,
    link: { rotulo: "Ver no mapa", url: "campanhas.html#coleta" },
  }),
  voluntario: async () => ({
    texto: "Que alegria! Faça sua inscrição na página Cadastro, escolhendo \"Quero ser voluntário\". Informe sua área de interesse e disponibilidade — a equipe analisa e entra em contato.",
    link: { rotulo: "Quero ser voluntário", url: "cadastro.html?tipo=voluntario" },
  }),
  campanhas: async () => {
    const d = hoje();
    const [rows] = await pool.query(
      `SELECT titulo FROM campanhas WHERE ativa = TRUE AND data_inicio <= ? AND (data_fim IS NULL OR data_fim >= ?) ORDER BY data_inicio DESC LIMIT 5`,
      [d, d]
    );
    if (!rows.length) return { texto: "No momento não há campanhas ativas, mas você pode doar a qualquer momento na página Doe Agora." };
    return {
      texto: `Campanhas ativas agora:\n${rows.map((r) => `• ${r.titulo}`).join("\n")}`,
      link: { rotulo: "Ver campanhas", url: "campanhas.html" },
    };
  },
  transparencia: async () => {
    const [[d]] = await pool.query(
      `SELECT COALESCE(SUM(valor), 0) AS total, COUNT(*) AS qtd FROM doacoes_financeiras WHERE status_pagamento = 'CONFIRMADO'`
    );
    const [[m]] = await pool.query(`SELECT COALESCE(SUM(qtd_recebida), 0) AS total FROM necessidades_materiais`);
    const valor = Number(d.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return {
      texto: `Transparência é compromisso! Até agora recebemos ${valor} em ${d.qtd} doações confirmadas e ${m.total} itens de materiais. Os relatórios completos estão na página Transparência.`,
      link: { rotulo: "Ver relatórios", url: "transparencia.html" },
    };
  },
  sobre: async () => ({
    texto: "A Associação Beneficente Nossa Senhora de Piedade oferece educação, saúde, alimentação e acolhimento a crianças e famílias em situação de vulnerabilidade em Piedade - PE.",
    link: { rotulo: "Conheça a ONG", url: "index.html" },
  }),
  contato: async () => ({ texto: `Fale com a gente pelo telefone/WhatsApp ${TELEFONE} ou visite nossa sede: ${ENDERECO}.` }),
};

async function responder(mensagem) {
  const { classe, confianca } = modelo.classificar(mensagem);
  if (!classe || confianca < CONFIANCA_MINIMA) {
    return {
      intencao: null,
      confianca: Number(confianca.toFixed(2)),
      texto: "Desculpe, não entendi muito bem. 🤔 Posso ajudar com: doações (PIX, cartão, boleto), materiais que precisamos, ponto de coleta, voluntariado e transparência.",
    };
  }
  const resposta = await RESPOSTAS[classe]();
  return { intencao: classe, confianca: Number(confianca.toFixed(2)), ...resposta };
}

module.exports = { responder, modelo };
