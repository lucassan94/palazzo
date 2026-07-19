# 💳 Asaas Payment Integration — Spec

> **Data:** 18/07/2026
> **Versão:** 2.0
> **Sistema:** SaborExpress V2
> **Gateway:** Asaas (Sandbox → Produção)
> **Revisão:** Corrigido nomenclatura PIX, cartões de teste, dueDate strategy, idempotency, refund, e webhook detalhado

---

## 1. Visão Geral

Integrar o **Asaas** como gateway de pagamento online para cobrança via **PIX** e **Cartão de Crédito** (checkout embutido). O fluxo atual de pagamento na entrega (dinheiro/cartão) será mantido como alternativa (fluxo híbrido).

### 📌 Decisões de Design

| Decisão | Escolha |
|---------|---------|
| Formas de pagamento online | PIX + Cartão de Crédito |
| Fluxo cartão | Checkout embutido (dados no próprio app) |
| Tokenização | Backend chama API Asaas (não há SDK JS frontend) |
| Pagamento antes do pedido? | **Híbrido**: PIX/Cartão paga antes. Dinheiro/Cartão na entrega mantém fluxo atual |
| PIX expirado / cartão recusado | Cancelar pedido automaticamente via webhook |
| Identificação do cliente Asaas | CPF + externalReference (ID do nosso banco) |
| DueDate strategy | dueDate = hoje + 30d (prazo Asaas). Timer de 15min no frontend é UX apenas |
| Exibição PIX QR Code | Tela de tracking do pedido (status `aguardando_pagamento`) |
| Webhook endpoint | `POST /api/pagamentos/webhook` |
| Ambiente | Sandbox para testes → Produção |
| Idempotency | `idempotency_key` header baseado no pedido_id |
| Reembolso | Admin pode reembolsar via ação manual no painel |
| Graceful degradation | Se Asaas offline, erro amigável + sugerir pagamento na entrega |

---

## 2. Arquitetura

### 2.1 Fluxo de Pagamento Online

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Frontend   │     │   Backend (Node)  │     │  Asaas API   │
│  (Checkout)  │     │   Express + pg    │     │  (Gateway)   │
└──────┬───────┘     └────────┬──────────┘     └──────┬───────┘
       │                      │                       │
       │ 1. Escolhe PIX/Cartão│                       │
       │─────────────────────>│                       │
       │                      │ 2. findOrCreateCustomer│
       │                      │──────────────────────>│
       │                      │ 3. customer_id        │
       │                      │<──────────────────────│
       │                      │                       │
       │                      │ 4. Cria cobrança     │
       │                      │    POST /v3/payments  │
       │                      │    + idempotency_key  │
       │                      │──────────────────────>│
       │                      │ 5. payment_id, status │
       │                      │    encodedImage,etc   │
       │                      │<──────────────────────│
       │                      │                       │
       │ 6. Cria pedido + pag │                       │
       │    no DB (transação) │                       │
       │<─────────────────────│                       │
       │                      │                       │
       │ 7. Exibe QR/PIX ou   │                       │
       │    redireciona       │                       │
       │    (tracking)        │                       │
       │                      │                       │
       │                      │ 8. Webhook (async):   │
       │                      │    PAYMENT_RECEIVED   │
       │                      │<──────────────────────│
       │                      │                       │
       │ 9. Status atualizado │                       │
       │    via WebSocket     │                       │
       │<─────────────────────│                       │
```

### 2.2 Fluxo Híbrido

| Método | Tipo | Fluxo |
|--------|------|-------|
| **PIX** | Online | Cliente paga antes. Pedido só aparece na fila após confirmação |
| **Cartão de Crédito** | Online | Cliente paga antes. Se aprovado, pedido vai pra fila |
| **Dinheiro** | Na entrega (COD) | Mantém fluxo atual — pedido vai direto pra fila |
| **Cartão Débito** | Na entrega (COD) | Mantém fluxo atual — pedido vai direto pra fila |
| **Cartão Crédito (na entrega)** | Na entrega (COD) | Mantém fluxo atual — pedido vai direto pra fila |

### 2.3 Mapa de Status: Pagamento × Pedido

| Status Pagamento Asaas | Status Pedido | Ação |
|------------------------|---------------|------|
| `PENDING` | `aguardando_pagamento` | Pedido criado, aguardando pagamento |
| `RECEIVED` | `pendente` | Fundos disponíveis. Aparece na fila do admin |
| `CONFIRMED` | `pendente` | Pagamento confirmado (fundos não disponíveis ainda) |
| `OVERDUE` | `cancelado` | Venceu o prazo, pedido cancelado |
| `REFUNDED` | `cancelado` | Estornado (admin solicitou) |
| `PARTIALLY_REFUNDED` | `cancelado` | Reembolso parcial |
| `CHARGEBACK_REQUESTED` | `cancelado` | Chargeback solicitado pelo cliente |
| `CHARGEBACK_DISPUTE` | `cancelado` | Disputa de chargeback em andamento |
| `REFUND_IN_PROGRESS` | `cancelado` | Reembolso em processamento |
| `REFUND_DENIED` | `pendente` | Reembolso negado (volta ao status anterior) |

### 2.4 Status do Pedido (Atualizado)

Adicionar novo status `aguardando_pagamento` ao enum:

```
aguardando_pagamento → pendente (quando pago)
aguardando_pagamento → cancelado (quando expira/recusado)
pendente → preparando → pronto_entrega → em_transito → cheguei_destino → entregue
cancelado, recusado (terminais)
```

---

## 3. Estrutura de Dados

### 3.1 Migration 006 — Tabela `pagamentos`

```sql
CREATE TABLE pagamentos (
  id SERIAL PRIMARY KEY,
  pedido_id VARCHAR NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  customer_id VARCHAR NOT NULL,              -- Asaas customer ID
  payment_id VARCHAR NOT NULL,               -- Asaas payment ID
  billing_type VARCHAR NOT NULL,             -- PIX | CREDIT_CARD
  status VARCHAR NOT NULL DEFAULT 'PENDING', -- PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, etc
  valor_bruto DECIMAL(10,2) NOT NULL,
  valor_liquido DECIMAL(10,2),               -- Valor após taxas Asaas
  taxa DECIMAL(10,2),                        -- Taxa cobrada pelo Asaas
  encoded_image TEXT,                         -- QR Code PIX em Base64 (campo encodedImage da Asaas)
  payload TEXT,                               -- Código PIX Copia e Cola
  invoice_url TEXT,                           -- URL da fatura (cartão)
  credit_card_token VARCHAR,                 -- Token do cartão (para reuso futuro)
  data_vencimento DATE NOT NULL,             -- dueDate enviado ao Asaas
  pago_em TIMESTAMP,                         -- Quando o pagamento foi confirmado
  processado_em TIMESTAMP,                   -- Quando processamos o webhook
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pagamentos_pedido_id ON pagamentos(pedido_id);
CREATE INDEX idx_pagamentos_payment_id ON pagamentos(payment_id);
CREATE INDEX idx_pagamentos_status ON pagamentos(status);
```

### 3.2 Migration 006 — Colunas em `clientes`

```sql
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(50);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cpf_cnpj VARCHAR(20);
```

### 3.3 Migration 006 — Webhook Events (tabela para dedup)

```sql
CREATE TABLE webhook_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR NOT NULL UNIQUE,          -- ID único do evento Asaas (para dedup)
  event_type VARCHAR NOT NULL,
  payment_id VARCHAR,
  received_at TIMESTAMP DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  error TEXT
);

