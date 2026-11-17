<template>
  <div class="legend">
    <h3 class="legend-title">
      图例
    </h3>

    <div
      v-if="store.legendMode === 'category'"
      class="legend-category"
    >
      <div
        v-for="code in CATEGORY_ORDER"
        :key="code"
        class="legend-item"
        :class="{ 'is-hidden': !isVisible(code) }"
      >
        <span
          class="legend-swatch"
          :style="{ background: CATEGORY_SYMBOLS[code].color }"
        />
        <span class="legend-label">{{ CATEGORY_SYMBOLS[code].l1Name }}</span>
      </div>
    </div>

    <div
      v-else-if="store.legendMode === 'class'"
      class="legend-class"
    >
      <div
        v-for="(breakItem, index) in store.classBreaks"
        :key="index"
        class="legend-item"
      >
        <span
          class="legend-swatch"
          :style="{ background: classColor(index) }"
        />
        <span class="legend-label">{{ breakItem }}</span>
      </div>
      <p
        v-if="!store.classBreaks.length"
        class="legend-empty"
      >
        暂无分级区间
      </p>
    </div>

    <div
      v-else-if="store.legendMode === 'heat'"
      class="legend-heat"
    >
      <div class="heat-gradient" />
      <div class="heat-labels">
        <span>低密度</span>
        <span>高密度</span>
      </div>
    </div>

    <div
      v-else-if="store.legendMode === 'cluster'"
      class="legend-cluster"
    >
      <div class="legend-item">
        <span class="cluster-bubble small" />
        <span>少量设施</span>
      </div>
      <div class="legend-item">
        <span class="cluster-bubble large" />
        <span>大量设施</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useMapStore } from '@/stores/mapStore'
import { CATEGORY_SYMBOLS, CATEGORY_ORDER, CLASS_BREAK_COLORS } from '@/config/symbols'

const store = useMapStore()

/**
 * 判断某类设施图层是否可见（FR-M1-05 处理规则 5：隐藏时图例项置灰）。
 * @param {string} code 大类编码
 * @returns {boolean} 是否可见
 */
function isVisible(code) {
  const layer = store.getLayerById(`facility-${code.toLowerCase()}`)
  return layer ? layer.visible : false
}

/**
 * 分级图例取色（FR-M3-02：5 级色带，由浅到深）。
 * @param {number} index 级序号
 * @returns {string} 颜色
 */
function classColor(index) {
  return CLASS_BREAK_COLORS[Math.min(index, CLASS_BREAK_COLORS.length - 1)]
}
</script>

<style scoped>
.legend {
  width: 100%;
  font-size: 12px;
}

.legend-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.legend-item.is-hidden {
  opacity: 0.35;
}

.legend-swatch {
  width: 14px;
  height: 14px;
  border: 1px solid #dcdfe6;
  flex: 0 0 auto;
}

.heat-gradient {
  height: 14px;
  background: linear-gradient(to right, #1e3a8a, #2563eb, #f59e0b, #ef4444, #dc2626);
  border: 1px solid #dcdfe6;
}

.heat-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  color: #909399;
}

.cluster-bubble {
  display: inline-block;
  border-radius: 50%;
  background: rgba(74, 144, 217, 0.5);
  border: 1px solid #4a90d9;
}

.cluster-bubble.small {
  width: 12px;
  height: 12px;
}

.cluster-bubble.large {
  width: 20px;
  height: 20px;
}

.legend-empty {
  color: #909399;
}
</style>
