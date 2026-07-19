// ============================================================================
// Gerar Imagens Placeholder para Produtos
// Gera SVGs com gradientes e nome do produto, converte para base64 e
// armazena na coluna imagem_base64 da tabela produtos
// ============================================================================

import pkg from 'pg';
import 'dotenv/config';

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || '86.48.18.22',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'delivery',
  user: process.env.DB_USER || 'default',
  password: process.env.DB_PASS || 'default',
  max: 1,
});

// Paletas de cores para os placeholders (gradientes vibrantes)
const paletas = [
  { bg1: '#dc2626', bg2: '#f97316' },  // Vermelho -> Laranja
  { bg1: '#059669', bg2: '#10b981' },  // Verde escuro -> Verde claro
  { bg1: '#7c3aed', bg2: '#a855f7' },  // Roxo escuro -> Roxo claro
  { bg1: '#2563eb', bg2: '#3b82f6' },  // Azul escuro -> Azul
  { bg1: '#d97706', bg2: '#f59e0b' },  // Âmbar -> Amarelo
  { bg1: '#db2777', bg2: '#ec4899' },  // Rosa escuro -> Rosa
  { bg1: '#0891b2', bg2: '#06b6d4' },  // Ciano escuro -> Ciano
  { bg1: '#4f46e5', bg2: '#6366f1' },  // Índigo
  { bg1: '#be123c', bg2: '#e11d48' },  // Carmim
  { bg1: '#15803d', bg2: '#22c55e' },  // Verde floresta
];

function gerarSVGPlaceholder(nome, index) {
  const paleta = paletas[index % paletas.length];
  const sigla = nome
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 3)
    .toUpperCase();

  // Escapar caracteres especiais para SVG
  const nomeEscapado = nome
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="bg${index}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${paleta.bg1};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${paleta.bg2};stop-opacity:1" />
    </linearGradient>
    <linearGradient id="shine${index}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:rgba(255,255,255,0.15);stop-opacity:1" />
      <stop offset="100%" style="stop-color:rgba(255,255,255,0);stop-opacity:0" />
    </linearGradient>
  </defs>
  <rect width="400" height="300" rx="0" fill="url(#bg${index})"/>
  <rect width="400" height="150" fill="url(#shine${index})"/>
  <circle cx="340" cy="40" r="60" fill="rgba(255,255,255,0.06)"/>
  <circle cx="50" cy="260" r="80" fill="rgba(255,255,255,0.05)"/>
  <text x="200" y="130" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="800" fill="rgba(255,255,255,0.25)" text-anchor="middle" dominant-baseline="middle">${sigla}</text>
  <text x="200" y="210" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="middle">
    <tspan x="200" dy="0">${nomeEscapado}</tspan>
  </text>
  <rect x="160" y="240" width="80" height="2" rx="1" fill="rgba(255,255,255,0.3)"/>
  <text x="200" y="265" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="500" fill="rgba(255,255,255,0.5)" text-anchor="middle" dominant-baseline="middle">Palazzo Mooca</text>
</svg>`;
}

async function gerarImagens() {
  console.log('\n🎨 Gerando imagens placeholder para produtos...\n');

  try {
    // Buscar produtos SEM imagem_base64
    const result = await pool.query(
      `SELECT id, nome, imagem_url
       FROM produtos
       WHERE (imagem_base64 IS NULL OR imagem_base64 = '')
       AND restaurant_id = 1
       ORDER BY id`
    );

    const produtos = result.rows;
    console.log(`📦 ${produtos.length} produtos sem imagem base64 encontrados\n`);

    if (produtos.length === 0) {
      console.log('✅ Todos os produtos já possuem imagem base64!');
      await pool.end();
      return;
    }

    let count = 0;
    for (let i = 0; i < produtos.length; i++) {
      const prod = produtos[i];
      const svg = gerarSVGPlaceholder(prod.nome, i);
      
      // Converter SVG para base64
      const base64 = Buffer.from(svg, 'utf-8').toString('base64');

      // Atualizar no banco
      await pool.query(
        'UPDATE produtos SET imagem_base64 = $1 WHERE id = $2',
        [base64, prod.id]
      );

      count++;
      if (count % 10 === 0) {
        console.log(`  ➜ ${count}/${produtos.length} imagens geradas...`);
      }
    }

    console.log(`\n✅ ${count} imagens placeholder geradas e salvas no banco!`);
    console.log('   As imagens agora aparecerão na tela de produtos do admin.\n');

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

gerarImagens();