CREATE INDEX idx_webhook_events_event_id ON webhook_events(event_id);
```

---

## 4. Configuração (Ambiente)

### 4.1 Variáveis de Ambiente

```env
# === Asaas (Sandbox) ===
ASAAS_API_KEY=seu_token_sandbox_aqui
ASAAS_ENV=sandbox                    # sandbox | production
ASAAS_WEBHOOK_TOKEN=token_para_validar_webhooks
```

### 4.2 Config (config/index.js)

```javascript
asaas: {
  apiKey: process.env.ASAAS_API_KEY,
  environment: process.env.ASAAS_ENV || 'sandbox',
  baseUrl: process.env.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com'
    : 'https://api-sandbox.asaas.com',
  webhookToken: process.env.ASAAS_WEBHOOK_TOKEN,
  pixExpiryMinutes: 15,        // Timer visual no frontend (dueDate real = hoje + 30d)
  requestTimeout: 60000,        // 60s (recomendação Asaas para cartão)
}
```

---

## 5. Backend — Implementação

### 5.1 Serviço Asaas (backend/src/services/asaas.js)

```javascript
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';

const BASE_URL = config.asaas.baseUrl;
const HEADERS = {
  'Content-Type': 'application/json',
  'access_token': config.asaas.apiKey,
};

async function call(method, path, body = null, idempotencyKey = null) {
  const headers = { ...HEADERS };
  if (idempotencyKey) headers['idempotency_key'] = idempotencyKey;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
    signal: AbortSignal.timeout(config.asaas.requestTimeout),
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data.errors?.[0]?.description || 'Erro na comunicação com Asaas';
    const code = data.errors?.[0]?.code || 'ASAAS_ERROR';
    throw new AppError(msg, 400, code);
  }

  return data;
}

// ── Customer ──

export async function findCustomer(cpfCnpj, externalRef) {
  return call('GET', `/api/v3/customers?cpfCnpj=${cpfCnpj}&externalReference=${externalRef}`);
}

export async function createCustomer({ name, cpfCnpj, email, phone, externalReference }) {
  return call('POST', '/api/v3/customers', {
    name, cpfCnpj, email,
    mobilePhone: phone,
    externalReference: String(externalReference),
    notificationDisabled: true,
  });
}

export async function findOrCreateCustomer(clienteData) {
  const { data } = await findCustomer(clienteData.cpfCnpj, String(clienteData.id));
  if (data?.length > 0) return data[0];
  return createCustomer(clienteData);
}

// ── Payment ──

export async function createPayment({
  customer, billingType, value, dueDate,
  description, externalReference,
  creditCard, creditCardHolderInfo, remoteIp,
}, idempotencyKey) {
  const body = {
    customer,
    billingType,
    value,
    dueDate,
    description,
    externalReference: String(externalReference),
  };

  if (billingType === 'CREDIT_CARD' && creditCard) {
    body.creditCard = creditCard;
    body.creditCardHolderInfo = creditCardHolderInfo;
    body.remoteIp = remoteIp;
  }

  return call('POST', '/api/v3/payments', body, idempotencyKey);
}

export async function getPayment(paymentId) {
  return call('GET', `/api/v3/payments/${paymentId}`);
}

export async function getPixQrCode(paymentId) {
  return call('GET', `/api/v3/payments/${paymentId}/pixQrCode`);
}

export async function deletePayment(paymentId) {
  return call('DELETE', `/api/v3/payments/${paymentId}`);
}

export async function refundPayment(paymentId, value = null) {
  const body = {};
  if (value !== null) body.value = value;
  return call('POST', `/api/v3/payments/${paymentId}/refund`, body);
}

export async function tokenizeCard(cardData) {
  return call('POST', '/api/v3/creditCard/tokenize', cardData);
}

// ── Webhook (criação automática) ──

