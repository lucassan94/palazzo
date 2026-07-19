import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../../config/database.js';
import { config } from '../../config/index.js';
import { authenticate, authorize, optionalAuth } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { emitPedidoAtualizado, emitNovoPedido, emitEntregaDisponivel } from '../../services/realtime.js';
import { calcularFrete } from '../../services/frete.js';
import * as asaas from '../../services/asaas.js';

const router = Router();

// Schema de criação de pedido
const createOrderSchema = z.object({
  cliente_id: z.number(),
  nome_cliente: z.string().min(1),
  telefone_cliente: z.string().min(1),
  endereco_cliente: z.string().min(1),
  numero_cliente: z.string().min(1),
  bairro_cliente: z.string().min(1),
  cep_cliente: z.string(),
  cidade_cliente: z.string().default('São Paulo'),
  estado_cliente: z.string().default('SP'),
  latitude_cliente: z.number().optional(),
  longitude_cliente: z.number().optional(),
  subtotal: z.number().positive(),
  valor_frete: z.number().min(0),
  total: z.number().positive(),
  metodo_pagamento: z.enum(['dinheiro', 'credito', 'debito', 'pix', 'pix_online', 'credito_online']),
  detalhes_pagamento: z.string().optional().default(''),
  tempo_preparo_estimado: z.number().int().positive().optional(),
  tempo_entrega_estimado: z.number().int().positive().optional(),
  observacoes: z.string().optional().default(''),
  itens: z.array(z.object({
    produto_id: z.number(),
    nome_produto: z.string(),
    quantidade: z.number().int().positive(),
    preco_unitario: z.number().positive(),
    extras: z.array(z.object({
      nome: z.string(),
      preco: z.number(),
      qty: z.number().int().positive().optional(),
    })).optional().default([]),
    subtotal: z.number().positive(),
  })).min(1, 'Pedido deve ter pelo menos 1 item.'),
});

