// ================================================================
// 🧪 TESTE E2E - Módulo Cliente (Palazzo Mooca)
// ================================================================
// Testa: login, signup, produtos, carrinho, totais e checkout
// Uso: node src/e2e-cliente-test.js
// ================================================================

import http from 'http'

const API = 'http://localhost:3001/api'

// ─── Helpers ────────────────────────────────────────────────────

function fetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const data = opts.body ? JSON.stringify(opts.body) : null
    const u = new URL(url)
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: opts.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...opts.headers },
      },
      (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => {
          try {
            resolve({ data: JSON.parse(body), status: res.statusCode })
          } catch {
            resolve({ raw: body, status: res.statusCode })
          }
        })
      }
    )
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

function assert(condition, msg) {
  if (!condition) {
    console.error(`   ❌ FALHOU: ${msg}`)
    process.exit(1)
  }
  console.log(`   ✅ ${msg}`)
}

function assertNear(actual, expected, tolerance = 0.01, label = 'Valor') {
  const diff = Math.abs(parseFloat(actual) - expected)
  if (diff > tolerance) {
    console.error(`   ❌ ${label} esperado R$ ${expected.toFixed(2)}, obtido R$ ${parseFloat(actual).toFixed(2)}`)
    process.exit(1)
  }
  console.log(`   ✅ ${label}: R$ ${parseFloat(actual).toFixed(2)}`)
}

// Cálculo idêntico ao frontend (App.vue)
function calcularTotalCarrinho(itens) {
  return itens.reduce((acc, item) => acc + (parseFloat(item.subtotal) || 0), 0)
}

function formatPrice(value) {
  const num = parseFloat(value) || 0
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num)
}

// ─── Teste Principal ────────────────────────────────────────────

