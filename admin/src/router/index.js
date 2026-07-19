import { createRouter, createWebHistory } from 'vue-router'

// Admin uses a single-page layout, no need for routes
// Apenas rota raiz para evitar redirect infinito
const routes = [
  { path: '/:pathMatch(.*)*', name: 'home' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