// ============================
// CRIAR PEDIDO (Cliente)
// ============================
router.post('/', optionalAuth,async (req, res, next) => {
    try {
      const data = createOrderSchema.parse(req.body);

      // SEGURANÇA: Se autenticado, usar cliente_id do JWT
      // Se não autenticado, permitir guest checkout com cliente_id do body
      const clienteId = req.user?.id || data.cliente_id;

      const result = await transaction(async (client) => {
        // Verificar se a loja está aberta
        const loja = await client.query(
          'SELECT status_loja FROM restaurantes WHERE id = $1',
          [config.restaurantId]
        );
        if (!loja.rows[0]?.status_loja) {
          throw new AppError('A loja está fechada no momento. Pedidos não podem ser realizados.', 400);
        }

        // Criar o pedido
        const pedido = await client.query(
          `INSERT INTO pedidos (
          restaurant_id, cliente_id, nome_cliente, telefone_cliente,
          endereco_cliente, numero_cliente, bairro_cliente, cep_cliente,
          cidade_cliente, estado_cliente, latitude_cliente, longitude_cliente,
          subtotal, valor_frete, total, metodo_pagamento,
          detalhes_pagamento, observacoes,
          tempo_preparo_estimado, tempo_entrega_estimado, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'pendente')
        RETURNING *`,
          [
            config.restaurantId, clienteId, data.nome_cliente, data.telefone_cliente,
            data.endereco_cliente, data.numero_cliente, data.bairro_cliente, data.cep_cliente,
            data.cidade_cliente, data.estado_cliente, data.latitude_cliente, data.longitude_cliente,
            data.subtotal, data.valor_frete, data.total, data.metodo_pagamento,
            data.detalhes_pagamento, data.observacoes,
            data.tempo_preparo_estimado || null, data.tempo_entrega_estimado || null,
          ]
        );

        const pedidoCriado = pedido.rows[0];

        // Inserir itens
        for (const item of data.itens) {
          await client.query(
            `INSERT INTO pedido_itens (pedido_id, produto_id, nome_produto, quantidade, preco_unitario, extras, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              pedidoCriado.id, item.produto_id, item.nome_produto,
              item.quantidade, item.preco_unitario,
              JSON.stringify(item.extras), item.subtotal,
            ]
          );
        }

        // Registrar timeline
        await client.query(
          `INSERT INTO pedido_timeline (pedido_id, status_novo, usuario_tipo)
         VALUES ($1, 'pendente', 'cliente')`,
          [pedidoCriado.id]
        );

        // Atualizar total gasto do cliente
        await client.query(
          'UPDATE clientes SET total_gasto = total_gasto + $1, pedidos_total = pedidos_total + 1 WHERE id = $2',
          [data.total, clienteId]
        );

        return pedidoCriado;
      });

    emitNovoPedido(result);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ============================
// LISTAR PEDIDOS
// ============================
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, data_inicio, data_fim, limit = 50, offset = 0 } = req.query;
    const { id, role } = req.user;

    let sql = `
      SELECT p.*,
             e.nome as entregador_nome,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'id', pi.id, 'produto_id', pi.produto_id,
                 'nome_produto', pi.nome_produto, 'quantidade', pi.quantidade,
                 'preco_unitario', pi.preco_unitario, 'extras', pi.extras,
                 'subtotal', pi.subtotal
               )) FROM pedido_itens pi WHERE pi.pedido_id = p.id),
               '[]'::json
             ) as itens
      FROM pedidos p
      LEFT JOIN entregadores e ON p.entregador_id = e.id
      WHERE 1=1
    `;
    const params = [];

    // Filtro por role
    if (role === 'cliente') {
      sql += ' AND p.cliente_id = $' + (params.length + 1);
      params.push(id);
    } else if (role === 'entregador') {
      sql += ' AND (p.entregador_id = $' + (params.length + 1) + ' OR (p.entregador_id IS NULL AND p.status = $' + (params.length + 2) + '))';
      params.push(id, 'pronto_entrega');
    }

    // Filtro por restaurante (admin vê todos do restaurante)
    if (role === 'restaurante') {
      sql += ' AND p.restaurant_id = $' + (params.length + 1);
      params.push(config.restaurantId);
    }

    // Filtro por status
    if (status) {
      if (status === 'ativos') {
        sql += " AND p.status NOT IN ('entregue', 'cancelado', 'recusado')";
      } else if (status === 'concluidos') {
        sql += " AND p.status IN ('entregue')";
      } else if (status === 'cancelados') {
        sql += " AND p.status IN ('cancelado', 'recusado')";
      } else {
        sql += ' AND p.status = $' + (params.length + 1);
        params.push(status);
      }
    }

    // Filtro por data
    if (data_inicio) {
      sql += ' AND p.criado_em >= $' + (params.length + 1);
      params.push(data_inicio);
    }
    if (data_fim) {
      sql += ' AND p.criado_em <= $' + (params.length + 1);
      params.push(data_fim + 'T23:59:59');
    }

    sql += ' ORDER BY p.criado_em DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ============================
// BUSCAR PEDIDO POR ID
// ============================
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT p.*,
              e.nome as entregador_nome, e.telefone as entregador_telefone,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'id', pi.id, 'produto_id', pi.produto_id,
                  'nome_produto', pi.nome_produto, 'quantidade', pi.quantidade,
                  'preco_unitario', pi.preco_unitario, 'extras', pi.extras,
                  'subtotal', pi.subtotal
                )) FROM pedido_itens pi WHERE pi.pedido_id = p.id),
                '[]'::json
              ) as itens,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'id', tl.id, 'status_anterior', tl.status_anterior,
                  'status_novo', tl.status_novo, 'usuario_tipo', tl.usuario_tipo,
                  'notas', tl.notas, 'mudado_em', tl.mudado_em
                ) ORDER BY tl.mudado_em ASC)
                FROM pedido_timeline tl WHERE tl.pedido_id = p.id),
                '[]'::json
              ) as timeline,
              COALESCE(
                (SELECT json_agg(json_build_object(
                  'id', mp.id, 'mensagem', mp.mensagem,
                  'lida', mp.lida, 'criado_em', mp.criado_em
                ) ORDER BY mp.criado_em DESC)
                FROM mensagens_pedido mp WHERE mp.pedido_id = p.id),
                '[]'::json
              ) as mensagens
       FROM pedidos p
       LEFT JOIN entregadores e ON p.entregador_id = e.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Pedido não encontrado.', 404);
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ============================
// ATUALIZAR STATUS DO PEDIDO
// ============================
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, motivo, entregador_id } = req.body;
    const { role, id: userId } = req.user;

    const statusSchema = z.object({
      status: z.enum(['aguardando_pagamento', 'pendente', 'preparando', 'pronto_entrega', 'em_transito', 'cheguei_destino', 'entregue', 'cancelado', 'recusado']),
      motivo: z.string().optional(),
      entregador_id: z.number().optional(),
    });

    const data = statusSchema.parse({ status, motivo, entregador_id });

    const result = await transaction(async (client) => {
      const pedido = await client.query(
        'SELECT * FROM pedidos WHERE id = $1',
        [id]
      );
      if (pedido.rows.length === 0) throw new AppError('Pedido não encontrado.', 404);

      const pedidoAtual = pedido.rows[0];

      // Validar transições de status
      const transicoesValidas = {
        'aguardando_pagamento': ['cancelado'],  // Apenas webhook pode ativar p/ 'pendente'
        'pendente': ['preparando', 'cancelado', 'recusado'],
        'preparando': ['pronto_entrega', 'cancelado'],
        'pronto_entrega': ['em_transito'],
        'em_transito': ['cheguei_destino'],
        'cheguei_destino': ['entregue'],
        'entregue': [],
        'cancelado': [],
        'recusado': [],
      };

      if (!transicoesValidas[pedidoAtual.status]?.includes(data.status)) {
        throw new AppError(`Transição inválida de '${pedidoAtual.status}' para '${data.status}'.`, 400);
      }

      // Atualizar campos de tempo
      const timeFields = {
        'preparando': 'aceito_em',
        'pronto_entrega': 'pronto_em',
        'em_transito': 'transito_inicio_em',
        'cheguei_destino': 'destino_chegada_em',
        'entregue': 'entregue_em',
        'cancelado': 'cancelado_em',
      };

      const updates = ['status = $2', 'atualizado_em = NOW()'];
      const params = [id, data.status];
      let paramIdx = 3;

      if (timeFields[data.status]) {
        updates.push(`${timeFields[data.status]} = NOW()`);
      }

      if (data.motivo) {
        updates.push(`motivo_cancelamento = $${paramIdx}`);
        params.push(data.motivo);
        paramIdx++;
      }

      if (data.entregador_id) {
        updates.push(`entregador_id = $${paramIdx}`);
        params.push(data.entregador_id);
        paramIdx++;
      }

      await client.query(
        `UPDATE pedidos SET ${updates.join(', ')} WHERE id = $1`,
        params
      );

      // Registrar timeline
      let usuarioTipo = role;
      if (role === 'restaurante') usuarioTipo = 'restaurante';

      await client.query(
        `INSERT INTO pedido_timeline (pedido_id, pedido_id_ref, status_anterior, status_novo, usuario_id, usuario_tipo, notas)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, pedidoAtual.pedido_id, pedidoAtual.status, data.status, userId, usuarioTipo, data.motivo || '']
      );

      // Se entregue, atualizar contadores do entregador
      if (data.status === 'entregue' && pedidoAtual.entregador_id) {
        await client.query(
          `UPDATE entregadores SET
            entregas_total = entregas_total + 1,
            frete_total_recebido = frete_total_recebido + $1,
            ultima_entrega_em = NOW()
           WHERE id = $2`,
          [pedidoAtual.valor_frete, pedidoAtual.entregador_id]
        );
      }

      // Buscar pedido atualizado
      const updated = await client.query('SELECT * FROM pedidos WHERE id = $1', [id]);
      return updated.rows[0];
    });

    emitPedidoAtualizado(result);

    // Se for recusa ou cancelamento de pedido pago online, estornar no Asaas
    if ((data.status === 'recusado' || data.status === 'cancelado') &&
        ['pix_online', 'credito_online'].includes(result.metodo_pagamento)) {
      // Buscar payment_id no banco (fire-and-forget)
      query(
        'SELECT payment_id, status FROM pagamentos WHERE pedido_id = $1 ORDER BY criado_em DESC LIMIT 1',
        [id]
      ).then(async (pagResult) => {
        if (pagResult.rows.length === 0) {
          console.warn(`[Asaas] Nenhum pagamento encontrado para pedido ${id} (método: ${result.metodo_pagamento})`);
          return;
        }
        const pag = pagResult.rows[0];

        // CONSULTAR STATUS REAL no Asaas antes de decidir
        // (nosso BD pode estar desatualizado: /simular-pagamento só altera local,
        //  webhook pode não ter chegado em localhost, etc)
        let asaasStatus = pag.status;
        try {
          const asaasPayment = await asaas.getPayment(pag.payment_id);
          asaasStatus = asaasPayment.status;
          console.log(`[Asaas] Status real de ${pag.payment_id}: ${asaasStatus} (local: ${pag.status})`);

          // Sincronizar nosso BD com o status real
          if (asaasStatus !== pag.status) {
            query(
              `UPDATE pagamentos SET status = $1, atualizado_em = NOW() WHERE payment_id = $2`,
              [asaasStatus, pag.payment_id]
            ).catch(() => {});
          }
        } catch (err) {
          // Se falhar consultar Asaas, usar o status local como fallback
          console.warn(`[Asaas] Falha ao consultar status real de ${pag.payment_id}, usando local: ${err.message}`);
        }

        const isPago = ['RECEIVED', 'CONFIRMED'].includes(asaasStatus);

        if (isPago) {
          // Já foi pago: solicitar reembolso
          asaas.refundPayment(pag.payment_id).then(() => {
            console.log(`[Asaas] ✅ Reembolso solicitado: payment ${pag.payment_id} (pedido ${id})`);
            query(
              `UPDATE pagamentos SET status = 'REFUND_IN_PROGRESS', atualizado_em = NOW() WHERE pedido_id = $1`,
              [id]
            ).catch((e) => console.warn('[Asaas] Erro ao atualizar pagamentos BD:', e.message));
          }).catch((err) => {
            console.error(`[Asaas] ❌ ERRO ao reembolsar payment ${pag.payment_id} (pedido ${id}):`, err.response?.data?.errors || err.message);
          });
        } else {
          // Ainda não foi pago: apenas cancelar a cobrança
          asaas.deletePayment(pag.payment_id).then(() => {
            console.log(`[Asaas] ✅ Cobrança cancelada: payment ${pag.payment_id} (pedido ${id})`);
            query(
              `UPDATE pagamentos SET status = 'CANCELED', atualizado_em = NOW() WHERE pedido_id = $1`,
              [id]
            ).catch((e) => console.warn('[Asaas] Erro ao atualizar pagamentos BD:', e.message));
          }).catch((err) => {
            console.error(`[Asaas] ❌ ERRO ao cancelar cobrança ${pag.payment_id} (pedido ${id}):`, err.response?.data?.errors || err.message);
          });
        }
      }).catch((err) => {
        console.error(`[Asaas] ❌ ERRO ao consultar pagamentos BD para pedido ${id}:`, err.message);
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================
// CALCULAR FRETE
// ============================
router.post('/calcular-frete', async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      // Calcular frete fixo se não houver coordenadas
      const result = await query(
        'SELECT raio_km, tempo_min, tempo_max, custo FROM raios_entrega WHERE restaurant_id = $1 ORDER BY raio_km ASC LIMIT 1',
        [config.restaurantId]
      );
      const faixa = result.rows[0] || { raio_km: 1, tempo_min: 15, tempo_max: 25, custo: 5.00 };
      return res.json({
        distancia_km: null,
        faixa_raio: faixa.raio_km,
        tempo_min: faixa.tempo_min,
        tempo_max: faixa.tempo_max,
        custo: parseFloat(faixa.custo),
        tempo_preparo: 20,
      });
    }

    const frete = await calcularFrete(latitude, longitude);
    res.json(frete);
  } catch (err) {
    next(err);
  }
});

export default router;
