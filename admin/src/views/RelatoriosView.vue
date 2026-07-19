<template>
  <div>
    <h2 style="font-size:1.2rem;margin-bottom:1rem;">Relatório de Entregas por Entregador</h2>

    <div class="card">
      <table class="data-table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Total de Entregas</th><th>Valor a Receber</th><th>Última Entrega</th><th>Entregas Hoje</th></tr></thead>
        <tbody>
          <tr v-for="e in relatorio" :key="e.id">
            <td><strong>{{ e.nome }}</strong></td>
            <td>{{ e.email }}</td>
            <td>{{ e.entregas_total }}</td>
            <td><strong>{{ formatPrice(e.frete_total_recebido) }}</strong></td>
            <td>{{ e.ultima_entrega_em ? formatDate(e.ultima_entrega_em) : '—' }}</td>
            <td><span class="badge-hoje">{{ e.entregas_hoje }}</span></td>
          </tr>
          <tr v-if="relatorio.length === 0"><td colspan="6" style="text-align:center;color:var(--text-muted);">Nenhum entregador encontrado</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'

const relatorio = ref([])

function formatPrice(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }
function formatDate(d) { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }

onMounted(async () => {
  try {
    const { data } = await api.get('/entregadores/relatorio')
    relatorio.value = data
  } catch { /* ignore */ }
})
</script>
<style scoped>
.badge-hoje { background: var(--primary-light); color: var(--primary); padding: 2px 10px; border-radius: 999px; font-weight: 700; }
</style>
