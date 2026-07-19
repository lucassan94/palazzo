import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query, transaction } from '../../config/database.js';
import { config } from '../../config/index.js';
import { authenticate } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { validarTelefone, validarCPF } from '../../utils/validators.js';
import { loginLimiter, signupLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

// Schemas de validação
const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres.'),
});

const signupClienteSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres.'),
  sobrenome: z.string().optional(),
  email: z.string().email('E-mail inválido.'),
  telefone: z.string().refine((v) => !v || validarTelefone(v).valido, { message: 'Telefone inválido. Use (XX) XXXXX-XXXX.' }).optional(),
  cpf: z.string().refine((v) => !v || validarCPF(v).valido, { message: 'CPF inválido.' }).optional(),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres.'),
});

// Gerar tokens JWT
function gerarTokens(usuario) {
  const payload = {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    role: usuario.role,
    cargo: usuario.cargo || usuario.role, // cargo real (admin/gerente) ou role como fallback
    restaurantId: config.restaurantId,
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  return { accessToken, refreshToken };
}

// Definir cookie httpOnly
function setTokenCookies(res, tokens) {
  const cookieOptions = {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  };

  res.cookie('token', tokens.accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 min
  });

  res.cookie('refreshToken', tokens.refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
  });

  // Token legível para o frontend (útil para Socket.IO auth)
  res.cookie('publicToken', tokens.accessToken, {
    httpOnly: false,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000,
  });
}

// ============================
// CLIENTE - Login
// ============================
router.post('/cliente/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await query(
      'SELECT id, nome, sobrenome, email, telefone, endereco, cep, cpf_cnpj, senha_hash FROM clientes WHERE email = $1 AND ativo = true',
      [email]
    );

    const user = result.rows[0];
    if (!user) throw new AppError('E-mail ou senha inválidos.', 401);

    const senhaValida = await bcrypt.compare(password, user.senha_hash);
    if (!senhaValida) throw new AppError('E-mail ou senha inválidos.', 401);

    const tokens = gerarTokens({ ...user, role: 'cliente' });
    setTokenCookies(res, tokens);

    res.json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        nome: user.nome,
        sobrenome: user.sobrenome,
        email: user.email,
        telefone: user.telefone,
        cpf_cnpj: user.cpf_cnpj,
        role: 'cliente',
      },
      token: tokens.accessToken,
    });
  } catch (err) {
    next(err);
  }
});

// ============================
// CLIENTE - Cadastro
// ============================
router.post('/cliente/signup', signupLimiter, async (req, res, next) => {
  try {
    const data = signupClienteSchema.parse(req.body);

    // Verificar se email já existe
    const existing = await query('SELECT id FROM clientes WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      throw new AppError('Este e-mail já está cadastrado.', 409);
    }

    const senhaHash = await bcrypt.hash(data.password, 12);

    const result = await transaction(async (client) => {
      const r = await client.query(
        `INSERT INTO clientes (restaurant_id, nome, sobrenome, email, telefone, cpf_cnpj, senha_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, nome, sobrenome, email, telefone, cpf_cnpj`,
        [config.restaurantId, data.nome, data.sobrenome || '', data.email, data.telefone || '', data.cpf?.replace(/\D/g, '') || '', senhaHash]
      );
      return r.rows[0];
    });

    const tokens = gerarTokens({ ...result, role: 'cliente' });
    setTokenCookies(res, tokens);

    res.status(201).json({
      message: 'Conta criada com sucesso!',
      user: { ...result, role: 'cliente' },
      token: tokens.accessToken,
    });
  } catch (err) {
    next(err);
  }
});

