import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../../config/database.js';
import { config } from '../../config/index.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { emitToRestaurant } from '../../services/realtime.js';

const router = Router();

// Schema de validação
const productSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório.'),
  descricao: z.string().optional().default(''),
  categoria_id: z.number().optional(),
  preco: z.number().positive('Preço deve ser positivo.'),
  imagem_url: z.string().optional().default(''),
  imagem_base64: z.string().optional().default(''),
  ativo: z.boolean().optional().default(true),
  destaque: z.boolean().optional().default(false),
  extras: z.array(z.object({
    nome: z.string().min(1),
    preco: z.number().min(0),
    maximo: z.number().int().min(0).optional().default(1),
  })).optional().default([]),
});

// ============================
// LISTAR CATEGORIAS
// ============================
router.get('/categorias', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, nome, slug, ordem FROM categorias WHERE restaurant_id = $1 ORDER BY ordem ASC',
      [config.restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ============================
// LISTAR PRODUTOS
// ============================
router.get('/', async (req, res, next) => {
  try {
    const { categoria, ativo, busca } = req.query;

    let sql = `
      SELECT p.id, p.nome, p.descricao, p.preco, p.imagem_url, p.imagem_base64, p.ativo, p.destaque,
             p.categoria_id, c.nome as categoria_nome, c.slug as categoria_slug,
             (SELECT COUNT(*) FROM produtos_extras pe WHERE pe.produto_id = p.id) as extras_count
      FROM produtos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.restaurant_id = $1
    `;
    const params = [config.restaurantId];

    if (categoria && categoria !== 'Todos') {
      sql += ' AND c.slug = $' + (params.length + 1);
      params.push(categoria.toLowerCase());
    }

    if (ativo !== undefined) {
      sql += ' AND p.ativo = $' + (params.length + 1);
      params.push(ativo === 'true');
    }

    if (busca) {
      sql += ' AND (LOWER(p.nome) LIKE $' + (params.length + 1) + ' OR LOWER(p.descricao) LIKE $' + (params.length + 1) + ')';
      params.push(`%${busca.toLowerCase()}%`);
    }

    sql += ' ORDER BY p.destaque DESC, p.nome ASC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ============================
// LISTAR PRODUTOS COM EXTRAS (Otimizado - 2 queries)
// ============================
router.get('/com-extras', async (req, res, next) => {
  try {
    const { categoria, busca } = req.query;

    let sql = `
      SELECT p.id, p.nome, p.descricao, p.preco, p.imagem_url, p.imagem_base64, p.ativo, p.destaque,
             p.categoria_id, c.nome as categoria_nome, c.slug as categoria_slug
      FROM produtos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.restaurant_id = $1 AND p.ativo = true
    `;
    const params = [config.restaurantId];

    if (categoria && categoria !== 'Todos') {
      sql += ' AND c.slug = $' + (params.length + 1);
      params.push(categoria.toLowerCase());
    }

    if (busca) {
      sql += ' AND (LOWER(p.nome) LIKE $' + (params.length + 1) + ' OR LOWER(p.descricao) LIKE $' + (params.length + 1) + ')';
      params.push(`%${busca.toLowerCase()}%`);
    }

    sql += ' ORDER BY p.destaque DESC, p.nome ASC';

    const produtosResult = await query(sql, params);
    const produtos = produtosResult.rows;

    if (produtos.length === 0) return res.json([]);

    // Query 2: Todos os extras de uma vez
    const produtoIds = produtos.map(p => p.id);
    const extrasResult = await query(
      'SELECT produto_id, id, nome, preco, maximo FROM produtos_extras WHERE produto_id = ANY($1) ORDER BY nome',
      [produtoIds]
    );

    // Mapear extras para seus produtos
    const extrasMap = {};
    for (const extra of extrasResult.rows) {
      if (!extrasMap[extra.produto_id]) extrasMap[extra.produto_id] = [];
      extrasMap[extra.produto_id].push({ id: extra.id, nome: extra.nome, preco: extra.preco, maximo: extra.maximo });
    }

    const result = produtos.map(p => ({ ...p, extras: extrasMap[p.id] || [] }));
    res.json(result);
  } catch (err) { next(err); }
});

// ============================
// BUSCAR PRODUTO POR ID (com extras)
// ============================
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const productResult = await query(
      `SELECT p.*, c.nome as categoria_nome, c.slug as categoria_slug
       FROM produtos p
       LEFT JOIN categorias c ON p.categoria_id = c.id
       WHERE p.id = $1 AND p.restaurant_id = $2`,
      [id, config.restaurantId]
    );

    if (productResult.rows.length === 0) {
      throw new AppError('Produto não encontrado.', 404);
    }

    const extrasResult = await query(
      'SELECT id, nome, preco, maximo FROM produtos_extras WHERE produto_id = $1 ORDER BY nome',
      [id]
    );

    res.json({
      ...productResult.rows[0],
      extras: extrasResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ============================
// CRIAR PRODUTO (Admin)
// ============================
router.post('/', authenticate, authorize('admin', 'gerente', 'chef'), async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);

    const result = await transaction(async (client) => {
      const product = await client.query(
        `INSERT INTO produtos (restaurant_id, nome, descricao, categoria_id, preco, imagem_url, imagem_base64, ativo, destaque)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [config.restaurantId, data.nome, data.descricao, data.categoria_id || null,
         data.preco, data.imagem_url, data.imagem_base64, data.ativo, data.destaque]
      );

      const produto = product.rows[0];

      // Inserir extras se houver (usando parâmetros seguros)
      for (const extra of data.extras) {
        await client.query(
          `INSERT INTO produtos_extras (produto_id, nome, preco, maximo) VALUES ($1, $2, $3, $4)`,
          [produto.id, extra.nome, extra.preco, extra.maximo ?? 1]
        );
      }

      return produto;
    });

    emitToRestaurant('produto:novo', result);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ============================
// ATUALIZAR PRODUTO (Admin)
// ============================
router.put('/:id', authenticate, authorize('admin', 'gerente', 'chef'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = productSchema.partial().parse(req.body);

    const result = await transaction(async (client) => {
      // Verificar se o produto existe
      const existing = await client.query(
        'SELECT id FROM produtos WHERE id = $1 AND restaurant_id = $2',
        [id, config.restaurantId]
      );
      if (existing.rows.length === 0) {
        throw new AppError('Produto não encontrado.', 404);
      }

      // Atualizar campos
      const fields = [];
      const params = [id];
      let paramIndex = 2;

      for (const [key, value] of Object.entries(data)) {
        if (key === 'extras') continue;
        if (value !== undefined) {
          fields.push(`${key} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      }

      if (fields.length > 0) {
        await client.query(
          `UPDATE produtos SET ${fields.join(', ')} WHERE id = $1`,
          params
        );
      }

      // Atualizar extras se fornecido (usando parâmetros seguros)
      if (data.extras !== undefined) {
        await client.query('DELETE FROM produtos_extras WHERE produto_id = $1', [id]);

        for (const extra of data.extras) {
          await client.query(
            `INSERT INTO produtos_extras (produto_id, nome, preco, maximo) VALUES ($1, $2, $3, $4)`,
            [id, extra.nome, extra.preco, extra.maximo ?? 1]
          );
        }
      }

      // Retornar produto atualizado
      const updated = await client.query(
        `SELECT p.*, c.nome as categoria_nome, c.slug as categoria_slug
         FROM produtos p LEFT JOIN categorias c ON p.categoria_id = c.id
         WHERE p.id = $1`,
        [id]
      );

      const extras = await client.query(
        'SELECT id, nome, preco, maximo FROM produtos_extras WHERE produto_id = $1 ORDER BY nome',
        [id]
      );

      return { ...updated.rows[0], extras: extras.rows };
    });

    emitToRestaurant('produto:atualizado', result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================
// EXCLUIR PRODUTO (Admin)
// ============================
router.delete('/:id', authenticate, authorize('admin', 'gerente', 'chef'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM produtos WHERE id = $1 AND restaurant_id = $2 RETURNING id',
      [id, config.restaurantId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Produto não encontrado.', 404);
    }

    emitToRestaurant('produto:deletado', { id: parseInt(id) });
    res.json({ message: 'Produto excluído com sucesso.', id: parseInt(id) });
  } catch (err) {
    next(err);
  }
});

export default router;
