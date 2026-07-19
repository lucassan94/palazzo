-- ============================================================================
-- MIGRATION 009: Tabela banners (Carrossel gerenciável)
-- ============================================================================

CREATE TABLE IF NOT EXISTS banners (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL DEFAULT '',
    subtitulo TEXT DEFAULT '',
    imagem_url TEXT,
    imagem_base64 TEXT,
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_restaurant ON banners(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_banners_ordem ON banners(restaurant_id, ordem);

-- Trigger para atualizar atualizado_em
DROP TRIGGER IF EXISTS trg_banners_atualizado ON banners;
CREATE TRIGGER trg_banners_atualizado
    BEFORE UPDATE ON banners
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp();
