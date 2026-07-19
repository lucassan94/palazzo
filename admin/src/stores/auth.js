import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)

  const isAuthenticated = computed(() => !!user.value)

  async function checkSession() {
    try {
      const { data } = await api.get('/auth/me')
      // Isolamento: só aceita sessão de restaurante/admin
      if (data.user?.role !== 'restaurante') {
        user.value = null
        return
      }
      user.value = data.user
    } catch { user.value = null }
  }

  return { user, isAuthenticated, checkSession }
})
