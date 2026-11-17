/**
 * M3 专题可视化编排（任务 T-045：分类符号 / 分级设色；AR-21 全量导出）。
 *
 * 硬规则：
 * 1. 分类符号颜色与形状 MUST 来自 config/symbols.js（FR-M3-01 规则 1/2），形状互不相同；
 * 2. 分级设色走 Jenks 5 级，图例数据 MUST 含数值区间（FR-M3-02 规则 2/4）；
 * 3. 切换指标先清除旧设色再重绘，禁止叠加（FR-M3-02 规则 6）；
 * 4. 统计数据 MUST 来自 API-04，前端禁止汇总设施列表代替（FR-M3-05 规则 4）；
 * 5. 模式切换经 theme:change 事件广播（AR-18），图例（R3 的 Legend.vue）据此更新（H-03）。
 */
import { fetchDistrictStats } from '@/api/stats'
import { createFeatureServer } from '@/core/serviceFactory'
import { getMap } from '@/core/mapInstance'
import { registerLayer, removeFromMap } from '@/core/layerRegistry'
import { eventBus, EVENTS } from '@/core/eventBus'
import { LAYERS } from '@/config'
import { CATEGORY_SYMBOLS, CATEGORY_ORDER, CLASS_BREAK_COLORS } from '@/config/symbols'
import { calcClassBreaks, levelOf, CLASS_BREAK_LEVELS } from './classBreaks'

/** 分类符号图层登记 id */
const SYMBOL_LAYER_ID = 'theme-category-symbols'
/** 分级设色面图层登记 id */
const CLASS_BREAK_LAYER_ID = 'theme-class-breaks'

/** 街道/行政区要素子图层号（LAYERS 键值形如 'wh_facility/2'） */
const STREET_SUB_LAYER_ID = String(LAYERS.LAYER_STREET).split('/')[1] || '2'
const DISTRICT_SUB_LAYER_ID = String(LAYERS.LAYER_DISTRICT).split('/')[1] || '1'

/** 空间查询单次返回上限（与 query 模块同语义） */
const MAX_RECORDS = 2000

/**
 * 生成五类分类符号的图例数据（顺序按 CATEGORY_ORDER，即 DICT_CATEGORY.SORT_NO 升序）。
 * @returns {Array<{color: string, label: string, shape: string}>} 5 项
 */
export function buildCategoryLegend() {
  return CATEGORY_ORDER.map((code) => ({
    color: CATEGORY_SYMBOLS[code].color,
    label: CATEGORY_SYMBOLS[code].l1Name,
    shape: CATEGORY_SYMBOLS[code].shape,
  }))
}

/**
 * 按 02 §5 字典颜色生成设施点符号的 DOM 片段（形状互不相同，FR-M3-01 规则 2）。
 * 视觉定稿归 R3（T-008 symbols.js 完整版），本实现保证"颜色+形状"双通道可辨识。
 * @param {string} shape 形状标识（circle/square/triangle/diamond/pentagon）
 * @param {string} color 颜色 #RRGGBB
 * @returns {string} divIcon 的 html
 */
export function shapeToHtml(shape, color) {
  const base = 'display:inline-block;width:14px;height:14px;'
  switch (shape) {
    case 'circle':
      return `<span style="${base}background:${color};border-radius:50%;"></span>`
    case 'square':
      return `<span style="${base}background:${color};border-radius:2px;"></span>`
    case 'triangle':
      return `<span style="${base}background:${color};clip-path:polygon(50% 0,100% 100%,0 100%);"></span>`
    case 'diamond':
      return `<span style="${base}background:${color};clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);"></span>`
    case 'pentagon':
      return `<span style="${base}background:${color};clip-path:polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%);"></span>`
    default:
      return `<span style="${base}background:${color};border-radius:50%;"></span>`
  }
}

