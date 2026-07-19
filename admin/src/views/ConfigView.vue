<template>
  <div>
    <div style="display:grid;gap:1.5rem;max-width:800px;">
      <!-- Store Status -->
      <div class="card">
        <div class="card-header">Status da Loja</div>
        <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <strong>{{ storeOpen ? '🟢 Loja Aberta' : '🔴 Loja Fechada' }}</strong>
            <p style="font-size:0.85rem;color:var(--text-muted);">
              {{ storeOpen ? 'Clientes podem fazer pedidos normalmente.' : 'Novos pedidos estão bloqueados.' }}
            </p>
          </div>
          <button class="btn" :class="storeOpen ? 'btn-danger' : 'btn-success'" @click="toggleLoja">
            {{ storeOpen ? 'Fechar Loja' : 'Abrir Loja' }}
          </button>
        </div>
      </div>

      <!-- Restaurant Data -->
      <div class="card">
        <div class="card-header">Dados do Restaurante</div>
        <div class="card-body">
          <div class="form-group"><label>Nome</label><input v-model="restaurante.nome" /></div>
          <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;">
            <div class="form-group" style="margin-bottom:0;">
              <label>CEP</label>
              <input v-model="restaurante.cep" maxlength="9" placeholder="00000-000" @input="formatCEP" />
            </div>
            <div style="display:flex;align-items:flex-end;">
              <button class="btn btn-secondary" style="width:100%;height:42px;" @click="buscarCEP" :disabled="buscandoCEP">
                {{ buscandoCEP ? 'Buscando...' : 'Buscar CEP' }}
              </button>
            </div>
          </div>
          <div class="form-group"><label>Endereço</label><input v-model="restaurante.endereco" /></div>
          <div class="form-row">
            <div class="form-group"><label>Cidade</label><input v-model="restaurante.cidade" /></div>
            <div class="form-group"><label>Estado</label><input v-model="restaurante.estado" maxlength="2" /></div>
          </div>
          <div class="form-group"><label>Tempo de Preparo (min)</label><input v-model.number="restaurante.tempo_preparo_min" type="number" min="5" /></div>
          <div v-if="cepMsg" class="cep-result" :class="cepMsg.tipo" style="margin-bottom:1rem;">
            <i :class="cepMsg.tipo === 'success' ? 'fas fa-check-circle' : 'fas fa-times-circle'"></i>
            {{ cepMsg.texto }}
          </div>
          <button class="btn btn-primary" @click="salvarRestaurante" :disabled="salvando">
            {{ salvando ? 'Salvando...' : 'Salvar Dados' }}
          </button>
        </div>
      </div>

      <!-- Delivery Radius -->
      <div class="card">
        <div class="card-header">Matriz de Logística (Raio de Entrega)</div>
        <div class="card-body">
          <table class="data-table" v-if="raios.length">
            <thead><tr><th>Raio (KM)</th><th>Tempo Mín (min)</th><th>Tempo Máx (min)</th><th>Custo (R$)</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in raios" :key="i">
                <td>{{ r.raio_km }}</td><td>{{ r.tempo_min }}</td><td>{{ r.tempo_max }}</td><td>R$ {{ parseFloat(r.custo).toFixed(2) }}</td>
                <td><button class="btn btn-sm btn-danger" @click="excluirRaio(r.id)">×</button></td>
              </tr>
            </tbody>
          </table>
          <div style="display:flex;gap:8px;margin-top:1rem;align-items:center;flex-wrap:wrap;">
            <input v-model.number="novoRaio.raio_km" type="number" placeholder="KM" style="width:70px;padding:6px;border:1.5px solid var(--border);border-radius:4px;" />
            <input v-model.number="novoRaio.tempo_min" type="number" placeholder="Min" style="width:70px;padding:6px;border:1.5px solid var(--border);border-radius:4px;" />
            <input v-model.number="novoRaio.tempo_max" type="number" placeholder="Máx" style="width:70px;padding:6px;border:1.5px solid var(--border);border-radius:4px;" />
            <input v-model.number="novoRaio.custo" type="number" step="0.01" placeholder="R$" style="width:80px;padding:6px;border:1.5px solid var(--border);border-radius:4px;" />
            <button class="btn btn-sm btn-primary" @click="adicionarRaio">+ Adicionar</button>
          </div>
        </div>
      </div>

      <!-- Banner Management -->
      <div class="card">
        <div class="card-header">
          <span>Gerenciar Carrossel (Banners)</span>
          <button class="btn btn-sm btn-primary" @click="abrirBannerEditor(null)">
            <i class="fas fa-plus"></i> Novo Banner
          </button>
        </div>
        <div class="card-body">
          <div v-if="banners.length === 0" style="text-align:center;padding:2rem 0;color:var(--text-muted);">
            <i class="fas fa-images" style="font-size:2rem;margin-bottom:0.75rem;display:block;"></i>
            Nenhum banner cadastrado. Clique em "Novo Banner" para adicionar.
          </div>

          <div v-for="(banner, idx) in banners" :key="banner.id" class="banner-item">
            <div class="banner-preview">
              <img :src="bannerImgSrc(banner)" :alt="banner.titulo" />
            </div>
            <div class="banner-info">
              <strong>{{ banner.titulo || '(sem título)' }}</strong>
              <p>{{ banner.subtitulo || '(sem subtítulo)' }}</p>
              <span class="banner-ordem">Ordem: {{ banner.ordem }}</span>
              <span v-if="!banner.ativo" class="status-badge inativo">Inativo</span>
            </div>
            <div class="banner-actions">
              <button class="btn btn-sm btn-secondary" @click="moverBanner(idx, -1)" :disabled="idx === 0" title="Subir">
                <i class="fas fa-chevron-up"></i>
              </button>
              <button class="btn btn-sm btn-secondary" @click="moverBanner(idx, 1)" :disabled="idx === banners.length - 1" title="Descer">
                <i class="fas fa-chevron-down"></i>
              </button>
              <button class="btn btn-sm btn-secondary" @click="toggleBannerAtivo(banner)" :title="banner.ativo ? 'Desativar' : 'Ativar'">
                <i :class="banner.ativo ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
              </button>
              <button class="btn btn-sm btn-secondary" @click="abrirBannerEditor(banner)">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-sm btn-danger" @click="excluirBanner(banner)">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>

          <!-- Banner Editor Modal -->
          <div v-if="showBannerEditor" class="modal-backdrop" @click.self="showBannerEditor = false">
            <div class="modal-card">
              <div class="modal-header">
                <h3>{{ editandoBanner ? 'Editar Banner' : 'Novo Banner' }}</h3>
                <button class="drawer-close" @click="showBannerEditor = false">&times;</button>
              </div>
              <div class="modal-body">
                <div class="form-group">
                  <label>Título</label>
                  <input v-model="bannerForm.titulo" placeholder="Título do banner" maxlength="255" />
                </div>
                <div class="form-group">
                  <label>Subtítulo</label>
                  <input v-model="bannerForm.subtitulo" placeholder="Subtítulo ou chamada" maxlength="500" />
                </div>
                <div class="form-group">
                  <label>Link de redirecionamento (opcional)</label>
                  <input v-model="bannerForm.link_url" placeholder="https://... ou /cardapio, /promocoes" />
                  <small style="color:var(--text-muted);font-size:0.75rem;">
                    <i class="fas fa-info-circle"></i>
                    Se preenchido, o banner será clicável e redirecionará ao tocar.
                  </small>
                </div>
                <div class="form-group">
                  <label>URL da Imagem (opcional)</label>
                  <input v-model="bannerForm.imagem_url" placeholder="https://..." />
                </div>
                <div class="form-group">
                  <label>Ou enviar imagem do computador</label>
                  <input type="file" accept="image/*" @change="onBannerImageSelected" />
                  <div v-if="bannerForm.preview" class="banner-upload-preview">
                    <img :src="bannerForm.preview" alt="Preview" />
                  </div>
                </div>
                <div class="form-group">
                  <label>
                    <input type="checkbox" v-model="bannerForm.ativo" />
                    Banner ativo
                  </label>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" @click="showBannerEditor = false">Cancelar</button>
                <button class="btn btn-primary" @click="salvarBanner" :disabled="salvandoBanner">
                  {{ salvandoBanner ? 'Salvando...' : 'Salvar' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Team Management -->
      <div class="card">
        <div class="card-header">Gestão de Equipe</div>
        <div class="card-body">
          <table class="data-table" v-if="equipe.length">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th></th></tr></thead>
            <tbody>
              <tr v-for="u in equipe" :key="u.id">
                <td>{{ u.nome }}</td><td>{{ u.email }}</td><td><span class="role-badge" :class="u.cargo">{{ u.cargo }}</span></td>
                <td><button class="btn btn-sm btn-danger" @click="excluirUsuario(u.id)">Excluir</button></td>
              </tr>
            </tbody>
          </table>
          <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);">
            <h4 style="font-size:0.9rem;margin-bottom:0.75rem;">Criar Novo Usuário</h4>
            <div class="form-row">
              <div class="form-group"><label>Nome</label><input v-model="novoUsuario.nome" /></div>
              <div class="form-group"><label>E-mail</label><input v-model="novoUsuario.email" type="email" /></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Senha</label><input v-model="novoUsuario.password" type="password" minlength="8" /></div>
              <div class="form-group"><label>Cargo</label>
                <select v-model="novoUsuario.cargo">
                  <option value="gerente">Gerente</option><option value="chef">Chef</option><option value="caixa">Caixa</option>
                </select>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" @click="criarUsuario">Criar Usuário</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import api from '../services/api'

const storeOpen = ref(true)
const restaurante = reactive({ nome: '', endereco: '', cep: '', cidade: '', estado: '', latitude: null, longitude: null, tempo_preparo_min: 20 })
const raios = ref([])
const equipe = ref([])
const buscandoCEP = ref(false)
const salvando = ref(false)
const cepMsg = ref(null)
const novoRaio = reactive({ raio_km: '', tempo_min: '', tempo_max: '', custo: '' })
const novoUsuario = reactive({ nome: '', email: '', password: 'senha123', cargo: 'caixa' })

// Banner management
const banners = ref([])
const showBannerEditor = ref(false)
const editandoBanner = ref(null)
const salvandoBanner = ref(false)
const bannerForm = reactive({
  titulo: '', subtitulo: '', link_url: '', imagem_url: '', imagem_base64: '', preview: '', ativo: true,
})

async function load() {
  const [r, rios, eq] = await Promise.all([
    api.get('/restaurante'),
    api.get('/restaurante/raios-entrega'),
    api.get('/restaurante/equipe'),
  ])
  Object.assign(restaurante, {
    nome: r.data.nome, endereco: r.data.endereco, cep: r.data.cep,
    cidade: r.data.cidade, estado: r.data.estado,
    latitude: r.data.latitude, longitude: r.data.longitude,
    tempo_preparo_min: r.data.tempo_preparo_min,
  })
  storeOpen.value = r.data.status_loja
  raios.value = rios.data
  equipe.value = eq.data
}

function formatCEP() {
  restaurante.cep = restaurante.cep.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9)
}

