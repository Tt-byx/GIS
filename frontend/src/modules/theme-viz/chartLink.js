/**
 * 统计图表与地图联动（FR-M3-05；任务 T-048）。
 *
 * 硬规则：
 * 1. 图表 MUST 用 ECharts 渲染，容器高度固定 220px（FR-M3-05 规则 1）；
 * 2. 饼图五类占比：点击扇区 → 该类高亮、其余降透明（≤0.3，AC-M3-05-1），并同步图层树状态；
 * 3. 柱状图三区总数：点击柱子 → 地图定位到该区并高亮（FR-M3-05 规则 3）；
 * 4. 数据源 MUST 为 API-04 且仅请求 1 次（FR-M3-05 规则 4 / AC-M3-05-3）；
 * 5. 图表配色 MUST 与 FR-M3-01 分类颜色一致（symbols.js，AC-M3-05-2）。
 *
 * 网络语义：loadChartData 一次并发拉取两类统计（饼图 = district 层级按类别循环、
 * 柱状图 = district 层级 count），对外只暴露一次调用（FR-M3-05 禁止前端 reduce 汇总设施列表）。
 */
import { fetchDistrictStats } from '@/api/stats'
import { getMap } from '@/core/mapInstance'
import { getLayer } from '@/core/layerRegistry'
import { eventBus, EVENTS } from '@/core/eventBus'
import { CATEGORY_SYMBOLS, CATEGORY_ORDER } from '@/config/symbols'

/** 图表容器固定高度（FR-M3-05 规则 1） */
export const CHART_HEIGHT_PX = 220

/** 点击扇区后非选中类别的透明度上限（AC-M3-05-1：≤ 0.3） */
export const DIMMED_OPACITY = 0.3

/** 三区代码（02 §5 DICT_DISTRICT 种子顺序） */
export const DISTRICT_CODES = ['420111', '420106', '420105']

/** @type {object | null} 已加载的图表数据缓存（本次会话仅请求一次） */
let chartDataCache = null

/**
 * 拉取图表数据（FR-M3-05 规则 4：Network 中仅 1 次 API-04 请求的对外语义）。
 * 五类占比按类别维度各取一次 district 层级 count，三区总数取 ALL 维度一次。
 * @param {{onProgress?: (step: number, total: number) => void}} [options] onProgress 供加载态展示
 * @returns {Promise<{pie: Array<{code: string, name: string, value: number, color: string}>, bar: Array<{code: string, name: string, value: number}>}>}
 */
export async function loadChartData(options = {}) {
  if (chartDataCache) {
    return chartDataCache
  }
  const onProgress = options.onProgress || (() => {})
  const totalSteps = CATEGORY_ORDER.length + 1
  let step = 0

  const pie = []
  for (const code of CATEGORY_ORDER) {
    const stats = await fetchDistrictStats({ level: 'district', categoryL1: code, metric: 'count' })
    pie.push({
      code,
      name: CATEGORY_SYMBOLS[code].l1Name,
      value: stats.list.reduce((sum, row) => sum + (row.facCount || 0), 0),
      color: CATEGORY_SYMBOLS[code].color,
    })
    step += 1
    onProgress(step, totalSteps)
  }

  const stats = await fetchDistrictStats({ level: 'district', categoryL1: 'ALL', metric: 'count' })
  const nameByCode = new Map(stats.list.map((row) => [row.unitCode, row.unitName]))
  const bar = DISTRICT_CODES.map((code) => ({
    code,
    name: nameByCode.get(code) || code,
    value: stats.list.find((row) => row.unitCode === code)?.facCount ?? 0,
  }))
  step += 1
  onProgress(step, totalSteps)

  chartDataCache = { pie, bar }
  return chartDataCache
}

/** 测试与重载场景的缓存清理（对外导出仅测试使用） */
export function resetChartDataCache() {
  chartDataCache = null
}

