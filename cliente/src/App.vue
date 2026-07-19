<template>
  <div class="app">
    <!-- Store Closed Banner -->
    <div v-if="!storeOpen" class="store-closed-banner">
      <i class="fas fa-clock"></i>
      Loja Fechada no momento — novos pedidos não podem ser realizados
    </div>



    <!-- Main Content -->
    <main :class="{ 'main-cart-open': showCart }">
      <router-view
        @update:cart="updateCart"
        @show-cart="showCartDrawer = true"
      />
    </main>

    <!-- Bottom Navigation -->
    <nav class="bottom-nav">
      <button
        class="bottom-nav-item"
        :class="{ active: $route.name === 'Home' }"
        @click="$router.push('/')"
      >
        <i class="fas fa-home"></i>
        Início
      </button>
      <button
        class="bottom-nav-item"
        :class="{ active: $route.name === 'Orders' || $route.name === 'OrderTracking' }"
        @click="$router.push('/pedidos')"
      >
        <i class="fas fa-receipt"></i>
        Pedidos
        <span v-if="unreadMessages" class="badge">{{ unreadMessages }}</span>
      </button>
      <button
        class="bottom-nav-item"
        :class="{ active: $route.name === 'Profile' }"
        @click="$router.push(authStore.isAuthenticated ? '/perfil' : '/auth')"
      >
        <i class="fas fa-user"></i>
        Perfil
      </button>
    </nav>

    <!-- Cart Bar -->
    <div v-if="showCart" class="cart-bar" @click="openCart">
      <div class="cart-bar-left">
        <i class="fas fa-shopping-bag"></i>
        <span>{{ cartTotalItens }} {{ cartTotalItens === 1 ? 'item' : 'itens' }}</span>
      </div>
      <div class="cart-bar-right">
        <span>Ver Sacola</span>
        <strong>{{ formatPrice(cartTotal) }}</strong>
      </div>
    </div>

    <!-- Checkout Drawer -->
    <div class="drawer-overlay" :class="{ open: showCartDrawer }" @click="showCartDrawer = false"></div>
    <div class="checkout-drawer" :class="{ open: showCartDrawer }">
      <div class="drawer-handle"></div>
      <div class="drawer-header">
        <h3>Sua Sacola</h3>
        <button class="drawer-close" @click="showCartDrawer = false">&times;</button>
      </div>
      <CheckoutPanel @close="showCartDrawer = false" />
    </div>

    <!-- CEP Modal -->
    <CepOnboarding v-if="showCepModal" @close="showCepModal = false" />

    <!-- Toast Container -->
    <div class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="[toast.type, { clickable: toast.onClick || toastListeners.has('click') }]"
        @click="handleToastClick(toast)"
      >
        <i :class="toastIcon(toast.type)"></i>
        {{ toast.message }}
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="globalLoading" class="loading-overlay">
      <div class="spinner"></div>
      <span class="loading-text">{{ loadingMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, provide } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { connectRealtime, onEvent, offEvent } from './services/realtime'
import CheckoutPanel from './components/CheckoutPanel.vue'
import CepOnboarding from './components/CepOnboarding.vue'
import * as pushService from './services/push.js'

const authStore = useAuthStore()
const $router = useRouter()

// Store state
const storeOpen = ref(true)
const cartItems = ref([])
const showCartDrawer = ref(false)
const showCepModal = ref(false)
const unreadMessages = ref(0)

// Global loading
const globalLoading = ref(false)
const loadingMessage = ref('Carregando...')

// Toast notifications
const toasts = ref([])
let toastId = 0

const toastListeners = new Map()

function addToastListener(event, callback) {
  const id = Date.now() + Math.random()
  toastListeners.set(id, { event, callback })
  return () => toastListeners.delete(id)
}

function addToast(message, type = 'info', onClick) {
  const id = ++toastId
  toasts.value.push({ id, message, type, onClick })
  setTimeout(() => removeToast(id), 4000)
  return id
}

function handleToastClick(toast) {
  if (toast.onClick) toast.onClick()
  if (toastListeners.has('click')) {
    toastListeners.get('click').callback()
  }
  removeToast(toast.id)
}

function removeToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

function toastIcon(type) {
  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-times-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle',
  }
  return icons[type] || icons.info
}