async function buscarCEP() {
  const cep = restaurante.cep.replace(/\D/g, '')
  if (cep.length !== 8) {
    cepMsg.value = { tipo: 'error', texto: 'CEP deve ter 8 dígitos.' }
    return
  }

  buscandoCEP.value = true
  cepMsg.value = null

  try {
    const { data } = await api.post('/cep', { cep })
    restaurante.endereco = data.logradouro || restaurante.endereco
    restaurante.cidade = data.cidade || restaurante.cidade
    restaurante.estado = data.estado || restaurante.estado
    // Preencher latitude/longitude se disponíveis
    if (data.latitude) restaurante.latitude = parseFloat(data.latitude)
    if (data.longitude) restaurante.longitude = parseFloat(data.longitude)

    cepMsg.value = {
      tipo: 'success',
      texto: `Endereço preenchido automaticamente: ${data.logradouro || ''}, ${data.cidade || ''}/${data.estado || ''}` +
        (data.latitude ? ` (Lat: ${data.latitude}, Lng: ${data.longitude})` : ''),
    }
  } catch (err) {
    cepMsg.value = { tipo: 'error', texto: err.response?.data?.error || 'CEP não encontrado.' }
  } finally {
    buscandoCEP.value = false
  }
}

async function salvarRestaurante() {
  salvando.value = true
  cepMsg.value = null
  try {
    await api.put('/restaurante', { ...restaurante })
    cepMsg.value = { tipo: 'success', texto: 'Dados salvos com sucesso!' }
  } catch (err) {
    cepMsg.value = { tipo: 'error', texto: err.response?.data?.error || 'Erro ao salvar.' }
  } finally {
    salvando.value = false
  }
}

