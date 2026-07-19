<template>
  <div class="cep-modal-overlay">
    <div class="cep-modal">
      <i class="fas fa-map-marker-alt cep-icon"></i>
      <h3>Qual seu endereço?</h3>
      <p>Informe seu CEP para verificar se entregamos na sua região</p>

      <div class="form-group text-left">
        <input
          v-model="cep"
          type="text"
          maxlength="9"
          placeholder="00000-000"
          @input="formatCEP"
          @keyup.enter="buscarCEP"
          class="cep-input-center"
        />
      </div>

      <button
        class="btn btn-primary btn-block mb-2"
        @click="buscarCEP"
        :disabled="buscando"
      >
        {{ buscando ? 'Verificando...' : 'Verificar Endereço' }}
      </button>

      <div v-if="resultado" class="cep-result" :class="resultado.tipo">
        <i :class="resultado.tipo === 'success' ? 'fas fa-check-circle' : 'fas fa-times-circle'"></i>
        {{ resultado.mensagem }}
      </div>

      <div class="cep-actions">
        <button class="btn btn-secondary btn-block" @click="$router.push('/auth')">
          Fazer Login
        </button>
        <button class="btn btn-secondary btn-block btn-outline-primary" @click="$router.push('/auth')">
          Criar uma conta
        </button>
        <button class="btn btn-link-muted" @click="$emit('close')">
          Continuar navegando sem CEP
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import api from '../services/api'

const emit = defineEmits(['close'])
const addToast = inject('addToast')

const cep = ref('')
const buscando = ref(false)
const resultado = ref(null)

function formatCEP() {
  cep.value = cep.value.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9)
}

async function buscarCEP() {
  const cepLimpo = cep.value.replace(/\D/g, '')
  if (cepLimpo.length !== 8) {
    resultado.value = { tipo: 'error', mensagem: 'CEP inválido. Digite 8 dígitos.' }
    return
  }

  buscando.value = true
  resultado.value = null

  try {
    const { data: cepData } = await api.post('/cep', { cep: cepLimpo })

    let freteMsg = ''
    if (cepData.latitude && cepData.longitude) {
      try {
        const { data: frete } = await api.post('/pedidos/calcular-frete', {
          latitude: cepData.latitude,
          longitude: cepData.longitude,
        })
        freteMsg = ` — ${frete.distancia_km ? `~${frete.distancia_km}km, ` : ''}${frete.tempo_min}-${frete.tempo_max}min, Frete R$ ${parseFloat(frete.custo).toFixed(2)}`
      } catch { /* Ignore */ }
    }

    addToast(`Entregamos na sua região!${freteMsg}`, 'success')

    // Salvar CEP no localStorage
    localStorage.setItem('saborexpress_cep', cepLimpo)

    resultado.value = {
      tipo: 'success',
      mensagem: `Entregamos na sua região!${freteMsg}`,
    }

    setTimeout(() => emit('close'), 2000)
  } catch (err) {
    resultado.value = {
      tipo: 'error',
      mensagem: err.response?.data?.error || 'CEP não encontrado ou região não atendida.',
    }
  } finally {
    buscando.value = false
  }
}
</script>
