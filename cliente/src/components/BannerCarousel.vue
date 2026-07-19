<template>
  <div class="carousel" @mouseenter="pauseAutoPlay" @mouseleave="resumeAutoPlay">
    <div class="carousel-slides" :style="{ transform: `translateX(-${currentIndex * 100}%)` }">
      <div
        v-for="(slide, index) in slides"
        :key="index"
        class="carousel-slide"
        :class="{ clickable: slide.link }"
        :role="slide.link ? 'button' : null"
        :tabindex="slide.link ? 0 : null"
        @click="slide.link && navigate(slide.link)"
        @keydown.enter="slide.link && navigate(slide.link)"
      >
        <img :src="slide.image" :alt="slide.title" />
        <div class="carousel-overlay">
          <h2>{{ slide.title }}</h2>
          <p>{{ slide.subtitle }}</p>
          <span v-if="slide.link" class="carousel-cta">
            Saiba mais <i class="fas fa-arrow-right"></i>
          </span>
        </div>
      </div>
    </div>

    <!-- Navigation Arrows -->
    <button class="carousel-arrow carousel-arrow-left" @click="prev">
      <i class="fas fa-chevron-left"></i>
    </button>
    <button class="carousel-arrow carousel-arrow-right" @click="next">
      <i class="fas fa-chevron-right"></i>
    </button>

    <!-- Dots -->
    <div class="carousel-dots">
      <button
        v-for="(_, index) in slides"
        :key="index"
        class="carousel-dot"
        :class="{ active: index === currentIndex }"
        @click="goTo(index)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  slides: {
    type: Array,
    default: () => [
      {
        image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80',
        title: 'Cardápio Digital',
        subtitle: 'Ingredientes selecionados, sabor inigualável.',
      },
    ],
  },
})

const router = useRouter()
const currentIndex = ref(0)
let autoplayInterval = null

function navigate(url) {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    window.open(url, '_blank')
  } else {
    router.push(url)
  }
}

function next() {
  currentIndex.value = (currentIndex.value + 1) % props.slides.length
}

function prev() {
  currentIndex.value = (currentIndex.value - 1 + props.slides.length) % props.slides.length
}

function goTo(index) {
  currentIndex.value = index
  resetAutoPlay()
}

function startAutoPlay() {
  if (props.slides.length <= 1) return
  autoplayInterval = setInterval(next, 5000)
}

function pauseAutoPlay() {
  if (autoplayInterval) clearInterval(autoplayInterval)
}

function resumeAutoPlay() {
  startAutoPlay()
}

function resetAutoPlay() {
  pauseAutoPlay()
  startAutoPlay()
}

onMounted(() => startAutoPlay())
onUnmounted(() => pauseAutoPlay())
</script>

<style scoped>
.carousel {
  position: relative;
  height: 260px;
  margin: 0;
  border-radius: 0;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.carousel-slides {
  display: flex;
  height: 100%;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.carousel-slide {
  min-width: 100%;
  height: 100%;
  position: relative;
  flex-shrink: 0;
}

.carousel-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.carousel-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.1) 100%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 1.5rem;
  color: white;
}

.carousel-overlay h2 {
  font-size: 1.5rem;
  font-weight: 800;
  margin-bottom: 0.25rem;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.carousel-overlay p {
  font-size: 0.9rem;
  opacity: 0.95;
  max-width: 80%;
  text-shadow: 0 1px 4px rgba(0,0,0,0.3);
}

.carousel-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 0.5rem;
  padding: 0.4rem 1rem;
  background: rgba(220,38,38,0.9);
  color: white;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.2s ease;
  width: fit-content;
}

.carousel-slide.clickable {
  cursor: pointer;
}

.carousel-slide.clickable:hover .carousel-cta {
  background: #dc2626;
  transform: translateX(4px);
}

/* Navigation Arrows */
.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(4px);
  border: none;
  color: white;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0;
  z-index: 2;
}

.carousel:hover .carousel-arrow {
  opacity: 1;
}

.carousel-arrow:hover {
  background: rgba(255,255,255,0.4);
  transform: translateY(-50%) scale(1.1);
}

.carousel-arrow-left { left: 1rem; }
.carousel-arrow-right { right: 1rem; }

/* Dots */
.carousel-dots {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 2;
}

.carousel-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255,255,255,0.4);
  border: 2px solid rgba(255,255,255,0.6);
  cursor: pointer;
  transition: all 0.3s ease;
  padding: 0;
}

.carousel-dot.active {
  background: #dc2626;
  border-color: #dc2626;
  transform: scale(1.2);
}

@media (min-width: 768px) {
  .carousel {
    height: 320px;
  }
  .carousel-overlay h2 {
    font-size: 2rem;
  }
}
</style>
