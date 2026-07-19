<template>
  <div>
    <div style="display:flex;justify-content:space-between;margin-bottom:1rem;">
      <h2 style="font-size:1.2rem;">Gerenciar Produtos</h2>
      <button class="btn btn-primary" @click="novoProduto">+ Novo Produto</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="card" style="text-align:center;padding:3rem;">
      <div class="spinner" style="margin:0 auto;width:40px;height:40px;border:4px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin .8s linear infinite;"></div>
      <p style="margin-top:1rem;color:var(--text-muted);">Carregando produtos...</p>
    </div>

    <!-- Error -->
    <div v-else-if="erroLoad" class="card" style="text-align:center;padding:2rem;">
      <i class="fas fa-exclamation-triangle" style="font-size:2rem;color:var(--error);margin-bottom:0.75rem;"></i>
      <p style="color:var(--error);font-weight:600;">{{ erroLoad }}</p>
      <button class="btn btn-primary btn-sm" style="margin-top:1rem;" @click="load">
        <i class="fas fa-sync"></i> Tentar novamente
      </button>
    </div>

    <!-- Search / Filter -->
    <div v-else class="filter-bar">
      <input v-model="searchTerm" type="text" placeholder="Buscar produto..." style="flex:1;" @input="load" />
      <select v-model="filterCategoria" @change="load">
        <option value="">Todas as categorias</option>
        <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nome }}</option>
      </select>
    </div>

    <div v-if="!loading && !erroLoad" class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:50px;">Img</th>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Preço</th>
            <th>Extras</th>
            <th>Ativo</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filteredProdutos" :key="p.id">
            <td>
              <div class="table-img-thumb">
                <img v-if="getImageSrc(p)" :src="getImageSrc(p)" @error="onImageError(p.id)" />
                <i v-else class="fas fa-image" style="color:var(--text-muted);font-size:1.1rem;"></i>
              </div>
            </td>
            <td><strong>{{ p.nome }}</strong></td>
            <td><span class="cat-badge">{{ p.categoria_nome }}</span></td>
            <td><strong>{{ formatPrice(p.preco) }}</strong></td>
            <td><span class="extras-count">{{ p.extras_count || 0 }}</span></td>
            <td>
              <label class="toggle" @click.stop>
                <input type="checkbox" :checked="p.ativo" @change="toggleAtivo(p)" />
                <span class="slider"></span>
              </label>
            </td>
            <td>
              <button class="btn btn-sm btn-secondary" @click="editar(p)">Editar</button>
              <button class="btn btn-sm btn-danger" @click="excluir(p)">Excluir</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Product Form Modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal-content modal-produto">
        <h3>{{ editingId ? '✏️ Editar' : '➕ Novo' }} Produto</h3>

        <!-- Tabs -->
        <div class="form-tabs">
          <button class="form-tab" :class="{ active: formTab === 'dados' }" @click="formTab = 'dados'">
            <i class="fas fa-info-circle"></i> Dados
          </button>
          <button class="form-tab" :class="{ active: formTab === 'imagem' }" @click="formTab = 'imagem'">
            <i class="fas fa-image"></i> Imagem
          </button>
          <button class="form-tab" :class="{ active: formTab === 'extras' }" @click="formTab = 'extras'">
            <i class="fas fa-plus-circle"></i> Adicionais
          </button>
        </div>

        <!-- Tab: Dados Básicos -->
        <div v-show="formTab === 'dados'">
          <div class="form-row">
            <div class="form-group" style="flex:2;">
              <label>Nome do Produto</label>
              <input v-model="form.nome" placeholder="Ex: Burguer Clássico" />
            </div>
            <div class="form-group" style="flex:1;">
              <label>Categoria</label>
              <select v-model="form.categoria_id">
                <option value="">Selecione...</option>
                <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nome }}</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Preço (R$)</label>
              <input v-model.number="form.preco" type="number" step="0.01" min="0" placeholder="0,00" />
            </div>
            <div class="form-group">
              <label>Status</label>
              <div style="display:flex;align-items:center;gap:10px;margin-top:8px;">
                <label class="toggle">
                  <input type="checkbox" v-model="form.ativo" />
                  <span class="slider"></span>
                </label>
                <span style="font-size:0.9rem;font-weight:600;color:var(--success);" v-if="form.ativo">Ativo</span>
                <span style="font-size:0.9rem;font-weight:600;color:var(--error);" v-else>Inativo</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Descrição</label>
            <textarea v-model="form.descricao" rows="3" placeholder="Descreva o produto, ingredientes, modo de preparo..."></textarea>
          </div>
        </div>

        <!-- Tab: Imagem -->
        <div v-show="formTab === 'imagem'">
          <div class="image-upload-area">
            <!-- Preview -->
            <div class="image-preview" v-if="previewImage">
              <img :src="previewImage" alt="Preview" />
              <button class="btn btn-sm btn-danger image-remove-btn" @click="removerImagem">
                <i class="fas fa-trash"></i> Remover
              </button>
            </div>
            <div class="image-preview empty" v-else>
              <i class="fas fa-cloud-upload-alt"></i>
              <p>Clique para selecionar uma imagem</p>
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              @change="onImageSelected"
              ref="fileInput"
              style="display:none"
            />
            <button class="btn btn-secondary btn-block" @click="$refs.fileInput.click()">
              <i class="fas fa-folder-open"></i> Selecionar Imagem
            </button>
            <p class="image-hint">Formatos: PNG, JPG, WebP. Tamanho máximo: 2MB</p>
            <div class="form-group" style="margin-top:0.5rem;">
              <label>Ou cole uma URL externa</label>
              <input v-model="form.imagem_url" placeholder="https://..." @input="onUrlChange" />
            </div>
          </div>
        </div>

        <!-- Tab: Adicionais -->
        <div v-show="formTab === 'extras'">
          <div class="extras-header">
            <p style="color:var(--text-muted);font-size:0.85rem;">
              Configure os adicionais que o cliente pode escolher.
              O <strong>Máximo</strong> define quantas vezes o cliente pode pedir o mesmo adicional (ex: 2 carnes, 1 cebola).
            </p>
          </div>
          <div v-for="(extra, i) in form.extras" :key="i" class="extra-row">
            <div class="extra-fields">
              <input v-model="extra.nome" placeholder="Nome do adicional" class="extra-name" />
              <div class="extra-number-group">
                <span class="extra-currency">R$</span>
                <input v-model.number="extra.preco" type="number" step="0.50" min="0" placeholder="0,00" class="extra-price-input" />
              </div>
              <div class="extra-max-group">
                <label class="extra-max-label">Máx:</label>
                <input v-model.number="extra.maximo" type="number" min="0" max="99" placeholder="1" class="extra-max-input" />
              </div>
              <button class="btn btn-sm btn-danger" @click="form.extras.splice(i, 1)" title="Remover adicional">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
          <button class="btn btn-secondary btn-block" @click="addExtra" style="margin-top:0.5rem;">
            <i class="fas fa-plus"></i> Adicionar Opcional
          </button>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex;gap:8px;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border);">
          <button class="btn btn-primary" style="flex:1;" @click="salvar" :disabled="salvando">
            <i :class="salvando ? 'fas fa-spinner fa-spin' : 'fas fa-save'"></i>
            {{ salvando ? 'Salvando...' : 'Salvar' }}
          </button>
          <button class="btn btn-secondary" @click="showForm = false">Cancelar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '../services/api'

