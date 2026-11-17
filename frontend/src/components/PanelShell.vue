<script setup>
/**
 * 通用滑入面板壳（04 §3 components：纯展示组件，props 进 emit 出，AR-15 禁止 import modules）。
 * FR-M2-06：从右侧滑入、宽度固定 ≤ 360px、Esc 可关闭。
 * rows 传入时渲染键值列表（配合 modules/query/detailPanel.js 的装配结果），
 * 未传时渲染默认插槽，供其他面板复用外壳。
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'

const props = defineProps({
  /** 是否可见（父级控制显隐） */
  visible: { type: Boolean, default: false },
  /** 面板标题 */
  title: { type: String, default: '详情' },
  /** 目标宽度（px），组件内钳制到 ≤ 360（FR-M2-06 处理规则 1） */
  width: { type: Number, default: 340 },
  /** 键值行数据 [{label, value}]，value 已由装配层保证不为空字面量 */
  rows: { type: Array, default: null },
})

const emit = defineEmits(['close'])

// AC-M2-06-3：面板宽度 ≤ 360px；钳制下限 240 保证可用性
const clampedWidth = computed(() => Math.min(Math.max(props.width, 240), 360))

function handleKeydown(event) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <transition name="panel-shell-slide">
    <section
      v-if="visible"
      class="panel-shell"
      :style="{ width: clampedWidth + 'px' }"
      data-testid="panel-shell"
    >
      <header class="panel-shell__header">
        <span class="panel-shell__title">{{ title }}</span>
        <button type="button" class="panel-shell__close" aria-label="关闭面板" @click="emit('close')">×</button>
      </header>
      <dl v-if="rows && rows.length" class="panel-shell__rows">
        <div v-for="row in rows" :key="row.label" class="panel-shell__row">
          <dt class="panel-shell__label">{{ row.label }}</dt>
          <dd class="panel-shell__value">{{ row.value }}</dd>
        </div>
      </dl>
      <div class="panel-shell__body">
        <slot />
      </div>
    </section>
  </transition>
</template>

<style scoped>
.panel-shell {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  max-width: 360px; /* FR-M2-06 处理规则 1 */
  background: #ffffff;
  border-left: 1px solid #e5e7eb;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow: auto;
  z-index: 1200;
}
.panel-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
}
.panel-shell__title {
  font-weight: 600;
  color: #111827;
}
.panel-shell__close {
  border: none;
  background: transparent;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  color: #6b7280;
}
.panel-shell__rows {
  margin: 0;
  padding: 8px 16px;
}
.panel-shell__row {
  display: flex;
  padding: 6px 0;
  border-bottom: 1px dashed #f3f4f6;
}
.panel-shell__label {
  width: 88px;
  flex-shrink: 0;
  color: #6b7280;
}
.panel-shell__value {
  margin: 0;
  flex: 1;
  color: #111827;
  word-break: break-all;
}
.panel-shell-slide-enter-active,
.panel-shell-slide-leave-active {
  transition: transform 0.25s ease;
}
.panel-shell-slide-enter-from,
.panel-shell-slide-leave-to {
  transform: translateX(100%);
}
</style>
