// Instruções de pagamento de cada forma aceita (RF04).
// Hoje o pagamento é conferido manualmente pela equipe no painel. Para integrar
// um gateway (Mercado Pago, PagSeguro, Asaas...), basta trocar a função da forma
// desejada por uma chamada à API do gateway e gravar o transacao_id retornado.

const PIX_CHAVE = process.env.PIX_CHAVE || "12588232000191";
const PIX_CHAVE_EXIBICAO = process.env.PIX_CHAVE_EXIBICAO || "12.588.232/0001-91 (CNPJ)";
const CONTATO = process.env.CONTATO_PAGAMENTO || "(81) 99265-5586";

const formas = {
  PIX: () => ({
    titulo: "Pague com PIX",
    mensagem: "Escaneie o QR Code ou copie a chave PIX no app do seu banco para concluir a doação.",
    pixChave: PIX_CHAVE,
    pixChaveExibicao: PIX_CHAVE_EXIBICAO,
    qrCode: "assets/qr-pix.png",
  }),
  CARTAO_CREDITO: () => ({
    titulo: "Cartão de crédito",
    mensagem: `Recebemos sua intenção de doação! Nossa equipe enviará o link seguro de pagamento com cartão para o seu e-mail em até 1 dia útil. Dúvidas: ${CONTATO}.`,
  }),
  BOLETO: () => ({
    titulo: "Boleto bancário",
    mensagem: `Recebemos sua intenção de doação! O boleto será enviado para o seu e-mail em até 1 dia útil. Dúvidas: ${CONTATO}.`,
  }),
};

function instrucoesPagamento(formaPagamento) {
  return formas[formaPagamento]();
}

module.exports = { instrucoesPagamento, FORMAS_PAGAMENTO: Object.keys(formas) };