const produtos = ref([])
const categorias = ref([])
const showForm = ref(false)
const editingId = ref(null)
const salvando = ref(false)
const loading = ref(false)
const erroLoad = ref('')
const searchTerm = ref('')
const filterCategoria = ref('')
const formTab = ref('dados')
const previewImage = ref('')
const fileInput = ref(null)

// Rastrear imagens que falharam ao carregar
const brokenImages = ref(new Set())

function onImageError(prodId) {
  brokenImages.value = new Set([...brokenImages.value, prodId])
}

function getImageSrc(prod) {
  if (prod.imagem_base64) {
    const b64 = prod.imagem_base64
    // Detectar formato pela assinatura base64 (primeiros caracteres)
    if (b64.startsWith('/9j/')) return 'data:image/jpeg;base64,' + b64
    if (b64.startsWith('iVBORw0KGgo')) return 'data:image/png;base64,' + b64
    if (b64.startsWith('R0lGOD')) return 'data:image/gif;base64,' + b64
    if (b64.startsWith('UklGR')) return 'data:image/webp;base64,' + b64
    // SVG: tentar detectar por decoding
    try {
      const decoded = atob(b64.substring(0, 20))
      if (decoded.includes('<svg') || decoded.includes('<?xml')) {
        return 'data:image/svg+xml;base64,' + b64
      }
    } catch {}
    // Fallback: JPEG
    return 'data:image/jpeg;base64,' + b64
  }
  if (prod.imagem_url && !brokenImages.value.has(prod.id)) {
    return prod.imagem_url
  }
  return null
}
const form = reactive({
  nome: '', categoria_id: '', preco: 0, descricao: '',
  imagem_url: '', imagem_base64: '', ativo: true, extras: []
})