/**
 * 分类符号模式：按五类渲染设施点（FR-M3-01）。
 * 调用方负责与 R3 的设施图层做显隐互斥；本函数只创建与登记符号图层。
 * @param {Array<object>} facilities 设施列表（02 §6.2 结构，含 lon/lat/categoryL1/name）
 * @returns {object} 已 addTo(map) 的 Leaflet 图层
 */
export function applySymbols(facilities) {
  const map = getMap()
  if (!map) {
    throw new Error('地图尚未初始化，无法渲染分类符号')
  }
  clearSymbolLayer()
  const points = (facilities || [])
    .filter((item) => Number.isFinite(item.lon) && Number.isFinite(item.lat))
    .map((item) => ({
      type: 'Feature',
      properties: { ...item },
      geometry: { type: 'Point', coordinates: [item.lon, item.lat] },
    }))
  const layer = L.geoJSON(
    { type: 'FeatureCollection', features: points },
    {
      pointToLayer(feature, latlng) {
        const symbol = CATEGORY_SYMBOLS[feature.properties.categoryL1]
        const color = symbol ? symbol.color : '#6B7280'
        const shape = symbol ? symbol.shape : 'circle'
        return L.marker(latlng, {
          icon: L.divIcon({ html: shapeToHtml(shape, color), className: 'theme-symbol-icon', iconSize: [14, 14] }),
        })
      },
    },
  )
  layer.addTo(map)
  registerLayer(SYMBOL_LAYER_ID, layer)
  eventBus.emit(EVENTS.THEME_CHANGE, { mode: 'category', params: { legendItems: buildCategoryLegend() } })
  return layer
}

/** 清除分类符号图层（幂等） */
export function clearSymbolLayer() {
  removeFromMap(SYMBOL_LAYER_ID)
}

/**
 * 分级设色模式（FR-M3-02）：按街道/区设施密度等指标做 5 级设色面图层。
 * 切换指标时 MUST 先清除旧层（FR-M3-02 规则 6，本函数开头即清理）。
 * @param {{level: 'district'|'street', categoryL1?: string, metric?: 'count'|'density'|'perCapita'}} options
 * @returns {Promise<{layer: object, breaks: number[], legendItems: Array<{color: string, rangeText: string}>, hoverOf: Function}>}
 */
export async function applyClassBreaks({ level, categoryL1 = 'ALL', metric = 'count' } = {}) {
  const map = getMap()
  if (!map) {
    throw new Error('地图尚未初始化，无法渲染分级设色')
  }
  if (level !== 'district' && level !== 'street') {
    throw new Error("level 仅支持 'district' 或 'street'")
  }
  clearClassBreaks()

  // FR-M3-02 规则 1：调 API-04 取 (unitCode, value) 列表（禁止前端汇总）
  const stats = await fetchDistrictStats({ level, categoryL1, metric })
  const valueByUnit = new Map(stats.list.map((row) => [row.unitCode, row]))
  const breaks = calcClassBreaks(stats.list.map((row) => row.value))
  if (!breaks) {
    throw new Error('统计数据为空，无法分级设色')
  }

  // 边界面要素来自要素服务（FR-M3-02 禁令：不修改原始边界图层几何，本函数新建独立设色层）
  const boundaryFeatures = await fetchBoundaryFeatures(level)
  const layer = L.geoJSON(
    { type: 'FeatureCollection', features: boundaryFeatures },
    {
      style: (feature) => {
        const code = boundaryUnitCode(feature)
        const row = valueByUnit.get(code)
        if (!row || typeof row.value !== 'number') {
          return { fillOpacity: 0, weight: 1, color: '#9CA3AF' }
        }
        const levelIndex = levelOf(row.value, breaks)
        return { color: '#374151', weight: 1, fillColor: CLASS_BREAK_COLORS[levelIndex - 1], fillOpacity: 0.75 }
      },
      onEachFeature: (feature, featureLayer) => {
        const row = valueByUnit.get(boundaryUnitCode(feature))
        if (!row) {
          return
        }
        // FR-M3-02 规则 5：tooltip 必须含单元名称、指标值、设施数三项
        const valueText = typeof row.value === 'number' ? String(row.value) : EMPTY_VALUE_TEXT
        featureLayer.bindTooltip(`${row.unitName}：${valueText}（${stats.unit}），设施数 ${row.facCount}`)
      },
    },
  )
  layer.addTo(map)
  registerLayer(CLASS_BREAK_LAYER_ID, layer)

  const legendItems = buildClassBreakLegend(breaks)
  eventBus.emit(EVENTS.THEME_CHANGE, { mode: 'classBreaks', params: { level, metric, legendItems, breaks } })
  return { layer, breaks, legendItems, hoverOf: (unitCode) => valueByUnit.get(unitCode) || null }
}

