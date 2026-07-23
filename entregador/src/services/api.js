import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json', 'X-Auth-Guard': 'saborexpress-secure' },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = document.cookie.match(/(^| )publicToken=([^;]+)/)?.[2]
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      // Só tenta refresh se havia um token — evita loop infinito quando
      // o usuário nunca fez login (primeiro carregamento da página)
      const hadToken = !!document.cookie.match(/(^| )publicToken=([^;]+)/)?.[2]
      if (!hadToken) return Promise.reject(error)

      error.config._retry = true
      try {
        await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        return api(error.config)
      } catch {
        // Refresh falhou — limpa cookies e recarrega
        document.cookie.split(';').forEach(c => {
          document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/')
        })
        window.location.reload()
      }
    }
    return Promise.reject(error)
  }
)

export default api
