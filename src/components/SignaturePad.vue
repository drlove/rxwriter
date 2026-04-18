<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  modelValue: string   // Base64 data-URL
  width?: number
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  width: 320,
  height: 120,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let drawing = false
let lastX = 0
let lastY = 0

onMounted(() => {
  const canvas = canvasRef.value!
  ctx = canvas.getContext('2d')!
  ctx.strokeStyle = '#1a3a5c'
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Restore existing signature if provided
  if (props.modelValue) {
    const img = new Image()
    img.onload = () => ctx!.drawImage(img, 0, 0)
    img.src = props.modelValue
  }
})

onUnmounted(() => {
  ctx = null
})

function getXY(e: MouseEvent | TouchEvent): [number, number] {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  if (e instanceof TouchEvent) {
    const t = e.touches[0]
    return [(t.clientX - rect.left) * scaleX, (t.clientY - rect.top) * scaleY]
  }
  return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY]
}

function startDraw(e: MouseEvent | TouchEvent) {
  e.preventDefault()
  drawing = true
  ;[lastX, lastY] = getXY(e)
}

function draw(e: MouseEvent | TouchEvent) {
  if (!drawing || !ctx) return
  e.preventDefault()
  const [x, y] = getXY(e)
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(x, y)
  ctx.stroke()
  lastX = x
  lastY = y
}

function endDraw() {
  if (!drawing) return
  drawing = false
  emit('update:modelValue', canvasRef.value!.toDataURL('image/png'))
}

function clear() {
  if (!ctx) return
  ctx.clearRect(0, 0, props.width, props.height)
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="signature-pad">
    <div class="border border-gray-300 rounded bg-white inline-block">
      <canvas
        ref="canvasRef"
        :width="width"
        :height="height"
        class="block cursor-crosshair touch-none"
        @mousedown="startDraw"
        @mousemove="draw"
        @mouseup="endDraw"
        @mouseleave="endDraw"
        @touchstart="startDraw"
        @touchmove="draw"
        @touchend="endDraw"
      />
    </div>
    <button
      type="button"
      class="mt-1 text-xs text-gray-500 underline hover:text-red-500"
      @click="clear"
    >
      Clear signature
    </button>
  </div>
</template>
