-- =====================================================================
-- ONG Piedade - Estrutura do banco (MySQL 8 / TiDB)
-- Baseado no script original DATA_BASE_ONG.txt, com as correções:
--  * IF NOT EXISTS / INSERT IGNORE: o script pode rodar mais de uma vez;
--  * sem CREATE DATABASE/USE: o servidor cria e seleciona o banco sozinho
--    (variável DB_NAME), o que é necessário em hospedagens como o TiDB Cloud;
--  * colunas de status/ativo como NOT NULL (evita registros sem status);
--  * índices para as consultas mais usadas;
--  * nova tabela documentos_conteudo: o PDF é guardado no próprio banco,
--    em partes de 1 MB, porque o disco do Render é apagado a cada deploy
--    e o TiDB limita o tamanho de cada linha;
--  * o INSERT do administrador foi removido: o hash de senha do script
--    original não correspondia a nenhuma senha conhecida. O admin agora é
--    criado na primeira execução com ADMIN_EMAIL / ADMIN_PASSWORD.
-- =====================================================================

CREATE TABLE IF NOT EXISTS perfis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios_admin (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL, -- hash BCrypt
    perfil_id BIGINT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_perfil FOREIGN KEY (perfil_id) REFERENCES perfis(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS doadores (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tipo_pessoa ENUM('PF', 'PJ') NOT NULL DEFAULT 'PF',
    nome_razao_social VARCHAR(150) NOT NULL,
    cpf_cnpj VARCHAR(18) UNIQUE, -- somente dígitos
    email VARCHAR(100) NOT NULL UNIQUE,
    telefone VARCHAR(20),
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS doacoes_financeiras (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    doador_id BIGINT,
    valor DECIMAL(10, 2) NOT NULL,
    tipo_doacao ENUM('UNICA', 'RECORRENTE') NOT NULL DEFAULT 'UNICA',
    forma_pagamento ENUM('PIX', 'CARTAO_CREDITO', 'BOLETO') NOT NULL,
    status_pagamento ENUM('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'FALHOU') NOT NULL DEFAULT 'PENDENTE',
    transacao_id VARCHAR(100), -- ID da transação no gateway / comprovante
    data_doacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_doacao_doador FOREIGN KEY (doador_id) REFERENCES doadores(id) ON DELETE SET NULL,
    INDEX idx_doacoes_data (data_doacao),
    INDEX idx_doacoes_status (status_pagamento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campanhas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    meta_valor DECIMAL(10, 2) NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NULL,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS necessidades_materiais (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    campanha_id BIGINT NULL,
    item VARCHAR(100) NOT NULL,
    descricao TEXT,
    qtd_necessaria INT NOT NULL DEFAULT 0,
    qtd_recebida INT NOT NULL DEFAULT 0,
    ponto_coleta VARCHAR(255) NOT NULL,
    status ENUM('EM_ANDAMENTO', 'CONCLUIDO') NOT NULL DEFAULT 'EM_ANDAMENTO',
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_necessidades_campanha FOREIGN KEY (campanha_id) REFERENCES campanhas(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS voluntarios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    telefone VARCHAR(20) NOT NULL,
    especialidade_profissao VARCHAR(100),
    area_interesse VARCHAR(100) NOT NULL,
    disponibilidade VARCHAR(150) NOT NULL,
    status ENUM('PENDENTE', 'APROVADO', 'REPROVADO') NOT NULL DEFAULT 'PENDENTE',
    observacoes_admin TEXT,
    cadastrado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_voluntarios_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS escalas_voluntarios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    voluntario_id BIGINT NOT NULL,
    atividade VARCHAR(150) NOT NULL,
    data_inicio DATETIME NOT NULL,
    data_fim DATETIME NOT NULL,
    local VARCHAR(200),
    CONSTRAINT fk_escala_voluntario FOREIGN KEY (voluntario_id) REFERENCES voluntarios(id) ON DELETE CASCADE,
    INDEX idx_escalas_inicio (data_inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS relatorios_impacto (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    periodo_referencia VARCHAR(50) NOT NULL, -- Ex: "Janeiro/2026"
    atendimentos_realizados INT NOT NULL DEFAULT 0,
    atendimentos_medicos INT NOT NULL DEFAULT 0,
    materiais_arrecadados_qtd INT NOT NULL DEFAULT 0,
    descricao_resultados TEXT,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documentos_relatorios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    relatorio_id BIGINT NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    caminho_arquivo VARCHAR(255) NOT NULL, -- URL de download (/api/publico/documentos/<id>)
    tipo_mime VARCHAR(50) NOT NULL,
    tamanho_bytes INT NOT NULL DEFAULT 0,
    enviado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_documento_relatorio FOREIGN KEY (relatorio_id) REFERENCES relatorios_impacto(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conteúdo binário dos PDFs, dividido em partes de até 1 MB.
CREATE TABLE IF NOT EXISTS documentos_conteudo (
    documento_id BIGINT NOT NULL,
    parte INT NOT NULL,
    dados MEDIUMBLOB NOT NULL,
    PRIMARY KEY (documento_id, parte),
    CONSTRAINT fk_conteudo_documento FOREIGN KEY (documento_id) REFERENCES documentos_relatorios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO perfis (id, nome) VALUES (1, 'ADMINISTRADOR'), (2, 'OPERADOR');
