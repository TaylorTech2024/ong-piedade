-- Dados iniciais do site (os mesmos itens que já apareciam na página de
-- campanhas). As quantidades são um ponto de partida: ajuste pelo painel
-- administrativo (menu "Campanhas").

INSERT INTO campanhas (titulo, descricao, data_inicio, ativa)
SELECT 'Materiais essenciais para as crianças',
       'Campanha permanente de arrecadação de itens de higiene, alimentação, vestuário e conforto.',
       CURRENT_DATE, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM campanhas);

INSERT INTO necessidades_materiais (campanha_id, item, descricao, qtd_necessaria, qtd_recebida, ponto_coleta)
SELECT c.id, n.item, n.descricao, n.qtd, 0, 'Sede da Associação - Av. Ayrton Senna da Silva, 1100 - Piedade, Jaboatão dos Guararapes - PE'
FROM campanhas c
JOIN (
    SELECT 1 AS ordem, 'Fraldas infantis' AS item, 'Fraldas descartáveis para bebês e crianças (pacotes).' AS descricao, 100 AS qtd
    UNION ALL SELECT 2, 'Fórmula infantil', 'Fórmulas para alimentação de bebês (latas).', 50
    UNION ALL SELECT 3, 'Kits de higiene', 'Sabonete, escova, pasta e itens de higiene.', 80
    UNION ALL SELECT 4, 'Roupas infantis', 'Roupas novas ou em ótimo estado.', 150
    UNION ALL SELECT 5, 'Brinquedos educativos', 'Jogos e brinquedos que estimulam o aprendizado.', 60
    UNION ALL SELECT 6, 'Cobertores e enxovais', 'Itens para conforto e proteção das crianças.', 40
) n ON 1 = 1
WHERE c.titulo = 'Materiais essenciais para as crianças'
  AND NOT EXISTS (SELECT 1 FROM necessidades_materiais)
ORDER BY n.ordem;
