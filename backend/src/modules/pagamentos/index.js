import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../../config/database.js';
import { config } from '../../config/index.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { emitNovoPedido, emitPedidoAtualizado } from '../../services/realtime.js';
import * as asaas from '../../services/asaas.js';
import { processarEvento } from './webhookHandler.js';

const router = Router();

// ──────── WEBHOOK VALIDATION ────────

// IPs autorizados do Asaas (production)
// Fonte: https://docs.asaas.com/docs/configurando-webhook
const ASAAS_IPS = [
  '52.67.14.79',
  '54.94.24.63',
  '54.232.119.116',
  '177.71.245.124',
  '177.71.245.125',
  '177.71.245.126',
  '177.71.245.127',
];

function validateWebhookSignature(req, res, next) {
  // 1. Verificar IP (produção)
  const clientIp = req.ip || req.connection?.remoteAddress;
  if (config.asaas.environment === 'production' && clientIp) {
    const ipLimpo = clientIp.replace(/^::ffff:/, '');
    if (!ASAAS_IPS.includes(ipLimpo)) {
      console.warn(`[Asaas] Webhook rejeitado: IP ${ipLimpo} não autorizado`);
      return res.status(200).json({ received: true }); // 200 para não gerar retentativas
    }
  }

  // 2. Verificar token (obrigatório em todos os ambientes)
  const token = req.headers['asaas-access-token'];
  if (!token || token !== config.asaas.webhookToken) {
    console.warn('[Asaas] Webhook rejeitado: token inválido');
    return res.status(200).json({ received: true });
  }

  // 3. Verificar HMAC-SHA256 (se webhookSecret estiver configurado)
  if (config.asaas.webhookSecret) {
    const signature = req.headers['asaas-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);
    if (!asaas.verificarAssinaturaWebhook(rawBody, signature, config.asaas.webhookSecret)) {
      console.warn('[Asaas] Webhook rejeitado: assinatura HMAC inválida');
      return res.status(200).json({ received: true });
    }
  }

  next();
}

// ──────── POST /api/pagamentos/tokenizar-cartao ────────
// Tokeniza cartão com Asaas (Checkout Transparente)
// O frontend chama este endpoint em vez de enviar dados brutos do cartão
router.post('/tokenizar-cartao', authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      holderName: z.string().min(1),
      number: z.string().min(13).max(19),
      expiryMonth: z.string().min(1).max(2),
      expiryYear: z.string().min(2).max(4),
      ccv: z.string().min(3).max(4),
    });

    const cardData = schema.parse(req.body);

    // Tokenizar com Asaas (dados NUNCA são armazenados no nosso BD)
    const result = await asaas.tokenizeCard(cardData);

    // Retorna APENAS o token — dados do cartão são descartados
    res.json({
      sucesso: true,
      creditCardToken: result.creditCardToken || result.id,
    });

  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        sucesso: false,
        erro: 'Dados do cartão inválidos.',
        detalhes: err.errors,
      });
    }
    next(err);
  }
});

