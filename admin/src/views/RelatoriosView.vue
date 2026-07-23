<template>
  <div>
    <h2 style="font-size:1.2rem;margin-bottom:1rem;">
      <i class="fas fa-chart-bar"></i> Relatórios
    </h2>

    <!-- Tabs -->
    <div class="tabs" style="margin-bottom:1rem;">
      <button class="tab" :class="{ active: tabAtiva === 'geral' }" @click="tabAtiva = 'geral'">
        <i class="fas fa-users"></i> Entregadores
      </button>
      <button class="tab" :class="{ active: tabAtiva === 'financeiro' }" @click="tabAtiva = 'financeiro'; carregarFinanceiro()">
        <i class="fas fa-wallet"></i> Financeiro
      </button>
    </div>

    <!-- Tab: Geral (tabela de entregadores) -->
    <div v-if="tabAtiva === 'geral'">
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

    <!-- Tab: Financeiro (evolução diária) -->
    <div v-if="tabAtiva === 'financeiro'">
      <div v-if="loadingFinanceiro" style="text-align:center;padding:2rem;">
        <div class="spinner" style="margin:0 auto;width:32px;height:32px;"></div>
      </div>

      <template v-else>
        <!-- Summary -->
        <div class="stats-grid" style="grid-template-columns:1fr 1fr;margin-bottom:1rem;">
          <div class="stat-card" style="text-align:center;">
            <div class="label">Hoje</div>
            <div class="value" style="font-size:1.3rem;">{{ formatPrice(financeiro.hoje) }}</div>
          </div>
          <div class="stat-card" style="text-align:center;">
            <div class="label">Entregas no Mês</div>
            <div class="value" style="font-size:1.3rem;">{{ financeiro.entregas_mes ?? 0 }}</div>
          </div>
        </div>

        <!-- Daily list -->
        <div v-if="financeiro.dias?.length">
          <h3 style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.5rem;">
            <i class="fas fa-calendar-alt"></i> Dias com entregas
          </h3>
          <div
            v-for="dia in financeiro.dias"
            :key="dia.data"
            class="day-row"
            @click="abrirDetalheDia(dia.data)"
          >
            <div class="day-row-left">
              <div class="day-date">{{ formatDateLabel(dia.data) }}</div>
              <div class="day-label">
                {{ dia.entregas }} {{ dia.entregas === 1 ? 'entrega' : 'entregas' }}
                · {{ dia.entregadores_ativos }} {{ dia.entregadores_ativos === 1 ? 'entregador' : 'entregadores' }}
              </div>
            </div>
            <div class="day-row-right">
              <span class="day-total">{{ formatPrice(dia.total_frete) }}</span>
              <i class="fas fa-chevron-right day-arrow"></i>
            </div>
          </div>
        </div>

        <div v-else style="text-align:center;padding:2rem;color:var(--text-muted);">
          <i class="fas fa-inbox" style="font-size:2rem;margin-bottom:0.75rem;opacity:0.3;"></i>
          <p>Nenhuma entrega neste mês.</p>
        </div>
      </template>
    </div>

    <!-- Modal de detalhamento do dia -->
    <div v-if="diaDetalhes" class="modal-overlay" @click.self="diaDetalhes = null">
      <div class="modal-content" style="max-width:520px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <h3 style="margin:0;">
            <i class="fas fa-calendar-day"></i>
            {{ formatDateLabel(diaDetalhes.data) }}
          </h3>
          <span style="font-size:1.1rem;font-weight:800;color:var(--primary);">
            {{ formatPrice(diaDetalhes.total_frete) }}
          </span>
        </div>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:1rem;">
          {{ diaDetalhes.entregas }} {{ diaDetalhes.entregas === 1 ? 'entrega finalizada' : 'entregas finalizadas' }}
        </p>

        <div
          v-for="item in diaDetalhes.itens"
          :key="item.id"
          class="delivery-card done"
          style="margin-bottom:0.5rem;padding:0.75rem 1rem;border-radius:8px;border:1px solid var(--border-light);background:var(--card-bg);"
        >
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <strong style="font-size:0.9rem;">{{ item.pedido_id }}</strong>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">
                {{ item.nome_cliente }}<br />
                {{ item.endereco_cliente }}, {{ item.numero_cliente }}
              </div>
              <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px;">
                🛵 {{ item.entregador_nome || '—' }}
              </div>
            </div>
            <span style="font-weight:700;color:var(--primary);font-size:0.95rem;">{{ formatPrice(item.valor_frete) }}</span>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;">
            <i class="fas fa-clock"></i> {{ formatHora(item.entregue_em) }}
          </div>
        </div>

        <button class="btn btn-secondary btn-block" style="margin-top:1rem;" @click="diaDetalhes = null">
          Fechar
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../services/api'

const tabAtiva = ref('geral')
const relatorio = ref([])
const financeiro = ref({ hoje: 0, entregas_mes: 0, dias: [] })
const diaDetalhes = ref(null)
const loadingFinanceiro = ref(false)

function formatPrice(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }
function formatDate(d) { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const diaSem = diasSemana[d.getDay()]
  const dia = d.getDate().toString().padStart(2, '0')
  const mes = (d.getMonth() + 1).toString().padStart(2, '0')
  return `${diaSem}, ${dia}/${mes}`
}

function formatHora(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

async function carregarFinanceiro() {
  if (loadingFinanceiro.value) return
  loadingFinanceiro.value = true
  try {
    const { data } = await api.get('/entregadores/relatorio/financeiro')
    financeiro.value = data
  } catch { /* silent */ }
  finally { loadingFinanceiro.value = false }
}

async function abrirDetalheDia(data) {
  try {
    const { data: detalhes } = await api.get(`/entregadores/relatorio/financeiro/dia/${data}`)
    diaDetalhes.value = detalhes
  } catch { /* silent */ }
}

onMounted(async () => {
  try {
    const { data } = await api.get('/entregadores/relatorio')
    relatorio.value = data
  } catch { /* ignore */ }
})
</script>

<style scoped>
.badge-hoje { background: var(--primary-light); color: var(--primary); padding: 2px 10px; border-radius: 999px; font-weight: 700; }

.spinner {
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Day row */
.day-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.85rem 1rem; margin-bottom: 4px;
  background: var(--card-bg); border-radius: var(--radius);
  border: 1px solid var(--border-light);
  cursor: pointer; transition: var(--transition);
}
.day-row:hover {
  border-color: var(--primary); background: var(--primary-light);
  transform: translateX(3px);
}
.day-row:active { transform: translateX(3px) scale(0.99); }
.day-row-left { display: flex; flex-direction: column; gap: 2px; }
.day-date { font-weight: 700; font-size: 0.95rem; }
.day-label { font-size: 0.78rem; color: var(--text-muted); }
.day-row-right { display: flex; align-items: center; gap: 10px; }
.day-total { font-weight: 800; font-size: 1.05rem; color: var(--primary); }
.day-arrow { font-size: 0.8rem; color: var(--text-muted); }
</style>