function formatPrice(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }

const filteredProdutos = computed(() => {
  let result = produtos.value
  if (searchTerm.value) {
    const q = searchTerm.value.toLowerCase()
    result = result.filter(p => p.nome.toLowerCase().includes(q) || p.descricao?.toLowerCase().includes(q))
  }
  if (filterCategoria.value) {
    result = result.filter(p => p.categoria_id === parseInt(filterCategoria.value))
  }
  return result
})

async function load() {
  erroLoad.value = ''
  loading.value = true
  try {
    const [p, c] = await Promise.all([
      api.get('/produtos'), api.get('/produtos/categorias')
    ])

    const produtosData = p.data
    categorias.value = c.data

    if (!produtosData.length) {
      produtos.value = []
      return
    }

    // Buscar contagem de extras em PARALELO (Promise.allSettled)
    const extrasPromises = produtosData.map(prod =>
      api.get(`/produtos/${prod.id}`)
        .then(({ data }) => {
          prod.extras_count = data.extras?.length || 0
        })
        .catch(() => { prod.extras_count = 0 })
    )
    await Promise.allSettled(extrasPromises)

    produtos.value = produtosData
  } catch (err) {
    erroLoad.value = 'Erro ao carregar produtos. Verifique se o servidor está rodando.'
    console.error('Erro ao carregar produtos:', err)
    produtos.value = []
  } finally {
    loading.value = false
  }
}

function resetForm() {
  editingId.value = null
  formTab.value = 'dados'
  previewImage.value = ''
  Object.assign(form, {
    nome: '', categoria_id: '', preco: 0, descricao: '',
    imagem_url: '', imagem_base64: '', ativo: true, extras: []
  })
}

function novoProduto() {
  resetForm()
  showForm.value = true
}

function addExtra() {
  form.extras.push({ nome: '', preco: 0, maximo: 1 })
}

async function editar(p) {
  resetForm()
  editingId.value = p.id
  form.nome = p.nome
  form.categoria_id = p.categoria_id || ''
  form.preco = parseFloat(p.preco)
  form.descricao = p.descricao || ''
  form.imagem_url = p.imagem_url || ''
  form.imagem_base64 = p.imagem_base64 || ''
  form.ativo = p.ativo
  if (p.imagem_base64) {
    previewImage.value = 'data:image/png;base64,' + p.imagem_base64
  } else if (p.imagem_url) {
    previewImage.value = p.imagem_url
  }
  try {
    const { data } = await api.get(`/produtos/${p.id}`)
    form.extras = (data.extras || []).map(e => ({
      nome: e.nome, preco: e.preco, maximo: e.maximo ?? 1
    }))
  } catch { form.extras = [] }
  showForm.value = true
}

function onImageSelected(event) {
  const file = event.target.files[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    alert('Imagem muito grande! Máximo 2MB.')
    return
  }
  const reader = new FileReader()
  reader.onload = (e) => {
    const base64 = e.target.result.split(',')[1]
    form.imagem_base64 = base64
    previewImage.value = e.target.result
    form.imagem_url = ''
  }
  reader.readAsDataURL(file)
}

function onUrlChange() {
  if (form.imagem_url) {
    previewImage.value = form.imagem_url
    form.imagem_base64 = ''
  }
}

function removerImagem() {
  previewImage.value = ''
  form.imagem_base64 = ''
  form.imagem_url = ''
}

async function salvar() {
  salvando.value = true
  try {
    const payload = {
      nome: form.nome,
      categoria_id: form.categoria_id || undefined,
      preco: form.preco,
      descricao: form.descricao,
      imagem_url: form.imagem_url,
      imagem_base64: form.imagem_base64,
      ativo: form.ativo,
      extras: form.extras.filter(e => e.nome.trim()),
    }
    if (editingId.value) {
      await api.put(`/produtos/${editingId.value}`, payload)
    } else {
      await api.post('/produtos', payload)
    }
    showForm.value = false
    await load()
  } catch (err) {
    alert(err.response?.data?.error || 'Erro ao salvar produto')
  } finally { salvando.value = false }
}

