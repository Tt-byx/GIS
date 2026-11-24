<script setup>
import { ref, onMounted } from 'vue'
import {
  ensureMap,
  zoomIn,
  zoomOut,
  resetView,
  prevView,
  measure,
  clearMeasure,
  toggleFullscreen,
  screenshot,
  toggleLayer,
  changeOpacity,
} from '@/modules/map-base'
import LayerTree from '@/components/LayerTree.vue'
import MapLegend from '@/components/MapLegend.vue'
import PanelShell from '@/components/PanelShell.vue'
import { searchByAttr, flyToFeature, suggest } from '@/modules/query'
import { assemblePanelRows } from '@/modules/query/detailPanel'
import { runBuffer } from '@/modules/analysis/buffer'
import { runServiceArea, renderServiceAreaLayer } from '@/modules/analysis/serviceArea'
import { runAccessibility, renderAccessibilityLayer } from '@/modules/analysis/accessibility'
import { clearAllAnalysisResults, addAnalysisResult } from '@/modules/analysis/resultManage'
import { buildDistrictTableRows, sortDistrictTable } from '@/modules/report/districtTable'
import { runExport } from '@/modules/report/export'
import { eventBus, EVENTS } from '@/core/eventBus'

// 当前左侧激活 Tab
const activeTab = ref('layers') // 'layers' | 'query' | 'analysis' | 'report'

// 设施检索状态
const keyword = ref('')
const selectedCategory = ref('')
const searchResults = ref([])
const isSearching = ref(false)

// 详情面板状态
const detailVisible = ref(false)
const detailTitle = ref('设施详情')
const detailRows = ref([])

// 空间分析状态
const bufferRadius = ref(1000)
const bufferDissolve = ref(true)
const serviceAreaMode = ref('WALK')
const serviceAreaThreshold = ref(15)
const accessThreshold = ref(15)
const accessDecay = ref('GAUSSIAN')
const analysisMessage = ref('')

// 统计报表状态
const statRows = ref([])

onMounted(() => {
  ensureMap('map')

  // 监听要素选中事件，打开右侧属性面板
  eventBus.on(EVENTS.FEATURE_SELECT, (feature) => {
    if (feature) {
      detailTitle.value = feature.name || '设施详情'
      detailRows.value = assemblePanelRows(feature)
      detailVisible.value = true
    }
  })
})

// 图层控制处理
function handleLayerToggle({ layerId, visible }) {
  toggleLayer(layerId, visible)
}

function handleOpacityChange({ layerId, opacity }) {
  changeOpacity(layerId, opacity)
}

// 设施检索处理
async function handleSearch() {
  isSearching.value = true
  try {
    const res = await searchByAttr({
      keyword: keyword.value,
      categoryL1: selectedCategory.value || undefined,
    })
    searchResults.value = res.list || []
  } catch (err) {
    console.error('检索失败:', err)
  } finally {
    isSearching.value = false
  }
}

function handleSelectFeature(item) {
  flyToFeature(item)
  detailTitle.value = item.name
  detailRows.value = assemblePanelRows(item)
  detailVisible.value = true
}

// 缓冲区分析运行
function handleRunBuffer() {
  analysisMessage.value = '正在计算缓冲区...'
  try {
    const pts = searchResults.value.length > 0
      ? searchResults.value
      : [{ lon: 114.30, lat: 30.50 }, { lon: 114.32, lat: 30.52 }]
    const result = runBuffer({
      points: pts,
      radius: Number(bufferRadius.value),
      dissolve: bufferDissolve.value,
    })
    addAnalysisResult({
      id: `buffer-${Date.now()}`,
      type: 'buffer',
      name: `缓冲区 (${bufferRadius.value}m)`,
      geojson: result.featureCollection,
      stats: result.stats,
    })
    analysisMessage.value = `缓冲区计算完成：覆盖居民点 ${result.stats.coveredResidentialCount} 个，覆盖率 ${(result.stats.coverageRate * 100).toFixed(1)}%`
  } catch (e) {
    analysisMessage.value = `缓冲区分析失败: ${e.message}`
  }
}

