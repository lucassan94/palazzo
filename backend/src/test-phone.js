import { config } from './config/index.js';

const key = config.asaas.apiKey;
const base = config.asaas.baseUrl;

async function test(label, body) {
  const res = await fetch(base + '/v3/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'access_token': key },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`✅ ${label}`);
    return data;
  } else {
    console.log(`❌ ${label} -> ${data.errors?.[0]?.description}`);
    return null;
  }
}

async function main() {
  const ref = 'test_' + Date.now();

  // Testar sem phone
  await test('sem mobilePhone', {
    name: 'Test', cpfCnpj: '52998224725', email: 'a@b.com',
    externalReference: ref + '_a', notificationDisabled: true,
  });

  // Testar com phone vazio
  await test('mobilePhone vazio', {
    name: 'Test', cpfCnpj: '52998224725', email: 'b@b.com',
    mobilePhone: '', externalReference: ref + '_b', notificationDisabled: true,
  });

  // Testar com phone com DDI +55
  await test('mobilePhone +5511999999999', {
    name: 'Test', cpfCnpj: '52998224725', email: 'c@b.com',
    mobilePhone: '+5511999999999', externalReference: ref + '_c', notificationDisabled: true,
  });

  console.log('\n--- Testando com customer_id existente (sem criar novo) ---');
  // Listar customers existentes
  const list = await fetch(base + '/v3/customers?limit=1', {
    headers: { 'access_token': key }
  });
  const listData = await list.json();
  if (listData.data?.length > 0) {
    console.log(`Customer existente: ${listData.data[0].id} - ${listData.data[0].name}`);
    console.log(`Phone: ${listData.data[0].mobilePhone}`);
  } else {
    console.log('Nenhum customer encontrado');
  }
}

main().catch(console.error);
