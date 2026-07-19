// Testar Refund + verificar authorization details
import 'dotenv/config';

const API_KEY = process.env.ASAAS_API_KEY;
const BASE = 'https://api-sandbox.asaas.com';
const headers = { 'access_token': API_KEY, 'Content-Type': 'application/json' };

async function main() {
  // 1. Buscar pagamento RECEIVED
  console.log('=== BUSCANDO PAGAMENTO RECEIVED ===');
  const list = await (await fetch(`${BASE}/v3/payments?status=RECEIVED&limit=1`, { headers })).json();
  
  if (!list.data?.[0]) {
    console.log('Nenhum RECEIVED encontrado. Testando em pagamento existente...');
    const all = await (await fetch(`${BASE}/v3/payments?limit=3`, { headers })).json();
    all.data?.forEach(p => console.log(`  ${p.id} | ${p.status}`));
    return;
  }

  const pay = list.data[0];
  console.log(`Payment: ${pay.id} | Status: ${pay.status} | R$ ${pay.value}`);

  // 2. Tentar refund
  console.log('\n=== TENTANDO REFUND ===');
  const refundRes = await fetch(`${BASE}/v3/payments/${pay.id}/refund`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ value: 0.01 }),
  });
  
  const data = await refundRes.json();
  console.log(`HTTP ${refundRes.status}`);
  console.log('Resposta completa:', JSON.stringify(data, null, 2));

  // 3. Verificar o payment novamente pra ver refunds
  console.log('\n=== VERIFICANDO PAYMENT POS-REFUND ===');
  const updatedPay = await (await fetch(`${BASE}/v3/payments/${pay.id}`, { headers })).json();
  console.log('Status:', updatedPay.status);
  console.log('Refunds:', JSON.stringify(updatedPay.refunds, null, 2));
  console.log('Deleted:', updatedPay.deleted);
}

main().catch(e => console.error('ERRO:', e));