// Cart
const showCart = computed(() => cartItems.value.length > 0)
const cartTotalItens = computed(() =>
  cartItems.value.reduce((acc, item) => acc + item.quantidade, 0)
)
const cartTotal = computed(() =>
  cartItems.value.reduce((acc, item) => acc + (parseFloat(item.subtotal) || 0), 0)
)

function formatPrice(value) {
  const num = parseFloat(value) || 0
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num)
}

function updateCart(items) {
  // Garantir que subtotais sejam números
  const normalized = items.map(item => ({
    ...item,
    subtotal: parseFloat(item.subtotal) || 0,
    preco_unitario: parseFloat(item.preco_unitario) || 0,
  }))
  cartItems.value = normalized
  // Save to localStorage
  localStorage.setItem('saborexpress_cart', JSON.stringify(normalized))
}

function restoreCart() {
  const saved = localStorage.getItem('saborexpress_cart')
  if (saved) {
    try {
      const items = JSON.parse(saved)
      cartItems.value = items.map(item => ({
        ...item,
        subtotal: parseFloat(item.subtotal) || 0,
        preco_unitario: parseFloat(item.preco_unitario) || 0,
      }))
    } catch { /* Ignore */ }
  }
}

// Abrir carrinho: se não estiver logado, redirecionar para login
function openCart() {
  if (!authStore.isAuthenticated) {
    addToast('Faça login para finalizar seu pedido.', 'info')
    $router.push('/auth')
    return
  }
  showCartDrawer.value = true
}

// Provide to children
provide('cartItems', cartItems)
provide('updateCart', updateCart)
provide('cartTotal', cartTotal)
provide('addToast', addToast)
provide('globalLoading', globalLoading)
provide('loadingMessage', loadingMessage)
provide('showCepModal', showCepModal)
provide('storeOpen', storeOpen)

onMounted(async () => {
  await authStore.checkSession()
  restoreCart()

  // CEP Onboarding: perguntar CEP na primeira visita
  const cepSalvo = localStorage.getItem('saborexpress_cep')
  if (!cepSalvo) {
    // Mostrar modal após um breve delay para não atrapalhar renderização
    setTimeout(() => {
      showCepModal.value = true
    }, 800)
  }

  // Conectar WebSocket
  const socket = connectRealtime()

  // Listeners
  onEvent('restaurante:status_loja', (data) => {
    storeOpen.value = data.status_loja
  })

  onEvent('pedido:atualizado', (data) => {
    if (data.cliente_id === authStore.user?.id) {
      addToast(`Pedido ${data.pedido_id}: ${statusLabel(data.status)}`, 'info')
    }
  })

  onEvent('mensagem:novo', () => {
    unreadMessages.value++
    addToast('💬 Nova mensagem da cozinha!', 'warning')
  })

  // Check store status
  try {
    const api = (await import('./services/api')).default
    const { data } = await api.get('/restaurante')
    storeOpen.value = data.status_loja
  } catch { /* Ignore */ }

    // PWA: Solicitar permissão de notificações após login
  if (authStore.isAuthenticated) {
    setTimeout(() => pedirPermissaoNotificacao(), 3000)
  }
})

// PWA: Pedir permissão de notificação push (não-bloqueante)
async function pedirPermissaoNotificacao() {
  if (!pushService.pushSupported()) return
  if (pushService.permissionStatus() === 'granted') return
  if (pushService.permissionStatus() === 'denied') return
  if (localStorage.getItem('saborexpress_push_declined')) return

  // Mostrar toast convidativo para ativar notificações
  addToast('🔔 Ative notificações para saber quando seu pedido ficar pronto! Toque aqui.', 'info')

  // Escuta o próximo toast click para ativar (fire once)
  let subscribed = false
  const unsubscribe = addToastListener('click', async () => {
    if (subscribed) return
    subscribed = true
    unsubscribe()
    const result = await pushService.subscribeToPush()
    if (result.sucesso) {
      addToast('🔔 Notificações ativadas com sucesso!', 'success')
    } else if (result.erro !== 'Permissão de notificação negada.') {
      addToast('Não foi possível ativar notificações.', 'warning')
    }
  })

  // Remove listener após 15s se não clicar
  setTimeout(unsubscribe, 15000)
}

function statusLabel(status) {
  const labels = {
    pendente: 'Aguardando confirmação',
    preparando: 'Sendo preparado',
    pronto_entrega: 'Saiu para entrega',
    em_transito: 'Entregador a caminho',
    cheguei_destino: 'Entregador chegou',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  }
  return labels[status] || status
}
</script>