export async function createWebhook(url, authToken, events) {
  return call('POST', '/api/v3/webhooks', {
    url,
    email: 'admin@saborexpress.com',
    enabled: true,
    events,
    authToken,
  });
}
```

### 5.2 Módulo Pagamentos (backend/src/modules/pagamentos/index.js)

**Rotas:**

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/api/pagamentos/criar` | Cliente | Cria pagamento + pedido (PIX ou Cartão) |
| `POST` | `/api/pagamentos/webhook` | Público (valida token) | Webhook Asaas |
| `GET` | `/api/pagamentos/:pedidoId/pix-qrcode` | Cliente | QR Code PIX de um pedido |
| `POST` | `/api/pagamentos/:pedidoId/reembolsar` | Admin/Gerente | Reembolso manual |

#### 5.2.1 POST /api/pagamentos/criar

**Validações:**
- Cliente precisa estar autenticado
- Carrinho não pode estar vazio
- Loja precisa estar aberta
- CPF é obrigatório para pagamento online

**Request Body (PIX):**
```json
{
  "tipo": "PIX",
  "cliente": {
    "id": 1,
    "cpfCnpj": "12345678901",
    "nome": "João Silva",
    "email": "joao@email.com",
    "telefone": "11999999999"
  },
  "pedido": {
    "endereco": "Rua A, 123",
    "numero": "123",
    "bairro": "Centro",
    "cep": "01310-000",
    "cidade": "São Paulo",
    "estado": "SP"
  },
  "subtotal": 55.00,
  "valor_frete": 7.00,
  "total": 62.00,
  "itens": [ ... ]
}
```

**Request Body (Cartão):**
```json
{
  "tipo": "CREDIT_CARD",
  "cliente": { ... },
  "pedido": { ... },
  "subtotal": 55.00,
  "valor_frete": 7.00,
  "total": 62.00,
  "itens": [ ... ],
  "creditCard": {
    "holderName": "JOAO SILVA",
    "number": "4444444444444444",
    "expiryMonth": "12",
    "expiryYear": "2028",
    "ccv": "123"
  },
  "creditCardHolderInfo": {
    "name": "João Silva",
    "email": "joao@email.com",
    "cpfCnpj": "12345678901",
    "postalCode": "01310000",
    "addressNumber": "123",
    "phone": "11999999999"
  },
  "remoteIp": "189.12.34.56"
}
```

**Response Success (PIX):**
```json
{
  "sucesso": true,
  "pedido_id": "#1042",
  "payment_id": "pay_1234567890",
  "status": "aguardando_pagamento",
  "pix": {
    "encodedImage": "base64...",    // ← NOME CORRETO (não pixQrCode)
    "payload": "00020101021226...", // ← Código PIX Copia e Cola
    "expirationDate": "2026-07-18T12:15:00-03:00"
  },
  "valor": 62.00,
  "expira_em_segundos": 900
}
```

**Response Success (Cartão):**
```json
{
  "sucesso": true,
  "pedido_id": "#1042",
  "payment_id": "pay_1234567890",
  "status": "pendente",
  "cartao": {
    "aprovado": true,
    "creditCardToken": "cct_abc123"
  }
}
```

**Response Error (Cartão Recusado):**
```json
{
  "sucesso": false,
  "erro": "Transação não autorizada. Verifique os dados do cartão.",
  "codigo": "invalid_creditCard"
}
```

**Response Error (Asaas offline):**
```json
{
  "sucesso": false,
  "erro": "Gateway de pagamento temporariamente indisponível. Tente novamente ou escolha pagamento na entrega.",
  "codigo": "GATEWAY_UNAVAILABLE"
}
```

#### 5.2.2 GET /api/pagamentos/:pedidoId/pix-qrcode

Endpoint para buscar o QR Code PIX após a criação do pedido (caso o cliente tenha fechado e reaberto a tela).

```json
{
  "encodedImage": "base64...",
  "payload": "00020101021226...",
  "expirationDate": "2026-07-18T12:15:00-03:00",
  "status": "aguardando_pagamento",
  "valor": 62.00
}
```

#### 5.2.3 POST /api/pagamentos/:pedidoId/reembolsar

**Auth:** Admin ou Gerente. **Action manual** no painel admin.

```json
{
  "valor": 62.00     // Opcional. Se omitido, reembolso total
}
```

**Validações:**
- Pedido precisa estar com status PAGO e `status_pagamento` = RECEIVED ou CONFIRMED
- Se PIX: permite reembolso total ou parcial
- Se Cartão: apenas reembolso total
- Se o Asaas retornar erro de saldo insuficiente, retornar erro claro

**Response:**
```json
{
  "sucesso": true,
  "mensagem": "Reembolso solicitado. O valor pode levar até 10 dias úteis para aparecer na fatura do cliente.",
  "refund_id": "ref_abc123"
}
```

---

## 6. WEBHOOK — TRATAMENTO DETALHADO DE EVENTOS

### 6.1 Estrutura do Webhook Asaas

Todos os webhooks seguem esta estrutura base:

```json
{
  "id": "evt_05b708f961d739ea7eba7e4db318f621",
  "event": "PAYMENT_RECEIVED",
  "dateCreated": "2026-07-18T10:30:00.000Z",
  "payment": {
    "id": "pay_080225913252",
    "status": "RECEIVED",
    "value": 62.00,
    "netValue": 59.80,
    "billingType": "PIX",
    "customer": "cus_000005085374",
    "externalReference": "1",         // Nosso cliente_id
    "dueDate": "2026-08-17",
    "invoiceUrl": "https://...",
    "creditCard": null,
    "creditCardToken": null,
    "originalDueDate": "2026-08-17",
    "paymentDate": "2026-07-18T10:25:00.000Z",
    "clientPaymentDate": "2026-07-18T10:25:00.000Z",
    "description": "Pedido #1042 - SaborExpress",
    "deleted": false,
    "anticipated": false,
    "bankSlipUrl": null,
    "lastInvoiceViewedDate": null,
    "lastBankSlipViewedDate": null,
    "fee": 2.20,
    "refunds": null
  }
}
```

