<template>
  <div>
    <!-- Hero Banner Carrossel -->
    <BannerCarousel :slides="bannerSlides" />

    <!-- Search Bar -->
    <div class="search-bar">
      <i class="fas fa-search search-icon"></i>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Buscar por nome, categoria ou descrição..."
        @input="filterProducts"
      />
      <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- Categories Tabs -->
    <section class="categories-tabs" ref="categoriesRef">
      <button
        v-for="cat in categories"
        :key="cat.slug"
        class="category-tab"
        :class="{ active: activeCategory === cat.slug }"
        @click="selectCategory(cat.slug)"
      >
        {{ cat.nome }}
      </button>
    </section>

    <!-- Products Grid -->
    <section class="menu-section">
      <h2 class="section-title">
        <i class="fas fa-utensils"></i>
        {{ sectionTitle }}
      </h2>

      <div v-if="filteredProducts.length === 0 && !loading" class="empty-search">
        <i class="fas fa-search"></i>
        <p v-if="searchQuery">
          Nenhum prato encontrado para '{{ searchQuery }}'<br />
          <small>Tente buscar por outro nome ou categoria</small>
        </p>
        <p v-else>
          Nenhum produto disponível no momento.<br />
          <small>Volte mais tarde para conferir nosso cardápio.</small>
        </p>
      </div>

      <div v-else class="products-grid">
        <article
          v-for="product in filteredProducts"
          :key="product.id"
          class="product-card"
          @click="openProductModal(product)"
        >
          <div class="product-card-image">
            <img
              :src="productImgSrc(product)"
              :alt="product.nome"
              loading="lazy"
              @error="onImgError($event)"
            />
          </div>
          <div class="product-card-body">
            <h3>{{ product.nome }}</h3>
            <p>{{ product.descricao || 'Sem descrição' }}</p>
            <div class="product-card-footer">
              <span class="product-price">{{ formatPrice(product.preco) }}</span>
              <button class="btn-add-cart" @click.stop="quickAdd(product)">
                <i class="fas fa-plus"></i>
              </button>
            </div>
          </div>
        </article>
      </div>

      <div v-if="loading" class="loading-wrapper">
        <div class="spinner spinner-center"></div>
      </div>
    </section>

    <!-- Product Modal -->
    <div class="modal-backdrop" :class="{ open: productModalOpen }" @click.self="closeProductModal">
      <div class="product-modal pos-relative">
        <button class="modal-close" @click="closeProductModal">&times;</button>
        <img
          :src="productImgSrc(selectedProduct)"
          :alt="selectedProduct?.nome"
          class="modal-image"
          @error="onImgError"
        />
        <div class="modal-body">
          <h3>{{ selectedProduct?.nome }}</h3>
          <p class="desc">{{ selectedProduct?.descricao || 'Sem descrição' }}</p>

          <div v-if="selectedExtras.length > 0">
            <h4 class="modal-extras-title">
              <i class="fas fa-plus-circle"></i> Adicionais (Opcional)
            </h4>
            <div class="extra-item" v-for="extra in selectedExtras" :key="extra.id">
              <div class="extra-item-left">
                <label class="extra-label">
                  {{ extra.nome }}
                </label>
                <!-- Qty selector for max > 1 or unlimited -->
                <div v-if="!extra.maximo || extra.maximo > 1" class="extra-qty">
                  <button class="extra-qty-btn" @click="decrementExtra(extra)" :disabled="getExtraQty(extra) <= 0">−</button>
                  <span class="extra-qty-value">{{ getExtraQty(extra) }}</span>
                  <button class="extra-qty-btn" @click="incrementExtra(extra)" :disabled="getExtraQty(extra) >= (extra.maximo || 99)">+</button>
                </div>
                <!-- Simple checkbox for max = 1 -->
                <label v-else class="extra-checkbox-label">
                  <input type="checkbox" :checked="hasExtra(extra)" @change="toggleExtra(extra)" />
                  <span>Adicionar</span>
                </label>
              </div>
              <span class="extra-price">{{ formatPrice(extra.preco) }}</span>
            </div>
          </div>

          <div class="modal-footer">
            <span class="price">{{ formatPrice(productTotal) }}</span>
            <button class="btn-add-modal" @click="addToCart">
              <i class="fas fa-shopping-bag"></i> Adicionar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import api from '../services/api'
