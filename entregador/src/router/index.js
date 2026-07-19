import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/:pathMatch(.*)*', name: 'home' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
