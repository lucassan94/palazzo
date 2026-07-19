-- SABOREXPRESS - Migration 002: Fix race conditions + cleanup
-- Preserva dados existentes e adiciona constraints

-- Remover trigger antigo (se existir da migracao 001)
DROP TRIGGER IF EXISTS trg_gerar_pedido_id ON pedidos;
DROP FUNCTION IF EXISTS gerar_pedido_id();

-- Criar sequence por restaurante
CREATE SEQUENCE IF NOT EXISTS pedido_id_seq START 1000 INCREMENT 1;

-- Nova funcao usando sequence (thread-safe)
CREATE OR REPLACE FUNCTION gerar_pedido_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.pedido_id := '#' || NEXTVAL('pedido_id_seq')::TEXT;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gerar_pedido_id
    BEFORE INSERT ON pedidos
    FOR EACH ROW
    WHEN (NEW.pedido_id IS NULL)
    EXECUTE FUNCTION gerar_pedido_id();

-- Remover duplicatas de raios_entrega antes de adicionar unique constraint
DELETE FROM raios_entrega a USING (
    SELECT MIN(id) as id, restaurant_id, raio_km
    FROM raios_entrega
    GROUP BY restaurant_id, raio_km
    HAVING COUNT(*) > 1
) b
WHERE a.restaurant_id = b.restaurant_id
  AND a.raio_km = b.raio_km
  AND a.id != b.id;

-- Adicionar unique constraint
ALTER TABLE raios_entrega DROP CONSTRAINT IF EXISTS unique_restaurant_raio;
ALTER TABLE raios_entrega ADD CONSTRAINT unique_restaurant_raio UNIQUE (restaurant_id, raio_km);

-- Seed raios_entrega se estiver vazio
INSERT INTO raios_entrega (restaurant_id, raio_km, tempo_min, tempo_max, custo)
SELECT 1, 1, 15, 25, 5.00
WHERE NOT EXISTS (SELECT 1 FROM raios_entrega WHERE restaurant_id = 1 AND raio_km = 1);

INSERT INTO raios_entrega (restaurant_id, raio_km, tempo_min, tempo_max, custo)
SELECT 1, 3, 20, 35, 7.00
WHERE NOT EXISTS (SELECT 1 FROM raios_entrega WHERE restaurant_id = 1 AND raio_km = 3);

INSERT INTO raios_entrega (restaurant_id, raio_km, tempo_min, tempo_max, custo)
SELECT 1, 5, 25, 45, 10.00
WHERE NOT EXISTS (SELECT 1 FROM raios_entrega WHERE restaurant_id = 1 AND raio_km = 5);

INSERT INTO raios_entrega (restaurant_id, raio_km, tempo_min, tempo_max, custo)
SELECT 1, 10, 30, 60, 15.00
WHERE NOT EXISTS (SELECT 1 FROM raios_entrega WHERE restaurant_id = 1 AND raio_km = 10);
