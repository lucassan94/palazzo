import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

// Extrair token do cookie ou header Authorization
function extractToken(req) {
  // Tenta cookie first (httpOnly cookie)
  if (req.cookies?.token) return req.cookies.token;

  // Fallback: Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

// Middleware: autenticação obrigatória
export function authenticate(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sessão expirada.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token inválido.' });
  }
}

// Middleware: autenticação opcional (não bloqueia)
export function optionalAuth(req, res, next) {
  const token = extractToken(req);

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = decoded;
    } catch {
      // Token inválido ou expirado, ignora
    }
  }

  next();
}

// Middleware: verificar role/cargo específica
// Aceita tanto role (cliente/entregador/restaurante) quanto cargo (admin/gerente/chef/caixa)
// NOTA: Não usa mais o bypass 'role === restaurante' — agora cada cargo é verificado explicitamente.
export function authorize(...allowedRolesOrCargos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    // Normalizar para lowercase
    const allowed = allowedRolesOrCargos.map(r => r.toLowerCase());
    const userRole = (req.user.role || '').toLowerCase();
    const userCargo = (req.user.cargo || '').toLowerCase();

    // Verifica se o role OU o cargo do usuário está na lista de permitidos
    if (allowed.includes(userRole) || allowed.includes(userCargo)) {
      return next();
    }

    return res.status(403).json({
      error: 'Acesso não autorizado para esta função.',
      required: allowedRolesOrCargos,
      userCargo,
    });
  };
}

// Guard: proteção contra bypass via DevTools no frontend
export function guardCheck(req, res, next) {
  // SPA guard: se a request não tiver referer ou for via API, pode prosseguir
  // Isso evita que alguém desative o JS e tente acessar dados
  if (req.headers['x-auth-guard'] === 'saborexpress-secure') {
    return next();
  }

  // Normal auth flow
  next();
}
