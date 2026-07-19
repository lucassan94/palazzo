import http from 'http';

const API = 'http://localhost:3001/api';

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
        try { resolve(JSON.parse(body)); }
        catch { resolve({ raw: body, status: res.statusCode }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('='.repeat(55));
  console.log('  🧪 TESTE E2E - Fluxo Completo SaborExpress');
  console.log('='.repeat(55));

  // 1) Cliente login
  console.log('\n📌 1. LOGIN CLIENTE');
  const cli = await fetch(API + '/auth/cliente/login', {
    method: 'POST',
    body: { email: 'maria@email.com', password: 'cliente123' },
  });
  if (!cli.user) throw new Error('❌ Login cliente: ' + JSON.stringify(cli));
  console.log(`   ✅ Maria Silva logada (ID: ${cli.user.id})`);
  const cliToken = cli.token;

  // 2) Buscar produto
  console.log('\n📌 2. BUSCAR PRODUTO');
  const prods = await fetch(API + '/produtos/com-extras');
  if (!Array.isArray(prods) || prods.length === 0) throw new Error('❌ Sem produtos');
  const prod = prods[0];
  console.log(`   ✅ Produto: ${prod.nome} - R$ ${parseFloat(prod.preco).toFixed(2)}`);

  // 3) Criar pedido
  console.log('\n📌 3. CRIAR PEDIDO');
  const preco = parseFloat(prod.preco);
  const pedido = await fetch(API + '/pedidos', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cliToken },
    body: {
      cliente_id: cli.user.id,
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
      observacoes: 'Teste completo E2E - sem cebola',
      itens: [{
        produto_id: prod.id,
        nome_produto: prod.nome,
        quantidade: 1,
        preco_unitario: preco,
        extras: [],
        subtotal: preco,
      }],
    },
  });
  if (!pedido.id) throw new Error('❌ Criar pedido: ' + JSON.stringify(pedido));
  const pid = pedido.id;
  console.log(`   ✅ Pedido ${pedido.pedido_id} criado (ID: ${pid})`);
  console.log(`      Total: R$ ${parseFloat(pedido.total).toFixed(2)} | Status: ${pedido.status}`);

  // 4) Admin login
  console.log('\n📌 4. LOGIN ADMIN');
  const adm = await fetch(API + '/auth/restaurante/login', {
    method: 'POST',
    body: { email: 'admin@saborexpress.com', password: 'admin123' },
  });
  if (!adm.user) throw new Error('❌ Login admin: ' + JSON.stringify(adm));
  console.log(`   ✅ Admin logado (cargo: ${adm.user.cargo})`);
  const admToken = adm.token;

  // 5) Aceitar pedido
  console.log('\n📌 5. ACEITAR PEDIDO (pendente → preparando)');
  const aceito = await fetch(API + '/pedidos/' + pid + '/status', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + admToken },
    body: { status: 'preparando' },
  });
  if (aceito.error) throw new Error('❌ Aceitar: ' + aceito.error + ' ' + JSON.stringify(aceito));
  console.log(`   ✅ Status: ${aceito.status}`);

  // 6) Marcar como pronto
  console.log('\n📌 6. PRONTO PARA ENTREGA (preparando → pronto_entrega)');
  const pronto = await fetch(API + '/pedidos/' + pid + '/status', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + admToken },
    body: { status: 'pronto_entrega' },
  });
  if (pronto.error) throw new Error('❌ Pronto: ' + pronto.error);
  console.log(`   ✅ Status: ${pronto.status}`);

  // 7) Criar entregador
  console.log('\n📌 7. CRIAR ENTREGADOR');
  const entCriado = await fetch(API + '/entregadores', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + admToken },
    body: { nome: 'João Entregador', email: 'joao.e2e@teste.com', password: 'entregador123' },
  });
  if (entCriado.error) throw new Error('❌ Criar entregador: ' + entCriado.error);
  console.log(`   ✅ ${entCriado.nome} criado (ID: ${entCriado.id})`);

  // 8) Login entregador
  console.log('\n📌 8. LOGIN ENTREGADOR');
  const ent = await fetch(API + '/auth/entregador/login', {
    method: 'POST',
    body: { email: 'joao.e2e@teste.com', password: 'entregador123' },
  });
  if (!ent.user) throw new Error('❌ Login entregador: ' + JSON.stringify(ent));
  console.log(`   ✅ ${ent.user.nome} logado (ID: ${ent.user.id})`);
  const entToken = ent.token;

  // 9) Admin atribui entregador e inicia rota
  console.log('\n📌 9. ATRIBUIR ENTREGADOR (pronto_entrega → em_transito)');
  const rota = await fetch(API + '/pedidos/' + pid + '/status', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + admToken },
    body: { status: 'em_transito', entregador_id: ent.user.id },
  });
  if (rota.error) throw new Error('❌ Atribuir: ' + rota.error);
  console.log(`   ✅ Status: ${rota.status} (entregador: ${ent.user.nome})`);

  // 10) Entregador chega ao destino
  console.log('\n📌 10. CHEGOU AO DESTINO (em_transito → cheguei_destino)');
  const destino = await fetch(API + '/pedidos/' + pid + '/status', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + entToken },
    body: { status: 'cheguei_destino' },
  });
  if (destino.error) throw new Error('❌ Chegada: ' + destino.error);
  console.log(`   ✅ Status: ${destino.status}`);

  // 11) Confirmar entrega
  console.log('\n📌 11. CONFIRMAR ENTREGA (cheguei_destino → entregue)');
  const entregue = await fetch(API + '/pedidos/' + pid + '/status', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + entToken },
    body: { status: 'entregue' },
  });
  if (entregue.error) throw new Error('❌ Entrega: ' + entregue.error);
  console.log(`   ✅ Status: ${entregue.status}`);

  // 12) Verificar pedido final
  console.log('\n📌 12. VERIFICAR PEDIDO FINAL');
  const final = await fetch(API + '/pedidos/' + pid, {
    headers: { Authorization: 'Bearer ' + admToken },
  });

  console.log(`\n${'='.repeat(55)}`);
  console.log(`  📋 RESUMO DO PEDIDO`);
  console.log(`${'='.repeat(55)}`);
  console.log(`  ID:      ${final.pedido_id}`);
  console.log(`  Cliente: ${final.nome_cliente}`);
  console.log(`  Status:  ${final.status.toUpperCase()} 🎉`);
  console.log(`  Total:   R$ ${parseFloat(final.total).toFixed(2)}`);
  console.log(`  Pagamento: ${final.metodo_pagamento}`);
  console.log(`  Endereço: ${final.endereco_cliente}, ${final.numero_cliente} - ${final.bairro_cliente}`);
  console.log(`  Observações: ${final.observacoes || '—'}`);
  console.log(`  Frete: R$ ${parseFloat(final.valor_frete).toFixed(2)}`);
  console.log(`  Entregador: ${final.entregador_nome || '—'}`);

  if (final.itens && final.itens.length > 0) {
    console.log(`\n  🛒 ITENS:`);
    final.itens.forEach(i => {
      console.log(`     ${i.quantidade}x ${i.nome_produto} = R$ ${parseFloat(i.subtotal).toFixed(2)}`);
    });
  }

  if (final.timeline && final.timeline.length > 0) {
    console.log(`\n  📜 TIMELINE COMPLETA:`);
    final.timeline.forEach(t => {
      const time = new Date(t.mudado_em).toLocaleTimeString('pt-BR');
      const from = t.status_anterior || '—';
      const to = t.status_novo;
      const by = t.usuario_tipo;
      const icon = by === 'cliente' ? '👤' : by === 'restaurante' ? '👨‍🍳' : by === 'entregador' ? '🛵' : '🤖';
      console.log(`     ${time} ${icon} ${from} → ${to}`);
    });
  }

  console.log(`\n${'='.repeat(55)}`);
  console.log(`  ✅ FLUXO COMPLETO EXECUTADO COM SUCESSO!`);
  console.log('='.repeat(55));
}

main().catch(err => {
  console.error('\n❌ TESTE FALHOU:', err.message);
  process.exit(1);
});