// 服务区分析运行
async function handleRunServiceArea() {
  analysisMessage.value = '正在请求网络服务区...'
  try {
    const res = await runServiceArea({
      categoryL2: 'CHC',
      travelMode: serviceAreaMode.value,
      thresholds: [Number(serviceAreaThreshold.value)],
    })
    renderServiceAreaLayer(res)
    addAnalysisResult({
      id: `sa-${Date.now()}`,
      type: 'serviceArea',
      name: `服务区 (${serviceAreaThreshold.value}min)`,
      geojson: {
        type: 'FeatureCollection',
        features: res.areas.map((a) => a.feature).filter(Boolean),
      },
    })
    analysisMessage.value = `服务区生成成功：总小区 ${res.summary.totalCommunity}，未覆盖 ${res.summary.uncoveredCount}`
  } catch (e) {
    analysisMessage.value = `服务区请求失败: ${e.message}`
  }
}

// 2SFCA 可达性运行
async function handleRunAccessibility() {
  analysisMessage.value = '正在执行 2SFCA 可达性分析...'
  try {
    const res = await runAccessibility({
      thresholdMinutes: Number(accessThreshold.value),
      decay: accessDecay.value,
    })
    if (!res.success) {
      analysisMessage.value = res.message
      return
    }
    renderAccessibilityLayer(res)
    addAnalysisResult({
      id: `access-${Date.now()}`,
      type: 'accessibility',
      name: `可达性 (${accessThreshold.value}min)`,
      geojson: res.featureCollection,
      stats: res.stats,
    })
    analysisMessage.value = `可达性计算完成：最高分 ${res.stats.max}，平均分 ${res.stats.mean}`
  } catch (e) {
    analysisMessage.value = `可达性计算失败: ${e.message}`
  }
}

// 一键清除分析结果
function handleClearAnalysis() {
  clearAllAnalysisResults()
  analysisMessage.value = '已清除全部分析图层'
}

// 导出处理
async function handleExportReport(format) {
  const headers = [
    { key: 'unitName', label: '单元名称' },
    { key: 'facilityCount', label: '设施数' },
    { key: 'perCapitaDisplay', label: '每万人设施数' },
  ]
  await runExport({
    type: 'STAT_DISTRICT',
    format,
    headers,
    rows: statRows.value.length ? statRows.value : [{ unitName: '青山区', facilityCount: 120, perCapitaDisplay: '14.5' }],
    filename: 'stat_report',
  })
}
</script>

