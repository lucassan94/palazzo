<template>
  <div class="drawer-body">
    <div class="checkout-steps" v-if="currentStep > 0">
      <div
        v-for="step in 4"
        :key="step"
        class="step-indicator"
        :class="{ active: step === currentStep, completed: step < currentStep }"
      ></div>
    </div>

    <!-- Step 0: Cart Items -->
    <div v-if="currentStep === 0" class="checkout-step active">
      <div v-if="cartItems.length === 0" class="empty-cart-drawer text-center">
        <i class="fas fa-shopping-bag"></i>
        <p>Seu carrinho está vazio</p>
      </div>

      <div v-for="(item, index) in cartItems" :key="index" class="cart-item">
        <div class="cart-item-info">
          <h4>{{ item.nome_produto }}</h4>
          <div v-if="item.extras.length > 0" class="extras">
            + {{ item.extras.map(e => e.nome).join(', ') }}
          </div>
          <div class="cart-item-qty mt-1">
            <button @click="decreaseQty(index)" :disabled="item.quantidade <= 1">−</button>
            <span style="font-weight:700;min-width:24px;text-align:center;">{{ item.quantidade }}</span>
            <button @click="increaseQty(index)">+</button>
          </div>
        </div>
        <div class="cart-item-right">
          <div class="cart-item-total">{{ formatPrice(item.subtotal) }}</div>
          <button class="cart-item-remove" @click="removeItem(index)" title="Remover">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>

      <div v-if="cartItems.length > 0" class="mt-3">
        <div class="order-summary-row">
          <span>Subtotal:</span>
          <span>{{ formatPrice(subtotal) }}</span>
        </div>
        <button class="btn btn-primary btn-block mt-3" @click="prosseguirDoCarrinho()">
          Continuar <i class="fas fa-arrow-right"></i>
        </button>
      </div>
    </div>

    <!-- Step 1: Customer Data -->
    <div v-if="currentStep === 1" class="checkout-step active">
      <h4><i class="fas fa-user"></i> Seus Dados</h4>

      <div class="form-row">
        <div class="form-group">
          <label>Nome</label>
          <input v-model="form.nome" type="text" placeholder="Seu nome" required />
        </div>
        <div class="form-group">
          <label>Sobrenome</label>
          <input v-model="form.sobrenome" type="text" placeholder="Sobrenome" />
        </div>
      </div>

      <div class="form-group">
        <label>Telefone / WhatsApp</label>
        <input v-model="form.telefone" type="tel" placeholder="(11) 99999-9999" required />
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" @click="currentStep = 0">Voltar</button>
        <button class="btn btn-primary flex-1" @click="goToStep2">Continuar</button>
      </div>
    </div>

    <!-- Step 2: Address -->
    <div v-if="currentStep === 2" class="checkout-step active">
      <h4><i class="fas fa-map-marker-alt"></i> Endereço de Entrega</h4>

      <div class="cep-row">
        <div class="form-group m-0">
          <label>CEP</label>
          <input v-model="form.cep" type="text" maxlength="9" placeholder="00000-000" @input="formatCEP" />
        </div>
        <div class="flex-end">
          <button class="btn btn-secondary btn-tall" @click="buscarCEP" :disabled="buscandoCEP">
            {{ buscandoCEP ? '...' : 'Buscar' }}
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>Logradouro</label>
        <input v-model="form.endereco" type="text" placeholder="Rua, Avenida..." required />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Número</label>
          <input v-model="form.numero" type="text" placeholder="123" required />
        </div>
        <div class="form-group">
          <label>Bairro</label>
          <input v-model="form.bairro" type="text" placeholder="Bairro" required />
        </div>
      </div>

      <div class="form-group">
        <label>Complemento (opcional)</label>
        <input v-model="form.complemento" type="text" placeholder="Apto, Bloco..." />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Cidade</label>
          <input v-model="form.cidade" type="text" placeholder="São Paulo" />
        </div>
        <div class="form-group">
          <label>Estado</label>
          <input v-model="form.estado" type="text" placeholder="SP" maxlength="2" />
        </div>
      </div>

      <!-- Frete Info -->
      <div v-if="freteInfo" class="cep-result success">
        <i class="fas fa-truck"></i>
        <strong>{{ freteInfo.distancia_km ? `~${freteInfo.distancia_km}km — ` : '' }}
        {{ freteInfo.tempo_min }}-{{ freteInfo.tempo_max }}min</strong>
        <br />Frete: {{ formatPrice(freteInfo.custo) }}
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" @click="currentStep = 1">Voltar</button>
        <button class="btn btn-primary flex-1" @click="goToStep3">Continuar</button>
      </div>
    </div>

    <!-- Step 3: Payment -->
    <div v-if="currentStep === 3" class="checkout-step active">
      <h4>Forma de Pagamento</h4>

      <div class="form-group">
        <select v-model="form.metodo_pagamento">
          <option value="credito">Cartão de Crédito (na entrega)</option>
          <option value="debito">Cartão de Débito (na entrega)</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="pix_online">PIX Online</option>
          <option value="credito_online">Cartão de Crédito Online</option>
        </select>
      </div>

      <div v-if="form.metodo_pagamento === 'dinheiro'" class="form-group">
        <label>Precisa de troco para quanto?</label>
        <input v-model="form.troco" type="number" min="0" step="0.01" placeholder="Ex: 50,00" />
      </div>

      <div v-if="form.metodo_pagamento === 'pix_online' || form.metodo_pagamento === 'credito_online'" class="credit-card-form">
        <h4 class="mt-3 mb-2" style="font-size:0.95rem;border-bottom:1px solid var(--border);padding-bottom:6px;">
          <i class="fas fa-id-card"></i> Dados do Pagador
        </h4>
        <div class="form-group">
          <label>CPF</label>
          <input v-model="card.cpfCnpj" maxlength="14" placeholder="000.000.000-00"
                 @input="card.cpfCnpj = card.cpfCnpj.replace(/\D/g,'').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4').substring(0,14)" />
        </div>
      </div>

      <!-- Cartão de Crédito Online: campos do cartão -->
      <div v-if="form.metodo_pagamento === 'credito_online'" class="credit-card-form">
        <h4 class="mt-3 mb-2" style="font-size:0.95rem;border-bottom:1px solid var(--border);padding-bottom:6px;">
          <i class="fas fa-credit-card"></i> Dados do Cartão
        </h4>
        <div class="form-group">
          <label>Número do Cartão</label>
          <input v-model="card.number" maxlength="19" placeholder="0000 0000 0000 0000"
                 @input="card.number = card.number.replace(/\D/g,'').replace(/(.{4})/g,'$1 ').trim().substring(0,19)" />
        </div>
        <div class="form-group">
          <label>Nome no Cartão</label>
          <input v-model="card.holderName" placeholder="Nome como impresso no cartão" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Validade (MM/AA)</label>
            <input v-model="card.expiry" maxlength="5" placeholder="MM/AA"
                   @input="card.expiry = card.expiry.replace(/\D/g,'').replace(/^(\d{2})(\d)/,'$1/$2').substring(0,5)" />
          </div>
          <div class="form-group">
            <label>CVV</label>
            <input v-model="card.cvv" maxlength="4" type="password" placeholder="***"
                   inputmode="numeric" pattern="[0-9]*"
                   @input="card.cvv = card.cvv.replace(/\D/g,'').substring(0,4)" />
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>Observações do Pedido</label>
        <textarea
          v-model="form.observacoes"
          rows="2"
          placeholder="Sem cebola, molho extra, ponto da carne..."
        ></textarea>
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" @click="currentStep = 2">Voltar</button>
        <button class="btn btn-primary flex-1" @click="goToStep4">Continuar</button>
      </div>
    </div>

    <!-- Step 4: Review & Confirm -->
    <div v-if="currentStep === 4" class="checkout-step active">
      <h4><i class="fas fa-check-circle"></i> Revisar Pedido</h4>

      <div class="profile-section">
        <div class="profile-section-title">Itens</div>
        <div v-for="(item, i) in cartItems" :key="i" class="review-item">
          {{ item.quantidade }}x {{ item.nome_produto }}
          <span v-if="item.extras.length">(+ {{ item.extras.map(e => e.nome).join(', ') }})</span>
          <span class="review-item-price">{{ formatPrice(item.subtotal) }}</span>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Endereço</div>        <p style="font-size:0.9rem;">
          {{ form.endereco }}, {{ form.numero }}{{ form.complemento ? ' - ' + form.complemento : '' }}<br />{{ form.bairro }} - {{ form.cidade }}/{{ form.estado }}<br />CEP: {{ form.cep }}
        </p>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Pagamento</div>
        <p style="font-size:0.9rem;">
          {{ pagamentoLabel }}
          <span v-if="form.metodo_pagamento === 'dinheiro' && form.troco">
            <br />Troco para R$ {{ parseFloat(form.troco).toFixed(2) }}
          </span>
        </p>
      </div>

      <div v-if="form.observacoes" class="profile-section">
        <div class="profile-section-title">Observações</div>
        <p style="font-size:0.9rem;">{{ form.observacoes }}</p>
      </div>

      <div class="order-summary">
        <div class="order-summary-row">
          <span>Subtotal:</span>
          <span>{{ formatPrice(subtotal) }}</span>
        </div>
        <div class="order-summary-row">
          <span>Taxa de Entrega:</span>
          <span>{{ formatPrice(freteInfo?.custo || 0) }}</span>
        </div>
        <div class="order-summary-total">
          <span>Total:</span>
          <span>{{ formatPrice(subtotal + (freteInfo?.custo || 0)) }}</span>
        </div>
      </div>

      <div v-if="freteInfo" class="est-time-footer">
        <i class="fas fa-clock"></i> Tempo estimado: {{ freteInfo.tempo_preparo + freteInfo.tempo_min }}min a {{ freteInfo.tempo_preparo + freteInfo.tempo_max }}min
      </div>

      <div v-if="!authStore.isAuthenticated" class="cep-result warning login-notice">
        <i class="fas fa-info-circle"></i>
        Você precisa estar logado para finalizar o pedido.
        <button class="btn btn-primary btn-block mt-1" @click="$router.push('/auth')">
          Fazer Login / Cadastrar
        </button>
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" @click="currentStep = 3">Voltar</button>
        <button
          class="btn btn-success flex-1"
          @click="confirmOrder"
          :disabled="submitting || !authStore.isAuthenticated"
        >
          <i class="fas fa-check"></i>
          {{ submitting ? 'Enviando...' : 'Confirmar Pedido' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, inject, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { criarPagamento } from '../services/api'
import api from '../services/api'

const emit = defineEmits(['close'])
const router = useRouter()
const authStore = useAuthStore()
const addToast = inject('addToast')
const globalLoading = inject('globalLoading')
const loadingMessage = inject('loadingMessage')
const cartItems = inject('cartItems')
const updateCart = inject('updateCart')

const currentStep = ref(0)
const buscandoCEP = ref(false)
const submitting = ref(false)
const freteInfo = ref(null)

// Carregar CEP salvo do localStorage (do onboarding)
const savedCep = localStorage.getItem('saborexpress_cep') || ''

const form = reactive({
  nome: authStore.user?.nome || '',
  sobrenome: authStore.user?.sobrenome || '',
  telefone: authStore.user?.telefone || '',
  cep: authStore.user?.cep || savedCep,
  endereco: authStore.user?.endereco || '',
  numero: authStore.user?.numero || '',
  bairro: authStore.user?.bairro || '',
  complemento: authStore.user?.complemento || '',
  cidade: authStore.user?.cidade || 'São Paulo',
  estado: authStore.user?.estado || 'SP',
  metodo_pagamento: 'credito',
  troco: '',
  observacoes: '',
})

// Dados do cartão de crédito online
const card = reactive({
  holderName: '',
  number: '',
  expiry: '',
  cvv: '',
  cpfCnpj: authStore.user?.cpf_cnpj || '',
})

// Determinar se usuário logado já tem dados completos
const userDataComplete = computed(() => {
  return !!(authStore.user?.nome && authStore.user?.telefone)
})

const userAddressComplete = computed(() => {
  return !!(authStore.user?.endereco && authStore.user?.numero && authStore.user?.bairro)
})

// Pular etapas já preenchidas quando o authStore.user for populado (reativo)
watch(() => authStore.isAuthenticated, (logado) => {
  if (logado && userDataComplete.value) {
    currentStep.value = userAddressComplete.value ? 3 : 2
  }
}, { immediate: true })

// Preencher formulário com dados do usuário quando disponíveis
watch(() => authStore.user, (u) => {
  if (!u) return
  Object.assign(form, {
    nome: u.nome || form.nome,
    sobrenome: u.sobrenome || form.sobrenome,
    telefone: u.telefone || form.telefone,
    cep: u.cep || form.cep,
    endereco: u.endereco || form.endereco,
    numero: u.numero || form.numero,
    bairro: u.bairro || form.bairro,
    complemento: u.complemento || form.complemento,
    cidade: u.cidade || form.cidade || 'São Paulo',
    estado: u.estado || form.estado || 'SP',
  })
  // Também preencher CPF do cartão se disponível (com máscara)
  if (u.cpf_cnpj) {
    const raw = u.cpf_cnpj.replace(/\D/g, '')
    card.cpfCnpj = raw.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
}, { immediate: false })

const subtotal = computed(() =>
  cartItems.value.reduce((acc, item) => acc + (parseFloat(item.subtotal) || 0), 0)
)

const pagamentoLabel = computed(() => {
  const labels = {
    credito: 'Cartão de Crédito (na entrega)',
    debito: 'Cartão de Débito (na entrega)',
    dinheiro: 'Dinheiro',
    pix_online: 'PIX Online',
    credito_online: 'Cartão de Crédito Online',
  }
  return labels[form.metodo_pagamento] || form.metodo_pagamento
})

// Avançar do carrinho pulando etapas já preenchidas
function prosseguirDoCarrinho() {
  if (authStore.isAuthenticated && userDataComplete.value) {
    currentStep.value = userAddressComplete.value ? 3 : 2
  } else {
    currentStep.value = 1
  }
}

function formatPrice(value) {
  const num = parseFloat(value) || 0
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

function formatCEP() {
  form.cep = form.cep.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9)
}

// Auto-buscar CEP ao digitar 8 dígitos (com debounce)
let cepTimeout = null
watch(() => form.cep, (val) => {
  if (cepTimeout) clearTimeout(cepTimeout)
  const cep = val.replace(/\D/g, '')
  if (cep.length === 8) {
    cepTimeout = setTimeout(() => {
      buscarCEP()
    }, 400)
  }
})

// Também buscar se CEP já estava preenchido (ao entrar na etapa de endereço)
watch(() => currentStep.value, (step) => {
  if (step === 2) {
    const cep = form.cep.replace(/\D/g, '')
    if (cep.length === 8 && !freteInfo.value) {
      buscarCEP()
    }
  }
})

onUnmounted(() => {
  if (cepTimeout) clearTimeout(cepTimeout)
})

async function buscarCEP() {
  const cep = form.cep.replace(/\D/g, '')
  if (cep.length !== 8) {
    addToast('CEP deve ter 8 dígitos.', 'warning')
    return
  }

  buscandoCEP.value = true
  try {
    const { data } = await api.post('/cep', { cep })
    form.endereco = data.logradouro || form.endereco
    form.bairro = data.bairro || form.bairro
    form.cidade = data.cidade || form.cidade
    form.estado = data.estado || form.estado

    // Calcular frete
    if (data.latitude && data.longitude) {
      const frete = await api.post('/pedidos/calcular-frete', {
        latitude: data.latitude,
        longitude: data.longitude,
      })
      freteInfo.value = frete.data
    }
  } catch (err) {
    addToast(err.response?.data?.error || 'CEP não encontrado. Preencha manualmente.', 'warning')
  } finally {
    buscandoCEP.value = false
  }
}

function goToStep2() {
  if (!form.nome || !form.telefone) {
    addToast('Preencha nome e telefone.', 'warning')
    return
  }
  currentStep.value = 2
}

function goToStep3() {
  if (!form.endereco || !form.numero || !form.bairro) {
    addToast('Preencha o endereço completo.', 'warning')
    return
  }
  currentStep.value = 3
}

function goToStep4() {
  // Se for pagamento online, CPF é obrigatório
  if (['pix_online', 'credito_online'].includes(form.metodo_pagamento)) {
    const cpfLimpo = card.cpfCnpj.replace(/\D/g, '')
    if (cpfLimpo.length < 11) {
      addToast('Informe o CPF completo para pagamento online.', 'warning')
      return
    }
  }
  currentStep.value = 4
}

function increaseQty(index) {
  const items = [...cartItems.value]
  items[index].quantidade++
  const unitPrice = parseFloat(items[index].preco_unitario) || 0
  const extrasTotal = (items[index].extras || []).reduce((acc, e) => acc + (parseFloat(e.preco) || 0), 0)
  items[index].subtotal = (unitPrice + extrasTotal) * items[index].quantidade
  updateCart(items)
}

function decreaseQty(index) {
  if (cartItems.value[index].quantidade <= 1) return
  const items = [...cartItems.value]
  items[index].quantidade--
  const unitPrice = parseFloat(items[index].preco_unitario) || 0
  const extrasTotal = (items[index].extras || []).reduce((acc, e) => acc + (parseFloat(e.preco) || 0), 0)
  items[index].subtotal = (unitPrice + extrasTotal) * items[index].quantidade
  updateCart(items)
}

function removeItem(index) {
  const items = [...cartItems.value]
  items.splice(index, 1)
  updateCart(items)
  if (items.length === 0) currentStep.value = 0
}

async function confirmOrder() {
  if (!authStore.isAuthenticated) {
    addToast('Faça login para finalizar o pedido.', 'warning')
    return
  }

  // ── MÉTODOS ONLINE (PIX / Cartão de Crédito) ──
  if (form.metodo_pagamento === 'pix_online' || form.metodo_pagamento === 'credito_online') {
    submitting.value = true
    globalLoading.value = true
    loadingMessage.value = 'Processando pagamento...'

    try {
      // Validações específicas
      if ((form.metodo_pagamento === 'pix_online' || form.metodo_pagamento === 'credito_online') && !card.cpfCnpj) {
        addToast('Informe o CPF para pagamento online.', 'warning')
        submitting.value = false
        globalLoading.value = false
        return
      }

      // Validar campos obrigatórios (CPF já validado no goToStep4)
      const cpfLimpo = card.cpfCnpj.replace(/\D/g, '')
      const nomeCompleto = `${form.nome} ${form.sobrenome}`.trim()
      const telefoneLimpo = form.telefone.replace(/\D/g, '')

      if (!nomeCompleto) {
        addToast('Informe seu nome.', 'warning')
        submitting.value = false
        globalLoading.value = false
        return
      }

      // Garantir que valores numéricos sejam números
      const valorSubtotal = Number(subtotal.value) || 0
      const valorFrete = Number(freteInfo.value?.custo) || 0
      const valorTotal = valorSubtotal + valorFrete

      const body = {
        tipo: form.metodo_pagamento === 'pix_online' ? 'PIX' : 'CREDIT_CARD',
        cliente: {
          cpfCnpj: cpfLimpo,
          nome: nomeCompleto,
          telefone: telefoneLimpo || form.telefone,
        },
        pedido: {
          endereco: form.endereco,
          numero: form.numero,
          bairro: form.bairro,
          cep: form.cep,
          cidade: form.cidade,
          estado: form.estado,
        },
        subtotal: valorSubtotal,
        valor_frete: valorFrete,
        total: valorTotal,
        tempo_preparo_estimado: freteInfo.value?.tempo_preparo || 20,
        tempo_entrega_estimado: freteInfo.value?.tempo_max || 25,
        itens: cartItems.value.map(item => ({
          produto_id: item.produto_id,
          nome_produto: item.nome_produto,
          quantidade: item.quantidade,
          preco_unitario: Number(item.preco_unitario) || 0,
          extras: (item.extras || []).map(e => ({
            nome: e.nome,
            preco: Number(e.preco) || 0,
          })),
          subtotal: Number(item.subtotal) || 0,
        })),
      }

      // Adicionar dados do cartão se for crédito online
      if (form.metodo_pagamento === 'credito_online') {
        const [expMonth, expYear] = card.expiry.split('/')
        body.creditCard = {
          holderName: card.holderName,
          number: card.number.replace(/\s/g, ''),
          expiryMonth: expMonth,
          expiryYear: '20' + expYear,
          ccv: card.cvv,
        }
        body.creditCardHolderInfo = {
          name: card.holderName,
          email: authStore.user.email,
          cpfCnpj: cpfLimpo,
          postalCode: form.cep.replace(/\D/g, ''),
          addressNumber: form.numero,
          phone: telefoneLimpo,
        }
      }

      const { data } = await criarPagamento(body)

      if (!data.sucesso) {
        addToast(data.erro || 'Erro no pagamento.', 'error')
        return
      }

      // Salvar CEP no localStorage
      if (form.cep) {
        localStorage.setItem('saborexpress_cep', form.cep.replace(/\D/g, ''))
      }

      // Salvar endereço/CPF no perfil do cliente (AGORA com await!)
      try {
        const perfilResp = await api.put('/clientes/perfil', {
          nome: form.nome,
          sobrenome: form.sobrenome,
          telefone: form.telefone,
          cpf_cnpj: card.cpfCnpj.replace(/\D/g, ''),
          cep: form.cep,
          endereco: form.endereco,
          numero: form.numero,
          bairro: form.bairro,
          complemento: form.complemento,
          cidade: form.cidade,
          estado: form.estado,
        })
        // Atualizar authStore com dados REAIS do backend
        if (authStore.user && perfilResp.data?.user) {
          authStore.user = { ...authStore.user, ...perfilResp.data.user }
        }
      } catch (e) {
        console.warn('[Perfil] Erro ao salvar perfil:', e?.response?.data || e.message)
      }

      // Limpar carrinho
      updateCart([])
      emit('close')

      if (form.metodo_pagamento === 'pix_online') {
        // Salvar dados do PIX no localStorage para a tela de tracking
        localStorage.setItem(`pix_${data.id}`, JSON.stringify(data.pix))
        addToast('QR Code gerado! Escaneie com seu banco.', 'success')
        router.push(`/pedidos/${data.id}`)
      } else {
        // Cartão aprovado (ou aguardando)
        const msg = data.cartao?.aprovado
          ? `Pedido ${data.pedido_id} confirmado! 🎉`
          : 'Aguardando confirmação do pagamento...'
        addToast(msg, data.cartao?.aprovado ? 'success' : 'info')
        router.push(`/pedidos/${data.pedido_id}`)
      }

    } catch (err) {
      const response = err.response?.data
      if (response?.codigo === 'GATEWAY_UNAVAILABLE') {
        addToast(response.erro, 'warning')
      } else if (response?.error) {
        // Erro de validação Zod ou outro erro do backend
        addToast(response.error, 'error')
        console.error('[Pagamento] Erro do backend:', response)
      } else if (err.message?.includes('Network Error') || err.code === 'ERR_NETWORK') {
        addToast('Sem conexão com o servidor. Verifique sua internet.', 'error')
      } else {
        addToast(response?.erro || 'Erro ao processar pagamento.', 'error')
        console.error('[Pagamento] Erro inesperado:', err)
      }
    } finally {
      submitting.value = false
      globalLoading.value = false
    }
    return
  }

  // ── MÉTODOS COD (Dinheiro/Cartão na entrega) — FLUXO ATUAL ──
  submitting.value = true
  globalLoading.value = true
  loadingMessage.value = 'Enviando pedido...'

  try {
    const pedido = {
      cliente_id: authStore.user.id,
      nome_cliente: `${form.nome} ${form.sobrenome}`.trim(),
      telefone_cliente: form.telefone,
      endereco_cliente: form.endereco,
      numero_cliente: form.numero,
      bairro_cliente: form.bairro,
      cep_cliente: form.cep,
      cidade_cliente: form.cidade,
      estado_cliente: form.estado,
      subtotal: subtotal.value,
      valor_frete: freteInfo.value?.custo || 0,
      total: subtotal.value + (freteInfo.value?.custo || 0),
      metodo_pagamento: form.metodo_pagamento,
      detalhes_pagamento: form.metodo_pagamento === 'dinheiro' && form.troco
        ? `Troco para R$ ${parseFloat(form.troco).toFixed(2)}` : '',
      tempo_preparo_estimado: freteInfo.value?.tempo_preparo || 20,
      tempo_entrega_estimado: freteInfo.value?.tempo_max || 25,
      observacoes: form.observacoes,
      itens: cartItems.value.map(item => ({
        produto_id: item.produto_id,
        nome_produto: item.nome_produto,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        extras: item.extras,
        subtotal: item.subtotal,
      })),
    }

    const { data } = await api.post('/pedidos', pedido)
    addToast(`Pedido ${data.pedido_id} confirmado com sucesso! 🎉`, 'success')

    // Salvar dados do perfil para próximos pedidos (AGORA com await!)
    try {
      const perfilResp = await api.put('/clientes/perfil', {
        nome: form.nome,
        sobrenome: form.sobrenome,
        telefone: form.telefone,
        cpf_cnpj: authStore.user?.cpf_cnpj || '',
        cep: form.cep,
        endereco: form.endereco,
        numero: form.numero,
        bairro: form.bairro,
        complemento: form.complemento,
        cidade: form.cidade,
        estado: form.estado,
      })
      // Atualizar authStore com dados REAIS do backend
      if (authStore.user && perfilResp.data?.user) {
        authStore.user = { ...authStore.user, ...perfilResp.data.user }
      }
    } catch (e) {
      console.warn('[Perfil] Erro ao salvar perfil:', e?.response?.data || e.message)
    }
    if (form.cep) {
      localStorage.setItem('saborexpress_cep', form.cep.replace(/\D/g, ''))
    }

    updateCart([])
    emit('close')
    router.push(`/pedidos/${data.id}`)
  } catch (err) {
    addToast(err.response?.data?.error || 'Erro ao confirmar pedido.', 'error')
  } finally {
    submitting.value = false
    globalLoading.value = false
  }
}
</script>
