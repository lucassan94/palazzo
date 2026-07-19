// ============================================================
// DIAGNÓSTICO: Testar operações de estorno no Asaas Sandbox
// ============================================================
// Testa:
// 1. Criar um pagamento PIX
// 2. Tentar DELETAR o pagamento (DELETE /v3/payments/{id})
// 3. Criar OUTRO pagamento PIX
// 4. Simular recebimento (no Asaas isso é via portal, mas tentamos via API)
// 5. Tentar REEMBOLSAR (POST /v3/payments/{id}/refund)
// ============================================================
// Uso: node src/diagnostico-asaas.js
// ============================================================

import 'dotenv/config';

const API_KEY = process.env.ASAAS_API_KEY;
const BASE_URL = process.env.ASAAS_ENV === 'production'
  ? 'https://api.asaas.com'
  : 'https://api-sandbox.asaas.com';

let passed = 0;
let failed = 0;

function log(label, ok, details = '') {
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} ${details}`);
    failed++;
  }
}

function logInfo(msg) {
  console.log(`  ℹ️  ${msg}`);
}

async function callAsaas(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': API_KEY,
    },
  };
  if (body) options.body = JSON.stringify(body);

  const start = Date.now();
  const response = await fetch(url, options);
  const elapsed = Date.now() - start;
  const data = await response.json();

  return { status: response.status, ok: response.ok, data, elapsed };
}

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════');
  console.log('  🔍 DIAGNÓSTICO ASAAS — REFUND & DELETE');
  console.log('══════════════════════════════════════════════════');
  console.log('');
  console.log(`  Ambiente: ${process.env.ASAAS_ENV || 'sandbox'}`);
  console.log(`  API Key: ${API_KEY ? API_KEY.substring(0, 20) + '...' : '❌ NÃO CONFIGURADA!'}`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log('');

  if (!API_KEY) {
    console.log('  ❌ ASAAS_API_KEY não configurada no .env!');
    process.exit(1);
  }

  // ─── PASSO 1: Criar Customer ───
  console.log('─── 1. CRIAR CUSTOMER ───');
  const customerBody = {
    name: 'Cliente Diagnóstico',
    cpfCnpj: '52998224725',
    email: 'diagnostico@teste.com',
    externalReference: '999999',
    notificationDisabled: true,
  };
  const { data: customerData, ok: customerOk } = await callAsaas('POST', '/v3/customers', customerBody);
  log(customerOk, 'Customer criado', `(${customerData.id || 'erro'})`);
  if (!customerOk) {
    logInfo(JSON.stringify(customerData.errors || customerData));
  }
  const customerId = customerData.id;
  console.log('');

  // ─── PASSO 2: Criar Pagamento PIX ───
  console.log('─── 2. CRIAR PAGAMENTO PIX ───');
  const paymentBody = {
    customer: customerId,
    billingType: 'PIX',
    value: 5.00,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Teste diagnóstico - estorno',
    externalReference: '999999',
  };
  const { data: createData, ok: createOk } = await callAsaas('POST', '/v3/payments', paymentBody);
  log(createOk, 'Pagamento PIX criado', `(status: ${createData.status || 'N/A'})`);
  if (!createOk) {
    logInfo(JSON.stringify(createData.errors || createData));
    console.log('');
    console.log('─── RESUMO ───');
    console.log(`  ✅ Passaram: ${passed}`);
    console.log(`  ❌ Falharam: ${failed}`);
    process.exit(1);
  }
  const paymentId = createData.id;
  logInfo(`Payment ID: ${paymentId}`);
  logInfo(`Status inicial: ${createData.status}`);
  console.log('');

  // ─── PASSO 3: Verificar status do pagamento ───
  console.log('─── 3. VERIFICAR STATUS ───');
  const { data: getData } = await callAsaas('GET', `/v3/payments/${paymentId}`);
  logInfo(`Status atual: ${getData.status}`);
  log(getData.status === 'PENDING', 'Status está PENDING (esperado)');
  console.log('');

  // ─── PASSO 4: TENTAR DELETAR o pagamento PENDING ───
  console.log('─── 4. DELETAR PAGAMENTO (DELETE /v3/payments/${paymentId}) ───');
  const { status: deleteStatus, data: deleteData, ok: deleteOk } = await callAsaas('DELETE', `/v3/payments/${paymentId}`);
  log(deleteOk, `DELETE retornou status ${deleteStatus}`, deleteOk ? '' : JSON.stringify(deleteData.errors || deleteData));
  if (deleteOk) {
    logInfo('✅ DELETE funcionou! O sandbox aceita DELETE em PENDING.');
  } else {
    logInfo('❌ DELETE falhou. Motivo: ' + (deleteData.errors?.[0]?.description || JSON.stringify(deleteData)));
    logInfo('Isso explica porque o cancelamento não funciona!');
  }
  console.log('');

  // ─── PASSO 5: CRIAR OUTRO PIX PARA TESTAR REFUND ───
  console.log('─── 5. CRIAR SEGUNDO PIX (para testar REFUND) ───');
  const paymentBody2 = {
    customer: customerId,
    billingType: 'PIX',
    value: 10.00,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: 'Teste diagnóstico - refund',
    externalReference: '999999',
  };
  const { data: createData2, ok: createOk2 } = await callAsaas('POST', '/v3/payments', paymentBody2);
  log(createOk2, 'Segundo PIX criado', `(ID: ${createData2.id || 'erro'})`);
  if (!createOk2) {
    logInfo(JSON.stringify(createData2.errors || createData2));
  }
  const paymentId2 = createData2.id;
  console.log('');

  // ─── PASSO 6: Tentar REFUND em pagamento PENDING ───
  console.log('─── 6. TENTAR REEMBOLSO EM PAGAMENTO PENDING ───');
  console.log('  (Isso DEVE falhar - refund só funciona em RECEIVED/CONFIRMED)');
  const { data: refundPendingData } = await callAsaas('POST', `/v3/payments/${paymentId2}/refund`, {});
  log(!refundPendingData.errors || refundPendingData.errors?.[0]?.code === 'invalid_action',
     'Refund em PENDING rejeitado (esperado)',
     refundPendingData.errors?.[0]?.description || '');
  logInfo(`Resposta: ${JSON.stringify(refundPendingData.errors || refundPendingData)}`);
  console.log('');

  // ─── PASSO 7: Verificar no portal ───
  console.log('─── 7. COMO TESTAR O REFUND DE VERDADE ───');
  console.log('');
  console.log('  O refund só funciona em pagamentos RECEIVED ou CONFIRMED.');
  console.log('  Para testar:');
  console.log('  1. Acesse https://sandbox.asaas.com');
  console.log('  2. Vá em "Cobranças"');
  console.log('  3. Clique no pagamento PIX (valor R$ 10,00)');
  console.log('  4. Clique em "CONFIRMAR PAGAMENTO"');
  console.log('  5. O status muda para RECEIVED');
  console.log('  6. Rode este script NOVAMENTE com o ID do pagamento:');
  console.log(`     Payment ID: ${paymentId2}`);
  console.log('');
  console.log('  Depois de confirmar no portal, rode:');
  console.log(`  node src/diagnostico-asaas.js --refund ${paymentId2}`);
  console.log('');

  // ─── RESUMO ───
  console.log('══════════════════════════════════════════════════');
  console.log('  📊 RESUMO');
  console.log('══════════════════════════════════════════════════');
  console.log(`  ✅ Passaram: ${passed}`);
  console.log(`  ❌ Falharam: ${failed}`);
  console.log('══════════════════════════════════════════════════');
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

// Se passarem um payment_id como argumento, tenta refund direto
if (process.argv[2] === '--refund' && process.argv[3]) {
  const paymentId = process.argv[3];
  console.log('');
  console.log('══════════════════════════════════════════════════');
  console.log('  🔄 TENTANDO REFUND NO PAYMENT: ' + paymentId);
  console.log('══════════════════════════════════════════════════');
  console.log('');

  const response = await fetch(`${BASE_URL}/v3/payments/${paymentId}`, {
    headers: { 'access_token': API_KEY }
  });
  const payment = await response.json();
  console.log(`  Status atual: ${payment.status}`);
  console.log(`  Valor: ${payment.value}`);
  console.log('');

  if (payment.status === 'RECEIVED' || payment.status === 'CONFIRMED') {
    console.log('  Tentando refund...');
    const refundRes = await fetch(`${BASE_URL}/v3/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': API_KEY,
      },
      body: JSON.stringify({}),
    });
    const refundData = await refundRes.json();
    if (refundRes.ok) {
      console.log(`  ✅ REFUND SUCESSO! ID: ${refundData.id}`);
    } else {
      console.log(`  ❌ REFUND FALHOU: ${refundData.errors?.[0]?.description || JSON.stringify(refundData)}`);
    }
  } else {
    console.log(`  ❌ Status "${payment.status}" não permite refund.`);
    console.log('  Precisa ser RECEIVED ou CONFIRMED.');
  }
  console.log('');
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
