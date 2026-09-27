-- Histórico de cada entrada de material. É a base de dados usada pela IA
-- do Painel de Insights para estimar em quanto tempo cada necessidade será
-- completada (ritmo de recebimento).
CREATE TABLE IF NOT EXISTS recebimentos_materiais (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    necessidade_id BIGINT NOT NULL,
    quantidade INT NOT NULL,
    recebido_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recebimento_necessidade FOREIGN KEY (necessidade_id) REFERENCES necessidades_materiais(id) ON DELETE CASCADE,
    INDEX idx_recebimentos_data (recebido_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
