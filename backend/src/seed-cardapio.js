import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || '86.48.18.22',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'delivery',
  user: process.env.DB_USER || 'default',
  password: process.env.DB_PASS || 'default',
  max: 1,
});

// Parse CSV (formato: Categoria;Nome;Valor;Descrição;Imagem;...)
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const items = [];
  for (const line of lines) {
    // Pular cabeçalho
    if (line.includes('Categoria;Nome do Prato')) continue;
    // Dividir por ; respeitando aspas
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ';' && !inQuotes) { cols.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    cols.push(current.trim());
    if (cols.length >= 5) {
      items.push({
        categoria: cols[0],
        nome: cols[1],
        valor: parseFloat((cols[2] || '0').replace('R$ ', '').replace(',', '.')) || 0,
        descricao: cols[3] || '',
        imagem: cols[4] || '',
      });
    }
  }
  return items;
}

async function seedCardapio() {
  console.log('\n🍽️  Seed do Cardápio - Palazzo\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET app.restaurant_id = 1");

    // 1. Atualizar nome do restaurante
    await client.query(
      `UPDATE restaurantes SET nome = 'Palazzo', atualizado_em = NOW() WHERE id = 1`
    );
    console.log('✅ Restaurante renomeado para "Palazzo"');

    // 2. Limpar produtos e categorias existentes
    await client.query('DELETE FROM produtos_extras WHERE produto_id IN (SELECT id FROM produtos WHERE restaurant_id = 1)');
    await client.query('DELETE FROM pedido_itens WHERE produto_id IN (SELECT id FROM produtos WHERE restaurant_id = 1)');
    await client.query('DELETE FROM produtos WHERE restaurant_id = 1');
    await client.query('DELETE FROM categorias WHERE restaurant_id = 1');
    console.log('✅ Produtos e categorias antigos limpos');

    // 3. Ler CSV
    const csvPath = path.join(__dirname, '..', '..', 'Card\u00e1pio', 'cardapio.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error('Arquivo cardapio.csv não encontrado em: ' + csvPath);
    }
    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const items = parseCSV(csvText);
    console.log(`📄 ${items.length} itens lidos do CSV`);

    // 4. Mapear categorias únicas
    const categoriasSet = [...new Set(items.map(i => i.categoria))];
    const categoriasMap = {};
    
    // Categorias do cardápio
    const slugMap = {
      'Em Destaque': 'destaques',
      'Pratos Principais': 'principais',
      'Executivos': 'executivos',
      'Saladas': 'saladas',
      'Monte Seu Delivery': 'monte-seu',
      'Pratos para até 2 Pessoas': 'para-2',
      'Sobremesas': 'sobremesas',
      'Bebidas': 'bebidas',
    };

    for (const cat of categoriasSet) {
      const slug = slugMap[cat] || cat.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const result = await client.query(
        `INSERT INTO categorias (restaurant_id, nome, slug, ordem)
         VALUES (1, $1, $2, $3) RETURNING id`,
        [cat, slug, categoriasSet.indexOf(cat)]
      );
      categoriasMap[cat] = result.rows[0].id;
    }
    console.log(`✅ ${Object.keys(categoriasMap).length} categorias criadas`);

    // 5. Inserir produtos
    let count = 0;
    for (const item of items) {
      const categoriaId = categoriasMap[item.categoria];
      const imagemUrl = item.imagem
        ? `/uploads/cardapio/${item.imagem.replace('images\\', '').replace('images/', '')}`
        : '';

      await client.query(
        `INSERT INTO produtos (restaurant_id, categoria_id, nome, descricao, preco, imagem_url, ativo, destaque)
         VALUES (1, $1, $2, $3, $4, $5, true, $6)`,
        [
          categoriaId,
          item.nome,
          item.descricao,
          item.valor,
          imagemUrl,
          item.categoria === 'Em Destaque' ? true : false,
        ]
      );
      count++;
    }
    console.log(`✅ ${count} produtos inseridos no cardápio`);

    await client.query('COMMIT');
    console.log('\n🎉 Cardápio do Palazzo atualizado com sucesso!\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erro:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedCardapio();
