import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/database.js';
import { authenticate } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { salvarSubscription, removerSubscription, vapidPublicKey } from '../../services/push.js';

const router = Router();

// Schema de validação da subscription
const subscriptionSchema = z.object({
  endpoint: z.string().url('Endpoint inválido.'),
  keys: z.object({
    p256dh: z.string().min(1, 'Chave p256dh obrigatória.'),
    auth: z.string().min(1, 'Chave auth obrigatória.'),
  }),
});

// ──────── GET /api/push/vapid-public-key ────────
// Retorna a chave pública VAPID para o frontend
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

// ──────── POST /api/push/subscribe ────────
// Inscreve o dispositivo do cliente para receber push notifications
router.post('/subscribe', authenticate, async (req, res, next) => {
  try {
    const { id: clienteId } = req.user;

    if (req.user.role !== 'cliente') {
      throw new AppError('Apenas clientes podem se inscrever em notificações.', 403);
    }

    const data = subscriptionSchema.parse(req.body);
    await salvarSubscription(clienteId, data);

    res.json({ sucesso: true, mensagem: 'Inscrito em notificações push!' });
  } catch (err) {
    next(err);
  }
});

// ──────── DELETE /api/push/unsubscribe ────────
// Remove a inscrição de push notifications
router.post('/unsubscribe', authenticate, async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) throw new AppError('Endpoint é obrigatório.', 400);

    await removerSubscription(endpoint);
    res.json({ sucesso: true, mensagem: 'Notificações push desativadas.' });
  } catch (err) {
    next(err);
  }
});

// ──────── GET /api/push/subscriptions ────────
// Lista inscrições do cliente (para gerenciamento)
router.get('/subscriptions', authenticate, async (req, res, next) => {
  try {
    const { id: clienteId } = req.user;
    const result = await query(
      `SELECT id, endpoint, substring(p256dh, 1, 20) as p256dh_prefix, criado_em
       FROM push_subscriptions WHERE cliente_id = $1
       ORDER BY criado_em DESC`,
      [clienteId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
