// Limpar TODOS os pedidos do banco
import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.DB_HOST || '86.48.18.22',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'delivery',
  user: process.env.DB_USER || 'default',
  password: process.env.DB_PASS || 'default',
  max: 1,
  query_timeout: 30000,
});

async function main() {
  const tables = ['webhook_events', 'mensagens_pedido', 'pedido_timeline', 'pedido_itens', 'pagamentos', 'pedidos'];

  // ANTES
  console.log('📊 ANTES:');
  for (const t of tables) {
    const r = await pool.query(`SELECT COUNT(*) FROM ${t}`);
    console.log(`  ${t}: ${r.rows[0].count}`);
  }

  // DELETAR (ordem FK-safe)
  console.log('\n🗑️  Deletando...');
  await pool.query('DELETE FROM webhook_events');
  await pool.query('DELETE FROM mensagens_pedido');
  await pool.query('DELETE FROM pedido_timeline');
  await pool.query('DELETE FROM pedido_itens');
  await pool.query('DELETE FROM pagamentos');
  await pool.query('DELETE FROM pedidos');

  // Resetar sequence
  await pool.query("SELECT setval('pedidos_id_seq', (SELECT COALESCE(MAX(id), 1000) FROM pedidos))");

  // DEPOIS
  console.log('\n📊 DEPOIS:');
  for (const t of tables) {
    const r = await pool.query(`SELECT COUNT(*) FROM ${t}`);
    console.log(`  ${t}: ${r.rows[0].count}`);
  }

  await pool.end();
  console.log('\n✅ Todos os pedidos foram limpos!');
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
