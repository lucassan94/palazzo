<template>
  <div class="auth-view">
    <div class="auth-card">
      <div class="auth-icon">
        <i class="fas fa-hamburger"></i>
      </div>

      <!-- Login Form -->
      <div v-if="!isRegistering">
        <h2>Bem-vindo(a)</h2>
        <p>Identifique-se para continuar com o seu pedido</p>

        <div class="error-message" :class="{ show: errorMsg }">{{ errorMsg }}</div>

        <form @submit.prevent="doLogin">
          <div class="form-group text-left">
            <label>E-mail</label>
            <input v-model="email" type="email" placeholder="seu@email.com" required />
          </div>
          <div class="form-group text-left">
            <label>Senha</label>
            <input v-model="password" type="password" placeholder="••••••••" minlength="8" required />
          </div>

          <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
            {{ loading ? 'Entrando...' : 'Entrar' }}
          </button>

          <button type="button" class="btn btn-block btn-outline-primary" @click="isRegistering = true">
            Criar uma conta
          </button>
        </form>
      </div>

      <!-- Register Form -->
      <div v-else>
        <h2>Criar Conta</h2>
        <p>Cadastre-se para fazer seus pedidos</p>

        <div class="error-message" :class="{ show: errorMsg }">{{ errorMsg }}</div>

        <form @submit.prevent="doSignup">
          <div class="form-row">
            <div class="form-group text-left">
              <label>Nome</label>
              <input v-model="regNome" type="text" placeholder="Seu nome" required />
            </div>
            <div class="form-group text-left">
              <label>Sobrenome</label>
              <input v-model="regSobrenome" type="text" placeholder="Sobrenome" />
            </div>
          </div>

          <div class="form-group text-left">
            <label>Telefone</label>
            <input v-model="regTelefone" type="tel" placeholder="(11) 99999-9999" />
          </div>

          <div class="form-group text-left">
            <label>E-mail</label>
            <input v-model="regEmail" type="email" placeholder="seu@email.com" required />
          </div>

          <div class="form-group text-left">
            <label>Senha</label>
            <input v-model="regPassword" type="password" placeholder="Mínimo 8 caracteres" minlength="8" required />
          </div>

          <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
            {{ loading ? 'Cadastrando...' : 'Cadastrar e Finalizar' }}
          </button>

          <button type="button" class="btn btn-block btn-outline-primary" @click="isRegistering = false">
            Já tenho uma conta
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const addToast = inject('addToast', () => {})

const isRegistering = ref(false)
const loading = ref(false)
const errorMsg = ref('')

// Login fields
const email = ref('')
const password = ref('')

// Register fields
const regNome = ref('')
const regSobrenome = ref('')
const regTelefone = ref('')
const regEmail = ref('')
const regPassword = ref('')

async function doLogin() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await authStore.login(email.value, password.value)
    // Carrinho já é restaurado automaticamente pelo App.vue via localStorage
    addToast(`Bem-vindo(a), ${data.user?.nome || ''}!`, 'success')
    router.push('/')
  } catch (err) {
    const apiError = err?.response?.data?.error
    errorMsg.value = apiError || 'E-mail ou senha inválidos.'
  } finally {
    loading.value = false
  }
}

async function doSignup() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await authStore.signup(regNome.value, regSobrenome.value, regEmail.value, regTelefone.value, regPassword.value)
    addToast(`Conta criada com sucesso! Bem-vindo(a), ${data.user?.nome || ''}!`, 'success')
    router.push('/')
  } catch (err) {
    const apiError = err?.response?.data?.error
    errorMsg.value = apiError || 'Erro ao criar conta. Verifique os dados e tente novamente.'
  } finally {
    loading.value = false
  }
}

</script>
