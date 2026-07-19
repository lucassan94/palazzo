// ============================================================================
// 🧪 TESTE E2E - RLS & Permissões por Cargo
// ============================================================================
// Testa que cada cargo (admin, gerente, chef, caixa, cliente, entregador,
// anônimo) tem acesso APENAS ao que deve ter, tanto via middleware authorize()
// quanto via RLS no banco de dados.
//
// Uso: node src/e2e-rls-test.js
// Pré-requisito: backend rodando em localhost:3001, seed executado
// ============================================================================

import http from 'http';

const API = 'http://localhost:3001/api';

// ─── Helpers ────────────────────────────────────────────────────

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const data = opts.body ? JSON.stringify(opts.body) : null;
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname,
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...opts.headers },
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try { resolve({ data: JSON.parse(body), status: res.statusCode }); }
        catch { resolve({ raw: body, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function login(email, password) {
  return fetch(API + '/auth/restaurante/login', {
    method: 'POST',
    body: { email, password },
  });
}

function loginCliente(email, password) {
  return fetch(API + '/auth/cliente/login', {
    method: 'POST',
    body: { email, password },
  });
}

let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  console.log(`\n📌 ${total}. ${name}`);
  return fn()
    .then(() => { passed++; })
    .catch((err) => { failed++; console.error(`   ❌ FALHOU: ${err.message}`); });
}

function assert(condition, msg) {
  if (!condition) { throw new Error(msg); }
  console.log(`   ✅ ${msg}`);
}

function assertStatus(res, expectedStatus, label) {
  if (res.status !== expectedStatus) {
    throw new Error(`${label}: Esperado status ${expectedStatus}, recebido ${res.status}. Body: ${JSON.stringify(res.data || res.raw).substring(0, 200)}`);
  }
  console.log(`   ✅ ${label}: ${res.status}`);
}

function assertForbidden(res, label) {
  if (res.status !== 403 && res.status !== 401) {
    throw new Error(`${label}: Esperado 403/401, recebido ${res.status}`);
  }
  console.log(`   ✅ ${label}: ${res.status} (acesso negado)`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('  🧪 TESTE E2E - RLS & Permissões por Cargo');
  console.log('  SaborExpress - Palazzo Mooca');
  console.log('='.repeat(60));

  // ────────────────────────────────────────────────────────────
  // 0. SETUP: Criar usuários de teste se não existirem
  // ────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('  🔧 SETUP: Verificar/criar usuários de teste');
  console.log('─'.repeat(60));

  let adminToken, gerenteToken, chefToken, caixaToken;
  let adminCargo, gerenteCargo, chefCargo, caixaCargo;

  // Login admin (deve existir do seed)
  await test('SETUP - Login Admin', async () => {
    const res = await login('admin@saborexpress.com', 'admin123');
    assertStatus(res, 200, 'Login admin');
    assert(res.data?.user?.cargo === 'admin', `Cargo: ${res.data?.user?.cargo}`);
    adminToken = res.data?.token;
    adminCargo = res.data?.user?.cargo;
  });

  // Tentar login como gerente
  await test('SETUP - Login Gerente (ou criar)', async () => {
    const res = await login('gerente@saborexpress.com', 'gerente123');
    if (res.status === 200) {
      gerenteToken = res.data?.token;
      gerenteCargo = res.data?.user?.cargo;
      console.log(`   ℹ️  Gerente já existia: ${res.data?.user?.nome}`);
    } else {
      // Criar gerente
      console.log('   ℹ️  Gerente não existe, criando...');
      const create = await fetch(API + '/restaurante/equipe', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + adminToken },
        body: { nome: 'Gerente Teste', email: 'gerente@saborexpress.com', password: 'gerente123', cargo: 'gerente' },
      });
      assertStatus(create, 201, 'Criar gerente');
      const loginRes = await login('gerente@saborexpress.com', 'gerente123');
      assertStatus(loginRes, 200, 'Login gerente');
      gerenteToken = loginRes.data?.token;
      gerenteCargo = loginRes.data?.user?.cargo;
    }
    assert(gerenteCargo === 'gerente', `Cargo: ${gerenteCargo}`);
  });

  // Tentar login como chef
  await test('SETUP - Login Chef (ou criar)', async () => {
    const res = await login('chef@saborexpress.com', 'chef123');
    if (res.status === 200) {
      chefToken = res.data?.token;
      chefCargo = res.data?.user?.cargo;
      console.log(`   ℹ️  Chef já existia: ${res.data?.user?.nome}`);
    } else {
      console.log('   ℹ️  Chef não existe, criando...');
      const create = await fetch(API + '/restaurante/equipe', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + adminToken },
        body: { nome: 'Chef Teste', email: 'chef@saborexpress.com', password: 'chef123', cargo: 'chef' },
      });
      assertStatus(create, 201, 'Criar chef');
      const loginRes = await login('chef@saborexpress.com', 'chef123');
      assertStatus(loginRes, 200, 'Login chef');
      chefToken = loginRes.data?.token;
      chefCargo = loginRes.data?.user?.cargo;
    }
    assert(chefCargo === 'chef', `Cargo: ${chefCargo}`);
  });

  // Tentar login como caixa
  await test('SETUP - Login Caixa (ou criar)', async () => {
    const res = await login('caixa@saborexpress.com', 'caixa123');
    if (res.status === 200) {
      caixaToken = res.data?.token;
      caixaCargo = res.data?.user?.cargo;
      console.log(`   ℹ️  Caixa já existia: ${res.data?.user?.nome}`);
    } else {
      console.log('   ℹ️  Caixa não existe, criando...');
      const create = await fetch(API + '/restaurante/equipe', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + adminToken },
        body: { nome: 'Caixa Teste', email: 'caixa@saborexpress.com', password: 'caixa123', cargo: 'caixa' },
      });
      assertStatus(create, 201, 'Criar caixa');
      const loginRes = await login('caixa@saborexpress.com', 'caixa123');
      assertStatus(loginRes, 200, 'Login caixa');
      caixaToken = loginRes.data?.token;
      caixaCargo = loginRes.data?.user?.cargo;
    }
    assert(caixaCargo === 'caixa', `Cargo: ${caixaCargo}`);
  });

  // Criar entregador de teste
  let entregadorToken, entregadorId;
  await test('SETUP - Criar entregador de teste', async () => {
    const email = 'entregador.rls@teste.com';
    const create = await fetch(API + '/entregadores', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + adminToken },
      body: { nome: 'Entregador RLS', email, password: 'entregador123' },
    });
    if (create.status === 201 || create.status === 200) {
      entregadorId = create.data?.id;
      console.log(`   ℹ️  Entregador criado: ${create.data?.nome} (ID: ${entregadorId})`);
    } else if (create.status === 409) {
      console.log('   ℹ️  Entregador já existe, buscando...');
      // Login direto
    }
    const loginRes = await fetch(API + '/auth/entregador/login', {
      method: 'POST',
      body: { email, password: 'entregador123' },
    });
    assertStatus(loginRes, 200, 'Login entregador');
    entregadorToken = loginRes.data?.token;
    entregadorId = loginRes.data?.user?.id;
  });

  // Criar um pedido de teste
  let pedidoId, outroPedidoId, produtoId;
  await test('SETUP - Criar pedido de teste', async () => {
    // Buscar produtos
    const prods = await fetch(API + '/produtos/com-extras');
    assertStatus(prods, 200, 'Buscar produtos');
    assert(prods.data?.length > 0, 'Produtos encontrados');
    produtoId = prods.data[0].id;
    const preco = parseFloat(prods.data[0].preco);

    // Login cliente
    const cliRes = await loginCliente('maria@email.com', 'cliente123');
    assertStatus(cliRes, 200, 'Login cliente');

    // Criar pedido
    const pedido = await fetch(API + '/pedidos', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + cliRes.data?.token },
      body: {
        cliente_id: cliRes.data?.user?.id,
        nome_cliente: 'Maria Silva',
        telefone_cliente: '(11) 99999-8888',
        endereco_cliente: 'Av. Paulista, 1000',
        numero_cliente: '1000',
        bairro_cliente: 'Bela Vista',
        cep_cliente: '01310-100',
        cidade_cliente: 'São Paulo',
        estado_cliente: 'SP',
        subtotal: preco,
        valor_frete: 7.0,
        total: preco + 7,
        metodo_pagamento: 'credito',
        detalhes_pagamento: '',
        observacoes: 'Teste RLS',
        itens: [{ produto_id: prods.data[0].id, nome_produto: prods.data[0].nome, quantidade: 1, preco_unitario: preco, extras: [], subtotal: preco }],
      },
    });
    assertStatus(pedido, 201, 'Criar pedido');
    pedidoId = pedido.data?.id;
    assert(!!pedidoId, `Pedido ID: ${pedidoId}`);
  });

  // ────────────────────────────────────────────────────────────
  // 1. TESTES: ANÔNIMO (sem token)
  // ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  1️⃣  ANÔNIMO (sem token)');
  console.log('='.repeat(60));

  await test('Anônimo: ver cardápio público', async () => {
    const res = await fetch(API + '/produtos');
    assertStatus(res, 200, 'GET /produtos');
    assert(Array.isArray(res.data), 'Array de produtos');
  });

  await test('Anônimo: ver cardápio com extras', async () => {
    const res = await fetch(API + '/produtos/com-extras');
    assertStatus(res, 200, 'GET /produtos/com-extras');
    assert(Array.isArray(res.data), 'Array de produtos');
  });

  await test('Anônimo: ver dados do restaurante', async () => {
    const res = await fetch(API + '/restaurante');
    assertStatus(res, 200, 'GET /restaurante');
    assert(!!res.data?.nome, 'Nome do restaurante');
  });

  await test('Anônimo: calcular frete', async () => {
    const res = await fetch(API + '/pedidos/calcular-frete', {
      method: 'POST',
      body: {},
    });
    assertStatus(res, 200, 'POST /pedidos/calcular-frete');
  });

  await test('Anônimo: NÃO pode ver pedidos', async () => {
    const res = await fetch(API + '/pedidos');
    assertForbidden(res, 'GET /pedidos');
  });

  await test('Anônimo: NÃO pode ver clientes', async () => {
    const res = await fetch(API + '/clientes');
    assertForbidden(res, 'GET /clientes');
  });

  // ────────────────────────────────────────────────────────────
  // 2. TESTES: ADMIN (acesso total)
  // ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  2️⃣  ADMIN (admin@saborexpress.com)');
  console.log('='.repeat(60));

  await test('Admin: ver pedidos', async () => {
    const res = await fetch(API + '/pedidos', { headers: { Authorization: 'Bearer ' + adminToken } });
    assertStatus(res, 200, 'GET /pedidos');
    assert(Array.isArray(res.data), 'Array de pedidos');
  });

  await test('Admin: ver clientes', async () => {
    const res = await fetch(API + '/clientes', { headers: { Authorization: 'Bearer ' + adminToken } });
    assertStatus(res, 200, 'GET /clientes');
  });

  await test('Admin: ver entregadores', async () => {
    const res = await fetch(API + '/entregadores', { headers: { Authorization: 'Bearer ' + adminToken } });
    assertStatus(res, 200, 'GET /entregadores');
  });

  await test('Admin: ver dashboard completo', async () => {
    const res = await fetch(API + '/dashboard', { headers: { Authorization: 'Bearer ' + adminToken } });
    assertStatus(res, 200, 'GET /dashboard');
  });

  await test('Admin: ver relatório entregas', async () => {
    const res = await fetch(API + '/entregadores/relatorio', { headers: { Authorization: 'Bearer ' + adminToken } });
    assertStatus(res, 200, 'GET /entregadores/relatorio');
  });

  await test('Admin: ver equipe', async () => {
    const res = await fetch(API + '/restaurante/equipe', { headers: { Authorization: 'Bearer ' + adminToken } });
    assertStatus(res, 200, 'GET /restaurante/equipe');
  });

  await test('Admin: criar produto', async () => {
    const res = await fetch(API + '/produtos', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + adminToken },
      body: { nome: 'Produto Admin Test', preco: 10.00, descricao: 'Teste' },
    });
    assertStatus(res, 201, 'POST /produtos');
    // Limpar: deletar produto criado
    if (res.data?.id) {
      await fetch(API + '/produtos/' + res.data.id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + adminToken },
      });
    }
  });

  // ────────────────────────────────────────────────────────────
  // 3. TESTES: GERENTE (quase total, sem segurança)
  // ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  3️⃣  GERENTE (gerente@saborexpress.com)');
  console.log('='.repeat(60));

  await test('Gerente: ver pedidos', async () => {
    const res = await fetch(API + '/pedidos', { headers: { Authorization: 'Bearer ' + gerenteToken } });
    assertStatus(res, 200, 'GET /pedidos');
  });

  await test('Gerente: ver clientes', async () => {
    const res = await fetch(API + '/clientes', { headers: { Authorization: 'Bearer ' + gerenteToken } });
    assertStatus(res, 200, 'GET /clientes');
  });

  await test('Gerente: ver entregadores', async () => {
    const res = await fetch(API + '/entregadores', { headers: { Authorization: 'Bearer ' + gerenteToken } });
    assertStatus(res, 200, 'GET /entregadores');
  });

  await test('Gerente: ver dashboard completo', async () => {
    const res = await fetch(API + '/dashboard', { headers: { Authorization: 'Bearer ' + gerenteToken } });
    assertStatus(res, 200, 'GET /dashboard');
  });

  await test('Gerente: gerenciar equipe (criar usuário)', async () => {
    const email = 'temp' + Date.now() + '@teste.com';
    const res = await fetch(API + '/restaurante/equipe', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + gerenteToken },
      body: { nome: 'Temp', email, password: 'temp1234', cargo: 'caixa' },
    });
    assertStatus(res, 201, 'POST /restaurante/equipe (criar)');
    // Limpar
    if (res.data?.id) {
      await fetch(API + '/restaurante/equipe/' + res.data.id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + adminToken },
      });
    }
  });

  await test('Gerente: NÃO pode acessar segurança', async () => {
    const res = await fetch(API + '/restaurante/seguranca', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + gerenteToken },
      body: { email: 'gerente@saborexpress.com' },
    });
    assertForbidden(res, 'PUT /restaurante/seguranca');
  });

  // ────────────────────────────────────────────────────────────
  // 4. TESTES: CHEF (cozinha)
  // ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  4️⃣  CHEF (chef@saborexpress.com)');
  console.log('='.repeat(60));

  await test('Chef: ver pedidos', async () => {
    const res = await fetch(API + '/pedidos', { headers: { Authorization: 'Bearer ' + chefToken } });
    assertStatus(res, 200, 'GET /pedidos');
  });

  await test('Chef: criar produto', async () => {
    const res = await fetch(API + '/produtos', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + chefToken },
      body: { nome: 'Prato do Chef Test', preco: 25.00, descricao: 'Criação do chef' },
    });
    assertStatus(res, 201, 'POST /produtos');
    // Limpar
    if (res.data?.id) {
      await fetch(API + '/produtos/' + res.data.id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + adminToken },
      });
    }
  });

  await test('Chef: aceitar pedido (pendente→preparando)', async () => {
    const res = await fetch(API + '/pedidos/' + pedidoId + '/status', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + chefToken },
      body: { status: 'preparando' },
    });
    assertStatus(res, 200, 'PATCH status preparando');
  });

  await test('Chef: marcar pedido como pronto (preparando→pronto_entrega)', async () => {
    const res = await fetch(API + '/pedidos/' + pedidoId + '/status', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + chefToken },
      body: { status: 'pronto_entrega' },
    });
    assertStatus(res, 200, 'PATCH status pronto_entrega');
  });

  await test('Chef: enviar mensagem ao cliente', async () => {
    const res = await fetch(API + '/restaurante/mensagens', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + chefToken },
      body: { pedido_id: pedidoId, mensagem: 'Pedido pronto!' },
    });
    assertStatus(res, 201, 'POST /restaurante/mensagens');
  });

  await test('Chef: NÃO pode ver clientes', async () => {
    const res = await fetch(API + '/clientes', { headers: { Authorization: 'Bearer ' + chefToken } });
    assertForbidden(res, 'GET /clientes');
  });

  await test('Chef: NÃO pode ver entregadores', async () => {
    const res = await fetch(API + '/entregadores', { headers: { Authorization: 'Bearer ' + chefToken } });
    assertForbidden(res, 'GET /entregadores');
  });

  await test('Chef: NÃO pode ver dashboard', async () => {
    const res = await fetch(API + '/dashboard', { headers: { Authorization: 'Bearer ' + chefToken } });
    assertForbidden(res, 'GET /dashboard');
  });

  await test('Chef: NÃO pode ver equipe', async () => {
    const res = await fetch(API + '/restaurante/equipe', { headers: { Authorization: 'Bearer ' + chefToken } });
    assertForbidden(res, 'GET /restaurante/equipe');
  });

  // ────────────────────────────────────────────────────────────
  // 5. TESTES: CAIXA (atendimento)
  // ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  5️⃣  CAIXA (caixa@saborexpress.com)');
  console.log('='.repeat(60));

  // Criar um pedido novo para testar cancelamento pelo caixa
  let pedidoParaCancelar;
  await test('SETUP: Criar pedido para cancelamento (caixa)', async () => {
    const prods = await fetch(API + '/produtos/com-extras');
    const preco = parseFloat(prods.data[0].preco);
    const cliRes = await loginCliente('maria@email.com', 'cliente123');
    const pedido = await fetch(API + '/pedidos', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + cliRes.data?.token },
      body: {
        cliente_id: cliRes.data?.user?.id,
        nome_cliente: 'Maria Silva',
        telefone_cliente: '(11) 99999-8888',
        endereco_cliente: 'Av. Paulista, 1000',
        numero_cliente: '1000',
        bairro_cliente: 'Bela Vista',
        cep_cliente: '01310-100',
        cidade_cliente: 'São Paulo',
        estado_cliente: 'SP',
        subtotal: preco,
        valor_frete: 7.0,
        total: preco + 7,
        metodo_pagamento: 'credito',
        detalhes_pagamento: '',
        observacoes: 'Para cancelar',
        itens: [{ produto_id: prods.data[0].id, nome_produto: prods.data[0].nome, quantidade: 1, preco_unitario: preco, extras: [], subtotal: preco }],
      },
    });
    assertStatus(pedido, 201, 'Pedido para cancelar criado');
    pedidoParaCancelar = pedido.data?.id;
  });

  await test('Caixa: ver pedidos', async () => {
    const res = await fetch(API + '/pedidos', { headers: { Authorization: 'Bearer ' + caixaToken } });
    assertStatus(res, 200, 'GET /pedidos');
  });

  await test('Caixa: ver clientes', async () => {
    const res = await fetch(API + '/clientes', { headers: { Authorization: 'Bearer ' + caixaToken } });
    assertStatus(res, 200, 'GET /clientes');
  });

  await test('Caixa: ver resumo do dia', async () => {
    const res = await fetch(API + '/dashboard/resumo-dia', { headers: { Authorization: 'Bearer ' + caixaToken } });
    assertStatus(res, 200, 'GET /dashboard/resumo-dia');
    assert(res.data?.pedidos_entregues !== undefined, 'Resumo tem pedidos_entregues');
    assert(res.data?.faturamento_estimado !== undefined, 'Resumo tem faturamento_estimado');
  });

  await test('Caixa: cancelar pedido pendente', async () => {
    const res = await fetch(API + '/pedidos/' + pedidoParaCancelar + '/status', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + caixaToken },
      body: { status: 'cancelado', motivo: 'Cliente desistiu' },
    });
    assertStatus(res, 200, 'PATCH status cancelado');
    assert(res.data?.status === 'cancelado', `Status: ${res.data?.status}`);
  });

  await test('Caixa: NÃO pode criar produto', async () => {
    const res = await fetch(API + '/produtos', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + caixaToken },
      body: { nome: 'Teste', preco: 10.00 },
    });
    assertForbidden(res, 'POST /produtos');
  });

  await test('Caixa: NÃO pode ver entregadores', async () => {
    const res = await fetch(API + '/entregadores', { headers: { Authorization: 'Bearer ' + caixaToken } });
    assertForbidden(res, 'GET /entregadores');
  });

  await test('Caixa: NÃO pode ver dashboard completo', async () => {
    const res = await fetch(API + '/dashboard', { headers: { Authorization: 'Bearer ' + caixaToken } });
    assertForbidden(res, 'GET /dashboard');
  });

  await test('Caixa: NÃO pode enviar mensagem', async () => {
    const res = await fetch(API + '/restaurante/mensagens', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + caixaToken },
      body: { pedido_id: 1, mensagem: 'teste' },
    });
    assertForbidden(res, 'POST /restaurante/mensagens');
  });

  // Criar pedido FRESCO (pendente) para testar que caixa NÃO pode aceitar
  let pedidoParaTestarAceite;
  await test('SETUP: Criar pedido para testar recusa de aceite (caixa)', async () => {
    const prods = await fetch(API + '/produtos/com-extras');
    const preco = parseFloat(prods.data[0].preco);
    const cliRes = await loginCliente('maria@email.com', 'cliente123');
    const p = await fetch(API + '/pedidos', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + cliRes.data?.token },
      body: {
        cliente_id: cliRes.data?.user?.id, nome_cliente: 'Maria', telefone_cliente: '(11) 99999-8888',
        endereco_cliente: 'Rua Teste, 123', numero_cliente: '123', bairro_cliente: 'Centro',
        cep_cliente: '01310-000', cidade_cliente: 'São Paulo', estado_cliente: 'SP',
        subtotal: preco, valor_frete: 7.0, total: preco + 7,
        metodo_pagamento: 'credito', detalhes_pagamento: '', observacoes: 'Teste recusa',
        itens: [{ produto_id: prods.data[0].id, nome_produto: prods.data[0].nome, quantidade: 1, preco_unitario: preco, extras: [], subtotal: preco }],
      },
    });
    assertStatus(p, 201, 'Pedido fresco criado');
    pedidoParaTestarAceite = p.data?.id;
  });

  await test('Caixa: NÃO pode aceitar pedido pendente', async () => {
    const res = await fetch(API + '/pedidos/' + pedidoParaTestarAceite + '/status', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + caixaToken },
      body: { status: 'preparando' },
    });
    // Caixa tem permissão de UPDATE via RLS (pedidos_caixa = FOR SELECT, UPDATE)
    // mas authorize() não permite 'caixa' no PATCH.
    // Ideal: 403 do middleware. Mínimo aceitável: 400.
    assert(res.status === 403 || res.status === 400,
      `Caixa NÃO deveria aceitar pedido: status ${res.status}, body: ${JSON.stringify(res.data).substring(0, 100)}`);
    console.log(`   ✅ Caixa não conseguiu aceitar pedido (status ${res.status})`);
  });

  // ────────────────────────────────────────────────────────────
  // 6. TESTES: CLIENTE
  // ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  6️⃣  CLIENTE (maria@email.com)');
  console.log('='.repeat(60));

  let clienteToken;
  await test('Cliente: login', async () => {
    const res = await loginCliente('maria@email.com', 'cliente123');
    assertStatus(res, 200, 'Login cliente');
    clienteToken = res.data?.token;
  });

  await test('Cliente: ver cardápio', async () => {
    const res = await fetch(API + '/produtos');
    assertStatus(res, 200, 'GET /produtos');
  });

  await test('Cliente: ver seus pedidos', async () => {
    const res = await fetch(API + '/pedidos', { headers: { Authorization: 'Bearer ' + clienteToken } });
    assertStatus(res, 200, 'GET /pedidos');
  });

  await test('Cliente: NÃO pode ver clientes (lista)', async () => {
    const res = await fetch(API + '/clientes', { headers: { Authorization: 'Bearer ' + clienteToken } });
    assertForbidden(res, 'GET /clientes');
  });

  await test('Cliente: NÃO pode ver entregadores', async () => {
    const res = await fetch(API + '/entregadores', { headers: { Authorization: 'Bearer ' + clienteToken } });
    assertForbidden(res, 'GET /entregadores');
  });

  await test('Cliente: NÃO pode ver dashboard', async () => {
    const res = await fetch(API + '/dashboard', { headers: { Authorization: 'Bearer ' + clienteToken } });
    assertForbidden(res, 'GET /dashboard');
  });

  // ────────────────────────────────────────────────────────────
  // 7. TESTES: ENTREGADOR
  // ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  7️⃣  ENTREGADOR');
  console.log('='.repeat(60));

  await test('Entregador: ver pedidos disponíveis', async () => {
    const res = await fetch(API + '/pedidos', { headers: { Authorization: 'Bearer ' + entregadorToken } });
    assertStatus(res, 200, 'GET /pedidos');
    // Verifica se vê pedido pronto_entrega sem entregador
    const temDisponivel = Array.isArray(res.data) && res.data.some(p =>
      p.status === 'pronto_entrega' && !p.entregador_id
    );
    assert(temDisponivel, 'Entregador vê pedidos disponíveis (pronto_entrega, sem entregador)');
  });

  await test('Entregador: NÃO pode ver clientes', async () => {
    const res = await fetch(API + '/clientes', { headers: { Authorization: 'Bearer ' + entregadorToken } });
    assertForbidden(res, 'GET /clientes');
  });

  await test('Entregador: NÃO pode ver dashboard', async () => {
    const res = await fetch(API + '/dashboard', { headers: { Authorization: 'Bearer ' + entregadorToken } });
    assertForbidden(res, 'GET /dashboard');
  });

  // ────────────────────────────────────────────────────────────
  // RESULTADO FINAL
  // ────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('  📊 RESULTADO FINAL');
  console.log('='.repeat(60));
  console.log(`  Total de testes: ${total}`);
  console.log(`  ✅ Passaram:      ${passed}`);
  console.log(`  ❌ Falharam:      ${failed}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n  ❌ ALGUNS TESTES FALHARAM!\n');
    process.exit(1);
  } else {
    console.log('\n  🎉 TODOS OS TESTES PASSARAM!\n');
  }
}

main().catch(err => {
  console.error('\n❌ TESTE FALHOU:', err.message);
  process.exit(1);
});