async function toggleLoja() {
  const { data } = await api.post('/restaurante/toggle-loja')
  storeOpen.value = data.status_loja
}

async function adicionarRaio() {
  // Validar todos os campos
  if (!novoRaio.raio_km || !novoRaio.tempo_min || !novoRaio.tempo_max || !novoRaio.custo) {
    cepMsg.value = { tipo: 'error', texto: 'Preencha todos os campos do raio (KM, tempo min, tempo máx e custo).' }
    return
  }
  try {
    await api.post('/restaurante/raios-entrega', {
      raio_km: Number(novoRaio.raio_km),
      tempo_min: Number(novoRaio.tempo_min),
      tempo_max: Number(novoRaio.tempo_max),
      custo: Number(novoRaio.custo),
    })
    Object.assign(novoRaio, { raio_km: '', tempo_min: '', tempo_max: '', custo: '' })
    const { data } = await api.get('/restaurante/raios-entrega')
    raios.value = data
    cepMsg.value = { tipo: 'success', texto: 'Raio de entrega adicionado!' }
  } catch (err) {
    cepMsg.value = { tipo: 'error', texto: err.response?.data?.error || 'Erro ao adicionar raio.' }
  }
}

async function excluirRaio(id) {
  await api.delete(`/restaurante/raios-entrega/${id}`)
  raios.value = raios.value.filter(r => r.id !== id)
}

