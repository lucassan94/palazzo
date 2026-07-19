<template>
  <div v-if="!authStore.isAuthenticated" class="login-page">
    <div class="login-card">
      <div class="logo"><i class="fas fa-utensils"></i></div>
      <h2>Painel Administrativo</h2>
      <p>Entre com suas credenciais de administrador</p>

      <div v-if="errorMsg" style="background:var(--error-light);color:var(--error);padding:0.75rem;border-radius:6px;font-size:0.85rem;margin-bottom:1rem;">
        {{ errorMsg }}
      </div>

      <form @submit.prevent="login">
        <div class="form-group"><label>E-mail</label><input v-model="email" type="email" required /></div>
        <div class="form-group"><label>Senha</label><input v-model="password" type="password" required minlength="8" /></div>
        <button type="submit" class="btn btn-primary btn-block" style="justify-content:center;width:100%;" :disabled="loading">
          {{ loading ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>
    </div>
  </div>

  <div v-else class="admin-layout">      <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-brand">
        <div class="logo"><i class="fas fa-crown"></i></div>
        <h2>Palazzo</h2>
        <button class="sidebar-toggle" @click="sidebarCollapsed = !sidebarCollapsed" :title="sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'">
          <i :class="sidebarCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left'"></i>
        </button>
      </div>
      <nav class="sidebar-nav">
        <button v-for="item in menuItems" :key="item.id"
          class="sidebar-item"
          :class="{ active: currentView === item.id }"
          @click="currentView = item.id"
        >
          <i :class="item.icon"></i>
          <span>{{ item.label }}</span>
        </button>
      </nav>
      <div style="margin-top:auto;border-top:1px solid rgba(255,255,255,0.1);padding:1rem;">
        <button class="sidebar-item" @click="logout">
          <i class="fas fa-sign-out-alt"></i>
          <span>Sair</span>
        </button>
      </div>
    </aside>

    <main class="admin-content">
      <div class="admin-header">
        <h1>{{ currentViewTitle }}</h1>
        <div class="admin-header-right">
          <div class="store-status" :class="storeOpen ? 'open' : 'closed'">
            <i class="fas fa-circle" style="font-size:8px;"></i>
            {{ storeOpen ? 'Loja Aberta' : 'Loja Fechada' }}
          </div>
          <span class="cargo-badge" :class="authStore.user?.cargo">
            {{ cargoLabel }}
          </span>
          <span style="color:var(--text-muted);font-size:0.85rem;">
            <i class="fas fa-user"></i> {{ authStore.user?.nome }}
          </span>
        </div>
      </div>

      <!-- Views -->
      <OrdersView v-if="currentView === 'pedidos'" @change-view="currentView = $event" />
      <ProdutosView v-if="currentView === 'produtos'" />
      <ClientesView v-if="currentView === 'clientes'" />
      <EntregadoresView v-if="currentView === 'entregadores'" />
      <RelatoriosView v-if="currentView === 'relatorios'" />
      <DashboardView v-if="currentView === 'dashboard'" />
      <ConfigView v-if="currentView === 'config'" />
    </main>

    <!-- Loading Overlay -->
    <div v-if="globalLoading" class="loading-overlay">
      <div class="spinner"></div>
      <span class="loading-text">{{ loadingMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, provide } from 'vue'
import { useAuthStore } from './stores/auth'
import { connectRealtime, onEvent, offEvent } from './services/realtime'
import api from './services/api'

import OrdersView from './views/OrdersView.vue'
import ProdutosView from './views/ProdutosView.vue'
import ClientesView from './views/ClientesView.vue'
import EntregadoresView from './views/EntregadoresView.vue'
import RelatoriosView from './views/RelatoriosView.vue'
import DashboardView from './views/DashboardView.vue'
import ConfigView from './views/ConfigView.vue'

const authStore = useAuthStore()
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const currentView = ref('pedidos')
const storeOpen = ref(true)

// Global loading
const globalLoading = ref(false)
const loadingMessage = ref('Carregando...')

// Sidebar toggle
const sidebarCollapsed = ref(false)

// Menu completo com cargos permitidos para cada seção
const allMenuItems = [
  { id: 'pedidos', label: 'Fila de Pedidos', icon: 'fas fa-clipboard-list', cargos: ['admin', 'gerente', 'chef', 'caixa'] },
  { id: 'produtos', label: 'Gerenciar Produtos', icon: 'fas fa-hamburger', cargos: ['admin', 'gerente', 'chef'] },
  { id: 'clientes', label: 'Clientes / CRM', icon: 'fas fa-users', cargos: ['admin', 'gerente', 'caixa'] },
  { id: 'entregadores', label: 'Entregadores', icon: 'fas fa-motorcycle', cargos: ['admin', 'gerente'] },
  { id: 'relatorios', label: 'Rel. Entregas', icon: 'fas fa-chart-bar', cargos: ['admin', 'gerente'] },
  { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-chart-pie', cargos: ['admin', 'gerente', 'caixa'] },
  { id: 'config', label: 'Configurações', icon: 'fas fa-cog', cargos: ['admin', 'gerente'] },
]

// Sidebar filtrada pelo cargo do usuário logado
const menuItems = computed(() => {
  const cargo = authStore.user?.cargo
  if (!cargo) return allMenuItems
  return allMenuItems.filter(item => item.cargos.includes(cargo))
})

// Título da view atual
const currentViewTitle = computed(() => {
  const item = allMenuItems.find(i => i.id === currentView.value)
  return item?.label || ''
})

// Label do cargo
const cargoLabel = computed(() => {
  const labels = { admin: 'Admin', gerente: 'Gerente', chef: 'Chef', caixa: 'Caixa' }
  return labels[authStore.user?.cargo] || authStore.user?.cargo || ''
})

// Se a view atual não estiver disponível para o cargo, redireciona para a primeira disponível
function safeRedirect() {
  const items = menuItems.value
  if (items.length > 0 && !items.find(i => i.id === currentView.value)) {
    currentView.value = items[0].id
  }
}

async function login() {
  loading.value = true; errorMsg.value = ''
  try {
    const apiAuth = (await import('./services/api')).default
    const { data } = await apiAuth.post('/auth/restaurante/login', { email: email.value, password: password.value })
    authStore.user = data.user
  } catch (err) { errorMsg.value = err.response?.data?.error || 'Erro ao fazer login.' }
  finally { loading.value = false }
}

function logout() {
  authStore.user = null
  api.post('/auth/logout').catch(() => {})
  window.location.href = '/'
}

// Provide global loading state
provide('globalLoading', globalLoading)
provide('loadingMessage', loadingMessage)

onMounted(async () => {
  await authStore.checkSession()
  safeRedirect()
  const socket = connectRealtime()
  
  onEvent('restaurante:status_loja', (data) => { storeOpen.value = data.status_loja })
  onEvent('restaurante:atualizado', (data) => { /* refresh */ })

  try {
    const { data } = await api.get('/restaurante')
    storeOpen.value = data.status_loja
  } catch { /* ignore */ }

})

// Watch para recalcular rota se o cargo mudar
watch(() => authStore.user?.cargo, () => {
  safeRedirect()
})
</script>

<style scoped>
.cargo-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cargo-badge.admin {
  background: #fef3c7;
  color: #92400e;
}

.cargo-badge.gerente {
  background: #dbeafe;
  color: #1e40af;
}

.cargo-badge.chef {
  background: #ede9fe;
  color: #5b21b6;
}

.cargo-badge.caixa {
  background: #dcfce7;
  color: #166534;
}
</style>