import BannerCarousel from '../components/BannerCarousel.vue'

const addToast = inject('addToast')

// Carrossel de Banner — carregado dinamicamente do backend
const bannerSlides = ref([
  // Fallback enquanto carrega
  {
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80',
    title: 'Cardápio Digital',
    subtitle: 'Carregando...',
  },
])

// Data
const products = ref([])
const categories = ref([
  { nome: 'Todos', slug: 'todos' },
  { nome: 'Em Destaque', slug: 'destaques' },
  { nome: 'Pratos', slug: 'principais' },
  { nome: 'Executivos', slug: 'executivos' },
  { nome: 'Saladas', slug: 'saladas' },
  { nome: 'Monte Seu', slug: 'monte-seu' },
  { nome: 'Para 2', slug: 'para-2' },
  { nome: 'Sobremesas', slug: 'sobremesas' },
  { nome: 'Bebidas', slug: 'bebidas' },
])
const loading = ref(true)
const searchQuery = ref('')
const activeCategory = ref('todos')

// Product modal
const productModalOpen = ref(false)
const selectedProduct = ref(null)
const selectedExtras = ref([])
const chosenExtras = ref([])          // [{extra, qty}] for extras with max > 1
const chosenExtraSet = ref(new Set()) // Set of extra IDs (simple checkbox mode)

// Cart
const cartItems = inject('cartItems')
const updateCart = inject('updateCart')

const filteredProducts = computed(() => {
  let result = products.value

  if (activeCategory.value !== 'todos') {
    result = result.filter(p => p.categoria_slug === activeCategory.value)
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      p.nome.toLowerCase().includes(q) ||
      p.descricao?.toLowerCase().includes(q) ||
      p.categoria_nome?.toLowerCase().includes(q)
    )
  }

  return result
})

const sectionTitle = computed(() => {
  if (activeCategory.value === 'todos') return 'Nossos Pratos'
  const cat = categories.value.find(c => c.slug === activeCategory.value)
  return cat?.nome || 'Cardápio'
})

const productTotal = computed(() => {
  if (!selectedProduct.value) return 0
  // Extras com quantidade (max > 1)
  const qtyExtrasTotal = chosenExtras.value.reduce((acc, e) => acc + (e.extra.preco * e.qty), 0)
  // Extras checkbox (max = 1)
  const setExtrasTotal = selectedExtras.value
    .filter(e => chosenExtraSet.value.has(e.id))
    .reduce((acc, e) => acc + e.preco, 0)
  return selectedProduct.value.preco + qtyExtrasTotal + setExtrasTotal
})

function formatPrice(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(value)
}

function productImgSrc(product) {
  if (!product) return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80'
  if (product.imagem_base64) {
    const b64 = product.imagem_base64
    // Detectar formato pela assinatura base64
    if (b64.startsWith('/9j/')) return 'data:image/jpeg;base64,' + b64
    if (b64.startsWith('iVBORw0KGgo')) return 'data:image/png;base64,' + b64
    if (b64.startsWith('R0lGOD')) return 'data:image/gif;base64,' + b64
    if (b64.startsWith('UklGR')) return 'data:image/webp;base64,' + b64
    // SVG: detectar por decoding
    try {
      const decoded = atob(b64.substring(0, 20))
      if (decoded.startsWith('<svg')) {
        return 'data:image/svg+xml;base64,' + b64
      }
    } catch {}
    // Fallback: tenta PNG, depois JPEG
    return 'data:image/jpeg;base64,' + b64
  }
  if (product.imagem_url) return product.imagem_url
  return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80'
}

function onImgError(event) {
  event.target.src = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=300&q=80'
}

function selectCategory(slug) {
  activeCategory.value = slug
}

function openProductModal(product) {
  selectedProduct.value = product
  selectedExtras.value = product.extras || []
  chosenExtras.value = []
  chosenExtraSet.value = new Set()
  productModalOpen.value = true
}

function closeProductModal() {
  productModalOpen.value = false
  selectedProduct.value = null
}

// ── Extra selection (qty-based) ──
function getExtraQty(extra) {
  const found = chosenExtras.value.find(e => e.extra.id === extra.id)
  return found ? found.qty : 0
}

function incrementExtra(extra) {
  const max = extra.maximo || 99
  const found = chosenExtras.value.find(e => e.extra.id === extra.id)
  if (found) {
    if (found.qty < max) found.qty++
  } else {
    chosenExtras.value.push({ extra, qty: 1 })
  }
}