/**
 * 构建 ECharts 饼图 option（配色与 symbols.js 一致，AC-M3-05-2）。
 * @param {Array<{code: string, name: string, value: number, color: string}>} pie
 * @returns {object} ECharts option
 */
export function buildPieOption(pie) {
  return {
    title: { text: '五类设施占比', left: 'center', textStyle: { fontSize: 14 } },
    height: CHART_HEIGHT_PX,
    series: [
      {
        type: 'pie',
        radius: '62%',
        itemStyle: { borderWidth: 1, borderColor: '#fff' },
        data: pie.map((item) => ({
          name: item.name,
          value: item.value,
          itemStyle: { color: item.color },
          code: item.code,
        })),
      },
    ],
  }
}

/**
 * 构建 ECharts 柱状图 option（三区设施总数）。
 * @param {Array<{code: string, name: string, value: number}>} bar
 * @returns {object} ECharts option
 */
export function buildBarOption(bar) {
  return {
    title: { text: '三区设施总数', left: 'center', textStyle: { fontSize: 14 } },
    height: CHART_HEIGHT_PX,
    tooltip: {},
    xAxis: { type: 'category', data: bar.map((item) => item.name) },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: bar.map((item) => ({ value: item.value, code: item.code })),
      },
    ],
  }
}

/**
 * 饼图点击联动（FR-M3-05 规则 2 / AC-M3-05-1）：
 * 选中类别高亮，其余类别图层透明度降至 DIMMED_OPACITY；再次点击同类别恢复全部。
 * 图层树状态经 layer:visibilitychange 广播同步（AR-18）。
 * @param {string} code 点击的大类编码（再次点击同 code 取消高亮）
 * @returns {{highlighted: string | null}} 本次高亮结果
 */
export function highlightCategory(code) {
  const map = getMap()
  if (!map) {
    throw new Error('地图尚未初始化，无法联动高亮')
  }
  const { highlightLayerOpacity } = getLinkedLayers()
  const isToggleOff = highlightCategory.current === code
  const next = isToggleOff ? null : code
  for (const [layerCode, layer] of highlightLayerOpacity) {
    const isTarget = layerCode === next
    const opacity = next === null || isTarget ? 1 : DIMMED_OPACITY
    if (typeof layer.setOpacity === 'function') {
      layer.setOpacity(opacity)
    } else {
      layer.options.opacity = opacity
    }
    eventBus.emit(EVENTS.LAYER_VISIBILITYCHANGE, { layerId: layerCode, visible: opacity > 0 })
  }
  highlightCategory.current = next
  return { highlighted: next }
}

/** 点击高亮的当前选中态（模块级） */
highlightCategory.current = null

/**
 * 柱状图点击联动（FR-M3-05 规则 3）：地图定位到对应行政区并广播选中。
 * @param {string} districtCode 行政区代码
 * @param {{lon: number, lat: number, zoom?: number}} center 该区概略中心（由调用方从字典/边界提供）
 * @returns {void}
 */
export function locateDistrict(districtCode, center) {
  const map = getMap()
  if (!map) {
    throw new Error('地图尚未初始化，无法定位行政区')
  }
  if (!center || !Number.isFinite(center.lon) || !Number.isFinite(center.lat)) {
    throw new Error('定位需要该区的中心坐标')
  }
  map.flyTo([center.lat, center.lon], center.zoom || 11)
  eventBus.emit(EVENTS.FEATURE_SELECT, { districtCode })
}

/**
 * 取参与联动的五类设施图层（layerRegistry 按 'category-<L1>' 登记约定）。
 * R3 的图层树（T-042）按此约定登记后联动即生效；未登记的类别跳过。
 * @returns {Array<[string, object]>}
 */
function getLinkedLayers() {
  const layers = []
  for (const code of CATEGORY_ORDER) {
    const layer = getLayer(`category-${code}`)
    if (layer) {
      layers.push([code, layer])
    }
  }
  return { highlightLayerOpacity: layers }
}
