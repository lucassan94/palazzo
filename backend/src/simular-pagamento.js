// Script para simular pagamento (webhook PAYMENT_RECEIVED) de todos os pedidos pendentes
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'saborexpress',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  max: 1
});

const WEBHOOK_URL = 'http://localhost:3001/api/pagamentos/webhook';
const WEBHOOK_TOKEN = 'webhook_secret_saborexpress_2026';

async function main() {
  // Buscar todos os pagamentos PENDING com seus pedidos
  const result = await pool.query(`
    SELECT p.id, p.pedido_id, p.payment_id, p.valor_bruto, p.billing_type,
           o.pedido_id as display_id, o.nome_cliente, o.status as pedido_status
    FROM pagamentos p 
    JOIN pedidos o ON o.id = p.pedido_id 
    WHERE p.status = 'PENDING'
    ORDER BY p.criado_em DESC
  `);

  if (result.rows.length === 0) {
    console.log('✅ Nenhum pagamento pendente encontrado!');
    await pool.end();
    return;
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`💰 ${result.rows.length} pagamentos pendentes encontrados`);
  console.log(`═══════════════════════════════════════════\n`);

  result.rows.forEach(p => {
    console.log(`📦 Pedido #${p.display_id} (DB ID: ${p.pedido_id}) — ${p.nome_cliente || '(sem nome)'}`);
    console.log(`   Payment: ${p.payment_id} | Valor: R$ ${p.valor_bruto} | Tipo: ${p.billing_type}`);
    console.log(`   Status atual: ${p.pedido_status}`);
    console.log('');
  });

  // Simular PAYMENT_RECEIVED para cada um
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`🚀 SIMULANDO PAGAMENTO...`);
  console.log(`═══════════════════════════════════════════\n`);

  let sucesso = 0;
  let falha = 0;

  for (const p of result.rows) {
    const body = {
      id: `evt_simulado_${Date.now()}_${p.id}`,
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: p.payment_id,
        status: 'RECEIVED',
        value: parseFloat(p.valor_bruto),
        netValue: parseFloat(p.valor_bruto) * 0.97,
        externalReference: String(p.pedido_id),
        fee: parseFloat(p.valor_bruto) * 0.03,
        paymentDate: new Date().toISOString()
      }
    };

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'asaas-access-token': WEBHOOK_TOKEN
        },
        body: JSON.stringify(body)
      });

      const text = await res.text();
      if (res.ok) {
        console.log(`✅ Pedido #${p.display_id} (${p.payment_id}) → PAGO! ${res.status}`);
        sucesso++;
      } else {
        console.log(`❌ Pedido #${p.display_id} (${p.payment_id}) → Erro ${res.status}: ${text}`);
        falha++;
      }
    } catch (err) {
      console.log(`❌ Pedido #${p.display_id} — Exceção: ${err.message}`);
      falha++;
    }

    // Pequeno delay entre requisições
    await new Promise(r => setTimeout(r, 200));
  }

  // Verificar resultado final
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`📊 RESULTADO`);
  console.log(`═══════════════════════════════════════════`);
  console.log(`   ✅ Pagos: ${sucesso}`);
  console.log(`   ❌ Falhas: ${falha}`);
  console.log(`   📈 Total: ${result.rows.length}`);

  // Verificar status atualizado
  const paymentIds = result.rows.map(r => r.payment_id);
  const updatedPags = await pool.query(`
    SELECT p.status, p.pago_em, p.pedido_id, o.pedido_id as display_id, o.status as pedido_status
    FROM pagamentos p JOIN pedidos o ON o.id = p.pedido_id
    WHERE p.payment_id = ANY($1::varchar[])
  `, [paymentIds]);

  console.log(`\n📋 Status atualizado dos pagamentos:`);
  updatedPags.rows.forEach(p => {
    console.log(`   Pedido #${p.display_id} | Pag: ${p.status}${p.pago_em ? ' em ' + new Date(p.pago_em).toLocaleString('pt-BR') : ''} | Ped: ${p.pedido_status}`);
  });

  await pool.end();
}

main().catch(e => {
  console.error('Erro fatal:', e.message);
  process.exit(1);
});
