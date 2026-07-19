import { io } from 'socket.io-client'

let socket = null

export function connectRealtime() {
  if (socket?.connected) return socket
  const token = document.cookie.match(/(^| )publicToken=([^;]+)/)?.[2]
  socket = io(window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
  })
  return socket
}

export function onEvent(event, callback) { if (socket) socket.on(event, callback) }
export function offEvent(event, callback) { if (socket) socket.off(event, callback) }