async function toggleAtivo(p) {
  try {
    await api.put(`/produtos/${p.id}`, { ativo: !p.ativo })
    p.ativo = !p.ativo
  } catch { alert('Erro ao alterar status') }
}

async function excluir(p) {
  if (!confirm(`Excluir "${p.nome}" permanentemente?`)) return
  await api.delete(`/produtos/${p.id}`)
  await load()
}

onMounted(load)
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200;
  display: flex; align-items: center; justify-content: center; padding: 1rem;
}
.modal-content {
  background: white; border-radius: 16px; padding: 1.5rem;
  width: 100%; max-height: 85vh; overflow-y: auto;
}
.modal-produto { max-width: 680px; }

/* Tabs */
.form-tabs {
  display: flex; gap: 4px; margin: 1rem 0;
  border-bottom: 2px solid var(--border);
}
.form-tab {
  padding: 0.6rem 1rem; border: none; background: transparent;
  font-size: 0.85rem; font-weight: 600; cursor: pointer;
  color: var(--text-muted); border-bottom: 2px solid transparent;
  margin-bottom: -2px; transition: var(--transition);
  display: flex; align-items: center; gap: 6px;
}
.form-tab.active { color: var(--primary); border-bottom-color: var(--primary); }
.form-tab:hover { color: var(--text-secondary); }

/* Image Upload */
.image-upload-area { text-align: center; padding: 0.5rem 0; }
.image-preview {
  width: 100%; max-width: 320px; height: 200px;
  margin: 0 auto 1rem; border-radius: var(--radius);
  overflow: hidden; position: relative;
  border: 2px dashed var(--border);
  display: flex; align-items: center; justify-content: center;
  background: var(--background);
}
.image-preview img {
  width: 100%; height: 100%; object-fit: cover;
}
.image-preview.empty { flex-direction: column; gap: 8px; cursor: pointer; }
.image-preview.empty i { font-size: 2.5rem; color: var(--text-muted); }
.image-preview.empty p { font-size: 0.85rem; color: var(--text-muted); }
.image-remove-btn {
  position: absolute; top: 8px; right: 8px;
  background: rgba(239,68,68,0.9); color: white;
  border: none; font-size: 0.75rem;
}
.image-hint { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; }

/* Table image thumb */
.table-img-thumb {
  width: 42px; height: 42px; border-radius: var(--radius-xs);
  overflow: hidden; background: var(--border-light);
  display: flex; align-items: center; justify-content: center;
}
.table-img-thumb img { width: 100%; height: 100%; object-fit: cover; }

/* Category badge */
.cat-badge {
  display: inline-flex; padding: 2px 10px; border-radius: 999px;
  font-size: 0.75rem; font-weight: 600;
  background: var(--info-light); color: #1e40af;
}
.extras-count {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--purple-light); color: var(--purple);
  font-size: 0.8rem; font-weight: 700;
}

/* Toggle */
.toggle { position: relative; width: 44px; height: 24px; display: inline-block; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle .slider {
  position: absolute; inset: 0; background: #e2e8f0;
  border-radius: 999px; cursor: pointer; transition: 0.2s;
}
.toggle .slider::before {
  content: ''; position: absolute;
  height: 18px; width: 18px; left: 3px; bottom: 3px;
  background: white; border-radius: 50%; transition: 0.2s;
}
.toggle input:checked + .slider { background: #16a34a; }
.toggle input:checked + .slider::before { transform: translateX(20px); }

/* Extra row */
.extra-row { margin-bottom: 8px; }
.extra-fields {
  display: flex; gap: 8px; align-items: center;
  padding: 8px 10px; border-radius: var(--radius-xs);
  background: var(--border-light); border: 1px solid var(--border);
}
.extra-name { flex: 1; }
.extra-number-group {
  display: flex; align-items: center; gap: 4px;
  width: 100px;
}
.extra-currency { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); }
.extra-price-input { width: 80px; }
.extra-max-group {
  display: flex; align-items: center; gap: 4px;
}
.extra-max-label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
.extra-max-input { width: 50px; text-align: center; }

.extra-fields input {
  padding: 6px 8px; border: 1.5px solid var(--border);
  border-radius: 4px; font-size: 0.85rem; outline: none;
  transition: var(--transition);
}
.extra-fields input:focus { border-color: var(--primary); }

.extras-header {
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}
</style>
