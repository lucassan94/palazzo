import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { query } from '../../config/database.js';
import { config } from '../../config/index.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { emitToRestaurant } from '../../services/realtime.js';

const router = Router();

// ============================
// DADOS DO RESTAURANTE
// ============================
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, nome, endereco, cep, cidade, estado, latitude, longitude, status_loja, tempo_preparo_min FROM restaurantes WHERE id = $1',
      [config.restaurantId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Restaurante não encontrado.', 404);
    }

    // Buscar categorias e produtos para cardápio público
    const categorias = await query(
      'SELECT id, nome, slug, ordem FROM categorias WHERE restaurant_id = $1 ORDER BY ordem ASC',
      [config.restaurantId]
    );

    const produtos = await query(
      `SELECT p.id, p.nome, p.descricao, p.preco, p.imagem_url, p.imagem_base64, p.categoria_id,
              c.slug as categoria_slug, c.nome as categoria_nome
       FROM produtos p
       LEFT JOIN categorias c ON p.categoria_id = c.id
       WHERE p.restaurant_id = $1 AND p.ativo = true
       ORDER BY p.destaque DESC, p.nome ASC`,
      [config.restaurantId]
    );

    // Buscar raios de entrega
    const raios = await query(
      'SELECT * FROM raios_entrega WHERE restaurant_id = $1 ORDER BY raio_km ASC',
      [config.restaurantId]
    );

    res.json({
      ...result.rows[0],
      categorias: categorias.rows,
      produtos: produtos.rows,
      raiosEntrega: raios.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ============================
// ATUALIZAR DADOS DO RESTAURANTE (Admin)
// ============================
router.put('/', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const { nome, endereco, cep, cidade, estado, latitude, longitude, tempo_preparo_min } = req.body;

    const result = await query(
      `UPDATE restaurantes SET
        nome = COALESCE($1, nome),
        endereco = COALESCE($2, endereco),
        cep = COALESCE($3, cep),
        cidade = COALESCE($4, cidade),
        estado = COALESCE($5, estado),
        latitude = COALESCE($6, latitude),
        longitude = COALESCE($7, longitude),
        tempo_preparo_min = COALESCE($8, tempo_preparo_min)
       WHERE id = $9
       RETURNING *`,
      [nome, endereco, cep, cidade, estado, latitude, longitude, tempo_preparo_min, config.restaurantId]
    );

    emitToRestaurant('restaurante:atualizado', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ============================
// TOGGLE STATUS DA LOJA (Admin)
// ============================
router.post('/toggle-loja', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE restaurantes SET status_loja = NOT status_loja WHERE id = $1
       RETURNING id, status_loja`,
      [config.restaurantId]
    );

    emitToRestaurant('restaurante:status_loja', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ============================
// RAIOS DE ENTREGA (Admin)
// ============================
router.get('/raios-entrega', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM raios_entrega WHERE restaurant_id = $1 ORDER BY raio_km ASC',
      [config.restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/raios-entrega', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const { raio_km, tempo_min, tempo_max, custo } = req.body;
    const result = await query(
      `INSERT INTO raios_entrega (restaurant_id, raio_km, tempo_min, tempo_max, custo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [config.restaurantId, raio_km, tempo_min, tempo_max, custo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/raios-entrega/:id', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    await query('DELETE FROM raios_entrega WHERE id = $1 AND restaurant_id = $2', [req.params.id, config.restaurantId]);
    res.json({ message: 'Raio de entrega excluído.' });
  } catch (err) {
    next(err);
  }
});

// ============================
// MENSAGENS DO PEDIDO (Admin -> Cliente)
// ============================
router.post('/mensagens', authenticate, authorize('admin', 'gerente', 'chef'), async (req, res, next) => {
  try {
    const { pedido_id, mensagem } = req.body;
    const result = await query(
      `INSERT INTO mensagens_pedido (pedido_id, restaurante_id, mensagem)
       VALUES ($1, $2, $3) RETURNING *`,
      [pedido_id, config.restaurantId, mensagem]
    );

    // Buscar o cliente_id do pedido para notificar
    const pedido = await query('SELECT cliente_id FROM pedidos WHERE id = $1', [pedido_id]);

    emitToRestaurant('mensagem:novo', result.rows[0]);
    if (pedido.rows[0]?.cliente_id) {
      const { emitNovaMensagem } = await import('../../services/realtime.js');
      emitNovaMensagem(result.rows[0], pedido.rows[0].cliente_id);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ============================
// GESTÃO DE EQUIPE (Admin)
// ============================
router.get('/equipe', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, nome, email, cargo, ativo, ultimo_acesso, criado_em FROM restaurante_users WHERE restaurant_id = $1',
      [config.restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/equipe', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const { nome, email, password, cargo } = req.body;
    const senhaHash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO restaurante_users (restaurant_id, nome, email, senha_hash, cargo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nome, email, cargo`,
      [config.restaurantId, nome, email, senhaHash, cargo || 'caixa']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/equipe/:id', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    await query('DELETE FROM restaurante_users WHERE id = $1 AND restaurant_id = $2', [req.params.id, config.restaurantId]);
    res.json({ message: 'Usuário removido.' });
  } catch (err) {
    next(err);
  }
});

// ============================
// SEGURANÇA (Admin)
// ============================
router.put('/seguranca', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { email, senha_atual, nova_senha } = req.body;
    const { id } = req.user;

    if (nova_senha) {
      const user = await query('SELECT senha_hash FROM restaurante_users WHERE id = $1', [id]);
      const valida = await bcrypt.compare(senha_atual, user.rows[0].senha_hash);
      if (!valida) throw new AppError('Senha atual incorreta.', 400);

      const novaHash = await bcrypt.hash(nova_senha, 12);
      await query('UPDATE restaurante_users SET senha_hash = $1 WHERE id = $2', [novaHash, id]);
    }

    if (email) {
      await query('UPDATE restaurante_users SET email = $1 WHERE id = $2', [email, id]);
    }

    res.json({ message: 'Configurações de segurança atualizadas.' });
  } catch (err) {
    next(err);
  }
});

import bannersRouter from './banners.js';

router.use('/banners', bannersRouter);

export default router;
