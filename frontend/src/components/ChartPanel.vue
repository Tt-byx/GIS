<script setup>
/**
 * 图表面板（FR-M3-05；T-048）：ECharts 容器，容器高度固定 220px。
 * 纯展示组件（AR-15：不 import modules）：数据与事件回调经 props 注入，点击经 emit 上抛。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  /** ECharts option（由 modules/theme-viz/chartLink.js 构建后传入） */
  option: { type: Object, required: true },
  /** 面板标题 */
  title: { type: String, default: '统计图表' },
})

const emit = defineEmits(['chartClick'])

const container = ref(null)

/** @type {import('echarts').ECharts | null} ECharts 实例（非响应式，X-01 与地图同理不进 ref 深代理） */
let chart = null

function render() {
  if (!container.value || !props.option) {
    return
  }
  if (!chart) {
    // eslint-disable-next-line no-undef -- echarts 经 npm 引入，仅在运行时用
    chart = echarts.init(container.value)
    chart.on('click', (params) => emit('chartClick', params))
  }
  chart.setOption(props.option)
}

function handleResize() {
  if (chart) {
    chart.resize()
  }
}

onMounted(() => {
  render()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (chart) {
    chart.dispose()
    chart = null
  }
})

watch(() => props.option, render, { deep: true })
</script>

<template>
  <section class="chart-panel">
    <header class="chart-panel__title">{{ title }}</header>
    <div ref="container" class="chart-panel__canvas" data-testid="chart-canvas"></div>
  </section>
</template>

<style scoped>
.chart-panel {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  padding: 8px;
}
.chart-panel__title {
  font-size: 13px;
  color: #374151;
  padding: 4px 8px;
}
/* FR-M3-05 规则 1：容器高度固定 220px */
.chart-panel__canvas {
  height: 220px;
  width: 100%;
}
</style>
