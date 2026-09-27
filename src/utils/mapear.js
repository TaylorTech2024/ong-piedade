// Converte linhas do banco (snake_case) para o formato JSON da API (camelCase).
const bool = (v) => v === 1 || v === true;

module.exports = {
  campanha: (c) => ({
    id: c.id, titulo: c.titulo, descricao: c.descricao, metaValor: c.meta_valor,
    dataInicio: c.data_inicio, dataFim: c.data_fim, ativa: bool(c.ativa), criadoEm: c.criado_em,
  }),
  necessidade: (n) => ({
    id: n.id, campanhaId: n.campanha_id, item: n.item, descricao: n.descricao,
    qtdNecessaria: n.qtd_necessaria, qtdRecebida: n.qtd_recebida,
    qtdRestante: Math.max(n.qtd_necessaria - n.qtd_recebida, 0),
    pontoColeta: n.ponto_coleta, status: n.status, criadoEm: n.criado_em,
  }),
  doador: (d) => ({
    id: d.id, tipoPessoa: d.tipo_pessoa, nomeRazaoSocial: d.nome_razao_social, cpfCnpj: d.cpf_cnpj,
    email: d.email, telefone: d.telefone, criadoEm: d.criado_em,
  }),
  doacao: (d) => ({
    id: d.id, doadorId: d.doador_id, valor: d.valor, tipoDoacao: d.tipo_doacao,
    formaPagamento: d.forma_pagamento, statusPagamento: d.status_pagamento,
    transacaoId: d.transacao_id, dataDoacao: d.data_doacao,
  }),
  voluntario: (v) => ({
    id: v.id, nome: v.nome, email: v.email, telefone: v.telefone,
    especialidadeProfissao: v.especialidade_profissao, areaInteresse: v.area_interesse,
    disponibilidade: v.disponibilidade, status: v.status, observacoesAdmin: v.observacoes_admin,
    cadastradoEm: v.cadastrado_em,
  }),
  escala: (e) => ({
    id: e.id, voluntarioId: e.voluntario_id, atividade: e.atividade,
    dataInicio: e.data_inicio, dataFim: e.data_fim, local: e.local,
  }),
  relatorio: (r) => ({
    id: r.id, titulo: r.titulo, periodoReferencia: r.periodo_referencia,
    atendimentosRealizados: r.atendimentos_realizados, atendimentosMedicos: r.atendimentos_medicos,
    materiaisArrecadadosQtd: r.materiais_arrecadados_qtd, descricaoResultados: r.descricao_resultados,
    criadoEm: r.criado_em,
  }),
  documento: (d) => ({
    id: d.id, relatorioId: d.relatorio_id, nomeArquivo: d.nome_arquivo, url: d.caminho_arquivo,
    tipoMime: d.tipo_mime, tamanhoBytes: d.tamanho_bytes, enviadoEm: d.enviado_em,
  }),
  usuario: (u) => ({
    id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, ativo: bool(u.ativo), criadoEm: u.criado_em,
  }),
};
