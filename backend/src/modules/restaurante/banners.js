// ============================================================================
// Banners (Carrossel) — Gerenciamento pelo Admin
// ============================================================================
import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../../config/database.js';
import { config } from '../../config/index.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();

const bannerSchema = z.object({
  titulo: z.string().max(255).optional().default(''),
  subtitulo: z.string().max(500).optional().default(''),
  link_url: z.string().max(500).optional().nullable(),
  imagem_url: z.string().optional().nullable(),
  imagem_base64: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

// ──────── GET /api/restaurante/banners (público) ────────
// Retorna banners ativos ordenados (usado pelo app do cliente)
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, titulo, subtitulo, link_url, imagem_url, imagem_base64, ordem, ativo
       FROM banners
       WHERE restaurant_id = $1 AND ativo = true
       ORDER BY ordem ASC, id ASC`,
      [config.restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ──────── GET /api/restaurante/banners/admin (autenticado) ────────
// Retorna todos os banners (inclusive inativos) para gerenciamento
router.get('/admin', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, titulo, subtitulo, link_url, imagem_url, imagem_base64, ordem, ativo, criado_em
       FROM banners
       WHERE restaurant_id = $1
       ORDER BY ordem ASC, id ASC`,
      [config.restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ──────── POST /api/restaurante/banners ────────
router.post('/', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const data = bannerSchema.parse(req.body);

    // Se não houver imagem, usar fallback do Unsplash
    if (!data.imagem_url && !data.imagem_base64) {
      data.imagem_url = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80';
    }

    // Determinar próxima ordem
    const maxOrdem = await query(
      'SELECT COALESCE(MAX(ordem), -1) + 1 as next_ordem FROM banners WHERE restaurant_id = $1',
      [config.restaurantId]
    );
    const ordem = maxOrdem.rows[0].next_ordem;

    const result = await query(
      `INSERT INTO banners (restaurant_id, titulo, subtitulo, link_url, imagem_url, imagem_base64, ordem, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [config.restaurantId, data.titulo, data.subtitulo, data.link_url || null, data.imagem_url || null, data.imagem_base64 || null, ordem, data.ativo ?? true]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ──────── PUT /api/restaurante/banners/:id ────────
router.put('/:id', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = bannerSchema.partial().parse(req.body);

    // Verificar se o banner existe
    const existing = await query(
      'SELECT id FROM banners WHERE id = $1 AND restaurant_id = $2',
      [id, config.restaurantId]
    );
    if (existing.rows.length === 0) {
      throw new AppError('Banner não encontrado.', 404);
    }

    const result = await query(
      `UPDATE banners SET
        titulo = COALESCE($1, titulo),
        subtitulo = COALESCE($2, subtitulo),
        link_url = $3,
        imagem_url = $4,
        imagem_base64 = $5,
        ativo = COALESCE($6, ativo)
       WHERE id = $7 AND restaurant_id = $8
       RETURNING *`,
      [
        data.titulo ?? null,
        data.subtitulo ?? null,
        data.link_url !== undefined ? data.link_url : null,
        data.imagem_url !== undefined ? data.imagem_url : null,
        data.imagem_base64 !== undefined ? data.imagem_base64 : null,
        data.ativo ?? null,
        id,
        config.restaurantId,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ──────── DELETE /api/restaurante/banners/:id ────────
router.delete('/:id', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM banners WHERE id = $1 AND restaurant_id = $2 RETURNING id',
      [id, config.restaurantId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Banner não encontrado.', 404);
    }

    res.json({ message: 'Banner excluído.' });
  } catch (err) {
    next(err);
  }
});

// ──────── PUT /api/restaurante/banners/reorder ────────
// Recebe array de { id, ordem } para reordenar
router.put('/reorder', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const { ordem } = req.body; // Array de { id, ordem }

    if (!Array.isArray(ordem) || ordem.length === 0) {
      throw new AppError('Array de ordenação inválido.', 400);
    }

    // Usar transação com conexão única
    await transaction(async (client) => {
      for (const item of ordem) {
        await client.query(
          'UPDATE banners SET ordem = $1 WHERE id = $2 AND restaurant_id = $3',
          [item.ordem, item.id, config.restaurantId]
        );
      }
    });

    res.json({ message: 'Ordem atualizada.' });
  } catch (err) {
    next(err);
  }
});

export default router;
