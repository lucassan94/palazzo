-- ============================================================================
-- SABOREXPRESS - Migration 001: Schema Inicial
-- PostgreSQL 16 | Multitenant por restaurant_id
-- ============================================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABELA: restaurantes (Multi-tenant)
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurantes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL DEFAULT 'SaborExpress',
    endereco TEXT,
    cep VARCHAR(9),
    cidade VARCHAR(100) DEFAULT 'São Paulo',
    estado VARCHAR(2) DEFAULT 'SP',
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    status_loja BOOLEAN DEFAULT TRUE,           -- aberta/fechada
    tempo_preparo_min INTEGER DEFAULT 20,       -- minutos estimados
    auto_impressao BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 2. TABELA: clientes
-- ============================================================================
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    sobrenome VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    senha_hash VARCHAR(255) NOT NULL,
    endereco TEXT,
    cep VARCHAR(9),
    numero VARCHAR(20),
    bairro VARCHAR(100),
    complemento VARCHAR(255),
    cidade VARCHAR(100) DEFAULT 'São Paulo',
    estado VARCHAR(2) DEFAULT 'SP',
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    total_gasto DECIMAL(10,2) DEFAULT 0,
    pedidos_total INTEGER DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_restaurant ON clientes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);

-- ============================================================================
-- 3. TABELA: entregadores
-- ============================================================================
CREATE TABLE IF NOT EXISTS entregadores (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    cpf VARCHAR(14) UNIQUE,
    rg VARCHAR(20),
    data_nascimento DATE,
    endereco TEXT,
    senha_hash VARCHAR(255) NOT NULL,
    foto_url TEXT,
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'bloqueado')),
    entregas_total INTEGER DEFAULT 0,
    frete_total_recebido DECIMAL(10,2) DEFAULT 0,
    ultima_entrega_em TIMESTAMP,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    ultima_localizacao_em TIMESTAMP,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entregadores_restaurant ON entregadores(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_entregadores_email ON entregadores(email);
CREATE INDEX IF NOT EXISTS idx_entregadores_status ON entregadores(status);

-- ============================================================================
-- 4. TABELA: restaurante_users (Staff/Admin)
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurante_users (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    cargo VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (cargo IN ('admin', 'gerente', 'chef', 'caixa')),
    telefone VARCHAR(20),
    ativo BOOLEAN DEFAULT TRUE,
    ultimo_acesso TIMESTAMP,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurante_users_restaurant ON restaurante_users(restaurant_id);

-- ============================================================================
-- 5. TABELA: categorias
-- ============================================================================
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    ordem INTEGER DEFAULT 0,
    criado_em TIMESTAMP DEFAULT NOW(),
    UNIQUE(restaurant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_categorias_restaurant ON categorias(restaurant_id);

-- ============================================================================
-- 6. TABELA: produtos
-- ============================================================================
CREATE TABLE IF NOT EXISTS produtos (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    preco DECIMAL(10,2) NOT NULL,
    imagem_url TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    destaque BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_restaurant ON produtos(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);

-- ============================================================================
-- 7. TABELA: produtos_extras (Adicionais/Opcionais)
-- ============================================================================
CREATE TABLE IF NOT EXISTS produtos_extras (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    preco DECIMAL(10,2) NOT NULL DEFAULT 0,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_extras_produto ON produtos_extras(produto_id);

-- ============================================================================
-- 8. TABELA: raios_entrega (Matriz de logística)
-- ============================================================================
CREATE TABLE IF NOT EXISTS raios_entrega (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    raio_km INTEGER NOT NULL,
    tempo_min INTEGER NOT NULL,
    tempo_max INTEGER NOT NULL,
    custo DECIMAL(10,2) NOT NULL,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raios_entrega_restaurant ON raios_entrega(restaurant_id);

-- ============================================================================
-- 9. TABELA: pedidos
-- ============================================================================
CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    pedido_id VARCHAR(20) UNIQUE NOT NULL,      -- Formato #1042
    restaurant_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    entregador_id INTEGER REFERENCES entregadores(id) ON DELETE SET NULL,
    
    -- Cliente info (snapshot)
    nome_cliente VARCHAR(200),
    telefone_cliente VARCHAR(20),
    endereco_cliente TEXT,
    numero_cliente VARCHAR(20),
    bairro_cliente VARCHAR(100),
    cep_cliente VARCHAR(9),
    cidade_cliente VARCHAR(100),
    estado_cliente VARCHAR(2),
    latitude_cliente DECIMAL(10,7),
    longitude_cliente DECIMAL(10,7),
    
    -- Financeiro
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    valor_frete DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Pagamento
    metodo_pagamento VARCHAR(30) CHECK (metodo_pagamento IN ('dinheiro', 'credito', 'debito', 'pix')),
    detalhes_pagamento VARCHAR(255),            -- "Troco para R$60"
    
    -- Status
    status VARCHAR(30) NOT NULL DEFAULT 'pendente' CHECK (status IN (
        'pendente', 'preparando', 'pronto_entrega', 'em_transito',
        'cheguei_destino', 'entregue', 'cancelado', 'recusado'
    )),
    motivo_cancelamento TEXT,
    
    -- Tempos
    tempo_preparo_estimado INTEGER,             -- minutos
    tempo_entrega_estimado INTEGER,             -- minutos
    aceito_em TIMESTAMP,
    preparo_inicio_em TIMESTAMP,
    pronto_em TIMESTAMP,
    transito_inicio_em TIMESTAMP,
    destino_chegada_em TIMESTAMP,
    entregue_em TIMESTAMP,
    cancelado_em TIMESTAMP,
    
    -- Observações
    observacoes TEXT,
    
    -- Auditoria
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_restaurant ON pedidos(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_entregador ON pedidos(entregador_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_criado ON pedidos(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_pedido_id ON pedidos(pedido_id);

-- ============================================================================
-- 10. TABELA: pedido_itens
-- ============================================================================
CREATE TABLE IF NOT EXISTS pedido_itens (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
    nome_produto VARCHAR(255) NOT NULL,         -- Snapshot
    quantidade INTEGER NOT NULL DEFAULT 1,
    preco_unitario DECIMAL(10,2) NOT NULL,
    extras JSONB,                                -- [{"nome": "Bacon", "preco": 4.00}]
    subtotal DECIMAL(10,2) NOT NULL,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON pedido_itens(pedido_id);

-- ============================================================================
-- 11. TABELA: pedido_timeline (Histórico/Auditoria)
-- ============================================================================
CREATE TABLE IF NOT EXISTS pedido_timeline (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    pedido_id_ref VARCHAR(20),
    status_anterior VARCHAR(30),
    status_novo VARCHAR(30) NOT NULL,
    usuario_id INTEGER,
    usuario_tipo VARCHAR(30) DEFAULT 'sistema' CHECK (usuario_tipo IN ('sistema', 'cliente', 'entregador', 'restaurante')),
    notas TEXT,
    mudado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedido_timeline_pedido ON pedido_timeline(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_timeline_data ON pedido_timeline(mudado_em DESC);

-- ============================================================================
-- 12. TABELA: mensagens_pedido
-- ============================================================================
CREATE TABLE IF NOT EXISTS mensagens_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_pedido ON mensagens_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_pedido_lida ON mensagens_pedido(lida);

-- ============================================================================
-- 13. TABELA: refresh_tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    usuario_id INTEGER NOT NULL,
    usuario_tipo VARCHAR(30) NOT NULL,          -- 'cliente', 'entregador', 'restaurante'
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario ON refresh_tokens(usuario_id, usuario_tipo);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurante_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_pedido ENABLE ROW LEVEL SECURITY;

-- Políticas: cada módulo vê apenas dados do seu restaurante
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'clientes_restaurant_isolation') THEN
        CREATE POLICY clientes_restaurant_isolation ON clientes
            USING (restaurant_id = current_setting('app.restaurant_id')::integer);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'entregadores_restaurant_isolation') THEN
        CREATE POLICY entregadores_restaurant_isolation ON entregadores
            USING (restaurant_id = current_setting('app.restaurant_id')::integer);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'restaurante_users_restaurant_isolation') THEN
        CREATE POLICY restaurante_users_restaurant_isolation ON restaurante_users
            USING (restaurant_id = current_setting('app.restaurant_id')::integer);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'produtos_restaurant_isolation') THEN
        CREATE POLICY produtos_restaurant_isolation ON produtos
            USING (restaurant_id = current_setting('app.restaurant_id')::integer);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'produtos_extras_restaurant_isolation') THEN
        CREATE POLICY produtos_extras_restaurant_isolation ON produtos_extras
            USING (produto_id IN (SELECT id FROM produtos WHERE restaurant_id = current_setting('app.restaurant_id')::integer));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pedidos_restaurant_isolation') THEN
        CREATE POLICY pedidos_restaurant_isolation ON pedidos
            USING (restaurant_id = current_setting('app.restaurant_id')::integer);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pedido_itens_restaurant_isolation') THEN
        CREATE POLICY pedido_itens_restaurant_isolation ON pedido_itens
            USING (pedido_id IN (SELECT id FROM pedidos WHERE restaurant_id = current_setting('app.restaurant_id')::integer));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pedido_timeline_restaurant_isolation') THEN
        CREATE POLICY pedido_timeline_restaurant_isolation ON pedido_timeline
            USING (pedido_id IN (SELECT id FROM pedidos WHERE restaurant_id = current_setting('app.restaurant_id')::integer));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'mensagens_pedido_restaurant_isolation') THEN
        CREATE POLICY mensagens_pedido_restaurant_isolation ON mensagens_pedido
            USING (restaurante_id = current_setting('app.restaurant_id')::integer);
    END IF;
END $$;

-- ============================================================================
-- FUNÇÕES E TRIGGERS
-- ============================================================================

-- Função para gerar ID do pedido no formato #NUMERO
CREATE OR REPLACE FUNCTION gerar_pedido_id()
RETURNS TRIGGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    SELECT COALESCE(MAX(SUBSTRING(pedido_id FROM 2)::INTEGER), 1000) + 1
    INTO next_num
    FROM pedidos
    WHERE restaurant_id = NEW.restaurant_id;
    
    NEW.pedido_id := '#' || next_num::TEXT;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gerar_pedido_id ON pedidos;
CREATE TRIGGER trg_gerar_pedido_id
    BEFORE INSERT ON pedidos
    FOR EACH ROW
    WHEN (NEW.pedido_id IS NULL)
    EXECUTE FUNCTION gerar_pedido_id();

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clientes_atualizado ON clientes;
CREATE TRIGGER trg_clientes_atualizado
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();

DROP TRIGGER IF EXISTS trg_entregadores_atualizado ON entregadores;
CREATE TRIGGER trg_entregadores_atualizado
    BEFORE UPDATE ON entregadores
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();

DROP TRIGGER IF EXISTS trg_produtos_atualizado ON produtos;
CREATE TRIGGER trg_produtos_atualizado
    BEFORE UPDATE ON produtos
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();

DROP TRIGGER IF EXISTS trg_pedidos_atualizado ON pedidos;
CREATE TRIGGER trg_pedidos_atualizado
    BEFORE UPDATE ON pedidos
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();

DROP TRIGGER IF EXISTS trg_restaurante_users_atualizado ON restaurante_users;
CREATE TRIGGER trg_restaurante_users_atualizado
    BEFORE UPDATE ON restaurante_users
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();

DROP TRIGGER IF EXISTS trg_restaurantes_atualizado ON restaurantes;
CREATE TRIGGER trg_restaurantes_atualizado
    BEFORE UPDATE ON restaurantes
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();

-- ============================================================================
-- FUNÇÃO: Registrar timeline automaticamente
-- ============================================================================
CREATE OR REPLACE FUNCTION registrar_timeline()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO pedido_timeline (
            pedido_id, pedido_id_ref, status_anterior, status_novo,
            usuario_tipo, mudado_em
        ) VALUES (
            NEW.id, NEW.pedido_id, OLD.status, NEW.status,
            'sistema', NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedidos_timeline ON pedidos;
CREATE TRIGGER trg_pedidos_timeline
    AFTER UPDATE OF status ON pedidos
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION registrar_timeline();

-- ============================================================================
-- SEED DATA: Restaurante padrão
-- ============================================================================
INSERT INTO restaurantes (id, nome, endereco, cep, cidade, estado, latitude, longitude, tempo_preparo_min)
VALUES (1, 'SaborExpress', 'Av. Principal, 500', '01310-000', 'São Paulo', 'SP', -23.5615, -46.6560, 20)
ON CONFLICT (id) DO NOTHING;

-- Resetar sequence
SELECT setval('restaurantes_id_seq', (SELECT COALESCE(MAX(id), 1) FROM restaurantes));

-- Categorias padrão
INSERT INTO categorias (restaurant_id, nome, slug, ordem) VALUES
(1, 'Burguers', 'burguers', 1),
(1, 'Pizzas', 'pizzas', 2),
(1, 'Bebidas', 'bebidas', 3),
(1, 'Sobremesas', 'sobremesas', 4),
(1, 'Porções', 'porcoes', 5)
ON CONFLICT (restaurant_id, slug) DO NOTHING;

-- Raios de entrega padrão
INSERT INTO raios_entrega (restaurant_id, raio_km, tempo_min, tempo_max, custo) VALUES
(1, 1, 15, 25, 5.00),
(1, 3, 20, 35, 7.00),
(1, 5, 25, 45, 10.00),
(1, 10, 30, 60, 15.00)
ON CONFLICT DO NOTHING;
