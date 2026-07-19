// Classe de erro operacional
export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Middleware: 404 para rotas não encontradas
export function notFound(req, res, next) {
  res.status(404).json({
    error: `Rota ${req.method} ${req.originalUrl} não encontrada.`,
    code: 'NOT_FOUND',
  });
}

// Middleware: tratamento centralizado de erros
export function errorHandler(err, req, res, _next) {
  // Erro operacional (conhecido, tratado)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  // Erro de validação Zod
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Dados inválidos.',
      code: 'VALIDATION_ERROR',
      details: err.errors?.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Erro de banco de dados
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Registro duplicado.',
      code: 'DUPLICATE_ENTRY',
    });
  }

  if (err.code === '23503') {
    return res.status(409).json({
      error: 'Registro referenciado não encontrado.',
      code: 'FOREIGN_KEY_VIOLATION',
    });
  }

  // Erro não esperado (log no servidor)
  console.error('[ERROR]', err);

  res.status(err.statusCode || 500).json({
    error: 'Erro interno do servidor.',
    code: 'INTERNAL_ERROR',
    ...(req.app.get('env') === 'development' && { detail: err.message }),
  });
}