**Importante:** O payload pode conter campos adicionais no futuro. O código deve tratar o JSON como extensível e **não quebrar** se campos novos aparecerem.

### 6.2 Validação de Segurança

```javascript
// Middleware do webhook
function validateWebhook(req, res, next) {
  const token = req.headers['asaas-access-token'];
  if (!token || token !== config.asaas.webhookToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
```

### 6.3 Idempotency (Dedup)

Asaas entrega **"at least once"** — o mesmo evento pode chegar múltiplas vezes.

**Estratégia de dedup:**

```javascript
// 1. Antes de processar, verificar se event_id já foi recebido
const existente = await query(
  'SELECT id FROM webhook_events WHERE event_id = $1',
  [webhookId]
);

if (existente.rows.length > 0) {
  // ✅ Já processado. Retornar 200 sem reprocessar.
  return res.status(200).json({ received: true, dedup: true });
}

// 2. Inserir evento na tabela (UNIQUE constraint)
await query(
  'INSERT INTO webhook_events (event_id, event_type, payment_id) VALUES ($1, $2, $3)',
  [webhookId, event, paymentId]
);

// 3. Processar lógica de negócio
await processarEvento(event, payment);

// 4. Marcar como processado
await query(
  'UPDATE webhook_events SET processed = TRUE WHERE event_id = $1',
  [webhookId]
);
```

### 6.4 Tabela de Eventos e Ações

| Evento | Quando ocorre | Ação no sistema |
|--------|---------------|-----------------|
| `PAYMENT_CREATED` | Cobrança criada na API | ✅ Log apenas. Status já deve estar como PENDING |
| `PAYMENT_UPDATED` | Cobrança atualizada (qualquer campo) | ✅ Atualizar `atualizado_em`. Se status mudou, tratar como evento específico |
| `PAYMENT_CONFIRMED` | Pagamento confirmado (fundos em processamento) | → **Atualizar** pag.status p/ `CONFIRMED` → **Mudar** pedido p/ `pendente` (fila) → **WebSocket** `pedido:novo` |
| `PAYMENT_RECEIVED` | ⭐ Fundos disponíveis na conta | → **Atualizar** pag.status p/ `RECEIVED`, `pago_em=NOW()` → **Se pedido ainda estiver `aguardando_pagamento`**, mudar p/ `pendente` (fila) → **WebSocket** `pedido:novo` |
| `PAYMENT_OVERDUE` | Vencimento da cobrança (dueDate passou) | → **Atualizar** pag.status p/ `OVERDUE` → **Cancelar** pedido motivo `"Pagamento não realizado no prazo"` → **WebSocket** `pedido:atualizado` |
| `PAYMENT_DELETED` | Cobrança deletada (via API) | → **Cancelar** pedido motivo `"Cobrança cancelada"` → liberar estoque |
| `PAYMENT_REFUNDED` | Reembolso total concluído | → **Atualizar** pag.status p/ `REFUNDED` → **Manter** pedido como `cancelado` (já deve estar) |
| `PAYMENT_PARTIALLY_REFUNDED` | Reembolso parcial concluído | → **Atualizar** pag.status p/ `PARTIALLY_REFUNDED` → **Log** notificando admin |
| `PAYMENT_REFUND_IN_PROGRESS` | Reembolso em processamento | → **Atualizar** pag.status p/ `REFUND_IN_PROGRESS` |
| `PAYMENT_REFUND_DENIED` | Reembolso negado | → **Atualizar** pag.status p/ `REFUND_DENIED` → **Notificar** admin |
| `PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` | Captura de cartão recusada | → **Atualizar** pag.status p/ `REFUSED` → **Cancelar** pedido motivo `"Cartão recusado na captura"` |
| `PAYMENT_CHARGEBACK_REQUESTED` | Chargeback solicitado | → **Atualizar** pag.status p/ `CHARGEBACK_REQUESTED` → **Notificar** admin com urgência |
| `PAYMENT_CHARGEBACK_DISPUTE` | Disputa de chargeback em andamento | → **Atualizar** pag.status p/ `CHARGEBACK_DISPUTE` |
| `PAYMENT_AWAITING_RISK_ANALYSIS` | Em análise de risco | → **Log** apenas |
| `PAYMENT_APPROVED_BY_RISK_ANALYSIS` | Análise de risco aprovada | → Tratar como CONFIRMED |
| `PAYMENT_REPROVED_BY_RISK_ANALYSIS` | Análise de risco reprovada | → **Cancelar** pedido motivo `"Reprovado pela análise de risco"` |
| `PAYMENT_BANK_SLIP_VIEWED` | Boleto visualizado | → **Log** apenas (não usamos boleto, mas registrar) |
| `PAYMENT_CHECKOUT_VIEWED` | Checkout visualizado | → **Log** apenas |

### 6.5 Lógica de Processamento (Código)

