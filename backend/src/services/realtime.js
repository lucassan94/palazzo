import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { notificarStatusPedido } from './push.js';

let io = null;

// Inicializar Socket.IO com o servidor HTTP
export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Middleware de autenticação
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      // Conexão anônima (cliente não logado) - permite apenas eventos públicos
      socket.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.user = decoded;
      next();
    } catch {
      socket.user = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`[WS] Cliente conectado: ${user ? `${user.role} ${user.id}` : 'anônimo'}`);

    // Unir a salas baseadas no role
    if (user) {
      socket.join(`user:${user.role}:${user.id}`);
      socket.join(`role:${user.role}`);

      if (user.restaurantId) {
        socket.join(`restaurant:${user.restaurantId}`);
      }
    }

    // Salas públicas do restaurante
    socket.join(`restaurant:${config.restaurantId}`);

    socket.on('disconnect', () => {
      console.log(`[WS] Cliente desconectado: ${user ? user.role : 'anônimo'}`);
    });
  });

  console.log('[WS] Socket.IO inicializado');
  return io;
}

// Emitir evento para salas específicas
export function emitToRoom(room, event, data) {
  if (!io) return;
  io.to(room).emit(event, data);
}

// Emitir para todos em um restaurante
export function emitToRestaurant(event, data, restaurantId = config.restaurantId) {
  emitToRoom(`restaurant:${restaurantId}`, event, data);
}

// Emitir para role específico
export function emitToRole(role, event, data) {
  emitToRoom(`role:${role}`, event, data);
}

// Emitir para usuário específico
export function emitToUser(role, userId, event, data) {
  emitToRoom(`user:${role}:${userId}`, event, data);
}

// Eventos de pedido
export function emitPedidoAtualizado(pedido) {
  emitToRestaurant('pedido:atualizado', pedido);

  if (pedido.cliente_id) {
    emitToUser('cliente', pedido.cliente_id, 'pedido:atualizado', pedido);
    // Enviar push notification em background
    notificarStatusPedido(pedido).catch(() => {});
  }

  if (pedido.entregador_id) {
    emitToUser('entregador', pedido.entregador_id, 'pedido:atualizado', pedido);
  }
}

export function emitNovoPedido(pedido) {
  emitToRestaurant('pedido:novo', pedido);
}

export function emitEntregaDisponivel(entrega) {
  emitToRole('entregador', 'entrega:disponivel', entrega);
}

export function emitNovaMensagem(mensagem, clienteId) {
  emitToRestaurant('mensagem:novo', mensagem);
  if (clienteId) {
    emitToUser('cliente', clienteId, 'mensagem:novo', mensagem);
  }
}

export { io };
