import { Router } from 'express';
import { query } from '../../config/database.js';
import { config } from '../../config/index.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = Router();

// Helpers para montar cláusula de data com parâmetros seguros
function buildDateClause(params, dataInicio, dataFim) {
  let clause = '';
  if (dataInicio) {
    params.push(dataInicio);
    clause += ` AND criado_em >= $${params.length}`;
  } else {
    clause += ` AND criado_em >= CURRENT_DATE`;
  }
  if (dataFim) {
    params.push(dataFim + 'T23:59:59');
    clause += ` AND criado_em <= $${params.length}`;
  }
  return clause;
}

// ============================
// DASHBOARD PRINCIPAL
// ============================
router.get('/', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const { data_inicio, data_fim } = req.query;

    const params = [config.restaurantId];
    const dateClause = buildDateClause(params, data_inicio, data_fim);

    // Resumo do período
    const resumo = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'entregue') as pedidos_entregues,
        COALESCE(SUM(total) FILTER (WHERE status = 'entregue'), 0) as faturamento_total,
        COALESCE(AVG(total) FILTER (WHERE status = 'entregue'), 0) as ticket_medio
      FROM pedidos
      WHERE restaurant_id = $1${dateClause}
    `, params);

    // Status dos pedidos (distribuição)
    const statusDistribuicao = await query(`
      SELECT status, COUNT(*) as quantidade,
             COALESCE(SUM(total), 0) as receita
      FROM pedidos
      WHERE restaurant_id = $1${dateClause}
      GROUP BY status
    `, params);

    // Meios de pagamento
    const pagamentos = await query(`
      SELECT metodo_pagamento, COUNT(*) as quantidade,
             COALESCE(SUM(total), 0) as receita
      FROM pedidos
      WHERE restaurant_id = $1${dateClause}
        AND status IN ('entregue')
      GROUP BY metodo_pagamento
    `, params);

    // Produtos mais vendidos
    const topProdutos = await query(`
      SELECT pi.nome_produto, SUM(pi.quantidade) as quantidade_vendida,
             SUM(pi.subtotal) as receita_gerada
      FROM pedido_itens pi
      JOIN pedidos p ON pi.pedido_id = p.id
      WHERE p.restaurant_id = $1${dateClause}
      GROUP BY pi.nome_produto
      ORDER BY receita_gerada DESC
      LIMIT 10
    `, params);

    // Tempos médios por etapa (últimos 30 dias - não filtrável)
    const temposMedios = await query(`
      SELECT
        COALESCE(AVG(EXTRACT(EPOCH FROM (aceito_em - criado_em))/60), 0) as tempo_ate_aceite,
        COALESCE(AVG(EXTRACT(EPOCH FROM (pronto_em - aceito_em))/60), 0) as tempo_preparo,
        COALESCE(AVG(EXTRACT(EPOCH FROM (entregue_em - transito_inicio_em))/60), 0) as tempo_entrega
      FROM pedidos
      WHERE restaurant_id = $1
        AND status = 'entregue'
        AND criado_em >= CURRENT_DATE - 30
    `, [config.restaurantId]);

    // Totais do período filtrável
    const totais = await query(`
      SELECT
        COUNT(*) as total_pedidos,
        COUNT(*) FILTER (WHERE status IN ('cancelado', 'recusado')) as total_cancelados,
        CASE WHEN COUNT(*) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE status IN ('cancelado', 'recusado'))::decimal / COUNT(*) * 100, 1)
          ELSE 0
        END as taxa_cancelamento
      FROM pedidos
      WHERE restaurant_id = $1${dateClause}
    `, params);

    res.json({
      resumo: resumo.rows[0],
      totais: totais.rows[0],
      statusDistribuicao: statusDistribuicao.rows,
      pagamentos: pagamentos.rows,
      topProdutos: topProdutos.rows,
      temposMedios: temposMedios.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// ============================
// RESUMO DO DIA (Sidebar widget)
// ============================
router.get('/resumo-dia', authenticate, authorize('admin', 'gerente', 'caixa'), async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'entregue') as pedidos_entregues,
        COALESCE(SUM(total) FILTER (WHERE status = 'entregue'), 0) as faturamento_estimado,
        COUNT(*) FILTER (WHERE status IN ('pendente', 'preparando', 'pronto_entrega', 'em_transito', 'cheguei_destino')) as pedidos_ativos
      FROM pedidos
      WHERE restaurant_id = $1
        AND criado_em >= CURRENT_DATE
    `, [config.restaurantId]);

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
