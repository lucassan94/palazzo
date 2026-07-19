// Push Notification Service - Frontend
import api from './api'

let swRegistration = null

// Converter chave VAPID base64 para Uint8Array (formato que o Push API espera)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Verificar se push é suportado
export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

// Verificar permissão atual
export function permissionStatus() {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission
}

// Registrar Service Worker (se ainda não registrado)
export async function registerSW() {
  if (swRegistration) return swRegistration
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js')
    return swRegistration
  } catch (err) {
    console.warn('[Push] Erro ao registrar SW:', err)
    return null
  }
}

// Obter chave pública VAPID do backend
async function getVapidKey() {
  const { data } = await api.get('/push/vapid-public-key')
  return data.publicKey
}

// Inscrever o dispositivo para push notifications
export async function subscribeToPush() {
  if (!pushSupported()) {
    return { sucesso: false, erro: 'Push não suportado neste navegador.' }
  }

  try {
    const registration = await registerSW()
    if (!registration) {
      return { sucesso: false, erro: 'Não foi possível registrar o Service Worker.' }
    }

    // Solicitar permissão
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { sucesso: false, erro: 'Permissão de notificação negada.' }
    }

    // Obter chave VAPID
    const vapidKey = await getVapidKey()

    // Inscrever no push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    // Enviar subscription para o backend
    await api.post('/push/subscribe', subscription.toJSON())

    return { sucesso: true, mensagem: 'Notificações ativadas!' }
  } catch (err) {
    console.error('[Push] Erro ao inscrever:', err)
    return { sucesso: false, erro: err.response?.data?.error || err.message }
  }
}

// Cancelar inscrição
export async function unsubscribeFromPush() {
  if (!pushSupported()) return

  try {
    const registration = await registerSW()
    if (!registration) return

    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe()
      await api.post('/push/unsubscribe', { endpoint })
    }

    return { sucesso: true }
  } catch (err) {
    console.error('[Push] Erro ao cancelar inscrição:', err)
    return { sucesso: false, erro: err.message }
  }
}
