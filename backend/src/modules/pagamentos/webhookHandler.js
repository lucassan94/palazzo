// Webhook Handler — Processa eventos recebidos do Asaas
import { query, transaction } from '../../config/database.js';
import { emitPedidoAtualizado, emitNovoPedido } from '../../services/realtime.js';

// ──────── HELPERS ────────

// Mapeamento explícito de colunas permitidas para atualização de pagamentos
// 🔒 PROTEGIDO contra SQL injection: nomes de colunas são hardcoded
const COLUNAS_PAGAMENTO = {
  pago_em: 'pago_em',
  valor_liquido: 'valor_liquido',
  taxa: 'taxa',
};

async function atualizarPagamento(conn, paymentId, status, extras = {}) {
  const params = [status, paymentId];
  let idx = 3;
  const sets = ['status = $1', 'atualizado_em = NOW()'];

  for (const [coluna, chave] of Object.entries(COLUNAS_PAGAMENTO)) {
    if (extras[chave] !== undefined && extras[chave] !== null) {
      sets.push(`${coluna} = $${idx++}`);
      params.push(extras[chave]);
    }
  }

  return conn.query(
    `UPDATE pagamentos SET ${sets.join(', ')} WHERE payment_id = $2`,
    params
  );
}

async function ativarPedidoSeAguardando(conn, externalReference) {
  // Busca pedido mais recente do cliente que está aguardando pagamento
  const result = await conn.query(
    `UPDATE pedidos
     SET status = 'pendente', atualizado_em = NOW()
     WHERE id = $1
       AND status = 'aguardando_pagamento'
     RETURNING *`,
    [externalReference]
  );

  if (result.rows.length > 0) {
    const pedido = result.rows[0];
    emitNovoPedido(pedido);

    // Registrar timeline
    await conn.query(
      `INSERT INTO pedido_timeline (pedido_id, status_anterior, status_novo, usuario_tipo, notas)
       VALUES ($1, 'aguardando_pagamento', 'pendente', 'sistema', 'Pagamento confirmado via Asaas')`,
      [pedido.id]
    );
  }
}

async function cancelarPedido(conn, pedidoId, motivo) {
  const result = await conn.query(
    `UPDATE pedidos
     SET status = 'cancelado',
         motivo_cancelamento = $2,
         atualizado_em = NOW()
     WHERE id = $1
       AND status = 'aguardando_pagamento'
     RETURNING *`,
    [pedidoId, motivo]
  );

  if (result.rows.length > 0) {
    const pedido = result.rows[0];
    emitPedidoAtualizado(pedido);

    // Registrar timeline
    await conn.query(
      `INSERT INTO pedido_timeline (pedido_id, status_anterior, status_novo, usuario_tipo, notas)
       VALUES ($1, 'aguardando_pagamento', 'cancelado', 'sistema', $2)`,
      [pedido.id, motivo]
    );
  }
}

function notificarAdmin(mensagem) {
  console.warn(`[Asaas] ⚠️ Notificação admin: ${mensagem}`);
  // Futuro: enviar email ou notificação push
}

// ──────── EVENT HANDLERS ────────

