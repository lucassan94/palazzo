import pg from 'pg';
import { config } from './index.js';

const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  max: config.db.max,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  connectionTimeoutMillis: config.db.connectionTimeoutMillis,
  query_timeout: config.db.query_timeout,
});

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message);
});

pool.on('connect', () => {
  console.log('[DB] New connection established');
});

// ============================================================================
// USER CONTEXT para RLS
// ============================================================================
// Armazenado em módulo-level (seguro pois Node.js é single-thread)
// Middleware pgContext.js chama setUserContext() antes de cada request
let _userContext = null;

export function setUserContext(user) {
  _userContext = user;
}

export function clearUserContext() {
  _userContext = null;
}

function getContextSQL() {
  const settings = [`SET app.restaurant_id = ${config.restaurantId}`];
  if (_userContext) {
    settings.push(`SET app.user_role = '${_userContext.role}'`);
    settings.push(`SET app.user_id = ${_userContext.id}`);
    if (_userContext.cargo) {
      settings.push(`SET app.user_cargo = '${_userContext.cargo}'`);
    }
  }
  return settings.join('; ');
}

// ============================================================================
// HELPERS DE CONSULTA
// ============================================================================

// Helper: query com contexto (usa conexão ÚNICA para SET + query)
export async function query(text, params = []) {
  const client = await pool.connect();
  const start = Date.now();
  try {
    // Contexto de sessão na MESMA conexão que executará a query
    await client.query(getContextSQL());
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 100));
    }
  }
}

// Helper: transação (já usa conexão única — só adicionar contexto)
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(getContextSQL());
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Health check
export async function healthCheck() {
  try {
    const result = await pool.query('SELECT 1 as alive');
    return { alive: true, total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount };
  } catch (error) {
    return { alive: false, error: error.message };
  }
}

export default pool;
