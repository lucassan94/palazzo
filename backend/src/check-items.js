import { Pool } from 'pg'

const pool = new Pool({
  host: '86.48.18.22', port: 5432, database: 'delivery',
  user: 'default', password: 'default', max: 1,
})

async function main() {
  // Show last 3 orders with items
  const orders = await pool.query(`
    SELECT p.id, p.pedido_id, p.status, p.subtotal, p.criado_em,
      (SELECT COUNT(*) FROM pedido_itens pi WHERE pi.pedido_id = p.id) as item_count
    FROM pedidos p ORDER BY p.criado_em DESC LIMIT 3
  `)

  for (const order of orders.rows) {
    console.log(`\n--- Pedido #${order.pedido_id} (ID: ${order.id}) ---`)
    console.log(`  Status: ${order.status}, Subtotal: ${order.subtotal}, Itens: ${order.item_count}`)
    
    if (order.item_count > 0) {
      const items = await pool.query(
        'SELECT * FROM pedido_itens WHERE pedido_id = $1',
        [order.id]
      )
      for (const item of items.rows) {
        console.log(`  - ${item.nome_produto} x${item.quantidade} = ${item.subtotal}`)
      }
    }
  }

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
