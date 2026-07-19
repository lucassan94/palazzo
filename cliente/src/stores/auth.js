import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const isAuthenticated = computed(() => !!user.value)
  const userName = computed(() => {
    if (!user.value) return ''
    return user.value.sobrenome
      ? `${user.value.nome} ${user.value.sobrenome}`
      : user.value.nome
  })
  const userInitials = computed(() => {
    if (!user.value) return '?'
    return (user.value.nome?.[0] || '') + (user.value.sobrenome?.[0] || '')
  })

  async function login(email, password) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.post('/auth/cliente/login', { email, password })
      user.value = data.user
      return data
    } catch (err) {
      error.value = err.response?.data?.error || 'Erro ao fazer login.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function signup(nome, sobrenome, email, telefone, password) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.post('/auth/cliente/signup', {
        nome, sobrenome, email, telefone, password,
      })
      user.value = data.user
      return data
    } catch (err) {
      error.value = err.response?.data?.error || 'Erro ao criar conta.'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function checkSession() {
    try {
      const { data } = await api.get('/auth/me')
      user.value = data.user
    } catch {
      user.value = null
    }
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignora erros de rede no logout
    } finally {
      user.value = null
      window.location.href = '/auth'
    }
  }

  async function updateProfile(profileData) {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.put('/clientes/perfil', profileData)
      user.value = data.user
      return data
    } catch (err) {
      error.value = err.response?.data?.error || 'Erro ao atualizar perfil.'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    user, loading, error,
    isAuthenticated, userName, userInitials,
    login, signup, logout, checkSession, updateProfile,
  }
})
