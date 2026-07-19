import { setUserContext, clearUserContext } from '../config/database.js';

/**
 * Middleware: Armazena o contexto do usuário logado para o RLS.
 * 
 * O database.js lê _userContext a cada query() e define as variáveis
 * de sessão (app.user_role, app.user_id) na MESMA conexão que executará
 * a query, resolvendo o problema de connection pooling.
 * 
 * Deve ser executado APÓS o middleware authenticate.
 */
export function pgContext(req, res, next) {
  if (req.user) {
    setUserContext(req.user);
    // Limpa o contexto quando a resposta for finalizada
    res.on('finish', clearUserContext);
  }
  next();
}
