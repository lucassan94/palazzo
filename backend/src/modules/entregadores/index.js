import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { query } from '../../config/database.js';
import { config } from '../../config/index.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { validarTelefone, validarCPF } from '../../utils/validators.js';

const router = Router();

const entregadorSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres.'),
  email: z.string().email('E-mail inválido.'),
  telefone: z.string().refine((v) => !v || validarTelefone(v).valido, 'Telefone inválido. Use (XX) XXXXX-XXXX.'),
  cpf: z.string().refine((v) => !v || validarCPF(v).valido, 'CPF inválido. Use XXX.XXX.XXX-XX.'),
  rg: z.string().optional().default(''),
  data_nascimento: z.string().optional().default(''),
  endereco: z.string().optional().default(''),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres.').optional(),
  status: z.enum(['ativo', 'inativo', 'bloqueado']).optional().default('ativo'),
});

// ============================
// LISTAR ENTREGADORES (Admin)
// ============================
router.get('/', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, nome, email, telefone, cpf, status, entregas_total,
              frete_total_recebido, ultima_entrega_em, criado_em
       FROM entregadores
       WHERE restaurant_id = $1
       ORDER BY nome ASC`,
      [config.restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ============================
// CRIAR ENTREGADOR (Admin)
// ============================
router.post('/', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const data = entregadorSchema.parse(req.body);
    if (!data.password) throw new AppError('Senha é obrigatória.', 400);

    const existing = await query('SELECT id FROM entregadores WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      throw new AppError('E-mail já cadastrado para outro entregador.', 409);
    }

    const senhaHash = await bcrypt.hash(data.password, 12);

    const result = await query(
      `INSERT INTO entregadores (restaurant_id, nome, email, telefone, cpf, rg, data_nascimento, endereco, senha_hash, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, nome, email, telefone, status`,
      [config.restaurantId, data.nome, data.email, data.telefone, data.cpf,
       data.rg, data.data_nascimento || null, data.endereco, senhaHash, data.status]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ============================
// ATUALIZAR ENTREGADOR (Admin)
// ============================
router.put('/:id', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = entregadorSchema.partial().parse(req.body);

    const fields = [];
    const params = [id, config.restaurantId];
    let paramIdx = 3;

    for (const [key, value] of Object.entries(data)) {
      if (key === 'password') {
        if (value) {
          fields.push(`senha_hash = $${paramIdx}`);
          params.push(await bcrypt.hash(value, 12));
          paramIdx++;
        }
      } else if (value !== undefined) {
        fields.push(`${key} = $${paramIdx}`);
        params.push(value);
        paramIdx++;
      }
    }

    if (fields.length === 0) {
      throw new AppError('Nenhum campo para atualizar.', 400);
    }

    const result = await query(
      `UPDATE entregadores SET ${fields.join(', ')} WHERE id = $1 AND restaurant_id = $2
       RETURNING id, nome, email, telefone, status, entregas_total, frete_total_recebido`,
      params
    );

    if (result.rows.length === 0) {
      throw new AppError('Entregador não encontrado.', 404);
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ============================
// RELATÓRIO DE ENTREGAS (tabela geral)
// ============================
router.get('/relatorio', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT e.id, e.nome, e.email, e.telefone, e.entregas_total, e.frete_total_recebido, e.ultima_entrega_em,
              COUNT(p.id) FILTER (WHERE p.status = 'entregue' AND p.criado_em >= CURRENT_DATE) as entregas_hoje
       FROM entregadores e
       LEFT JOIN pedidos p ON p.entregador_id = e.id
       WHERE e.restaurant_id = $1 AND e.status != 'inativo'
       GROUP BY e.id
       ORDER BY e.entregas_total DESC`,
      [config.restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ============================
// RELATÓRIO FINANCEIRO — Resumo diário (Admin)
// ============================
router.get('/relatorio/financeiro', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    // Total de hoje
    const hoje = await query(
      `SELECT COALESCE(SUM(p.valor_frete), 0) as total
       FROM pedidos p
       WHERE p.restaurant_id = $1 AND p.status = 'entregue' AND p.entregue_em >= CURRENT_DATE`,
      [config.restaurantId]
    );

    // Dias do mês
    const dias = await query(
      `SELECT
        DATE(p.entregue_em) as data,
        COUNT(*) as entregas,
        COALESCE(SUM(p.valor_frete), 0) as total_frete,
        COUNT(DISTINCT p.entregador_id) as entregadores_ativos
       FROM pedidos p
       WHERE p.restaurant_id = $1
         AND p.status = 'entregue'
         AND p.entregue_em >= DATE_TRUNC('month', CURRENT_DATE)
       GROUP BY DATE(p.entregue_em)
       ORDER BY data DESC`,
      [config.restaurantId]
    );

    // Consolidado do mês
    const consolidado = await query(
      `SELECT
        COALESCE(SUM(valor_frete), 0) as mes,
        COUNT(*) as entregas_mes
       FROM pedidos
       WHERE restaurant_id = $1 AND status = 'entregue' AND entregue_em >= DATE_TRUNC('month', CURRENT_DATE)`,
      [config.restaurantId]
    );

    res.json({
      hoje: hoje.rows[0].total,
      mes: consolidado.rows[0].mes,
      entregas_mes: parseInt(consolidado.rows[0].entregas_mes || 0),
      dias: dias.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ============================
// RELATÓRIO FINANCEIRO — Detalhamento de um dia (Admin)
// ============================
router.get('/relatorio/financeiro/dia/:data', authenticate, authorize('admin', 'gerente'), async (req, res, next) => {
  try {
    const { data } = req.params;

    const result = await query(
      `SELECT p.id, p.pedido_id, p.nome_cliente, p.valor_frete, p.total, p.metodo_pagamento,
              p.entregue_em, p.criado_em, p.endereco_cliente, p.numero_cliente, p.bairro_cliente,
              e.nome as entregador_nome
       FROM pedidos p
       LEFT JOIN entregadores e ON e.id = p.entregador_id
       WHERE p.restaurant_id = $1
         AND p.status = 'entregue'
         AND DATE(p.entregue_em) = $2
       ORDER BY p.entregue_em DESC`,
      [config.restaurantId, data]
    );

    res.json({
      data,
      total_frete: result.rows.reduce((acc, r) => acc + parseFloat(r.valor_frete || 0), 0),
      entregas: result.rows.length,
      itens: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ============================
// PERFIL DO ENTREGADOR (self)
// ============================
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { id } = req.user;
    const result = await query(
      `SELECT id, nome, email, telefone, endereco, foto_url, status, entregas_total, frete_total_recebido
       FROM entregadores WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Entregador não encontrado.', 404);
    }

    // Extrato financeiro
    const extrato = await query(
      `SELECT
        COALESCE(SUM(valor_frete) FILTER (WHERE status = 'entregue' AND entregue_em >= CURRENT_DATE), 0) as hoje,
        COALESCE(SUM(valor_frete) FILTER (WHERE status = 'entregue' AND entregue_em >= DATE_TRUNC('week', CURRENT_DATE)), 0) as semana,
        COALESCE(SUM(valor_frete) FILTER (WHERE status = 'entregue' AND entregue_em >= DATE_TRUNC('month', CURRENT_DATE)), 0) as mes
       FROM pedidos WHERE entregador_id = $1`,
      [id]
    );

    res.json({ ...result.rows[0], financeiro: extrato.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ============================
// EXTRATO FINANCEIRO — Resumo diário do mês
// ============================
router.get('/me/financeiro', authenticate, async (req, res, next) => {
  try {
    const { id } = req.user;

    // Total de hoje
    const hoje = await query(
      `SELECT COALESCE(SUM(valor_frete), 0) as total
       FROM pedidos
       WHERE entregador_id = $1 AND status = 'entregue' AND entregue_em >= CURRENT_DATE`,
      [id]
    );

    // Todos os dias do mês atual com entregas
    const dias = await query(
      `SELECT
        DATE(entregue_em) as data,
        COUNT(*) as entregas,
        COALESCE(SUM(valor_frete), 0) as total_frete
       FROM pedidos
       WHERE entregador_id = $1
         AND status = 'entregue'
         AND entregue_em >= DATE_TRUNC('month', CURRENT_DATE)
       GROUP BY DATE(entregue_em)
       ORDER BY data DESC`,
      [id]
    );

    // Totais consolidados (semana e mês)
    const consolidado = await query(
      `SELECT
        COALESCE(SUM(valor_frete) FILTER (WHERE entregue_em >= DATE_TRUNC('week', CURRENT_DATE)), 0) as semana,
        COALESCE(SUM(valor_frete), 0) as mes,
        COUNT(*) FILTER (WHERE entregue_em >= DATE_TRUNC('month', CURRENT_DATE)) as entregas_mes
       FROM pedidos
       WHERE entregador_id = $1 AND status = 'entregue' AND entregue_em >= DATE_TRUNC('month', CURRENT_DATE)`,
      [id]
    );

    res.json({
      hoje: hoje.rows[0].total,
      semana: consolidado.rows[0].semana,
      mes: consolidado.rows[0].mes,
      entregas_mes: parseInt(consolidado.rows[0].entregas_mes || 0),
      dias: dias.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ============================
// EXTRATO — Detalhamento de um dia específico
// ============================
router.get('/me/financeiro/dia/:data', authenticate, async (req, res, next) => {
  try {
    const { id } = req.user;
    const { data } = req.params;

    const result = await query(
      `SELECT p.id, p.pedido_id, p.nome_cliente, p.valor_frete, p.total, p.metodo_pagamento,
              p.entregue_em, p.criado_em, p.endereco_cliente, p.numero_cliente, p.bairro_cliente
       FROM pedidos p
       WHERE p.entregador_id = $1
         AND p.status = 'entregue'
         AND DATE(p.entregue_em) = $2
       ORDER BY p.entregue_em DESC`,
      [id, data]
    );

    res.json({
      data,
      total_frete: result.rows.reduce((acc, r) => acc + parseFloat(r.valor_frete || 0), 0),
      entregas: result.rows.length,
      itens: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ============================
// ATUALIZAR PRÓPRIO PERFIL (Entregador)
// ============================
router.put('/me', authenticate, async (req, res, next) => {
  try {
    const { id } = req.user;
    const { nome, telefone, endereco, foto_url } = req.body;

    const result = await query(
      `UPDATE entregadores SET
        nome = COALESCE($1, nome),
        telefone = COALESCE($2, telefone),
        endereco = COALESCE($3, endereco),
        foto_url = COALESCE($4, foto_url)
       WHERE id = $5
       RETURNING id, nome, email, telefone, endereco, foto_url`,
      [nome, telefone, endereco, foto_url, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