const EVENT_HANDLERS = {
  // ⭐ Pagamento recebido / fundos disponíveis
  PAYMENT_RECEIVED: async (payment, conn) => {
    await Promise.all([
      atualizarPagamento(conn, payment.id, 'RECEIVED', {
        pago_em: payment.paymentDate,
        valor_liquido: payment.netValue,
        taxa: payment.fee,
      }),
      ativarPedidoSeAguardando(conn, payment.externalReference),
    ]);
  },

  // Pagamento confirmado (fundos em processamento, ainda não disponíveis)
  PAYMENT_CONFIRMED: async (payment, conn) => {
    await Promise.all([
      atualizarPagamento(conn, payment.id, 'CONFIRMED'),
      ativarPedidoSeAguardando(conn, payment.externalReference),
    ]);
  },

  // ⏰ Cobrança venceu (dueDate passou)
  PAYMENT_OVERDUE: async (payment, conn) => {
    await Promise.all([
      atualizarPagamento(conn, payment.id, 'OVERDUE'),
      cancelarPedido(conn, payment.externalReference, 'Pagamento não realizado no prazo'),
    ]);
  },

  // Cobrança deletada (via nossa API)
  PAYMENT_DELETED: async (payment, conn) => {
    await Promise.all([
      atualizarPagamento(conn, payment.id, 'DELETED'),
      cancelarPedido(conn, payment.externalReference, 'Cobrança cancelada no gateway'),
    ]);
  },

  // 💰 Reembolso total
  PAYMENT_REFUNDED: async (payment, conn) => {
    await atualizarPagamento(conn, payment.id, 'REFUNDED');
  },

  // Reembolso parcial
  PAYMENT_PARTIALLY_REFUNDED: async (payment, conn) => {
    await atualizarPagamento(conn, payment.id, 'PARTIALLY_REFUNDED');
  },

  // Reembolso em processamento
  PAYMENT_REFUND_IN_PROGRESS: async (payment, conn) => {
    await atualizarPagamento(conn, payment.id, 'REFUND_IN_PROGRESS');
  },

  // Reembolso negado
  PAYMENT_REFUND_DENIED: async (payment, conn) => {
    await atualizarPagamento(conn, payment.id, 'REFUND_DENIED');
    notificarAdmin(`Reembolso negado para pedido ${payment.externalReference}`);
  },

  // ❌ Captura do cartão recusada
  PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: async (payment, conn) => {
    await Promise.all([
      atualizarPagamento(conn, payment.id, 'REFUSED'),
      cancelarPedido(conn, payment.externalReference, 'Cartão recusado na captura'),
    ]);
  },

  // ⚠️ Chargeback
  PAYMENT_CHARGEBACK_REQUESTED: async (payment, conn) => {
    await atualizarPagamento(conn, payment.id, 'CHARGEBACK_REQUESTED');
    notificarAdmin(`⚠️ CHARGEBACK solicitado para pedido ${payment.externalReference}!`);
  },

  PAYMENT_CHARGEBACK_DISPUTE: async (payment, conn) => {
    await atualizarPagamento(conn, payment.id, 'CHARGEBACK_DISPUTE');
  },

  // Eventos de análise de risco
  PAYMENT_AWAITING_RISK_ANALYSIS: async () => {
    // Log apenas, sem ação
  },

  PAYMENT_APPROVED_BY_RISK_ANALYSIS: async (payment, conn) => {
    await Promise.all([
      atualizarPagamento(conn, payment.id, 'CONFIRMED'),
      ativarPedidoSeAguardando(conn, payment.externalReference),
    ]);
  },

  PAYMENT_REPROVED_BY_RISK_ANALYSIS: async (payment, conn) => {
    await Promise.all([
      atualizarPagamento(conn, payment.id, 'REPROVED'),
      cancelarPedido(conn, payment.externalReference, 'Reprovado pela análise de risco'),
    ]);
  },

  // Eventos informativos (apenas log)
  PAYMENT_CREATED: async () => {},
  PAYMENT_UPDATED: async (payment, conn) => {
    await atualizarPagamento(conn, payment.id, payment.status);
  },
  PAYMENT_BANK_SLIP_VIEWED: async () => {},
  PAYMENT_CHECKOUT_VIEWED: async () => {},
  PAYMENT_RESTORED: async () => {},
};

// ──────── PROCESSADOR PRINCIPAL ────────

export async function processarEvento(event, payment) {
  const handler = EVENT_HANDLERS[event];

  if (!handler) {
    console.warn(`[Asaas] Evento desconhecido: ${event}`);
    return;
  }

  await transaction(async (conn) => {
    await handler(payment, conn);
  });

  console.log(`[Asaas] Evento ${event} processado para payment ${payment.id}`);
}