// ============================
// ENTREGADOR - Login
// ============================
router.post('/entregador/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await query(
      `SELECT id, nome, email, telefone, senha_hash, status, entregas_total, frete_total_recebido
       FROM entregadores
       WHERE email = $1 AND restaurant_id = $2`,
      [email, config.restaurantId]
    );

    const user = result.rows[0];
    if (!user) throw new AppError('E-mail ou senha inválidos.', 401);

    if (user.status === 'bloqueado') {
      throw new AppError('Seu acesso foi bloqueado. Entre em contato com o restaurante.', 403);
    }

    const senhaValida = await bcrypt.compare(password, user.senha_hash);
    if (!senhaValida) throw new AppError('E-mail ou senha inválidos.', 401);

    const tokens = gerarTokens({ ...user, role: 'entregador' });
    setTokenCookies(res, tokens);

    res.json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        telefone: user.telefone,
        status: user.status,
        entregasTotal: user.entregas_total,
        freteTotal: user.frete_total_recebido,
        role: 'entregador',
      },
      token: tokens.accessToken,
    });
  } catch (err) {
    next(err);
  }
});

// ============================
// RESTAURANTE (Admin) - Login
// ============================
router.post('/restaurante/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await query(
      `SELECT id, nome, email, senha_hash, cargo, ativo
       FROM restaurante_users
       WHERE email = $1 AND restaurant_id = $2 AND ativo = true`,
      [email, config.restaurantId]
    );

    const user = result.rows[0];
    if (!user) throw new AppError('E-mail ou senha inválidos.', 401);

    const senhaValida = await bcrypt.compare(password, user.senha_hash);
    if (!senhaValida) throw new AppError('E-mail ou senha inválidos.', 401);

    // Atualizar último acesso
    await query('UPDATE restaurante_users SET ultimo_acesso = NOW() WHERE id = $1', [user.id]);

    const tokens = gerarTokens({ ...user, role: 'restaurante' });
    setTokenCookies(res, tokens);

    res.json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cargo: user.cargo,
        role: 'restaurante',
      },
      token: tokens.accessToken,
    });
  } catch (err) {
    next(err);
  }
});

// ============================
// REFRESH TOKEN
// ============================
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) throw new AppError('Refresh token não fornecido.', 401);

    const decoded = jwt.verify(refreshToken, config.jwt.secret);
    if (decoded.type !== 'refresh') throw new AppError('Token inválido.', 401);

    const user = {
      id: decoded.id,
      email: decoded.email,
      nome: decoded.nome,
      role: decoded.role,
    };

    const tokens = gerarTokens(user);
    setTokenCookies(res, tokens);

    res.json({
      message: 'Token renovado.',
      token: tokens.accessToken,
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.', code: 'SESSION_EXPIRED' });
    }
    next(err);
  }
});

// ============================
// LOGOUT
// ============================
router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.clearCookie('publicToken', { path: '/' });
  res.json({ message: 'Logout realizado com sucesso.' });
});

// ============================
// VERIFICAR SESSÃO
// ============================
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { id, role } = req.user;

    if (role === 'cliente') {
      const result = await query(
        'SELECT id, nome, sobrenome, email, telefone, endereco, cep, numero, bairro, complemento, cidade, estado, cpf_cnpj FROM clientes WHERE id = $1',
        [id]
      );
      if (!result.rows[0]) throw new AppError('Usuário não encontrado.', 404);
      return res.json({ user: { ...result.rows[0], role: 'cliente' } });
    }

    if (role === 'entregador') {
      const result = await query(
        'SELECT id, nome, email, telefone, status, foto_url, entregas_total, frete_total_recebido, endereco FROM entregadores WHERE id = $1',
        [id]
      );
      if (!result.rows[0]) throw new AppError('Usuário não encontrado.', 404);
      return res.json({ user: { ...result.rows[0], role: 'entregador' } });
    }

    if (role === 'restaurante') {
      const result = await query(
        'SELECT id, nome, email, cargo FROM restaurante_users WHERE id = $1',
        [id]
      );
      if (!result.rows[0]) throw new AppError('Usuário não encontrado.', 404);
      return res.json({ user: { ...result.rows[0], role: 'restaurante' } });
    }

    throw new AppError('Tipo de usuário inválido.', 400);
  } catch (err) {
    next(err);
  }
});

export default router;
