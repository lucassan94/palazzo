// Seed: Inserir raios de entrega padrão
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.DB_HOST || '86.48.18.22',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'delivery',
  user: process.env.DB_USER || 'default',
  password: process.env.DB_PASS || 'default',
  max: 1,
});

const RESTAURANT_ID = parseInt(process.env.RESTAURANT_ID || '1');

const raiosPadrao = [
  { raio_km: 1, tempo_min: 15, tempo_max: 25, custo: 5.00 },
  { raio_km: 3, tempo_min: 20, tempo_max: 35, custo: 7.00 },
  { raio_km: 5, tempo_min: 25, tempo_max: 45, custo: 10.00 },
  { raio_km: 8, tempo_min: 30, tempo_max: 55, custo: 12.00 },
  { raio_km: 10, tempo_min: 35, tempo_max: 60, custo: 15.00 },
];

async function main() {
  console.log('');
  console.log('=== SEED RAIOS DE ENTREGA ===');

  const existentes = await pool.query(
    'SELECT COUNT(*)::int as count FROM raios_entrega WHERE restaurant_id = $1',
    [RESTAURANT_ID]
  );
  const count = existentes.rows[0].count;

  if (count > 0) {
    console.log(`Já existem ${count} raios cadastrados. Pulando seed.`);
    await pool.end();
    return;
  }

  console.log('Inserindo raios padrão...');

  for (const raio of raiosPadrao) {
    await pool.query(
      `INSERT INTO raios_entrega (restaurant_id, raio_km, tempo_min, tempo_max, custo)
       VALUES ($1, $2, $3, $4, $5)`,
      [RESTAURANT_ID, raio.raio_km, raio.tempo_min, raio.tempo_max, raio.custo]
    );
    console.log(`  ✅ ${raio.raio_km}km | ${raio.tempo_min}-${raio.tempo_max}min | R$ ${raio.custo.toFixed(2)}`);
  }

  console.log(`\n✅ ${raiosPadrao.length} raios inseridos com sucesso!`);
  await pool.end();
}

main().catch(err => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