```javascript
// backend/src/modules/pagamentos/webhookHandler.js

const EVENT_HANDLERS = {
  PAYMENT_RECEIVED: async (payment, conn) => {
    await Promise.all([
      atualizarPagamento(conn, payment.id, 'RECEIVED', { pago_em: payment.paymentDate }),
      ativarPedidoSeAguardando(conn, payment.externalReference),
    ]);
    emitirEventoPedido(payment.externalReference);
  },

  PAYMENT_CONFIRMED: async (payment, conn) => {
    await Promise.all([
      atualizarPagamento(conn, payment.id, 'CONFIRMED'),
      ativarPedidoSeAguardando(conn, payment.externalReference),
    ]);
    emitirEventoPedido(payment.externalReference);
  },

  PAYMENT_OVERDUE: async (payment, conn) => {
    await Promise.all([
      atualizarPagamento(conn, payment.id, 'OVERDUE'),
      cancelarPedido(conn, payment.externalReference, 'Pagamento não realizado no prazo'),
    ]);
    // Notificar cliente via WebSocket
    emitirEventoPedido(payment.externalReference);
  },

  PAYMENT_DELETED: async (payment, conn) => {
    await Promise.all([
      atualizarPagamento(conn, payment.id, 'DELETED'),
      cancelarPedido(conn, payment.externalReference, 'Cobrança cancelada no gateway'),
    ]);
  },

  PAYMENT_REFUNDED: async (payment, conn) => {
    await atualizarPagamento(conn, payment.id, 'REFUNDED');
  },

  PAYMENT_PARTIALLY_REFUNDED: async (payment, conn) => {
    await atualizarPagamento(conn, payment.id, 'PARTIALLY_REFUNDED');
  },

  PAYMENT_REFUND_IN_PROGRESS: async (payment, conn) => {
    await atualizarPagamento(conn, payment.id, 'REFUND_IN_PROGRESS');
  },

  PAYMENT_REFUND_DENIED: async (payment, conn) => {
    await atualizarPagamento(conn, payment.id, 'REFUND_DENIED');
    notificarAdmin(`Reembolso negado para pedido ${payment.externalReference}`);
  },

  PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: async (payment, conn) => {
    await Promise.all([
      atualizarPagamento(conn, payment.id, 'REFUSED'),
      cancelarPedido(conn, payment.externalReference, 'Cartão recusado na captura'),
    ]);
  },

  PAYMENT_CHARGEBACK_REQUESTED: async (payment, conn) => {
    await atualizarPagamento(conn, payment.id, 'CHARGEBACK_REQUESTED');
    notificarAdmin(`⚠️ CHARGEBACK solicitado para pedido ${payment.externalReference}!`);
  },

  PAYMENT_CHARGEBACK_DISPUTE: async (payment, conn) => {
    await atualizarPagamento(conn, payment.id, 'CHARGEBACK_DISPUTE');
  },

  // Eventos que só logamos
  PAYMENT_CREATED: async (payment) => {
    console.log(`[Asaas] Pagamento criado: ${payment.id}`);
  },

  PAYMENT_UPDATED: async (payment) => {
    await atualizarPagamento(conn, payment.id, payment.status);
  },

  PAYMENT_AWAITING_RISK_ANALYSIS: async () => {},
  PAYMENT_APPROVED_BY_RISK_ANALYSIS: async (payment) => {
    await atualizarPagamento(conn, payment.id, 'CONFIRMED');
  },
  PAYMENT_REPROVED_BY_RISK_ANALYSIS: async (payment) => {
    await Promise.all([
      atualizarPagamento(conn, payment.id, 'REPROVED'),
      cancelarPedido(conn, payment.externalReference, 'Reprovado pela análise de risco'),
    ]);
  },
};

async function processarEvento(event, payment) {
  const handler = EVENT_HANDLERS[event];

  if (!handler) {
    console.warn(`[Asaas] Evento desconhecido: ${event}`);
    return;
  }

  // Usar transação para consistência
  await transaction(async (conn) => {
    await handler(payment, conn);
  });
}
```

### 6.6 Helpers

```javascript
async function atualizarPagamento(conn, paymentId, status, extras = {}) {
  const sets = ['status = $1', 'atualizado_em = NOW()'];
  const params = [status, paymentId];
  let idx = 3;

  if (extras.pago_em) {
    sets.push(`pago_em = $${idx++}`);
    params.push(extras.pago_em);
  }
  if (extras.valor_liquido) {
    sets.push(`valor_liquido = $${idx++}`);
    params.push(extras.valor_liquido);
  }
  if (extras.taxa) {
    sets.push(`taxa = $${idx++}`);
    params.push(extras.taxa);
  }

  await conn.query(
    `UPDATE pagamentos SET ${sets.join(', ')} WHERE payment_id = $2`,
    params
  );
}

async function ativarPedidoSeAguardando(conn, externalReference) {
  // externalReference = cliente_id
  // Buscar pedido mais recente do cliente que está 'aguardando_pagamento'
  const result = await conn.query(
    `UPDATE pedidos
     SET status = 'pendente', atualizado_em = NOW()
     WHERE cliente_id = $1
       AND status = 'aguardando_pagamento'
     RETURNING *`,
    [externalReference]
  );

  if (result.rows.length > 0) {
    emitPedidoAtualizado(result.rows[0]);
  }
}

async function cancelarPedido(conn, externalReference, motivo) {
  const result = await conn.query(
    `UPDATE pedidos
     SET status = 'cancelado',
         motivo_cancelamento = $2,
         atualizado_em = NOW()
     WHERE cliente_id = $1
       AND status = 'aguardando_pagamento'
     RETURNING *`,
    [externalReference, motivo]
  );

  if (result.rows.length > 0) {
    emitPedidoAtualizado(result.rows[0]);
  }
}
```

### 6.7 Webhook Handler (Rota Express)

