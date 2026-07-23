<template>
  <div v-if="!user">
    <div class="login-page">
      <div class="login-card">
        <div class="icon"><i class="fas fa-motorcycle"></i></div>
        <h2>🏍️ Driver App</h2>
        <p>Entre com suas credenciais de entregador</p>
        <div v-if="errorMsg" style="background:#fee2e2;color:#991b1b;padding:0.75rem;border-radius:6px;font-size:0.85rem;margin-bottom:1rem;">{{ errorMsg }}</div>
        <form @submit.prevent="login">
          <div class="form-group"><label>E-mail</label><input v-model="email" type="email" required /></div>
          <div class="form-group"><label>Senha</label><input v-model="password" type="password" required minlength="8" /></div>
          <button type="submit" class="btn btn-primary btn-block" :disabled="loading">{{ loading ? 'Entrando...' : 'Entrar' }}</button>
        </form>
      </div>
    </div>
  </div>

  <div v-else>
    <!-- Header -->
    <div class="app-header">
      <div class="header-left">
        <div class="avatar">{{ initials }}</div>
        <div>
          <div class="header-name">{{ user.nome }}</div>
          <div class="header-status"><i class="fas fa-circle" style="font-size:6px;"></i> Em serviço</div>
        </div>
      </div>
      <button style="background:none;border:none;color:var(--text-muted);font-size:1.2rem;" @click="logout"><i class="fas fa-sign-out-alt"></i></button>
    </div>

    <!-- Stats Summary -->
    <div class="stats-grid">
      <div class="stat-card"><div class="label">Entregas</div><div class="value">{{ user.entregasTotal || 0 }}</div></div>
      <div class="stat-card"><div class="label">Fretes Recebidos</div><div class="value">{{ formatPrice(user.freteTotal || 0) }}</div></div>
    </div>

    <!-- Content -->
    <div class="content">
      <div v-if="currentTab === 'entregas'">
        <h3 class="section-title"><i class="fas fa-motorcycle"></i> Entregas</h3>
        <div v-if="entregasDisponiveis.length" class="section-title" style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.5rem;">
          {{ entregasDisponiveis.length }} entrega(s) disponível(is)
        </div>
        <div v-if="entregaAtiva" class="delivery-card" :class="getStatusClass(entregaAtiva.status)">
          <div class="delivery-header">
            <strong>{{ entregaAtiva.pedido_id }}</strong>
            <span class="delivery-status">{{ statusLabel(entregaAtiva.status) }}</span>
          </div>
          <div class="delivery-address">
            <i class="fas fa-store"></i>
            <span>SaborExpress Cozinha — Av. Principal, 500</span>
          </div>
          <div class="delivery-address">
            <i class="fas fa-map-marker-alt"></i>
            <span><strong>{{ entregaAtiva.nome_cliente }}</strong><br />{{ entregaAtiva.endereco_cliente }}, {{ entregaAtiva.numero_cliente }}<br />{{ entregaAtiva.bairro_cliente }}</span>
          </div>
          <div class="delivery-meta">
            {{ entregaAtiva.itens?.slice(0,3).map(i => `${i.quantidade}x ${i.nome_produto}`).join(', ') }}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span class="delivery-fee">{{ formatPrice(entregaAtiva.valor_frete) }}</span>
            <span v-if="tempoTolerancia > 0" style="font-size:0.85rem;color:var(--warning);">
              <i class="fas fa-hourglass-half"></i> {{ tempoTolerancia }}s
            </span>
          </div>
          <button v-if="entregaAtiva.status === 'pronto_entrega'" class="btn-delivery primary" @click="coletar(entregaAtiva)">
            <i class="fas fa-rocket"></i> Coletar & Iniciar Rota
          </button>
          <button v-if="entregaAtiva.status === 'em_transito'" class="btn-delivery secondary" @click="chegarDestino(entregaAtiva)">
            <i class="fas fa-map-pin"></i> Cheguei ao Destino
          </button>
          <button v-if="entregaAtiva.status === 'cheguei_destino'" class="btn-delivery success" @click="confirmarEntrega(entregaAtiva)">
            <i class="fas fa-check"></i> Confirmar Entrega
          </button>
        </div>

        <!-- Available deliveries -->
        <div v-for="entrega in entregasDisponiveis" :key="entrega.id" class="delivery-card pending" @click="showDetails(entrega)">
          <div class="delivery-header">
            <strong>{{ entrega.pedido_id }}</strong>
            <span class="delivery-status">Pronto para Entrega</span>
          </div>
          <div class="delivery-address">
            <i class="fas fa-map-marker-alt"></i>
            <span><strong>{{ entrega.nome_cliente }}</strong><br />{{ entrega.endereco_cliente }}, {{ entrega.numero_cliente }}</span>
          </div>
          <div class="delivery-meta">{{ entrega.itens?.length }} item(ns)</div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="delivery-fee">{{ formatPrice(entrega.valor_frete) }}</span>
            <button class="btn-delivery primary" style="width:auto;padding:0.5rem 1rem;" @click.stop="assumirEntrega(entrega)">
              <i class="fas fa-hand-paper"></i> Pegar
            </button>
          </div>
        </div>

        <div v-if="!entregaAtiva && entregasDisponiveis.length === 0" style="text-align:center;padding:3rem;color:var(--text-muted);">
          <i class="fas fa-motorcycle" style="font-size:3rem;margin-bottom:1rem;opacity:0.3;"></i>
          <p>Nenhuma entrega disponível no momento.</p>
          <p style="font-size:0.85rem;">As entregas aparecerão aqui automaticamente.</p>
        </div>

        <!-- Completed Today -->
        <div v-if="entregasConcluidas.length" style="margin-top:1.5rem;">
          <h3 class="section-title" style="font-size:0.9rem;color:var(--text-muted);">Entregues Hoje</h3>
          <div v-for="e in entregasConcluidas" :key="e.id" class="delivery-card done">
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;">
              <span><strong>{{ e.pedido_id }}</strong> — {{ e.nome_cliente }}</span>
              <span class="delivery-fee" style="font-size:0.95rem;">{{ formatPrice(e.valor_frete) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="currentTab === 'financeiro'">
        <h3 class="section-title"><i class="fas fa-wallet"></i> Extrato Financeiro</h3>

        <!-- Summary: HOJE + Total do Mês -->
        <div class="stats-grid" style="grid-template-columns:1fr 1fr;">
          <div class="stat-card" style="text-align:center;">
            <div class="label">Hoje</div>
            <div class="value" style="font-size:1.5rem;">{{ formatPrice(financeiro.hoje) }}</div>
          </div>
          <div class="stat-card" style="text-align:center;">
            <div class="label">Entregas no Mês</div>
            <div class="value" style="font-size:1.5rem;">{{ financeiro.entregas_mes ?? 0 }}</div>
          </div>
        </div>

        <!-- Lista de dias do mês -->
        <div v-if="financeiro.dias?.length" style="margin-top:1rem;">
          <div class="section-title" style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.5rem;">
            <i class="fas fa-calendar-alt"></i> Dias com entregas
          </div>
          <div
            v-for="dia in financeiro.dias"
            :key="dia.data"
            class="day-row"
            @click="abrirDetalheDia(dia.data)"
          >
            <div class="day-row-left">
              <div class="day-date">{{ formatDate(dia.data) }}</div>
              <div class="day-label">{{ dia.entregas }} {{ dia.entregas === 1 ? 'entrega' : 'entregas' }}</div>
            </div>
            <div class="day-row-right">
              <span class="day-total">{{ formatPrice(dia.total_frete) }}</span>
              <i class="fas fa-chevron-right day-arrow"></i>
            </div>
          </div>
        </div>

        <!-- Mês vazio -->
        <div v-else style="text-align:center;padding:2rem;color:var(--text-muted);">
          <i class="fas fa-inbox" style="font-size:2rem;margin-bottom:0.75rem;opacity:0.3;"></i>
          <p>Nenhuma entrega neste mês.</p>
        </div>
      </div>

      <!-- Modal de detalhamento do dia -->
      <div v-if="diaDetalhes" class="modal-overlay" @click.self="diaDetalhes = null">
        <div class="modal-content" style="max-width:480px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
            <h3 style="margin:0;">
              <i class="fas fa-calendar-day"></i>
              {{ formatDate(diaDetalhes.data) }}
            </h3>
            <span style="font-size:1.1rem;font-weight:800;color:var(--primary);">
              {{ formatPrice(diaDetalhes.total_frete) }}
            </span>
          </div>
          <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem;">
            {{ diaDetalhes.entregas }} {{ diaDetalhes.entregas === 1 ? 'entrega finalizada' : 'entregas finalizadas' }}
          </p>

          <div
            v-for="item in diaDetalhes.itens"
            :key="item.id"
            class="delivery-card done"
            style="margin-bottom:0.5rem;"
          >
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div>
                <strong>{{ item.pedido_id }}</strong>
                <div style="font-size:0.8rem;color:var(--text-muted);">
                  {{ item.nome_cliente }}<br />
                  {{ item.endereco_cliente }}, {{ item.numero_cliente }} — {{ item.bairro_cliente }}
                </div>
              </div>
              <span class="delivery-fee" style="font-size:1rem;">{{ formatPrice(item.valor_frete) }}</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">
              <i class="fas fa-clock"></i> {{ formatHora(item.entregue_em) }}
            </div>
          </div>

          <button class="btn btn-secondary btn-block" style="margin-top:1rem;" @click="diaDetalhes = null">
            Fechar
          </button>
        </div>
      </div>

      <div v-if="currentTab === 'perfil'">
        <h3 class="section-title"><i class="fas fa-user"></i> Perfil</h3>
        <div style="padding:0 1rem;">
          <div class="form-group"><label>Nome</label><input v-model="profile.nome" /></div>
          <div class="form-group"><label>Telefone</label><input v-model="profile.telefone" /></div>
          <div class="form-group"><label>Endereço</label><textarea v-model="profile.endereco" rows="2"></textarea></div>
          <button class="btn btn-primary btn-block" @click="salvarPerfil">Salvar Alterações</button>
          <div v-if="msgPerfil" style="margin-top:0.75rem;padding:0.6rem;border-radius:6px;font-size:0.85rem;background:var(--success-light);color:var(--success-dark);">{{ msgPerfil }}</div>
        </div>
      </div>
    </div>

    <!-- Bottom Nav -->
    <nav class="bottom-nav">
      <button class="nav-item" :class="{ active: currentTab === 'entregas' }" @click="currentTab = 'entregas'">
        <i class="fas fa-motorcycle"></i>
        Entregas
        <span v-if="entregasDisponiveis.length" class="badge">{{ entregasDisponiveis.length }}</span>
      </button>
      <button class="nav-item" :class="{ active: currentTab === 'financeiro' }" @click="currentTab = 'financeiro'">
        <i class="fas fa-wallet"></i>
        Financeiro
      </button>
      <button class="nav-item" :class="{ active: currentTab === 'perfil' }" @click="currentTab = 'perfil'">
        <i class="fas fa-user"></i>
        Perfil
      </button>
    </nav>

    <!-- Detail Modal -->
    <div v-if="selectedEntrega" class="modal-overlay" @click.self="selectedEntrega = null">
      <div class="modal-content">
        <h3>{{ selectedEntrega.pedido_id }}</h3>
        <div class="profile-section" style="margin-top:1rem;">
          <div class="profile-section-title">Cliente</div>
          <p style="font-size:0.85rem;">{{ selectedEntrega.nome_cliente }}<br />{{ selectedEntrega.telefone_cliente }}<br />{{ selectedEntrega.endereco_cliente }}, {{ selectedEntrega.numero_cliente }}<br />{{ selectedEntrega.bairro_cliente }}</p>
        </div>
        <div class="profile-section"><div class="profile-section-title">Pagamento</div><p style="font-size:0.85rem;">{{ paymentLabel(selectedEntrega.metodo_pagamento) }}</p></div>
        <div class="profile-section"><div class="profile-section-title">Itens</div>
          <div v-for="item in selectedEntrega.itens" :key="item.id" style="font-size:0.85rem;margin-bottom:4px;">
            {{ item.quantidade }}x {{ item.nome_produto }}
          </div>
        </div>
        <div class="order-summary" style="background:var(--border-light);padding:0.75rem;border-radius:8px;margin-top:0.75rem;">
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;"><span>Subtotal:</span><span>{{ formatPrice(selectedEntrega.subtotal) }}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-top:4px;"><span>Frete:</span><span style="color:var(--primary);font-weight:700;">{{ formatPrice(selectedEntrega.valor_frete) }}</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:800;font-size:1rem;padding-top:6px;margin-top:6px;border-top:2px solid var(--border);"><span>Total:</span><span>{{ formatPrice(selectedEntrega.total) }}</span></div>
        </div>
        <button class="btn btn-secondary btn-block" style="margin-top:1rem;" @click="selectedEntrega = null">Fechar</button>
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
import { ref, computed, reactive, onMounted, onUnmounted, provide } from 'vue'
import api from './services/api'
import { connectRealtime, onEvent, offEvent } from './services/realtime'

const user = ref(null)
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const currentTab = ref('entregas')

// Global loading
const globalLoading = ref(false)
const loadingMessage = ref('Carregando...')

provide('globalLoading', globalLoading)
provide('loadingMessage', loadingMessage)

const entregasDisponiveis = ref([])
const entregaAtiva = ref(null)
const entregasConcluidas = ref([])
const selectedEntrega = ref(null)
const tempoTolerancia = ref(0)
const financeiro = ref({ hoje: 0, semana: 0, mes: 0, dias: [] })
const diaDetalhes = ref(null)
const profile = reactive({ nome: '', telefone: '', endereco: '' })
const msgPerfil = ref('')

let toleranceTimer = null

const initials = computed(() => {
  if (!user.value?.nome) return '?'
  return user.value.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
})

function formatPrice(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }

function statusLabel(s) {
  const l = { pronto_entrega: 'Pronto para Entrega', em_transito: 'Em Trânsito', cheguei_destino: 'Cheguei ao Destino', entregue: 'Entregue' }
  return l[s] || s
}

function getStatusClass(s) {
  const c = { pronto_entrega: 'pending', em_transito: 'transit', cheguei_destino: 'arrived', entregue: 'done' }
  return c[s] || ''
}

function paymentLabel(m) { const l = { credito: 'Cartão Crédito', debito: 'Cartão Débito', dinheiro: 'Dinheiro', pix: 'PIX' }; return l[m] || m }

async function login() {
  loading.value = true; errorMsg.value = ''
  try {
    const { data } = await api.post('/auth/entregador/login', { email: email.value, password: password.value })
    user.value = data.user
    await loadData()
    connectSocket()
  } catch (err) { errorMsg.value = err.response?.data?.error || 'Erro ao fazer login.' }
  finally { loading.value = false }
}

function logout() {
  api.post('/auth/logout')
  user.value = null
  localStorage.removeItem('saborexpress_entregador_token')
  location.reload()
}

async function loadData() {
  try {
    const [p, e, f] = await Promise.all([
      api.get('/pedidos?status=pronto_entrega'),
      api.get('/entregadores/me'),
      api.get('/entregadores/me/financeiro'),
    ])
    entregasDisponiveis.value = p.data.filter(ee => !ee.entregador_id)
    financeiro.value = f.data || { hoje: 0, semana: 0, mes: 0, dias: [] }
    user.value = { ...user.value, ...e.data }
    profile.nome = e.data.nome || ''
    profile.telefone = e.data.telefone || ''
    profile.endereco = e.data.endereco || ''

    // Check active delivery
    const ativos = await api.get('/pedidos?status=em_transito,cheguei_destino')
    const minha = ativos.data.find(ee => ee.entregador_id === user.value?.id)
    if (minha) {
      entregaAtiva.value = minha
      if (minha.status === 'cheguei_destino') startTolerance()
    }

    // Completed today
    const concluidos = await api.get('/pedidos?status=entregue')
    const hoje = new Date().toISOString().split('T')[0]
    entregasConcluidas.value = concluidos.data.filter(ee =>
      ee.entregador_id === user.value?.id &&
      ee.entregue_em?.startsWith(hoje)
    )
  } catch { /* ignore */ }
}

function connectSocket() {
  const socket = connectRealtime()
  onEvent('pedido:atualizado', () => loadData())
  onEvent('entrega:disponivel', () => loadData())
}

async function assumirEntrega(entrega) {
  try {
    await api.patch(`/pedidos/${entrega.id}/status`, { status: 'em_transito', entregador_id: user.value.id })
    entregaAtiva.value = { ...entrega, status: 'em_transito', entregador_id: user.value.id }
    entregasDisponiveis.value = entregasDisponiveis.value.filter(e => e.id !== entrega.id)
  } catch (err) { alert(err.response?.data?.error || 'Erro') }
}

async function coletar(entrega) {
  try {
    await api.patch(`/pedidos/${entrega.id}/status`, { status: 'em_transito' })
    entregaAtiva.value.status = 'em_transito'
  } catch { alert('Erro') }
}

async function chegarDestino(entrega) {
  try {
    await api.patch(`/pedidos/${entrega.id}/status`, { status: 'cheguei_destino' })
    entregaAtiva.value.status = 'cheguei_destino'
    startTolerance()
  } catch { alert('Erro') }
}

async function confirmarEntrega(entrega) {
  try {
    await api.patch(`/pedidos/${entrega.id}/status`, { status: 'entregue' })
    entregasConcluidas.value.unshift(entregaAtiva.value)
    entregaAtiva.value = null
    clearInterval(toleranceTimer)
    loadData()
  } catch { alert('Erro') }
}

function startTolerance() {
  tempoTolerancia.value = 300 // 5 min
  clearInterval(toleranceTimer)
  toleranceTimer = setInterval(() => {
    tempoTolerancia.value--
    if (tempoTolerancia.value <= 0) {
      clearInterval(toleranceTimer)
      tempoTolerancia.value = 0
    }
  }, 1000)
}

function showDetails(entrega) { selectedEntrega.value = entrega }

async function abrirDetalheDia(data) {
  try {
    const { data: detalhes } = await api.get(`/entregadores/me/financeiro/dia/${data}`)
    diaDetalhes.value = detalhes
  } catch {
    // silent
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const diaSem = diasSemana[d.getDay()]
  const dia = d.getDate().toString().padStart(2, '0')
  const mes = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${diaSem}, ${dia}/${mes}`
}

function formatHora(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

async function salvarPerfil() {
  try {
    await api.put('/entregadores/me', { ...profile })
    msgPerfil.value = 'Perfil atualizado com sucesso!'
    setTimeout(() => msgPerfil.value = '', 3000)
  } catch { msgPerfil.value = 'Erro ao salvar.' }
}

onMounted(() => {
  // Try to restore session
  const token = document.cookie.match(/(^| )publicToken=([^;]+)/)?.[2]
  if (token) {
    api.get('/auth/me').then(({ data }) => {
      // Isolamento: só aceita sessão de entregador
      if (data.user?.role !== 'entregador') return
      user.value = data.user
      loadData()
      connectSocket()
    }).catch(() => {})
  }
})

onUnmounted(() => {
  clearInterval(toleranceTimer)
  offEvent('pedido:atualizado')
  offEvent('entrega:disponivel')
})
</script>
<style scoped>
.profile-section-title {
  font-size: 0.8rem; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.5rem;
  padding-bottom: 0.3rem; border-bottom: 1px solid var(--border);
}

/* Day row for financial list */
.day-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.85rem 1rem; margin-bottom: 4px;
  background: var(--card-bg); border-radius: var(--radius);
  border: 1px solid var(--border-light);
  cursor: pointer; transition: var(--transition);
}
.day-row:hover {
  border-color: var(--primary); background: var(--primary-light);
  transform: translateX(3px);
}
.day-row:active {
  transform: translateX(3px) scale(0.99);
}
.day-row-left { display: flex; flex-direction: column; gap: 2px; }
.day-date { font-weight: 700; font-size: 0.95rem; }
.day-label { font-size: 0.78rem; color: var(--text-muted); }
.day-row-right { display: flex; align-items: center; gap: 10px; }
.day-total { font-weight: 800; font-size: 1.05rem; color: var(--primary); }
.day-arrow { font-size: 0.8rem; color: var(--text-muted); }
</style>
