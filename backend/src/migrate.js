import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'delivery',
  user: process.env.DB_USER || 'default',
  password: process.env.DB_PASS || 'default',
  max: 1,
});

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ Migrations directory not found:', migrationsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`\n📦 Running ${files.length} migration(s)...\n`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`➜ Executing: ${file}`);

    try {
      await pool.query(sql);
      console.log(`   ✅ ${file} completed successfully`);
    } catch (err) {
      console.error(`   ❌ ${file} FAILED:`, err.message);
      console.log('\n⚠️  Migration aborted. Check the error above.');
      await pool.end();
      process.exit(1);
    }
  }

  console.log(`\n✅ All migrations executed successfully!\n`);
  await pool.end();
}

runMigrations();
