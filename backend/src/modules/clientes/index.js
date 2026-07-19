import { Router } from 'express';
import { query } from '../../config/database.js';
import { config } from '../../config/index.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();

// ============================
// LISTAR CLIENTES (Admin/Gerente/Caixa)
// ============================
router.get('/', authenticate, authorize('admin', 'gerente', 'caixa'), async (req, res, next) => {
  try {
    const { busca, ordenar_por, ordem } = req.query;
    let sql = `
      SELECT id, nome, sobrenome, email, telefone, endereco, cep, bairro,
             cidade, estado, total_gasto, pedidos_total, criado_em
      FROM clientes
      WHERE restaurant_id = $1
    `;
    const params = [config.restaurantId];

    if (busca) {
      sql += ' AND (LOWER(nome) LIKE $' + (params.length + 1) + ' OR LOWER(email) LIKE $' + (params.length + 1) + ' OR LOWER(telefone) LIKE $' + (params.length + 1) + ')';
      params.push(`%${busca.toLowerCase()}%`);
    }

    // Ordenação
    const colunasPermitidas = ['nome', 'pedidos_total', 'total_gasto', 'criado_em'];
    const coluna = colunasPermitidas.includes(ordenar_por) ? ordenar_por : 'total_gasto';
    const dir = ordem === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${coluna} ${dir}`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ============================
// BUSCAR CLIENTE POR ID (Admin/Gerente/Caixa)
// ============================
router.get('/:id', authenticate, authorize('admin', 'gerente', 'caixa'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT id, nome, sobrenome, email, telefone, endereco, cep, numero, bairro,
              complemento, cidade, estado, latitude, longitude,
              total_gasto, pedidos_total, criado_em
       FROM clientes WHERE id = $1 AND restaurant_id = $2`,
      [id, config.restaurantId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Cliente não encontrado.', 404);
    }

    // Buscar últimos pedidos do cliente
    const pedidos = await query(
      `SELECT id, pedido_id, total, status, criado_em
       FROM pedidos WHERE cliente_id = $1 AND restaurant_id = $2
       ORDER BY criado_em DESC LIMIT 10`,
      [id, config.restaurantId]
    );

    // Produto mais comprado
    const topProduto = await query(
      `SELECT pi.nome_produto, COUNT(*) as qtd, SUM(pi.quantidade) as total_vendido
       FROM pedido_itens pi
       JOIN pedidos p ON pi.pedido_id = p.id
       WHERE p.cliente_id = $1 AND p.restaurant_id = $2
       GROUP BY pi.nome_produto
       ORDER BY total_vendido DESC LIMIT 1`,
      [id, config.restaurantId]
    );

    res.json({
      ...result.rows[0],
      ultimosPedidos: pedidos.rows,
      produtoMaisComprado: topProduto.rows[0]?.nome_produto || null,
    });
  } catch (err) {
    next(err);
  }
});

// ============================
// ATUALIZAR PERFIL (Cliente)
// ============================
router.put('/perfil', authenticate, async (req, res, next) => {
  try {
    const { id } = req.user;
    const { nome, sobrenome, telefone, endereco, cep, numero, bairro, complemento, cidade, estado, cpf_cnpj } = req.body;

    const result = await query(
      `UPDATE clientes SET
        nome = COALESCE($1, nome),
        sobrenome = COALESCE($2, sobrenome),
        telefone = COALESCE($3, telefone),
        endereco = COALESCE($4, endereco),
        cep = COALESCE($5, cep),
        numero = COALESCE($6, numero),
        bairro = COALESCE($7, bairro),
        complemento = COALESCE($8, complemento),
        cidade = COALESCE($9, cidade),
        estado = COALESCE($10, estado),
        cpf_cnpj = COALESCE($11, cpf_cnpj)
       WHERE id = $12 AND restaurant_id = $13
       RETURNING id, nome, sobrenome, email, telefone, endereco, cep, numero, bairro, complemento, cidade, estado, cpf_cnpj`,
      [nome, sobrenome, telefone, endereco, cep, numero, bairro, complemento, cidade, estado, cpf_cnpj, id, config.restaurantId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Cliente não encontrado.', 404);
    }

    res.json({ message: 'Perfil atualizado com sucesso!', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