async function criarUsuario() {
  if (!novoUsuario.nome || !novoUsuario.email) return
  await api.post('/restaurante/equipe', { ...novoUsuario })
  Object.assign(novoUsuario, { nome: '', email: '', password: 'senha123' })
  const { data } = await api.get('/restaurante/equipe')
  equipe.value = data
}

async function excluirUsuario(id) {
  if (!confirm('Excluir este usuário?')) return
  await api.delete(`/restaurante/equipe/${id}`)
  equipe.value = equipe.value.filter(u => u.id !== id)
}

// ── Banner functions ──

async function carregarBanners() {
  try {
    const { data } = await api.get('/restaurante/banners/admin')
    banners.value = data
  } catch { /* ignore */ }
}

function bannerImgSrc(banner) {
  if (banner.imagem_base64) {
    const b64 = banner.imagem_base64
    if (b64.startsWith('/9j/')) return 'data:image/jpeg;base64,' + b64
    if (b64.startsWith('iVBORw0KGgo')) return 'data:image/png;base64,' + b64
    if (b64.startsWith('R0lGOD')) return 'data:image/gif;base64,' + b64
    if (b64.startsWith('UklGR')) return 'data:image/webp;base64,' + b64
    try {
      if (atob(b64.substring(0, 20)).startsWith('<svg')) return 'data:image/svg+xml;base64,' + b64
    } catch {}
    return 'data:image/jpeg;base64,' + b64
  }
  return banner.imagem_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=60'
}

function abrirBannerEditor(banner) {
  editandoBanner.value = banner
  if (banner) {
    bannerForm.titulo = banner.titulo || ''
    bannerForm.subtitulo = banner.subtitulo || ''
    bannerForm.link_url = banner.link_url || ''
    bannerForm.imagem_url = banner.imagem_url || ''
    bannerForm.imagem_base64 = ''
    bannerForm.preview = bannerImgSrc(banner)
    bannerForm.ativo = banner.ativo
  } else {
    Object.assign(bannerForm, { titulo: '', subtitulo: '', link_url: '', imagem_url: '', imagem_base64: '', preview: '', ativo: true })
  }
  showBannerEditor.value = true
}

function onBannerImageSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return

  if (file.size > 2 * 1024 * 1024) {
    alert('A imagem deve ter no máximo 2MB.')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const base64 = e.target.result.split(',')[1]
    bannerForm.imagem_base64 = base64
    bannerForm.preview = 'data:image/jpeg;base64,' + base64
    bannerForm.imagem_url = '' // Limpar URL se enviar arquivo
  }
  reader.readAsDataURL(file)
}

async function salvarBanner() {
  salvandoBanner.value = true
  try {
    const payload = {
      titulo: bannerForm.titulo,
      subtitulo: bannerForm.subtitulo,
      link_url: bannerForm.link_url || null,
      ativo: bannerForm.ativo,
    }
    if (bannerForm.imagem_base64) {
      payload.imagem_base64 = bannerForm.imagem_base64
    } else if (bannerForm.imagem_url) {
      payload.imagem_url = bannerForm.imagem_url
    }

    if (editandoBanner.value) {
      await api.put(`/restaurante/banners/${editandoBanner.value.id}`, payload)
    } else {
      await api.post('/restaurante/banners', payload)
    }

    showBannerEditor.value = false
    await carregarBanners()
  } catch (err) {
    alert(err.response?.data?.error || 'Erro ao salvar banner.')
  } finally {
    salvandoBanner.value = false
  }
}

async function excluirBanner(banner) {
  if (!confirm(`Excluir banner "${banner.titulo || 'sem título'}"?`)) return
  try {
    await api.delete(`/restaurante/banners/${banner.id}`)
    await carregarBanners()
  } catch (err) {
    alert(err.response?.data?.error || 'Erro ao excluir banner.')
  }
}

async function toggleBannerAtivo(banner) {
  try {
    await api.put(`/restaurante/banners/${banner.id}`, { ativo: !banner.ativo })
    await carregarBanners()
  } catch (err) {
    alert(err.response?.data?.error || 'Erro ao alterar banner.')
  }
}

async function moverBanner(idx, direction) {
  const b = [...banners.value]
  const target = idx + direction
  if (target < 0 || target >= b.length) return

  // Swap ordem
  const temp = b[idx].ordem
  b[idx].ordem = b[target].ordem
  b[target].ordem = temp

  // Swap no array visual
  ;[b[idx], b[target]] = [b[target], b[idx]]

  try {
    await api.put('/restaurante/banners/reorder', {
      ordem: b.map((item, i) => ({ id: item.id, ordem: i })),
    })
    await carregarBanners()
  } catch (err) {
    alert('Erro ao reordenar.')
    await carregarBanners()
  }
}

onMounted(() => {
  load()
  carregarBanners()
})
</script>
<style scoped>
.role-badge { display: inline-flex; padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; background: var(--border-light); color: var(--text-secondary); text-transform: capitalize; }
.role-badge.admin { background: #fee2e2; color: #991b1b; }
.role-badge.gerente { background: #dbeafe; color: #1e40af; }
.role-badge.chef { background: #fef3c7; color: #92400e; }
.role-badge.caixa { background: #dcfce7; color: #166534; }
.cep-result { display:flex; align-items:center; gap:0.5rem; padding:0.75rem 1rem; border-radius:8px; font-size:0.85rem; }
.cep-result.success { background:#dcfce7; color:#166534; border:1px solid #bbf7d0; }
.cep-result.error { background:#fee2e2; color:#991b1b; border:1px solid #fecaca; }
.banner-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 0.75rem;
  background: var(--white);
  transition: box-shadow 0.2s;
}
.banner-item:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.banner-preview {
  width: 100px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--background);
}
.banner-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.banner-info {
  flex: 1;
  min-width: 0;
}
.banner-info strong {
  display: block;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.banner-info p {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin: 2px 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.banner-ordem {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-right: 0.5rem;
}
.banner-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.banner-upload-preview {
  margin-top: 0.5rem;
  border-radius: 6px;
  overflow: hidden;
  max-width: 200px;
}
.banner-upload-preview img {
  width: 100%;
  height: auto;
  display: block;
}
.status-badge.inativo {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  background: #fee2e2;
  color: #991b1b;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.modal-card {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
}
.modal-header h3 {
  font-size: 1.1rem;
}
.modal-body {
  padding: 1.5rem;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
}
.drawer-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  line-height: 1;
}
</style>
