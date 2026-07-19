// Teste do fluxo PIX Online
import http from 'http';

const BASE = 'http://localhost:3001';

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': data ? Buffer.byteLength(data) : 0,
    };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request(`${BASE}${path}`, { method, headers }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, raw: d, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // 1. Login
  console.log('1. Login...');
  const login = await request('POST', '/api/auth/cliente/login', {
    email: 'browser-test-123@teste.com',
    password: 'senha1234',
  });
  console.log(`   Status: ${login.status} | ${login.data?.message}`);
  if (!login.data?.token) {
    console.log('   ERRO: Login falhou');
    return;
  }

  const token = login.data.token;
  const cookie = `token=${token}; publicToken=${token}`;

  // CPF válido para testes no Asaas Sandbox (529.982.247-25)
  const cpfValido = '52998224725';

  // 2. Criar pedido PIX
  console.log('\n2. Criando pedido PIX...');
  const order = await request('POST', '/api/pagamentos/criar', {
    tipo: 'PIX',
    cliente: {
      cpfCnpj: cpfValido,
      nome: 'Teste Browser',
      telefone: '11999999999',
    },
    pedido: {
      endereco: 'Rua Teste',
      numero: '123',
      bairro: 'Centro',
      cep: '01310-000',
      cidade: 'São Paulo',
      estado: 'SP',
    },
    subtotal: 29.90,
    valor_frete: 7.00,
    total: 36.90,
    itens: [{
      produto_id: 16,
      nome_produto: 'Ancho a Cavalo',
      quantidade: 1,
      preco_unitario: 29.90,
      extras: [],
      subtotal: 29.90,
    }],
  }, cookie);

  console.log(`   Status: ${order.status}`);
  if (order.data?.sucesso) {
    console.log(`   ✅ Pedido PIX criado!`);
    console.log(`   ID: ${order.data.id}`);
    console.log(`   Pedido: ${order.data.pedido_id}`);
    console.log(`   Payment: ${order.data.payment_id}`);
    console.log(`   Status: ${order.data.status}`);
    console.log(`   Pix encodedImage: ${order.data.pix?.encodedImage ? order.data.pix.encodedImage.substring(0, 40) + '...' : 'N/A'}`);
    console.log(`   Pix payload: ${order.data.pix?.payload ? order.data.pix.payload.substring(0, 30) + '...' : 'N/A'}`);
    console.log(`   Pix expirationDate: ${order.data.pix?.expirationDate || 'N/A'}`);
    console.log(`   Valor: R$ ${order.data.valor}`);
  } else {
    console.log(`   ❌ Erro: ${order.data?.erro || order.data?.error || JSON.stringify(order.data)}`);
  }

  // 3. Buscar QR Code pela API
  if (order.data?.id) {
    console.log(`\n3. Buscando QR Code para pedido ${order.data.id}...`);
    const qr = await request('GET', `/api/pagamentos/${order.data.id}/pix-qrcode`, null, cookie);
    console.log(`   Status: ${qr.status}`);
    if (qr.data?.encodedImage) {
      console.log(`   ✅ QR Code encontrado!`);
      console.log(`   encodedImage: ${qr.data.encodedImage.substring(0, 40)}...`);
      console.log(`   payload: ${qr.data.payload?.substring(0, 30)}...`);
    } else {
      console.log(`   ❌ QR Code não encontrado: ${JSON.stringify(qr.data)}`);
    }
  }
}

main().catch(console.error);