<template>
  <div class="app-layout">
    <!-- 顶栏与地图工具条 -->
    <header class="app-topbar">
      <div class="brand-title">武汉市三区五类公共服务设施 WebGIS 平台</div>
      <div class="map-toolbar">
        <button type="button" class="btn" title="放大" @click="zoomIn">放大 +</button>
        <button type="button" class="btn" title="缩小" @click="zoomOut">缩小 -</button>
        <button type="button" class="btn" title="复位视角" @click="resetView">复位</button>
        <button type="button" class="btn" title="上一视图" @click="prevView">返回</button>
        <button type="button" class="btn" title="距离量算" @click="measure({ mode: 'distance' })">测距</button>
        <button type="button" class="btn" title="面积量算" @click="measure({ mode: 'area' })">测面</button>
        <button type="button" class="btn btn-warning" title="清除量算" @click="clearMeasure">清测</button>
        <button type="button" class="btn" title="全屏切换" @click="toggleFullscreen">全屏</button>
        <button type="button" class="btn btn-primary" title="导出地图截图" @click="screenshot">截图</button>
      </div>
    </header>

    <div class="app-body">
      <!-- 左侧多功能面板 -->
      <aside class="app-left-panel">
        <nav class="nav-tabs">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'layers' }"
            @click="activeTab = 'layers'"
          >
            图层
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'query' }"
            @click="activeTab = 'query'"
          >
            检索
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'analysis' }"
            @click="activeTab = 'analysis'"
          >
            分析
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: activeTab === 'report' }"
            @click="activeTab = 'report'"
          >
            报表
          </button>
        </nav>

        <div class="tab-content">
          <!-- 图层与图例面板 -->
          <div v-show="activeTab === 'layers'" class="tab-pane">
            <LayerTree
              @layer-toggle="handleLayerToggle"
              @opacity-change="handleOpacityChange"
            />
            <hr class="divider" />
            <MapLegend />
          </div>

          <!-- 设施检索面板 -->
          <div v-show="activeTab === 'query'" class="tab-pane">
            <div class="query-form">
              <input
                v-model="keyword"
                type="text"
                placeholder="搜索设施名称/地址..."
                class="input-field"
                @keyup.enter="handleSearch"
              />
              <select v-model="selectedCategory" class="select-field">
                <option value="">全部类别</option>
                <option value="EDU">教育设施</option>
                <option value="MED">医疗卫生</option>
                <option value="CUL">文化体育</option>
                <option value="WEL">社会福利</option>
                <option value="COM">社区服务</option>
              </select>
              <button
                type="button"
                class="btn btn-primary btn-block"
                :disabled="isSearching"
                @click="handleSearch"
              >
                {{ isSearching ? '正在查询...' : '查询设施' }}
              </button>
            </div>

            <div class="result-list">
              <div v-if="searchResults.length === 0" class="empty-hint">
                暂无检索结果，请输入关键词查询
              </div>
              <div
                v-for="item in searchResults"
                :key="item.facCode || item.name"
                class="result-item"
                @click="handleSelectFeature(item)"
              >
                <div class="item-name">{{ item.name }}</div>
                <div class="item-meta">{{ item.address || item.district || '武汉市' }}</div>
              </div>
            </div>
          </div>

          <!-- 空间分析面板 -->
          <div v-show="activeTab === 'analysis'" class="tab-pane">
            <section class="analysis-section">
              <h4>M4 缓冲区分析</h4>
              <div class="form-row">
                <label>半径(米):</label>
                <input v-model.number="bufferRadius" type="number" min="100" max="5000" step="100" class="input-field small" />
              </div>
              <div class="form-row">
                <label>
                  <input v-model="bufferDissolve" type="checkbox" /> 融合重叠面 (dissolve)
                </label>
              </div>
              <button type="button" class="btn btn-primary btn-block" @click="handleRunBuffer">执行缓冲区分析</button>
            </section>

            <section class="analysis-section">
              <h4>M4 网络服务区分析</h4>
              <div class="form-row">
                <label>出行方式:</label>
                <select v-model="serviceAreaMode" class="select-field small">
                  <option value="WALK">步行</option>
                  <option value="DRIVE">车行</option>
                </select>
              </div>
              <div class="form-row">
                <label>阈值(分钟):</label>
                <select v-model.number="serviceAreaThreshold" class="select-field small">
                  <option :value="5">5 分钟</option>
                  <option :value="10">10 分钟</option>
                  <option :value="15">15 分钟</option>
                </select>
              </div>
              <button type="button" class="btn btn-primary btn-block" @click="handleRunServiceArea">生成网络服务区</button>
            </section>

            <section class="analysis-section">
              <h4>M4 2SFCA 可达性分析</h4>
              <div class="form-row">
                <label>阈值(分钟):</label>
                <select v-model.number="accessThreshold" class="select-field small">
                  <option :value="5">5 分钟</option>
                  <option :value="10">10 分钟</option>
                  <option :value="15">15 分钟</option>
                </select>
              </div>
              <div class="form-row">
                <label>衰减类型:</label>
                <select v-model="accessDecay" class="select-field small">
                  <option value="GAUSSIAN">高斯衰减</option>
                  <option value="LINEAR">线性衰减</option>
                  <option value="BINARY">两分制</option>
                </select>
              </div>
              <button type="button" class="btn btn-primary btn-block" @click="handleRunAccessibility">计算可达性</button>
            </section>

            <div class="analysis-actions">
              <button type="button" class="btn btn-danger btn-block" @click="handleClearAnalysis">一键清除全部成果</button>
              <div v-if="analysisMessage" class="status-msg">{{ analysisMessage }}</div>
            </div>
          </div>

          <!-- 报表导出面板 -->
          <div v-show="activeTab === 'report'" class="tab-pane">
            <h4>M5 统计报表与成果导出</h4>
            <div class="export-box">
              <button type="button" class="btn btn-primary" @click="handleExportReport('csv')">导出 CSV (含 BOM)</button>
              <button type="button" class="btn btn-primary" @click="handleExportReport('xlsx')">导出 Excel (.xlsx)</button>
            </div>
          </div>
        </div>
      </aside>

      <!-- 地图主视区 -->
      <main class="app-map-container">
        <div id="map" class="map-viewer"></div>
      </main>

      <!-- 属性面板 (固定 15 项字段) -->
      <PanelShell
        :visible="detailVisible"
        :title="detailTitle"
        :rows="detailRows"
        @close="detailVisible = false"
      />
    </div>

    <!-- 底部状态栏 -->
    <footer class="app-bottombar">
      <span>坐标系统：CGCS2000 (EPSG:4490)</span>
      <span>平台状态：就绪 | 接口契约：SPEC-03 FROZEN</span>
      <span>当前数据版本：武汉三区 5 类 25 种公共服务设施</span>
    </footer>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.app-topbar {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #1e293b;
  color: #f8fafc;
  border-bottom: 1px solid #334155;
  z-index: 1000;
}
.brand-title {
  font-weight: 600;
  font-size: 16px;
}
.map-toolbar {
  display: flex;
  gap: 6px;
}
.btn {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid #475569;
  border-radius: 4px;
  background: #334155;
  color: #f8fafc;
  cursor: pointer;
}
.btn:hover {
  background: #475569;
}
.btn-primary {
  background: #2563eb;
  border-color: #1d4ed8;
}
.btn-primary:hover {
  background: #1d4ed8;
}
.btn-warning {
  background: #d97706;
  border-color: #b45309;
}
.btn-danger {
  background: #dc2626;
  border-color: #b91c1c;
}
.btn-block {
  width: 100%;
  margin-top: 8px;
}
.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}
.app-left-panel {
  width: 320px;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  z-index: 500;
}
.nav-tabs {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}
.tab-btn {
  flex: 1;
  padding: 10px 0;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.tab-btn.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
  background: #ffffff;
}
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
}
.divider {
  border: 0;
  border-top: 1px solid #e2e8f0;
  margin: 16px 0;
}
.input-field,
.select-field {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 8px;
  box-sizing: border-box;
}
.input-field.small,
.select-field.small {
  width: auto;
  margin-bottom: 0;
}
.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: #334155;
}
.analysis-section {
  background: #f8fafc;
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 14px;
  border: 1px solid #f1f5f9;
}
.analysis-section h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: #1e293b;
}
.status-msg {
  margin-top: 8px;
  font-size: 12px;
  color: #2563eb;
  background: #eff6ff;
  padding: 6px;
  border-radius: 4px;
}
.result-list {
  margin-top: 12px;
}
.result-item {
  padding: 8px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
}
.result-item:hover {
  background: #f8fafc;
}
.item-name {
  font-size: 13px;
  font-weight: 500;
  color: #0f172a;
}
.item-meta {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}
.empty-hint {
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
  padding: 20px 0;
}
.export-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}
.app-map-container {
  flex: 1;
  min-width: 0;
  position: relative;
}
.map-viewer {
  width: 100%;
  height: 100%;
}
.app-bottombar {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #0f172a;
  color: #94a3b8;
  font-size: 12px;
  border-top: 1px solid #1e293b;
}
</style>
