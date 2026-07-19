// Serviço de Push Notifications (VAPID / Web Push)
import webpush from 'web-push';
import { query } from '../config/database.js';
import { config } from '../config/index.js';

// Configurar VAPID — as chaves DEVEM ser definidas via variáveis de ambiente
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.warn('[Push] ⚠️ VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY não configurados. Notificações push não funcionarão.');
  console.warn('[Push] Para gerar: npx web-push generate-vapid-keys');
}

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:admin@palazzomooca.com.br',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export { vapidPublicKey };

// Salvar subscription de um cliente
export async function salvarSubscription(clienteId, subscription) {
  // Remover subscription antiga do mesmo endpoint (se houver)
  await query(
    'DELETE FROM push_subscriptions WHERE endpoint = $1',
    [subscription.endpoint]
  );

  // Inserir nova
  await query(
    `INSERT INTO push_subscriptions (cliente_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (cliente_id, endpoint)
     DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, atualizado_em = NOW()`,
    [clienteId, subscription.endpoint, subscription.keys?.p256dh || '', subscription.keys?.auth || '']
  );
}

// Remover subscription
export async function removerSubscription(endpoint) {
  await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

// Enviar notificação push para um cliente específico
export async function enviarNotificacao(clienteId, titulo, corpo, icone = '/icons/icon.svg', url = null) {
  if (!vapidPublicKey) {
    console.warn('[Push] VAPID não configurado — notificação não enviada.');
    return 0;
  }

  try {
    const result = await query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE cliente_id = $1',
      [clienteId]
    );

    if (result.rows.length === 0) return 0;

    let enviadas = 0;

    for (const row of result.rows) {
      const subscription = {
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth,
        },
      };

      const payload = JSON.stringify({
        title: titulo,
        body: corpo,
        icon: icone,
        badge: '/icons/icon.svg',
        vibrate: [200, 100, 200],
        data: {
          url: url || '/',
          date: new Date().toISOString(),
        },
        actions: [
          { action: 'open', title: 'Ver Pedido' },
          { action: 'close', title: 'Fechar' },
        ],
      });

      try {
        await webpush.sendNotification(subscription, payload, { TTL: 86400 });
        enviadas++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expirou ou foi removida — limpar
          await removerSubscription(row.endpoint);
        } else {
          console.warn(`[Push] Erro ao enviar para ${row.endpoint.substring(0, 30)}...: ${err.message}`);
        }
      }
    }

    return enviadas;
  } catch (err) {
    console.error('[Push] Erro ao enviar notificações:', err.message);
    return 0;
  }
}

// Enviar notificação de atualização de pedido
export async function notificarStatusPedido(pedido) {
  if (!pedido.cliente_id) return;

  const statusLabels = {
    pendente: 'Pedido recebido!',
    preparando: 'Seu pedido está sendo preparado 🍳',
    pronto_entrega: 'Pedido saiu para entrega 📦',
    em_transito: 'Entregador a caminho 🏍️',
    cheguei_destino: 'Entregador chegou 📍',
    entregue: 'Pedido entregue com sucesso! 🎉',
    cancelado: 'Pedido cancelado ❌',
    recusado: 'Pedido recusado',
  };

  const titulo = statusLabels[pedido.status] || `Status: ${pedido.status}`;
  const corpo = `Pedido ${pedido.pedido_id || `#${pedido.id}`} — ${pedido.nome_cliente || ''}`;
  const url = `/pedidos/${pedido.id}`;

  await enviarNotificacao(pedido.cliente_id, titulo, corpo, undefined, url);
}

// Enviar notificação de mensagem da cozinha
export async function notificarMensagem(pedidoId, clienteId, mensagem) {
  await enviarNotificacao(
    clienteId,
    '💬 Mensagem da Cozinha',
    mensagem.substring(0, 120),
    undefined,
    `/pedidos/${pedidoId}`
  );
}
