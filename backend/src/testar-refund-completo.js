// ============================================================
// TESTE: Fluxo completo de estorno Asaas via API do backend
// ============================================================
// 1. Login como cliente
// 2. Criar pagamento PIX
// 3. Simular pagamento (PAYMENT_RECEIVED)
// 4. Login como admin
// 5. Recusar pedido (deve chamar refundPayment no Asaas)
// 6. Verificar se o estorno foi processado
// ============================================================
// Uso: node src/testar-refund-completo.js
// Pré-requisito: backend rodando em localhost:3001
// ============================================================

const BASE = 'http://localhost:3001/api';

const ADMIN_EMAIL = 'admin@saborexpress.com';
const ADMIN_PASS = 'admin123';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { console.log(`  ✅ ${msg}`); passed++; }
  else { console.log(`  ❌ ${msg}`); failed++; }
}
function info(msg) { console.log(`  ℹ️  ${msg}`); }

async function api(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════');
  console.log('  🔄 TESTE: Fluxo Completo de Estorno Asaas');
  console.log('══════════════════════════════════════════════════');
  console.log('');

  // ─── 1. CRIAR CLIENTE DE TESTE ───
  console.log('─── 1. CRIAR/CONECTAR CLIENTE DE TESTE ───');
  const emailCliente = `teste-refund-${Date.now()}@teste.com`;

  let res = await api('POST', '/auth/cliente/signup', {
    nome: 'Teste Refund',
    sobrenome: 'E2E',
    email: emailCliente,
    telefone: '11988887777',
    password: 'teste1234',
  });

  if (!res.ok) {
    // Tenta login se já existir
    res = await api('POST', '/auth/cliente/login', {
      email: emailCliente,
      password: 'teste1234',
    });
  }

  assert(res.ok, `Login cliente (${res.status})`);
  const tokenCliente = res.data.token;
  info(`Cliente: ${emailCliente}`);
  console.log('');

  // ─── 2. CRIAR PAGAMENTO PIX ───
  console.log('─── 2. CRIAR PAGAMENTO PIX ───');
  res = await api('POST', '/pagamentos/criar', {
    tipo: 'PIX',
    cliente: { cpfCnpj: '52998224725', nome: 'Teste Refund E2E', telefone: '11988887777' },
    pedido: { endereco: 'Rua Teste', numero: '100', bairro: 'Centro', cep: '01310000', cidade: 'São Paulo', estado: 'SP' },
    subtotal: 15.00,
    valor_frete: 5.00,
    total: 20.00,
    itens: [{
      produto_id: 13,
      nome_produto: 'Produto Teste',
      quantidade: 1,
      preco_unitario: 15.00,
      extras: [],
      subtotal: 15.00,
    }],
  }, tokenCliente);

  assert(res.ok, `Pagamento PIX criado (${res.status})`);
  if (!res.ok) {
    info(JSON.stringify(res.data));
    process.exit(1);
  }

  const pedidoId = res.data.id;
  const paymentId = res.data.payment_id;
  info(`Pedido ID: ${pedidoId}`);
  info(`Payment ID: ${paymentId}`);
  info(`Status: ${res.data.status}`);
  console.log('');

  // ─── 3. SIMULAR PAGAMENTO ───
  console.log('─── 3. SIMULAR PAGAMENTO (PAYMENT_RECEIVED) ───');
  res = await api('POST', `/pagamentos/${pedidoId}/simular-pagamento`, {}, tokenCliente);
  assert(res.ok, `Simular pagamento (${res.status})`);
  info(JSON.stringify(res.data));
  console.log('');

  // ─── 4. LOGIN COMO ADMIN ───
  console.log('─── 4. LOGIN ADMIN ───');
  res = await api('POST', '/auth/restaurante/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
  });
  assert(res.ok, `Login admin (${res.status})`);
  const tokenAdmin = res.data.token;
  console.log('');

  // ─── 5. VERIFICAR STATUS DO PEDIDO ───
  console.log('─── 5. VERIFICAR STATUS ANTES DE RECUSAR ───');
  res = await api('GET', `/pedidos/${pedidoId}`, null, tokenAdmin);
  assert(res.ok, `Pedido encontrado`);
  info(`Status: ${res.data.status}`);
  info(`Método pagamento: ${res.data.metodo_pagamento}`);
  info(`Motivo cancelamento: ${res.data.motivo_cancelamento || '(nenhum)'}`);

  // Verificar na tabela pagamentos
  res = await api('GET', `/pagamentos/${pedidoId}/pix-qrcode`, null, tokenCliente);
  info(`Status pagamento: ${res.data?.status || 'N/A'}`);
  console.log('');

  // ─── 6. RECUSAR PEDIDO ───
  console.log('─── 6. RECUSAR PEDIDO (deve chamar refund Asaas) ───');
  console.log('  ⚠️  Observe os LOGS DO BACKEND para ver se o refund foi chamado!');
  console.log('');

  res = await api('PATCH', `/pedidos/${pedidoId}/status`, {
    status: 'recusado',
    motivo: 'Teste de estorno automático',
  }, tokenAdmin);

  assert(res.ok, `Recusar pedido (${res.status})`);
  if (res.ok) {
    info(`Novo status: ${res.data.status}`);
    info(`Motivo: ${res.data.motivo_cancelamento}`);
  } else {
    info(JSON.stringify(res.data));
  }
  console.log('');

  // ─── 7. VERIFICAR ESTORNO ───
  console.log('─── 7. VERIFICAR RESULTADO ───');
  console.log('');
  console.log('  🔍 Verifique AGORA no portal do Asaas Sandbox:');
  console.log(`     https://sandbox.asaas.com/cobrancas`);
  console.log(`     Payment ID: ${paymentId}`);
  console.log('');
  console.log('  O que DEVERIA ter acontecido:');
  console.log('  - ✅ Pedido recusado (status → recusado)');
  console.log('  - ✅ Asaas refund chamado (POST /v3/payments/{id}/refund)');
  console.log('  - ✅ Cobrança com status REFUND_IN_PROGRESS ou REFUNDED no Asaas');
  console.log('');
  console.log('  📋 Verifique os LOGS DO BACKEND para:');
  console.log('  - "[Asaas] ✅ Reembolso solicitado: payment ..." (sucesso)');
  console.log('  - OU "[Asaas] ❌ ERRO ao reembolsar payment ..." (com detalhes)');
  console.log('  - OU "[Asaas] Nenhum pagamento encontrado para pedido ..."');
  console.log('');

  // ─── RESUMO ───
  console.log('══════════════════════════════════════════════════');
  console.log('  📊 RESUMO');
  console.log('══════════════════════════════════════════════════');
  console.log(`  ✅ ${passed} verificações passaram`);
  console.log(`  ❌ ${failed} verificações falharam`);
  console.log('══════════════════════════════════════════════════');
  console.log('');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