// ──────── POST /api/pagamentos/criar ────────
// Cria pagamento online (PIX ou Cartão) + pedido
router.post('/criar', authenticate, async (req, res, next) => {
  try {
    const { id: clienteId, email, nome } = req.user;

    // Validar body — creditCardToken substitui creditCard (dados brutos)
    const schema = z.object({
      tipo: z.enum(['PIX', 'CREDIT_CARD']),
      cliente: z.object({
        cpfCnpj: z.string().min(11).max(14),
        nome: z.string().min(1),
        telefone: z.string().min(1),
      }),
      pedido: z.object({
        endereco: z.string().min(1),
        numero: z.string().min(1),
        bairro: z.string().min(1),
        cep: z.string(),
        cidade: z.string().default('São Paulo'),
        estado: z.string().default('SP'),
      }),
      subtotal: z.number().positive(),
      valor_frete: z.number().min(0),
      total: z.number().positive(),
      itens: z.array(z.object({
        produto_id: z.number(),
        nome_produto: z.string(),
        quantidade: z.number().int().positive(),
        preco_unitario: z.number().positive(),
        extras: z.array(z.object({
          nome: z.string(),
          preco: z.number(),
        })).optional().default([]),
        subtotal: z.number().positive(),
      })).min(1),
      // 🔒 PCI COMPLIANT: creditCardToken é preferido (cartão tokenizado via Asaas)
      creditCardToken: z.string().optional(),
      // ⚠️ DEPRECATED: creditCard será removido em versão futura
      creditCard: z.object({
        holderName: z.string(),
        number: z.string(),
        expiryMonth: z.string(),
        expiryYear: z.string(),
        ccv: z.string(),
      }).optional(),
      creditCardHolderInfo: z.object({
        name: z.string(),
        email: z.string().email(),
        cpfCnpj: z.string(),
        postalCode: z.string(),
        addressNumber: z.string(),
        phone: z.string(),
      }).optional(),
      remoteIp: z.string().optional(),
      tempo_preparo_estimado: z.number().int().positive().optional(),
      tempo_entrega_estimado: z.number().int().positive().optional(),
    });

    const data = schema.parse(req.body);

    // Validar CPF obrigatório para pagamento online
    const cpfLimpo = data.cliente.cpfCnpj.replace(/\D/g, '');
    if (cpfLimpo.length < 11) {
      throw new AppError('CPF é obrigatório para pagamento online.', 400);
    }

    // Executar em transação
    const result = await transaction(async (conn) => {
      // 1. Verificar se loja está aberta
      const loja = await conn.query(
        'SELECT status_loja FROM restaurantes WHERE id = $1',
        [config.restaurantId]
      );
      if (!loja.rows[0]?.status_loja) {
        throw new AppError('A loja está fechada no momento.', 400);
      }

      // 2. Criar pedido como 'aguardando_pagamento'
      const pedido = await conn.query(
        `INSERT INTO pedidos (
          restaurant_id, cliente_id, nome_cliente, telefone_cliente,
          endereco_cliente, numero_cliente, bairro_cliente, cep_cliente,
          cidade_cliente, estado_cliente,
          subtotal, valor_frete, total, metodo_pagamento,
          detalhes_pagamento, observacoes,
          tempo_preparo_estimado, tempo_entrega_estimado, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, '', '', $15, $16, 'aguardando_pagamento')
        RETURNING *`,
        [
          config.restaurantId, clienteId, data.cliente.nome, data.cliente.telefone,
          data.pedido.endereco, data.pedido.numero, data.pedido.bairro, data.pedido.cep,
          data.pedido.cidade, data.pedido.estado,
          data.subtotal, data.valor_frete, data.total,
          data.tipo === 'PIX' ? 'pix_online' : 'credito_online',
          data.tempo_preparo_estimado || null, data.tempo_entrega_estimado || null,
        ]
      );
      const pedidoCriado = pedido.rows[0];

      // 3. Inserir itens
      for (const item of data.itens) {
        await conn.query(
          `INSERT INTO pedido_itens (pedido_id, produto_id, nome_produto, quantidade, preco_unitario, extras, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [pedidoCriado.id, item.produto_id, item.nome_produto,
           item.quantidade, item.preco_unitario,
           JSON.stringify(item.extras), item.subtotal]
        );
      }

      // 4. Registrar timeline
      await conn.query(
        `INSERT INTO pedido_timeline (pedido_id, status_novo, usuario_tipo, notas)
         VALUES ($1, 'aguardando_pagamento', 'cliente', 'Aguardando pagamento via ${data.tipo}')`,
        [pedidoCriado.id]
      );

      return pedidoCriado;
    });

    // ─── Chamada Asaas (FORA da transação do BD) ───

    // 4. Buscar ou criar customer no Asaas
    const customer = await asaas.findOrCreateCustomer({
      id: clienteId,
      cpfCnpj: cpfLimpo,
      name: data.cliente.nome,
      email: req.user.email,
      phone: data.cliente.telefone,
      externalReference: clienteId,
    });

    // Salvar asaas_customer_id no cliente (fire-and-forget)
    query(
      'UPDATE clientes SET asaas_customer_id = $1 WHERE id = $2',
      [customer.id, clienteId]
    ).catch(() => {});

    // 5. Calcular dueDate (hoje + 30 dias)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // 6. Gerar idempotency key
    const idempotencyKey = `pedido_${result.id}_${Date.now()}`;

    // 7. Criar cobrança no Asaas
    if (data.tipo === 'PIX') {
      const payment = await asaas.createPayment({
        customer: customer.id,
        billingType: 'PIX',
        value: data.total,
        dueDate: dueDateStr,
        description: `Pedido #${result.pedido_id || result.id} - SaborExpress`,
        externalReference: result.id,  // pedido_id
      }, idempotencyKey);

      // Buscar QR Code PIX
      const pixData = await asaas.getPixQrCode(payment.id);

      // Salvar dados do pagamento no BD
      await query(
        `INSERT INTO pagamentos (pedido_id, customer_id, payment_id, billing_type, status,
          valor_bruto, encoded_image, payload, data_vencimento)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [result.id, customer.id, payment.id, 'PIX', payment.status,
         data.total, pixData.encodedImage, pixData.payload, dueDateStr]
      );

      // Calcular expiração (configurada em pixExpiryMinutes)
      const expiraEm = new Date(Date.now() + config.asaas.pixExpiryMinutes * 60 * 1000);

      res.status(201).json({
        sucesso: true,
        id: result.id,  // INTEGER PK
        pedido_id: result.pedido_id || result.id,
        payment_id: payment.id,
        status: 'aguardando_pagamento',
        pix: {
          encodedImage: pixData.encodedImage,
          payload: pixData.payload,
          expirationDate: pixData.expirationDate,
        },
        valor: data.total,
        expira_em_segundos: config.asaas.pixExpiryMinutes * 60,
      });

    } else {
      // CREDIT_CARD
      // 🔒 PCI: Preferir creditCardToken (tokenizado via Asaas) sobre dados brutos
      const usarToken = !!data.creditCardToken;
      const paymentBody = {
        customer: customer.id,
        billingType: 'CREDIT_CARD',
        value: data.total,
        dueDate: dueDateStr,
        description: `Pedido #${result.pedido_id || result.id} - SaborExpress`,
        externalReference: result.id,
        remoteIp: data.remoteIp || req.ip,
      };

      if (usarToken) {
        // ✅ PCI Compliant: usa cartão tokenizado — dados sensíveis nunca chegam ao servidor
        paymentBody.creditCardToken = data.creditCardToken;
        paymentBody.creditCardHolderInfo = data.creditCardHolderInfo;
      } else {
        // ⚠️ Fallback legado: dados brutos do cartão (será removido)
        if (!data.creditCard) {
          throw new AppError(
            'Informe creditCardToken (recomendado) ou creditCard (legado).',
            400
          );
        }
        paymentBody.creditCard = data.creditCard;
        paymentBody.creditCardHolderInfo = data.creditCardHolderInfo;
      }

      const payment = await asaas.createPayment(paymentBody, idempotencyKey);

      // Salvar dados do pagamento no BD
      await query(
        `INSERT INTO pagamentos (pedido_id, customer_id, payment_id, billing_type, status,
          valor_bruto, invoice_url, credit_card_token, data_vencimento, pago_em)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [result.id, customer.id, payment.id, 'CREDIT_CARD', payment.status,
         data.total, payment.invoiceUrl || null, payment.creditCardToken || data.creditCardToken || null, dueDateStr,
         (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') ? new Date() : null]
      );

      // Se cartão foi aprovado, já ativar o pedido
      if (payment.status === 'CONFIRMED' || payment.status === 'RECEIVED') {
        await query(
          `UPDATE pedidos SET status = 'pendente', atualizado_em = NOW() WHERE id = $1`,
          [result.id]
        );
        emitNovoPedido({ ...result, status: 'pendente' });
      }

      res.status(201).json({
        sucesso: true,
        id: result.id,
        pedido_id: result.pedido_id || result.id,
        payment_id: payment.id,
        status: payment.status === 'CONFIRMED' || payment.status === 'RECEIVED' ? 'pendente' : 'aguardando_pagamento',
        cartao: {
          aprovado: payment.status === 'CONFIRMED' || payment.status === 'RECEIVED',
          creditCardToken: payment.creditCardToken || null,
          tokenizado: usarToken,
        },
      });
    }

  } catch (err) {
    // Se o erro for de rede/timeout (Asaas offline), retornar mensagem amigável
    if (err.name === 'TypeError' || err.message?.includes('fetch') || err.code === 'ABORT_ERR') {
      return res.status(503).json({
        sucesso: false,
        erro: 'Gateway de pagamento temporariamente indisponível. Tente novamente ou escolha pagamento na entrega.',
        codigo: 'GATEWAY_UNAVAILABLE',
      });
    }
    next(err);
  }
});

// ──────── POST /api/pagamentos/webhook ────────
// Recebe notificações do Asaas
router.post('/webhook', validateWebhookSignature, async (req, res) => {
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
      return res.status(200).json({ received: true, dedup: true });
    }

    // Persistir evento (UNIQUE constraint protege contra race conditions)
    await query(
      'INSERT INTO webhook_events (event_id, event_type, payment_id) VALUES ($1, $2, $3) ON CONFLICT (event_id) DO NOTHING',
      [eventId, event, payment.id]
    );

    // Processar lógica de negócio (async - respondemos 200 rápido)
    processarEvento(event, payment).catch(async (err) => {
      console.error(`[Asaas] Erro processando evento ${eventId}:`, err);
      try {
        await query(
          'UPDATE webhook_events SET error = $1, processed = FALSE WHERE event_id = $2',
          [err.message, eventId]
        );
      } catch { /* ignora erro ao logar erro */ }
    });

    // Responder IMEDIATAMENTE com 200
    res.status(200).json({ received: true });

  } catch (err) {
    // Sempre retornar 200 para evitar retentativas desnecessárias
    console.error('[Asaas] Webhook error:', err);
    res.status(200).json({ received: true });
  }
});

// ──────── POST /api/pagamentos/webhook-health ────────
// Endpoint para o Asaas verificar se o webhook está respondendo
router.get('/webhook-health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ──────── GET /api/pagamentos/:pedidoId/pix-qrcode ────────
// Busca QR Code PIX de um pedido
router.get('/:pedidoId/pix-qrcode', authenticate, async (req, res, next) => {
  try {
    const { pedidoId } = req.params;

    const result = await query(
      `SELECT encoded_image, payload, status, billing_type, data_vencimento, criado_em
       FROM pagamentos WHERE pedido_id = $1 AND billing_type = 'PIX'
       ORDER BY criado_em DESC LIMIT 1`,
      [pedidoId]
    );

    if (result.rows.length === 0) {
      throw new AppError('QR Code não encontrado para este pedido.', 404);
    }

    const pagamento = result.rows[0];
    res.json({
      encodedImage: pagamento.encoded_image,
      payload: pagamento.payload,
      expirationDate: pagamento.data_vencimento,
      status: pagamento.status,
    });
  } catch (err) {
    next(err);
  }
});

// ──────── GET /api/pagamentos/:pedidoId/verificar-status ────────
// Consulta status do pagamento diretamente no Asaas (polling)
// Útil quando o webhook não alcança o servidor (ex: localhost)
router.get('/:pedidoId/verificar-status', authenticate, async (req, res, next) => {
  try {
    const { pedidoId } = req.params;

    // Buscar dados do pagamento no nosso BD
    const result = await query(
      `SELECT p.*, o.status as pedido_status, o.pedido_id as display_id
       FROM pagamentos p
       JOIN pedidos o ON o.id = p.pedido_id
       WHERE p.pedido_id = $1
       ORDER BY p.criado_em DESC LIMIT 1`,
      [pedidoId]
    );

    if (result.rows.length === 0) {
      return res.json({
        pedido_id: pedidoId,
        pedido_status: 'sem_pagamento',
        pagamento_status: null,
        precisa_atualizar: false,
      });
    }

    const pagamento = result.rows[0];

    // Se já foi pago no nosso BD, retorna direto
    if (pagamento.status !== 'PENDING') {
      return res.json({
        pedido_id: pedidoId,
        pedido_status: pagamento.pedido_status,
        pagamento_status: pagamento.status,
        precisa_atualizar: false,
      });
    }

    // Consultar status REAL no Asaas
    let asaasStatus = null;
    let atualizou = false;

    try {
      const asaasPayment = await asaas.getPayment(pagamento.payment_id);
      asaasStatus = asaasPayment.status;

      // Se o Asaas informa que foi pago mas nosso BD ainda está PENDING
      if (['RECEIVED', 'CONFIRMED'].includes(asaasPayment.status)) {
        // Disparar o mesmo processamento do webhook
        const paymentData = {
          id: pagamento.payment_id,
          status: asaasPayment.status,
          value: parseFloat(pagamento.valor_bruto),
          netValue: asaasPayment.netValue || (parseFloat(pagamento.valor_bruto) * 0.97),
          externalReference: String(pagamento.pedido_id),
          fee: asaasPayment.fee || (parseFloat(pagamento.valor_bruto) * 0.03),
          paymentDate: asaasPayment.paymentDate || new Date().toISOString(),
        };

        const eventType = asaasPayment.status === 'RECEIVED' ? 'PAYMENT_RECEIVED' : 'PAYMENT_CONFIRMED';
        await processarEvento(eventType, paymentData);
        atualizou = true;

        // Buscar dados atualizados
        const updated = await query(
          'SELECT status FROM pedidos WHERE id = $1',
          [pedidoId]
        );
        pagamento.pedido_status = updated.rows[0]?.status || pagamento.pedido_status;
        pagamento.status = asaasPayment.status;
      }
    } catch (err) {
      // Se falhar a consulta ao Asaas (timeout, etc), retornar o que temos
      console.warn(`[Asaas] Erro ao verificar status do payment ${pagamento.payment_id}:`, err.message);
    }

    res.json({
      pedido_id: pedidoId,
      display_id: pagamento.display_id,
      pedido_status: pagamento.pedido_status,
      pagamento_status: pagamento.status,
      asaas_status: asaasStatus,
      precisa_atualizar: atualizou,
    });

  } catch (err) {
    next(err);
  }
});

// ──────── GET /api/pagamentos/:pedidoId/refund-status ────────
// Consulta status do estorno no Asaas (para polling no admin)
router.get('/:pedidoId/refund-status', authenticate, async (req, res, next) => {
  try {
    const { pedidoId } = req.params;

    // Buscar payment_id no BD
    const result = await query(
      `SELECT payment_id, status FROM pagamentos WHERE pedido_id = $1 ORDER BY criado_em DESC LIMIT 1`,
      [pedidoId]
    );

    if (result.rows.length === 0) {
      return res.json({ tem_pagamento: false, refund_status: null, deleted: false });
    }

    const pag = result.rows[0];
    let refundStatus = null;
    let deleted = false;
    let asaasStatus = null;

    try {
      // Consultar status REAL no Asaas
      const asaasPayment = await asaas.getPayment(pag.payment_id);
      asaasStatus = asaasPayment.status;
      deleted = asaasPayment.deleted || false;

      // Extrair status do refund (último item do array, se houver)
      if (asaasPayment.refunds?.length > 0) {
        const lastRefund = asaasPayment.refunds[asaasPayment.refunds.length - 1];
        refundStatus = lastRefund.status; // PENDING, DONE, CANCELLED, AWAITING_CRITICAL_ACTION_AUTHORIZATION
      }
    } catch (err) {
      console.warn(`[Asaas] Erro ao consultar status do refund ${pag.payment_id}:`, err.message);
    }

    res.json({
      tem_pagamento: true,
      payment_id: pag.payment_id,
      asaas_status: asaasStatus,
      refund_status: refundStatus,
      deleted,
    });
  } catch (err) {
    next(err);
  }
});

// ──────── POST /api/pagamentos/:pedidoId/reembolsar ────────
// Reembolso manual (admin/gerente)
router.post('/:pedidoId/reembolsar', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const { pedidoId } = req.params;
    const { valor } = req.body;

    // Buscar pagamento
    const result = await query(
      `SELECT * FROM pagamentos WHERE pedido_id = $1 ORDER BY criado_em DESC LIMIT 1`,
      [pedidoId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Pagamento não encontrado para este pedido.', 404);
    }

    const pagamento = result.rows[0];

    // Validar status
    if (!['RECEIVED', 'CONFIRMED'].includes(pagamento.status)) {
      throw new AppError('Apenas pagamentos recebidos ou confirmados podem ser reembolsados.', 400);
    }

    // Chamar API Asaas
    const refund = await asaas.refundPayment(pagamento.payment_id, valor || null);

    // Atualizar status
    await query(
      `UPDATE pagamentos SET status = 'REFUND_IN_PROGRESS', atualizado_em = NOW() WHERE id = $1`,
      [pagamento.id]
    );

    res.json({
      sucesso: true,
      mensagem: 'Reembolso solicitado. O valor pode levar até 10 dias úteis para aparecer na fatura do cliente.',
      refund_id: refund.id,
    });

  } catch (err) {
    next(err);
  }
});

export default router;
