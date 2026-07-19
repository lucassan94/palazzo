import { io } from 'socket.io-client'

let socket = null

export function connectRealtime() {
  if (socket?.connected) return socket

  const token = getCookie('publicToken')

  socket = io(window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })

  socket.on('connect', () => {
    console.log('[WS] Conectado')
  })

  socket.on('disconnect', (reason) => {
    console.log('[WS] Desconectado:', reason)
  })

  socket.on('connect_error', (error) => {
    console.warn('[WS] Erro de conexão:', error.message)
  })

  return socket
}

export function disconnectRealtime() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function onEvent(event, callback) {
  if (socket) {
    socket.on(event, callback)
  }
}

export function offEvent(event, callback) {
  if (socket) {
    socket.off(event, callback)
  }
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? decodeURIComponent(match[2]) : null
}

export { socket }
