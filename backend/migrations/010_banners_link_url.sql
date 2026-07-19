-- ============================================================================
-- MIGRATION 010: Adiciona link_url nos banners (redirecionamento ao clicar)
-- ============================================================================

ALTER TABLE IF EXISTS banners
  ADD COLUMN IF NOT EXISTS link_url VARCHAR(500) DEFAULT NULL;
