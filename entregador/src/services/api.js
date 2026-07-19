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
      error.config._retry = true
      try {
        await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        return api(error.config)
      } catch { window.location.reload() }
    }
    return Promise.reject(error)
  }
)

export default api