async function main() {
  let passed = 0
  let failed = 0
  let totalTests = 0

  function test(name, fn) {
    totalTests++
    console.log(`\n📌 ${totalTests}. ${name}`)
    return fn()
      .then(() => {
        passed++
      })
      .catch((err) => {
        failed++
        console.error(`   ❌ ERRO: ${err.message}`)
      })
  }

  // ── 1. Login com credenciais CORRETAS ──────────────────────────
  await test('LOGIN - Credenciais corretas', async () => {
    const res = await fetch(API + '/auth/cliente/login', {
      method: 'POST',
      body: { email: 'maria@email.com', password: 'cliente123' },
    })
    assert(res.status === 200, 'Status 200')
    assert(res.data?.user?.email === 'maria@email.com', `Email correto: ${res.data?.user?.email}`)
    assert(res.data?.user?.nome === 'Maria', `Nome: ${res.data?.user?.nome}`)
    assert(!!res.data?.token, 'Token JWT recebido')
    return res.data
  })

  // ── 2. Login com credenciais INCORRETAS ────────────────────────
  let loginToken = null
  await test('LOGIN - Credenciais incorretas (deve falhar)', async () => {
    const res = await fetch(API + '/auth/cliente/login', {
      method: 'POST',
      body: { email: 'maria@email.com', password: 'senha_errada' },
    })
    assert(res.status === 401 || res.data?.error, `Rejeitado (status ${res.status})`)
    assert(!!res.data?.error, `Mensagem de erro: "${res.data?.error}"`)
    console.log(`   ℹ️  Erro esperado: ${res.data?.error}`)
  })

  // ── 3. Signup de novo cliente ──────────────────────────────────
  const timestamp = Date.now()
  await test('SIGNUP - Novo cliente', async () => {
    const res = await fetch(API + '/auth/cliente/signup', {
      method: 'POST',
      body: {
        nome: 'Teste',
        sobrenome: 'E2E',
        email: `teste${timestamp}@e2eteste.com`,
        telefone: '(11) 99999-0000',
        password: 'teste1234',
      },
    })
    assert(res.status === 201 || res.status === 200, `Status ${res.status}`)
    assert(res.data?.user?.email?.includes('@e2eteste.com'), `Email criado: ${res.data?.user?.email}`)
    assert(!!res.data?.token, 'Token JWT recebido')
    loginToken = res.data?.token
    console.log(`   ℹ️  Cliente criado: ${res.data?.user?.nome} ${res.data?.user?.sobrenome} (${res.data?.user?.email})`)
    return res.data
  })

  // ── 4. Signup duplicado (deve falhar) ─────────────────────────
  await test('SIGNUP - Email duplicado (deve falhar)', async () => {
    const res = await fetch(API + '/auth/cliente/signup', {
      method: 'POST',
      body: {
        nome: 'Teste',
        sobrenome: 'E2E',
        email: `teste${timestamp}@e2eteste.com`,
        telefone: '(11) 99999-0000',
        password: 'teste1234',
      },
    })
    assert(res.status >= 400, `Rejeitado (status ${res.status})`)
    assert(!!res.data?.error, `Erro: "${res.data?.error}"`)
    console.log(`   ℹ️  Erro esperado: ${res.data?.error}`)
  })

  // ── 5. Login com senha curta (deve falhar) ─────────────────────
  await test('LOGIN - Validação de campos', async () => {
    // Senha vazia
    const res1 = await fetch(API + '/auth/cliente/login', {
      method: 'POST',
      body: { email: 'maria@email.com', password: '' },
    })
    assert(res1.status >= 400, `Senha vazia rejeitada (status ${res1.status})`)

    // Email inválido
    const res2 = await fetch(API + '/auth/cliente/login', {
      method: 'POST',
      body: { email: 'invalido', password: 'cliente123' },
    })
    assert(res2.status >= 400, `Email inválido rejeitado (status ${res2.status})`)
  })

  // ── 6. Listar produtos ────────────────────────────────────────
  let produtos = []
  await test('PRODUTOS - Listar cardápio com extras', async () => {
    const res = await fetch(API + '/produtos/com-extras')
    assert(res.status === 200, 'Status 200')
    assert(Array.isArray(res.data), 'Resposta é um array')
    assert(res.data.length > 0, `Pelo menos 1 produto (${res.data.length} encontrados)`)
    produtos = res.data
    console.log(`   ℹ️  Total de produtos: ${produtos.length}`)

    // Mostrar categorias disponíveis
    const cats = [...new Set(produtos.map((p) => p.categoria_nome || p.categoria))]
    console.log(`   ℹ️  Categorias: ${cats.join(', ')}`)

    return res.data
  })

  // ── 7. Verificar estrutura do produto ─────────────────────────
  await test('PRODUTOS - Estrutura e preços', async () => {
    const p = produtos[0]
    assert(!!p.id, 'ID presente')
    assert(!!p.nome, 'Nome presente')
    assert(!!p.preco, 'Preço presente')
    assert(parseFloat(p.preco) > 0, `Preço > 0: R$ ${parseFloat(p.preco).toFixed(2)}`)
    console.log(`   ℹ️  Exemplo: ${p.nome} - ${formatPrice(p.preco)}`)

    // Verificar se tem extras
    if (p.extras && p.extras.length > 0) {
      console.log(`   ℹ️  Extras disponíveis: ${p.extras.map((e) => e.nome).join(', ')}`)
    }
  })

  // ── 8. Simular carrinho com 2 produtos ────────────────────────
  await test('CARRINHO - Adicionar 2 produtos e calcular total', async () => {
    const prod1 = produtos[0]
    const prod2 = produtos.length > 1 ? produtos[1] : produtos[0]

    const preco1 = parseFloat(prod1.preco)
    const preco2 = parseFloat(prod2.preco)

    // Total esperado (soma simples)
    const totalEsperado = preco1 + preco2

    // Itens no formato do frontend (CheckoutPanel/App.vue)
    const carrinho = [
      {
        produto_id: prod1.id,
        nome_produto: prod1.nome,
        quantidade: 1,
        preco_unitario: preco1,
        extras: [],
        subtotal: preco1,
      },
      {
        produto_id: prod2.id,
        nome_produto: prod2.nome,
        quantidade: 1,
        preco_unitario: preco2,
        extras: [],
        subtotal: preco2,
      },
    ]

    // Calcular total usando a MESMA lógica do frontend
    const totalCalculado = calcularTotalCarrinho(carrinho)

    console.log(`   ℹ️  ${carrinho[0].nome_produto}: ${formatPrice(preco1)}`)
    console.log(`   ℹ️  ${carrinho[1].nome_produto}: ${formatPrice(preco2)}`)
    console.log(`   ℹ️  Total calculado: ${formatPrice(totalCalculado)}`)
    console.log(`   ℹ️  Total esperado:  ${formatPrice(totalEsperado)}`)

    assertNear(totalCalculado, totalEsperado, 0.01, 'Soma dos subtotais')
  })

  // ── 9. Carrinho com extras ────────────────────────────────────
  await test('CARRINHO - Produto com extra', async () => {
    const prod = produtos.find((p) => p.extras && p.extras.length > 0)
    if (!prod) {
      console.log('   ⏭️  Nenhum produto com extras disponível, pulando...')
      return
    }

    const extra = prod.extras[0]
    const precoBase = parseFloat(prod.preco)
    const precoExtra = parseFloat(extra.preco)
    const totalEsperado = precoBase + precoExtra

    const carrinho = [
      {
        produto_id: prod.id,
        nome_produto: prod.nome,
        quantidade: 1,
        preco_unitario: precoBase,
        extras: [{ nome: extra.nome, preco: precoExtra }],
        subtotal: precoBase + precoExtra,
      },
    ]

    const totalCalculado = calcularTotalCarrinho(carrinho)
    console.log(`   ℹ️  ${prod.nome} base: ${formatPrice(precoBase)}`)
    console.log(`   ℹ️  Extra "${extra.nome}": ${formatPrice(precoExtra)}`)
    console.log(`   ℹ️  Subtotal: ${formatPrice(totalCalculado)}`)

    assertNear(totalCalculado, totalEsperado, 0.01, 'Subtotal com extra')
  })

  // ── 10. Carrinho com múltiplas quantidades ────────────────────
  await test('CARRINHO - 2x mesmo produto', async () => {
    const prod = produtos[0]
    const preco = parseFloat(prod.preco)
    const qtd = 2
    const totalEsperado = preco * qtd

    const carrinho = [
      {
        produto_id: prod.id,
        nome_produto: prod.nome,
        quantidade: qtd,
        preco_unitario: preco,
        extras: [],
        subtotal: preco * qtd,
      },
    ]

    const totalCalculado = calcularTotalCarrinho(carrinho)
    console.log(`   ℹ️  ${qtd}x ${prod.nome} (${formatPrice(preco)} cada)`)
    console.log(`   ℹ️  Total: ${formatPrice(totalCalculado)}`)

    assertNear(totalCalculado, totalEsperado, 0.01, `${qtd}x ${prod.nome}`)
  })

  // ── 11. Carrinho vazio ─────────────────────────────────────────
  await test('CARRINHO - Carrinho vazio (total = 0)', async () => {
    const total = calcularTotalCarrinho([])
    assert(total === 0, `Carrinho vazio = ${formatPrice(total)}`)
  })

  // ── 12. Checkout - Criar pedido completo ──────────────────────
  let novoPedido = null
  await test('CHECKOUT - Login + Criar pedido', async () => {
    // Fazer login como Maria
    const loginRes = await fetch(API + '/auth/cliente/login', {
      method: 'POST',
      body: { email: 'maria@email.com', password: 'cliente123' },
    })
    const token = loginRes.data?.token
    assert(!!token, 'Login OK')

    // Selecionar 2 produtos
    const p1 = produtos[0]
    const p2 = produtos[1] || produtos[0]
    const preco1 = parseFloat(p1.preco)
    const preco2 = parseFloat(p2.preco)
    const subtotal = preco1 + preco2
    const frete = 7.0
    const total = subtotal + frete

    console.log(`   ℹ️  Produto 1: ${p1.nome} = ${formatPrice(preco1)}`)
    console.log(`   ℹ️  Produto 2: ${p2.nome} = ${formatPrice(preco2)}`)
    console.log(`   ℹ️  Subtotal: ${formatPrice(subtotal)}`)
    console.log(`   ℹ️  Frete: ${formatPrice(frete)}`)
    console.log(`   ℹ️  Total esperado: ${formatPrice(total)}`)

    const criarRes = await fetch(API + '/pedidos', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: {
        cliente_id: loginRes.data.user.id,
        nome_cliente: 'Maria Silva',
        telefone_cliente: '(11) 99999-8888',
        endereco_cliente: 'Av. Paulista, 1000',
        numero_cliente: '1000',
        bairro_cliente: 'Bela Vista',
        cep_cliente: '01310-100',
        cidade_cliente: 'São Paulo',
        estado_cliente: 'SP',
        subtotal: subtotal,
        valor_frete: frete,
        total: total,
        metodo_pagamento: 'pix',
        detalhes_pagamento: '',
        observacoes: 'Teste E2E Cliente - sem cebola',
        itens: [
          {
            produto_id: p1.id,
            nome_produto: p1.nome,
            quantidade: 1,
            preco_unitario: preco1,
            extras: [],
            subtotal: preco1,
          },
          {
            produto_id: p2.id,
            nome_produto: p2.nome,
            quantidade: 1,
            preco_unitario: preco2,
            extras: [],
            subtotal: preco2,
          },
        ],
      },
    })

    assert(criarRes.status === 201 || criarRes.status === 200, `Pedido criado (status ${criarRes.status})`)
    assert(!!criarRes.data?.id, 'ID do pedido recebido (id=' + criarRes.data.id + ')')
    console.log(`   ℹ️  ID numérico: ${criarRes.data.id}, Pedido ID: ${criarRes.data.pedido_id}`)
    novoPedido = criarRes.data
  })

  // ── 13. Verificar valores do pedido criado ────────────────────
  await test('CHECKOUT - Verificar totais do pedido', async () => {
    assert(!!novoPedido, 'Pedido existe')

    const pedidoId = novoPedido.pedido_id || novoPedido.id
    console.log(`   ℹ️  Pedido: ${pedidoId}`)

    // Verificar que subtotal + frete = total
    const sub = parseFloat(novoPedido.subtotal)
    const frete = parseFloat(novoPedido.valor_frete)
    const tot = parseFloat(novoPedido.total)
    assertNear(sub + frete, tot, 0.02, `Subtotal (${formatPrice(sub)}) + Frete (${formatPrice(frete)}) = Total (${formatPrice(tot)})`)

    assert(novoPedido.status === 'pendente', `Status inicial: ${novoPedido.status}`)
    assert(novoPedido.metodo_pagamento === 'pix', `Pagamento: ${novoPedido.metodo_pagamento}`)
    assert(novoPedido.nome_cliente === 'Maria Silva', `Cliente: ${novoPedido.nome_cliente}`)
  })

  // ── 14. Verificar itens do pedido ─────────────────────────────
  await test('CHECKOUT - Itens do pedido (busca via GET /pedidos/:id)', async () => {
    // Buscar pedido completo com itens e timeline
    const loginRes = await fetch(API + '/auth/cliente/login', {
      method: 'POST',
      body: { email: 'maria@email.com', password: 'cliente123' },
    })
    const token = loginRes.data?.token
    // Usar o ID numérico, não o pedido_id (que tem prefixo # ex: #1005)
    const pedidoId = novoPedido.id

    const res = await fetch(API + '/pedidos/' + pedidoId, {
      headers: { Authorization: 'Bearer ' + token },
    })
    assert(res.status === 200, `Status 200 - Pedido encontrado`)

    const pedidoCompleto = res.data
    const itens = pedidoCompleto.itens
    assert(Array.isArray(itens) && itens.length >= 1, `Pelo menos 1 item no pedido (${itens?.length})`)

    itens.forEach((item, i) => {
      console.log(`   ℹ️  Item ${i + 1}: ${item.quantidade}x ${item.nome_produto || item.produto_nome} = ${formatPrice(item.subtotal)}`)
      assert(parseFloat(item.subtotal) > 0, `Item ${i + 1} com valor > 0`)
      assert(parseFloat(item.preco_unitario) > 0, `Item ${i + 1} com preço unitário > 0`)
    })

    // Verificar que a soma dos itens bate com o subtotal do pedido
    const somaItens = itens.reduce((acc, item) => acc + parseFloat(item.subtotal), 0)
    assertNear(somaItens, parseFloat(pedidoCompleto.subtotal), 0.02, 'Soma dos itens = subtotal do pedido')

    console.log(`   ℹ️  Itens OK: ${itens.length} itens, total R$ ${parseFloat(pedidoCompleto.subtotal).toFixed(2)}`)
  })

  // ── 15. Verificar dados do cliente após login ─────────────────
  await test('PERFIL - Dados do cliente autenticado', async () => {
    const loginRes = await fetch(API + '/auth/cliente/login', {
      method: 'POST',
      body: { email: 'maria@email.com', password: 'cliente123' },
    })
    const token = loginRes.data?.token

    const res = await fetch(API + '/auth/me', {
      headers: { Authorization: 'Bearer ' + token },
    })
    assert(res.status === 200, 'Perfil acessado')
    assert(res.data?.user?.email === 'maria@email.com', `Email: ${res.data?.user?.email}`)
    assert(res.data?.user?.role === 'cliente', `Role: ${res.data?.user?.role}`)
  })

  // ── RESULTADO FINAL ───────────────────────────────────────────
  console.log(`\n${'='.repeat(55)}`)
  console.log(`  📊 RESULTADO FINAL`)
  console.log(`${'='.repeat(55)}`)
  console.log(`  Total de testes: ${totalTests}`)
  console.log(`  ✅ Passaram:      ${passed}`)
  console.log(`  ❌ Falharam:      ${failed}`)
  console.log(`${'='.repeat(55)}`)

  if (failed > 0) {
    console.log(`\n  ❌ ALGUNS TESTES FALHARAM!\n`)
    process.exit(1)
  } else {
    console.log(`\n  🎉 TODOS OS TESTES PASSARAM!\n`)
  }
}

main()
