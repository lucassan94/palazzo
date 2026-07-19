-- ============================================================================
-- MIGRATION 007: Adiciona maximo em produtos_extras e imagem_base64 em produtos
-- ============================================================================

-- 1. produtos_extras: campo maximo (limite de quantidade por adicional)
--    DEFAULT 1 = pode selecionar apenas 1 vez
--    NULL = ilimitado
ALTER TABLE IF EXISTS produtos_extras
  ADD COLUMN IF NOT EXISTS maximo INTEGER DEFAULT 1;

-- 2. produtos: campo imagem_base64 (armazenar imagem diretamente na tabela)
ALTER TABLE IF EXISTS produtos
  ADD COLUMN IF NOT EXISTS imagem_base64 TEXT;

-- 3. Atualizar restrição CHECK do metodo_pagamento nos pedidos
--    (já deve incluir pix_online e credito_online das migrations anteriores)
ALTER TABLE IF EXISTS pedidos
  DROP CONSTRAINT IF EXISTS pedidos_metodo_pagamento_check;

ALTER TABLE IF EXISTS pedidos
  ADD CONSTRAINT pedidos_metodo_pagamento_check
  CHECK (metodo_pagamento IN ('dinheiro', 'credito', 'debito', 'pix', 'pix_online', 'credito_online'));

-- ============================================================================
-- Atualizar seed de extras para incluir maximo
-- ============================================================================
UPDATE produtos_extras SET maximo = 1 WHERE maximo IS NULL;