/** 指标值缺失时的 tooltip 占位（不用 0 顶替 null，A-23 语义） */
export const EMPTY_VALUE_TEXT = '—'

/**
 * 分级图例数据：5 个颜色 + 数值区间文本（FR-M3-02 规则 4：必须显示数值区间端点）。
 * @param {number[]} breaks 长度 6 断点
 * @returns {Array<{color: string, rangeText: string}>}
 */
export function buildClassBreakLegend(breaks) {
  const items = []
  for (let i = 0; i < CLASS_BREAK_LEVELS; i += 1) {
    items.push({
      color: CLASS_BREAK_COLORS[i],
      rangeText: `${formatBreak(breaks[i])} – ${formatBreak(breaks[i + 1])}`,
    })
  }
  return items
}

function formatBreak(value) {
  return Number(value).toFixed(2)
}

/**
 * 清除分级设色图层（切换指标/退出模式时调用，幂等）。
 * @returns {void}
 */
export function clearClassBreaks() {
  removeFromMap(CLASS_BREAK_LAYER_ID)
}

/**
 * 拉取边界要素（街道面或行政区面）。
 * @param {'district'|'street'} level
 * @returns {Promise<Array<object>>} GeoJSON 要素数组
 */
async function fetchBoundaryFeatures(level) {
  const server = createFeatureServer()
  const res = await server.queryFeatures({
    layerId: level === 'street' ? STREET_SUB_LAYER_ID : DISTRICT_SUB_LAYER_ID,
    returnGeometry: true,
    outSrs: 'EPSG:4490',
    resultRecordCount: MAX_RECORDS,
  })
  const featureSet = res && res.data && res.data.featureSet
  return featureSet && Array.isArray(featureSet.features) ? featureSet.features : []
}

/**
 * 从边界要素中取统计单元代码（街道面 → STREET_CODE，区面 → DISTRICT_CODE）。
 * @param {object} feature GeoJSON 要素
 * @returns {string | undefined}
 */
export function boundaryUnitCode(feature) {
  const attrs = feature && (feature.attributes || feature.properties)
  if (!attrs) {
    return undefined
  }
  return attrs.STREET_CODE || attrs.DISTRICT_CODE
}

// ==== 热力图（T-046，实现在 ./heatmap，AR-21：对外统一从 index 导入） ====
export {
  applyHeatmap,
  clearHeatmap,
  normalizeHeatOptions,
  ensureHeatPane,
  createHeatmapLayer,
  drawHeat,
  buildColorRamp,
  HEAT_LAYER_ID,
  HEAT_PANE_ID,
  HEAT_PANE_Z_INDEX,
} from './heatmap'

// ==== 聚合图（T-047，实现在 ./cluster） ====
export {
  applyCluster,
  clearCluster,
  normalizeClusterOptions,
  createClusterLayer,
  buildClusterMarkers,
  groupPointsByPixel,
  toggleFacilityLayer,
  CLUSTER_LAYER_ID,
  FACILITY_LAYER_ID,
  CLUSTER_LABEL_MIN_FONT_PX,
} from './cluster'
