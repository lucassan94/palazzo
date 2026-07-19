<template>
  <div>
    <!-- Feedback Toast -->
    <div v-if="feedbackMsg" class="feedback-toast" :class="feedbackMsg.tipo" @click="feedbackMsg = null">
      <i :class="feedbackMsg.tipo === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle'"></i>
      {{ feedbackMsg.texto }}
    </div>

    <div style="display:flex;justify-content:space-between;margin-bottom:1rem;align-items:center;">
      <h2 style="font-size:1.2rem;font-weight:800;">Gerenciar Entregadores</h2>
      <button class="btn btn-primary" @click="novo">+ Novo Entregador</button>
    </div>

    <div class="card">
      <table class="data-table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>CPF</th><th>Status</th><th>Entregas</th><th>Total Recebido</th><th>Ações</th></tr></thead>
        <tbody>
          <tr v-for="e in entregadores" :key="e.id">
            <td><strong>{{ e.nome }}</strong></td>
            <td>{{ e.email }}</td>
            <td>{{ e.telefone || '—' }}</td>
            <td>{{ e.cpf ? maskCPF(e.cpf) : '—' }}</td>
            <td><span class="status-badge" :class="e.status">{{ e.status }}</span></td>
            <td>{{ e.entregas_total }}</td>
            <td><strong>{{ formatPrice(e.frete_total_recebido) }}</strong></td>
            <td>
              <button class="btn btn-sm btn-outline" @click="editar(e)">Editar</button>
              <button class="btn btn-sm btn-danger" style="margin-left:4px;" @click="toggleStatus(e)">{{ e.status === 'ativo' ? 'Inativar' : 'Ativar' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Form Modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal-content" style="max-width:500px;">
        <h3 style="margin-bottom:1.5rem;">{{ editingId ? 'Editar' : 'Novo' }} Entregador</h3>
        
        <div v-if="formErrors.geral" class="form-error-banner">
          <i class="fas fa-exclamation-triangle"></i> {{ formErrors.geral }}
        </div>

        <div class="form-group">
          <label>Nome</label>
          <input v-model="form.nome" :class="{ error: formErrors.nome }" placeholder="Nome completo" />
          <div v-if="formErrors.nome" class="field-error">{{ formErrors.nome }}</div>
        </div>

        <div class="form-group">
          <label>E-mail</label>
          <input v-model="form.email" type="email" :class="{ error: formErrors.email }" placeholder="email@exemplo.com" />
          <div v-if="formErrors.email" class="field-error">{{ formErrors.email }}</div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Telefone</label>
            <input v-model="form.telefone" @input="mascaraTelefone" placeholder="(11) 99999-9999" :class="{ error: formErrors.telefone }" />
            <div v-if="formErrors.telefone" class="field-error">{{ formErrors.telefone }}</div>
          </div>
          <div class="form-group">
            <label>CPF</label>
            <input v-model="form.cpf" @input="mascaraCPF" placeholder="000.000.000-00" :class="{ error: formErrors.cpf }" />
            <div v-if="formErrors.cpf" class="field-error">{{ formErrors.cpf }}</div>
          </div>
        </div>

        <div class="form-group">
          <label>Senha {{ editingId ? '(deixe em branco para manter)' : '(mín. 8 caracteres)' }}</label>
          <input v-model="form.password" type="password" :required="!editingId" minlength="8" :class="{ error: formErrors.password }" />
          <div v-if="formErrors.password" class="field-error">{{ formErrors.password }}</div>
        </div>

        <div style="display:flex;gap:8px;margin-top:1.5rem;">
          <button class="btn btn-primary" style="flex:1;" @click="salvar" :disabled="salvando">
            {{ salvando ? 'Salvando...' : 'Salvar' }}
          </button>
          <button class="btn btn-secondary" @click="showForm = false">Cancelar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { validarTelefone, validarCPF, maskTelefone, maskCPF } from '../utils/validators.js'
import api from '../services/api'

const feedbackMsg = ref(null)
function showFeedback(texto, tipo = 'erro') {
  feedbackMsg.value = { texto, tipo }
  setTimeout(() => { feedbackMsg.value = null }, 4000)
}

const entregadores = ref([])
const showForm = ref(false)
const editingId = ref(null)
const salvando = ref(false)
const form = reactive({ nome: '', email: '', telefone: '', cpf: '', password: '' })
const formErrors = reactive({ geral: '', nome: '', email: '', telefone: '', cpf: '', password: '' })

function formatPrice(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }
function limparErros() { Object.keys(formErrors).forEach(k => formErrors[k] = '') }

function mascaraTelefone() { form.telefone = maskTelefone(form.telefone) }
function mascaraCPF() { form.cpf = maskCPF(form.cpf) }

async function load() {
  try {
    const { data } = await api.get('/entregadores')
    entregadores.value = data
  } catch { /* ignore */ }
}

function novo() {
  editingId.value = null
  Object.assign(form, { nome: '', email: '', telefone: '', cpf: '', password: '' })
  limparErros()
  showForm.value = true
}

function editar(e) {
  editingId.value = e.id
  form.nome = e.nome; form.email = e.email
  form.telefone = e.telefone || ''; form.cpf = e.cpf || ''; form.password = ''
  limparErros()
  showForm.value = true
}

function validarForm() {
  limparErros()
  let valido = true

  if (!form.nome || form.nome.trim().length < 2) {
    formErrors.nome = 'Nome deve ter no mínimo 2 caracteres.'
    valido = false
  }
  if (!form.email || !form.email.includes('@')) {
    formErrors.email = 'E-mail inválido.'
    valido = false
  }
  if (form.telefone) {
    const tel = validarTelefone(form.telefone)
    if (!tel.valido) {
      formErrors.telefone = tel.mensagem || 'Telefone inválido.'
      valido = false
    } else {
      form.telefone = tel.formatado
    }
  }
  if (form.cpf) {
    const cpf = validarCPF(form.cpf)
    if (!cpf.valido) {
      formErrors.cpf = cpf.mensagem || 'CPF inválido.'
      valido = false
    } else {
      form.cpf = cpf.formatado
    }
  }
  if (!editingId.value && (!form.password || form.password.length < 8)) {
    formErrors.password = 'Senha deve ter no mínimo 8 caracteres.'
    valido = false
  }

  return valido
}

async function salvar() {
  if (!validarForm()) return

  salvando.value = true
  try {
    if (editingId.value) {
      await api.put(`/entregadores/${editingId.value}`, form)
    } else {
      await api.post('/entregadores', form)
    }
    showForm.value = false
    await load()
  } catch (err) {
    formErrors.geral = err.response?.data?.error || 'Erro ao salvar entregador.'
  } finally {
    salvando.value = false
  }
}

async function toggleStatus(e) {
  const novoStatus = e.status === 'ativo' ? 'inativo' : 'ativo'
  try {
    await api.put(`/entregadores/${e.id}`, { status: novoStatus })
    await load()
  } catch (err) {
    showFeedback(err.response?.data?.error || 'Erro ao alterar status', 'erro')
  }
}

onMounted(load)
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(15,23,42,0.5);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}
.modal-content {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
  animation: slideUp 0.25s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

.status-badge { display: inline-flex; padding: 3px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
.feedback-toast {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  animation: slideDown 0.3s ease;
  cursor: pointer;
  max-width: 90%;
}
.feedback-toast.success {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
}
.feedback-toast.erro {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}
@keyframes slideDown {
  from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.status-badge.ativo { background: #dcfce7; color: #166534; }
.status-badge.inativo { background: #f1f5f9; color: #64748b; }
.status-badge.bloqueado { background: #fee2e2; color: #991b1b; }
.field-error { font-size: 0.75rem; color: var(--error); margin-top: 4px; }
.form-error-banner {
  background: var(--error-light); color: var(--error);
  padding: 0.75rem; border-radius: 8px; font-size: 0.85rem;
  margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;
}
</style>
