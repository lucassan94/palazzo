// Testar Refund com autorização SMS
// Primeiro verifica status, depois tenta refund

import 'dotenv/config';

const API_KEY = process.env.ASAAS_API_KEY;
const BASE = 'https://api-sandbox.asaas.com';
const headers = { 'access_token': API_KEY, 'Content-Type': 'application/json' };

async function main() {
  // 1. Listar pagamentos RECEIVED
  console.log('=== BUSCANDO PAGAMENTOS RECEIVED ===');
  const list = await (await fetch(`${BASE}/v3/payments?status=RECEIVED&limit=5`, { headers })).json();
  
  if (!list.data || list.data.length === 0) {
    console.log('Nenhum pagamento RECEIVED encontrado.');
    console.log('Listando últimos 5 pagamentos:');
    const all = await (await fetch(`${BASE}/v3/payments?limit=5`, { headers })).json();
    all.data?.forEach(p => console.log(`  ${p.id} | ${p.status} | R$ ${p.value}`));
    return;
  }

  const pay = list.data[0];
  console.log(`Testando refund em: ${pay.id} | Status: ${pay.status} | Valor: R$ ${pay.value}`);
  console.log('');

  // 2. Tentar refund PARCIAL (R$ 1,00)
  console.log('=== TENTANDO REFUND PARCIAL (R$ 1,00) ===');
  const refundRes = await fetch(`${BASE}/v3/payments/${pay.id}/refund`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ value: 1.00 }),
  });
  
  const data = await refundRes.json();
  console.log(`HTTP ${refundRes.status}`);
  console.log(JSON.stringify(data, null, 2));
  
  if (data.errors) {
    console.log('');
    console.log('=== DETALHES DO ERRO ===');
    data.errors.forEach(e => {
      console.log(`Código: ${e.code}`);
      console.log(`Descrição: ${e.description}`);
    });
  }

  // 3. Verificar se tem campo de authorization
  if (data.authorization || data.authorizationId) {
    console.log('');
    console.log('=== AUTHORIZATION DETECTADA! ===');
    console.log(`Authorization ID: ${data.authorization || data.authorizationId}`);
    console.log('O Asaas requer código de autorização!');
  }
}

main().catch(e => console.error('ERRO:', e));
