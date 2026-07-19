// ============================================================================
// Rate Limiter — protege endpoints de login contra brute force
// ============================================================================
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

// Limiter genérico: 10 tentativas por IP a cada 15 minutos
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                    // 10 tentativas por janela
  standardHeaders: true,      // Retorna headers RateLimit-*
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  skip: () => config.isDev,   // Em dev, não limitar
});

// Limiter mais restrito para criação de conta
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hora
  max: 5,                     // 5 cadastros por IP por hora
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas de cadastro. Tente novamente em 1 hora.',
    code: 'SIGNUP_RATE_LIMIT_EXCEEDED',
  },
  skip: () => config.isDev,
});
