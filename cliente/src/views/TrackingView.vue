<template>
  <div class="tracking-view">
    <div class="tracking-header">
      <h2>Acompanhar Pedido</h2>
      <div class="order-ref">{{ order?.pedido_id }}</div>
    </div>

    <div v-if="loading" class="loading-wrapper">
      <div class="spinner spinner-center"></div>
    </div>

    <div v-else-if="!order" class="empty-search p-4">
      <i class="fas fa-exclamation-circle icon-lg"></i>
      <p>Pedido não encontrado.</p>
      <router-link to="/pedidos" class="btn btn-primary mt-3">
        Meus Pedidos
      </router-link>
    </div>

    <template v-else>
      <!-- PIX Payment Card (exibido no topo quando aguardando pagamento) -->
      <div v-if="order.metodo_pagamento === 'pix_online' && order.status === 'aguardando_pagamento'" class="pix-payment-card">
        <div class="pix-header">
          <div class="pix-header-icon">
            <i class="fas fa-qrcode"></i>
          </div>
          <div class="pix-header-text">
            <h3>Pague com PIX</h3>
            <p>Escaneie o QR Code com o app do seu banco</p>
          </div>
        </div>
        <div class="pix-body">
          <div class="pix-qrcode-container">
            <div v-if="!pixData" class="pix-loading">
              <i class="fas fa-spinner fa-spin"></i> Carregando QR Code...
            </div>
            <img v-if="pixData?.encodedImage" :src="'data:image/png;base64,' + pixData.encodedImage" alt="QR Code PIX" class="pix-qrcode-img" />
          </div>
          <div class="pix-info">
            <div class="pix-value-row">
              <span class="pix-label">Valor</span>
              <span class="pix-value">{{ formatPrice(order.total) }}</span>
            </div>
            <div class="pix-timer-row" :class="{ expired: pixExpired }">
              <i class="fas fa-clock"></i>
              <span v-if="!pixExpired">
                Pagamento expira em <strong>{{ pixTimer }}</strong>
              </span>
              <span v-else class="text-danger">
                ⏰ PIX expirou! Gere um novo QR Code
              </span>
            </div>
          </div>
          <div class="pix-actions">
            <button class="btn btn-primary btn-block" @click="copiarPixPayload">
              <i class="fas fa-copy"></i> Copiar código PIX
            </button>
            <button v-if="pixExpired" class="btn btn-secondary btn-block mt-1" @click="gerarNovoPix">
              <i class="fas fa-redo"></i> Gerar novo QR Code
            </button>
          </div>
        </div>
      </div>
      <!-- Timeline -->
      <div class="timeline">
        <div
          v-for="(step, index) in timelineSteps"
          :key="index"
          class="timeline-step"
          :class="{
            completed: step.status === 'completed',
            active: step.status === 'active',
          }"
        >
          <div class="step-label">{{ step.label }}</div>
          <div class="step-desc">{{ step.desc }}</div>
        </div>
      </div>

      <!-- Status Card -->
      <div class="tracking-card">
        <div class="delivery-info">
          <span>Status: <strong>{{ statusLabel(order.status) }}</strong></span>
          <span>Previsão: <strong>{{ estimatedTime }}</strong></span>
        </div>

        <!-- Progress Bar -->
        <div class="progress-bar">
          <div
            class="progress-bar-fill"
            :class="progressClass"
            :style="{ width: progressPercent + '%' }"
          ></div>
        </div>

        <!-- Countdown -->
        <div class="estimated-time status-center">
          <i class="fas fa-clock"></i>
          <span class="countdown">{{ countdownText }}</span>
        </div>

        <!-- Delivery Driver Info -->
        <div v-if="order.entregador_nome" class="driver-info">
          <div class="driver-avatar">
            <i class="fas fa-motorcycle"></i>
          </div>
          <div>
            <div class="driver-name">{{ order.entregador_nome }}</div>
            <div class="driver-label">Seu entregador</div>
          </div>
        </div>
      </div>

      <!-- Motivo de Cancelamento/Recusa -->
      <div v-if="order.motivo_cancelamento" class="tracking-card mt-3" style="border-left: 4px solid var(--error);">
        <h4 class="section-header" style="color:var(--error);">
          <i class="fas fa-info-circle"></i>
          {{ order.status === 'recusado' ? 'Pedido Recusado' : 'Pedido Cancelado' }}
        </h4>
        <p style="font-size:0.9rem;margin-top:0.5rem;">{{ order.motivo_cancelamento }}</p>
        <!-- Refund status visível para o cliente -->
        <div v-if="isOnlinePayment(order.metodo_pagamento) && refundStatus"
             class="refund-badge" :class="'refund-' + refundStatus">
          <i :class="refundIcon"></i>
          {{ refundLabel }}
        </div>
      </div>

      <!-- Kitchen Messages -->
      <div v-if="order.mensagens?.length" class="tracking-card mt-3">
        <h4 class="section-header">
          <i class="fas fa-comment-dots" style="color:var(--warning);"></i>
          Mensagens da Cozinha
        </h4>
        <div
          v-for="msg in order.mensagens"
          :key="msg.id"
          class="kitchen-msg"
        >
          {{ msg.mensagem }}
          <div class="kitchen-msg-time">
            {{ formatDate(msg.criado_em) }}
          </div>
        </div>
      </div>

      <!-- Back Button -->
      <router-link
        to="/pedidos"
        class="btn btn-secondary btn-block mt-4"
      >
        <i class="fas fa-arrow-left"></i> Voltar aos Pedidos
      </router-link>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { onEvent, offEvent } from '../services/realtime'
