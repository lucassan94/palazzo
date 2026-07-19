// Script: Importar imagens reais + Limpar pedidos
// 
// 1. Apaga todos os registros de pedidos, pagamentos, etc (cascade)
// 2. Lê as imagens da pasta Cardápio/images/
// 3. Converte para base64 e salva na coluna imagem_base64
//
// Uso: node src/importar-imagens-e-limpar.js

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.DB_HOST || '86.48.18.22',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'delivery',
  user: process.env.DB_USER || 'default',
  password: process.env.DB_PASS || 'default',
  max: 1,
});

const IMAGES_DIR = path.resolve('..', 'Cardápio', 'images');
const MAX_IMAGE_SIZE_MB = 2;
const MAX_IMAGE_SIZE = MAX_IMAGE_SIZE_MB * 1024 * 1024;

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

async function limparPedidos() {
  console.log('🗑️  Limpando dados de pedidos...\n');

  const tabelas = [
    'webhook_events',
    'mensagens_pedido',
    'pedido_timeline',
    'pedido_itens',
    'pagamentos',
    'pedidos',
  ];

  for (const tabela of tabelas) {
    const result = await pool.query(`DELETE FROM ${tabela}`);
    console.log(`   ✅ ${tabela}: ${result.rowCount} registros removidos`);
  }

  // Resetar sequence do pedido_id se existir
  try {
    await pool.query("SELECT setval('pedidos_id_seq', COALESCE((SELECT MAX(id) FROM pedidos), 0), false)");
    console.log('   ✅ Sequence pedidos_id_seq resetada');
  } catch {
    // Tabela pode não ter sequence ou já estar vazia
  }

  console.log('\n   ✅ Todos os pedidos foram apagados!\n');
}

async function importarImagens() {
  console.log('📸 Importando imagens da pasta:', IMAGES_DIR);
  console.log('');

  // Verificar se a pasta existe
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`❌ Pasta não encontrada: ${IMAGES_DIR}`);
    console.error('   Certifique-se de que a pasta "Cardápio/images" existe ao lado da pasta "backend"');
    return;
  }

  // Listar arquivos de imagem
  const files = fs.readdirSync(IMAGES_DIR).filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  });

  console.log(`   📁 Encontrados ${files.length} arquivos de imagem\n`);

  // Buscar todos os produtos
  const produtos = await pool.query(
    'SELECT id, nome, imagem_url FROM produtos WHERE restaurant_id = 1 ORDER BY id'
  );

  console.log(`   📦 ${produtos.rows.length} produtos no banco\n`);

  let importados = 0;
  let naoEncontrados = [];
  let erros = [];

  for (const prod of produtos.rows) {
    // Extrair nome do arquivo da imagem_url
    const urlFileName = prod.imagem_url ? path.basename(prod.imagem_url) : null;
    if (!urlFileName) {
      naoEncontrados.push(`ID ${prod.id}: ${prod.nome} (sem imagem_url)`);
      continue;
    }

    // Procurar o arquivo na pasta (case-insensitive)
    const matchedFile = files.find(f => f.toLowerCase() === urlFileName.toLowerCase());

    if (!matchedFile) {
      naoEncontrados.push(`ID ${prod.id}: ${prod.nome.substring(0, 40)} — arquivo não encontrado: ${urlFileName}`);
      continue;
    }

    const filePath = path.join(IMAGES_DIR, matchedFile);
    const stats = fs.statSync(filePath);

    if (stats.size > MAX_IMAGE_SIZE) {
      console.warn(`   ⚠️  ${matchedFile}: ${formatBytes(stats.size)} — muito grande (>${MAX_IMAGE_SIZE_MB}MB), pulando`);
      naoEncontrados.push(`ID ${prod.id}: ${prod.nome} — imagem muito grande (${formatBytes(stats.size)})`);
      continue;
    }

    try {
      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString('base64');

      // Determinar o mime type
      const ext = path.extname(matchedFile).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      };
      const mime = mimeTypes[ext] || 'image/jpeg';

      await pool.query(
        'UPDATE produtos SET imagem_base64 = $1 WHERE id = $2',
        [base64, prod.id]
      );

      console.log(`   ✅ ID ${String(prod.id).padStart(2, ' ')} | ${prod.nome.substring(0, 45).padEnd(45, ' ')} | ${formatBytes(stats.size)}`);
      importados++;
    } catch (err) {
      console.error(`   ❌ Erro ao processar ${matchedFile}: ${err.message}`);
      erros.push(matchedFile);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('📊 RESUMO DA IMPORTAÇÃO');
  console.log('═══════════════════════════════════════');
  console.log(`   ✅ Importados: ${importados} imagens`);
  console.log(`   ⚠️  Não encontrados: ${naoEncontrados.length}`);
  console.log(`   ❌ Erros: ${erros.length}`);
  console.log('═══════════════════════════════════════\n');

  if (naoEncontrados.length > 0) {
    console.log('⚠️  Produtos sem imagem correspondente:');
    naoEncontrados.forEach(item => console.log(`   • ${item}`));
    console.log('');
  }

  return importados;
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  🛠️  SaborExpress — Importar Imagens');
  console.log('═══════════════════════════════════════\n');

  const startTime = Date.now();

  // PASSO 1: Limpar pedidos
  await limparPedidos();

  // PASSO 2: Importar imagens
  const total = await importarImagens();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`⏱️  Tempo total: ${elapsed}s\n`);
  console.log('✅ Pronto! As imagens reais foram salvas no banco.');
  console.log('   O cardápio agora deve exibir as fotos dos pratos!\n');

  await pool.end();
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