```javascript
// POST /api/pagamentos/webhook
router.post('/webhook', validateWebhook, async (req, res, next) => {
  try {
    const { id: eventId, event, payment } = req.body;

    if (!eventId || !event || !payment) {
      return res.status(200).json({ received: true });
    }

    // DEDUP: Verificar se já processamos este evento
    const existente = await query(
      'SELECT id FROM webhook_events WHERE event_id = $1',
      [eventId]
    );

    if (existente.rows.length > 0) {
      // ✅ Já processado. Retornar 200 (Asaas espera 2xx)
      return res.status(200).json({ received: true, dedup: true });
    }

    // Persistir evento (UNIQUE constraint protege contra race conditions)
    await query(
      'INSERT INTO webhook_events (event_id, event_type, payment_id) VALUES ($1, $2, $3)',
      [eventId, event, payment.id]
    );

    // Processar lógica de negócio (pode ser async - respondemos 200 rápido)
    processarEvento(event, payment).catch((err) => {
      console.error(`[Asaas] Erro processando evento ${eventId}:`, err);
      query(
        'UPDATE webhook_events SET error = $1 WHERE event_id = $2',
        [err.message, eventId]
      ).catch(() => {});
    });

    // Responder IMEDIATAMENTE com 200 (Asaas não espera processamento síncrono)
    res.status(200).json({ received: true });
  } catch (err) {
    // Se algo falhar na validação inicial, ainda assim retornar 200
    // para evitar que Asaas fique retentando
    console.error('[Asaas] Webhook error:', err);
    res.status(200).json({ received: true });
  }
});
```

### 6.8 Política de Retry do Asaas

- Asaas retenta webhooks que retornam erro (4xx/5xx) ou timeout
- Após **15 tentativas consecutivas** com falha, a fila é interrompida
- **IMPORTANTE**: Sempre retornar `200` mesmo em erros internos (logar o erro, mas não devolver 500)
- Exceção: se o token de autenticação for inválido, retornar `401` (Asaas deve parar de tentar)

---

## 7. DueDate Strategy

### O Problema

A API Asaas **não tem** um campo dedicado para definir expiração do PIX. A expiração está vinculada ao `dueDate`. Se o `dueDate` for `hoje + 15 minutos`, o PIX expira em 15 minutos. Mas se for `hoje + 30 dias`, o PIX só expira em 30 dias.

### A Solução

| Componente | Prazo | Como funciona |
|------------|-------|---------------|
| **Frontend (UX)** | 15 minutos | Timer visual regressivo. Se expirar, mostra "PIX expirado" e botão "Tentar novamente" |
| **Backend (dueDate)** | hoje + 30 dias | `dueDate` enviado ao Asaas. O PIX real expira em 30 dias |
| **Webhook** | OVERDUE em 30 dias | Quando `dueDate` passar, Asaas envia `PAYMENT_OVERDUE` e cancelamos |
| **Cancelamento forçado** | Opcional | Podemos implementar um job agendado (cron a cada 5min) que cancela pedidos com mais de 15min sem pagamento |

**Por que dueDate longo?**
- Se dueDate = hoje, o `PAYMENT_OVERDUE` pode disparar no mesmo dia (comportamento Asaas)
- Com 30 dias, garantimos que o PIX fique válido por tempo suficiente
- O cancelamento do pedido é controlado por NÓS (frontend + job), não pelo Asaas

---

## 8. Frontend (Cliente) — Modificações

### 8.1 CheckoutPanel.vue — Métodos de Pagamento

```html
<select v-model="form.metodo_pagamento">
  <option value="credito">Cartão de Crédito (na entrega)</option>
  <option value="debito">Cartão de Débito (na entrega)</option>
  <option value="dinheiro">Dinheiro</option>
  <option value="pix_online">PIX Online 💳</option>
  <option value="credito_online">Cartão de Crédito Online 💳</option>
</select>
```

### 8.2 CheckoutPanel.vue — Campos de Cartão

```html
<div v-if="form.metodo_pagamento === 'credito_online'" class="credit-card-form">
  <h4>Dados do Cartão</h4>

  <div class="form-group">
    <label>Número do Cartão</label>
    <input v-model="card.number" maxlength="19"
           placeholder="0000 0000 0000 0000"
           @input="formatCardNumber" />
  </div>

  <div class="form-group">
    <label>Nome no Cartão</label>
    <input v-model="card.holderName" placeholder="Nome como impresso no cartão" />
  </div>

  <div class="form-row">
    <div class="form-group">
      <label>Validade (MM/AA)</label>
      <input v-model="card.expiry" maxlength="5" placeholder="MM/AA"
             @input="formatExpiry" />
    </div>
    <div class="form-group">
      <label>CVV</label>
      <input v-model="card.cvv" maxlength="4" type="password"
             placeholder="***" inputmode="numeric" pattern="[0-9]*" />
    </div>
  </div>

  <div class="form-group">
    <label>CPF do Titular</label>
    <input v-model="card.cpfCnpj" maxlength="14" placeholder="000.000.000-00"
           @input="formatCPF" />
  </div>
</div>
```

### 8.3 CheckoutPanel.vue — Fluxo de Confirmação