import { getPixQrCode } from '../services/api'
import api from '../services/api'

function isOnlinePayment(metodo) {
  return ['pix_online', 'credito_online'].includes(metodo)
}

const route = useRoute()
const order = ref(null)
const loading = ref(true)
const elapsedTime = ref(0)
const pixData = ref(null)
const pixTimer = ref('10:00')
const pixExpired = ref(false)
let timerInterval = null
let pixInterval = null
let pollingInterval = null

// Refund status (cliente)
const refundStatus = ref(null)
let refundPollingInterval = null

async function checkRefundStatus(pedidoId) {
  try {
    const { data } = await api.get(`/pagamentos/${pedidoId}/refund-status`)
    if (data.refund_status) {
      refundStatus.value = data.refund_status
    } else if (data.deleted) {
      refundStatus.value = 'DONE'
    }
  } catch { /* silent */ }
}

const refundIcon = computed(() => {
  const s = refundStatus.value
  if (s === 'DONE') return 'fas fa-check-circle'
  if (s === 'CANCELLED') return 'fas fa-times-circle'
  return 'fas fa-clock'
})

const refundLabel = computed(() => {
  const s = refundStatus.value
  if (!s) return '⏳ Estorno solicitado'
  if (s === 'DONE') return '✅ Estorno concluído'
  return '⏳ Estorno solicitado'
})

const timelineSteps = computed(() => [
  { label: 'Pagamento', desc: order.value?.status === 'aguardando_pagamento' ? 'Aguardando pagamento ⏳' : 'Pagamento confirmado ✅', status: getStepStatus(0) },
  { label: 'Confirmação', desc: 'Aguardando confirmação do restaurante', status: getStepStatus(1) },
  { label: 'Preparando', desc: 'Seu pedido está na cozinha 🍳', status: getStepStatus(2) },
  { label: 'Saiu para Entrega', desc: 'Pedido pronto, saindo do restaurante 📦', status: getStepStatus(3) },
  { label: 'Entregador', desc: 'A caminho do seu endereço 🏍️', status: getStepStatus(4) },
  { label: 'Entregue', desc: 'Pedido entregue com sucesso! 🎉', status: getStepStatus(5) },
])