function decrementExtra(extra) {
  const idx = chosenExtras.value.findIndex(e => e.extra.id === extra.id)
  if (idx >= 0) {
    if (chosenExtras.value[idx].qty <= 1) {
      chosenExtras.value.splice(idx, 1)
    } else {
      chosenExtras.value[idx].qty--
    }
  }
}

// ── Extra selection (checkbox-based, max=1) ──
function hasExtra(extra) {
  return chosenExtraSet.value.has(extra.id)
}

function toggleExtra(extra) {
  if (chosenExtraSet.value.has(extra.id)) {
    chosenExtraSet.value.delete(extra.id)
  } else {
    chosenExtraSet.value.add(extra.id)
  }
  // Force reactivity
  chosenExtraSet.value = new Set(chosenExtraSet.value)
}

// ── Build extra array for cart item ──
function buildChosenExtrasArray() {
  const result = []
  // Qty-based extras
  for (const { extra, qty } of chosenExtras.value) {
    if (qty > 0) {
      result.push({ id: extra.id, nome: extra.nome, preco: extra.preco, qty })
    }
  }
  // Checkbox extras
  for (const extra of selectedExtras.value) {
    if (chosenExtraSet.value.has(extra.id)) {
      result.push({ id: extra.id, nome: extra.nome, preco: extra.preco, qty: 1 })
    }
  }
  return result
}

function addToCart() {
  if (!selectedProduct.value) return

  const chosenExtrasArray = buildChosenExtrasArray()
  let extrasTotal = 0
  for (const e of chosenExtrasArray) {
    extrasTotal += e.preco * e.qty
  }

  const itemTotal = selectedProduct.value.preco + extrasTotal

  // Normalizar extras para o formato antigo (compatibilidade)
  const extrasLegacy = chosenExtrasArray.map(e => ({
    nome: e.nome,
    preco: e.preco,
    qty: e.qty
  }))

  const existingIndex = cartItems.value.findIndex(
    item => item.produto_id === selectedProduct.value.id &&
      JSON.stringify(item.extras) === JSON.stringify(extrasLegacy)
  )

  if (existingIndex >= 0) {
    const items = [...cartItems.value]
    items[existingIndex].quantidade++
    items[existingIndex].subtotal += itemTotal
    updateCart(items)
  } else {
    const newItem = {
      produto_id: selectedProduct.value.id,
      nome_produto: selectedProduct.value.nome,
      quantidade: 1,
      preco_unitario: selectedProduct.value.preco,
      extras: extrasLegacy,
      subtotal: itemTotal,
    }
    updateCart([...cartItems.value, newItem])
  }

  addToast(`${selectedProduct.value.nome} adicionado ao carrinho!`, 'success')
  closeProductModal()
}

function quickAdd(product) {
  const extrasTotal = 0
  const existingIndex = cartItems.value.findIndex(
    item => item.produto_id === product.id && item.extras.length === 0
  )

  if (existingIndex >= 0) {
    const items = [...cartItems.value]
    items[existingIndex].quantidade++
    items[existingIndex].subtotal += product.preco
    updateCart(items)
  } else {
    const newItem = {
      produto_id: product.id,
      nome_produto: product.nome,
      quantidade: 1,
      preco_unitario: product.preco,
      extras: [],
      subtotal: product.preco,
    }
    updateCart([...cartItems.value, newItem])
  }

  addToast(`${product.nome} adicionado ao carrinho!`, 'success')
}

function bannerImg(banner) {
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
  return banner.imagem_url || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80'
}

async function carregarBanners() {
  try {
    const { data } = await api.get('/restaurante/banners')
    if (data.length > 0) {
      bannerSlides.value = data.map(b => ({
        image: bannerImg(b),
        title: b.titulo || 'Palazzo Mooca',
        subtitle: b.subtitulo || '',
        link: b.link_url || null,
      }))
    }
  } catch { /* usa fallback */ }
}

onMounted(async () => {
  // Carregar banners dinâmicos
  carregarBanners()

  try {
    // Endpoint otimizado: retorna produtos com extras em 2 queries
    const { data } = await api.get('/produtos/com-extras')
    products.value = data
  } catch (err) {
    addToast('Erro ao carregar cardápio.', 'error')
  } finally {
    loading.value = false
  }
})
</script>