```javascript
async function confirmOrder() {
  if (!authStore.isAuthenticated) {
    addToast('Faça login para finalizar o pedido.', 'warning')
    return
  }

  // ── MÉTODOS ONLINE (PIX / Cartão) ──
  if (form.metodo_pagamento === 'pix_online' || form.metodo_pagamento === 'credito_online') {
    submitting.value = true
    globalLoading.value = true
    loadingMessage.value = 'Processando pagamento...'

    try {
      const body = {
        tipo: form.metodo_pagamento === 'pix_online' ? 'PIX' : 'CREDIT_CARD',
        cliente: {
          id: authStore.user.id,
          cpfCnpj: card.cpfCnpj?.replace(/\D/g, '') || authStore.user.cpfCnpj,
          nome: form.nome,
          email: authStore.user.email,
          telefone: form.telefone,
        },
        pedido: {
          endereco: form.endereco,
          numero: form.numero,
          bairro: form.bairro,
          cep: form.cep,
          cidade: form.cidade,
          estado: form.estado,
        },
        subtotal: subtotal.value,
        valor_frete: freteInfo.value?.custo || 0,
        total: subtotal.value + (freteInfo.value?.custo || 0),
        itens: cartItems.value.map(item => ({ ... })),
      }

      // Se cartão, adicionar dados
      if (form.metodo_pagamento === 'credito_online') {
        body.creditCard = {
          holderName: card.holderName,
          number: card.number.replace(/\s/g, ''),
          expiryMonth: card.expiry.split('/')[0],
          expiryYear: '20' + card.expiry.split('/')[1],
          ccv: card.cvv,
        }
        body.creditCardHolderInfo = {
          name: card.holderName,
          email: authStore.user.email,
          cpfCnpj: card.cpfCnpj.replace(/\D/g, ''),
          postalCode: form.cep.replace(/\D/g, ''),
          addressNumber: form.numero,
          phone: form.telefone.replace(/\D/g, ''),
        }
        body.remoteIp = await getClientIP() // ou usar serviço
      }

      const { data } = await api.post('/pagamentos/criar', body)

      if (!data.sucesso) {
        addToast(data.erro || 'Erro no pagamento.', 'error')
        return
      }

      // Limpar carrinho
      updateCart([])
      emit('close')

      if (form.metodo_pagamento === 'pix_online') {
        // Salvar dados do PIX para a tela de tracking
        localStorage.setItem(`pix_${data.pedido_id}`, JSON.stringify(data.pix))
        router.push(`/pedidos/${data.pedido_id}`)
      } else {
        // Cartão aprovado — redirecionar pro tracking
        addToast(`Pedido ${data.pedido_id} confirmado! 🎉`, 'success')
        router.push(`/pedidos/${data.pedido_id}`)
      }
    } catch (err) {
      const msg = err.response?.data?.erro || 'Erro ao processar pagamento.'
      addToast(msg, 'error')
    } finally {
      submitting.value = false
      globalLoading.value = false
    }
    return
  }

  // ── MÉTODOS COD (Dinheiro/Cartão na entrega) — FLUXO ATUAL ──
  // ... (código existente do confirmOrder para métodos COD)
}
```

### 8.4 TrackingView.vue — Exibir PIX

```html
<!-- Card PIX — exibido no TOPO da tela de tracking -->
<div v-if="exibirPix" class="pix-payment-card">
  <div class="pix-header">
    <div class="pix-header-icon">
      <i class="fas fa-qrcode"></i>
    </div>
    <div class="pix-header-text">
      <h3>Pague com PIX</h3>
      <p>Escaneie o QR Code com o app do seu banco</p>
    </div>
  </div>

  <div class="pix-body">
    <div class="pix-qrcode-container">
      <img :src="'data:image/png;base64,' + pixData.encodedImage"
           alt="QR Code PIX" class="pix-qrcode-img" />
    </div>

    <div class="pix-info">
      <div class="pix-value-row">
        <span class="pix-label">Valor</span>
        <span class="pix-value">{{ formatPrice(order.total) }}</span>
      </div>

      <div class="pix-timer-row" :class="{ expired: pixExpired }">
        <i class="fas fa-clock"></i>
        <span v-if="!pixExpired">
          Pagamento expira em <strong>{{ pixTimer }}</strong>
        </span>
        <span v-else class="text-danger">
          ⏰ PIX expirou! Clique no botão abaixo para gerar um novo QR Code
        </span>
      </div>
    </div>

    <div class="pix-actions">
      <button class="btn btn-primary btn-block" @click="copiarPixPayload">
        <i class="fas fa-copy"></i> Copiar código PIX
      </button>
      <button v-if="pixExpired" class="btn btn-secondary btn-block mt-1"
              @click="gerarNovoPix">
        <i class="fas fa-redo"></i> Gerar novo QR Code
      </button>
    </div>
  </div>
</div>
```

### 8.5 TrackingView.vue — Timer PIX

```javascript
// ── PIX TIMER ──
const pixData = ref(null)
const pixTimer = ref('15:00')
const pixExpired = ref(false)
let pixInterval = null

const exibirPix = computed(() => {
  return order.value?.metodo_pagamento === 'pix_online'
    && order.value?.status === 'aguardando_pagamento'
})

// Recuperar dados do PIX do localStorage (ou da API)
watch(exibirPix, (show) => {
  if (show) {
    carregarPixData()
    iniciarTimer()
  } else {
    clearInterval(pixInterval)
  }
})

function carregarPixData() {
  const saved = localStorage.getItem(`pix_${order.value.id}`)
  if (saved) {
    pixData.value = JSON.parse(saved)
  } else {
    // Buscar da API (se fechou e reabriu)
    buscarPixDaAPI()
  }
}

async function buscarPixDaAPI() {
  try {
    const { data } = await api.get(`/pagamentos/${order.value.id}/pix-qrcode`)
    pixData.value = data
    localStorage.setItem(`pix_${order.value.id}`, JSON.stringify(data))
  } catch (err) {
    console.error('Erro ao buscar PIX:', err)
  }
}

function iniciarTimer() {
  const createdAt = new Date(order.value.criado_em).getTime()
  const expiresAt = createdAt + 15 * 60 * 1000

  pixInterval = setInterval(() => {
    const diff = expiresAt - Date.now()

    if (diff <= 0) {
      pixExpired.value = true
      clearInterval(pixInterval)
      pixTimer.value = '00:00'
    } else {
      const min = Math.floor(diff / 60000)
      const sec = Math.floor((diff % 60000) / 1000)
      pixTimer.value = `${min}:${sec.toString().padStart(2, '0')}`
    }
  }, 1000)
}

function copiarPixPayload() {
  if (!pixData.value?.payload) return
  navigator.clipboard.writeText(pixData.value.payload)
  addToast('Código PIX copiado!', 'success')
}

async function gerarNovoPix() {
  addToast('Gerando novo QR Code...', 'info')
  localStorage.removeItem(`pix_${order.value.id}`)
  await buscarPixDaAPI()
  pixExpired.value = false
  iniciarTimer()
}
```