const statusOrder = ['aguardando_pagamento', 'pendente', 'preparando', 'pronto_entrega', 'em_transito', 'cheguei_destino', 'entregue']

function getStepStatus(stepIndex) {
  if (!order.value) return 'pending'
  const currentIndex = statusOrder.indexOf(order.value.status)
  if (currentIndex < 0) return 'pending'
  if (stepIndex < currentIndex) return 'completed'
  if (stepIndex === currentIndex) return 'active'
  return 'pending'
}

const progressPercent = computed(() => {
  if (!order.value) return 0
  const currentIndex = statusOrder.indexOf(order.value.status)
  if (currentIndex < 0) return 0
  return ((currentIndex + 1) / statusOrder.length) * 100
})

const progressClass = computed(() => {
  const status = order.value?.status
  if (status === 'entregue') return 'success'
  if (status === 'cancelado' || status === 'recusado') return 'danger'
  if (elapsedTime.value > 1800) return 'danger' // > 30 min
  if (elapsedTime.value > 900) return 'warning'  // > 15 min
  return ''
})

const estimatedTime = computed(() => {
  if (!order.value?.criado_em) return '—'
  const preparo = parseInt(order.value.tempo_preparo_estimado) || 20
  const entrega = parseInt(order.value.tempo_entrega_estimado) || 25
  const totalMin = preparo + entrega
  const criado = new Date(order.value.criado_em)
  const previsao = new Date(criado.getTime() + totalMin * 60 * 1000)
  return previsao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
})

const countdownText = computed(() => {
  if (!order.value?.criado_em) return ''
  if (['entregue', 'cancelado', 'recusado'].includes(order.value.status)) {
    return statusLabel(order.value.status)
  }
  const preparo = parseInt(order.value.tempo_preparo_estimado) || 20
  const entrega = parseInt(order.value.tempo_entrega_estimado) || 25
  const totalMin = preparo + entrega
  const mins = Math.max(0, totalMin - Math.floor(elapsedTime.value / 60))
  if (mins === 0) return 'Saindo agora! 🚀'
  return `~${mins} minutos`
})

