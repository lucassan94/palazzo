-- ======================================================
-- SABOREXPRESS - Migration 006: Asaas Payment Gateway
-- ======================================================
-- Descrição: Tabelas e colunas para integração com Asaas
--            (PIX e Cartão de Crédito online)
-- ======================================================

BEGIN;

-- 001: Tabela de pagamentos (cobranças Asaas)
CREATE TABLE IF NOT EXISTS pagamentos (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  customer_id VARCHAR NOT NULL,              -- Asaas customer ID
  payment_id VARCHAR NOT NULL,               -- Asaas payment ID
  billing_type VARCHAR NOT NULL,             -- PIX | CREDIT_CARD
  status VARCHAR NOT NULL DEFAULT 'PENDING', -- PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, etc
  valor_bruto DECIMAL(10,2) NOT NULL,
  valor_liquido DECIMAL(10,2),               -- Valor após taxas Asaas
  taxa DECIMAL(10,2),                        -- Taxa cobrada pelo Asaas
  encoded_image TEXT,                         -- QR Code PIX em Base64
  payload TEXT,                               -- Código PIX Copia e Cola
  invoice_url TEXT,                           -- URL da fatura (cartão)
  credit_card_token VARCHAR,                 -- Token do cartão (para reuso futuro)
  data_vencimento DATE NOT NULL,             -- dueDate enviado ao Asaas
  pago_em TIMESTAMP,                         -- Quando o pagamento foi confirmado
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_pedido_id ON pagamentos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_payment_id ON pagamentos(payment_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON pagamentos(status);

-- 002: Tabela de eventos de webhook (dedup)
CREATE TABLE IF NOT EXISTS webhook_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR NOT NULL UNIQUE,          -- ID único do evento Asaas
  event_type VARCHAR NOT NULL,
  payment_id VARCHAR,
  processed BOOLEAN DEFAULT FALSE,
  error TEXT,
  received_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);

-- 003: Colunas Asaas em clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(50);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(20);

-- 004: Atualizar constraint CHECK de status dos pedidos
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check
  CHECK (status IN (
    'aguardando_pagamento', 'pendente', 'preparando', 'pronto_entrega',
    'em_transito', 'cheguei_destino', 'entregue', 'cancelado', 'recusado'
  ));

-- 005: Atualizar constraint CHECK de metodo_pagamento
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_metodo_pagamento_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_metodo_pagamento_check
  CHECK (metodo_pagamento IN (
    'dinheiro', 'credito', 'debito', 'pix', 'pix_online', 'credito_online'
  ));

COMMIT;
