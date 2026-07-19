// Verificar e configurar webhook do Asaas
// Diagnóstico do Webhook Asaas
// Uso: node src/check-webhook.js [criar|deletar <id>] [url]
//
// Exemplos:
//   node src/check-webhook.js                    # Listar webhooks
//   node src/check-webhook.js criar <url>        # Criar webhook
//   node src/check-webhook.js deletar <id>       # Deletar webhook

import { config } from './config/index.js';

const key = config.asaas.apiKey;
const base = config.asaas.baseUrl;

async function listWebhooks() {
  const res = await fetch(base + '/v3/webhooks', {
    headers: { 'access_token': key },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.errors?.[0]?.description || 'Erro');
  return data;
}

async function createWebhook(url) {
  // Nota: O authToken enviado aqui será passado por Asaas no header
  // 'asaas-access-token' ao chamar nosso webhook. Validamos este
  // header no middleware validateWebhook do backend.
  const res = await fetch(base + '/v3/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'access_token': key },
    body: JSON.stringify({
      url,
      email: 'admin@palazzomooca.com.br',
      enabled: true,
      events: [
        'PAYMENT_RECEIVED',
        'PAYMENT_CONFIRMED',
        'PAYMENT_OVERDUE',
        'PAYMENT_DELETED',
        'PAYMENT_REFUNDED',
        'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
        'PAYMENT_CHARGEBACK_REQUESTED',
      ],
      authToken: config.asaas.webhookToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.errors?.[0]?.description || 'Erro ao criar');
  return data;
}

async function deleteWebhook(id) {
  const res = await fetch(base + `/v3/webhooks/${id}`, {
    method: 'DELETE',
    headers: { 'access_token': key },
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.errors?.[0]?.description || 'Erro ao deletar');
  }
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const comando = args[0];

  console.log('=== Diagnóstico Webhook Asaas ===\n');
  console.log('Ambiente:', config.asaas.environment);
  console.log('Base URL:', base);
  console.log('Webhook Token:', config.asaas.webhookToken ? '✅ configurado' : '❌ NÃO configurado');
  console.log('');

  if (comando === 'criar') {
    const url = args[1];
    if (!url) {
      console.log('❌ Informe a URL do webhook. Ex: node src/check-webhook.js criar https://meudominio.com/api/pagamentos/webhook');
      return;
    }
    console.log('Criando webhook para:', url, '...');
    const result = await createWebhook(url);
    console.log('✅ Webhook criado! ID:', result.id);
    console.log('URL:', result.url);
    return;
  }

  if (comando === 'deletar') {
    const id = args[1];
    if (!id) {
      console.log('❌ Informe o ID do webhook. Ex: node src/check-webhook.js deletar whk_abc123');
      return;
    }
    await deleteWebhook(id);
    console.log('✅ Webhook deletado:', id);
    return;
  }

  // Comando padrão: listar
  try {
    const list = await listWebhooks();
    console.log('Webhooks configurados:', list.totalCount || 0);
    if (list.data && list.data.length > 0) {
      for (const w of list.data) {
        console.log(`\n  ID: ${w.id}`);
        console.log(`  URL: ${w.url}`);
        console.log(`  Ativo: ${w.enabled}`);
        console.log(`  Eventos: ${(w.events || []).join(', ')}`);
      }
    } else {
      console.log('\n⚠️  Nenhum webhook configurado.');
      console.log('   Para criar: node src/check-webhook.js criar <url>');
      console.log('');
      console.log('   ⚠️  Em localhost, o Asaas NÃO consegue enviar webhooks.');
      console.log('   Use ngrok ou deploy para testar webhooks.');
      console.log('   Alternativa: o frontend faz polling automático (5 em 5s).');
    }
  } catch (err) {
    console.log('Erro:', err.message);
  }
}

main().catch(console.error);
