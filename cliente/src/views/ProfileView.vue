<template>
  <div class="profile-view">
    <div class="profile-header">
      <div class="profile-avatar">
        {{ authStore.userInitials || '?' }}
      </div>
      <h2>{{ authStore.userName || 'Bem-vindo(a)' }}</h2>
      <p>{{ authStore.user?.email || 'Identifique-se para continuar' }}</p>
    </div>

    <div v-if="authStore.isAuthenticated" class="profile-form">
      <div class="profile-section">
        <div class="profile-section-title">Dados Pessoais</div>

        <div class="form-row">
          <div class="form-group">
            <label>Nome</label>
            <input v-model="form.nome" type="text" />
          </div>
          <div class="form-group">
            <label>Sobrenome</label>
            <input v-model="form.sobrenome" type="text" />
          </div>
        </div>

        <div class="form-group">
          <label>Telefone / WhatsApp</label>
          <input v-model="form.telefone" type="tel" placeholder="(11) 99999-9999" />
        </div>

        <div class="form-group">
          <label>CPF</label>
          <input v-model="form.cpf_cnpj" type="text" maxlength="14" placeholder="000.000.000-00"
                 @input="form.cpf_cnpj = form.cpf_cnpj.replace(/\D/g,'').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4').substring(0,14)" />
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">Endereço</div>

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
          <input v-model="form.endereco" type="text" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Número</label>
            <input v-model="form.numero" type="text" />
          </div>
          <div class="form-group">
            <label>Bairro</label>
            <input v-model="form.bairro" type="text" />
          </div>
        </div>

        <div class="form-group">
          <label>Complemento</label>
          <input v-model="form.complemento" type="text" placeholder="Apto, Bloco..." />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Cidade</label>
            <input v-model="form.cidade" type="text" />
          </div>
          <div class="form-group">
            <label>Estado</label>
            <input v-model="form.estado" type="text" maxlength="2" />
          </div>
        </div>
      </div>

      <button
        class="btn btn-primary btn-block"
        @click="salvar"
        :disabled="salvando"
      >
        <i class="fas fa-save"></i>
        {{ salvando ? 'Salvando...' : 'Salvar Alterações' }}
      </button>

      <div v-if="mensagem" class="cep-result mt-3" :class="mensagem.tipo">
        <i :class="mensagem.tipo === 'success' ? 'fas fa-check-circle' : 'fas fa-times-circle'"></i>
        {{ mensagem.texto }}
      </div>

      <hr class="divider mt-4" />

      <button
        class="btn btn-danger btn-block"
        @click="authStore.logout"
      >
        <i class="fas fa-sign-out-alt"></i>
        Sair da Conta
      </button>
    </div>

    <div v-else class="profile-form text-center p-4">
      <p class="text-muted mb-3">
        Faça login para acessar seu perfil e histórico de pedidos.
      </p>
      <router-link to="/auth" class="btn btn-primary btn-block">
        Fazer Login / Criar Conta
      </router-link>

      <div class="mt-4 info-card">
        <h4 style="font-size:1rem;margin-bottom:0.75rem;">Ainda não tem conta?</h4>
        <p class="text-muted mb-3" style="font-size:0.85rem;">
          Cadastre-se rapidamente e tenha acesso a histórico de pedidos, tracking em tempo real e muito mais!
        </p>
        <router-link to="/auth" class="btn btn-primary btn-block">
          Criar uma conta
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, watch, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../services/api'

const authStore = useAuthStore()
const salvando = ref(false)
const buscandoCEP = ref(false)
const mensagem = ref(null)

const form = reactive({
  nome: '',
  sobrenome: '',
  telefone: '',
  cpf_cnpj: '',
  cep: '',
  endereco: '',
  numero: '',
  bairro: '',
  complemento: '',
  cidade: 'São Paulo',
  estado: 'SP',
})

onMounted(() => {
  if (authStore.user) {
    form.nome = authStore.user.nome || ''
    form.sobrenome = authStore.user.sobrenome || ''
    form.telefone = authStore.user.telefone || ''
    form.cpf_cnpj = authStore.user.cpf_cnpj || ''
    form.cep = authStore.user.cep || ''
    form.endereco = authStore.user.endereco || ''
    form.numero = authStore.user.numero || ''
    form.bairro = authStore.user.bairro || ''
    form.complemento = authStore.user.complemento || ''
    form.cidade = authStore.user.cidade || 'São Paulo'
    form.estado = authStore.user.estado || 'SP'
  }
})

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

// Buscar CEP se já estava preenchido no mount
onMounted(() => {
  const cep = form.cep.replace(/\D/g, '')
  if (cep.length === 8) {
    buscarCEP()
  }
})

onUnmounted(() => {
  if (cepTimeout) clearTimeout(cepTimeout)
})

async function buscarCEP() {
  const cep = form.cep.replace(/\D/g, '')
  if (cep.length !== 8) return

  buscandoCEP.value = true
  try {
    const { data } = await api.post('/cep', { cep })
    form.endereco = data.logradouro || form.endereco
    form.bairro = data.bairro || form.bairro
    form.cidade = data.cidade || form.cidade
    form.estado = data.estado || form.estado
  } catch {
    mensagem.value = { tipo: 'error', texto: 'CEP não encontrado.' }
  } finally {
    buscandoCEP.value = false
  }
}

async function salvar() {
  salvando.value = true
  mensagem.value = null
  try {
    // Extrair só números do CPF ao salvar
    const perfilData = {
      ...form,
      cpf_cnpj: form.cpf_cnpj.replace(/\D/g, ''),
    }
    await authStore.updateProfile(perfilData)
    mensagem.value = { tipo: 'success', texto: 'Perfil atualizado com sucesso!' }
  } catch (err) {
    mensagem.value = { tipo: 'error', texto: err.response?.data?.error || 'Erro ao atualizar perfil.' }
  } finally {
    salvando.value = false
  }
}
</script>