### 8.6 api.js — Serviço de Pagamento

```javascript
// Cliente: criar pagamento (PIX ou Cartão)
export async function criarPagamento(data) {
  return api.post('/pagamentos/criar', data)
}

// Cliente: buscar QR Code PIX de um pedido
export async function getPixQrCode(pedidoId) {
  return api.get(`/pagamentos/${pedidoId}/pix-qrcode`)
}
```

---

## 9. Idempotency

Para evitar cobranças duplicadas em caso de retry do frontend:

```javascript
// Frontend: gerar idempotency_key baseada no timestamp + cliente
const idempotencyKey = `${authStore.user.id}_${Date.now()}`

// Backend: usar como header na chamada Asaas
headers['idempotency_key'] = idempotencyKey
```

**Nota:** Se a mesma `idempotency_key` for usada, o Asaas retorna a mesma cobrança já criada em vez de criar uma nova.

---

## 10. Cartões de Teste (Sandbox)

Fonte oficial: [docs.asaas.com](https://docs.asaas.com/docs/testing-credit-card-payment)

| Resultado | Número | Bandeira | CCV |
|-----------|--------|----------|-----|
| ✅ Aprovado (genérico) | `4444 4444 4444 4444` | Visa | 123 |
| ❌ Recusado (Mastercard) | `5184 0197 4037 3151` | Mastercard | 123 |
| ❌ Recusado (Visa) | `4916 5613 5824 0741` | Visa | 123 |

---

## 11. Plano de Implementação

| Passo | O que | Arquivos | Status |
|-------|-------|----------|--------|
| **P1** | Colocar chave Asaas no .env | `backend/.env` | 🔜 |
| **P2** | Migration 006 (pagamentos + webhook_events + colunas) | `backend/migrations/006_asaas_pagamentos.sql` | 🔜 |
| **P3** | Serviço Asaas | `backend/src/services/asaas.js` | 🔜 |
| **P4** | Módulo Pagamentos (rotas + webhook) | `backend/src/modules/pagamentos/index.js` | 🔜 |
| **P5** | Webhook handler + tabela dedup | `backend/src/modules/pagamentos/webhookHandler.js` | 🔜 |
| **P6** | Atualizar schema pedidos (status + métodos) | `backend/src/modules/pedidos/index.js` | 🔜 |
| **P7** | Registrar rota /api/pagamentos | `backend/src/index.js` | 🔜 |
| **P8** | Adicionar config asaas | `backend/src/config/index.js` | 🔜 |
| **P9** | Modificar CheckoutPanel | `cliente/src/components/CheckoutPanel.vue` | 🔜 |
| **P10** | Modificar TrackingView | `cliente/src/views/TrackingView.vue` | 🔜 |
| **P11** | Adicionar api.js (pagamentos) | `cliente/src/services/api.js` | 🔜 |
| **P12** | Script E2E sandbox | `backend/src/e2e-asaas-test.js` | 🔜 |

---

## 12. Segurança

- ✅ **HTTPS obrigatório** — sem SSL a conta Asaas pode ser bloqueada
- ✅ **Token de webhook** validado via header `asaas-access-token`
- ✅ **Dedup de eventos** via tabela `webhook_events` (evita processar 2x)
- ✅ **Não armazenar dados de cartão** — só token (se houver)
- ✅ **Timeout de 60s** nas chamadas Asaas (cartão pode demorar)
- ✅ **Idempotency key** — evita cobranças duplicadas
- ✅ **Remote IP real** do cliente enviado na criação de cobrança cartão
- ✅ **Log sem dados sensíveis** — não logar número de cartão, CVV, ou payload
- ✅ **Graceful degradation** — erro amigável se Asaas offline, sugerir pagamento na entrega
- ⚠️ **PCI Compliance** — dados de cartão passam pelo backend mas não são persistidos

---

## 13. Observações Finais

### 13.1 Tokenização de Cartão (Reuso Futuro)

Após primeira compra com cartão aprovada, o Asaas retorna `creditCardToken` na resposta. Este token pode ser armazenado em `pagamentos.credit_card_token` para:

- Checkout 1-click em pedidos futuros (sem redigitar dados)
- Token vinculado ao `customer_id` (não pode ser usado em outro cliente)

### 13.2 Rate Limiting

Asaas tem rate limits. Recomenda-se:
- Monitorar respostas HTTP 429
- Implementar backoff exponencial em caso de 429
- Não fazer mais de 10 chamadas concorrentes por segundo

### 13.3 Parcelamento

Não escopo atual. Se necessário no futuro:
- Adicionar `installmentCount` e `installmentValue`/`totalValue`
- Limitar a 12 parcelas (compatível com todas as bandeiras)
- Cartão online parcelado → fluxo diferente no frontend

### 13.4 Produção

Para migrar para produção:
1. Criar conta Asaas produção
2. Obter chave de API de produção
3. Alterar `ASAAS_ENV=production`
4. Configurar webhook com URL real
5. Garantir HTTPS ativo
6. Testar fluxo completo em produção antes de liberar

### 13.5 Webhook em Desenvolvimento

Para testar webhooks localmente:
- Usar **ngrok** para expor localhost: `ngrok http 3001`
- Configurar URL do ngrok no painel Asaas: `https://abc123.ngrok.io/api/pagamentos/webhook`
- Token de validação: mesmo valor de `ASAAS_WEBHOOK_TOKEN`

---

*Fim do spec v2.0 — com webhook detalhado, nomenclatura corrigida, cartões de teste oficiais, dueDate strategy, idempotency, e fluxo de reembolso.*
