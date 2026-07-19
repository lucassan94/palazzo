-- ============================================================================
-- SABOREXPRESS - Migration 008: Push Subscriptions (PWA Notifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL DEFAULT '',
    auth TEXT NOT NULL DEFAULT '',
    criado_em TIMESTAMP DEFAULT NOW(),
    atualizado_em TIMESTAMP DEFAULT NOW(),
    UNIQUE(cliente_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_cliente ON push_subscriptions(cliente_id);
