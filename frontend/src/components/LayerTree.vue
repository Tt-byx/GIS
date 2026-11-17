<template>
  <div class="layer-tree">
    <section
      v-for="group in groups"
      :key="group.id"
      class="layer-group"
    >
      <h3 class="group-title">
        {{ group.name }}
      </h3>
      <div
        v-for="layer in groupedLayers(group.id)"
        :key="layer.id"
        class="layer-item"
      >
        <label class="layer-row">
          <input
            type="checkbox"
            :checked="layer.visible"
            :disabled="layer.group === 'basemap'"
            @change="onToggle(layer, $event)"
          />
          <span class="layer-name">{{ layer.name }}</span>
        </label>
        <div
          v-if="layer.group !== 'basemap'"
          class="opacity-row"
        >
          <span class="opacity-label">透明度</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            :value="layer.opacity"
            @input="onOpacity(layer, $event)"
          />
          <span class="opacity-value">{{ layer.opacity.toFixed(1) }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { useMapStore } from '@/stores/mapStore'

// 规则 AR-15：components 禁止 import modules；组件只 emit，由集成层调用 layerControl。
const emit = defineEmits(['layer-toggle', 'opacity-change'])
const store = useMapStore()

const groups = [
  { id: 'basemap', name: '底图' },
  { id: 'facility', name: '设施' },
  { id: 'analysis', name: '分析结果' },
]

/**
 * 按分组过滤图层，供模板分组渲染（FR-M1-05 处理规则 1）。
 * @param {string} groupId 分组标识
 * @returns {Array} 图层数组
 */
function groupedLayers(groupId) {
  return store.layersByGroup(groupId)
}

/**
 * 切换图层显隐（FR-M1-05：底图不可关）。
 * @param {object} layer 图层条目
 * @param {Event} event change 事件
 */
function onToggle(layer, event) {
  emit('layer-toggle', { layerId: layer.id, visible: event.target.checked })
}

/**
 * 调整透明度（FR-M1-05 处理规则 3）。
 * @param {object} layer 图层条目
 * @param {Event} event input 事件
 */
function onOpacity(layer, event) {
  emit('opacity-change', { layerId: layer.id, opacity: Number(event.target.value) })
}
</script>

<style scoped>
.layer-tree {
  font-size: 13px;
}

.layer-group {
  margin-bottom: 16px;
}

.group-title {
  margin: 0 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #ebeef5;
  font-size: 14px;
  font-weight: 600;
}

.layer-item {
  margin-bottom: 10px;
}

.layer-row {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.opacity-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding-left: 20px;
}

.opacity-label {
  color: #909399;
  font-size: 12px;
}

.opacity-value {
  min-width: 24px;
  color: #606266;
  font-size: 12px;
}

input[type='range'] {
  flex: 1 1 auto;
}
</style>
