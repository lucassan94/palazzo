<template>
  <div>
    <div class="filter-bar">
      <input v-model="busca" placeholder="Buscar cliente..." style="flex:1;" />
      <button class="btn btn-primary btn-sm" @click="load">Buscar</button>
    </div>

    <div class="card">
      <table class="data-table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Pedidos</th><th>Total Gasto</th><th>Ações</th></tr></thead>
        <tbody>
          <tr v-for="c in clientes" :key="c.id">
            <td>{{ c.nome }} {{ c.sobrenome }}</td>
            <td>{{ c.email }}</td><td>{{ c.telefone || '—' }}</td>
            <td>{{ c.pedidos_total }}</td>
            <td><strong>{{ formatPrice(c.total_gasto) }}</strong></td>
            <td><button class="btn btn-sm btn-secondary" @click="verDetalhes(c.id)">Detalhes</button></td>
          </tr>
          <tr v-if="clientes.length === 0"><td colspan="6" style="text-align:center;color:var(--text-muted);">Nenhum cliente encontrado</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Detail Modal -->
    <div v-if="selectedCliente" class="modal-overlay" @click.self="selectedCliente = null">
      <div class="modal-content" style="max-width:500px;">
        <h3>{{ selectedCliente.nome }} {{ selectedCliente.sobrenome }}</h3>
        <p style="color:var(--text-muted);margin-bottom:1rem;">{{ selectedCliente.email }} | {{ selectedCliente.telefone || 'Sem telefone' }}</p>
        <p style="font-size:0.85rem;">{{ selectedCliente.endereco }}, {{ selectedCliente.numero }} — {{ selectedCliente.bairro }}</p>

        <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);">
          <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:0;">
            <div class="stat-card"><div class="label">Pedidos</div><div class="value info">{{ selectedCliente.pedidos_total }}</div></div>
            <div class="stat-card"><div class="label">Total Gasto</div><div class="value primary">{{ formatPrice(selectedCliente.total_gasto) }}</div></div>
            <div class="stat-card"><div class="label">Favorito</div><div class="value" style="font-size:0.9rem;margin-top:8px;">{{ selectedCliente.produtoMaisComprado || '—' }}</div></div>
          </div>
        </div>

        <div v-if="selectedCliente.ultimosPedidos?.length" style="margin-top:1rem;">
          <h4 style="font-size:0.9rem;margin-bottom:0.5rem;">Últimos Pedidos</h4>
          <div v-for="p in selectedCliente.ultimosPedidos" :key="p.id" style="font-size:0.85rem;padding:4px 0;border-bottom:1px solid var(--border-light);">
            {{ p.pedido_id }} — {{ formatPrice(p.total) }} — {{ new Date(p.criado_em).toLocaleDateString('pt-BR') }}
          </div>
        </div>

        <button class="btn btn-secondary btn-block" style="margin-top:1rem;" @click="selectedCliente = null">Fechar</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'

const clientes = ref([])
const busca = ref('')
const selectedCliente = ref(null)

function formatPrice(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }

async function load() {
  try {
    const { data } = await api.get('/clientes', { params: { busca: busca.value || undefined, ordenar_por: 'total_gasto', ordem: 'desc' } })
    clientes.value = data
  } catch { /* ignore */ }
}

async function verDetalhes(id) {
  try {
    const { data } = await api.get(`/clientes/${id}`)
    selectedCliente.value = data
  } catch { /* ignore */ }
}

onMounted(load)
</script>
<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.modal-content { background: white; border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 500px; max-height: 80vh; overflow-y: auto; }
.stats-grid { display: grid; gap: 0.75rem; }
.stat-card { background: var(--border-light); padding: 0.75rem; border-radius: 8px; }
.stat-card .label { font-size: 0.75rem; color: var(--text-muted); }
.stat-card .value { font-size: 1.2rem; font-weight: 700; }
</style>