function statusLabel(status) {
  const labels = {
    aguardando_pagamento: 'Aguardando pagamento ⏳',
    pendente: 'Aguardando confirmação',
    preparando: 'Preparando seu pedido 🍳',
    pronto_entrega: 'Saiu para entrega 📦',
    em_transito: 'Entregador a caminho 🏍️',
    cheguei_destino: 'Entregador chegou 📍',
    entregue: 'Entregue com sucesso! 🎉',
    cancelado: 'Pedido cancelado ❌',
    recusado: 'Pedido recusado ❌',
  }
  return labels[status] || status
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function updateElapsedTime() {
  if (order.value?.criado_em) {
    const criado = new Date(order.value.criado_em)
    elapsedTime.value = Math.floor((Date.now() - criado.getTime()) / 1000)
  }
}

onMounted(async () => {
  const id = route.params.id
  try {
    const { data } = await api.get(`/pedidos/${id}`)
    order.value = data
    updateElapsedTime()
  } catch {
    order.value = null
  } finally {
    loading.value = false
  }

  // Real-time updates (mecanismo PRINCIPAL)
  onEvent('pedido:atualizado', (pedido) => {
    if (pedido.id === parseInt(id)) {
      order.value = { ...order.value, ...pedido }
    }
  })

  // Timer
  timerInterval = setInterval(updateElapsedTime, 1000)

  // Carregar dados do PIX se for pix_online
  if (order.value?.metodo_pagamento === 'pix_online' && order.value?.status === 'aguardando_pagamento') {
    carregarPixData(id)
    // Backup polling: verifica status LOCAL a cada 10s (não consulta Asaas)
    iniciarPollingLocal(id)
  }

  // Iniciar polling de refund se pedido foi recusado/cancelado com pagamento online
  if (order.value && (order.value.status === 'cancelado' || order.value.status === 'recusado') && isOnlinePayment(order.value.metodo_pagamento)) {
    checkRefundStatus(id)
    refundPollingInterval = setInterval(() => {
      if (refundStatus.value === 'DONE' || refundStatus.value === 'CANCELLED') return
      checkRefundStatus(id)
    }, 10000)
  }
})

// Polling de BACKUP: verifica status do pedido LOCAL (não consulta Asaas)
// Mecanismo principal é o WebSocket (pedido:atualizado)
// Este polling serve apenas como fallback para quando o WebSocket falha
function iniciarPollingLocal(pedidoId) {
  pollingInterval = setInterval(async () => {
    try {
      const { data } = await api.get(`/pedidos/${pedidoId}`)
      // Se o status mudou de 'aguardando_pagamento', o webhook chegou
      if (data.status !== 'aguardando_pagamento') {
        order.value = data
        // Recarregar após 1s para sincronizar tudo
        setTimeout(() => window.location.reload(), 1000)
      }
    } catch {
      // Silent — polling não deve mostrar erros
    }
  }, 15000) // 15s: intervalo tranquilo, só backup
}

// PIX: carregar dados (localStorage ou API)
function carregarPixData(pedidoId) {
  const saved = localStorage.getItem(`pix_${pedidoId}`)
  if (saved) {
    pixData.value = JSON.parse(saved)
    iniciarTimerPix()
  } else {
    buscarPixDaAPI(pedidoId)
  }
}

async function buscarPixDaAPI(pedidoId) {
  try {
    const { data } = await getPixQrCode(pedidoId)
    pixData.value = data
    localStorage.setItem(`pix_${pedidoId}`, JSON.stringify(data))
    iniciarTimerPix()
  } catch (err) {
    console.error('[Tracking] Erro ao buscar PIX:', err)
  }
}

function iniciarTimerPix() {
  const criadoEm = new Date(order.value?.criado_em).getTime()
  const expiresAt = criadoEm + 10 * 60 * 1000

  pixInterval = setInterval(() => {
    const diff = expiresAt - Date.now()
    if (diff <= 0) {
      pixExpired.value = true
      clearInterval(pixInterval)
      pixTimer.value = '00:00'
    } else {
      const min = Math.floor(diff / 60000)
      const sec = Math.floor((diff % 60000) / 1000)
      pixTimer.value = `${min}:${sec.toString().padStart(2, '0')}`
    }
  }, 1000)
}

function copiarPixPayload() {
  if (!pixData.value?.payload) return
  navigator.clipboard.writeText(pixData.value.payload)
  // Toast de feedback (se disponível no escopo)
  const toast = document.createElement('div')
  toast.className = 'toast-notification success'
  toast.textContent = 'Código PIX copiado!'
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}

async function gerarNovoPix() {
  const pedidoId = route.params.id
  localStorage.removeItem(`pix_${pedidoId}`)
  clearInterval(pixInterval)
  pixExpired.value = false
  await buscarPixDaAPI(pedidoId)
}

function formatPrice(value) {
  const num = parseFloat(value) || 0
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

onUnmounted(() => {
  offEvent('pedido:atualizado')
  if (timerInterval) clearInterval(timerInterval)
  if (pixInterval) clearInterval(pixInterval)
  if (pollingInterval) clearInterval(pollingInterval)
  if (refundPollingInterval) clearInterval(refundPollingInterval)
})
</script>

<style scoped>
/* Refund badge no cliente */
.refund-badge {
  font-size: 0.85rem;
  margin-top: 10px;
  padding: 6px 10px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.refund-badge.refund-null {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}
.refund-badge.refund-DONE {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}
.refund-badge.refund-CANCELLED {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}
.refund-badge.refund-AWAITING_CRITICAL_ACTION_AUTHORIZATION {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}
</style>
