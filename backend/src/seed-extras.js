import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: '86.48.18.22', port: 5432,
  database: 'delivery', user: 'default', password: 'default', max: 1,
});

async function main() {
  // Product 13 - Medalhao File Mignon ao Molho Gorgonzola (R$69.93)
  await pool.query("INSERT INTO produtos_extras (produto_id, nome, preco, maximo) VALUES (13, 'Bacon Extra', 4.50, 2)");
  await pool.query("INSERT INTO produtos_extras (produto_id, nome, preco, maximo) VALUES (13, 'Queijo Extra', 4.00, 2)");
  await pool.query("INSERT INTO produtos_extras (produto_id, nome, preco, maximo) VALUES (13, 'Batata Frita', 6.00, 1)");
  await pool.query("INSERT INTO produtos_extras (produto_id, nome, preco, maximo) VALUES (13, 'Molho Gorgonzola', 5.00, 1)");

  // Product 14 - Ancho Grelhado com Salada de Batata (R$72.78)
  await pool.query("INSERT INTO produtos_extras (produto_id, nome, preco, maximo) VALUES (14, 'Bacon Extra', 4.50, 2)");
  await pool.query("INSERT INTO produtos_extras (produto_id, nome, preco, maximo) VALUES (14, 'Cebola Caramelizada', 4.00, 1)");
  await pool.query("INSERT INTO produtos_extras (produto_id, nome, preco, maximo) VALUES (14, 'Salada Caesar', 5.50, 1)");

  // Product 15 - File Mignon a Parmegiana com Catupiry (R$69.90)
  await pool.query("INSERT INTO produtos_extras (produto_id, nome, preco, maximo) VALUES (15, 'Queijo Extra', 4.00, 1)");
  await pool.query("INSERT INTO produtos_extras (produto_id, nome, preco, maximo) VALUES (15, 'Batata Frita', 6.00, 1)");
  await pool.query("INSERT INTO produtos_extras (produto_id, nome, preco, maximo) VALUES (15, 'Molho Especial', 3.00, 1)");

  // Verify
  const r = await pool.query(
    "SELECT pe.*, p.nome as pnome FROM produtos_extras pe JOIN produtos p ON p.id = pe.produto_id ORDER BY pnome, pe.nome"
  );
  console.log('Extras cadastrados:', r.rows.length);
  for (const row of r.rows) {
    console.log('  [' + row.pnome + '] ' + row.nome + ' - R$' + parseFloat(row.preco).toFixed(2));
  }

  await pool.end();
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
